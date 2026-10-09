/**
 * Tool: add_negative_keywords
 *
 * Adds negative keywords to a live campaign, or to one of its ad groups, in
 * Google Ads, at once. A negative that would stop one of the campaign's own
 * keywords from showing ads is left out, and the reply says which keyword.
 *
 * Example prompt: "Add 'free' and 'diy' as negative keywords on my plumbing campaign"
 */

import { z } from "zod";
import { callGateway } from "../gateway.js";
import { campaignIdField, type EditReply, editReply, matchTypeField } from "./edit-reply.js";

export const addNegativeKeywordsSchema = z.object({
  campaignId: campaignIdField,
  keywords: z
    .array(z.object({ text: z.string().describe("The search word or words to block."), matchType: matchTypeField }))
    .min(1)
    .max(20)
    .describe("1 to 20 negative keywords. A one-word PHRASE negative blocks every search containing that word."),
  adGroup: z
    .string()
    .optional()
    .describe("An ad group's name, for negatives on that ad group only. Without it they apply to the whole campaign."),
});

export type AddNegativeKeywordsInput = z.infer<typeof addNegativeKeywordsSchema>;

export async function addNegativeKeywords(input: AddNegativeKeywordsInput): Promise<string> {
  return editReply(await callGateway<EditReply>("add_negative_keywords", input));
}
