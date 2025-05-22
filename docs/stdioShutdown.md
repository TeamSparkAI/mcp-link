StdioClientTransport is a standard libaray for MCP that spawns an app and then exhanges JSONRPC messages with that app via the apps stdin and stdout.

When close() is called on StdioClientTransport it immediately terminates the stdio MCP server that it spawned.

The spawned stdio MCP server receives a SIGTERM message, and no other messages or noticiations on the transport or the process input streams.

Our MCP server (our mcp-bridge app) needs to perform an orderly shutdown involving asynchronous operations, including shutting down our own client connection to the server we're bridging to.

We cannot perform such async orderly shutdown in the SIGTERM handler, because it doesn't support async operations reliably (generally on the first async operation you yield to the event loop and the app terminates).

We cannot change the StdioClientTransport code to make it behave better (it is widely deployed and used by clients with which we need to interoperate).

One possible option being considered is to break our app into two processes with independent lifecycles.  Our "main" process would need to be the one that implemented StdioServerTransport (the "server" process) as the app that spawns our app via StdioClientTransport expects to be able to communicate with the app it spawns via stdio streams.  That stdio server app would need to communicate bi-directionally with the bridge app (that implements the session and proxied clients) such that JSONRPC messages (MCP protocol messages) can be passed back and forth, and the apps can signal each other on shutdown.

Our server process would spawn our bridge process, passing its own PID in the env of the spawned process.  The bridge process would then poll the server process to detect when it terminates, and then trigger it's own orderly shutdown.  Also, if the bridge process initiates a shutdown (perhaps the proxied server shuts down), the bridge process could signal the server process to shut down.

The SSE and Streamable server transports don't have this issue and wouldn't need to be separate processess (nor should they be), so this is something that would only apply to the stdio server mode.
