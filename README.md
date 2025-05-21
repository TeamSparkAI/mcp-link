# MCP Bridge

MCP Bridge allows you to present any MCP server endpoint (stdio, sse, or streamable), and bridge it to any other server endpoint (stdio, sse, streamable, or a container).

When the target MCP server is stdio-container, an ephemeral Docker container will be spun up per MCP session and removed at the end of the session.

![MCP Bridge](./assets/bridge.png)

## Development

This project uses Node.js and the Commander package for CLI functionality.

### Prerequisites

- Node.js (v14 or higher)
- npm

## Installation

### Local Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/mcp-bridge.git
cd mcp-bridge

# Install dependencies
npm install
```

### Global Installation

To use MCP Bridge from anywhere in your system:

```bash
npm install -g .
```

### Running Without Installation

You can also run MCP Bridge directly without installing:

```bash
# Using npm
npm start -- <params>

# Or using node directly
node src/index.js -- <params>
```

## Usage

Usage: mcpbridge [options]

TeamSpark AI MCP Bridge

Options:
  --serverMode <mode>  Server mode (sse, stdio, streamable) (default: "stdio")
  --clientMode <mode>  Client mode (stdio, sse, streamable, stdio-container) (default: "stdio-container")
  --port <number>      Server port (default: "3000")
  --host <string>      Server host (default: "localhost")
  --image <string>     Client container image
  --endpoint <string>  Client endpoint
  --command <string>   Client command
  --env <value>        Environment variable (key=value) (default: [])
  --volume <value>     Volume mapping (default: [])
  -h, --help           display help for command

Examples:
  $ mcpbridge --serverMode=stdio --clientMode=stdio-container --image=mcp/fetch
  $ mcpbridge --image=mcp/fetch
  $ mcpbridge --serverMode=sse --port=8080 --image=mcp/fetch
  $ mcpbridge --serverMode=streamable --clientMode=stdio --command=npx mcp-fetch

## License

MIT