# TeamSpark MCP Bridge TODO

## Session Termination

We need a mechanism for the proxied MCP server to terminate its current session.

For example, if the stdio process exits, or a stdio-container container shuts down, we need a way to notify
the session bridge, and for the session bridge to notify the server and terminate the session.

## Testing

We need to define test cases (maybe or maybe not automated depending on practicality) for each permutation.

### MCP Bridge Source-Target Permutations

| Verified | Source Mode | Target Mode | Description |
|----------|-------------|-------------|-------------|
| ❌ | stdio | stdio | Direct stdio to stdio bridge |
| ❌ | stdio | sse | Bridge stdio source to SSE endpoint |
| ❌ | stdio | streamable | Bridge stdio source to streamable endpoint |
| ✅ | stdio | stdio-container | Bridge stdio source to containerized stdio endpoint |
| ❌ | sse | stdio | Bridge SSE source to stdio endpoint |
| ❌ | sse | sse | Direct SSE to SSE bridge |
| ❌ | sse | streamable | Bridge SSE source to streamable endpoint |
| ✅ | sse | stdio-container | Bridge SSE source to containerized stdio endpoint |
| ❌ | streamable | stdio | Bridge streamable source to stdio endpoint |
| ❌ | streamable | sse | Bridge streamable source to SSE endpoint |
| ❌ | streamable | streamable | Direct streamable to streamable bridge |
| ❌ | streamable | stdio-container | Bridge streamable source to containerized stdio endpoint |

## Fixtures

## Client

For the test client, we can just use the standard MCP client / transports from the TypesScript SDK: https://github.com/modelcontextprotocol/typescript-sdk?tab=readme-ov-file#writing-mcp-clients

### Server

We can use `everything` as our main test server fixture: https://github.com/modelcontextprotocol/servers/tree/main/src/everything
- It can be run as:
  - *stdio* (default)
  - *sse* using arg: "sse" (port specified by PORT env var)
  - *streamable* using arg: "streamableHttp" (port specified by PORT env var)
  - *stdio-container*: mcp/everything
- It has an `echo` tool that we can use to test
- We can install @modelcontextprotocol/server-everything as a dev dependency and use that version for testing
