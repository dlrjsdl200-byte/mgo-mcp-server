# MGO MCP Server

MCP (Model Context Protocol) server for **MGO - Multi-chain Gas Optimizer**.

Compare real-time gas prices across up to 9 EVM chains and get cheapest chain recommendations for AI agents.

## Install via Smithery

```bash
npx @smithery/cli install @dlrjsdl200-byte/mgo-mcp-server --client claude
```

## Tools

| Tool | Description | Cost |
|------|-------------|------|
| `get_gas_demo` | 4-chain gas prices (free, rate limited 10/hr) | Free |
| `get_cheapest_chain` | Direct cheapest chain + savings % | Free |
| `get_gas_basic` | 4-chain comparison with recommendation | $0.001 USDC |
| `get_gas_premium` | 9-chain full comparison | $0.002 USDC |

## Chains Covered

**Basic (4 chains):** Ethereum, Base, Arbitrum, Optimism

**Premium (9 chains):** + BNB Chain, Polygon, Avalanche, zkSync Era, Hyperliquid

## Payment

Paid endpoints use [x402 protocol](https://x402.org) on Base network (USDC).
No API key — pay per call with any EVM wallet.

## Links

- API: https://api.mgo.chain-ops.xyz
- Dashboard: https://mgo.chain-ops.xyz
- Homepage: https://chain-ops.xyz
