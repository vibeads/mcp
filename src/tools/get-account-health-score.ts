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
 * Final score is a weighted average across all campaigns.
 * Example prompt: "What's my VibeAds account health score?"
 */

import { z } from "zod";
import { getSupabaseClient } from "../supabase.js";

export const getAccountHealthScoreSchema = z.object({
  campaign_id: z
    .string()
    .optional()
    .describe(
      "Optional: scope the health score to a single campaign. If omitted, returns account-level score across all campaigns.",
    ),
});

export type GetAccountHealthScoreInput = z.infer<typeof getAccountHealthScoreSchema>;

// Map each diagnostic rule name to the health dimension it affects.
// Kept in sync with agent-optimize's diagnostic rules (see packages/services
// or supabase/functions/agent-optimize/).
const RULE_TO_DIMENSION: Record<string, keyof DimensionScores> = {
  // Tracking
  conversion_tracking_broken: "tracking",
  low_conversion_count: "tracking",
  no_recent_conversions: "tracking",
  customer_data_terms_missing: "tracking",
  enhanced_conversions_missing: "tracking",

  // Keywords
  keyword_cannibalization: "keywords",
  low_search_volume_keywords: "keywords",
  broad_match_premature: "keywords",
  missing_negative_keywords: "keywords",
  search_term_waste: "keywords",
  high_cost_no_conversions: "keywords",
  cpc_above_target: "keywords",

  // Budget
  budget_pacing_ratio: "budget",
  budget_limited: "budget",
  budget_exhausted: "budget",
  bid_below_category_range: "budget",
  bid_below_first_page: "budget",

  // Creative
  low_ad_strength: "creative",
  ad_copy_fatigue: "creative",
  rsa_headline_relevance_low: "creative",
  missing_sitelinks: "creative",
  missing_callouts: "creative",
  missing_snippets: "creative",
  poor_landing_page_experience: "creative",

  // Targeting
  geo_wasted_spend: "targeting",
  geo_bid_opportunity: "targeting",
  geo_top_performer: "targeting",
  geo_high_cpc_location: "targeting",
  low_impression_share: "targeting",
  targeting_too_narrow: "targeting",
  search_partners_waste: "targeting",

  // Performance
  declining_ctr: "performance",
  underperforming_ad_group: "performance",
  campaign_not_serving: "performance",
  bidding_strategy_upgrade: "performance",
  seasonal_opportunity: "performance",
};

interface DimensionScores {
  tracking: number;
  keywords: number;
  budget: number;
  creative: number;
  targeting: number;
  performance: number;
}

interface DimensionMeta {
  issueCount: number;
  critical: number;
  high: number;
  medium: number;
  low: number;
}

const SEVERITY_PENALTY: Record<string, number> = {
  critical: 25,
  high: 12,
  medium: 5,
  low: 2,
};

