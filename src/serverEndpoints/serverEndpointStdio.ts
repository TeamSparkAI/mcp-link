import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio';
import { BaseSession } from './session';
import { ClientEndpoint } from '../clientEndpoints/clientEndpoint';
import { JSONRPCMessage } from '@modelcontextprotocol/sdk/types';
import { ClientEndpointConfig, ServerEndpointConfig } from '../types/config';
import { SessionManagerImpl } from './sessionManager';
import { ServerEndpoint } from './serverEndpoint';
import { AuthorizedMessageProcessor, MessageProcessor } from '../types/messageProcessor';
import logger from '../logger';
import { createClientEndpoint } from '../clientEndpoints/clientEndpointFactory';

// Session class to manage stdio transport and message handling
export class StdioSession extends BaseSession<StdioServerTransport> {
    constructor(clientEndpoint: ClientEndpoint, messageProcessor?: AuthorizedMessageProcessor) {
        const transport = new StdioServerTransport();
        super(`stdio-${Date.now()}`, clientEndpoint, transport, 'Stdio', null, messageProcessor);
    }
}

export class ServerEndpointStdio extends ServerEndpoint {
    constructor(config: ServerEndpointConfig, sessionManager: SessionManagerImpl) {
        super(config, sessionManager);
    }

    async addClientEndpoint(name: string, clientEndpoint: ClientEndpointConfig): Promise<void> {
        if (name === this.ONLY_CLIENT_ENDPOINT) {
            super.addClientEndpoint(name, clientEndpoint);
        } else {
            throw new Error(`Stdio server endpoint only supports a single client endpoint, failed to add client endpoint: ${name}`);
        }
    }

    async start(messageProcessor?: AuthorizedMessageProcessor): Promise<void> {
        logger.info('Starting stdio transport');

        const clientEndpoint = this.clientEndpoints.get(this.ONLY_CLIENT_ENDPOINT);
        if (!clientEndpoint ) {
            throw new Error('Stdio server endpoint has no client endpoints condfigured, failed to start');
        }

        const session = new StdioSession(clientEndpoint, messageProcessor);
        this.sessionManager.addSession(session);

        session.on('clientEndpointClose', () => {
            logger.debug('Client endpoint closed for stdio session:', session.id);
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

    async stop(terminateProcess: boolean = true): Promise<void> {
        logger.debug('Stopping stdio transport');
        await super.stop(terminateProcess);
        process.stdout.end();
        process.stderr.end();
        process.stdin.end();
    }
}