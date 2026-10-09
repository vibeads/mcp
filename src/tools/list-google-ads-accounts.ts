/**
 * Tool: list_google_ads_accounts
 *
 * Every Google Ads account connected to the user's VibeAds account, switched
 * on or not, with the manager account (MCC) each client account is reached
 * through. Agencies connect with their manager login, and VibeAds lists the
 * client accounts under it (Oct 2026); this is how an assistant sees which
 * client is which before it reads, imports or publishes.
 *
 * Example prompt: "Which client accounts do I have connected?"
 */

import { z } from "zod";
import { callGateway } from "../gateway.js";

export const listGoogleAdsAccountsSchema = z.object({});

export type ListGoogleAdsAccountsInput = z.infer<typeof listGoogleAdsAccountsSchema>;

interface ConnectedAccount {
  customerId: string;
  name: string | null;
  inUse: boolean;
  isDefault: boolean;
  managerAccount?: { customerId: string; name: string | null };
}

interface ListGoogleAdsAccountsResult {
  accounts: ConnectedAccount[];
  managerAccounts: Array<{ customerId: string; name: string | null; clientAccounts: number }>;
  note: string;
}

export async function listGoogleAdsAccounts(input: ListGoogleAdsAccountsInput): Promise<string> {
  const data = await callGateway<ListGoogleAdsAccountsResult>("list_google_ads_accounts", input);
  const lines = ["**Google Ads accounts connected to VibeAds**", ""];
  for (const a of data.accounts) {
    const flags = [a.isDefault ? "default" : null, a.inUse ? "switched on" : "switched off"].filter(Boolean).join(", ");
    const under = a.managerAccount
      ? `, under manager account ${a.managerAccount.name ?? a.managerAccount.customerId}`
      : "";
    lines.push(`- **${a.name ?? "Unnamed"}** (${a.customerId})${under}: ${flags}`);
  }
  if (data.managerAccounts.length > 0) {
    lines.push("", "**Manager accounts**");
    for (const m of data.managerAccounts) {
      lines.push(`- ${m.name ?? "Unnamed"} (${m.customerId}): ${m.clientAccounts} client account(s) connected`);
    }
  }
  lines.push("", data.note);
  return lines.join("\n");
}
