/**
 * Tool: list_recommendations
 *
 * Lists pending optimization recommendations awaiting approval, grouped
 * by optimization session. Each entry names the tool and the exact
 * arguments that carry it out (applyWith), its sessionId and
 * recommendationId included, or where it is approved instead. Since 0.2.26
 * there is no approve-by-id tool: OpenAI's plugin scan asked for every kind of
 * change to be its own tool.
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

/** How a recommendation can be carried out (mcp-gateway recommendation-calls.ts). "approve" is from gateways before 0.2.26. */
type ApprovalPath = "in_chat" | "approval_link" | "preview_then_add" | "in_vibeads" | "not_applicable" | "approve";

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
  /** The tool and arguments that carry it out. */
  applyWith?: { tool: string; arguments: Record<string, unknown> };
  /** The campaign's Optimize tab in VibeAds, for one no tool carries out. */
  optimizeUrl?: string;
}

const HOW_TO_APPROVE: Record<ApprovalPath, string> = {
  in_chat: "the tool below makes the change once the user agrees",
  approval_link:
    "a budget increase of more than 20%: the tool below returns a VibeAds link the user opens to approve it",
  preview_then_add:
    "a new ad group: preview_ad_group shows it, and add_ad_group adds it once the user agrees",
  in_vibeads: "no tool makes this change from a chat; it is approved on the campaign's Optimize tab in VibeAds",
  not_applicable: "advice; nothing to apply",
  approve: "approved from VibeAds' dashboard",
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
      ? `No pending recommendations for campaign ${input.campaignId}. The VibeAds agent runs diagnostics every 12 hours and adds new ones then.`
      : "No pending recommendations right now. The VibeAds agent runs diagnostics every 12 hours and adds new ones then.";
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

    lines.push(`## ${session.campaignName}: session \`${session.sessionId}\``);
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
      if (rec.applyWith) {
        lines.push(`  - Carried out with: \`${rec.applyWith.tool}\` ${JSON.stringify(rec.applyWith.arguments)}`);
      }
      if (rec.optimizeUrl) {
        lines.push(`  - Approve in VibeAds: ${rec.optimizeUrl}`);
      }
    }
    lines.push("");
  }

  lines.push(
    "Each recommendation's Carried out with line is the tool and the exact arguments that make its change; the " +
      "sessionId and recommendationId in them tie the change to the recommendation, so VibeAds measures it and it " +
      "can be undone. Carrying one out closes its session and records the rest of that session as rejected.",
  );

  return lines.join("\n");
}
