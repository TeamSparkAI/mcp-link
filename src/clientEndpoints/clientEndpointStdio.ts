import { StdioClientTransport, StdioServerParameters } from "@modelcontextprotocol/sdk/client/stdio";
import { ClientEndpoint } from "./clientEndpoint";
import { jsonRpcError, Session } from "../serverEndpoints/session";
import { JSONRPCMessage } from "@modelcontextprotocol/sdk/types";
import { ClientEndpointConfig } from "../types/config";
import { SessionManager } from "../serverEndpoints/sessionManager";
import logger from "../logger";

export class ClientEndpointStdio extends ClientEndpoint {
    private command: string;
    private args: string[];
    private stdioClient: StdioClientTransport | null = null;
    private pendingMessageId: number | null = null;
  
    constructor(config: ClientEndpointConfig, sessionManager: SessionManager) {
        super(config, sessionManager);
        if (!config.command) {
            throw new Error('Client command is required');
        }
        this.command = config.command;
        this.args = config.args || [];
    }
  
    async startSession(session: Session): Promise<void> {  
        // Connect to the stdio endpoint
        logger.debug('Connecting to stdio client endpoint:', this.command);
        const params: StdioServerParameters = { command: this.command, args: this.args };
        params.stderr = 'pipe';
        this.stdioClient = new StdioClientTransport(params);

        if (this.stdioClient.stderr) {  
            this.stdioClient.stderr.on('data', (data: Buffer) => {
                const logEntry = data.toString().trim();
                logger.error('[mcp-link] stderr:', logEntry);
                this.logEvent(logEntry);
            });
        }

        await this.stdioClient.start();

        this.stdioClient.onmessage = async (message: JSONRPCMessage) => {
            logger.debug('Received message from stdio client endpoint:', message);
            if ('id' in message && typeof message.id === 'number' && message.id === this.pendingMessageId) {
                this.pendingMessageId = null;
            }
            await session.returnMessageToClient(message);
        };

        this.stdioClient.onerror = async (error: Error) => {
            logger.error('Stdio client - Server Error:', error);
            const errorMessage: JSONRPCMessage = jsonRpcError(error.toString());
            await session.returnMessageToClient(errorMessage);
        };

        this.stdioClient.onclose = async () => {
            logger.debug('Stdio client session closed (server terminated)');
            if (this.pendingMessageId !== null) {
                // We closed (the server terminated) with a pending message, so we need to return an error to the client for that
                // message (or the client won't terminate properly or with a decent error message).
                await session.returnMessageToClient(jsonRpcError('Server closed with message pending', {id: this.pendingMessageId}));
                this.pendingMessageId = null;
            }
            await session.onClientEndpointClose();
        };
    }
  
    async sendMessage(message: JSONRPCMessage): Promise<void> {
        if (this.stdioClient) {
            logger.debug('Forwarding message to stdio client endpoint:', message);
            if ('id' in message && typeof message.id === 'number') {
                this.pendingMessageId = message.id;
            }
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