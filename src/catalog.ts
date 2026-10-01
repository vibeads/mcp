/**
 * The tool catalog: every tool's name, description, input schema and handler.
 *
 * This is also the source of truth for the hosted remote server
 * (supabase/functions/mcp-remote/index.ts). Its tools/list is generated from
 * listedTools() by scripts/sync-remote-catalog.mjs, so after changing a tool
 * here, rebuild and run that script; `--check` fails when the two differ.
 */

import type { ZodTypeAny } from "zod";
import { zodToJsonSchema } from "./utils/zod-to-json-schema.js";

import {
  listCampaigns,
  listCampaignsSchema,
} from "./tools/list-campaigns.js";
import {
  getCampaignDetails,
  getCampaignDetailsSchema,
} from "./tools/get-campaign-details.js";
import {
  getAccountHealthScore,
  getAccountHealthScoreSchema,
} from "./tools/get-account-health-score.js";
import {
  getSearchTermAnalysis,
  getSearchTermAnalysisSchema,
} from "./tools/get-search-term-analysis.js";
import {
  getDiagnostics,
  getDiagnosticsSchema,
} from "./tools/get-diagnostics.js";
import {
  generateStrategy,
  generateStrategySchema,
} from "./tools/generate-strategy.js";
import {
  getStrategyStatus,
  getStrategyStatusSchema,
} from "./tools/get-strategy-status.js";
import {
  applyStrategy,
  applyStrategySchema,
} from "./tools/apply-strategy.js";
import {
  listRecommendations,
  listRecommendationsSchema,
} from "./tools/list-recommendations.js";
import {
  approveRecommendation,
  approveRecommendationSchema,
} from "./tools/approve-recommendation.js";
import {
  requestPublish,
  requestPublishSchema,
} from "./tools/request-publish.js";
import {
  checkApproval,
  checkApprovalSchema,
} from "./tools/check-approval.js";

/**
 * What the server tells an agent before it picks a tool (the MCP
 * `instructions`). Agents such as Muse choose a connector's tools from this
 * and the tool descriptions, so it says who VibeAds is for and when to use it.
 * The hosted server (mcp-remote/tools.ts INSTRUCTIONS) is generated from this
 * by scripts/sync-remote-catalog.mjs. It speaks to key and OAuth connections
 * alike, so it never assumes an API key.
 */
export const SERVER_INSTRUCTIONS =
  "VibeAds runs Google Ads (Google Search ads) for local home-service businesses: plumbers, HVAC, " +
  "electricians, roofers, cleaners, landscapers, pest control and similar trades. Use it when someone " +
  "asks how their Google Ads are doing, what is wasting their ad budget, what to fix in their account, " +
  "or wants a new Google Ads campaign. Reading works on every plan; drafting, recommendations and " +
  "publishing need a Pro or Max plan, and each of those tools says so. To launch a campaign: " +
  "generate_strategy, then get_strategy_status until it completes, then apply_strategy, then " +
  "request_publish. Publishing spends the advertiser's own money, so request_publish returns an " +
  "approval link instead of publishing: always show the link to the user, who approves it in VibeAds. " +
  "This connection cannot approve spend itself. The limit is 60 tool calls per hour.";

/**
 * MCP tool annotations (2025-03-26 and later): hints an agent uses to decide
 * which calls need the user's say-so. Read tools only read VibeAds' own copy
 * of the account. Only approve_recommendation changes live Google Ads
 * campaigns; request_publish creates an approval link and spends nothing.
 *
 * readOnlyHint, destructiveHint and openWorldHint are required on every tool,
 * read tools included: ChatGPT's plugin review refuses a tool that leaves any
 * of the three out, although the MCP spec reads destructiveHint only on tools
 * that write.
 */
export interface ToolHints {
  readOnlyHint: boolean;
  destructiveHint: boolean;
  /** Only meaningful when readOnlyHint is false. */
  idempotentHint?: boolean;
  openWorldHint: boolean;
}

const READ_ONLY: ToolHints = { readOnlyHint: true, destructiveHint: false, openWorldHint: false };
/** Creates something inside VibeAds (a preview, a draft, an approval link); touches nothing live. */
const CREATES_DRAFT: ToolHints = {
  readOnlyHint: false,
  destructiveHint: false,
  idempotentHint: false,
  openWorldHint: false,
};

/**
 * Every tool — read and write — calls the server-side mcp-gateway Edge
 * Function. The only credential is VIBEADS_API_KEY (sent per-request by
 * the gateway client) — no Supabase keys ever live on the user's machine.
 */
export interface ToolDef {
  name: string;
  /** Human-readable name an app shows instead of the tool name. */
  title: string;
  description: string;
  hints: ToolHints;
  schema: ZodTypeAny;
  handler: (input: any) => Promise<string>;
}

