/**
 * Tool: get_search_term_analysis
 *
 * Finds wasted ad spend by analyzing search terms from the agent-sync
 * table. Returns the top high-cost / zero-conversion terms that should
 * be negated, plus high-performing terms worth investigating.
 *
 * Example prompt: "What search terms are wasting my budget?"
 */

import { z } from "zod";
import { getSupabaseClient } from "../supabase.js";

export const getSearchTermAnalysisSchema = z.object({
  campaign_id: z
    .string()
    .optional()
    .describe("Optional: scope to a specific campaign. Otherwise analyzes all campaigns."),
  lookback_days: z
    .number()
    .int()
    .positive()
    .max(90)
    .optional()
    .default(30)
    .describe("How many days of search term data to analyze (max 90)."),
  min_cost: z
    .number()
    .positive()
    .optional()
    .default(10)
    .describe("Minimum USD cost threshold for a term to be considered 'wasted'. Defaults to $10."),
});

export type GetSearchTermAnalysisInput = z.infer<typeof getSearchTermAnalysisSchema>;

export async function getSearchTermAnalysis(
  input: GetSearchTermAnalysisInput,
  userId: string,
): Promise<string> {
  const supabase = getSupabaseClient();

  // Resolve campaign scope
  let campaignIds: string[] | null = null;
  if (input.campaign_id) {
    const searchId = input.campaign_id.replace(/-/g, "").toLowerCase();
    const query = supabase.from("campaigns").select("id").eq("user_id", userId);
    const { data } = searchId.length < 32
      ? await query.like("id", `${input.campaign_id}%`)
      : await query.eq("id", input.campaign_id);
    campaignIds = (data ?? []).map((c) => c.id);
    if (campaignIds.length === 0) {
      return `No campaign found matching "${input.campaign_id}".`;
    }
  }

  // Fetch search terms
  const cutoff = new Date(Date.now() - input.lookback_days * 86400000).toISOString();
  let query = supabase
    .from("search_terms")
    .select(
      "search_term, campaign_id, ad_group_name, impressions, clicks, cost_micros, conversions, date",
    )
    .eq("user_id", userId)
    .gte("date", cutoff)
    .order("cost_micros", { ascending: false })
    .limit(500);

  if (campaignIds) {
    query = query.in("campaign_id", campaignIds);
  }

  const { data: rows, error } = await query;

  if (error) {
    return `Error fetching search terms: ${error.message}`;
  }

  if (!rows || rows.length === 0) {
    return `No search term data found for the last ${input.lookback_days} days. Search terms are synced every 6 hours via agent-sync.`;
  }

  // Aggregate by search term (sum across dates)
  const aggregated = new Map<
    string,
    {
      term: string;
      adGroup: string;
      impressions: number;
      clicks: number;
      cost: number;
      conversions: number;
    }
  >();

  for (const row of rows) {
    const key = `${row.search_term}|${row.campaign_id}`;
    const existing = aggregated.get(key);
    const cost = Number(row.cost_micros) / 1_000_000;
    if (existing) {
      existing.impressions += Number(row.impressions) || 0;
      existing.clicks += Number(row.clicks) || 0;
      existing.cost += cost;
      existing.conversions += Number(row.conversions) || 0;
    } else {
      aggregated.set(key, {
        term: row.search_term,
        adGroup: row.ad_group_name ?? "—",
        impressions: Number(row.impressions) || 0,
        clicks: Number(row.clicks) || 0,
        cost,
        conversions: Number(row.conversions) || 0,
      });
    }
  }

  const terms = Array.from(aggregated.values());

  // Wasted: cost > threshold AND conversions === 0
  const wasted = terms
    .filter((t) => t.cost >= input.min_cost && t.conversions === 0)
    .sort((a, b) => b.cost - a.cost)
    .slice(0, 15);

  // Winners: highest conversion rate with meaningful click volume
  const winners = terms
    .filter((t) => t.clicks >= 5 && t.conversions >= 1)
    .sort((a, b) => b.conversions / Math.max(1, b.clicks) - a.conversions / Math.max(1, a.clicks))
    .slice(0, 10);

  const totalWastedCost = wasted.reduce((sum, t) => sum + t.cost, 0);
  const totalAnalyzedCost = terms.reduce((sum, t) => sum + t.cost, 0);
  const wastePct = totalAnalyzedCost > 0
    ? ((totalWastedCost / totalAnalyzedCost) * 100).toFixed(1)
    : "0.0";

  const lines: string[] = [
    `# Search Term Analysis (last ${input.lookback_days} days)`,
    "",
    `- **Total terms analyzed:** ${terms.length}`,
    `- **Total spend:** $${totalAnalyzedCost.toFixed(2)}`,
    `- **Wasted spend** (cost ≥ $${input.min_cost}, 0 conversions): **$${totalWastedCost.toFixed(2)}** (${wastePct}%)`,
    "",
  ];

  if (wasted.length === 0) {
    lines.push("## 🎉 No wasted spend detected");
    lines.push("");
    lines.push("No search terms above the cost threshold with zero conversions.");
  } else {
    lines.push(`## 🔥 Top ${wasted.length} waste terms to negate`);
    lines.push("");
    lines.push("| Search term | Ad group | Clicks | Cost | Recommended |");
    lines.push("|-------------|----------|--------|------|-------------|");
    for (const t of wasted) {
      lines.push(
        `| \`${t.term}\` | ${t.adGroup} | ${t.clicks} | $${t.cost.toFixed(2)} | Add as negative keyword |`,
      );
    }
    lines.push("");
    lines.push(
      `**Potential savings:** $${totalWastedCost.toFixed(2)} per ${input.lookback_days} days = $${((totalWastedCost / input.lookback_days) * 30).toFixed(2)}/mo`,
    );
  }

  if (winners.length > 0) {
    lines.push("");
    lines.push(`## ✨ Top ${winners.length} winner terms to double down on`);
    lines.push("");
    lines.push("| Search term | Ad group | Clicks | Conversions | CVR |");
    lines.push("|-------------|----------|--------|-------------|-----|");
    for (const t of winners) {
      const cvr = ((t.conversions / t.clicks) * 100).toFixed(1);
      lines.push(
        `| \`${t.term}\` | ${t.adGroup} | ${t.clicks} | ${t.conversions.toFixed(1)} | ${cvr}% |`,
      );
    }
    lines.push("");
    lines.push(
      "_Tip: add these as exact-match positive keywords in their own ad group for tighter control._",
    );
  }

  return lines.join("\n");
}
