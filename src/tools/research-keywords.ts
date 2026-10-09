/**
 * Tool: research_keywords
 *
 * Keyword ideas from Google's Keyword Planner for seed keywords, a web page,
 * or both, in the places named: average monthly searches, competition and the
 * top-of-page bid range. Runs through the user's connected Google Ads account
 * and VibeAds' keyword-research function; adds nothing to any campaign.
 *
 * Example prompt: "How many people search for drain cleaning in Austin?"
 */

import { z } from "zod";
import { callGateway } from "../gateway.js";

export const researchKeywordsSchema = z.object({
  keywords: z
    .array(z.string())
    .max(20)
    .optional()
    .describe("Up to 20 seed keywords, e.g. [\"drain cleaning\", \"emergency plumber\"]. Seed keywords, url or both."),
  url: z
    .string()
    .optional()
    .describe("A web page Google reads for ideas, such as the business's services page."),
  locations: z
    .array(z.string())
    .min(1)
    .max(10)
    .describe(
      "1 to 10 places to research: a city with its state (\"Austin, TX\"), a ZIP code, a county, a state, or a whole country (\"United States\").",
    ),
  countryCode: z
    .enum(["US", "CA", "GB", "DE", "FR", "ES", "IT", "NL"])
    .optional()
    .describe("The country the places are in. Defaults to US."),
  limit: z
    .number()
    .int()
    .min(1)
    .max(50)
    .optional()
    .describe("How many ideas to return, highest search volume first (default 25, max 50)."),
  customerId: z
    .string()
    .optional()
    .describe(
      "Which Google Ads account runs the research, when the user has more than one: an ID from the accounts a choose_google_ads_account answer listed, e.g. 123-456-7890.",
    ),
});

export type ResearchKeywordsInput = z.infer<typeof researchKeywordsSchema>;

interface KeywordIdea {
  keyword: string;
  avgMonthlySearches: number;
  competition: string;
  competitionIndex: number | null;
  topOfPageBidLow: number | null;
  topOfPageBidHigh: number | null;
}

interface ResearchKeywordsResult {
  googleAdsAccount: { customerId: string; name: string | null };
  locations: Array<{ name: string; type: string | null }>;
  seedKeywords: string[];
  url?: string;
  language: string;
  ideasFound: number;
  keywords: KeywordIdea[];
  creditsCharged: number;
  note: string;
}

const bid = (n: number | null) => (n === null ? "n/a" : n.toFixed(2));

export async function researchKeywords(input: ResearchKeywordsInput): Promise<string> {
  const data = await callGateway<ResearchKeywordsResult>("research_keywords", input);
  const where = data.locations.length > 0 ? data.locations.map((l) => l.name).join("; ") : input.locations.join("; ");
  const lines = [`**Keyword ideas for ${where}** (Google Keyword Planner, ${data.language})`, ""];
  if (data.keywords.length === 0) {
    lines.push("Google returned no keyword ideas for this research.");
  } else {
    lines.push("| Keyword | Avg. monthly searches | Competition | Top-of-page bid (low to high) |", "|---|---:|---|---|");
    for (const k of data.keywords) {
      const competition = k.competitionIndex === null ? k.competition : `${k.competition} (${k.competitionIndex})`;
      lines.push(
        `| ${k.keyword.replace(/\|/g, "/")} | ${k.avgMonthlySearches.toLocaleString("en-US")} | ${competition} | ` +
          `${bid(k.topOfPageBidLow)} to ${bid(k.topOfPageBidHigh)} |`,
      );
    }
    if (data.ideasFound > data.keywords.length) {
      lines.push("", `Showing ${data.keywords.length} of ${data.ideasFound} ideas.`);
    }
  }
  lines.push("", data.note);
  return lines.join("\n");
}
