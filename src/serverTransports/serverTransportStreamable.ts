import express, { Request, Response } from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp';
import { ProxiedMcpServer } from '../clientProxies/clientProxy';
import { BaseSession, jsonRpcError } from './session.js';
import { isInitializeRequest } from '@modelcontextprotocol/sdk/types';
import { ProxyConfig } from '../types/config';
import { SessionManagerImpl } from './sessionManager';
import { ServerTransport } from './serverTransport';
import logger from '../logger.js';

// See: Sample StreamableHTTP server
// https://github.com/modelcontextprotocol/typescript-sdk?tab=readme-ov-file#streamable-http

export class StreamableSession extends BaseSession<StreamableHTTPServerTransport> {
    constructor(transport: StreamableHTTPServerTransport, sessionId: string, proxiedMcpServer: ProxiedMcpServer) {
        super(sessionId, proxiedMcpServer, transport, 'Streaming');
    }
}

export class ServerTransportStreamable extends ServerTransport {
    constructor(config: ProxyConfig, proxiedMcpServer: ProxiedMcpServer, sessionManager: SessionManagerImpl) {
        super(config, proxiedMcpServer, sessionManager);
    }

    async start(): Promise<void> {
        const port = this.config.serverPort || 3000;
        const host = this.config.serverHost || 'localhost';

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
                            session.forwardMessage(message);
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

                const session = new StreamableSession(transport, newSessionId, this.proxiedMcpServer);
                session.on('proxiedClientClose', () => {
                    logger.info('Proxied client closed for streamable session:', session.id);
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
            logger.info(`Streaming proxy server listening on http://${host}:${port}`);
        });
    }
}