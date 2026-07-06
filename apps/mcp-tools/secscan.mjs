#!/usr/bin/env node
/*
  occa-secscan — token & address security scanner, spoken as an MCP stdio server.

  Zero-dependency on purpose: the gateway box runs this file directly
  (`node secscan.mjs` in an agent's .mcp.json), no install step. The MCP wire
  protocol is implemented by hand — newline-delimited JSON-RPC 2.0 over stdio
  with initialize / tools/list / tools/call — which is all a stdio server needs.

  Data sources (all free + keyless; limits are generous vs chat volume):
    - GoPlus  token_security (EVM), solana/token_security, address_security
    - honeypot.is IsHoneypot — real buy/sell simulation (ETH / BSC / Base)
    - rugcheck.xyz report summary — Solana risk score + LP lock

  Responses are trimmed to the security-relevant fields: GoPlus raw payloads
  carry full holder arrays that would drown the model in tokens.
*/

import { createInterface } from "node:readline";

const GOPLUS = "https://api.gopluslabs.io/api/v1";
const HONEYPOT = "https://api.honeypot.is/v2/IsHoneypot";
const RUGCHECK = "https://api.rugcheck.xyz/v1";

const EVM_CHAINS = {
  ethereum: "1",
  bsc: "56",
  polygon: "137",
  base: "8453",
  arbitrum: "42161",
  optimism: "10",
  avalanche: "43114",
  linea: "59144",
  scroll: "534352",
  blast: "81457",
  gnosis: "100",
  fantom: "250",
  mantle: "5000",
  zksync: "324",
  opbnb: "204",
  cronos: "25",
};

// honeypot.is simulates on a narrower set than GoPlus covers.
const HONEYPOT_CHAINS = { ethereum: "1", bsc: "56", base: "8453" };

