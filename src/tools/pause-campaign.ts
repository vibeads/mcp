/**
 * Tool: pause_campaign
 *
 * Pauses one of the user's published campaigns in Google Ads, the same as
 * the Pause button in VibeAds: no ads show and nothing is spent. Starting it
 * again spends money, so that stays in VibeAds (Start ads on the campaign's
 * page).
 *
 * Example prompt: "Pause my Dallas HVAC campaign"
 */

import { z } from "zod";
import { callGateway } from "../gateway.js";

export const pauseCampaignSchema = z.object({
  campaignId: z
    .string()
    .describe("The full campaign UUID from list_campaigns, import_campaigns or apply_strategy. A short prefix is not accepted."),
});

export type PauseCampaignInput = z.infer<typeof pauseCampaignSchema>;

interface PauseCampaignResult {
  paused: boolean;
  campaign: { campaignId: string; name: string | null };
  warning?: string;
  note: string;
}

export async function pauseCampaign(input: PauseCampaignInput): Promise<string> {
  const data = await callGateway<PauseCampaignResult>("pause_campaign", input);
  return [
    `⏸️ **${data.campaign.name ?? "The campaign"} is paused.**`,
    "",
    data.note,
    ...(data.warning ? ["", data.warning] : []),
  ].join("\n");
}
