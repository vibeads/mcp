/**
 * Tool: apply_google_recommendation
 *
 * Applies one of Google's recommendations in the user's Google Ads account,
 * as Google recommends it, when VibeAds' rules allow it: a budget change up to
 * +20%, a keyword that is not broad match, Google's ad text only when every
 * line passes VibeAds' claim rules. VibeAds reads the recommendation from
 * Google again before applying, and refuses the rest with the reason.
 *
 * Example prompt: "Apply Google's sitelink suggestion for my Austin campaign."
 */

import { z } from "zod";
import { callGateway } from "../gateway.js";

export const applyGoogleRecommendationSchema = z.object({
  resourceName: z
    .string()
    .describe("The recommendation's resourceName from list_google_recommendations, e.g. customers/1234567890/recommendations/..."),
});

export type ApplyGoogleRecommendationInput = z.infer<typeof applyGoogleRecommendationSchema>;

interface ApplyGoogleRecommendationResult {
  applied: boolean;
  googleAdsAccount: { customerId: string; name: string | null };
  recommendation: { resourceName: string; type: string; title: string; details: Record<string, unknown> };
  note: string;
}

export async function applyGoogleRecommendation(input: ApplyGoogleRecommendationInput): Promise<string> {
  const data = await callGateway<ApplyGoogleRecommendationResult>("apply_google_recommendation", input);
  return [`✅ **Applied: ${data.recommendation.title}.**`, "", data.note].join("\n");
}
