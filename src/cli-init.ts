#!/usr/bin/env node
/**
 * vibeads-mcp-init — interactive setup helper
 *
 * Generates a ready-to-paste MCP client config snippet for Claude Desktop,
 * Cursor, Cline, or any other MCP-compatible client.
 *
 * Usage:
 *   npx @vibeads/mcp-init
 */

import { platform, homedir } from "node:os";
import { join } from "node:path";

const API_KEY_URL = "https://getvibeads.com/app/settings/mcp";

function printBanner() {
  console.log();
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("  VibeAds MCP Server — Setup");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log();
}

function printClaudeDesktopConfig() {
  const os = platform();
  let configPath = "";
  if (os === "darwin") {
    configPath = join(homedir(), "Library/Application Support/Claude/claude_desktop_config.json");
  } else if (os === "win32") {
    configPath = join(homedir(), "AppData/Roaming/Claude/claude_desktop_config.json");
  } else {
    configPath = join(homedir(), ".config/Claude/claude_desktop_config.json");
  }

  console.log("─── Claude Desktop ────────────────────────────────────");
  console.log();
  console.log(`  Config file: ${configPath}`);
  console.log();
  console.log("  Paste this into the \"mcpServers\" block:");
  console.log();
  console.log(`  {
    "mcpServers": {
      "vibeads": {
        "command": "npx",
        "args": ["-y", "@vibeads/mcp"],
        "env": {
          "VIBEADS_API_KEY": "vba_mcp_YOUR_KEY_HERE"
        }
      }
    }
  }`);
  console.log();
}

function printCursorConfig() {
  console.log("─── Cursor ────────────────────────────────────────────");
  console.log();
  console.log("  1. Open Cursor Settings → MCP");
  console.log("  2. Click 'Add Server' and set:");
  console.log();
  console.log("     Name:    vibeads");
  console.log("     Command: npx -y @vibeads/mcp");
  console.log("     Env:     VIBEADS_API_KEY=vba_mcp_YOUR_KEY_HERE");
  console.log();
}

function printClineConfig() {
  console.log("─── Cline / Claude Code ───────────────────────────────");
  console.log();
  console.log("  In your MCP servers config:");
  console.log();
  console.log(`  {
    "mcpServers": {
      "vibeads": {
        "command": "npx",
        "args": ["-y", "@vibeads/mcp"],
        "env": {
          "VIBEADS_API_KEY": "vba_mcp_YOUR_KEY_HERE"
        }
      }
    }
  }`);
  console.log();
}

function printApiKeyInstructions() {
  console.log("─── Get your API key ──────────────────────────────────");
  console.log();
  console.log(`  1. Go to: ${API_KEY_URL}`);
  console.log("  2. Click 'Generate new key'");
  console.log("  3. Copy the key (starts with vba_mcp_...)");
  console.log("  4. Paste it into the config above, replacing YOUR_KEY_HERE");
  console.log();
  console.log("  Read tools are read-only. Write tools run inside safety");
  console.log("  guardrails — publishing always needs your approval in the browser.");
  console.log();
}

function printExamplePrompts() {
  console.log("─── Example prompts to try ────────────────────────────");
  console.log();
  console.log('  • "Show me all my VibeAds campaigns"');
  console.log('  • "What\'s my VibeAds account health score?"');
  console.log('  • "Tell me everything about campaign abc123"');
  console.log('  • "What search terms are wasting my budget?"');
  console.log('  • "What should I fix first?"');
  console.log('  • "Show me my top performing keywords this week"');
  console.log();
}

function printFooter() {
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("  Questions? Reach us at hello@getvibeads.com");
  console.log("  Docs: https://getvibeads.com/docs/mcp");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log();
}

function main() {
  printBanner();
  printApiKeyInstructions();
  printClaudeDesktopConfig();
  printCursorConfig();
  printClineConfig();
  printExamplePrompts();
  printFooter();
}

main();
