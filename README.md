# @vibeads/mcp

[![npm version](https://img.shields.io/npm/v/@vibeads/mcp.svg)](https://www.npmjs.com/package/@vibeads/mcp)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![MCP](https://img.shields.io/badge/MCP-compatible-blue)](https://modelcontextprotocol.io)

> **Talk to your Google Ads account from Claude Desktop, Cursor, or any MCP client.**
>
> Built for local service businesses: 35 categories, 32 of them with tuned keywords, CPC benchmarks and funnel templates.

The official [Model Context Protocol](https://modelcontextprotocol.io) server for [VibeAds](https://getvibeads.com). Ask Claude questions like "which search terms are wasting my budget?" or "what's my account health score?" and get answers pulled from your live campaign data.

Unlike generic Google Ads MCP servers, this one is pre-tuned for **local service businesses** and rolls up 35+ diagnostic rules into a single 0-100 account health score across 6 dimensions. On Pro/Max plans it can also draft campaign strategies, execute guarded optimizations, add ad groups, and kick off publish flows, with a human always approving anything that spends money.

---

## Features

- 🎯 **Local-service-first** — 27 home-service verticals plus 8 professional/lead-gen ones; 32 of them have their own keyword seeds, CPC benchmarks, audience segments and funnel template
- 📊 **Account Health Score 0-100** — weighted across 6 dimensions (Tracking, Keywords, Budget, Creative, Targeting, Performance)
- 🔍 **Search term waste detection** — finds every dollar burning on zero-conversion terms
- 💡 **Diagnostic rollup** — 35+ rules from VibeAds' optimization engine, ranked by severity
- ✍️ **Write tools (Pro/Max)** — draft strategies, approve optimizations, and start publish flows through the VibeAds gateway
- 🔒 **Safe by design** — read tools can't modify anything; write tools run inside VibeAds' safety guardrails, and publishing always requires a human to approve in the browser
- ⚡ **No GAQL required** — ask questions in natural language, get markdown answers

---

## Supported categories

**Local & home services (27):** plumber · HVAC · electrician · roofer · cleaner · landscaper · pest control · painter · handyman · locksmith · garage door · appliance repair · tree service · fencing · windows & doors · carpet & flooring · waterproofing · pressure washing · air duct & dryer vent cleaning · commercial cleaning & janitorial · pool services · junk removal · movers · auto repair · Christmas lighting · dentist · lawyer

**Professional & lead-gen (8):** real estate · insurance · financial services · education · healthcare · consulting · SaaS · B2B services

Consulting, SaaS and B2B services use generic defaults, and so does any other category you pass, instead of a tuned knowledge base.

---

## Installation

> **Using ChatGPT, Claude or Meta AI?** You don't need this package or a key: add the hosted server, `https://getvibeads.com/api/mcp`, in the assistant and sign in to VibeAds when it asks. Steps for each assistant: [Connect ChatGPT, Claude or Meta AI](https://getvibeads.com/docs/integrations/ai-assistants). This package is for clients that run tools on your computer, such as Claude Code, Cursor and Cline.

### Step 1 — Get your API key

Sign in to your [VibeAds account](https://getvibeads.com) and generate an API key:

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

### Environment variables

Setup is one env var — every tool (read and write) runs through the secure server-side VibeAds gateway with your API key.

| Variable | Required? | Purpose |
|---|---|---|
| `VIBEADS_API_KEY` | ✅ Required | Your `vba_mcp_...` key. This is the only credential any tool needs. |
| `VIBEADS_SUPABASE_URL` | Optional | Override the VibeAds backend URL. Defaults to the production endpoint. |

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

### 📈 Reports for any period

> "Compare September with August for my Austin plumbing campaign"
>
> "Spend by device across my whole account last month"
>
> "Which keywords spent the most in the last 90 days?"

### 🔎 Keyword research

> "How many people search for drain cleaning in Austin, TX?"
>
> "Find keyword ideas from my services page for Round Rock and Pflugerville"

### 🧾 Audit a whole Google Ads account

Works right after you connect Google Ads, before anything is imported:

> "Where is my Google Ads budget being wasted?"
>
> "Audit my Google Ads account"

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

### Read tools

| Tool | Purpose |
|---|---|
| `list_campaigns` | Enumerate all campaigns with status, budget, category |
| `get_campaign_details` | Deep dive on one campaign: metrics, ad groups, targeting, landing pages, diagnostics |
| `get_account_health_score` | 0-100 score + letter grade across 6 dimensions, optionally per-campaign |
| `get_search_term_analysis` | Wasted spend + winners from each campaign's latest synced search terms, which cover the 7 days before that sync (configurable cost threshold) |
| `get_diagnostics` | Latest agent-optimize diagnostics with severity + recommended fix (up to 50) |
| `find_campaigns_to_import` | Before importing: the campaigns in your Google Ads account, read from Google Ads, each marked with whether it is in VibeAds (VibeAds manages only the campaigns in it). Called `list_google_ads_campaigns` in 0.2.15 |
| `get_performance_report` | One campaign's or a whole account's figures for a period you choose (a preset or two dates, up to 90 days), read live from Google Ads, optionally by day, device, hour, ad group, keyword or location. Money in the account's currency. VibeAds builds every query; the assistant only picks the period and the breakdown |
| `audit_google_ads_account` | An audit of one connected Google Ads account, read live from Google Ads: up to 25 Search campaigns over the last 30 days, whether or not they are in VibeAds, with a 0-100 health score and grade for the account and each campaign, the issues grouped by check with what fixes each in Google Ads, and each campaign's costliest search terms with clicks and no conversions. One audit per account is kept for 24 hours |
| `list_keywords` | One published campaign's ad groups, keywords and negative keywords, read live from Google Ads: match type, status, max CPC and 30 days of clicks, cost and conversions |
| `research_keywords` | Keyword ideas from Google's Keyword Planner for seed keywords, a web page or both, in the places you name: average monthly searches, competition and top-of-page bid range. Pro/Max, 2 credits (a repeat within 90 days is free) |
| `list_google_ads_accounts` | Every connected Google Ads account, switched on or not, with the manager account (MCC) each client account sits under |
| `list_google_recommendations` | Google's own recommendations for an account (its Recommendations page), with Google's estimate and whether each can be applied from the chat |

The read tools are **read-only**: they cannot create, modify, pause, or delete anything in your Google Ads account. They run server-side through the VibeAds gateway and need only `VIBEADS_API_KEY`. Read tools work on any plan, free tier included, except `research_keywords`, which needs Pro or Max.

### Write tools (Pro/Max)

Write tools talk to the secure server-side VibeAds gateway and need **only `VIBEADS_API_KEY`** — no Supabase keys. Every call is rate-limited per key, approved optimizations are measured afterwards (smaller changes roll back automatically if metrics worsen), and **publishing always requires a human approving in the browser**. The API key alone can never spend money.

| Tool | Purpose |
|---|---|
| `generate_strategy` | Draft a full campaign strategy (keywords, ad copy, 3+ ad groups) server-side. Costs 13 credits. Draft only — nothing is published, no money is spent |
| `get_strategy_status` | Poll a strategy job: status, phase, and drafted ad groups once complete |
| `apply_strategy` | Turn a completed preview into a real draft campaign (ad groups, keywords, targeting, ad copy, extensions). Costs 6 credits + 3 per ad group for image generation. Draft only — not live, no ad money spent |
| `list_recommendations` | Pending optimization recommendations awaiting approval, with the session + recommendation IDs |
| `approve_recommendation` | Execute ONE diagnosed optimization. Approving closes its session and rejects the other recommendations in it. A budget increase over 20% returns an approval link instead |
| `preview_ad_group` | Show a new ad group (keywords, three ads, landing page plan) before it is added. Creates a preview only |
| `add_ad_group` | Add a previewed ad group. On a published campaign it starts serving at once, within the campaign's budget |
| `request_publish` | Start the publish flow for a campaign that has ad groups — returns a human-approval URL because publishing spends real money. With more than one Google Ads account it asks which one, and publishes to that one only |
| `import_campaigns` | Bring up to 3 campaigns from your Google Ads account into VibeAds, so its optimizer and reports cover them. Nothing changes in Google Ads. 1 credit each |
| `pause_campaign` | Pause a live campaign in Google Ads |
| `resume_campaign` | Start a paused campaign again. Starting spends money, so with an API key it returns a human-approval URL, as publishing does |
| `add_negative_keywords` | Add up to 20 negative keywords to a campaign or one ad group, at once. One that would block the campaign's own keywords is left out |
| `add_keywords` | Add up to 20 keywords to one ad group, at once, at the ad group's default max CPC |
| `set_keyword_status` | Pause keywords, or turn paused ones back on |
| `set_max_cpc` | Set an ad group's or a keyword's max CPC on a Manual CPC campaign. Up to double and $50 a click at once; more returns an approval URL |
| `set_daily_budget` | Set a campaign's daily budget. A decrease runs at once; with an API key any increase returns an approval URL |
| `apply_google_recommendation` | Apply one of Google's recommendations within VibeAds' rules: budget changes up to +20% (from the lowest in the last 24 hours; never raised over an API key), exact or phrase keywords, and Google's ad text only when every line passes VibeAds' claim check. Up to 20 a day |
| `dismiss_google_recommendation` | Remove one of Google's recommendations from its list. No campaign changes |
| `check_approval` | Poll a publish or change approval: pending → approved → executing → executed (or rejected / expired / failed) |

Every keyword, bid, budget and restart change is listed on the campaign's Optimize tab in VibeAds, where it can be undone. VibeAds never rolls these back by itself. An assistant can make 20 changes to a campaign a day.

**From idea to live campaign:**

1. `generate_strategy` drafts the strategy server-side and returns a `jobId`. Nothing exists in Google Ads yet.
2. `get_strategy_status` polls that job until it reports `completed`.
3. `apply_strategy` turns the finished preview into a real **draft** campaign and returns a `campaignId`. Still not live, still spending nothing.
4. `request_publish` takes that `campaignId` and returns an approval link.
5. You open the link in your browser, review the campaign + budget, and click Approve (or Reject).
6. `check_approval` reports the approval and then the publish job; the campaign is live once that job completes.

Steps 1–3 create rows only in VibeAds and spend VibeAds credits (13 for step 1; 6 + 3 per ad group for step 3). Step 5 is the only point where **ad** money is committed, and it can only happen in a browser — the API key alone can never publish.

Assistants you connect by signing in to VibeAds instead of with a key (such as ChatGPT or claude.ai, through the hosted server at `https://getvibeads.com/api/mcp`) can publish a Search campaign without the link when you allow it up to a daily budget, in VibeAds Settings under Connected apps. They confirm each campaign's daily budget with you first. API keys never can, so a leaked key still cannot spend.

---

## Security

- **Read tools are read-only.** They cannot mutate your campaigns, your Google Ads account, or your VibeAds settings.
- **Write tools are guarded.** Every write action runs server-side through the VibeAds gateway, rate-limited per key. Approved optimizations are measured afterwards, smaller changes roll back automatically if metrics worsen, and publishing always requires a human approving in the browser. The API key can never approve ad spend by itself.
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
- **Pro or Max plan** — required for the write tools (read tools work on any plan)
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
| Guarded write actions | ✅ human-approved publish | ❌ | ❌ |

**When to use VibeAds MCP:** You run a local service business (or manage ads for one) and want pre-tuned insights without learning GAQL.

**When to use GoMarble / Google Ads MCP:** You need to run custom GAQL queries or work with non-service-business campaigns (e-commerce, B2B SaaS, etc.).

The three can coexist — install whichever ones fit your workflow.

---

## Troubleshooting

### "Authentication failed"

- Make sure your key starts with `vba_mcp_`
- Generate a new key at https://getvibeads.com/app/settings/mcp
- Check that the key hasn't been revoked or expired

### "No optimizer diagnoses yet"

Diagnostics are generated every 12 hours by the VibeAds agent, once Google Ads performance has synced. If you just published a campaign, allow up to a day for the first run.

### "No search term data found"

Search term sync runs every 6 hours. For new campaigns, allow 24-48 hours for meaningful data to accumulate.

### MCP client can't find the server

Make sure you have Node.js 20+ installed: `node --version`. Claude Desktop and Cursor both shell out to `npx`, so Node must be in your PATH.

---

## Contributing

This is an open-source MIT package. Issues and PRs welcome at:
**https://github.com/vibeads/mcp/issues**

---

## License

MIT © [VibeAds](https://getvibeads.com)
