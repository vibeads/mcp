/**
 * The reply of a direct edit (add_negative_keywords, add_keywords,
 * set_keyword_status, set_max_cpc, set_daily_budget, resume_campaign), as the
 * gateway decided it (supabase/functions/mcp-gateway/assistant-edits.ts):
 * made in Google Ads, waiting for the user's approval at a VibeAds link, or
 * waiting for the user to confirm a daily budget. An edit that carries out a
 * recommendation (sessionId and recommendationId) answers the same way.
 */

import { z } from "zod";

export const campaignIdField = z
  .string()
  .describe("The full campaign UUID from list_campaigns or import_campaigns. A short prefix is not accepted.");

export const matchTypeField = z
  .enum(["EXACT", "PHRASE"])
  .optional()
  .describe("EXACT or PHRASE (the default). Brackets around the text mean EXACT and quotes mean PHRASE, as in Google Ads.");

/**
 * A recommendation from list_recommendations that the call carries out
 * (0.2.26). OpenAI's plugin scan asked for every kind of change to be its own
 * tool, so the edit tools take the recommendation instead of an approve-by-id
 * tool.
 */
export const recommendationFields = {
  sessionId: z
    .string()
    .optional()
    .describe("The sessionId of the recommendation this change carries out, from list_recommendations."),
  recommendationId: z
    .string()
    .optional()
    .describe(
      "The recommendation from list_recommendations that this change carries out, with its sessionId. The other inputs are then that recommendation's own (its applyWith arguments): VibeAds checks they match, records the recommendation as approved and the rest of its session as rejected, and measures the change.",
    ),
};

export interface EditReply {
  changed?: boolean;
  /** A recommendation the call carried out. */
  executed?: boolean;
  error?: string;
  running?: boolean;
  campaign?: { campaignId: string; name: string | null };
  added?: Array<{ text: string; matchType: string }>;
  alreadyThere?: string[];
  notAdded?: Array<{ keyword: string; reason: string }>;
  notFound?: string[];
  notChanged?: Array<{ keyword: string; reason: string }>;
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
  } else if (data.changed ?? data.executed) {
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
  if (data.notChanged?.length) lines.push("", "**Not changed:**", ...data.notChanged.map((k) => `- ${k.keyword}: ${k.reason}`));
  if (data.error) lines.push("", `**Error:** ${data.error}`);
  if (data.note) lines.push("", data.note);
  return lines.join("\n");
}
