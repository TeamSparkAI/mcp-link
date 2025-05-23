import express, { Request, Response } from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp';
import { ProxiedMcpServer } from '../clientProxies/clientProxy';
import { BaseSession, jsonRpcError } from './session.js';
import { isInitializeRequest } from '@modelcontextprotocol/sdk/types';
import { ProxyConfig } from '../types/config';
import logger from '../logger.js';

// See: Sample StreamableHTTP server
// https://github.com/modelcontextprotocol/typescript-sdk?tab=readme-ov-file#streamable-http

export class StreamableSession extends BaseSession<StreamableHTTPServerTransport> {
    constructor(transport: StreamableHTTPServerTransport, sessionId: string, proxiedMcpServer: ProxiedMcpServer) {
        super(sessionId, proxiedMcpServer, transport, 'Streaming');
    }
}

export async function startStreamableTransport(config: ProxyConfig, proxiedMcpServer: ProxiedMcpServer) {
    const port = config.serverPort || 3000;
    const host = config.serverHost || 'localhost';

    const app = express();
    const server = createServer(app);
    const activeSessions = new Map<string, StreamableSession>();

    app.use(cors());
    app.use(express.json());

    // Handle POST requests for client-to-server communication
    app.post('/mcp', async (req: Request, res: Response) => {
        // Check for existing session ID
        const sessionId = req.headers['mcp-session-id'] as string | undefined;
        let transport: StreamableHTTPServerTransport;

        logger.info('POST /mcp sessionId', sessionId);
        if (sessionId) {
            logger.info('POST /mcp hasSessions', activeSessions.has(sessionId!));
        }

        if (sessionId && activeSessions.has(sessionId)) {
            // Reuse existing transport
            const session = activeSessions.get(sessionId)!;
            transport = session.transport;
        } else if (!sessionId && isInitializeRequest(req.body)) {
            // New initialization request
            const newSessionId = `streaming-${Date.now()}`;
            transport = new StreamableHTTPServerTransport({
                sessionIdGenerator: () => newSessionId,
                onsessioninitialized: async (sessionId) => {
                    logger.info('Streaming session initialized:', sessionId);
                    transport.onmessage = async (message) => {
                        logger.info('onmessage', message);
                        session.forwardMessage(message);
                    }
                }
            });
    
            // Clean up transport when closed (Note: I've never seen this get called, even when client connections are closed)
            transport.onclose = () => {
                logger.info('transport.onclose', transport.sessionId);
                if (transport.sessionId) {
                    const session = activeSessions.get(transport.sessionId);
                    if (session) {
                        session.close();
                        activeSessions.delete(transport.sessionId);
                    }
                }
            }

            const session = new StreamableSession(transport, newSessionId, proxiedMcpServer);
            activeSessions.set(newSessionId, session);
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
        if (!sessionId || !activeSessions.has(sessionId)) {
            res.status(400).send('Invalid or missing session ID');
            return;
        }

        const session = activeSessions.get(sessionId)!;
        await session.transport.handleRequest(req, res);
    };

    // Handle GET requests for server-to-client notifications via SSE
    app.get('/mcp', handleSessionRequest);

    // Handle DELETE requests for session termination
    app.delete('/mcp', handleSessionRequest);

    // Handle process termination
    process.on('unhandledRejection', (reason, promise) => {
        logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
    });

    process.on('uncaughtException', (error) => {
        logger.error('Uncaught Exception:', error);
    });

    // We sometimes get unceremoniously terminated, and we need to close sessions (so we can terminated child processes or running containers when needed)
    async function orderlyShutdown() {
        logger.info('Orderly shutdown');
        activeSessions.forEach(session => session.close());
        await new Promise(resolve => setTimeout(resolve, 1000));
        process.exit(0);
    }

    process.on('SIGINT', () => {
        logger.info('SIGINT');
        orderlyShutdown();
    });

    process.on('SIGTERM', () => {
        logger.info('SIGTERM');
        orderlyShutdown();
    });

    server.listen(port, host, () => {
        logger.info(`Streaming proxy server listening on http://${host}:${port}`);
    });
}