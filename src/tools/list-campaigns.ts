/**
 * Tool: list_campaigns
 *
 * Returns all campaigns owned by the authenticated user with high-level
 * status, budget, and recent performance metrics. Executed server-side by
 * the mcp-gateway (query + shaping); only VIBEADS_API_KEY is needed.
 *
 * Example prompt: "Show me all my VibeAds campaigns"
 */

import { z } from "zod";
import { callGateway } from "../gateway.js";

export const listCampaignsSchema = z.object({
  status: z
    .enum(["draft", "active", "paused", "ended", "queued", "all"])
    .optional()
    .default("all")
    .describe("Filter campaigns by status. Defaults to all."),
  limit: z
    .number()
    .int()
    .positive()
    .max(100)
    .optional()
    .default(25)
    .describe("Maximum number of campaigns to return (max 100)."),
});

export type ListCampaignsInput = z.infer<typeof listCampaignsSchema>;

export async function listCampaigns(
  input: ListCampaignsInput,
): Promise<string> {
  const data = await callGateway<{ text: string }>("list_campaigns", input);
  return data.text;
}
