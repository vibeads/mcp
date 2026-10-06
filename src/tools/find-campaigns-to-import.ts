/**
 * Tool: find_campaigns_to_import (list_google_ads_campaigns in 0.2.15)
 *
 * Reads the campaigns in one of the user's Google Ads accounts straight from
 * Google Ads, each marked with whether it is in VibeAds. VibeAds' optimizer,
 * reports and recommendations cover only campaigns in VibeAds (published from
 * VibeAds or imported), so this is how an assistant finds the ones to bring in
 * with import_campaigns, for example right after the user connects Google Ads.
 *
 * Renamed in 0.2.16: as list_google_ads_campaigns, ChatGPT chose it for "Show
 * me my Google Ads campaigns in VibeAds", the plugin's first review test case,
 * and answered with a Google Ads connect link instead of the user's campaigns
 * (Oct 3 2026). list_campaigns answers that. The gateway still accepts the old
 * action name for 0.2.15.
 *
 * Example prompt: "Bring in the campaigns I already have in Google Ads."
 */

import { z } from "zod";
import { callGateway } from "../gateway.js";

export const findCampaignsToImportSchema = z.object({
  customerId: z
    .string()
    .optional()
    .describe(
      "Which Google Ads account to read, when the user has more than one: an ID from the accounts a choose_google_ads_account answer listed, e.g. 123-456-7890. Not needed with one account.",
    ),
});

export type FindCampaignsToImportInput = z.infer<typeof findCampaignsToImportSchema>;

interface GoogleAdsCampaign {
  googleCampaignId: string;
  name: string | null;
  status: string | null;
  type: string | null;
  dailyBudgetUsd: number | null;
  last30Days: { impressions: number; clicks: number; spendUsd: number | null; conversions: number };
  inVibeAds: boolean;
}

interface FindCampaignsToImportResult {
  googleAdsAccount: { customerId: string; name: string | null };
  campaigns: GoogleAdsCampaign[];
  note: string;
}

const money = (n: number | null) => (n === null ? "unknown" : `$${n.toFixed(2).replace(/\.00$/, "")}`);

export async function findCampaignsToImport(input: FindCampaignsToImportInput): Promise<string> {
  const data = await callGateway<FindCampaignsToImportResult>("find_campaigns_to_import", input);
  const account = data.googleAdsAccount.name
    ? `${data.googleAdsAccount.name} (${data.googleAdsAccount.customerId})`
    : data.googleAdsAccount.customerId;
  const lines = [`**Campaigns in Google Ads account ${account}**`, ""];
  for (const c of data.campaigns) {
    const d = c.last30Days;
    lines.push(
      `- **${c.name ?? "Unnamed"}** (googleCampaignId \`${c.googleCampaignId}\`): ${c.status ?? "unknown status"}, ` +
        `${c.type ?? "unknown type"}, ${c.dailyBudgetUsd === null ? "budget unknown" : `${money(c.dailyBudgetUsd)} a day`}. ` +
        `Last 30 days: ${d.impressions.toLocaleString("en-US")} impressions, ${d.clicks.toLocaleString("en-US")} clicks, ` +
        `${money(d.spendUsd)} spent, ${d.conversions} conversions. ${c.inVibeAds ? "Already in VibeAds." : "Not in VibeAds."}`,
    );
  }
  lines.push("", data.note);
  return lines.join("\n");
}
