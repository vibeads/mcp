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
 * Tools:
 *   - list_campaigns           — enumerate user's campaigns
 *   - get_campaign_details     — deep dive on one campaign
 *   - get_account_health_score — 0-100 score across 6 dimensions
 *   - get_search_term_analysis — wasted spend + winners
 *   - get_diagnostics          — full agent-optimize diagnostics list
 *
 * License: MIT
 * Source:  https://github.com/vibeads/vibeads/tree/main/packages/vibeads-mcp
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ErrorCode,
  McpError,
} from "@modelcontextprotocol/sdk/types.js";
import { zodToJsonSchema } from "./utils/zod-to-json-schema.js";

import { authenticate } from "./supabase.js";
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

const SERVER_VERSION = "0.1.0";
const SERVER_NAME = "vibeads-mcp";

// ---------------------------------------------------------------------------
// Tool registry
// ---------------------------------------------------------------------------

const TOOLS = [
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
] as const;

// ---------------------------------------------------------------------------
// Server setup
// ---------------------------------------------------------------------------

async function main() {
  // Validate the API key at startup — fail fast with a clear error.
  let session: { userId: string; keyId: string };
  try {
    session = await authenticate();
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
      // Parse and validate input with the tool's Zod schema
      const parsed = tool.schema.parse(request.params.arguments ?? {});
      // All tools receive (input, userId) so they can scope queries correctly
      const result = await tool.handler(parsed as any, session.userId);

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
    `[vibeads-mcp] Server started v${SERVER_VERSION} — ${TOOLS.length} tools registered, authenticated as user ${session.userId.slice(0, 8)}...`,
  );
}

main().catch((err) => {
  console.error(`[vibeads-mcp] Fatal:`, err);
  process.exit(1);
});
