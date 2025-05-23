# MCP Bridge Testing

## Fixtures

### Client

For the test client, we use the standard MCP client / transports from the TypesScript SDK: https://github.com/modelcontextprotocol/typescript-sdk?tab=readme-ov-file#writing-mcp-clients

These save us some work, and also guarantees compatability (including bug compatability) with most client apps.

### Server

We use `everything` as our main test server fixture: https://github.com/modelcontextprotocol/servers/tree/main/src/everything
- We run it as:
  - *stdio* (default)
  - *sse* using arg: "sse" (port specified by PORT env var)
  - *streamable* using arg: "streamableHttp" (port specified by PORT env var)
  - *stdio-container*: mcp/everything
- We install @modelcontextprotocol/server-everything as a dev dependency and use that local code testing (except for the container version)
- We use its `echo` tool for our tests

## Source-Target Permutations

| Verified | Source Mode | Target Mode | Description |
|----------|-------------|-------------|-------------|
| ✅ | stdio | stdio | Direct stdio to stdio bridge |
| ✅ | stdio | sse | Bridge stdio source to SSE endpoint |
| ✅ | stdio | streamable | Bridge stdio source to streamable endpoint |
| ✅ | stdio | stdio-container | Bridge stdio source to containerized stdio endpoint |
| ✅ | sse | stdio | Bridge SSE source to stdio endpoint |
| ✅ | sse | sse | Direct SSE to SSE bridge |
| ✅ | sse | streamable | Bridge SSE source to streamable endpoint |
| ✅ | sse | stdio-container | Bridge SSE source to containerized stdio endpoint |
| ✅ | streamable | stdio | Bridge streamable source to stdio endpoint |
| ✅ | streamable | sse | Bridge streamable source to SSE endpoint |
| ✅ | streamable | streamable | Direct streamable to streamable bridge |
| ✅ | streamable | stdio-container | Bridge streamable source to containerized stdio endpoint |
