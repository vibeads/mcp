/**
 * Tool: list_google_recommendations
 *
 * Google's own recommendations for one of the user's Google Ads accounts, as
 * on the account's Recommendations page: what each would change, Google's
 * weekly estimate, and the tool and arguments that make the same change from
 * a chat (set_daily_budget for a budget, add_keywords for a keyword that is not
 * broad match, on campaigns in VibeAds), or why it is applied in Google Ads.
 * Reads only. Since 0.2.26 there is no apply-by-id tool: OpenAI's plugin scan
 * asked for every kind of change to be its own tool.
 *
 * Example prompt: "What does Google recommend for my Austin campaign?"
 */

import { z } from "zod";
import { callGateway } from "../gateway.js";

export const listGoogleRecommendationsSchema = z.object({
  campaignId: z
    .string()
    .optional()
    .describe("A VibeAds campaign's full UUID, to list only that campaign's recommendations."),
  googleCampaignId: z
    .string()
    .optional()
    .describe("A Google Ads campaign number, to list only that campaign's recommendations (for a campaign not in VibeAds)."),
  customerId: z
    .string()
    .optional()
    .describe(
      "Which Google Ads account to read, when the user has more than one: an ID from the accounts a choose_google_ads_account answer listed, e.g. 123-456-7890.",
    ),
});

export type ListGoogleRecommendationsInput = z.infer<typeof listGoogleRecommendationsSchema>;

interface GoogleRecommendation {
  resourceName: string;
  type: string;
  title: string;
  campaigns: Array<{ googleCampaignId: string; name: string | null; campaignId?: string; inVibeAds: boolean }>;
  details: Record<string, unknown>;
  googleEstimatePerWeek?: Record<string, number>;
  /** From 0.2.26 gateways. */
  applyIn?: "chat" | "google_ads";
  applyWith?: { tool: string; arguments: Record<string, unknown> };
  reason?: string;
  /** From older gateways. */
  canApply?: "in_chat" | "in_chat_after_text_check" | "not_here";
}

interface ListGoogleRecommendationsResult {
  googleAdsAccount: { customerId: string; name: string | null };
  recommendations: GoogleRecommendation[];
  more?: number;
  note: string;
}

function detailText(d: Record<string, unknown>): string {
  const parts: string[] = [];
  if (typeof d.currentDailyBudgetUsd === "number" || typeof d.recommendedDailyBudgetUsd === "number") {
    parts.push(
      `daily budget $${d.currentDailyBudgetUsd ?? "?"} to $${d.recommendedDailyBudgetUsd ?? "?"}` +
        (typeof d.changePercent === "number" ? ` (${d.changePercent > 0 ? "+" : ""}${d.changePercent}%)` : ""),
    );
  }
  if (typeof d.keyword === "string") parts.push(`keyword "${d.keyword}" (${d.matchType ?? "match type unknown"})`);
  if (Array.isArray(d.textToAdd) && d.textToAdd.length > 0) {
    parts.push(`text: ${d.textToAdd.slice(0, 6).map((t) => `"${t}"`).join(", ")}`);
  }
  return parts.join("; ");
}

function howText(r: GoogleRecommendation): string {
  if (r.applyWith) return `Carried out with \`${r.applyWith.tool}\` ${JSON.stringify(r.applyWith.arguments)}`;
  if (r.applyIn === "google_ads") return `Applied in Google Ads${r.reason ? ` (${r.reason})` : ""}`;
  return r.reason ? `Not applied here (${r.reason})` : "Applied in Google Ads";
}

export async function listGoogleRecommendations(input: ListGoogleRecommendationsInput): Promise<string> {
  const data = await callGateway<ListGoogleRecommendationsResult>("list_google_recommendations", input);
  const account = data.googleAdsAccount.name
    ? `${data.googleAdsAccount.name} (${data.googleAdsAccount.customerId})`
    : data.googleAdsAccount.customerId;
  const lines = [`**Google's recommendations for ${account}**`, ""];
  for (const r of data.recommendations) {
    const campaigns = r.campaigns.map((c) => `${c.name ?? c.googleCampaignId}${c.inVibeAds ? "" : " (not in VibeAds)"}`).join(", ");
    const detail = detailText(r.details);
    const estimate = r.googleEstimatePerWeek
      ? ` Google's weekly estimate: ${Object.entries(r.googleEstimatePerWeek).map(([k, v]) => `${k} ${v}`).join(", ")}.`
      : "";
    lines.push(
      `- **${r.title}**${campaigns ? ` for ${campaigns}` : ""}${detail ? `: ${detail}` : ""}.${estimate} ` +
        `${howText(r)}. resourceName \`${r.resourceName}\``,
    );
  }
  if (data.more) lines.push(`- …and ${data.more} more.`);
  lines.push("", data.note);
  return lines.join("\n");
}
