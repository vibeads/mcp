/**
 * Tool: request_publish
 *
 * Starts the publish flow for a campaign. Publishing spends real money,
 * so the gateway NEVER publishes directly from an API key — it returns a
 * human-approval URL that the account owner must open in a browser,
 * review, and approve. Poll check_approval afterwards.
 *
 * Example prompt: "Publish my Austin plumber campaign to Google Ads"
 */

import { z } from "zod";
import { callGateway } from "../gateway.js";

export const requestPublishSchema = z.object({
  campaignId: z
    .string()
    .describe(
      "The VibeAds campaign ID to publish to Google Ads (from list_campaigns, or from apply_strategy). A generate_strategy jobId is NOT a campaign ID — apply the strategy first.",
    ),
});

export type RequestPublishInput = z.infer<typeof requestPublishSchema>;

interface RequestPublishResult {
  approvalId: string;
  approvalUrl: string;
  expiresAt: string;
  summary?: unknown;
}

export async function requestPublish(
  input: RequestPublishInput,
): Promise<string> {
  const data = await callGateway<RequestPublishResult>("request_publish", {
    campaignId: input.campaignId,
  });

  const lines: string[] = [
    "🔐 **Human approval required — nothing has been published yet.**",
    "",
    "Publishing spends real money, so this API key cannot approve it. Show the user this link and ask them to open it in their browser, review the budget and campaign summary, and approve:",
    "",
    `👉 **Approval link:** ${data.approvalUrl}`,
    "",
    `- **Approval ID:** \`${data.approvalId}\``,
    `- **Expires:** ${data.expiresAt}`,
  ];

  if (data.summary !== undefined && data.summary !== null) {
    if (typeof data.summary === "string") {
      lines.push(`- **Summary:** ${data.summary}`);
    } else {
      lines.push(
        "",
        "**Campaign summary:**",
        "```json",
        JSON.stringify(data.summary, null, 2),
        "```",
      );
    }
  }

  lines.push(
    "",
    `After the user approves in the browser, poll \`check_approval\` with approvalId \`${data.approvalId}\` to track execution.`,
  );

  return lines.join("\n");
}
