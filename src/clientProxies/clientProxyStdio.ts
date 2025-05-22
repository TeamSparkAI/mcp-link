import { StdioClientTransport, StdioServerParameters } from "@modelcontextprotocol/sdk/client/stdio";
import { ProxiedMcpServer } from "./clientProxy";
import { jsonRpcError, Session } from "../serverTransports/session";
import { JSONRPCMessage } from "@modelcontextprotocol/sdk/types";
import { ProxyConfig } from "../types/config";
import logger from "../logger";

export class ProxiedStdioMcpServer implements ProxiedMcpServer {
    private command: string;
    private args: string[];
    private stdioClient: StdioClientTransport | null = null;
  
    constructor(config: ProxyConfig) {
        if (!config.clientCommand) {
            throw new Error('Client command is required');
        }
        this.command = config.clientCommand;
        this.args = config.args || [];
    }
  
    async startSession(session: Session): Promise<void> {  
        // Connect to the SSE endpoint
        logger.info('Connecting to proxied stdio endpoint:', this.command);
        const params: StdioServerParameters = { command: this.command, args: this.args };
        this.stdioClient = new StdioClientTransport(params);
        await this.stdioClient.start();

        this.stdioClient.onmessage = async (message: JSONRPCMessage) => {
            logger.debug('Received message from proxied stdio endpoint:', message);
            await session.returnMessage(message);
        };
  
        this.stdioClient.onerror = async (error: Error) => {
            logger.error('Stdio Proxied Server Error:', error);
            const errorMessage: JSONRPCMessage = jsonRpcError(error.toString());
            await session.returnMessage(errorMessage);
        };
    }
  
    async sendMessage(message: JSONRPCMessage): Promise<void> {
        if (this.stdioClient) {
            logger.debug('Forwarding message to proxied stdio endpoint:', message);
            this.stdioClient.send(message);
        }
    }
   
    async closeSession(): Promise<void> {
        logger.info('Closing proxied stdio endpoint');
        await this.stdioClient?.close();
        this.stdioClient = null;
    }
}