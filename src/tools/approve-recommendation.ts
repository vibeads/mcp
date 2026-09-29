/**
 * Tool: approve_recommendation
 *
 * Approves and executes ONE already-diagnosed optimization
 * recommendation through the dashboard's approval path. The approval is
 * the decision for the whole session: the other recommendations in it are
 * recorded as rejected.
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
    "Any other recommendations in this session were recorded as rejected and can no longer be approved. Changes classified surgical or meaningful are measured and rolled back automatically if key metrics worsen.",
  ].join("\n");
}
