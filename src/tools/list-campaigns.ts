/**
 * Tool: list_campaigns
 *
 * Returns all campaigns owned by the authenticated user with high-level
 * status, budget, and recent performance metrics.
 *
 * Example prompt: "Show me all my VibeAds campaigns"
 */

import { z } from "zod";
import { getSupabaseClient } from "../supabase.js";

export const listCampaignsSchema = z.object({
  status: z
    .enum(["draft", "active", "paused", "ended", "queued", "all"])
    .optional()
    .default("all")
    .describe("Filter campaigns by status. Defaults to all."),
  limit: z
    .number()
    .int()
    .positive()
    .max(100)
    .optional()
    .default(25)
    .describe("Maximum number of campaigns to return (max 100)."),
});

export type ListCampaignsInput = z.infer<typeof listCampaignsSchema>;

export async function listCampaigns(
  input: ListCampaignsInput,
  userId: string,
): Promise<string> {
  const supabase = getSupabaseClient();

  let query = supabase
    .from("campaigns")
    .select(
      "id, name, status, category, budget_micros, business_name, business_city, created_at, updated_at, google_campaign_id",
    )
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(input.limit);

  if (input.status !== "all") {
    query = query.eq("status", input.status);
  }

  const { data: campaigns, error } = await query;

  if (error) {
    return `Error fetching campaigns: ${error.message}`;
  }

  if (!campaigns || campaigns.length === 0) {
    return input.status === "all"
      ? "You have no campaigns yet. Create your first one at https://getvibeads.com/app/new-campaign"
      : `No campaigns with status "${input.status}".`;
  }

  // Format as a concise markdown table that Claude can parse + display
  const lines: string[] = [
    `Found ${campaigns.length} campaign${campaigns.length === 1 ? "" : "s"}:`,
    "",
  ];

  for (const c of campaigns) {
    const budgetUsd = c.budget_micros
      ? (Number(c.budget_micros) / 1_000_000).toFixed(2)
      : "—";
    const location = c.business_city || "unknown location";
    const published = c.google_campaign_id ? "✓ Published" : "⏸ Not yet published";

    lines.push(`- **${c.name}** (\`${c.id.slice(0, 8)}\`)`);
    lines.push(`  - Status: ${c.status} · ${published}`);
    lines.push(`  - Category: ${c.category ?? "—"} in ${location}`);
    lines.push(`  - Daily budget: $${budgetUsd}`);
    lines.push(
      `  - Created: ${new Date(c.created_at).toISOString().split("T")[0]}`,
    );
    lines.push("");
  }

  lines.push(
    `Use \`get_campaign_details\` with a campaign ID to drill into any specific campaign.`,
  );

  return lines.join("\n");
}
