/**
 * Tool: audit_google_ads_account (0.2.23)
 *
 * The free account audit (VibeAds' /free-audit), run on one of the user's
 * connected Google Ads accounts and read live from Google Ads: up to 25 Search
 * campaigns over the last 30 days, whether or not they are in VibeAds. It
 * answers "where am I wasting money?" right after the user connects Google
 * Ads, before anything is imported. Managing a campaign (the optimizer,
 * changes, Undo) still needs it imported; the answer marks which are.
 *
 * Example prompts: "Where is my Google Ads budget being wasted?",
 * "Audit my Google Ads account"
 */

import { z } from "zod";
import { callGateway } from "../gateway.js";

export const auditGoogleAdsAccountSchema = z.object({
  customerId: z
    .string()
    .optional()
    .describe(
      "Which Google Ads account to audit, when the user has more than one: an ID from the accounts a choose_google_ads_account answer listed, e.g. 123-456-7890. Not needed with one account.",
    ),
});

export type AuditGoogleAdsAccountInput = z.infer<typeof auditGoogleAdsAccountSchema>;

interface AuditIssue {
  rule: string;
  severity: string;
  title: string;
  fix: string | null;
  campaigns: Array<{ googleCampaignId: string; name: string; detail: string }>;
}

interface AuditCampaign {
  googleCampaignId: string;
  name: string;
  status: string | null;
  inVibeAds: boolean;
  campaignId: string | null;
  healthScore: number;
  grade: string;
  last30Days: { impressions: number; clicks: number; spend: number | null; conversions: number } | null;
  issues: string[];
  searchTermsWithoutConversions: Array<{ term: string; clicks: number; impressions: number; spend: number | null }> | null;
}

interface AuditResult {
  googleAdsAccount: { customerId: string; name: string | null };
  auditedAt?: string;
  cached?: boolean;
  nextAuditAt?: string | null;
  currency?: string | null;
  healthScore?: number;
  grade?: string;
  issueCounts?: { critical: number; high: number; medium: number; low: number };
  last30Days?: { impressions: number; clicks: number; spend: number; conversions: number };
  campaignsAudited: number;
  spendOnSearchTermsWithoutConversions?: number | null;
  issues: AuditIssue[];
  campaigns: AuditCampaign[];
  note: string;
}

const count = (n: number) => n.toLocaleString("en-US");

export async function auditGoogleAdsAccount(input: AuditGoogleAdsAccountInput): Promise<string> {
  const data = await callGateway<AuditResult>("audit_google_ads_account", input);
  const account = data.googleAdsAccount.name
    ? `${data.googleAdsAccount.name} (${data.googleAdsAccount.customerId})`
    : data.googleAdsAccount.customerId;
  const currency = data.currency ?? null;
  const money = (n: number | null | undefined) => {
    if (n === null || n === undefined) return "unknown";
    const amount = n.toFixed(2);
    return currency === "USD" ? `$${amount}` : currency ? `${amount} ${currency}` : amount;
  };

  const lines = [`**Google Ads audit: ${account}**`, ""];
  if (data.campaignsAudited === 0 || data.healthScore === undefined) {
    lines.push(data.note);
    return lines.join("\n");
  }

  const c = data.issueCounts;
  const t = data.last30Days;
  lines.push(
    `Health score ${data.healthScore}/100 (${data.grade}) across ${data.campaignsAudited} Search campaign${data.campaignsAudited === 1 ? "" : "s"}.` +
      (c ? ` Issues: ${c.critical} critical, ${c.high} high, ${c.medium} medium, ${c.low} low.` : ""),
  );
  if (t) {
    lines.push(
      `Last 30 days: ${count(t.impressions)} impressions, ${count(t.clicks)} clicks, ${money(t.spend)} spent, ${t.conversions} conversions.`,
    );
  }
  if (typeof data.spendOnSearchTermsWithoutConversions === "number" && data.spendOnSearchTermsWithoutConversions > 0) {
    lines.push(
      `Search terms with clicks and no conversions (the costliest per campaign): ${money(data.spendOnSearchTermsWithoutConversions)}.`,
    );
  }

  if (data.issues.length > 0) {
    lines.push("", "**Issues, worst first**");
    for (const issue of data.issues) {
      const where = issue.campaigns.map((x) => `${x.name}: ${x.detail}`).join(" ");
      lines.push(
        `- **${issue.title}** (${issue.severity}, ${issue.campaigns.length} campaign${issue.campaigns.length === 1 ? "" : "s"}). ${where}`,
      );
      if (issue.fix) lines.push(`  What fixes it: ${issue.fix}`);
    }
  }

  lines.push("", "**Campaigns, costliest first**");
  for (const camp of data.campaigns) {
    const where = camp.inVibeAds ? `in VibeAds as \`${camp.campaignId}\`` : "not in VibeAds";
    const d = camp.last30Days;
    lines.push(
      `- **${camp.name}** (googleCampaignId \`${camp.googleCampaignId}\`, ${where}): score ${camp.healthScore} (${camp.grade})` +
        (camp.status ? `, ${camp.status}` : "") +
        (d
          ? `. Last 30 days: ${money(d.spend)} spent, ${count(d.clicks)} clicks, ${d.conversions} conversions.`
          : "."),
    );
    const terms = camp.searchTermsWithoutConversions ?? [];
    if (terms.length > 0) {
      lines.push(
        `  Search terms with no conversions: ${terms.map((x) => `"${x.term}" (${money(x.spend)}, ${x.clicks} clicks)`).join("; ")}.`,
      );
    }
  }

  lines.push("", data.note);
  return lines.join("\n");
}
