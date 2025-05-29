import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse";
import { ClientEndpoint } from "./clientEndpoint";
import { jsonRpcError, Session } from "../serverEndpoints/session";
import { JSONRPCMessage } from "@modelcontextprotocol/sdk/types";
import { ClientEndpointConfig } from "../types/config";
import { SessionManager } from "../serverEndpoints/sessionManager";
import logger from "../logger";

export class ClientEndpointSse implements ClientEndpoint {
    private endpoint: URL;
    private sseClient: SSEClientTransport | null = null;
    private sessionManager: SessionManager;
  
    constructor(config: ClientEndpointConfig, sessionManager: SessionManager) {
        this.sessionManager = sessionManager;
      if (!config.endpoint) {
        throw new Error('Client endpoint is required');
      }
      this.endpoint = new URL(config.endpoint);
    }
  
    async startSession(session: Session): Promise<void> {  
        // Connect to the SSE endpoint
        logger.debug(`Connecting to SSE client endpoint: ${this.endpoint}`);
        this.sseClient = new SSEClientTransport(this.endpoint);
        await this.sseClient.start();

        this.sseClient.onmessage = async (message: JSONRPCMessage) => {
            logger.debug(`Received message from SSE client endpoint: ${message}`);
            await session.returnMessageToClient(message);
        };
  
        this.sseClient.onerror = async (error: Error) => {
            logger.error(`SSE client - Server Error: ${error}`);
            const errorMessage: JSONRPCMessage = jsonRpcError(error.toString());
            await session.returnMessageToClient(errorMessage);
        };

        this.sseClient.onclose = async () => {
            logger.debug('SSE client session closed');
            await session.onClientEndpointClose();
        };
    }
  
    async sendMessage(message: JSONRPCMessage): Promise<void> {
        if (this.sseClient) {
            logger.debug(`Forwarding message to SSE client endpoint: ${message}`);
            this.sseClient.send(message);
        }
    }
   
    async closeSession(): Promise<void> {
        await this.sseClient?.close();
        this.sseClient = null;
    }
}