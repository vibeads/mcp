/**
 * Tool: get_performance_report
 *
 * One campaign's figures, or a whole Google Ads account's, for a period the
 * user chooses, read live from Google Ads: a preset or two dates (up to 90
 * days), optionally split by day, device, hour, ad group, keyword or location.
 * The gateway builds every query itself from these choices; nothing here
 * sends GAQL. Money comes back in the account's currency, never micros.
 *
 * Example prompts: "Compare September with August", "Spend by device last month"
 */

import { z } from "zod";
import { callGateway } from "../gateway.js";

export const getPerformanceReportSchema = z.object({
  campaignId: z
    .string()
    .optional()
    .describe(
      "A campaign in VibeAds: its ID from list_campaigns (the full ID or a unique prefix). With neither campaignId nor googleCampaignId, the report covers the whole Google Ads account.",
    ),
  googleCampaignId: z
    .string()
    .optional()
    .describe(
      "Any campaign in the user's Google Ads account, by its number in Google Ads as find_campaigns_to_import lists it; it does not have to be in VibeAds.",
    ),
  customerId: z
    .string()
    .optional()
    .describe(
      "Which Google Ads account, when the user has more than one: an ID from the accounts a choose_google_ads_account answer listed, e.g. 123-456-7890. Not needed with one account, or with campaignId.",
    ),
  dateRange: z
    .enum(["last_7_days", "last_30_days", "last_90_days", "this_month", "last_month"])
    .optional()
    .describe(
      "A preset period: last_7_days, last_30_days or last_90_days (each ending yesterday), this_month (up to today) or last_month (the whole calendar month). Defaults to last_30_days. Left out when startDate and endDate are given.",
    ),
  startDate: z
    .string()
    .optional()
    .describe("The first day, YYYY-MM-DD, in the account's time zone. Given with endDate; up to 90 days in all."),
  endDate: z
    .string()
    .optional()
    .describe("The last day, YYYY-MM-DD, today at the latest."),
  breakdown: z
    .enum(["day", "device", "hour", "ad_group", "keyword", "location"])
    .optional()
    .describe(
      "Splits the figures by day, device, hour of the day, ad group, keyword or location (for ad groups, keywords and locations, the 50 with the highest spend). Without it, the report has the totals.",
    ),
});

export type GetPerformanceReportInput = z.infer<typeof getPerformanceReportSchema>;

interface Metrics {
  impressions: number;
  clicks: number;
  spend: number;
  conversions: number;
  conversionValue: number;
  ctrPercent: number | null;
  avgCpc: number | null;
  costPerConversion: number | null;
  conversionRatePercent: number | null;
}

type ReportRow = Metrics & Record<string, unknown>;

interface PerformanceReport {
  report: "campaign" | "account";
  googleAdsAccount: { customerId: string; name: string | null };
  campaign?: { campaignId: string | null; googleCampaignId: string; name: string | null; status: string | null; inVibeAds: boolean };
  dateRange: { startDate: string; endDate: string; days: number; preset: string | null; timeZone: string };
  currency: string | null;
  totals: Metrics;
  breakdown?: string;
  rows?: ReportRow[];
  note: string;
}

const count = (n: number) => n.toLocaleString("en-US");

function moneyFormat(currency: string | null): (n: number | null) => string {
  let format: Intl.NumberFormat | null = null;
  try {
    if (currency) format = new Intl.NumberFormat("en-US", { style: "currency", currency });
  } catch {
    format = null;
  }
  return (n) => (n === null ? "n/a" : format ? format.format(n) : n.toFixed(2));
}

const pct = (n: number | null) => (n === null ? "n/a" : `${n}%`);

/** The first column of a breakdown row. */
function rowLabel(breakdown: string, r: ReportRow): string {
  const text = (v: unknown) => (v === null || v === undefined || v === "" ? "unnamed" : String(v));
  switch (breakdown) {
    case "day":
      return text(r.date);
    case "hour":
      return `${String(r.hour).padStart(2, "0")}:00`;
    case "device":
      return text(r.device);
    case "ad_group":
      return `${text(r.adGroup)} (${text(r.campaign)})`;
    case "keyword":
      return `${text(r.keyword)} [${text(r.matchType)}] (${text(r.adGroup)})`;
    case "location":
      return r.location ? String(r.location) : `location ${text(r.googleLocationId)}`;
    default:
      return "";
  }
}

const COLUMN: Record<string, string> = {
  day: "Date",
  hour: "Hour",
  device: "Device",
  ad_group: "Ad group (campaign)",
  keyword: "Keyword [match] (ad group)",
  location: "Location",
};

export async function getPerformanceReport(input: GetPerformanceReportInput): Promise<string> {
  const data = await callGateway<PerformanceReport>("get_performance_report", input);
  const money = moneyFormat(data.currency);
  const account = data.googleAdsAccount.name
    ? `${data.googleAdsAccount.name} (${data.googleAdsAccount.customerId})`
    : data.googleAdsAccount.customerId;
  const title = data.campaign
    ? `**Performance: ${data.campaign.name ?? `campaign ${data.campaign.googleCampaignId}`}** (Google Ads account ${account}` +
      `${data.campaign.campaignId ? `, VibeAds campaign \`${data.campaign.campaignId}\`` : ", not in VibeAds"})`
    : `**Performance: Google Ads account ${account}**`;
  const d = data.dateRange;
  const t = data.totals;
  const lines = [
    title,
    `${d.startDate} to ${d.endDate} (${d.days} days, ${d.timeZone})${data.currency ? `, ${data.currency}` : ""}`,
    "",
    `Totals: ${count(t.impressions)} impressions, ${count(t.clicks)} clicks (CTR ${pct(t.ctrPercent)}), ` +
      `${money(t.spend)} spent, average CPC ${money(t.avgCpc)}, ${t.conversions} conversions ` +
      `(${money(t.conversionValue)} value), ${money(t.costPerConversion)} per conversion, ` +
      `conversion rate ${pct(t.conversionRatePercent)}.`,
  ];
  if (data.breakdown && data.rows) {
    lines.push(
      "",
      `| ${COLUMN[data.breakdown] ?? data.breakdown} | Impr. | Clicks | CTR | Spend | Avg CPC | Conv. | Cost/conv. |`,
      "|---|---:|---:|---:|---:|---:|---:|---:|",
    );
    for (const r of data.rows) {
      lines.push(
        `| ${rowLabel(data.breakdown, r).replace(/\|/g, "/")} | ${count(r.impressions)} | ${count(r.clicks)} | ` +
          `${pct(r.ctrPercent)} | ${money(r.spend)} | ${money(r.avgCpc)} | ${r.conversions} | ${money(r.costPerConversion)} |`,
      );
    }
  }
  lines.push("", data.note);
  return lines.join("\n");
}
