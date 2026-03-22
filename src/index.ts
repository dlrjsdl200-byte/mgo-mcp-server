#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

const MGO_API_BASE = "https://api.mgo.chain-ops.xyz";

const TOOLS = [
  {
    name: "get_gas_demo",
    description:
      "Get free real-time gas prices for 4 major EVM chains (Ethereum, Base, Arbitrum, Optimism). " +
      "Rate limited to 10 requests/hour. Use this for a quick overview without payment.",
    inputSchema: { type: "object", properties: {}, required: [] },
  },
  {
    name: "get_cheapest_chain",
    description:
      "Get a direct recommendation for the cheapest EVM chain right now. " +
      "Returns the winner chain and how much you save vs the most expensive option. Free (rate limited).",
    inputSchema: { type: "object", properties: {}, required: [] },
  },
  {
    name: "get_gas_basic",
    description:
      "Get 4-chain EVM gas comparison with cheapest chain recommendation and savings calculation. " +
      "Chains: Ethereum, Base, Arbitrum, Optimism. Cost: $0.001 USDC via x402 on Base.",
    inputSchema: { type: "object", properties: {}, required: [] },
  },
  {
    name: "get_gas_premium",
    description:
      "Get full 9-chain EVM gas comparison. " +
      "Chains: Ethereum, Base, Arbitrum, Optimism, BNB, Polygon, Avalanche, zkSync Era, Hyperliquid. " +
      "Cost: $0.002 USDC via x402 on Base.",
    inputSchema: { type: "object", properties: {}, required: [] },
  },
];

async function fetchDemo(): Promise<any> {
  const res = await fetch(`${MGO_API_BASE}/gas/demo`);
  if (!res.ok) throw new Error(`MGO demo API error: ${res.status}`);
  return res.json();
}

async function fetchPaid(endpoint: string): Promise<any> {
  const res = await fetch(`${MGO_API_BASE}${endpoint}`);
  if (res.status === 402) {
    const info = await res.json().catch(() => ({}));
    return {
      _requires_payment: true,
      price: endpoint === "/gas/basic" ? "$0.001 USDC" : "$0.002 USDC",
      network: "Base (eip155:8453)",
      token: "USDC",
      payment_challenge: info,
      message:
        `Payment required: ${endpoint === "/gas/basic" ? "$0.001" : "$0.002"} USDC on Base network. ` +
        "This is an x402 pay-per-call endpoint. Use an x402-compatible wallet agent to pay automatically.",
    };
  }
  if (!res.ok) throw new Error(`MGO API error: ${res.status}`);
  return res.json();
}

function formatGasData(data: any): string {
  if (!data?.chains) return JSON.stringify(data, null, 2);
  const lines: string[] = [];

  if (data.recommendation) {
    const r = data.recommendation;
    lines.push(`🏆 CHEAPEST: ${r.cheapestChain}`);
    lines.push(`   DEX swap: $${r.estimatedCostsUsdc?.dexSwap} USDC`);
    if (r.vsExpensive) {
      lines.push(`   vs ${r.vsExpensive.chain}: saves ${r.vsExpensive.savingsPercent}`);
    }
    lines.push(`   → ${r.action}`);
    lines.push("");
  }

  lines.push(`⛽ GAS PRICES (${(data.tier || "demo").toUpperCase()}):`);
  const sorted = [...data.chains].sort(
    (a: any, b: any) =>
      parseFloat(a.gasPrice?.baseFeeGwei || "999") -
      parseFloat(b.gasPrice?.baseFeeGwei || "999")
  );
  for (const c of sorted) {
    const gwei = c.gasPrice?.baseFeeGwei || "?";
    const cost = c.estimatedCosts?.dexSwap?.usdc;
    lines.push(
      `   ${c.chain.padEnd(14)} ${String(gwei).padStart(10)} gwei` +
        (cost !== undefined ? `  |  DEX: $${cost}` : "")
    );
  }
  lines.push("");
  lines.push(`Updated: ${data.timestamp} (${data.totalLatencyMs}ms)`);
  return lines.join("\n");
}

const server = new Server(
  { name: "mgo-gas-optimizer", version: "1.0.0" },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name } = request.params;
  try {
    switch (name) {
      case "get_gas_demo": {
        const data = await fetchDemo();
        return { content: [{ type: "text", text: formatGasData(data) }] };
      }
      case "get_cheapest_chain": {
        const data = await fetchDemo();
        if (!data?.chains?.length) {
          return { content: [{ type: "text", text: "No chain data available" }] };
        }
        const sorted = [...data.chains].sort(
          (a: any, b: any) =>
            parseFloat(a.gasPrice?.baseFeeGwei || "999") -
            parseFloat(b.gasPrice?.baseFeeGwei || "999")
        );
        const cheap = sorted[0];
        const exp = sorted[sorted.length - 1];
        const cc = cheap.estimatedCosts?.dexSwap?.usdc || 0;
        const ec = exp.estimatedCosts?.dexSwap?.usdc || 0;
        const savings = ec > 0 ? ((1 - cc / ec) * 100).toFixed(1) : "99.8";
        return {
          content: [{
            type: "text",
            text:
              `🏆 Cheapest EVM chain: **${cheap.chain}**\n` +
              `   ${cheap.gasPrice?.baseFeeGwei} gwei  |  DEX swap $${cc} USDC\n\n` +
              `   vs ${exp.chain}: $${ec} USDC  →  saves ${savings}%\n\n` +
              `   For all 9 chains: use get_gas_premium ($0.002 USDC)`,
          }],
        };
      }
      case "get_gas_basic": {
        const data = await fetchPaid("/gas/basic");
        return {
          content: [{
            type: "text",
            text: data._requires_payment ? JSON.stringify(data, null, 2) : formatGasData(data),
          }],
        };
      }
      case "get_gas_premium": {
        const data = await fetchPaid("/gas/premium");
        return {
          content: [{
            type: "text",
            text: data._requires_payment ? JSON.stringify(data, null, 2) : formatGasData(data),
          }],
        };
      }
      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return { content: [{ type: "text", text: `Error: ${msg}` }], isError: true };
  }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("MGO MCP Server running on stdio");
}

main().catch((e) => { console.error("Fatal:", e); process.exit(1); });
