import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp";
import { JSONRPCMessage } from "@modelcontextprotocol/sdk/types";
import { ClientEndpoint } from "./clientEndpoint";
import { jsonRpcError, Session } from "../serverEndpoints/session";
import { ClientEndpointConfig } from "../types/config";
import { SessionManager } from "../serverEndpoints/sessionManager";
import logger from "../logger";

export class ClientEndpoiontStreamable extends ClientEndpoint {
    private endpoint: URL;
    private headers: Record<string, string>;
    private streamableClient: StreamableHTTPClientTransport | null = null;
  
    constructor(config: ClientEndpointConfig, sessionManager: SessionManager) {
        super(config, sessionManager);
        if (!config.endpoint) {
            throw new Error('Client endpoint is required');
        }
        this.endpoint = new URL(config.endpoint);
        this.headers = config.endpointHeaders || {};
    }

    async startSession(session: Session): Promise<void> {
        try {
            // Create a new transport for this session
            logger.debug(`Connecting to Streamable client endpoint: ${this.endpoint}`);
            this.streamableClient = new StreamableHTTPClientTransport(this.endpoint, {
                requestInit: {
                    headers: this.headers
                }
            });

            this.streamableClient.onmessage = async (message: JSONRPCMessage) => {
                logger.debug(`Received message from Streamable client endpoint: ${message}`);
                await session.returnMessageToClient(message);
            };
        
            this.streamableClient.onerror = async (error: Error) => {
                logger.error(`Streamable client - Server Error: ${error}`);
                const errorMessage: JSONRPCMessage = jsonRpcError(error.toString());
                await session.returnMessageToClient(errorMessage);
            };

            this.streamableClient.onclose = async () => {
                logger.debug('Streamable client session closed');
                await session.onClientEndpointClose();
            };

            // Start the transport
            await this.streamableClient.start();
            logger.debug('Connected to streamable client endpoint for session:', session.id);
        } catch (error) {
            logger.error('Error starting streaming session:', error);
            throw error;
        }
    }

    async sendMessage(message: JSONRPCMessage): Promise<void> {
        if (this.streamableClient) {
            logger.debug(`Forwarding message to Streamable client endpoint: ${message}`);
            this.streamableClient.send(message);
        }
    }
  
    async closeSession(): Promise<void> {
        await this.streamableClient?.close();
        this.streamableClient = null;
    }
} 