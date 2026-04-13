# @vibeads/mcp

[![npm version](https://img.shields.io/npm/v/@vibeads/mcp.svg)](https://www.npmjs.com/package/@vibeads/mcp)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![MCP](https://img.shields.io/badge/MCP-compatible-blue)](https://modelcontextprotocol.io)

> **Talk to your Google Ads account from Claude Desktop, Cursor, or any MCP client.**
>
> Built for local service businesses — plumbers, HVAC, electricians, roofers, and 33 more categories.

The official [Model Context Protocol](https://modelcontextprotocol.io) server for [VibeAds](https://getvibeads.com). Ask Claude questions like "which search terms are wasting my budget?" or "what's my account health score?" and get answers pulled from your live campaign data.

Unlike generic Google Ads MCP servers, this one is pre-tuned for **local service businesses** and rolls up 35+ diagnostic rules into a single 0-100 account health score across 6 dimensions.

---

## Features

- 🎯 **Local-service-first** — tuned for plumbers, HVAC, electricians, and 34 more categories
- 📊 **Account Health Score 0-100** — weighted across 6 dimensions (Tracking, Keywords, Budget, Creative, Targeting, Performance)
- 🔍 **Search term waste detection** — finds every dollar burning on zero-conversion terms
- 💡 **Diagnostic rollup** — 35+ rules from VibeAds' optimization engine, ranked by severity
- 🔒 **Read-only by design** — API keys cannot modify your campaigns
- ⚡ **No GAQL required** — ask questions in natural language, get markdown answers

---

## Installation

### Step 1 — Get your API key

Sign in to your [VibeAds account](https://getvibeads.com) and generate a read-only API key:

**[→ Generate API key](https://getvibeads.com/app/settings/mcp)**

Keys start with `vba_mcp_` and are scoped to your account only.

### Step 2 — Configure your MCP client

#### Claude Desktop

Open your config file:

| OS | Path |
|---|---|
| macOS | `~/Library/Application Support/Claude/claude_desktop_config.json` |
| Windows | `%APPDATA%\Claude\claude_desktop_config.json` |
| Linux | `~/.config/Claude/claude_desktop_config.json` |

Add this to the `mcpServers` block:

```json
{
  "mcpServers": {
    "vibeads": {
      "command": "npx",
      "args": ["-y", "@vibeads/mcp"],
      "env": {
        "VIBEADS_API_KEY": "vba_mcp_YOUR_KEY_HERE"
      }
    }
  }
}
```

Restart Claude Desktop. You should see the VibeAds tools appear in the 🔨 tool menu.

#### Cursor

1. Open **Settings → MCP**
2. Click **Add Server**
3. Configure:
   - **Name:** `vibeads`
   - **Command:** `npx -y @vibeads/mcp`
   - **Environment variables:** `VIBEADS_API_KEY=vba_mcp_YOUR_KEY_HERE`

#### Cline / Claude Code / other MCP clients

Use the same config as Claude Desktop above. Most MCP clients follow the same schema.

---

## Usage

Once configured, you can ask Claude questions like:

### 📋 Campaign discovery

> "Show me all my VibeAds campaigns"
>
> "Which campaigns are paused?"
>
> "Give me the 5 most recently created campaigns"

### 🔬 Deep dives

> "Tell me everything about my plumber campaign in Austin"
>
> "How did my HVAC campaign perform last week?"
>
> "What's the CPA for campaign abc12345?"

### 📊 Account health

> "What's my VibeAds account health score?"
>
> "Which dimension is pulling my score down?"
>
> "Give me the health score just for campaign xyz"

### 💸 Search term analysis

> "What search terms are wasting my budget?"
>
> "Show me the top 10 winning keywords from the last 30 days"
>
> "How much am I wasting on terms with zero conversions?"

### 🩺 Diagnostics + recommendations

> "What should I fix first?"
>
> "Show me all critical diagnostics"
>
> "What's wrong with my roofing campaign?"

---

## Available tools

| Tool | Purpose |
|---|---|
| `list_campaigns` | Enumerate all campaigns with status, budget, category |
| `get_campaign_details` | Deep dive on one campaign: metrics, ad groups, targeting, landing pages, diagnostics |
| `get_account_health_score` | 0-100 score + letter grade across 6 dimensions, optionally per-campaign |
| `get_search_term_analysis` | Wasted spend + winners from search terms report (configurable lookback + threshold) |
| `get_diagnostics` | Full list of active agent-optimize diagnostics with severity + recommended fix |

All tools are **read-only**. They cannot create, modify, pause, or delete anything in your Google Ads account.

---

## Security

- **API keys are read-only.** They cannot mutate your campaigns, your Google Ads account, or your VibeAds settings.
- **Keys are hashed** with SHA-256 before storage. The full key is only shown once at creation.
- **Revocable any time** from `https://getvibeads.com/app/settings/mcp`.
- **Usage is logged** per-key: last-used timestamp and request count.
- **Row-level isolation** — each key is scoped to a single VibeAds user. Keys cannot see other users' data.
- **Optional expiry** — set expiration dates on keys for service accounts / temporary access.

For maximum security, rotate your API key whenever a device changes hands or an engagement ends.

---

## Requirements

- **Node.js ≥ 20** (for `npx` runtime)
- **Active VibeAds account** — free tier is sufficient to generate a key
- **At least one published campaign** — diagnostics require synced data from Google Ads

---

## How it compares

| | VibeAds MCP | GoMarble MCP | Google Ads MCP (official) |
|---|---|---|---|
| Setup time | 2 min | 15 min | 30 min |
| OAuth required | ❌ (API key only) | ✅ | ✅ |
| GAQL knowledge required | ❌ | ✅ | ✅ |
| Local service tuning | ✅ | ❌ | ❌ |
| Account health score | ✅ 6 dimensions | ❌ | ❌ |
| Pre-built diagnostics | ✅ 35+ rules | ❌ | ❌ |
| Multi-account | ✅ | ✅ | ✅ |
| Can mutate accounts | ❌ | ❌ | ❌ |

**When to use VibeAds MCP:** You run a local service business (or manage ads for one) and want pre-tuned insights without learning GAQL.

**When to use GoMarble / Google Ads MCP:** You need to run custom GAQL queries or work with non-service-business campaigns (e-commerce, B2B SaaS, etc.).

The three can coexist — install whichever ones fit your workflow.

---

## Troubleshooting

### "Authentication failed"

- Make sure your key starts with `vba_mcp_`
- Generate a new key at https://getvibeads.com/app/settings/mcp
- Check that the key hasn't been revoked or expired

### "No diagnostic data yet"

Diagnostics are generated every 6 hours by the VibeAds agent. If you just published a campaign, wait 6-12 hours for the first run.

### "No search term data found"

Search term sync runs every 6 hours. For new campaigns, allow 24-48 hours for meaningful data to accumulate.

### MCP client can't find the server

Make sure you have Node.js 20+ installed: `node --version`. Claude Desktop and Cursor both shell out to `npx`, so Node must be in your PATH.

---

## Contributing

This is an open-source MIT package. Issues and PRs welcome at:
**https://github.com/vibeads/vibeads**

---

## License

MIT © [VibeAds](https://getvibeads.com)
