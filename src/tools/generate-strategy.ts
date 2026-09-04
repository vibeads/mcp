/**
 * Tool: generate_strategy
 *
 * Kicks off server-side generation of a DRAFT campaign strategy —
 * keywords, ad copy, and 3+ ad groups — for a service category, budget,
 * and set of locations. Returns a jobId to poll with get_strategy_status.
 *
 * Draft only: nothing is published to Google Ads and no money is spent.
 * Costs 13 VibeAds credits.
 *
 * Example prompt: "Draft a Google Ads strategy for my plumbing business
 * in Austin with a $1,500/month budget"
 */

import { z } from "zod";
import { callGateway } from "../gateway.js";

export const generateStrategySchema = z.object({
  category: z
    .string()
    .describe(
      'Service category. Use one of these exact values to get VibeAds\' tuned keyword seeds, CPC benchmarks, audience segments and funnel template. ' +
      'Local & home services: plumber, hvac, electrician, roofer, cleaner, landscaper, pest_control, painter, handyman, locksmith, garage_door, appliance_repair, tree_service, fencing, window_door, carpet_flooring, waterproofing, pressure_washing, pool_services, junk_removal, moving, auto_repair, christmas_lighting, dentist, lawyer. ' +
      'Professional & lead-gen: real_estate, insurance, financial_services, education, healthcare_provider, consulting, saas, b2b_services. ' +
      'Any other string is accepted but falls back to generic defaults — prefer the closest value above.',
    ),
  budget: z
    .number()
    .positive()
    .optional()
    .default(1500)
    .describe("Monthly ad budget in USD. Defaults to 1500."),
  locations: z
    .array(
      z.object({
        name: z.string().describe('Location name, e.g. "Austin, TX".'),
        geoTargetConstant: z
          .string()
          .optional()
          .describe("Optional pre-resolved Google Ads geo target constant ID."),
      }),
    )
    .optional()
    .describe(
      "Target locations for the campaign. Omit to let the server infer from the account's business profile.",
    ),
  businessName: z
    .string()
    .optional()
    .describe("Business name to use in ad copy and branding."),
});

export type GenerateStrategyInput = z.infer<typeof generateStrategySchema>;

interface GenerateStrategyResult {
  jobId: string;
  status: string;
}

export async function generateStrategy(
  input: GenerateStrategyInput,
): Promise<string> {
  const data = await callGateway<GenerateStrategyResult>(
    "generate_strategy",
    input,
  );

  const lines: string[] = [
    "✅ Strategy generation started (draft only — nothing published, no ad spend).",
    "",
    `- **Job ID:** \`${data.jobId}\``,
    `- **Status:** ${data.status}`,
    `- **Category:** ${input.category}`,
    `- **Monthly budget:** $${input.budget}`,
  ];

  if (input.businessName) {
    lines.push(`- **Business:** ${input.businessName}`);
  }
  if (input.locations && input.locations.length > 0) {
    lines.push(
      `- **Locations:** ${input.locations.map((l) => l.name).join(", ")}`,
    );
  }

  lines.push(
    "",
    "13 VibeAds credits were charged for this generation.",
    `Poll \`get_strategy_status\` with jobId \`${data.jobId}\` every 10-15 seconds until the draft is ready.`,
  );

  return lines.join("\n");
}
