#!/usr/bin/env node
/**
 * VibeAds MCP Server
 *
 * Official MCP (Model Context Protocol) server for VibeAds — talk to your
 * Google Ads account from Claude Desktop, Cursor, or any MCP-compatible
 * client.
 *
 * Built for local service businesses (plumbers, HVAC, electricians, and 33
 * more categories). Scoped access via VIBEADS_API_KEY generated at:
 *   https://getvibeads.com/app/settings/mcp
 *
 * Every tool runs through the server-side mcp-gateway Edge Function —
 * VIBEADS_API_KEY is the only credential needed (no Supabase keys).
 *
 * Read tools (read-only, any plan):
 *   - list_campaigns           — enumerate user's campaigns
 *   - get_campaign_details     — deep dive on one campaign
 *   - get_account_health_score — 0-100 score across 6 dimensions
 *   - get_search_term_analysis — wasted spend + winners
 *   - get_diagnostics          — full agent-optimize diagnostics list
 *
 * Write/workflow tools (Pro/Max):
 *   - generate_strategy        — draft a campaign strategy (nothing published)
 *   - get_strategy_status      — poll a strategy generation job
 *   - apply_strategy           — turn a finished preview into a draft campaign
 *   - list_recommendations     — pending optimizations awaiting approval
 *   - approve_recommendation   — execute ONE recommendation inside guardrails
 *   - request_publish          — start publish flow (human-approval link)
 *   - check_approval           — poll a publish approval / execution
 *
 * License: MIT
 * Source:  https://github.com/vibeads/mcp
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ErrorCode,
  McpError,
} from "@modelcontextprotocol/sdk/types.js";
import type { ZodTypeAny } from "zod";
import { zodToJsonSchema } from "./utils/zod-to-json-schema.js";

import { requireApiKey } from "./gateway.js";
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

const SERVER_VERSION = "0.2.6";
const SERVER_NAME = "vibeads-mcp";

// ---------------------------------------------------------------------------
// Tool registry
// ---------------------------------------------------------------------------

/**
 * Every tool — read and write — calls the server-side mcp-gateway Edge
 * Function. The only credential is VIBEADS_API_KEY (sent per-request by
 * the gateway client) — no Supabase keys ever live on the user's machine.
 */
interface ToolDef {
  name: string;
  description: string;
  schema: ZodTypeAny;
  handler: (input: any) => Promise<string>;
}

const TOOLS: readonly ToolDef[] = [
  // -------------------------------------------------------------------------
  // Read tools (read-only, any plan)
  // -------------------------------------------------------------------------
  {
    name: "list_campaigns",
    description:
      "List all Google Ads campaigns managed by VibeAds for the authenticated user. Returns name, status, category, budget, and high-level metadata. Use this first to discover which campaigns exist before drilling in.",
    schema: listCampaignsSchema,
    handler: listCampaigns,
  },
  {
    name: "get_campaign_details",
    description:
      "Get a detailed view of a single VibeAds campaign: budget, bidding strategy, ad groups, targeted locations, landing pages, last 7 days of performance metrics (impressions, clicks, CTR, CPC, spend, conversions, CPA), and any active diagnostics.",
    schema: getCampaignDetailsSchema,
    handler: getCampaignDetails,
  },
  {
    name: "get_account_health_score",
    description:
      "Compute a 0-100 account health score across 6 dimensions (Tracking, Keywords, Budget, Creative, Targeting, Performance) by rolling up the latest diagnostics from all campaigns. Returns a letter grade A-F and per-dimension breakdown. Optionally scope to a single campaign.",
    schema: getAccountHealthScoreSchema,
    handler: getAccountHealthScore,
  },
  {
    name: "get_search_term_analysis",
    description:
      "Analyze search terms from the last N days to find wasted spend (high-cost terms with zero conversions) and winning terms (high conversion rate). Returns a ranked list of terms to negate plus positive terms worth doubling down on. Can be scoped to a single campaign.",
    schema: getSearchTermAnalysisSchema,
    handler: getSearchTermAnalysis,
  },
  {
    name: "get_diagnostics",
    description:
      "Return the full list of active diagnostics across all campaigns with severity (critical / high / medium / low), affected metric, current value vs benchmark, and recommended action. Can filter by severity and scope to a specific campaign.",
    schema: getDiagnosticsSchema,
    handler: getDiagnostics,
  },
  // -------------------------------------------------------------------------
  // Write/workflow tools (Pro/Max)
  // -------------------------------------------------------------------------
  {
    name: "generate_strategy",
    description:
      "Preview a DRAFT campaign strategy server-side: keywords, ad copy, and 3+ ad groups tailored to a service category, budget, and locations. Costs 13 VibeAds credits. Returns a jobId — poll get_strategy_status with that jobId, then call apply_strategy with the same jobId to turn the finished preview into a real draft campaign. This step is a preview only: it creates no campaign, publishes nothing, and spends no ad money.",
    schema: generateStrategySchema,
    handler: generateStrategy,
  },
  {
    name: "get_strategy_status",
    description:
      "Poll the status of a strategy generation job started with generate_strategy. Returns status and phase while running, and the drafted ad groups (with keyword and headline counts) once complete. Poll every 10-15 seconds until status is completed or failed. Once completed, show the draft to the user and call apply_strategy with the same jobId to create the real draft campaign — request_publish cannot act on a preview.",
    schema: getStrategyStatusSchema,
    handler: getStrategyStatus,
  },
  {
    name: "apply_strategy",
    description:
      "Turn a COMPLETED generate_strategy preview into a real draft campaign, creating the campaign plus its ad groups, keywords, targeting, ad copy and extensions. Call this after get_strategy_status reports status 'completed', passing the same jobId. This is the required step between generating a strategy and publishing it: request_publish needs a campaignId, which only exists once the strategy is applied. Costs 6 VibeAds credits plus 3 per ad group for image generation. Creates rows only — the campaign is a DRAFT, is not live, and spends no ad money. Each preview can be applied once. A second call with the same jobId does NOT succeed: it fails with an error naming the campaignId that preview already created — pass that campaignId to request_publish rather than calling generate_strategy again.",
    schema: applyStrategySchema,
    handler: applyStrategy,
  },
  {
    name: "list_recommendations",
    description:
      "List pending optimization recommendations awaiting approval, grouped by optimization session. Each recommendation includes action, reason, risk level, blast radius, auto-eligibility, and estimated impact, plus the sessionId + recommendationId needed for approve_recommendation. Optionally scope to one campaign.",
    schema: listRecommendationsSchema,
    handler: listRecommendations,
  },
  {
    name: "approve_recommendation",
    description:
      "Approve and execute ONE already-diagnosed optimization recommendation inside VibeAds' safety guardrails (blast-radius caps, rate limits, auto-rollback if metrics worsen). Other pending recommendations on the session stay pending — approving one never rejects or executes the rest.",
    schema: approveRecommendationSchema,
    handler: approveRecommendation,
  },
  {
    name: "request_publish",
    description:
      "Start the publish flow for a campaign that already has ad groups — find it with list_campaigns, or create one from a finished preview with apply_strategy (a bare generate_strategy jobId does not qualify). Publishing spends real money, so this returns a human-approval URL instead of publishing directly — SHOW the approvalUrl to the user and ask them to open it in their browser, review the budget, and approve — on approval the campaign goes LIVE immediately and can start spending its daily budget. The API key cannot approve a publish. After the user approves, poll check_approval with the returned approvalId.",
    schema: requestPublishSchema,
    handler: requestPublish,
  },
  {
    name: "check_approval",
    description:
      "Check the status of a publish approval created with request_publish. Status is one of: pending, approved, rejected, expired, executing, executed, failed. While pending, remind the user to open the approval link in their browser — approval cannot happen through the API. Once executed, the campaign is live in Google Ads and serving ads immediately (it is not paused) — tell the user it is now spending, and that they can pause it from the dashboard.",
    schema: checkApprovalSchema,
    handler: checkApproval,
  },
];

