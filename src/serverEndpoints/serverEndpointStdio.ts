import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio';
import { BaseSession } from './session';
import { ClientEndpoint } from '../clientEndpoints/clientEndpoint';
import { JSONRPCMessage } from '@modelcontextprotocol/sdk/types';
import { BridgeConfig } from '../types/config';
import { SessionManagerImpl } from './sessionManager';
import { ServerEndpoint } from './serverEndpoint';
import { MessageProcessor } from '../types/messageProcessor';
import logger from '../logger';

// Session class to manage stdio transport and message handling
export class StdioSession extends BaseSession<StdioServerTransport> {
    constructor(clientEndpoint: ClientEndpoint, messageProcessor?: MessageProcessor) {
        const transport = new StdioServerTransport();
        super(`stdio-${Date.now()}`, clientEndpoint, transport, 'Stdio', messageProcessor);
    }
}

export class ServerEndpointStdio extends ServerEndpoint {
    constructor(config: BridgeConfig, clientEndpoint: ClientEndpoint, sessionManager: SessionManagerImpl) {
        super(config, clientEndpoint, sessionManager);
    }

    async start(): Promise<void> {
        logger.info('Starting stdio transport');

        const session = new StdioSession(this.clientEndpoint, this.config.messageProcessor);
        session.on('clientEndpointClose', () => {
            logger.info('Client endpoint closed for stdio session:', session.id);
            this.sessionManager.removeSession(session.id);
        });

        const transport = session.transport;
        transport.onmessage = (message: JSONRPCMessage) => {
            logger.debug('Stdio server transport - received message', message);
            session.forwardMessageToServer(message);
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