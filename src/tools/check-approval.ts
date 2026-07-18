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
    .describe("The approvalId returned by request_publish."),
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
  status: ApprovalStatus;
  result?: unknown;
  error?: string;
}

const STATUS_GUIDANCE: Record<ApprovalStatus, string> = {
  pending:
    "⏳ Waiting on the user. Remind them to open the approval link from `request_publish` in their browser, review the budget, and approve — approval cannot happen through the API.",
  approved:
    "👍 Approved by the user. Execution should start shortly — poll `check_approval` again in a few seconds.",
  executing:
    "🚀 Publishing to Google Ads right now. Poll `check_approval` again in 10-15 seconds.",
  executed:
    "✅ Published. The campaign is live in Google Ads (it may take a few minutes to start serving).",
  rejected:
    "🚫 The user rejected this publish request. Do not retry unless the user asks — discuss what they would like to change instead.",
  expired:
    "⌛ This approval expired before the user acted on it. Call `request_publish` again to generate a fresh link.",
  failed: "❌ Publish execution failed. See the error details below.",
};

export async function checkApproval(
  input: CheckApprovalInput,
): Promise<string> {
  const data = await callGateway<CheckApprovalResult>("check_approval", {
    approvalId: input.approvalId,
  });

  const lines: string[] = [
    `**Publish approval** \`${input.approvalId}\``,
    `- **Status:** ${data.status}`,
    "",
    STATUS_GUIDANCE[data.status] ?? `Unrecognized status: ${data.status}`,
  ];

  if (data.error) {
    lines.push("", `**Error:** ${data.error}`);
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
