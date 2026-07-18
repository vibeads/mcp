/**
 * Tool: get_strategy_status
 *
 * Polls a strategy generation job started with generate_strategy.
 * Returns status + phase while running, and the drafted ad groups
 * (with keyword and headline counts) once complete.
 *
 * Example prompt: "Is my strategy draft ready yet?"
 */

import { z } from "zod";
import { callGateway } from "../gateway.js";

export const getStrategyStatusSchema = z.object({
  jobId: z.string().describe("The jobId returned by generate_strategy."),
});

export type GetStrategyStatusInput = z.infer<typeof getStrategyStatusSchema>;

interface StrategyStatusResult {
  status: string;
  phase?: string;
  adGroups?: Array<{
    name: string;
    keywordCount: number;
    headlineCount: number;
  }>;
  error?: string;
}

export async function getStrategyStatus(
  input: GetStrategyStatusInput,
): Promise<string> {
  const data = await callGateway<StrategyStatusResult>("get_strategy_status", {
    jobId: input.jobId,
  });

  const lines: string[] = [
    `**Strategy job** \`${input.jobId}\``,
    `- **Status:** ${data.status}`,
  ];

  if (data.phase) lines.push(`- **Phase:** ${data.phase}`);
  if (data.error) lines.push(`- **Error:** ${data.error}`);

  if (data.adGroups && data.adGroups.length > 0) {
    lines.push("", `**Drafted ad groups (${data.adGroups.length}):**`, "");
    lines.push("| Ad group | Keywords | Headlines |");
    lines.push("|---|---|---|");
    for (const group of data.adGroups) {
      lines.push(
        `| ${group.name} | ${group.keywordCount} | ${group.headlineCount} |`,
      );
    }
  }

  const status = (data.status || "").toLowerCase();
  lines.push("");
  if (["completed", "complete", "done", "ready"].includes(status)) {
    lines.push(
      "The draft is ready. The user can review it in the VibeAds dashboard (https://getvibeads.com/app/strategy). When they want to take it live, use `request_publish` — publishing always requires the user's approval in the browser.",
    );
  } else if (["failed", "error"].includes(status)) {
    lines.push(
      "Generation failed. Check the error above, then retry with `generate_strategy` if appropriate.",
    );
  } else {
    lines.push("Still working — poll `get_strategy_status` again in 10-15 seconds.");
  }

  return lines.join("\n");
}
