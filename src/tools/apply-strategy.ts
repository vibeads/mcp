/**
 * Tool: apply_strategy
 *
 * Turns a completed generate_strategy PREVIEW into a real draft campaign.
 *
 * generate_strategy only writes a strategy_jobs row — no campaign exists
 * yet, which is why request_publish on a bare jobId fails. This is the
 * missing middle step: it creates the campaigns row plus every child
 * record (ad groups, keywords, targeting, creatives, extensions).
 *
 * Creates rows only — spends no ad money and publishes nothing. Going
 * live still requires request_publish plus a human clicking approve.
 *
 * Example prompt: "Apply that strategy so I can publish it."
 */

import { z } from "zod";
import { callGateway } from "../gateway.js";

export const applyStrategySchema = z.object({
  jobId: z
    .string()
    .describe(
      "The jobId returned by generate_strategy, once get_strategy_status reports status 'completed'.",
    ),
  campaignName: z
    .string()
    .optional()
    .describe(
      'Optional name for the draft campaign. Defaults to "<category> Campaign".',
    ),
});

export type ApplyStrategyInput = z.infer<typeof applyStrategySchema>;

interface ApplyStrategyResult {
  campaignId: string;
  campaignName: string;
  adGroupCount: number;
  keywordCount: number;
  note?: string;
}

export async function applyStrategy(
  input: ApplyStrategyInput,
): Promise<string> {
  // callGateway throws with the gateway's own message on failure — including
  // the cases worth surfacing verbatim: job_not_completed (still generating),
  // already_applied (this preview built a campaign already), and
  // invalid_strategy (no ad groups). Don't paraphrase them.
  const data = await callGateway<ApplyStrategyResult>("apply_strategy", {
    jobId: input.jobId,
    ...(input.campaignName ? { campaignName: input.campaignName } : {}),
  });

  const lines: string[] = [
    `**Draft campaign created — nothing is live and no ad money has been spent.**`,
    "",
    `- **Campaign:** ${data.campaignName}`,
    `- **Campaign ID:** \`${data.campaignId}\``,
    `- **Ad groups:** ${data.adGroupCount}`,
    `- **Keywords:** ${data.keywordCount}`,
    "",
  ];

  if (data.note) {
    lines.push(data.note);
  } else {
    lines.push(
      `Next: call \`request_publish\` with campaignId \`${data.campaignId}\` to get a link a human must open and approve. This API key cannot publish it.`,
    );
  }

  return lines.join("\n");
}
