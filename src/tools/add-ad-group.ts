/**
 * Tool: add_ad_group
 *
 * Adds the ad group a user agreed to after preview_ad_group. On a published
 * campaign it goes live in Google Ads at once, with its landing page and
 * images; on a draft it goes live when the campaign is published. A
 * recommended ad group is added by approving its recommendation, which
 * decides that recommendation's session.
 *
 * Example prompt: "Yes, add that ad group"
 */

import { z } from "zod";
import { callGateway } from "../gateway.js";

export const addAdGroupSchema = z.object({
  proposalId: z
    .string()
    .describe("The proposalId from preview_ad_group, for the preview the user agreed to."),
});

export type AddAdGroupInput = z.infer<typeof addAdGroupSchema>;

interface AddAdGroupResult {
  added?: boolean;
  alreadyAdded?: boolean;
  name?: string;
  live?: boolean;
  landingPageUrl?: string | null;
  imagesRequested?: boolean;
  pushError?: string | null;
  note?: string;
}

export async function addAdGroup(input: AddAdGroupInput): Promise<string> {
  const data = await callGateway<AddAdGroupResult>("add_ad_group", {
    proposalId: input.proposalId,
  });

  const lines: string[] = [
    data.alreadyAdded
      ? `This ad group${data.name ? ` ("${data.name}")` : ""} was already added.`
      : `Added the ad group${data.name ? ` "${data.name}"` : ""}.`,
    "",
    `- **Live in Google Ads:** ${data.live ? "yes" : "no"}`,
  ];
  if (data.landingPageUrl) lines.push(`- **Landing page:** ${data.landingPageUrl}`);
  if (data.imagesRequested) lines.push("- **Images:** being generated for its landing page");
  if (data.pushError) lines.push(`- **Not in Google Ads yet:** ${data.pushError}`);
  if (data.note) lines.push("", data.note);
  return lines.join("\n");
}
