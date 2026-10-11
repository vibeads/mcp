/**
 * Tool: set_max_cpc
 *
 * Sets the max CPC (the most Google charges for a click) of one ad group, of
 * one keyword in it, or of a list of keywords each with its own bid (0.2.26),
 * on a Manual CPC campaign. Up to double the current
 * max CPC and at most $50 a click, it changes in Google Ads at once; more
 * returns a VibeAds approval link for the user.
 *
 * Example prompt: "Raise the bid on the Drain Cleaning ad group to $4.50"
 */

import { z } from "zod";
import { callGateway } from "../gateway.js";
import { campaignIdField, type EditReply, editReply, matchTypeField, recommendationFields } from "./edit-reply.js";

export const setMaxCpcSchema = z.object({
  campaignId: campaignIdField,
  adGroup: z
    .string()
    .optional()
    .describe("The ad group's name, as list_keywords shows it. Needed for one ad group's or one keyword's max CPC; with keywords, it narrows them to that ad group."),
  keyword: z
    .object({ text: z.string().describe("The keyword's text."), matchType: matchTypeField })
    .optional()
    .describe("One keyword in the ad group, to set its own max CPC. Without it, the ad group's default max CPC changes."),
  maxCpc: z.number().optional().describe("The new max CPC in US dollars, such as 4.5, for the ad group or the one keyword."),
  keywords: z
    .array(
      z.object({
        text: z.string().describe("The keyword's text, as list_keywords shows it."),
        matchType: matchTypeField,
        adGroup: z.string().optional().describe("The keyword's ad group, when two ad groups hold the same keyword."),
        maxCpc: z.number().describe("This keyword's new max CPC in US dollars."),
      }),
    )
    .min(1)
    .max(20)
    .optional()
    .describe("Up to 20 keywords, each with its own new max CPC, set in one call (in place of adGroup, keyword and maxCpc). Each follows the same limit as one keyword; a list with a bigger raise changes nothing."),
  ...recommendationFields,
});

export type SetMaxCpcInput = z.infer<typeof setMaxCpcSchema>;

export async function setMaxCpc(input: SetMaxCpcInput): Promise<string> {
  return editReply(await callGateway<EditReply>("set_max_cpc", input));
}
