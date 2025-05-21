import express, { Request, Response } from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse';
import { JSONRPCMessage } from '@modelcontextprotocol/sdk/types';
import { ProxiedMcpServer } from '../clientProxies/clientProxy';
import { BaseSession } from './session';
import { ProxyConfig } from '../types/config';
import logger from '../logger';

// Session class to manage SSE transport and message handling
export class SseSession extends BaseSession<SSEServerTransport> {
    constructor(transport: SSEServerTransport, proxiedMcpServer: ProxiedMcpServer) {
        super(transport.sessionId || '', proxiedMcpServer, transport, 'SSE');
    }
}

export async function startSSETransport(config: ProxyConfig, proxiedMcpServer: ProxiedMcpServer) {
    const port = config.serverPort || 3000;
    const host = config.serverHost || 'localhost';

    const app = express();
    const server = createServer(app);
    const activeSessions = new Map<string, SseSession>();

    app.use(cors());
    app.use(express.json());

    // Create SSE endpoint handler with access to proxiedMcpServer
    app.get('/sse', async (req: Request, res: Response) => {
        const transport = new SSEServerTransport('/messages', res);
        logger.info('Received SSE request, created new session:', transport.sessionId);
        
        const session = new SseSession(transport, proxiedMcpServer);
        activeSessions.set(session.id, session);
        await session.start();

        // Session close handler
        req.on('close', () => {
            logger.info('SSE connection closed for session:', transport.sessionId);
            const session = activeSessions.get(transport.sessionId!);
            if (session) {
                session.close();
                activeSessions.delete(session.id);
            }
        });
    });

    // Handle incoming messages
    app.post('/messages', async (req: Request, res: Response) => {
        logger.debug('Received', req.url, req.body);

        // Extract sessionId from URL query params
        const url = new URL(req.url, `http://${req.headers.host}`);
        const sessionId = url.searchParams.get('sessionId');
        
        if (!sessionId) {
            logger.error('No sessionId in request');
            res.status(400).send('No sessionId provided');
            return;
        }

        const session = activeSessions.get(sessionId);
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

            await session.forwardMessage(message);
            res.status(202).send('Accepted').end();
        } catch (error) {
            logger.error('Error handling message:', error);
            res.status(500).send('Error handling message');
        }
    });

    // Handle process termination
    process.on('unhandledRejection', (reason, promise) => {
        logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
    });

    process.on('uncaughtException', (error) => {
        logger.error('Uncaught Exception:', error);
    });

    server.listen(port, host, () => {
        logger.info(`SSE proxy server listening on http://${host}:${port}`);
    });
}