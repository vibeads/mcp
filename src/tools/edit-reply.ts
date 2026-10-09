/**
 * The reply of a direct edit (add_negative_keywords, add_keywords,
 * set_keyword_status, set_max_cpc, set_daily_budget, resume_campaign), as the
 * gateway decided it (supabase/functions/mcp-gateway/assistant-edits.ts):
 * made in Google Ads, waiting for the user's approval at a VibeAds link, or
 * waiting for the user to confirm a daily budget.
 */

import { z } from "zod";

export const campaignIdField = z
  .string()
  .describe("The full campaign UUID from list_campaigns or import_campaigns. A short prefix is not accepted.");

export const matchTypeField = z
  .enum(["EXACT", "PHRASE"])
  .optional()
  .describe("EXACT or PHRASE (the default). Brackets around the text mean EXACT and quotes mean PHRASE, as in Google Ads.");

export interface EditReply {
  changed?: boolean;
  running?: boolean;
  campaign?: { campaignId: string; name: string | null };
  added?: Array<{ text: string; matchType: string }>;
  alreadyThere?: string[];
  notAdded?: Array<{ keyword: string; reason: string }>;
  notFound?: string[];
  results?: Array<{ change: string; done: boolean; error?: string }>;
  approvalRequired?: boolean;
  approvalId?: string;
  approvalUrl?: string;
  expiresAt?: string;
  approvalReason?: string;
  settingsUrl?: string;
  needsConfirmation?: boolean;
  dailyBudgetUsd?: number;
  ceilingUsd?: number;
  note?: string;
}

export function editReply(data: EditReply): string {
  const lines: string[] = [];
  const name = data.campaign?.name ? ` (${data.campaign.name})` : "";
  if (data.approvalRequired) {
    lines.push(`🔐 **Waiting for the user's approval in VibeAds${name}. Nothing has changed yet.**`, "");
    lines.push(`- **Approval link:** ${data.approvalUrl}`, `- **Approval ID:** \`${data.approvalId}\``);
    if (data.expiresAt) lines.push(`- **Expires:** ${data.expiresAt}`);
    if (data.settingsUrl) lines.push(`- **Settings:** ${data.settingsUrl}`);
  } else if (data.needsConfirmation) {
    lines.push(`⏸️ **Waiting for the user to confirm the daily budget${name}. Nothing has changed yet.**`);
  } else if (data.changed) {
    lines.push(`✅ **Changed in Google Ads${name}.**`);
  } else {
    lines.push(`ℹ️ **Nothing was changed${name}.**`);
  }
  if (data.added?.length) {
    lines.push("", "**Added:**", ...data.added.map((k) => `- ${k.text} (${k.matchType})`));
  }
  if (data.results?.length) {
    lines.push("", "**Results:**", ...data.results.map((r) => `- ${r.done ? "Done" : "Not done"}: ${r.change}${r.error ? `. ${r.error}` : ""}`));
  }
  if (data.alreadyThere?.length) lines.push("", "**Already there:**", ...data.alreadyThere.map((k) => `- ${k}`));
  if (data.notAdded?.length) lines.push("", "**Not added:**", ...data.notAdded.map((k) => `- ${k.keyword}: ${k.reason}`));
  if (data.notFound?.length) lines.push("", "**Not found:**", ...data.notFound.map((m) => `- ${m}`));
  if (data.note) lines.push("", data.note);
  return lines.join("\n");
}
