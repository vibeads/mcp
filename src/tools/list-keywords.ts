/**
 * Tool: list_keywords
 *
 * One campaign's ad groups, keywords and negative keywords, read live from
 * Google Ads, with each keyword's match type, status, max CPC and the last 30
 * days of clicks, cost and conversions. The keyword and bid edits name
 * keywords and ad groups the way this list shows them.
 *
 * Example prompt: "Which keywords in my Austin plumbing campaign are paused?"
 */

import { z } from "zod";
import { callGateway } from "../gateway.js";
import { campaignIdField } from "./edit-reply.js";

export const listKeywordsSchema = z.object({
  campaignId: campaignIdField,
  adGroup: z.string().optional().describe("An ad group's name, to list that ad group only."),
});

export type ListKeywordsInput = z.infer<typeof listKeywordsSchema>;

export async function listKeywords(input: ListKeywordsInput): Promise<string> {
  const data = await callGateway<{ text: string }>("list_keywords", input);
  return data.text;
}
