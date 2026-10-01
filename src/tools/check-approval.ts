/**
 * Tool: check_approval
 *
 * Polls the status of a publish approval created with request_publish:
 * pending → approved → executing → executed (or rejected / expired /
 * failed). Approval itself can only happen in the user's browser.
 *
 * Example prompt: "Did my publish approval go through?"
 */

import { z } from "zod";
import { callGateway } from "../gateway.js";

export const checkApprovalSchema = z.object({
  approvalId: z
    .string()
    .describe(
      "The approvalId returned by request_publish, or by approve_recommendation when it returned approvalRequired.",
    ),
});

export type CheckApprovalInput = z.infer<typeof checkApprovalSchema>;

type ApprovalStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "expired"
  | "executing"
  | "executed"
  | "failed";

interface CheckApprovalResult {
  /** publish_campaign, register_domain or apply_recommendation. Absent from gateways older than 0.2.12. */
  actionType?: string;
  status: ApprovalStatus;
  result?: unknown;
  error?: string;
  /** Present once executed: the publish job the approval started. */
  publishJob?: {
    status: string;
    step?: string | null;
    error?: string | null;
  };
}

const STATUS_GUIDANCE: Record<ApprovalStatus, string> = {
  pending:
    "⏳ Waiting on the user. Remind them to open the approval link from `request_publish` in their browser, review the budget, and approve — approval cannot happen through the API.",
  approved:
    "👍 Approved by the user. Execution should start shortly. Check again in a minute; each check counts toward the key's 60-calls-per-hour limit.",
  executing:
    "🚀 Publishing to Google Ads right now. Check again in a minute or two; each check counts toward the key's 60-calls-per-hour limit.",
  executed:
    "✅ Approved and handed to the publisher. The campaign is live only once publishJob.status below is completed.",
  rejected:
    "🚫 The user rejected this publish request. Do not retry unless the user asks — discuss what they would like to change instead.",
  expired:
    "⌛ This approval expired before the user acted on it. Call `request_publish` again to generate a fresh link.",
  failed: "❌ Publish execution failed. See the error details below.",
};

/** An approval link for a budget increase above the chat limit (approve_recommendation). */
const BUDGET_GUIDANCE: Partial<Record<ApprovalStatus, string>> = {
  pending:
    "⏳ Waiting on the user. Remind them to open the approval link from `approve_recommendation` in their browser and approve the budget change; it cannot be approved through the API.",
  approved: "👍 Approved by the user. The budget change runs shortly.",
  executing: "The budget change is being made in Google Ads now. Check again in a minute.",
  executed: "✅ Approved: the daily budget was changed in Google Ads.",
  rejected: "🚫 The user rejected this budget change. Nothing changed.",
  expired:
    "⌛ This link expired before the user acted on it. Call `approve_recommendation` again for a fresh link if the recommendation is still pending.",
  failed: "❌ The budget change did not go through. See the error below.",
};

export async function checkApproval(
  input: CheckApprovalInput,
): Promise<string> {
  const data = await callGateway<CheckApprovalResult>("check_approval", {
    approvalId: input.approvalId,
  });

  const budget = data.actionType === "apply_recommendation";
  const lines: string[] = [
    `**${budget ? "Budget change approval" : "Publish approval"}** \`${input.approvalId}\``,
    `- **Status:** ${data.status}`,
    "",
    (budget ? BUDGET_GUIDANCE[data.status] : undefined) ??
      STATUS_GUIDANCE[data.status] ?? `Unrecognized status: ${data.status}`,
  ];

  if (data.error) {
    lines.push("", `**Error:** ${data.error}`);
  }

  if (data.publishJob) {
    lines.push("", `- **publishJob.status:** ${data.publishJob.status}`);
    if (data.publishJob.step) {
      lines.push(`- **publishJob.step:** ${data.publishJob.step}`);
    }
    if (data.publishJob.error) {
      lines.push(`- **publishJob.error:** ${data.publishJob.error}`);
    }
  }

  if (data.result !== undefined && data.result !== null) {
    lines.push(
      "",
      "**Result:**",
      "```json",
      JSON.stringify(data.result, null, 2),
      "```",
    );
  }

  return lines.join("\n");
}
