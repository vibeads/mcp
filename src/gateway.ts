/**
 * VibeAds gateway client — powers ALL tools (read + write/workflow).
 *
 * Every tool talks to a server-side Edge Function gateway. The only
 * credential required is the user's VIBEADS_API_KEY, sent as an
 * `x-vibeads-api-key` header. The gateway validates the key, enforces
 * tier limits + safety guardrails, and executes the action server-side
 * — no Supabase keys ever live in the client config.
 *
 * Contract:
 *   POST {SUPABASE_URL}/functions/v1/mcp-gateway
 *   Body:    { "action": string, "params": object }
 *   Success: HTTP 200  { ok: true, data: {...} }
 *   Failure: 4xx/5xx   { ok: false, error: string, message?: string }
 */

const GATEWAY_BASE_URL =
  process.env.VIBEADS_SUPABASE_URL || "https://qjchjmsgrbtjwbpvuhrb.supabase.co";

const GATEWAY_ENDPOINT = `${GATEWAY_BASE_URL}/functions/v1/mcp-gateway`;

/** 120s — strategy generation and publish execution can take a while. */
const REQUEST_TIMEOUT_MS = 120_000;

/**
 * Validate VIBEADS_API_KEY presence + format and return the raw key.
 * The key itself is validated server-side by the gateway on every call.
 */
export function requireApiKey(): string {
  const rawKey = process.env.VIBEADS_API_KEY;
  if (!rawKey) {
    throw new Error(
      "Missing VIBEADS_API_KEY. Generate one at https://getvibeads.com/app/settings/mcp and add it to your MCP client config.",
    );
  }

  if (!rawKey.startsWith("vba_mcp_")) {
    throw new Error(
      'Invalid VIBEADS_API_KEY format. Keys should start with "vba_mcp_". Generate a new one at https://getvibeads.com/app/settings/mcp',
    );
  }

  return rawKey;
}

interface GatewayEnvelope<T> {
  ok?: boolean;
  data?: T;
  error?: string;
  message?: string;
}

/**
 * Call the mcp-gateway Edge Function with an action + params.
 * Returns the `data` payload on success; throws a clear Error (using the
 * gateway's `message || error` text) on any failure.
 */
export async function callGateway<T>(
  action: string,
  params: object,
): Promise<T> {
  const apiKey = requireApiKey();

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let status = 0;
  let rawBody = "";
  try {
    const res = await fetch(GATEWAY_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-vibeads-api-key": apiKey,
      },
      body: JSON.stringify({ action, params }),
      signal: controller.signal,
    });
    status = res.status;
    rawBody = await res.text();
  } catch (err) {
    const name = (err as { name?: string } | null)?.name;
    if (name === "AbortError" || name === "TimeoutError") {
      throw new Error(
        `VibeAds gateway request timed out after ${REQUEST_TIMEOUT_MS / 1000}s (action: ${action}). The server may still be processing — retry, or poll the matching status tool.`,
      );
    }
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(
      `Could not reach the VibeAds gateway (action: ${action}): ${message}`,
    );
  } finally {
    clearTimeout(timeout);
  }

  let envelope: GatewayEnvelope<T>;
  try {
    envelope = JSON.parse(rawBody) as GatewayEnvelope<T>;
  } catch {
    throw new Error(
      `VibeAds gateway returned a non-JSON response (HTTP ${status}) for action "${action}": ${rawBody.slice(0, 200)}`,
    );
  }

  if (status < 200 || status >= 300 || envelope.ok !== true) {
    throw new Error(
      envelope.message ||
        envelope.error ||
        `VibeAds gateway request failed (HTTP ${status}) for action "${action}".`,
    );
  }

  return envelope.data as T;
}
