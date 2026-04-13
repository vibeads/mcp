/**
 * Supabase client factory + API key validation
 *
 * Uses the SERVICE_ROLE key for validation + data reads. Row-level
 * security is enforced at the application level by scoping every query
 * to the authenticated user_id returned from validate_mcp_api_key().
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { createHash } from "node:crypto";

const SUPABASE_URL = process.env.VIBEADS_SUPABASE_URL || "https://qjchjmsgrbtjwbpvuhrb.supabase.co";
const SERVICE_ROLE_KEY = process.env.VIBEADS_SUPABASE_SERVICE_KEY;
const ANON_KEY = process.env.VIBEADS_SUPABASE_ANON_KEY;

// We prefer service role for the MCP server since it runs locally under
// the user's control and needs to validate + query across multiple tables.
// Fall back to the anon key if the user prefers not to provide service role
// (functional but slower since RLS adds overhead).
const ACTIVE_KEY = SERVICE_ROLE_KEY || ANON_KEY;

export function getSupabaseClient(): SupabaseClient {
  if (!ACTIVE_KEY) {
    throw new Error(
      "Missing Supabase key. Set VIBEADS_SUPABASE_SERVICE_KEY (preferred) or VIBEADS_SUPABASE_ANON_KEY in your MCP client config.",
    );
  }
  return createClient(SUPABASE_URL, ACTIVE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/**
 * Hash an API key with SHA-256 (matches the storage format in mcp_api_keys.key_hash).
 */
export function hashApiKey(rawKey: string): string {
  return createHash("sha256").update(rawKey).digest("hex");
}

export interface AuthenticatedSession {
  userId: string;
  keyId: string;
}

/**
 * Resolve the API key from environment and validate it against the database.
 * Returns the authenticated session or throws a clear error.
 */
export async function authenticate(): Promise<AuthenticatedSession> {
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

  const keyHash = hashApiKey(rawKey);
  const supabase = getSupabaseClient();

  const { data, error } = await supabase.rpc("validate_mcp_api_key", {
    p_key_hash: keyHash,
  });

  if (error) {
    throw new Error(`API key validation failed: ${error.message}`);
  }

  if (!data || data.length === 0) {
    throw new Error(
      "API key is invalid, expired, or revoked. Generate a new key at https://getvibeads.com/app/settings/mcp",
    );
  }

  return {
    userId: data[0].user_id as string,
    keyId: data[0].key_id as string,
  };
}
