/**
 * Tool: get_campaign_details
 *
 * Deep dive on a single campaign: budget, targeting, ad groups, recent
 * performance, landing pages, and active diagnostics.
 *
 * Example prompt: "Tell me everything about campaign abc123"
 */

import { z } from "zod";
import { getSupabaseClient } from "../supabase.js";

export const getCampaignDetailsSchema = z.object({
  campaign_id: z
    .string()
    .describe(
      'The VibeAds campaign UUID. Can be the full UUID or the short 8-character prefix shown in list_campaigns (e.g. "a1b2c3d4").',
    ),
});

export type GetCampaignDetailsInput = z.infer<typeof getCampaignDetailsSchema>;

export async function getCampaignDetails(
  input: GetCampaignDetailsInput,
  userId: string,
): Promise<string> {
  const supabase = getSupabaseClient();

  // Resolve prefix-match to full UUID
  const searchId = input.campaign_id.replace(/-/g, "").toLowerCase();
  let campaignQuery = supabase
    .from("campaigns")
    .select(
      `
      id, name, status, category, budget_micros, bidding_strategy, target_cpa_micros,
      business_name, business_city, business_phone, business_website,
      google_campaign_id, created_at, updated_at, images_pending, logo_push_pending
    `,
    )
    .eq("user_id", userId);

  // If 8-char prefix, use LIKE match — otherwise exact match
  if (searchId.length < 32) {
    campaignQuery = campaignQuery.like("id", `${input.campaign_id}%`);
  } else {
    campaignQuery = campaignQuery.eq("id", input.campaign_id);
  }

  const { data: campaigns, error } = await campaignQuery.limit(1);

  if (error) {
    return `Error: ${error.message}`;
  }

  if (!campaigns || campaigns.length === 0) {
    return `No campaign found matching "${input.campaign_id}". Use list_campaigns to see all your campaigns.`;
  }

  const campaign = campaigns[0];
  const fullId = campaign.id;

  // Parallel queries for ad groups, targeting, recent metrics, landing pages, diagnostics
  const [adGroupsRes, targetingRes, metricsRes, lpRes, sessionsRes] = await Promise.all([
    supabase
      .from("ad_groups")
      .select("id, name, cpc_bid_micros, status, intent_priority")
      .eq("campaign_id", fullId)
      .limit(20),
    supabase
      .from("campaign_targeting")
      .select("criterion_type, location_name, negative")
      .eq("campaign_id", fullId)
      .eq("criterion_type", "LOCATION")
      .eq("negative", false)
      .limit(10),
    supabase
      .from("campaign_metrics")
      .select("date, impressions, clicks, cost_micros, conversions, ctr, avg_cpc_micros")
      .eq("campaign_id", fullId)
      .order("date", { ascending: false })
      .limit(7),
    supabase
      .from("landing_pages")
      .select("id, slug, health_status, page_speed_score")
      .eq("campaign_id", fullId)
      .limit(5),
    supabase
      .from("optimization_sessions")
      .select("id, session_type, diagnosis, created_at")
      .eq("campaign_id", fullId)
      .order("created_at", { ascending: false })
      .limit(1),
  ]);

  const adGroups = adGroupsRes.data ?? [];
  const locations = targetingRes.data ?? [];
  const metrics = metricsRes.data ?? [];
  const landingPages = lpRes.data ?? [];
  const latestSession = sessionsRes.data?.[0];

  // Aggregate last 7 days of metrics
  const totals = metrics.reduce(
    (acc, m) => ({
      impressions: acc.impressions + (Number(m.impressions) || 0),
      clicks: acc.clicks + (Number(m.clicks) || 0),
      cost: acc.cost + (Number(m.cost_micros) || 0) / 1_000_000,
      conversions: acc.conversions + (Number(m.conversions) || 0),
    }),
    { impressions: 0, clicks: 0, cost: 0, conversions: 0 },
  );

  const avgCtr = totals.impressions > 0
    ? ((totals.clicks / totals.impressions) * 100).toFixed(2)
    : "0.00";
  const avgCpc = totals.clicks > 0
    ? (totals.cost / totals.clicks).toFixed(2)
    : "0.00";
  const cpa = totals.conversions > 0
    ? (totals.cost / totals.conversions).toFixed(2)
    : "—";

  const budgetUsd = campaign.budget_micros
    ? (Number(campaign.budget_micros) / 1_000_000).toFixed(2)
    : "—";

  const lines: string[] = [
    `# ${campaign.name}`,
    "",
    `- **Status:** ${campaign.status}`,
    `- **Category:** ${campaign.category ?? "—"}`,
    `- **Business:** ${campaign.business_name ?? "—"} in ${campaign.business_city ?? "—"}`,
    `- **Daily budget:** $${budgetUsd}`,
    `- **Bidding strategy:** ${campaign.bidding_strategy ?? "Manual CPC"}`,
    `- **Published to Google Ads:** ${campaign.google_campaign_id ? `Yes (${campaign.google_campaign_id})` : "Not yet"}`,
    `- **Created:** ${new Date(campaign.created_at).toISOString().split("T")[0]}`,
    "",
  ];

  if (campaign.images_pending) {
    lines.push("⚠️ **Images pending** — image assets are still uploading to Google Ads.");
    lines.push("");
  }
  if (campaign.logo_push_pending) {
    lines.push("⚠️ **Logo push pending** — advertiser identity verification required.");
    lines.push("");
  }

  lines.push(`## Ad groups (${adGroups.length})`);
  if (adGroups.length === 0) {
    lines.push("_No ad groups yet._");
  } else {
    for (const ag of adGroups.slice(0, 10)) {
      const bid = ag.cpc_bid_micros
        ? `$${(Number(ag.cpc_bid_micros) / 1_000_000).toFixed(2)}`
        : "—";
      const emergencyMarker = ag.intent_priority === 1 ? " 🚨" : "";
      lines.push(`- ${ag.name}${emergencyMarker} — ${ag.status} · Max CPC ${bid}`);
    }
    if (adGroups.length > 10) {
      lines.push(`- _...and ${adGroups.length - 10} more_`);
    }
  }
  lines.push("");

  if (locations.length > 0) {
    lines.push(`## Targeted locations`);
    lines.push(locations.map((l) => l.location_name).filter(Boolean).join(", "));
    lines.push("");
  }

  if (landingPages.length > 0) {
    lines.push(`## Landing pages (${landingPages.length})`);
    for (const lp of landingPages) {
      const speed = lp.page_speed_score ? `${lp.page_speed_score}/100` : "—";
      const health = lp.health_status ?? "unknown";
      lines.push(`- ${lp.slug} — Health: ${health}, PageSpeed: ${speed}`);
    }
    lines.push("");
  }

  lines.push("## Performance (last 7 days)");
  if (metrics.length === 0) {
    lines.push(
      "_No performance data yet. Wait 24h after publishing or check that conversion tracking is set up._",
    );
  } else {
    lines.push(`- Impressions: ${totals.impressions.toLocaleString()}`);
    lines.push(`- Clicks: ${totals.clicks.toLocaleString()}`);
    lines.push(`- CTR: ${avgCtr}%`);
    lines.push(`- Avg CPC: $${avgCpc}`);
    lines.push(`- Spend: $${totals.cost.toFixed(2)}`);
    lines.push(`- Conversions: ${totals.conversions.toFixed(1)}`);
    lines.push(`- CPA: $${cpa}`);
  }
  lines.push("");

  if (latestSession && Array.isArray(latestSession.diagnosis) && latestSession.diagnosis.length > 0) {
    lines.push(
      `## Latest diagnostics (${new Date(latestSession.created_at).toISOString().split("T")[0]})`,
    );
    const topIssues = (latestSession.diagnosis as any[]).slice(0, 5);
    for (const issue of topIssues) {
      const severity = issue.severity ?? "medium";
      const detail = issue.detail ?? issue.issue ?? "(no detail)";
      lines.push(`- **${severity.toUpperCase()}** — ${detail}`);
    }
    lines.push("");
    lines.push("Use `get_diagnostics` for the full list and recommended actions.");
  }

  return lines.join("\n");
}
