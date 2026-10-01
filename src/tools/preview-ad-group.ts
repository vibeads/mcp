/**
 * Tool: preview_ad_group
 *
 * Writes a new ad group for a campaign and shows what adding it would do,
 * without adding anything: keywords, the three ads, the landing page, images
 * and the daily budget per ad group. Named by the user (campaignId + name) or
 * the optimizer's recommendation (sessionId + recommendationId). add_ad_group
 * adds exactly the preview the user agreed to.
 *
 * Example prompt: "Show me the new ad group VibeAds recommends for my
 * plumbing campaign"
 */

import { z } from "zod";
import { callGateway } from "../gateway.js";

export const previewAdGroupSchema = z.object({
  campaignId: z
    .string()
    .optional()
    .describe(
      "For an ad group the user names: the full campaign UUID (from list_campaigns). Give name with it.",
    ),
  name: z
    .string()
    .optional()
    .describe(
      'For an ad group the user names: its name, 2 to 80 characters, e.g. "Tankless Water Heaters". Use a service the business offers that the campaign does not cover yet.',
    ),
  sessionId: z
    .string()
    .optional()
    .describe(
      "For a recommended ad group: the sessionId from list_recommendations. Give recommendationId with it.",
    ),
  recommendationId: z
    .string()
    .optional()
    .describe(
      "For a recommended ad group: the recommendationId of a recommendation whose approval is preview_then_add.",
    ),
});

export type PreviewAdGroupInput = z.infer<typeof previewAdGroupSchema>;

interface Ad {
  angle: string;
  headlines: string[];
  descriptions: string[];
}

interface Preview {
  name: string;
  campaignName: string | null;
  keywords: Array<{ text: string; matchType: string }>;
  negativeKeywordCount: number;
  ads: Ad[];
  negativesForOtherAdGroups: number;
  goesLiveNow: boolean;
  whenLive: string;
  landingPage: string;
  images: string | null;
  budget: {
    dailyBudgetUsd: number;
    adGroupsAfter: number;
    perAdGroupUsd: number;
    warning: string | null;
  };
  expiresAt: string;
}

interface PreviewAdGroupResult {
  proposalId: string;
  preview: Preview;
  note: string;
}

export async function previewAdGroup(input: PreviewAdGroupInput): Promise<string> {
  const data = await callGateway<PreviewAdGroupResult>("preview_ad_group", input);
  const p = data.preview;

  const lines: string[] = [
    `# Preview: "${p.name}"${p.campaignName ? ` in ${p.campaignName}` : ""}`,
    "",
    "Nothing has been added yet.",
    "",
    `**Keywords (${p.keywords.length}):** ${p.keywords.map((k) => `${k.text} (${k.matchType.toLowerCase()})`).join(", ")}`,
  ];
  if (p.negativeKeywordCount > 0) {
    lines.push(`**Negative keywords:** ${p.negativeKeywordCount}`);
  }
  for (const [i, ad] of p.ads.entries()) {
    lines.push("", `**Ad ${i + 1} (${ad.angle.replace(/_/g, " ")})**`);
    lines.push(`- Headlines: ${ad.headlines.join(" | ")}`);
    lines.push(`- Descriptions: ${ad.descriptions.join(" | ")}`);
  }
  lines.push(
    "",
    `**When it goes live:** ${p.whenLive}`,
    `**Landing page:** ${p.landingPage}`,
  );
  if (p.images) lines.push(`**Images:** ${p.images}`);
  if (p.negativesForOtherAdGroups > 0) {
    lines.push(
      `**Other ad groups:** ${p.negativesForOtherAdGroups} negative keyword(s) are added to the campaign's other ad groups so they do not compete with this one.`,
    );
  }
  lines.push(
    `**Budget:** the $${p.budget.dailyBudgetUsd.toFixed(2)} daily budget would be shared by ${p.budget.adGroupsAfter} ad groups, about $${p.budget.perAdGroupUsd.toFixed(2)} each. The budget itself does not change.`,
  );
  if (p.budget.warning) lines.push(`**Note:** ${p.budget.warning}`);
  lines.push(
    "",
    `Proposal ID: \`${data.proposalId}\` (expires ${p.expiresAt.replace("T", " ").slice(0, 16)} UTC)`,
    "",
    data.note,
  );
  return lines.join("\n");
}
