/**
 * Tool: set_keyword_status
 *
 * Pauses keywords in a live campaign, or turns paused ones back on, in Google
 * Ads, at once. A paused keyword shows no ads and spends nothing.
 *
 * Example prompt: "Pause the keyword 'cheap plumber'"
 */

import { z } from "zod";
import { callGateway } from "../gateway.js";
import { campaignIdField, type EditReply, editReply, matchTypeField } from "./edit-reply.js";

export const setKeywordStatusSchema = z.object({
  campaignId: campaignIdField,
  status: z.enum(["paused", "enabled"]).describe("paused stops the keywords; enabled turns paused ones back on."),
  keywords: z
    .array(z.object({
      text: z.string().describe("The keyword's text, as list_keywords shows it."),
      matchType: matchTypeField,
      adGroup: z.string().optional().describe("The keyword's ad group, when two ad groups hold the same keyword."),
    }))
    .min(1)
    .max(20)
    .describe("1 to 20 keywords of the campaign."),
});

export type SetKeywordStatusInput = z.infer<typeof setKeywordStatusSchema>;

export async function setKeywordStatus(input: SetKeywordStatusInput): Promise<string> {
  return editReply(await callGateway<EditReply>("set_keyword_status", input));
}