async function getJson(url) {
  const res = await fetch(url, {
    signal: AbortSignal.timeout(15_000),
    headers: { accept: "application/json" },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} from ${new URL(url).host}`);
  return res.json();
}

/** GoPlus wraps everything in { code, message, result }; 1 means OK. */
async function goplus(path) {
  const body = await getJson(`${GOPLUS}${path}`);
  if (body.code !== 1) throw new Error(`GoPlus: ${body.message ?? `code ${body.code}`}`);
  return body.result;
}

/** GoPlus percent fields are 0–1 fraction strings; render as a % number. */
const asPct = (v) => Math.round(Number(v || 0) * 10000) / 100;

const sumPct = (rows = []) => asPct(rows.reduce((a, h) => a + Number(h?.percent || 0), 0));

const lockedPct = (rows = []) =>
  asPct(
    rows
      .filter((h) => String(h?.is_locked) === "1" || h?.tag === "burn")
      .reduce((a, h) => a + Number(h?.percent || 0), 0),
  );

function requireChain(map, chain, label) {
  const id = map[String(chain || "").toLowerCase()];
  if (!id) {
    throw new Error(`unsupported ${label} chain "${chain}" — pick one of: ${Object.keys(map).join(", ")}`);
  }
  return id;
}

/* ---------------------------------------------------------------- tools -- */

async function evmTokenSecurity({ chain, address }) {
  const chainId = requireChain(EVM_CHAINS, chain, "EVM");
  const result = await goplus(
    `/token_security/${chainId}?contract_addresses=${encodeURIComponent(address)}`,
  );
  const t = result?.[String(address).toLowerCase()];
  if (!t) throw new Error("GoPlus has no data for this address on that chain — wrong chain or not a token contract?");

  const flags = {};
  for (const key of [
    "is_open_source", "is_proxy", "is_mintable", "is_honeypot",
    "honeypot_with_same_creator", "transfer_pausable", "cannot_buy",
    "cannot_sell_all", "slippage_modifiable", "personal_slippage_modifiable",
    "is_blacklisted", "is_whitelisted", "is_anti_whale", "anti_whale_modifiable",
    "trading_cooldown", "selfdestruct", "external_call", "gas_abuse",
    "can_take_back_ownership", "hidden_owner", "owner_change_balance",
    "is_airdrop_scam", "is_true_token", "fake_token",
  ]) {
    if (t[key] !== undefined) flags[key] = t[key];
  }

  return {
    token: { name: t.token_name, symbol: t.token_symbol },
    holder_count: t.holder_count,
    total_supply: t.total_supply,
    buy_tax: t.buy_tax,
    sell_tax: t.sell_tax,
    flags,
    ownership: {
      owner_address: t.owner_address,
      owner_percent: asPct(t.owner_percent),
      creator_address: t.creator_address,
      creator_percent: asPct(t.creator_percent),
    },
    concentration: { top10_holder_percent: sumPct(t.holders?.slice(0, 10)) },
    liquidity: {
      dex: (t.dex ?? []).map((d) => ({ name: d.name, liquidity_usd: Number(d.liquidity) })),
      lp_holder_count: t.lp_holder_count,
      lp_locked_or_burned_percent: lockedPct(t.lp_holders),
    },
    trust_list: t.trust_list,
    note: t.note,
  };
}

async function evmHoneypotCheck({ chain, address }) {
  const chainId = requireChain(HONEYPOT_CHAINS, chain, "honeypot-simulation");
  const r = await getJson(
    `${HONEYPOT}?address=${encodeURIComponent(address)}&chainID=${chainId}`,
  );
  return {
    token: r.token && { name: r.token.name, symbol: r.token.symbol, holders: r.token.totalHolders },
    simulation_success: r.simulationSuccess,
    is_honeypot: r.honeypotResult?.isHoneypot,
    honeypot_reason: r.honeypotResult?.honeypotReason,
    risk: r.summary && { level: r.summary.risk, flags: r.summary.flags },
    taxes: r.simulationResult && {
      buy_tax: r.simulationResult.buyTax,
      sell_tax: r.simulationResult.sellTax,
      transfer_tax: r.simulationResult.transferTax,
    },
    holder_analysis: r.holderAnalysis && {
      holders_simulated: r.holderAnalysis.holders,
      failed_sells: r.holderAnalysis.failed,
      siphoned: r.holderAnalysis.siphoned,
    },
  };
}

async function solanaTokenReport({ mint }) {
  const enc = encodeURIComponent(mint);
  // Two independent reads — degrade to whichever answered rather than failing both.
  const [gp, rc] = await Promise.allSettled([
    goplus(`/solana/token_security?contract_addresses=${enc}`),
    getJson(`${RUGCHECK}/tokens/${enc}/report/summary`),
  ]);

  let goplusView = null;
  if (gp.status === "fulfilled" && gp.value?.[mint]) {
    const t = gp.value[mint];
    const authority = (a) => (a ? { status: a.status, authority: a.authority } : undefined);
    goplusView = {
      metadata: t.metadata && { name: t.metadata.name, symbol: t.metadata.symbol },
      holder_count: t.holder_count,
      total_supply: t.total_supply,
      authorities: {
        mintable: authority(t.mintable),
        freezable: authority(t.freezable),
        closable: authority(t.closable),
        balance_mutable: authority(t.balance_mutable_authority),
        metadata_mutable: authority(t.metadata_mutable),
      },
      transfer_fee: t.transfer_fee,
      transfer_hook: Array.isArray(t.transfer_hook) ? t.transfer_hook.length : t.transfer_hook,
      non_transferable: t.non_transferable,
      default_account_state: t.default_account_state,
      trusted_token: t.trusted_token,
      concentration: { top10_holder_percent: sumPct(t.holders?.slice(0, 10)) },
      dex: (t.dex ?? []).map((d) => ({
        name: d.dex_name,
        burn_percent: d.burn_percent,
        day_volume: d.day?.volume,
      })),
    };
  }

  const rugcheckView = rc.status === "fulfilled" ? rc.value : null;
  if (!goplusView && !rugcheckView) {
    throw new Error(
      `both sources failed — GoPlus: ${gp.reason?.message ?? "no data"}; rugcheck: ${rc.reason?.message ?? "no data"}`,
    );
  }
  return {
    goplus: goplusView ?? `unavailable (${gp.status === "rejected" ? gp.reason?.message : "no data"})`,
    rugcheck: rugcheckView ?? `unavailable (${rc.reason?.message ?? "no data"})`,
  };
}

async function addressReputation({ address, chain }) {
  const chainId = EVM_CHAINS[String(chain || "ethereum").toLowerCase()] ?? "1";
  const result = await goplus(
    `/address_security/${encodeURIComponent(address)}?chain_id=${chainId}`,
  );
  const raised = {};
  for (const [key, value] of Object.entries(result ?? {})) {
    if (value === "1") raised[key] = true;
  }
  return {
    address,
    risk_flags: Object.keys(raised).length > 0 ? raised : "none — no malicious-address intelligence on record",
    data_source: result?.data_source || undefined,
  };
}

/* ------------------------------------------------------------- protocol -- */

const TOOLS = [
  {
    name: "evm_token_security",
    description:
      "Full GoPlus security profile for an EVM token contract: honeypot/mint/blacklist/tax flags, ownership, holder concentration, LP lock. Chains: " +
      Object.keys(EVM_CHAINS).join(", "),
    inputSchema: {
      type: "object",
      properties: {
        chain: { type: "string", description: "chain name, e.g. ethereum, base, bsc" },
        address: { type: "string", description: "token contract address (0x…)" },
      },
      required: ["chain", "address"],
    },
    handler: evmTokenSecurity,
  },
  {
    name: "evm_honeypot_check",
    description:
      "Simulate an actual buy+sell of an EVM token via honeypot.is — catches tokens you can buy but never sell, and measures real taxes. Chains: ethereum, bsc, base.",
    inputSchema: {
      type: "object",
      properties: {
        chain: { type: "string", description: "ethereum, bsc, or base" },
        address: { type: "string", description: "token contract address (0x…)" },
      },
      required: ["chain", "address"],
    },
    handler: evmHoneypotCheck,
  },
  {
    name: "solana_token_report",
    description:
      "Security report for a Solana mint from two sources: GoPlus (mint/freeze/close authorities, holders, dex) and rugcheck.xyz (risk list, normalized 0-10 score, LP locked %).",
    inputSchema: {
      type: "object",
      properties: { mint: { type: "string", description: "SPL token mint address" } },
      required: ["mint"],
    },
    handler: solanaTokenReport,
  },
  {
    name: "address_reputation",
    description:
      "Check a wallet/deployer address against GoPlus malicious-address intelligence: phishing, cybercrime, mixer, sanctions, honeypot-related deployments, and similar flags.",
    inputSchema: {
      type: "object",
      properties: {
        address: { type: "string", description: "address to screen (0x…)" },
        chain: { type: "string", description: "EVM chain name, default ethereum" },
      },
      required: ["address"],
    },
    handler: addressReputation,
  },
];

const reply = (id, result) =>
  process.stdout.write(`${JSON.stringify({ jsonrpc: "2.0", id, result })}\n`);
const replyError = (id, code, message) =>
  process.stdout.write(`${JSON.stringify({ jsonrpc: "2.0", id, error: { code, message } })}\n`);

async function handle(msg) {
  const { id, method, params } = msg;
  // Notifications (no id) get no response, per JSON-RPC.
  if (id === undefined || id === null) return;

  switch (method) {
    case "initialize":
      return reply(id, {
        protocolVersion: params?.protocolVersion ?? "2025-06-18",
        capabilities: { tools: {} },
        serverInfo: { name: "occa-secscan", version: "0.1.0" },
      });
    case "ping":
      return reply(id, {});
    case "tools/list":
      return reply(id, {
        tools: TOOLS.map(({ name, description, inputSchema }) => ({
          name,
          description,
          inputSchema,
        })),
      });
    case "tools/call": {
      const tool = TOOLS.find((t) => t.name === params?.name);
      if (!tool) return replyError(id, -32602, `unknown tool: ${params?.name}`);
      try {
        const result = await tool.handler(params?.arguments ?? {});
        return reply(id, {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        });
      } catch (err) {
        return reply(id, {
          content: [{ type: "text", text: `Scan failed: ${err?.message ?? String(err)}` }],
          isError: true,
        });
      }
    }
    default:
      return replyError(id, -32601, `method not found: ${method}`);
  }
}

// Exit only after every in-flight handler has replied — a piped stdin closes
// the moment the last line is written, while tool calls are still fetching.
let inFlight = 0;
let stdinClosed = false;
const maybeExit = () => {
  if (stdinClosed && inFlight === 0) process.exit(0);
};

const rl = createInterface({ input: process.stdin });
rl.on("line", (line) => {
  const trimmed = line.trim();
  if (!trimmed) return;
  let msg;
  try {
    msg = JSON.parse(trimmed);
  } catch {
    return; // not JSON — ignore, never crash the transport
  }
  inFlight += 1;
  void handle(msg)
    .catch((err) => {
      if (msg.id !== undefined && msg.id !== null) {
        replyError(msg.id, -32603, err?.message ?? "internal error");
      }
    })
    .finally(() => {
      inFlight -= 1;
      maybeExit();
    });
});
rl.on("close", () => {
  stdinClosed = true;
  maybeExit();
});