export async function getAccountHealthScore(
  input: GetAccountHealthScoreInput,
  userId: string,
): Promise<string> {
  const supabase = getSupabaseClient();

  // 1. Fetch the most recent optimization_session per campaign
  let sessionQuery = supabase
    .from("optimization_sessions")
    .select("campaign_id, diagnosis, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(200);

  if (input.campaign_id) {
    const searchId = input.campaign_id.replace(/-/g, "").toLowerCase();
    if (searchId.length < 32) {
      sessionQuery = sessionQuery.like("campaign_id", `${input.campaign_id}%`);
    } else {
      sessionQuery = sessionQuery.eq("campaign_id", input.campaign_id);
    }
  }

  const { data: sessions, error } = await sessionQuery;

  if (error) {
    return `Error fetching diagnostics: ${error.message}`;
  }

  // Keep only the latest session per campaign
  const latestByCampaign = new Map<string, any>();
  for (const s of sessions ?? []) {
    if (!latestByCampaign.has(s.campaign_id)) {
      latestByCampaign.set(s.campaign_id, s);
    }
  }

  if (latestByCampaign.size === 0) {
    return input.campaign_id
      ? `No diagnostic data for campaign "${input.campaign_id}" yet. Health check runs every 6 hours after the campaign is published.`
      : "No diagnostic data yet. Health check runs every 6 hours after your first campaign is published.";
  }

  // 2. Initialize all dimensions at 100, then deduct per-issue penalty
  const scores: DimensionScores = {
    tracking: 100,
    keywords: 100,
    budget: 100,
    creative: 100,
    targeting: 100,
    performance: 100,
  };

  const meta: Record<keyof DimensionScores, DimensionMeta> = {
    tracking: { issueCount: 0, critical: 0, high: 0, medium: 0, low: 0 },
    keywords: { issueCount: 0, critical: 0, high: 0, medium: 0, low: 0 },
    budget: { issueCount: 0, critical: 0, high: 0, medium: 0, low: 0 },
    creative: { issueCount: 0, critical: 0, high: 0, medium: 0, low: 0 },
    targeting: { issueCount: 0, critical: 0, high: 0, medium: 0, low: 0 },
    performance: { issueCount: 0, critical: 0, high: 0, medium: 0, low: 0 },
  };

  for (const session of latestByCampaign.values()) {
    const diagnosis = Array.isArray(session.diagnosis) ? session.diagnosis : [];
    for (const issue of diagnosis) {
      const ruleKey: string = issue.issue ?? issue.rule ?? "unknown";
      const severity: string = (issue.severity ?? "medium").toLowerCase();
      const dimension = RULE_TO_DIMENSION[ruleKey] ?? "performance";
      const penalty = SEVERITY_PENALTY[severity] ?? 3;

      scores[dimension] = Math.max(0, scores[dimension] - penalty);
      meta[dimension].issueCount++;
      if (severity === "critical") meta[dimension].critical++;
      else if (severity === "high") meta[dimension].high++;
      else if (severity === "medium") meta[dimension].medium++;
      else meta[dimension].low++;
    }
  }

  // Weighted overall score: Tracking + Keywords are the biggest impact drivers
  const overall = Math.round(
    scores.tracking * 0.2 +
    scores.keywords * 0.2 +
    scores.budget * 0.15 +
    scores.creative * 0.15 +
    scores.targeting * 0.15 +
    scores.performance * 0.15,
  );

  // Grade mapping
  const grade =
    overall >= 90 ? "A" :
    overall >= 80 ? "B" :
    overall >= 70 ? "C" :
    overall >= 60 ? "D" :
    "F";

  const verdict =
    overall >= 90 ? "🏆 Excellent — your account is healthy. Keep doing what you're doing." :
    overall >= 80 ? "✅ Good — a few small improvements could tighten this up." :
    overall >= 70 ? "⚠️ Fair — there are clear wins available. Review the flagged issues below." :
    overall >= 60 ? "⚠️ Poor — significant problems are leaking budget. Fix the critical items first." :
    "🚨 Critical — your account has major issues. Prioritize tracking and keywords before anything else.";

  const campaignLabel = input.campaign_id
    ? `Campaign ${input.campaign_id}`
    : `Account (${latestByCampaign.size} campaign${latestByCampaign.size === 1 ? "" : "s"})`;

  const lines: string[] = [
    `# Account Health Score`,
    "",
    `**${campaignLabel}**`,
    "",
    `## Overall: ${overall}/100 (${grade})`,
    "",
    verdict,
    "",
    `## Dimension breakdown`,
    "",
    `| Dimension | Score | Issues |`,
    `|-----------|-------|--------|`,
    `| 📊 Tracking | ${scores.tracking}/100 | ${formatIssueSummary(meta.tracking)} |`,
    `| 🔑 Keywords | ${scores.keywords}/100 | ${formatIssueSummary(meta.keywords)} |`,
    `| 💰 Budget | ${scores.budget}/100 | ${formatIssueSummary(meta.budget)} |`,
    `| 🎨 Creative | ${scores.creative}/100 | ${formatIssueSummary(meta.creative)} |`,
    `| 🎯 Targeting | ${scores.targeting}/100 | ${formatIssueSummary(meta.targeting)} |`,
    `| 📈 Performance | ${scores.performance}/100 | ${formatIssueSummary(meta.performance)} |`,
    "",
    `_Weighted: Tracking 20%, Keywords 20%, Budget 15%, Creative 15%, Targeting 15%, Performance 15%_`,
    "",
    `Use \`get_diagnostics\` to see the full list of issues and recommended fixes.`,
  ];

  return lines.join("\n");
}

function formatIssueSummary(m: DimensionMeta): string {
  if (m.issueCount === 0) return "none";
  const parts: string[] = [];
  if (m.critical > 0) parts.push(`${m.critical} critical`);
  if (m.high > 0) parts.push(`${m.high} high`);
  if (m.medium > 0) parts.push(`${m.medium} medium`);
  if (m.low > 0) parts.push(`${m.low} low`);
  return parts.join(", ");
}
