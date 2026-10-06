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
import {
  findCampaignsToImport,
  findCampaignsToImportSchema,
} from "./tools/find-campaigns-to-import.js";
import {
  importCampaigns,
  importCampaignsSchema,
} from "./tools/import-campaigns.js";
import {
  pauseCampaign,
  pauseCampaignSchema,
} from "./tools/pause-campaign.js";

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
  "electricians, roofers, cleaners, landscapers, pest control and similar trades. It answers how a business's " +
  "Google Ads are doing, what is wasting its ad budget and what to fix, and it drafts and publishes new Google " +
  "Ads campaigns. list_campaigns lists the user's campaigns in VibeAds, their Google Ads campaigns included, " +
  "with or without a Google Ads connection. Reading works on every plan; drafting, importing, recommendations, " +
  "pausing and publishing are part of the Pro and Max plans, as each of those tools says. VibeAds manages the " +
  "campaigns it published or imported; find_campaigns_to_import and import_campaigns bring in campaigns already " +
  "running in the user's Google Ads account. A new campaign is drafted with generate_strategy, followed with " +
  "get_strategy_status, built as a draft with apply_strategy and published with request_publish. Publishing " +
  "spends the advertiser's own money. For a connection the user made by signing in to VibeAds, within the daily " +
  "budget the user allows AI assistants, request_publish publishes once the user confirms the campaign's daily " +
  "budget; otherwise it returns an approval link, which the user approves in VibeAds and this connection cannot. " +
  "With more than one Google Ads account, the user chooses the account a campaign goes to. pause_campaign pauses " +
  "a live campaign. list_recommendations lists the optimizer's recommendations and how each can be approved: " +
  "approve_recommendation applies one the user approves, preview_ad_group and add_ad_group handle a new ad group, " +
  "and a budget increase of more than 20% is approved through a link in VibeAds. Each connection can make 60 tool " +
  "calls per hour.";

