import express, { Request, Response } from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse';
import { JSONRPCMessage } from '@modelcontextprotocol/sdk/types';
import { ClientEndpoint } from '../clientEndpoints/clientEndpoint';
import { BaseSession } from './session';
import { BridgeConfig } from '../types/config';
import { SessionManagerImpl } from './sessionManager';
import { ServerEndpoint } from './serverEndpoint';
import { MessageProcessor } from '../types/messageProcessor';
import logger from '../logger';

// Session class to manage SSE transport and message handling
export class SseSession extends BaseSession<SSEServerTransport> {
    constructor(transport: SSEServerTransport, clientEndpoint: ClientEndpoint, messageProcessor?: MessageProcessor) {
        super(transport.sessionId || '', clientEndpoint, transport, 'SSE', messageProcessor);
    }
}

export class ServerEndpointSse extends ServerEndpoint {
    constructor(config: BridgeConfig, clientEndpoint: ClientEndpoint, sessionManager: SessionManagerImpl) {
        super(config, clientEndpoint, sessionManager);
    }

    async start(): Promise<void> {
        logger.info(`Starting SSE server transport on port ${this.config.serverPort}`);
        const port = this.config.serverPort || 3000;
        const host = this.config.serverHost || 'localhost';

        const app = express();
        const server = createServer(app);

        app.use(cors());
        app.use(express.json());

        // Create SSE endpoint handler
        app.get('/sse', async (req: Request, res: Response) => {
            const transport = new SSEServerTransport('/messages', res);
            logger.info('Received SSE request, created new session:', transport.sessionId);
            
            const session = new SseSession(transport, this.clientEndpoint, this.config.messageProcessor);
            session.on('clientEndpointClose', () => {
                logger.info('Client endpoint closed for SSE session:', session.id);
                this.sessionManager.removeSession(session.id);
            });

            this.sessionManager.addSession(session);
            await session.start();

            // Session close handler
            req.on('close', () => {
                logger.info('SSE connection closed for session:', transport.sessionId);
                const session = this.sessionManager.getSession(transport.sessionId!);
                if (session) {
                    session.close();
                    this.sessionManager.removeSession(session.id);
                }
            });
        });

        // Handle incoming messages
        app.post('/messages', async (req: Request, res: Response) => {
            logger.debug('SSE server transport - received message', req.url, req.body);

            // Extract sessionId from URL query params
            const url = new URL(req.url, `http://${req.headers.host}`);
            const sessionId = url.searchParams.get('sessionId');
            
            if (!sessionId) {
                logger.error('No sessionId in request');
                res.status(400).send('No sessionId provided');
                return;
            }

            const session = this.sessionManager.getSession(sessionId);
            if (!session) {
                logger.error('No active session for sessionId:', sessionId);
                res.status(400).send('No active session');
                return;
            }

            try {
                const message: JSONRPCMessage = {
                    jsonrpc: req.body.jsonrpc,
                    id: req.body.id,
                    method: req.body.method,
                    params: req.body.params
                };

                await session.forwardMessageToServer(message);
                res.status(202).send('Accepted').end();
            } catch (error) {
                logger.error('Error handling message:', error);
                res.status(500).send('Error handling message');
            }
        });

        server.listen(port, host, () => {
            logger.info(`SSE server endpoint listening on http://${host}:${port}`);
        });
    }
}