import { StdioClientTransport, StdioServerParameters } from "@modelcontextprotocol/sdk/client/stdio";
import { ClientEndpoint } from "./clientEndpoint";
import { jsonRpcError, Session } from "../serverEndpoints/session";
import { JSONRPCMessage } from "@modelcontextprotocol/sdk/types";
import { ClientEndpointConfig } from "../types/config";
import { SessionManager } from "../serverEndpoints/sessionManager";
import logger from "../logger";

export class ClientEndpointStdio implements ClientEndpoint {
    private command: string;
    private args: string[];
    private stdioClient: StdioClientTransport | null = null;
    private sessionManager: SessionManager;
  
    constructor(config: ClientEndpointConfig, sessionManager: SessionManager) {
        if (!config.command) {
            throw new Error('Client command is required');
        }
        this.command = config.command;
        this.args = config.args || [];
        this.sessionManager = sessionManager;
    }
  
    async startSession(session: Session): Promise<void> {  
        // Connect to the SSE endpoint
        logger.debug('Connecting to stdio client endpoint:', this.command);
        const params: StdioServerParameters = { command: this.command, args: this.args };
        this.stdioClient = new StdioClientTransport(params);
        await this.stdioClient.start();

        this.stdioClient.onmessage = async (message: JSONRPCMessage) => {
            logger.debug('Received message from stdio client endpoint:', message);
            await session.returnMessageToClient(message);
        };
  
        this.stdioClient.onerror = async (error: Error) => {
            logger.error('Stdio client - Server Error:', error);
            const errorMessage: JSONRPCMessage = jsonRpcError(error.toString());
            await session.returnMessageToClient(errorMessage);
        };

        this.stdioClient.onclose = async () => {
            logger.debug('Stdio client session closed');
            await session.onClientEndpointClose();
        };
    }
  
    async sendMessage(message: JSONRPCMessage): Promise<void> {
        if (this.stdioClient) {
            logger.debug('Forwarding message to stdio client endpoint:', message);
            this.stdioClient.send(message);
        }
    }
   
    async closeSession(): Promise<void> {
        logger.debug('Closing stdio client endpoint');
        if (this.stdioClient) {
            logger.debug('StdioClient exists, calling close()');
            await this.stdioClient.close();
            logger.debug('StdioClient close() completed');
        } else {
            logger.debug('No StdioClient to close');
        }
        this.stdioClient = null;
    }
}