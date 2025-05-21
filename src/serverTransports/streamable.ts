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
    constructor(transport: StreamableHTTPServerTransport, proxiedMcpServer: ProxiedMcpServer) {
        super(transport.sessionId || '', proxiedMcpServer, transport, 'Streaming');
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

        if (sessionId && activeSessions.has(sessionId)) {
            // Reuse existing transport
            const session = activeSessions.get(sessionId)!;
            transport = session.transport;
        } else if (!sessionId && isInitializeRequest(req.body)) {
            // New initialization request
            transport = new StreamableHTTPServerTransport({
                sessionIdGenerator: () => `streaming-${Date.now()}`,
                onsessioninitialized: (sessionId) => {
                    logger.info('Streaming session initialized:', sessionId);
                }
            });

            // Clean up transport when closed
            transport.onclose = () => {
                if (transport.sessionId) {
                    const session = activeSessions.get(transport.sessionId);
                    if (session) {
                        session.close();
                        activeSessions.delete(transport.sessionId);
                    }
                }
            }

            // Create and store new session
            const session = new StreamableSession(transport, proxiedMcpServer);
            activeSessions.set(transport.sessionId!, session);
            await session.start();
        } else {
            // Invalid request
            res.status(400).json(jsonRpcError('Bad Request: No valid session ID provided'));
            return;
        }

        // Handle the request
        await transport.handleRequest(req, res, req.body);
    });

    // Reusable handler for GET and DELETE requests
    const handleSessionRequest = async (req: Request, res: Response) => {
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

    server.listen(port, host, () => {
        logger.info(`Streaming proxy server listening on http://${host}:${port}`);
    });
}