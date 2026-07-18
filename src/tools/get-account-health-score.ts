/**
 * Tool: get_account_health_score
 *
 * Computes a 0-100 account health score across 6 dimensions by rolling
 * up all active diagnostics from the user's optimization_sessions. This
 * is the read-only version of the "Account Health Score" feature.
 *
 * 6 dimensions (each 0-100):
 *   1. Tracking      — conversion tracking health, recent conversions
 *   2. Keywords      — cannibalization, LSV, negative keyword density
 *   3. Budget        — pacing, exhaustion, budget-limited states
 *   4. Creative      — ad strength, RSA diversity, headline relevance
 *   5. Targeting     — location/device/schedule spread
 *   6. Performance   — CTR, CPA, conversion rate vs benchmark
 *
 * Final score is a weighted average across all campaigns. The scoring
 * (RULE_TO_DIMENSION rollup) runs server-side in the mcp-gateway; only
 * VIBEADS_API_KEY is needed.
 *
 * Example prompt: "What's my VibeAds account health score?"
 */

import { z } from "zod";
import { callGateway } from "../gateway.js";

export const getAccountHealthScoreSchema = z.object({
  campaign_id: z
    .string()
    .optional()
    .describe(
      "Optional: scope the health score to a single campaign. If omitted, returns account-level score across all campaigns.",
    ),
});

export type GetAccountHealthScoreInput = z.infer<typeof getAccountHealthScoreSchema>;

export async function getAccountHealthScore(
  input: GetAccountHealthScoreInput,
): Promise<string> {
  const data = await callGateway<{ text: string }>(
    "get_account_health_score",
    input,
  );
  return data.text;
}
