/**
 * Tool: add_keywords
 *
 * Adds keywords to one ad group of a live campaign in Google Ads, at once.
 * New keywords bid the ad group's default max CPC and spend within the
 * campaign's daily budget. A keyword already there, or one a negative keyword
 * in the campaign blocks, is left out, and the reply says why.
 *
 * Example prompt: "Add 'tankless water heater repair' to the Water Heaters ad group"
 */

import { z } from "zod";
import { callGateway } from "../gateway.js";
import { campaignIdField, type EditReply, editReply, matchTypeField } from "./edit-reply.js";

export const addKeywordsSchema = z.object({
  campaignId: campaignIdField,
  adGroup: z.string().describe("The ad group's name, as list_keywords or get_campaign_details shows it."),
  keywords: z
    .array(z.object({ text: z.string().describe("The keyword."), matchType: matchTypeField }))
    .min(1)
    .max(20)
    .describe("1 to 20 keywords. \"near me\" and similar words come off, as Google's editorial rules ask."),
});

export type AddKeywordsInput = z.infer<typeof addKeywordsSchema>;

export async function addKeywords(input: AddKeywordsInput): Promise<string> {
  return editReply(await callGateway<EditReply>("add_keywords", input));
}
