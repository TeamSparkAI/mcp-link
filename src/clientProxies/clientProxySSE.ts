import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse";
import { ProxiedMcpServer } from "./clientProxy";
import { jsonRpcError, Session } from "../serverTransports/session";
import { JSONRPCMessage } from "@modelcontextprotocol/sdk/types";
import { ProxyConfig } from "../types/config";
import logger from "../logger";

export class ProxiedSseMcpServer implements ProxiedMcpServer {
    private endpoint: URL;
    private sseClient: SSEClientTransport | null = null;
  
    constructor(config: ProxyConfig) {
      if (!config.clientEndpoint) {
        throw new Error('Client endpoint is required');
      }
      this.endpoint = new URL(config.clientEndpoint);
    }
  
    async startSession(session: Session): Promise<void> {  
        // Connect to the SSE endpoint
        logger.info(`Connecting to proxied SSE endpoint: ${this.endpoint}`);
        this.sseClient = new SSEClientTransport(this.endpoint);
        await this.sseClient.start();

        this.sseClient.onmessage = async (message: JSONRPCMessage) => {
            logger.debug(`Received message from proxied SSE endpoint: ${message}`);
            await session.returnMessage(message);
        };
  
        this.sseClient.onerror = async (error: Error) => {
            logger.error(`SSE Proxied Server Error: ${error}`);
            const errorMessage: JSONRPCMessage = jsonRpcError(error.toString());
            await session.returnMessage(errorMessage);
        };
    }
  
    async sendMessage(message: JSONRPCMessage): Promise<void> {
        if (this.sseClient) {
            logger.debug(`Forwarding message to proxied SSE endpoint: ${message}`);
            this.sseClient.send(message);
        }
    }
   
    async closeSession(): Promise<void> {
        await this.sseClient?.close();
        this.sseClient = null;
    }
}