import express, { Request, Response } from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp';
import { ClientEndpoint } from '../clientEndpoints/clientEndpoint';
import { BaseSession, jsonRpcError } from './session';
import { isInitializeRequest } from '@modelcontextprotocol/sdk/types';
import { ServerEndpointConfig } from '../types/config';
import { SessionManagerImpl } from './sessionManager';
import { ServerEndpoint } from './serverEndpoint';
import { AuthorizedMessageProcessor } from '../types/messageProcessor';
import logger from '../logger';

// See: Sample StreamableHTTP server
// https://github.com/modelcontextprotocol/typescript-sdk?tab=readme-ov-file#streamable-http

export class StreamableSession extends BaseSession<StreamableHTTPServerTransport> {
    constructor(transport: StreamableHTTPServerTransport, sessionId: string, clientEndpoint: ClientEndpoint, serverName: string | null, messageProcessor?: AuthorizedMessageProcessor) {
        super(sessionId, clientEndpoint, transport, 'Streaming', serverName, messageProcessor);
    }
}

export class ServerEndpointStreamable extends ServerEndpoint {
    private server?: ReturnType<typeof createServer>;

    constructor(config: ServerEndpointConfig, sessionManager: SessionManagerImpl) {
        super(config, sessionManager);
    }

    private async handleStreamableRequest(req: Request, res: Response, serverName: string | null, clientEndpoint: ClientEndpoint, messageProcessor?: AuthorizedMessageProcessor): Promise<void> {
        // Check for existing session ID
        const sessionId = req.headers['mcp-session-id'] as string | undefined;
        let transport: StreamableHTTPServerTransport;

        logger.debug('POST /mcp sessionId', sessionId);
        /*
        if (sessionId) {
            logger.debug('POST /mcp hasSessions', this.sessionManager.getSession(sessionId!));
        }
        */

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
                    logger.debug('Streaming session initialized:', sessionId);
                    transport.onmessage = async (message) => {
                        logger.debug('Streamable server transport - received message', message);
                        session.forwardMessageToServer(message);
                    }
                }
            });
    
            // Clean up transport when closed
            transport.onclose = () => {
                logger.debug('transport.onclose', transport.sessionId);
                if (transport.sessionId) {
                    const session = this.sessionManager.getSession(transport.sessionId);
                    if (session) {
                        session.close();
                        this.sessionManager.removeSession(transport.sessionId);
                    }
                }
            }

            const session = new StreamableSession(transport, newSessionId, clientEndpoint, serverName, messageProcessor);
            try {
                await session.authorize(req.headers['authorization']);
            } catch (error) {
                logger.error('Error authorizing session:', error);
                res.status(401).json(jsonRpcError('Unauthorized'));
                return;
            }

            session.on('clientEndpointClose', () => {
                logger.debug('Client endpoint closed for streamable session:', session.id);
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
        logger.debug('handleRequest', req.body);
        await transport.handleRequest(req, res, req.body);
    }

    private handleSessionRequest = async (req: Request, res: Response): Promise<void> => {
        const sessionId = req.headers['mcp-session-id'] as string | undefined;
        if (!sessionId || !this.sessionManager.getSession(sessionId)) {
            res.status(400).send('Invalid or missing session ID');
            return;
        }

        const session = this.sessionManager.getSession(sessionId)! as StreamableSession;
        logger.debug('handleSessionRequest, sessionId:', sessionId, req.body);
        await session.transport.handleRequest(req, res);
    }

    async start(messageProcessor?: AuthorizedMessageProcessor): Promise<void> {
        const port = this.config.port || 3000;
        const host = this.config.host || 'localhost';

        logger.info(`Starting streamable server transport on port ${port}, preconfigured client endpoints: ${this.clientEndpoints.size}`);

        const app = express();
        this.server = createServer(app);
        app.use(cors());
        app.use(express.json());

        if (this.clientEndpoints.size === 1 && this.clientEndpoints.has(this.ONLY_CLIENT_ENDPOINT)) {
            // Single client endpoint case
            const clientEndpoint = this.clientEndpoints.get(this.ONLY_CLIENT_ENDPOINT)!;
            
            // Handle POST requests for client-to-server communication
            app.post('/mcp', async (req: Request, res: Response) => {
                await this.handleStreamableRequest(req, res, null, clientEndpoint, messageProcessor);
            });

            // Handle GET and DELETE requests
            app.get('/mcp', this.handleSessionRequest);
            app.delete('/mcp', this.handleSessionRequest);
        } else {
            // Multiple client endpoints case
            app.post('/:server/mcp', async (req: Request, res: Response) => {
                const serverName = req.params.server;
                const clientEndpoint = this.clientEndpoints.get(serverName);
                
                if (!clientEndpoint) {
                    logger.error(`No client endpoint found for server: ${serverName}`);
                    res.status(404).json(jsonRpcError(`Server ${serverName} not found`));
                    return;
                }

                await this.handleStreamableRequest(req, res, serverName, clientEndpoint, messageProcessor);
            });

            // Handle GET and DELETE requests for multiple clients
            app.get('/:server/mcp', this.handleSessionRequest);
            app.delete('/:server/mcp', this.handleSessionRequest);
        }

        this.server.listen(port, host, () => {
            logger.debug(`Streamable server endpoint listening on http://${host}:${port}`);
        });
    }

    async stop(terminateProcess: boolean = true): Promise<void> {
        if (this.server) {
            logger.debug('Shutting down streamable server endpoint');
            await new Promise<void>((resolve) => {
                this.server!.close(() => {
                    logger.debug('Streamable server endpoint shut down successfully');
                    resolve();
                });
            });
        }
        await super.stop(terminateProcess);
    }
}