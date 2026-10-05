/**
 * Tool: import_campaigns
 *
 * Brings up to 3 campaigns from the user's Google Ads account into VibeAds:
 * their ad groups, keywords, ads, targeting and extensions. VibeAds then
 * manages them like campaigns it published. Nothing changes in Google Ads.
 * Costs 1 VibeAds credit per campaign.
 *
 * Example prompt: "Import my Austin Drain Cleaning campaign into VibeAds"
 */

import { z } from "zod";
import { callGateway } from "../gateway.js";

export const importCampaignsSchema = z.object({
  googleCampaignIds: z
    .array(z.string())
    .min(1)
    .max(3)
    .describe(
      "1 to 3 googleCampaignId values from find_campaigns_to_import, for campaigns the user chose to bring into VibeAds.",
    ),
  customerId: z
    .string()
    .optional()
    .describe(
      "The Google Ads account the campaigns are in, when the user has more than one: the ID find_campaigns_to_import read them from, e.g. 123-456-7890.",
    ),
});

export type ImportCampaignsInput = z.infer<typeof importCampaignsSchema>;

interface ImportCampaignsResult {
  imported: Array<{ campaignId: string; name: string | null; status: string | null; googleCampaignId: string }>;
  googleAdsAccount: { customerId: string; name: string | null };
  errors?: unknown[];
  note: string;
}

export async function importCampaigns(input: ImportCampaignsInput): Promise<string> {
  const data = await callGateway<ImportCampaignsResult>("import_campaigns", input);
  const lines = [data.imported.length > 0 ? "📥 **Imported into VibeAds**" : "**Nothing was imported**", ""];
  for (const c of data.imported) {
    lines.push(`- **${c.name ?? "Unnamed"}**: campaignId \`${c.campaignId}\` (status ${c.status ?? "unknown"})`);
  }
  if (data.errors && data.errors.length > 0) {
    lines.push("", "Some campaigns could not be imported:", "```json", JSON.stringify(data.errors, null, 2), "```");
  }
  lines.push("", data.note);
  return lines.join("\n");
}
