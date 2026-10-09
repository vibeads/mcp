/**
 * Tool: set_daily_budget
 *
 * Sets a live campaign's daily budget. A decrease, or an increase of up to
 * 20%, changes in Google Ads at once; a larger increase returns a VibeAds
 * approval link for the user.
 *
 * Example prompt: "Set my Austin plumbing budget to $60 a day"
 */

import { z } from "zod";
import { callGateway } from "../gateway.js";
import { campaignIdField, type EditReply, editReply } from "./edit-reply.js";

export const setDailyBudgetSchema = z.object({
  campaignId: campaignIdField,
  dailyBudget: z.number().describe("The new daily budget in US dollars, from 1 to 10,000."),
});

export type SetDailyBudgetInput = z.infer<typeof setDailyBudgetSchema>;

export async function setDailyBudget(input: SetDailyBudgetInput): Promise<string> {
  return editReply(await callGateway<EditReply>("set_daily_budget", input));
}
