import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio';
import { BaseSession } from './session';
import { ProxiedMcpServer } from '../clientProxies/clientProxy';
import { JSONRPCMessage } from '@modelcontextprotocol/sdk/types';
import { ProxyConfig } from '../types/config';
import { SessionManagerImpl } from './sessionManager';
import { ServerTransport } from './serverTransport';
import logger from '../logger';

// Session class to manage stdio transport and message handling
export class StdioSession extends BaseSession<StdioServerTransport> {
    constructor(proxiedMcpServer: ProxiedMcpServer) {
        const transport = new StdioServerTransport();
        super(`stdio-${Date.now()}`, proxiedMcpServer, transport, 'Stdio');
    }
}

export class ServerTransportStdio extends ServerTransport {
    constructor(config: ProxyConfig, proxiedMcpServer: ProxiedMcpServer, sessionManager: SessionManagerImpl) {
        super(config, proxiedMcpServer, sessionManager);
    }

    async start(): Promise<void> {
        logger.info('Starting stdio transport');

        const session = new StdioSession(this.proxiedMcpServer);
        session.on('proxiedClientClose', () => {
            logger.info('Proxied client closed for stdio session:', session.id);
            this.sessionManager.removeSession(session.id);
        });

        const transport = session.transport;
        transport.onmessage = (message: JSONRPCMessage) => {
            logger.debug('Stdio server transport - received message', message);
            session.forwardMessage(message);
        };
            
        try {
            await session.start();
        } catch (error) {
            logger.error('Failed to start stdio transport:', error);
            process.exit(1);
        }
    }

    async stop(): Promise<void> {
        logger.info('Stopping stdio transport');
        process.stdout.end();
        process.stderr.end();
        process.stdin.end();
        await super.stop();
   }
}