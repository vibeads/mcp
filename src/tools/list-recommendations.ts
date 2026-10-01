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
      "Optional: the full campaign UUID from list_campaigns or apply_strategy (a short prefix is not accepted). Otherwise returns pending recommendations across all campaigns.",
    ),
});

export type ListRecommendationsInput = z.infer<
  typeof listRecommendationsSchema
>;

/** How a recommendation can be approved from here (mcp-gateway approval-route.ts). */
type ApprovalPath = "approve" | "approval_link" | "preview_then_add" | "not_applicable";

interface PendingRecommendation {
  id: string;
  action: string;
  reason: string;
  riskLevel: string;
  blastRadius: string;
  autoEligible: boolean;
  estimatedImpact?: string;
  /** Absent from gateways older than 0.2.12. */
  approval?: ApprovalPath;
  budgetChange?: {
    currentDailyBudgetUsd: number | null;
    newDailyBudgetUsd: number | null;
    changePct: number | null;
  };
  proposedAdGroupName?: string;
}

const HOW_TO_APPROVE: Record<ApprovalPath, string> = {
  approve: "approve_recommendation applies it once the user says so",
  approval_link:
    "a budget increase of more than 20%: approve_recommendation returns a VibeAds link the user opens to approve it",
  preview_then_add:
    "a new ad group: call preview_ad_group with this sessionId and recommendationId, show the preview, then add_ad_group",
  not_applicable: "advice to relay; nothing can be applied from here",
};

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
      if (rec.proposedAdGroupName) {
        lines.push(`  - New ad group: ${rec.proposedAdGroupName}`);
      }
      if (rec.budgetChange) {
        const b = rec.budgetChange;
        const now = b.currentDailyBudgetUsd === null ? "unknown" : `$${b.currentDailyBudgetUsd.toFixed(2)}`;
        const next = b.newDailyBudgetUsd === null ? "unknown" : `$${b.newDailyBudgetUsd.toFixed(2)}`;
        const pct = b.changePct === null ? "" : ` (${b.changePct > 0 ? "+" : ""}${b.changePct}%)`;
        lines.push(`  - Daily budget: ${now} to ${next}${pct}`);
      }
      if (rec.approval) {
        lines.push(`  - Approval: ${rec.approval} (${HOW_TO_APPROVE[rec.approval] ?? rec.approval})`);
      }
    }
    lines.push("");
  }

  lines.push(
    "Each recommendation's Approval line says how to act on it. Approving one closes its session and rejects the rest of that session.",
  );

  return lines.join("\n");
}
