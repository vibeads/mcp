/**
 * Tool: get_diagnostics
 *
 * Returns the full list of active diagnostics + recommendations from
 * the latest optimization session per campaign. Shows severity, affected
 * metric, current value vs benchmark, and recommended action. Executed
 * server-side by the mcp-gateway; only VIBEADS_API_KEY is needed.
 *
 * Example prompt: "What should I fix in my Google Ads account?"
 */

import { z } from "zod";
import { callGateway } from "../gateway.js";

export const getDiagnosticsSchema = z.object({
  campaign_id: z
    .string()
    .optional()
    .describe("Optional: scope to a specific campaign. Otherwise returns diagnostics across all campaigns."),
  severity: z
    .enum(["critical", "high", "medium", "low", "all"])
    .optional()
    .default("all")
    .describe("Filter by severity level."),
  limit: z
    .number()
    .int()
    .positive()
    .max(50)
    .optional()
    .default(20)
    .describe("Max number of diagnostics to return (default 20, max 50)."),
});

export type GetDiagnosticsInput = z.infer<typeof getDiagnosticsSchema>;

export async function getDiagnostics(
  input: GetDiagnosticsInput,
): Promise<string> {
  const data = await callGateway<{ text: string }>("get_diagnostics", input);
  return data.text;
}
