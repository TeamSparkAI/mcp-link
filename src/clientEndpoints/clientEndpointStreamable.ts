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
    private transports: Map<string, StreamableHTTPClientTransport> = new Map();
  
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
            logger.debug(`Connecting to Streamable client endpoint: ${this.endpoint}`);
            const streamableClient = new StreamableHTTPClientTransport(this.endpoint, {
                requestInit: {
                    headers: this.headers
                }
            });
            this.transports.set(session.id, streamableClient);

            streamableClient.onmessage = async (message: JSONRPCMessage) => {
                logger.debug(`Received message from Streamable client endpoint: ${message}`);
                await session.returnMessageToClient(message);
            };
        
            streamableClient.onerror = async (error: Error) => {
                logger.error(`Streamable client - Server Error: ${error}`);
                const errorMessage: JSONRPCMessage = jsonRpcError(error.toString());
                await session.returnMessageToClient(errorMessage);
            };

            streamableClient.onclose = async () => {
                logger.debug('Streamable client session closed');
                await session.onClientEndpointClose();
                this.transports.delete(session.id);
            };

            await streamableClient.start();
            logger.debug('Connected to streamable client endpoint for session:', session.id);
        } catch (error) {
            logger.error('Error starting streaming session:', error);
            throw error;
        }
    }

    async sendMessage(session: Session, message: JSONRPCMessage): Promise<void> {
        const streamableClient = this.transports.get(session.id);
        if (streamableClient) {
            logger.debug(`Forwarding message to Streamable client endpoint: ${message}`);
            streamableClient.send(message);
        } else {
            logger.error('No Streamable client transport found for session:', session.id);
        }
    }

    async closeSession(session: Session): Promise<void> {
        logger.debug('Closing Streamable client endpoint for session:', session.id);
        const streamableClient = this.transports.get(session.id);
        if (streamableClient) {
            await streamableClient.close();
            this.transports.delete(session.id);
        } else {
            logger.debug('No Streamable client transport to close for session:', session.id);
        }
    }
} 