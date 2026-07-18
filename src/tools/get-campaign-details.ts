/**
 * Tool: get_campaign_details
 *
 * Deep dive on a single campaign: budget, targeting, ad groups, recent
 * performance, landing pages, and active diagnostics. Executed server-side
 * by the mcp-gateway (query + shaping); only VIBEADS_API_KEY is needed.
 *
 * Example prompt: "Tell me everything about campaign abc123"
 */

import { z } from "zod";
import { callGateway } from "../gateway.js";

export const getCampaignDetailsSchema = z.object({
  campaign_id: z
    .string()
    .describe(
      'The VibeAds campaign UUID. Can be the full UUID or the short 8-character prefix shown in list_campaigns (e.g. "a1b2c3d4").',
    ),
});

export type GetCampaignDetailsInput = z.infer<typeof getCampaignDetailsSchema>;

export async function getCampaignDetails(
  input: GetCampaignDetailsInput,
): Promise<string> {
  const data = await callGateway<{ text: string }>(
    "get_campaign_details",
    input,
  );
  return data.text;
}
