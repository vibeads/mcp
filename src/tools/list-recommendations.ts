/**
 * Tool: list_recommendations
 *
 * Lists pending optimization recommendations awaiting approval, grouped
 * by optimization session. Each entry carries the sessionId +
 * recommendationId needed to execute it with approve_recommendation.
 *
 * Example prompt: "What optimizations are waiting for my approval?"
 */

import { z } from "zod";
import { callGateway } from "../gateway.js";

export const listRecommendationsSchema = z.object({
  campaignId: z
    .string()
    .optional()
    .describe(
      "Optional: scope to a single campaign. Otherwise returns pending recommendations across all campaigns.",
    ),
});

export type ListRecommendationsInput = z.infer<
  typeof listRecommendationsSchema
>;

interface PendingRecommendation {
  id: string;
  action: string;
  reason: string;
  riskLevel: string;
  blastRadius: string;
  autoEligible: boolean;
  estimatedImpact?: string;
}

interface RecommendationSession {
  sessionId: string;
  campaignId: string;
  campaignName: string;
  createdAt: string;
  recommendations: PendingRecommendation[];
}

interface ListRecommendationsResult {
  sessions: RecommendationSession[];
}

export async function listRecommendations(
  input: ListRecommendationsInput,
): Promise<string> {
  const data = await callGateway<ListRecommendationsResult>(
    "list_recommendations",
    input.campaignId ? { campaignId: input.campaignId } : {},
  );

  const sessions = data.sessions ?? [];
  if (sessions.length === 0) {
    return input.campaignId
      ? `No pending recommendations for campaign ${input.campaignId}. The VibeAds agent runs diagnostics every 12 hours — check back later.`
      : "No pending recommendations right now. The VibeAds agent runs diagnostics every 12 hours — check back later.";
  }

  const totalRecs = sessions.reduce(
    (n, s) => n + (s.recommendations?.length ?? 0),
    0,
  );

  const lines: string[] = [
    `# Pending recommendations (${totalRecs} across ${sessions.length} session${sessions.length === 1 ? "" : "s"})`,
    "",
  ];

  for (const session of sessions) {
    const created = session.createdAt
      ? new Date(session.createdAt).toISOString().replace("T", " ").slice(0, 16) +
        " UTC"
      : "unknown time";

    lines.push(`## ${session.campaignName} — session \`${session.sessionId}\``);
    lines.push(`_Campaign \`${session.campaignId}\` · diagnosed ${created}_`);
    lines.push("");

    for (const rec of session.recommendations ?? []) {
      lines.push(`- **${rec.action}** (\`${rec.id}\`)`);
      lines.push(`  - Reason: ${rec.reason}`);
      lines.push(
        `  - Risk: ${rec.riskLevel} · Blast radius: ${rec.blastRadius} · Auto-eligible: ${rec.autoEligible ? "yes" : "no"}`,
      );
      if (rec.estimatedImpact) {
        lines.push(`  - Estimated impact: ${rec.estimatedImpact}`);
      }
    }
    lines.push("");
  }

  lines.push(
    "To execute one, call `approve_recommendation` with its sessionId and recommendationId. Approving one recommendation leaves the others pending.",
  );

  return lines.join("\n");
}