export const TOOLS: readonly ToolDef[] = [
  // -------------------------------------------------------------------------
  // Read tools (read-only, any plan)
  // -------------------------------------------------------------------------
  {
    name: "list_campaigns",
    title: "List campaigns",
    hints: READ_ONLY,
    description:
      "List the user's VibeAds campaigns, newest first (default 25, max 100): name, full campaign ID, status, whether it is published to Google Ads, category and business city, daily budget, and created date. It returns no performance metrics (get_campaign_details has the last 7 days). The campaign ID it returns is accepted by every tool that takes one.",
    schema: listCampaignsSchema,
    handler: listCampaigns,
  },
  {
    name: "get_campaign_details",
    title: "Get campaign details",
    hints: READ_ONLY,
    description:
      "Get a detailed view of a single VibeAds campaign: budget, bidding strategy, ad groups, targeted locations, landing pages, last 7 days of performance metrics (impressions, clicks, CTR, CPC, spend, conversions, CPA), and any active diagnostics.",
    schema: getCampaignDetailsSchema,
    handler: getCampaignDetails,
  },
  {
    name: "get_account_health_score",
    title: "Get account health score",
    hints: READ_ONLY,
    description:
      "Compute a 0-100 account health score across 6 dimensions (Tracking, Keywords, Budget, Creative, Targeting, Performance) by rolling up the latest diagnostics from all campaigns. Returns a letter grade A-F and per-dimension breakdown. Optionally scope to a single campaign.",
    schema: getAccountHealthScoreSchema,
    handler: getAccountHealthScore,
  },
  {
    name: "get_search_term_analysis",
    title: "Analyze search terms",
    hints: READ_ONLY,
    description:
      "Analyze each campaign's most recently synced search terms to find wasted spend (terms costing at least min_cost with zero conversions, up to 15, highest cost first) and winners (at least 5 clicks and 1 conversion, up to 10, highest conversion rate first). The synced list holds the up-to-100 highest-cost search terms over the 7 days before the campaign's latest Google Ads sync, so every figure describes those 7 days; lookback_days only sets how old that sync may be. Search terms are the queries people typed, not the account's keywords. Can be scoped to one campaign (full UUID or a unique prefix).",
    schema: getSearchTermAnalysisSchema,
    handler: getSearchTermAnalysis,
  },
  {
    name: "get_diagnostics",
    title: "Get diagnostics",
    hints: READ_ONLY,
    description:
      "Return up to limit issues (default 20, max 50) from the optimizer's most recent run on each campaign, highest severity first: rule, campaign, problem, affected metric with current value vs benchmark, recommended fix and estimated impact. The optimizer runs every 12 hours on published campaigns with synced Google Ads data, so new or unpublished campaigns have none. It returns no recommendation IDs; list_recommendations lists the pending changes approve_recommendation can execute. Can filter by severity and scope to one campaign.",
    schema: getDiagnosticsSchema,
    handler: getDiagnostics,
  },
  // -------------------------------------------------------------------------
  // Write/workflow tools (Pro/Max)
  // -------------------------------------------------------------------------
  {
    name: "generate_strategy",
    title: "Draft a campaign strategy",
    hints: CREATES_DRAFT,
    description:
      "Preview a DRAFT campaign strategy server-side: keywords, ad copy, and 3+ ad groups tailored to a service category, budget, and locations. Costs 13 VibeAds credits. Returns a jobId — poll get_strategy_status with that jobId, then call apply_strategy with the same jobId to turn the finished preview into a real draft campaign. This step is a preview only: it creates no campaign, publishes nothing, and spends no ad money. Requires a Pro or Max plan.",
    schema: generateStrategySchema,
    handler: generateStrategy,
  },
  {
    name: "get_strategy_status",
    title: "Check strategy status",
    hints: READ_ONLY,
    description:
      "Check a strategy generation job started with generate_strategy. Returns status and phase while running, and the drafted ad groups (with keyword and headline counts) once complete. Generation usually finishes within a few minutes (the server allows up to 6), and every VibeAds tool call counts toward a limit of 60 calls per hour per API key, so space checks out rather than calling this back to back. Once completed, show the draft to the user and call apply_strategy with the same jobId to create the real draft campaign; request_publish cannot act on a preview. Requires a Pro or Max plan.",
    schema: getStrategyStatusSchema,
    handler: getStrategyStatus,
  },
  {
    name: "apply_strategy",
    title: "Create a draft campaign",
    hints: CREATES_DRAFT,
    description:
      "Turn a COMPLETED generate_strategy preview into a real draft campaign, creating the campaign plus its ad groups, keywords, targeting, ad copy and extensions. Call this after get_strategy_status reports status 'completed', passing the same jobId. This is the required step between generating a strategy and publishing it: request_publish needs a campaignId, which only exists once the strategy is applied. Costs 6 VibeAds credits plus 3 per ad group for image generation. Creates rows only — the campaign is a DRAFT, is not live, and spends no ad money. Each preview can be applied once. A second call with the same jobId does NOT succeed: it fails with an error naming the campaignId that preview already created — pass that campaignId to request_publish rather than calling generate_strategy again. Business contact values given here override those sent to generate_strategy, so a missing phone can be supplied without regenerating. Requires a Pro or Max plan.",
    schema: applyStrategySchema,
    handler: applyStrategy,
  },
  {
    name: "list_recommendations",
    title: "List pending recommendations",
    hints: READ_ONLY,
    description:
      "List optimization sessions awaiting the user's decision (the 25 most recent), each with its pending recommendations: recommendationId, action, reason, risk level, blast radius, auto-eligibility and estimated impact, plus the sessionId that approve_recommendation needs. Approving any one recommendation closes its session and rejects the others in it. Requires a Pro or Max plan.",
    schema: listRecommendationsSchema,
    handler: listRecommendations,
  },
  {
    name: "approve_recommendation",
    title: "Approve a recommendation",
    // Changes live Google Ads campaigns and rejects the rest of the session.
    hints: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: true },
    description:
      "Approve and execute one recommendation from a pending optimization session, using the sessionId and recommendationId from list_recommendations. The approval is the decision for the whole session: every other recommendation in that session is recorded as rejected, the session closes, and a later approve_recommendation call on it fails with session_not_pending. It runs the same path as the dashboard's approve button: conflicting or no-op changes are dropped, and executed changes classified surgical or meaningful are measured afterwards and rolled back automatically if metrics worsen. The hands-free limits (blast-radius gating, daily rate limit) do not apply to an approval. Requires a Pro or Max plan.",
    schema: approveRecommendationSchema,
    handler: approveRecommendation,
  },
  {
    name: "request_publish",
    title: "Request publish approval",
    hints: CREATES_DRAFT,
    description:
      "Start the publish flow for a campaign that already has ad groups — find it with list_campaigns, or create one from a finished preview with apply_strategy (a bare generate_strategy jobId does not qualify). Publishing spends real money, so this returns a human-approval URL instead of publishing directly — SHOW the approvalUrl to the user and ask them to open it in their browser, review the budget, and approve. Approving starts a publish job. When it completes the campaign is in Google Ads, and check_approval says whether it can spend its daily budget or was left paused. The campaign must be a draft that is not yet published, the account must have Google Ads connected, and the link is valid for 24 hours; a new request replaces any earlier pending link for the same campaign. The API key cannot approve a publish. After the user approves, poll check_approval with the returned approvalId. Requires a Pro or Max plan.",
    schema: requestPublishSchema,
    handler: requestPublish,
  },
  {
    name: "check_approval",
    title: "Check publish approval",
    hints: READ_ONLY,
    description:
      "Check a publish approval created with request_publish. status is one of: pending, approved, rejected, expired, executing, executed, failed. While pending, remind the user to open the approval link in their browser; approval cannot happen through the API. executed means the approval went through and a publish job started, not that ads are serving: the result's publishJob.status is processing, queued, completed or failed, with the current step and any error. Once publishJob.status is completed the campaign is in Google Ads, and publishJob.campaignStatus says whether ads can show. ENABLED: it is live and can spend its daily budget; tell the user it is now live and that they can pause it from the dashboard. PAUSED: no ads are showing and nothing is being spent; relay publishJob.pausedMessage, which says why, and tell the user they can start it from the campaign page in VibeAds. If publishJob.billingMessage is present, relay it: Google Ads had no approved payment method, so no ads show and nothing is spent until one is added, and do not say the campaign is spending. If campaignStatus is absent, say the campaign is in Google Ads and check its status with list_campaigns. Requires a Pro or Max plan.",
    schema: checkApprovalSchema,
    handler: checkApproval,
  },
];

/**
 * The tools/list payload: what an MCP client, and the model, sees. The title
 * goes both at the top level (2025-06-18 and later) and in the annotations
 * (where 2025-03-26 clients read it).
 */
export function listedTools(): Array<{
  name: string;
  title: string;
  description: string;
  inputSchema: Record<string, unknown>;
  annotations: ToolHints & { title: string };
}> {
  return TOOLS.map((tool) => ({
    name: tool.name,
    title: tool.title,
    description: tool.description,
    inputSchema: zodToJsonSchema(tool.schema),
    annotations: { title: tool.title, ...tool.hints },
  }));
}
