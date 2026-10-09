#!/usr/bin/env node
/**
 * VibeAds MCP Server
 *
 * Official MCP (Model Context Protocol) server for VibeAds — talk to your
 * Google Ads account from Claude Desktop, Cursor, or any MCP-compatible
 * client.
 *
 * Built for local service businesses — 27 home-service verticals (plumber,
 * HVAC, electrician, roofer, cleaner, landscaper, pest control, painter,
 * handyman, locksmith, garage door, appliance repair, tree service, fencing,
 * windows & doors, carpet & flooring, waterproofing, pressure washing, air
 * duct & dryer vent cleaning, commercial cleaning & janitorial, pool
 * services, junk removal, movers, auto repair, Christmas lighting, dentist,
 * lawyer) plus 8 professional/lead-gen
 * ones (real estate, insurance, financial services, education, healthcare,
 * consulting, SaaS, B2B services).
 * Scoped access via VIBEADS_API_KEY generated at:
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
 *   - get_diagnostics          — latest agent-optimize diagnostics
 *   - list_keywords            — a campaign's keywords, live from Google Ads
 *
 * Write/workflow tools (Pro/Max):
 *   - generate_strategy        — draft a campaign strategy (nothing published)
 *   - get_strategy_status      — poll a strategy generation job
 *   - apply_strategy           — turn a finished preview into a draft campaign
 *   - list_recommendations     — pending optimizations awaiting approval
 *   - approve_recommendation   — execute ONE recommendation (closes its session);
 *                                a budget increase over 20% gets an approval link
 *   - preview_ad_group         — show a new ad group before adding it
 *   - add_ad_group             — add the previewed ad group (live on a published campaign)
 *   - request_publish          — start publish flow (human-approval link; this
 *                                package uses an API key, which never publishes itself)
 *   - add_negative_keywords, add_keywords, set_keyword_status, set_max_cpc,
 *     set_daily_budget          — direct edits to a live campaign; a budget
 *                                raise over 20% or a bid raise past 2x/$50
 *                                gets an approval link (and any budget raise
 *                                from an API key, as this package uses)
 *   - resume_campaign          — start a paused campaign (an approval link here,
 *                                since this package uses an API key)
 *   - check_approval           — poll an approval link / execution
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

import { requireApiKey } from "./gateway.js";
import { SERVER_INSTRUCTIONS, TOOLS, listedTools } from "./catalog.js";

const SERVER_VERSION = "0.2.24";
const SERVER_NAME = "vibeads-mcp";

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
    { capabilities: { tools: {} }, instructions: SERVER_INSTRUCTIONS },
  );

  // Register tool list handler
  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: listedTools(),
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
