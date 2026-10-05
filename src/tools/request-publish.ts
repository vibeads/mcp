/**
 * Tool: request_publish
 *
 * Publishes a draft campaign. Publishing spends real money, so the gateway
 * decides how (Oct 2026). This package connects with an API key, so it gets a
 * human-approval URL that the owner must open in a browser, review and
 * approve. An assistant the owner connected by signing in to VibeAds (the
 * hosted server, over OAuth) may instead publish within a daily budget the
 * owner allows: the first call asks it to confirm the budget with the user,
 * the second, with confirmedDailyBudget, publishes. Both answers are handled
 * below, so a gateway change needs no new package. Poll check_approval
 * afterwards either way. With more than one Google Ads account the gateway
 * first answers choose_google_ads_account (an error, so its message reaches
 * the agent as text): the agent asks the user and calls again with customerId,
 * and the campaign is published to that account only.
 *
 * Example prompt: "Publish my Austin plumber campaign to Google Ads"
 */

import { z } from "zod";
import { callGateway } from "../gateway.js";

export const requestPublishSchema = z.object({
  campaignId: z
    .string()
    .describe(
      "The full campaign UUID from list_campaigns or apply_strategy. A short prefix is not accepted. A generate_strategy jobId is NOT a campaign ID: apply the strategy first.",
    ),
  customerId: z
    .string()
    .optional()
    .describe(
      "The Google Ads account to publish to, when the user has more than one: an ID from the accounts a choose_google_ads_account answer listed, e.g. 123-456-7890. Send it on the confirming call too. Leave it out when they have one account.",
    ),
  confirmedDailyBudget: z
    .number()
    .optional()
    .describe(
      "The campaign's daily budget in US dollars, exactly as the first call returned it in dailyBudgetUsd. Send it only after the user has confirmed that amount; leave it out on the first call.",
    ),
});

export type RequestPublishInput = z.infer<typeof requestPublishSchema>;

interface RequestPublishResult {
  /** The link route, or a publish that started. */
  approvalId?: string;
  approvalUrl?: string;
  expiresAt?: string;
  /** Why the link: no_ceiling, over_ceiling, not_search or daily_limit. */
  approvalReason?: string;
  summary?: unknown;
  /** Within the allowance, before the user confirmed. */
  needsConfirmation?: boolean;
  dailyBudgetUsd?: number;
  ceilingUsd?: number;
  /** Within the allowance, after the user confirmed. */
  published?: boolean;
  jobId?: string | null;
  ownerEmailed?: boolean;
}

const LINK_REASON: Record<string, string> = {
  api_key:
    "A campaign published with a VibeAds API key always needs the user's approval in VibeAds.",
  no_ceiling:
    "This account does not let AI assistants publish campaigns. The user can allow it, up to a daily budget, in VibeAds Settings under Connected apps.",
  over_ceiling: "This campaign's daily budget is over what this account lets AI assistants publish.",
  not_search: "Only Search campaigns can be published from a conversation.",
  daily_limit: "AI assistants already published two campaigns for this account in the last 24 hours.",
};

const money = (n: number) => `$${n.toFixed(2).replace(/\.00$/, "")}`;

function summaryLines(summary: unknown): string[] {
  if (summary === undefined || summary === null) return [];
  if (typeof summary === "string") return [`- **Summary:** ${summary}`];
  return ["", "**Campaign summary:**", "```json", JSON.stringify(summary, null, 2), "```"];
}

export async function requestPublish(
  input: RequestPublishInput,
): Promise<string> {
  const data = await callGateway<RequestPublishResult>("request_publish", {
    campaignId: input.campaignId,
    ...(input.customerId !== undefined ? { customerId: input.customerId } : {}),
    ...(input.confirmedDailyBudget !== undefined ? { confirmedDailyBudget: input.confirmedDailyBudget } : {}),
  });
  const withAccount = input.customerId !== undefined ? ` and \`customerId\` \`${input.customerId}\`` : "";

  if (data.needsConfirmation) {
    const daily = data.dailyBudgetUsd ?? 0;
    return [
      "⏸️ **Nothing has been published yet. Confirm the daily budget with the user first.**",
      "",
      `This account lets AI assistants publish Search campaigns up to ${money(data.ceilingUsd ?? 0)} a day. Tell the user this campaign will spend up to ${money(daily)} a day, billed to their own Google Ads account, and ask them to confirm.`,
      "",
      `If they agree, call \`request_publish\` again with \`campaignId\` \`${input.campaignId}\`${withAccount} and \`confirmedDailyBudget: ${daily}\`. If they do not, do not publish.`,
      ...summaryLines(data.summary),
    ].join("\n");
  }

  if (data.published) {
    return [
      "🚀 **Publishing started.** The user confirmed the daily budget, which is within what they allow AI assistants to publish.",
      "",
      `- **Approval ID:** \`${data.approvalId}\``,
      ...(data.jobId ? [`- **Publish job:** \`${data.jobId}\``] : []),
      ...summaryLines(data.summary),
      "",
      `Poll \`check_approval\` with approvalId \`${data.approvalId}\`: it says when publishing finishes and whether the campaign is live or was left paused. The user can pause the campaign from its page in VibeAds${data.ownerEmailed ? ", and VibeAds has emailed them a link to it." : "."}`,
    ].join("\n");
  }

  const lines: string[] = [
    "🔐 **Human approval required. Nothing has been published yet.**",
    "",
    ...(data.approvalReason && LINK_REASON[data.approvalReason] ? [LINK_REASON[data.approvalReason], ""] : []),
    "Publishing spends real money, so this connection cannot approve it. Show the user this link and ask them to open it in their browser, review the budget and campaign summary, and approve:",
    "",
    `👉 **Approval link:** ${data.approvalUrl}`,
    "",
    `- **Approval ID:** \`${data.approvalId}\``,
    `- **Expires:** ${data.expiresAt}`,
    ...summaryLines(data.summary),
    "",
    `After the user approves in the browser, poll \`check_approval\` with approvalId \`${data.approvalId}\` to track execution.`,
  ];
  return lines.join("\n");
}
