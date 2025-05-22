import { JSONRPCMessage } from "@modelcontextprotocol/sdk/types";
import { ProxiedMcpServer } from '../clientProxies/clientProxy';
import { Transport } from "@modelcontextprotocol/sdk/shared/transport";
import logger from '../logger';

export function jsonRpcError(message: string, code: number = -32000): JSONRPCMessage {
    return {
        jsonrpc: '2.0',
        id: 'error',
        error: { code, message }
    };
}

export interface Session {
    get id(): string;  

    start(): Promise<void>;
  
    // Forward a message (typically a protocol message or request) from the client to the proxied MCP server
    forwardMessage(message: JSONRPCMessage): Promise<void>;
    
    // Return a message (response, notification, or error) from the proxied MCP server to the client
    returnMessage(message: JSONRPCMessage): Promise<void>;  

    close(): Promise<void>;
}

export abstract class BaseSession<T extends Transport = Transport> {
    protected sessionId: string;
    protected isActive: boolean = true;
    protected proxiedMcpServer: ProxiedMcpServer;
    private _transport: T;
    private transportType: string;

    constructor(sessionId: string, proxiedMcpServer: ProxiedMcpServer, transport: T, transportType: string) {
        this.sessionId = sessionId;
        this.proxiedMcpServer = proxiedMcpServer;
        this._transport = transport;
        this.transportType = transportType;
    }

    get id(): string {
        return this.sessionId;
    }

    get transport(): T {
        return this._transport;
    }

    async start(): Promise<void> {
        try {
            await this.proxiedMcpServer.startSession(this);
            await this.transport.start();
            logger.info(`Started ${this.transportType} session ${this.sessionId}`);
        } catch (error) {
            logger.error(`Error starting ${this.transportType} session ${this.sessionId}:`, error);
            throw error;
        }
    }

    // Forward a message from the client to the proxied MCP server
    async forwardMessage(message: JSONRPCMessage): Promise<void> {
        if (!this.isActive) return;
        logger.debug('Forwarding message to proxied MCP server:', message);
        await this.proxiedMcpServer.sendMessage(message);
    }
    
    // Return a message from the proxied MCP server to the client
    async returnMessage(message: JSONRPCMessage): Promise<void> {
        if (!this.isActive) return;
        logger.debug('Sending response to client:', message);
        await this.transport.send(message);
    }

    async close(): Promise<void> {
        if (!this.isActive) return;
        this.isActive = false;
        logger.debug('Closing transport and session:', this.sessionId);
        // Close our transport first to prevent any more messages from being sent
        await this.transport.close();
        // Then close the proxied server
        await this.proxiedMcpServer.closeSession();
    }
}