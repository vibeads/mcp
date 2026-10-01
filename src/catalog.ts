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
  previewAdGroup,
  previewAdGroupSchema,
} from "./tools/preview-ad-group.js";
import {
  addAdGroup,
  addAdGroupSchema,
} from "./tools/add-ad-group.js";
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
  "This connection cannot approve spend itself. To act on the optimizer's recommendations: list_recommendations " +
  "says how each one can be approved. approve_recommendation applies a change once the user says so; a new ad " +
  "group is shown with preview_ad_group and added with add_ad_group; a budget increase of more than 20% returns " +
  "an approval link the user opens in VibeAds. The limit is 60 tool calls per hour.";

/**
 * MCP tool annotations (2025-03-26 and later): hints an agent uses to decide
 * which calls need the user's say-so. Read tools only read VibeAds' own copy
 * of the account. Only approve_recommendation and add_ad_group change live
 * Google Ads campaigns, so only they are open-world. preview_ad_group writes
 * a preview inside VibeAds and nothing else. request_publish changes nothing in
 * Google Ads and spends nothing, but it is destructive too: it cancels the
 * campaign's earlier pending approval link, and the publish it asks for
 * spends money once the user approves. OpenAI's plugin guidelines allow
 * destructiveHint false only for additive writes (no cancellation, revoked
 * access or irreversible transaction), and their tool scan flagged
 * request_publish when it said false (Oct 1 2026).
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
/** Creates something inside VibeAds (a preview or a draft); touches nothing live and cancels nothing. */
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
      "Preview a DRAFT campaign strategy server-side: keywords, ad copy, and 3+ ad groups tailored to a service category, budget, and locations. Pro and Max drafts include an ad group for searches of the business's own name, and on the Max plan, competitor ad groups for up to 5 competitors named in competitors. Costs 13 VibeAds credits. Returns a jobId — poll get_strategy_status with that jobId, then call apply_strategy with the same jobId to turn the finished preview into a real draft campaign. This step is a preview only: it creates no campaign, publishes nothing, and spends no ad money. Requires a Pro or Max plan.",
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
      "Read-only: list the changes VibeAds recommends for the user's campaigns that are waiting for the user's decision, from the 25 most recent optimization sessions. Each session has a sessionId and its campaign; each recommendation has a recommendationId, the change it would make, the reason, a risk level, a blast radius (how much harm the change could do if it is wrong), the estimated impact, and approval, which says how it can be approved: approve (approve_recommendation applies it once the user says so), approval_link (a budget increase of more than 20%: approve_recommendation returns a link the user opens in VibeAds to approve it), preview_then_add (a new ad group: preview_ad_group with the sessionId and recommendationId, show the preview, then add_ad_group) or not_applicable (advice to relay; nothing can be applied from here). Budget changes show the current and new daily budget. Calling this changes nothing. Approving one recommendation rejects the other recommendations in its session. Requires a Pro or Max plan.",
    schema: listRecommendationsSchema,
    handler: listRecommendations,
  },
  {
    name: "approve_recommendation",
    title: "Approve a recommendation",
    // Changes live Google Ads campaigns and rejects the rest of the session.
    hints: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: true },
    description:
      "Apply one recommendation the user has chosen from list_recommendations, using its sessionId and recommendationId. Call this only when the user asks to approve that recommendation. It changes the user's live Google Ads campaigns right away (for example adding negative keywords, changing bids, lowering a budget or raising it by up to 20%, or pausing keywords or ad groups), through the same path as the approve button in the VibeAds dashboard. A budget increase of more than 20%, or one that cannot be compared with the current budget, is not applied here: the reply has approvalRequired and an approvalUrl, which the user must open in VibeAds to approve it, and nothing changes until they do (check_approval reports the outcome). A new ad group must be previewed first with preview_ad_group (error preview_required), and advice is refused with cannot_apply_here; neither changes anything. Approving decides the whole session: the session's other recommendations are recorded as rejected, the session closes, and a later approve_recommendation call on it fails with session_not_pending. Conflicting or no-op changes are skipped. Changes with blast radius surgical or meaningful are measured afterwards and rolled back automatically if the campaign's results get worse. Requires a Pro or Max plan.",
    schema: approveRecommendationSchema,
    handler: approveRecommendation,
  },
  {
    name: "preview_ad_group",
    title: "Preview a new ad group",
    // Saves a preview inside VibeAds; nothing in Google Ads changes.
    hints: CREATES_DRAFT,
    description:
      "Write a new ad group for one of the user's campaigns and show what adding it would do, without adding anything: its keywords, its three ads, its landing page, its images, and the daily budget each ad group would get. Use it for an ad group the user names (campaignId and name, for a service the campaign does not cover yet) or for the optimizer's recommended ad group (sessionId and recommendationId from list_recommendations, where approval is preview_then_add). Show the preview to the user; if they agree, call add_ad_group with the returned proposalId. Nothing changes in Google Ads, the campaign's budget is not changed, and no credits are charged. The preview expires after 24 hours. An assistant can preview 10 new ad groups a day. Requires a Pro or Max plan.",
    schema: previewAdGroupSchema,
    handler: previewAdGroup,
  },
  {
    name: "add_ad_group",
    title: "Add the previewed ad group",
    // Changes live Google Ads campaigns; adding the same preview twice returns the first result.
    hints: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: true },
    description:
      "Add the ad group from preview_ad_group, using its proposalId. Call this only after the user has seen that preview and agreed to add it. On a published campaign it starts serving in Google Ads right away with its keywords and three ads, within the campaign's current daily budget, and VibeAds builds its landing page and generates images for it (3 credits). On a draft campaign it is saved and goes live when the campaign is published. If the preview came from a recommendation, adding it approves that recommendation, and the other recommendations in its session are recorded as rejected. Each preview can be added once; calling again returns the first result. An assistant can add 3 ad groups to a campaign a day. The user can pause or remove it from the campaign's Ad Groups tab in VibeAds. Requires a Pro or Max plan.",
    schema: addAdGroupSchema,
    handler: addAdGroup,
  },
  {
    name: "request_publish",
    title: "Request publish approval",
    // Cancels the campaign's earlier pending approval link, and what it asks
    // for spends money once approved. It changes nothing in Google Ads itself.
    hints: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: false },
    description:
      "Ask the user to approve publishing a draft campaign. This tool does not publish anything or change Google Ads: it creates an approval link on getvibeads.com that is valid for 24 hours, and cancels any earlier pending link for the same campaign. Show the approvalUrl to the user and ask them to open it in their browser, review the budget and approve. Only the user can approve; this connection cannot. Approving starts publishing the campaign to Google Ads, where it can spend its daily budget, billed to the advertiser's own Google Ads account. After the user approves, poll check_approval with the returned approvalId: it says when publishing finishes and whether the campaign is live or was left paused. The campaign must be a draft that is not yet published and has ad groups: find one with list_campaigns, or create one from a finished preview with apply_strategy (a generate_strategy jobId does not qualify). The account must have Google Ads connected. Requires a Pro or Max plan.",
    schema: requestPublishSchema,
    handler: requestPublish,
  },
  {
    name: "check_approval",
    title: "Check an approval",
    hints: READ_ONLY,
    description:
      "Check an approval link: one created with request_publish, or one approve_recommendation returned for a budget increase (approvalRequired). actionType says which: publish_campaign or apply_recommendation. status is one of: pending, approved, rejected, expired, executing, executed, failed. While pending, remind the user to open the approval link in their browser; approval cannot happen through the API. For apply_recommendation, executed means the daily budget was changed in Google Ads. For publish_campaign, executed means the approval went through and a publish job started, not that ads are serving: the result's publishJob.status is processing, queued, completed or failed, with the current step and any error. Once publishJob.status is completed the campaign is in Google Ads, and publishJob.campaignStatus says whether ads can show. ENABLED: it is live and can spend its daily budget; tell the user it is now live and that they can pause it from the dashboard. PAUSED: no ads are showing and nothing is being spent; relay publishJob.pausedMessage, which says why, and tell the user they can start it from the campaign page in VibeAds. If publishJob.billingMessage is present, relay it: Google Ads had no approved payment method, so no ads show and nothing is spent until one is added, and do not say the campaign is spending. If campaignStatus is absent, say the campaign is in Google Ads and check its status with list_campaigns. Requires a Pro or Max plan.",
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
