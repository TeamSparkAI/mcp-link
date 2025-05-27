import express, { Request, Response } from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp';
import { ClientEndpoint } from '../clientEndpoints/clientEndpoint';
import { BaseSession, jsonRpcError } from './session.js';
import { isInitializeRequest } from '@modelcontextprotocol/sdk/types';
import { ServerEndpointConfig } from '../types/config';
import { SessionManagerImpl } from './sessionManager';
import { ServerEndpoint } from './serverEndpoint';
import { MessageProcessor } from '../types/messageProcessor';
import logger from '../logger.js';

// See: Sample StreamableHTTP server
// https://github.com/modelcontextprotocol/typescript-sdk?tab=readme-ov-file#streamable-http

export class StreamableSession extends BaseSession<StreamableHTTPServerTransport> {
    constructor(transport: StreamableHTTPServerTransport, sessionId: string, clientEndpoint: ClientEndpoint, messageProcessor?: MessageProcessor) {
        super(sessionId, clientEndpoint, transport, 'Streaming', messageProcessor);
    }
}

export class ServerEndpointStreamable extends ServerEndpoint {
    constructor(config: ServerEndpointConfig, sessionManager: SessionManagerImpl) {
        super(config, sessionManager);
    }

    async start(messageProcessor?: MessageProcessor): Promise<void> {
        const clientEndpoint = this.clientEndpoints.get(this.ONLY_CLIENT_ENDPOINT);
        if (!clientEndpoint ) {
            throw new Error('SSE server endpoint has no client endpoints condfigured, failed to start');
        }

        const port = this.config.port || 3000;
        const host = this.config.host || 'localhost';

        const app = express();
        const server = createServer(app);

        app.use(cors());
        app.use(express.json());

        // Handle POST requests for client-to-server communication
        app.post('/mcp', async (req: Request, res: Response) => {
            // Check for existing session ID
            const sessionId = req.headers['mcp-session-id'] as string | undefined;
            let transport: StreamableHTTPServerTransport;

            logger.info('POST /mcp sessionId', sessionId);
            if (sessionId) {
                logger.info('POST /mcp hasSessions', this.sessionManager.getSession(sessionId!));
            }

            if (sessionId && this.sessionManager.getSession(sessionId)) {
                // Reuse existing transport
                const session = this.sessionManager.getSession(sessionId)! as StreamableSession;
                transport = session.transport;
            } else if (!sessionId && isInitializeRequest(req.body)) {
                // New initialization request
                const newSessionId = `streaming-${Date.now()}`;
                transport = new StreamableHTTPServerTransport({
                    sessionIdGenerator: () => newSessionId,
                    onsessioninitialized: async (sessionId) => {
                        logger.info('Streaming session initialized:', sessionId);
                        transport.onmessage = async (message) => {
                            logger.debug('Streamable server transport - received message', message);
                            session.forwardMessageToServer(message);
                        }
                    }
                });
        
                // Clean up transport when closed (Note: I've never seen this get called, even when client connections are closed)
                transport.onclose = () => {
                    logger.info('transport.onclose', transport.sessionId);
                    if (transport.sessionId) {
                        const session = this.sessionManager.getSession(transport.sessionId);
                        if (session) {
                            session.close();
                            this.sessionManager.removeSession(transport.sessionId);
                        }
                    }
                }

                const session = new StreamableSession(transport, newSessionId, clientEndpoint, messageProcessor);
                session.on('clientEndpointClose', () => {
                    logger.info('Client endpoint closed for streamable session:', session.id);
                    this.sessionManager.removeSession(session.id);
                });

                this.sessionManager.addSession(session);
                await session.start();
            } else {
                // Invalid request
                res.status(400).json(jsonRpcError('Bad Request: No valid session ID provided'));
                return;
            }

            // Handle the request
            logger.info('handleRequest', req.body);
            await transport.handleRequest(req, res, req.body);
        });

        // Reusable handler for GET and DELETE requests
        const handleSessionRequest = async (req: Request, res: Response) => {
            logger.info('handleSessionRequest', req.headers);
            const sessionId = req.headers['mcp-session-id'] as string | undefined;
            if (!sessionId || !this.sessionManager.getSession(sessionId)) {
                res.status(400).send('Invalid or missing session ID');
                return;
            }

            const session = this.sessionManager.getSession(sessionId)! as StreamableSession;
            await session.transport.handleRequest(req, res);
        };

        // Handle GET requests for server-to-client notifications via SSE
        app.get('/mcp', handleSessionRequest);

        // Handle DELETE requests for session termination
        app.delete('/mcp', handleSessionRequest);

        server.listen(port, host, () => {
            logger.info(`Streamable server endpoint listening on http://${host}:${port}`);
        });
    }
}