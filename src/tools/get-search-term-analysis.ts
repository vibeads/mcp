/**
 * Tool: get_search_term_analysis
 *
 * Finds wasted ad spend by analyzing search terms from the agent-sync
 * table. Returns the top high-cost / zero-conversion terms that should
 * be negated, plus high-performing terms worth investigating. Executed
 * server-side by the mcp-gateway; only VIBEADS_API_KEY is needed.
 *
 * Example prompt: "What search terms are wasting my budget?"
 */

import { z } from "zod";
import { callGateway } from "../gateway.js";

export const getSearchTermAnalysisSchema = z.object({
  campaign_id: z
    .string()
    .optional()
    .describe("Optional: scope to a specific campaign. Otherwise analyzes all campaigns."),
  lookback_days: z
    .number()
    .int()
    .positive()
    .max(90)
    .optional()
    .default(30)
    .describe("How many days of search term data to analyze (max 90)."),
  min_cost: z
    .number()
    .positive()
    .optional()
    .default(10)
    .describe("Minimum USD cost threshold for a term to be considered 'wasted'. Defaults to $10."),
});

export type GetSearchTermAnalysisInput = z.infer<typeof getSearchTermAnalysisSchema>;

export async function getSearchTermAnalysis(
  input: GetSearchTermAnalysisInput,
): Promise<string> {
  const data = await callGateway<{ text: string }>(
    "get_search_term_analysis",
    input,
  );
  return data.text;
}
