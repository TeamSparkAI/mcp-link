import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio';
import { BaseSession } from './session';
import { ProxiedMcpServer } from '../clientProxies/clientProxy';
import { JSONRPCMessage } from '@modelcontextprotocol/sdk/types';
import { ProxyConfig } from '../types/config';
import logger from '../logger';

// Session class to manage stdio transport and message handling
export class StdioSession extends BaseSession<StdioServerTransport> {
    constructor(proxiedMcpServer: ProxiedMcpServer) {
        const transport = new StdioServerTransport();
        super(`stdio-${Date.now()}`, proxiedMcpServer, transport, 'Stdio');
    }
}

// npm start --  --image=mcp/fetch (proxy defaults to stdio->stdio-container, so all we need to provide is the image)
//
// Test message (initialize)
//
// {"jsonrpc":"2.0","id":18,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"mcp-client","version":"1.0.0","transport":null}}}
//

export async function startStdioTransport(config: ProxyConfig, proxiedMcpServer: ProxiedMcpServer) {
    logger.info('Starting stdio transport');

    const session = new StdioSession(proxiedMcpServer);

    const transport = session.transport;
    transport.onmessage = (message: JSONRPCMessage) => {
        logger.info('Received message:', message);
        session.forwardMessage(message);
    };
        
    try {
        await session.start();
    } catch (error) {
        logger.error('Failed to start stdio transport:', error);
        process.exit(1);
    }

    // Handle process termination
    process.on('SIGINT', async () => {
        logger.info('Received SIGINT, closing session');
        await session.close();
        process.exit(0);
    });

    process.on('SIGTERM', async () => {
        logger.info('Received SIGTERM, closing session');
        await session.close();
        process.exit(0);
    });
}
