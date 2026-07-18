/**
 * Tool: approve_recommendation
 *
 * Approves and executes ONE already-diagnosed optimization
 * recommendation inside VibeAds' safety guardrails (blast-radius caps,
 * per-campaign rate limits, automatic rollback if metrics worsen).
 * Other pending recommendations on the same session stay pending.
 *
 * Example prompt: "Approve the negative-keyword recommendation on my
 * plumber campaign"
 */

import { z } from "zod";
import { callGateway } from "../gateway.js";

export const approveRecommendationSchema = z.object({
  sessionId: z
    .string()
    .describe(
      "The optimization session containing the recommendation (from list_recommendations).",
    ),
  recommendationId: z
    .string()
    .describe(
      "The single recommendation to approve and execute (from list_recommendations).",
    ),
});

export type ApproveRecommendationInput = z.infer<
  typeof approveRecommendationSchema
>;

export async function approveRecommendation(
  input: ApproveRecommendationInput,
): Promise<string> {
  const data = await callGateway<Record<string, unknown>>(
    "approve_recommendation",
    {
      sessionId: input.sessionId,
      recommendationId: input.recommendationId,
    },
  );

  return [
    `✅ Recommendation \`${input.recommendationId}\` approved — execution result below.`,
    "",
    "```json",
    JSON.stringify(data, null, 2),
    "```",
    "",
    "The change ran inside VibeAds' safety guardrails: if key metrics worsen, it auto-rolls back within the measurement window. Other pending recommendations on this session remain pending.",
  ].join("\n");
}
