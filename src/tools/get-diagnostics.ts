/**
 * Tool: get_diagnostics
 *
 * Returns the full list of active diagnostics + recommendations from
 * the latest optimization session per campaign. Shows severity, affected
 * metric, current value vs benchmark, and recommended action.
 *
 * Example prompt: "What should I fix in my Google Ads account?"
 */

import { z } from "zod";
import { getSupabaseClient } from "../supabase.js";

export const getDiagnosticsSchema = z.object({
  campaign_id: z
    .string()
    .optional()
    .describe("Optional: scope to a specific campaign. Otherwise returns diagnostics across all campaigns."),
  severity: z
    .enum(["critical", "high", "medium", "low", "all"])
    .optional()
    .default("all")
    .describe("Filter by severity level."),
  limit: z
    .number()
    .int()
    .positive()
    .max(50)
    .optional()
    .default(20)
    .describe("Max number of diagnostics to return (default 20, max 50)."),
});

export type GetDiagnosticsInput = z.infer<typeof getDiagnosticsSchema>;

const SEVERITY_EMOJI: Record<string, string> = {
  critical: "🚨",
  high: "⚠️",
  medium: "⚡",
  low: "💡",
};

const SEVERITY_ORDER: Record<string, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

export async function getDiagnostics(
  input: GetDiagnosticsInput,
  userId: string,
): Promise<string> {
  const supabase = getSupabaseClient();

  // Fetch latest session per campaign for the user
  let query = supabase
    .from("optimization_sessions")
    .select("id, campaign_id, diagnosis, created_at, session_type, campaigns(name)")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(100);

  if (input.campaign_id) {
    const searchId = input.campaign_id.replace(/-/g, "").toLowerCase();
    if (searchId.length < 32) {
      query = query.like("campaign_id", `${input.campaign_id}%`);
    } else {
      query = query.eq("campaign_id", input.campaign_id);
    }
  }

  const { data: sessions, error } = await query;

  if (error) {
    return `Error fetching diagnostics: ${error.message}`;
  }

  if (!sessions || sessions.length === 0) {
    return "No diagnostic data yet. Diagnostics are generated every 6 hours after your first campaign is published.";
  }

  // Collect one issue list per unique campaign (latest session)
  const seen = new Set<string>();
  const allIssues: Array<{
    campaignId: string;
    campaignName: string;
    issue: any;
  }> = [];

  for (const session of sessions) {
    if (seen.has(session.campaign_id)) continue;
    seen.add(session.campaign_id);

    const diagnosis = Array.isArray(session.diagnosis) ? session.diagnosis : [];
    for (const issue of diagnosis) {
      allIssues.push({
        campaignId: session.campaign_id,
        campaignName: (session as any).campaigns?.name ?? "Unknown campaign",
        issue,
      });
    }
  }

  // Apply severity filter + sort by severity
  let filtered = allIssues;
  if (input.severity !== "all") {
    filtered = filtered.filter(
      (entry) => (entry.issue.severity ?? "medium").toLowerCase() === input.severity,
    );
  }

  filtered.sort((a, b) => {
    const aSev = SEVERITY_ORDER[(a.issue.severity ?? "medium").toLowerCase()] ?? 2;
    const bSev = SEVERITY_ORDER[(b.issue.severity ?? "medium").toLowerCase()] ?? 2;
    return aSev - bSev;
  });

  filtered = filtered.slice(0, input.limit);

  if (filtered.length === 0) {
    return input.severity === "all"
      ? "🎉 No active diagnostics. Your account is in good shape."
      : `No ${input.severity}-severity diagnostics found.`;
  }

  const lines: string[] = [
    `# Active diagnostics${input.campaign_id ? ` (campaign ${input.campaign_id})` : ""}`,
    "",
    `Showing ${filtered.length} issue${filtered.length === 1 ? "" : "s"}${input.severity !== "all" ? ` at severity: ${input.severity}` : ""}.`,
    "",
  ];

  // Group by severity
  const bySeverity = new Map<string, typeof filtered>();
  for (const entry of filtered) {
    const sev = (entry.issue.severity ?? "medium").toLowerCase();
    if (!bySeverity.has(sev)) bySeverity.set(sev, []);
    bySeverity.get(sev)!.push(entry);
  }

  const severityOrder = ["critical", "high", "medium", "low"];
  for (const sev of severityOrder) {
    const entries = bySeverity.get(sev);
    if (!entries || entries.length === 0) continue;

    const emoji = SEVERITY_EMOJI[sev] ?? "•";
    lines.push(`## ${emoji} ${sev.toUpperCase()} (${entries.length})`);
    lines.push("");

    for (const entry of entries) {
      const issue = entry.issue;
      const rule = issue.issue ?? issue.rule ?? "unknown_rule";
      const detail = issue.detail ?? issue.message ?? "(no detail provided)";

      lines.push(`### ${rule}`);
      lines.push(`- **Campaign:** ${entry.campaignName}`);
      lines.push(`- **Problem:** ${detail}`);

      if (issue.current !== undefined && issue.benchmark !== undefined) {
        const metric = issue.metric ?? "value";
        lines.push(`- **${metric}:** current \`${issue.current}\` vs benchmark \`${issue.benchmark}\``);
      }

      if (issue.recommended_action || issue.recommendation) {
        lines.push(`- **Recommended fix:** ${issue.recommended_action ?? issue.recommendation}`);
      }

      if (issue.estimated_impact) {
        lines.push(`- **Estimated impact:** ${issue.estimated_impact}`);
      }

      lines.push("");
    }
  }

  lines.push(
    "_Run in VibeAds dashboard: https://getvibeads.com/app/campaigns to apply recommendations with one click._",
  );

  return lines.join("\n");
}