/**
 * MCP tool annotations (2025-03-26 and later): hints an agent uses to decide
 * which calls need the user's say-so. Read tools only read VibeAds' own copy
 * of the account. approve_recommendation and add_ad_group change live Google
 * Ads campaigns, so they are open-world. generate_strategy is open-world too:
 * it reads the public websites of the competitors the user names, a system
 * nobody here controls (OpenAI's tool scan flagged it as closed, Oct 1 2026).
 * preview_ad_group writes a preview inside VibeAds and nothing else.
 * pause_campaign is destructive and open-world: it stops a live campaign
 * in Google Ads (reversible, but it stops the ads). import_campaigns and
 * find_campaigns_to_import read the user's own Google Ads account and change
 * nothing there, so they are closed-world; import_campaigns writes inside
 * VibeAds only.
 * request_publish is destructive and open-world: since Oct 3 2026 it
 * publishes a Search campaign to Google Ads itself, for a connection the
 * user made by signing in, when they allow assistants to publish up to a
 * daily budget and confirm the campaign's budget, which spends their money
 * (an API key always gets the link); otherwise it cancels the campaign's
 * earlier pending approval link and makes a new one. OpenAI's plugin
 * guidelines allow destructiveHint false only for additive writes (no
 * cancellation, revoked access or irreversible transaction), and their tool
 * scan flagged request_publish when it said false (Oct 1 2026).
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
      "Lists the user's campaigns in VibeAds, newest first (default 25, max 100): the Google Ads campaigns VibeAds published or imported, and drafts. This is the list for a request to see the user's campaigns, \"my Google Ads campaigns\" included, and it works with or without a Google Ads connection. Each campaign has its name, full campaign ID, status, whether it is published to Google Ads, category and business city, daily budget, and created date. It has no performance metrics (get_campaign_details has the last 7 days). Every tool that takes a campaign ID accepts the ID it returns. Campaigns in the user's Google Ads account that VibeAds has not published or imported are not in this list; find_campaigns_to_import reads those.",
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
    // Named list_google_ads_campaigns until 0.2.16: ChatGPT took that name for
    // "show me my Google Ads campaigns", which list_campaigns answers.
    name: "find_campaigns_to_import",
    title: "Find campaigns to import",
    // Reads the user's own Google Ads account; changes nothing anywhere.
    hints: READ_ONLY,
    description:
      "Reads the campaigns in one of the user's connected Google Ads accounts directly from Google Ads (up to 50, removed ones left out) and marks each with inVibeAds, whether VibeAds already manages it. It is for bringing existing campaigns into VibeAds: the user picks the ones to bring in, and import_campaigns copies them. Each campaign has its name, googleCampaignId, status, type, daily budget, and the last 30 days of impressions, clicks, spend and conversions. VibeAds' optimizer, reports and recommendations cover the campaigns in VibeAds, which makes this useful right after the user connects Google Ads. With more than one Google Ads account, the first answer is choose_google_ads_account with the accounts, and a call with customerId reads the one the user picks. Without a Google Ads connection, the answer has a link for the user to connect it. Reading changes nothing. Available on every plan.",
    schema: findCampaignsToImportSchema,
    handler: findCampaignsToImport,
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
    // A draft, but it reads the websites of the competitors the user names.
    hints: { ...CREATES_DRAFT, openWorldHint: true },
    description:
      "Previews a draft campaign strategy server-side: keywords, ad copy, and 3 or more ad groups for a service category, budget, and locations. Pro and Max drafts include an ad group for searches of the business's own name, and on the Max plan, competitor ad groups for up to 5 competitors named in competitors; for a competitor given with its website, VibeAds reads that public website to write those ads. Costs 13 VibeAds credits. Returns a jobId: get_strategy_status reports progress with it, and apply_strategy turns the finished preview into a draft campaign. The preview creates no campaign, publishes nothing and spends no ad money. Requires a Pro or Max plan.",
    schema: generateStrategySchema,
    handler: generateStrategy,
  },
  {
    name: "get_strategy_status",
    title: "Check strategy status",
    hints: READ_ONLY,
    description:
      "Checks a strategy generation job started with generate_strategy. Returns status and phase while running, and the drafted ad groups (with keyword and headline counts) once complete. Generation usually finishes within a few minutes (the server allows up to 6), and every VibeAds tool call counts toward a limit of 60 calls per hour per connection, so checks are best spaced out. Once it is complete, apply_strategy with the same jobId creates the draft campaign; request_publish works on a draft campaign, not on a preview. Requires a Pro or Max plan.",
    schema: getStrategyStatusSchema,
    handler: getStrategyStatus,
  },
  {
    name: "apply_strategy",
    title: "Create a draft campaign",
    hints: CREATES_DRAFT,
    description:
      "Turns a completed generate_strategy preview into a draft campaign: the campaign with its ad groups, keywords, targeting, ad copy and extensions. It takes the same jobId once get_strategy_status reports completed, and request_publish works on the campaignId it returns. Costs 6 VibeAds credits plus 3 per ad group for image generation. The campaign is a draft: it is not live and spends no ad money. Each preview becomes one campaign. A second call with the same jobId returns an error naming the campaign the preview already created, unless an earlier call failed and left that draft empty, which the second call then fills. Business contact values given here override those sent to generate_strategy, so a missing phone can be supplied without regenerating. Requires a Pro or Max plan.",
    schema: applyStrategySchema,
    handler: applyStrategy,
  },
  {
    name: "list_recommendations",
    title: "List pending recommendations",
    hints: READ_ONLY,
    description:
      "Lists the changes VibeAds recommends for the user's campaigns that are waiting for the user's decision, from the 25 most recent optimization sessions. Each session has a sessionId and its campaign; each recommendation has a recommendationId, the change it would make, the reason, a risk level, a blast radius (how much harm the change could do if it is wrong), the estimated impact, and approval, which says how it can be approved: approve (approve_recommendation applies it when the user approves), approval_link (a budget increase of more than 20%; approve_recommendation returns a link the user opens in VibeAds), preview_then_add (a new ad group, previewed with preview_ad_group using the sessionId and recommendationId and added with add_ad_group) or not_applicable (advice, with nothing to apply). Budget changes show the current and new daily budget. Reading changes nothing. Approving one recommendation rejects the other recommendations in its session. Requires a Pro or Max plan.",
    schema: listRecommendationsSchema,
    handler: listRecommendations,
  },
  {
    name: "approve_recommendation",
    title: "Approve a recommendation",
    // Changes live Google Ads campaigns and rejects the rest of the session.
    hints: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: true },
    description:
      "Applies one recommendation from list_recommendations that the user approves, by its sessionId and recommendationId. It changes the user's live Google Ads campaigns right away (for example adding negative keywords, changing bids, lowering a budget or raising it by up to 20%, or pausing keywords or ad groups), through the same path as the approve button in the VibeAds dashboard. A budget increase of more than 20%, or one that cannot be compared with the current budget, is not applied here: the reply has approvalRequired and an approvalUrl that the user opens in VibeAds to approve it, and nothing changes until then (check_approval reports the outcome). A new ad group goes through preview_ad_group first (error preview_required), and advice returns cannot_apply_here; neither changes anything. Approving decides the whole session: its other recommendations are recorded as rejected, the session closes, and a later approve_recommendation call on it returns session_not_pending. Conflicting or no-op changes are skipped. Changes with blast radius surgical or meaningful are measured afterwards and rolled back automatically if the campaign's results get worse. Requires a Pro or Max plan.",
    schema: approveRecommendationSchema,
    handler: approveRecommendation,
  },
  {
    name: "preview_ad_group",
    title: "Preview a new ad group",
    // Saves a preview inside VibeAds; nothing in Google Ads changes.
    hints: CREATES_DRAFT,
    description:
      "Writes a new ad group for one of the user's campaigns and shows what adding it would do, without adding anything: its keywords, its three ads, its landing page, its images, and the daily budget each ad group would get. It works for an ad group the user names (campaignId and name, for a service the campaign does not cover yet) or for the optimizer's recommended ad group (sessionId and recommendationId from list_recommendations, where approval is preview_then_add). add_ad_group adds it with the returned proposalId once the user agrees. Nothing changes in Google Ads, the campaign's budget is not changed, and no credits are charged. The preview expires after 24 hours. An assistant can preview 10 new ad groups a day. Requires a Pro or Max plan.",
    schema: previewAdGroupSchema,
    handler: previewAdGroup,
  },
  {
    name: "add_ad_group",
    title: "Add the previewed ad group",
    // Changes live Google Ads campaigns; adding the same preview twice returns the first result.
    hints: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: true },
    description:
      "Adds the ad group the user saw in preview_ad_group and agreed to, by its proposalId. On a published campaign it starts serving in Google Ads right away with its keywords and three ads, within the campaign's current daily budget, and VibeAds builds its landing page and generates images for it (3 credits). On a draft campaign it is saved and goes live when the campaign is published. If the preview came from a recommendation, adding it approves that recommendation, and the other recommendations in its session are recorded as rejected. Each preview can be added once; a repeat call returns the first result. An assistant can add 3 ad groups to a campaign a day. The user can pause or remove it from the campaign's Ad Groups tab in VibeAds. Requires a Pro or Max plan.",
    schema: addAdGroupSchema,
    handler: addAdGroup,
  },
  {
    name: "request_publish",
    title: "Publish a draft campaign",
    // Publishes to Google Ads itself within the daily budget the user allows
    // assistants (spending their money); otherwise it cancels the campaign's
    // earlier pending approval link and makes a new one.
    hints: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: true },
    description:
      "Publishes a draft campaign to Google Ads, where it can spend its daily budget, billed to the advertiser's own Google Ads account. For a connection the user made by signing in to VibeAds, when the user allows AI assistants to publish Search campaigns up to a daily budget and this campaign is within it, publishing takes two calls. The first publishes nothing and returns needsConfirmation with dailyBudgetUsd, the most the campaign can spend a day. The second, with confirmedDailyBudget set to that amount once the user agrees to it, starts publishing and returns published true. In every other case (a connection made with a VibeAds API key, no such allowance or a budget over it, a Display or Meta campaign, or two campaigns already published this way in the last 24 hours) the reply has an approvalUrl, valid for 24 hours, with approvalReason: the user opens it in their browser, reviews the budget and approves it, which this connection cannot do. A publish or a new link cancels an earlier pending link for the same campaign. check_approval with the returned approvalId reports when publishing finishes and whether the campaign is live or was left paused. The campaign is a draft with ad groups: one listed by list_campaigns, or one apply_strategy created (a generate_strategy jobId is not a campaign). Without a Google Ads connection, the reply has a link for the user to connect it. With more than one Google Ads account, the first reply is choose_google_ads_account with the accounts, and customerId names the account the user picks, on the confirming call as well; the campaign is published to that account and no other. Requires a Pro or Max plan.",
    schema: requestPublishSchema,
    handler: requestPublish,
  },
  {
    name: "import_campaigns",
    title: "Import campaigns from Google Ads",
    // Copies campaigns into VibeAds; reads Google Ads and changes nothing there.
    hints: CREATES_DRAFT,
    description:
      "Brings up to 3 campaigns the user chose from find_campaigns_to_import into VibeAds, by their googleCampaignIds. VibeAds copies each campaign's ad groups, keywords, ads, targeting and extensions and then manages it like a campaign it published: it syncs its numbers from Google Ads (starting now), its optimizer reviews it within 12 hours, and get_campaign_details, list_recommendations and pause_campaign work on it with the returned campaignId. Nothing changes in Google Ads. Costs 1 VibeAds credit per campaign. With more than one Google Ads account, customerId names the account the campaigns are in. Requires a Pro or Max plan.",
    schema: importCampaignsSchema,
    handler: importCampaigns,
  },
  {
    name: "pause_campaign",
    title: "Pause a campaign",
    // Stops a live campaign in Google Ads; pausing again changes nothing.
    hints: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: true },
    description:
      "Pauses one of the user's published campaigns in Google Ads, by its campaignId from list_campaigns or import_campaigns. While it is paused no ads show and nothing is spent. Nothing is deleted. Starting it again happens on the campaign's page in VibeAds (Start ads), since starting a campaign spends money. A draft that is not in Google Ads yet has nothing to pause, and a campaign that is already paused is left as it is. Requires a Pro or Max plan.",
    schema: pauseCampaignSchema,
    handler: pauseCampaign,
  },
  {
    name: "check_approval",
    title: "Check an approval",
    hints: READ_ONLY,
    description:
      "Reports on an approval: a link created by request_publish, a publish request_publish started itself (published true), or a link approve_recommendation returned for a budget increase (approvalRequired). actionType says which: publish_campaign or apply_recommendation. status is one of: pending, approved, rejected, expired, executing, executed, failed. Pending means the user has not yet approved the link, which happens in their browser and not through this connection. For apply_recommendation, executed means the daily budget was changed in Google Ads. For publish_campaign, executed means a publish job started, not that ads are serving: publishJob.status is processing, queued, completed or failed, with the current step and any error. Once publishJob.status is completed the campaign is in Google Ads, and publishJob.campaignStatus says whether ads can show. ENABLED: the campaign is live, can spend its daily budget, and can be paused from the dashboard. PAUSED: no ads are showing and nothing is being spent; publishJob.pausedMessage says why, and the campaign's page in VibeAds can start it. publishJob.billingMessage, when present, means Google Ads has no approved payment method, so no ads show and nothing is spent until one is added. Without campaignStatus, the campaign is in Google Ads and list_campaigns shows its status. Requires a Pro or Max plan.",
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