// ---------------------------------------------------------------------------
// Server setup
// ---------------------------------------------------------------------------

async function main() {
  // `npx @vibeads/mcp --init` prints ready-to-paste client configs, then exits.
  // Init is a FLAG, not a second bin: a package with multiple bins makes bare
  // `npx @vibeads/mcp` ambiguous (npm 11's npx can't decide which bin to run
  // and errors "could not determine executable"), so the server is the SINGLE
  // bin and init rides along here. Importing cli-init runs its banner.
  if (process.argv.slice(2).includes("--init")) {
    await import("./cli-init.js");
    return;
  }

  // Every tool needs a VIBEADS_API_KEY — validate presence + format up front.
  // The key itself is validated server-side by the gateway on every call.
  try {
    requireApiKey();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[vibeads-mcp] Authentication failed: ${message}`);
    console.error(
      `[vibeads-mcp] Generate an API key at https://getvibeads.com/app/settings/mcp`,
    );
    process.exit(1);
  }

  const server = new Server(
    { name: SERVER_NAME, version: SERVER_VERSION },
    { capabilities: { tools: {} } },
  );

  // Register tool list handler
  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: TOOLS.map((tool) => ({
      name: tool.name,
      description: tool.description,
      inputSchema: zodToJsonSchema(tool.schema),
    })),
  }));

  // Register tool invocation handler
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const toolName = request.params.name;
    const tool = TOOLS.find((t) => t.name === toolName);

    if (!tool) {
      throw new McpError(
        ErrorCode.MethodNotFound,
        `Unknown tool: ${toolName}. Available tools: ${TOOLS.map((t) => t.name).join(", ")}`,
      );
    }

    try {
      // Parse and validate input with the tool's Zod schema, then dispatch
      // to the gateway — the API key is the auth, scoping happens server-side
      const parsed = tool.schema.parse(request.params.arguments ?? {});
      const result = await tool.handler(parsed);

      return {
        content: [
          {
            type: "text" as const,
            text: result,
          },
        ],
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      throw new McpError(
        ErrorCode.InternalError,
        `Tool ${toolName} failed: ${message}`,
      );
    }
  });

  // Connect to stdio (standard MCP transport for local clients)
  const transport = new StdioServerTransport();
  await server.connect(transport);

  // Log startup to stderr (stdout is reserved for MCP protocol messages)
  console.error(
    `[vibeads-mcp] Server started v${SERVER_VERSION} — ${TOOLS.length} tools registered (gateway auth via VIBEADS_API_KEY)`,
  );
}

main().catch((err) => {
  console.error(`[vibeads-mcp] Fatal:`, err);
  process.exit(1);
});
