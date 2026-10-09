/**
 * Tool: set_max_cpc
 *
 * Sets the max CPC (the most Google charges for a click) of one ad group, or
 * of one keyword in it, on a Manual CPC campaign. Up to double the current
 * max CPC and at most $50 a click, it changes in Google Ads at once; more
 * returns a VibeAds approval link for the user.
 *
 * Example prompt: "Raise the bid on the Drain Cleaning ad group to $4.50"
 */

import { z } from "zod";
import { callGateway } from "../gateway.js";
import { campaignIdField, type EditReply, editReply, matchTypeField } from "./edit-reply.js";

export const setMaxCpcSchema = z.object({
  campaignId: campaignIdField,
  adGroup: z.string().describe("The ad group's name, as list_keywords shows it."),
  keyword: z
    .object({ text: z.string().describe("The keyword's text."), matchType: matchTypeField })
    .optional()
    .describe("One keyword in the ad group, to set its own max CPC. Without it, the ad group's default max CPC changes."),
  maxCpc: z.number().describe("The new max CPC in US dollars, such as 4.5."),
});

export type SetMaxCpcInput = z.infer<typeof setMaxCpcSchema>;

export async function setMaxCpc(input: SetMaxCpcInput): Promise<string> {
  return editReply(await callGateway<EditReply>("set_max_cpc", input));
}
