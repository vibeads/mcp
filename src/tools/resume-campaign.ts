/**
 * Tool: resume_campaign
 *
 * Starts a paused campaign again. Starting a campaign spends money, so it
 * follows request_publish: this package connects with an API key, so the
 * gateway answers with a VibeAds approval link the user opens. An assistant
 * the user connected by signing in can start it within the daily budget they
 * allow, after they confirm the budget.
 *
 * Example prompt: "Turn my Dallas HVAC campaign back on"
 */

import { z } from "zod";
import { callGateway } from "../gateway.js";
import { campaignIdField, type EditReply, editReply } from "./edit-reply.js";

export const resumeCampaignSchema = z.object({
  campaignId: campaignIdField,
  confirmedDailyBudget: z
    .number()
    .optional()
    .describe("The daily budget in US dollars that the user confirmed, equal to dailyBudgetUsd from a needsConfirmation reply."),
});

export type ResumeCampaignInput = z.infer<typeof resumeCampaignSchema>;

export async function resumeCampaign(input: ResumeCampaignInput): Promise<string> {
  return editReply(await callGateway<EditReply>("resume_campaign", input));
}
