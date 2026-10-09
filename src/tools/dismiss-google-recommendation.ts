/**
 * Tool: dismiss_google_recommendation
 *
 * Dismisses one of Google's recommendations: Google stops showing it on the
 * account's Recommendations page, and no campaign changes.
 *
 * Example prompt: "Dismiss Google's suggestion to use broad match."
 */

import { z } from "zod";
import { callGateway } from "../gateway.js";

export const dismissGoogleRecommendationSchema = z.object({
  resourceName: z
    .string()
    .describe("The recommendation's resourceName from list_google_recommendations, e.g. customers/1234567890/recommendations/..."),
});

export type DismissGoogleRecommendationInput = z.infer<typeof dismissGoogleRecommendationSchema>;

interface DismissGoogleRecommendationResult {
  dismissed: boolean;
  resourceName: string;
  note: string;
}

export async function dismissGoogleRecommendation(input: DismissGoogleRecommendationInput): Promise<string> {
  const data = await callGateway<DismissGoogleRecommendationResult>("dismiss_google_recommendation", input);
  return [`**Dismissed.**`, "", data.note].join("\n");
}
