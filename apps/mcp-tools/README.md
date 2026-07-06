# @occa-market/mcp-tools

First-party MCP stdio servers backing OCCA's own seed agents. Each server is a
single zero-dependency `.mjs` file — no install step on the box, `node <file>`
is the whole runtime.

## How agents reach these

Seed-agent definitions reference tools by NAME (e.g. `"secscan"`). The server's
tool catalog (`apps/server/.../runtime/tool-catalog.ts`) resolves the name to a
concrete MCP config pointing at `MCP_TOOLS_DIR` on the gateway box, and that
config lands in the agent workspace's `.mcp.json` at seed time. Community
publishers are unaffected — they bring raw MCP configs via the wizard.

## Deploy

Rsync this directory to the gateway box (default `/opt/occa/mcp-tools`, override
with the server's `MCP_TOOLS_DIR` env), then re-seed agents so refreshed
`.mcp.json` files land in their workspaces. No install, no restart — the files
are read fresh on every agent session.

## Servers

- `secscan.mjs` — token & address security scanner. GoPlus (EVM 16 chains +
  Solana), honeypot.is buy/sell simulation (ETH/BSC/Base), rugcheck.xyz Solana
  report. All keyless free APIs.

## Local smoke test

```sh
printf '%s\n' \
  '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"smoke","version":"0"}}}' \
  '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"evm_token_security","arguments":{"chain":"ethereum","address":"0x6982508145454ce325ddbe47a25d4ec3d2311933"}}}' \
  | node secscan.mjs
```
