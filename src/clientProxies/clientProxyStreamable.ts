import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp";
import { JSONRPCMessage } from "@modelcontextprotocol/sdk/types";
import { ProxiedMcpServer } from "./clientProxy";
import { jsonRpcError, Session } from "../serverTransports/session";
import { ProxyConfig } from "../types/config";
import { SessionManager } from "../serverTransports/sessionManager";
import logger from "../logger";

export class ProxiedStreamableMcpServer implements ProxiedMcpServer {
    private endpoint: URL;
    private streamableClient: StreamableHTTPClientTransport | null = null;
    private sessionManager: SessionManager;

    constructor(config: ProxyConfig, sessionManager: SessionManager) {
        if (!config.clientEndpoint) {
            throw new Error('Client endpoint is required');
        }
        this.endpoint = new URL(config.clientEndpoint);
        this.sessionManager = sessionManager;
    }

    async startSession(session: Session): Promise<void> {
        try {
            // Create a new transport for this session
            logger.info(`Connecting to proxied Streamable endpoint: ${this.endpoint}`);
            this.streamableClient = new StreamableHTTPClientTransport(this.endpoint);

            this.streamableClient.onmessage = async (message: JSONRPCMessage) => {
                logger.debug(`Received message from proxied Streamable endpoint: ${message}`);
                await session.returnMessage(message);
            };
        
            this.streamableClient.onerror = async (error: Error) => {
                logger.error(`Streamable Proxied Server Error: ${error}`);
                const errorMessage: JSONRPCMessage = jsonRpcError(error.toString());
                await session.returnMessage(errorMessage);
            };

            this.streamableClient.onclose = async () => {
                logger.info('Streamable session closed');
                await session.onProxiedClientClose();
            };

            // Start the transport
            await this.streamableClient.start();
            logger.info('Connected to streaming endpoint for session:', session.id);
        } catch (error) {
            logger.error('Error starting streaming session:', error);
            throw error;
        }
    }

    async sendMessage(message: JSONRPCMessage): Promise<void> {
        if (this.streamableClient) {
            logger.debug(`Forwarding message to proxied Streamable endpoint: ${message}`);
            this.streamableClient.send(message);
        }
    }
  
    async closeSession(): Promise<void> {
        await this.streamableClient?.close();
        this.streamableClient = null;
    }
} 