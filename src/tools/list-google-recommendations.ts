/**
 * Tool: list_google_recommendations
 *
 * Google's own recommendations for one of the user's Google Ads accounts, as
 * on the account's Recommendations page: what each would change, Google's
 * weekly estimate, and whether apply_google_recommendation can apply it here.
 * VibeAds decides that per type (budget increases up to 20%, keywords that are
 * not broad match, Google's ad text only when it passes VibeAds' claim rules).
 * Reads only.
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
  canApply: "in_chat" | "in_chat_after_text_check" | "not_here";
  reason?: string;
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
      `daily budget $${d.currentDailyBudgetUsd ?? "?"} → $${d.recommendedDailyBudgetUsd ?? "?"}` +
        (typeof d.changePercent === "number" ? ` (${d.changePercent > 0 ? "+" : ""}${d.changePercent}%)` : ""),
    );
  }
  if (typeof d.keyword === "string") parts.push(`keyword "${d.keyword}" (${d.matchType ?? "match type unknown"})`);
  if (Array.isArray(d.textToAdd) && d.textToAdd.length > 0) {
    parts.push(`text: ${d.textToAdd.slice(0, 6).map((t) => `"${t}"`).join(", ")}`);
  }
  return parts.join("; ");
}

const CAN_APPLY: Record<GoogleRecommendation["canApply"], string> = {
  in_chat: "can be applied here",
  in_chat_after_text_check: "can be applied here if its text passes VibeAds' check",
  not_here: "not applied here",
};

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
        `${CAN_APPLY[r.canApply]}${r.reason ? ` (${r.reason})` : ""}. resourceName \`${r.resourceName}\``,
    );
  }
  if (data.more) lines.push(`- …and ${data.more} more.`);
  lines.push("", data.note);
  return lines.join("\n");
}
