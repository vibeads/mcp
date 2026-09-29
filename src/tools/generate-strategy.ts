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

/**
 * Contact details of the business being advertised, also accepted by
 * apply_strategy. They must be declared: the server parses arguments with
 * these schemas, and zod drops any key a schema does not name.
 */
export const businessContactFields = {
  businessName: z
    .string()
    .optional()
    .describe(
      "Name of the business being advertised. Omit it to advertise the business on this VibeAds account. Naming a different business than the account profile's switches off every profile fallback (phone, address, city, state, ZIP, website): businessPhone becomes required, and the call fails with missing_business_phone without it.",
    ),
  businessPhone: z
    .string()
    .optional()
    .describe(
      "Phone number of the business being advertised. It is shown on the landing page and used for call extensions. Required when businessName names a different business than the account's.",
    ),
  businessAddress: z
    .string()
    .optional()
    .describe(
      "Street address of the business being advertised. Only needed when it differs from the account profile.",
    ),
  businessCity: z
    .string()
    .optional()
    .describe(
      "City of the business being advertised. For a different business than the account's, it is also the fallback target location when locations is omitted.",
    ),
  businessState: z
    .string()
    .optional()
    .describe(
      "State of the business being advertised. For a different business than the account's, it is the preferred fallback target location when locations is omitted.",
    ),
  businessZip: z
    .string()
    .optional()
    .describe(
      "ZIP code of the business being advertised. Only needed when it differs from the account profile.",
    ),
};

export const generateStrategySchema = z.object({
  category: z
    .string()
    .describe(
      'Service category. Use one of these exact values to get VibeAds\' tuned keyword seeds, CPC benchmarks, audience segments and funnel template. ' +
      'Local & home services: plumber, hvac, electrician, roofer, cleaner, landscaper, pest_control, painter, handyman, locksmith, garage_door, appliance_repair, tree_service, fencing, window_door, carpet_flooring, waterproofing, pressure_washing, air_duct_cleaning, pool_services, junk_removal, moving, auto_repair, christmas_lighting, dentist, lawyer. ' +
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
      "Target locations for the campaign. Omit to target the advertised business's state (or city): the account profile's, or businessState/businessCity when businessName names a different business.",
    ),
  ...businessContactFields,
  // generate_strategy also targets locations, so its businessName says what a
  // different business needs for them; apply_strategy takes no locations.
  businessName: businessContactFields.businessName.describe(
    "Name of the business being advertised. Omit it to advertise the business on this VibeAds account. Naming a different business than the account profile's switches off every profile fallback (phone, address, city, state, ZIP, website): businessPhone becomes required, and the call fails with missing_business_phone without it. locations, or businessState/businessCity, must then be given too.",
  ),
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
