import { JSONRPCMessage } from "@modelcontextprotocol/sdk/types";
import { ClientEndpoint } from '../clientEndpoints/clientEndpoint';
import { Transport } from "@modelcontextprotocol/sdk/shared/transport";
import { EventEmitter } from 'events';
import logger from '../logger';
import { AuthorizedMessageProcessor, MessageProcessor } from "../types/messageProcessor";

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
  
    // Forward a message (typically a protocol message or request) from the client (via server endpoint) to the server (via client endpoint)
    forwardMessageToServer(message: JSONRPCMessage): Promise<void>;
    
    // Return a message (response, notification, or error) from the server (via client endpoint) to the client (via server endpoint)
    returnMessageToClient(message: JSONRPCMessage): Promise<void>;  

    close(): Promise<void>;

    // Called by client endpoints when they detect they have ended
    onClientEndpointClose(): Promise<void>;

    // Event emitter methods
    on(event: 'clientEndpointClose', listener: () => void): this;
    once(event: 'clientEndpointClose', listener: () => void): this;
    off(event: 'clientEndpointClose', listener: () => void): this;
}

export abstract class BaseSession<T extends Transport = Transport> extends EventEmitter {
    protected sessionId: string;
    protected isActive: boolean = true;
    protected clientEndpoint: ClientEndpoint;
    private _transport: T;
    private transportType: string;
    private messageProcessor?: AuthorizedMessageProcessor;
    private authPayload?: any;

    constructor(sessionId: string, clientEndpoint: ClientEndpoint, transport: T, transportType: string, messageProcessor?: AuthorizedMessageProcessor) {
        super();
        this.sessionId = sessionId;
        this.clientEndpoint = clientEndpoint;
        this._transport = transport;
        this.transportType = transportType;
        this.messageProcessor = messageProcessor;
        this.authPayload = undefined;
    }

    get id(): string {
        return this.sessionId;
    }

    get transport(): T {
        return this._transport;
    }

    async start(): Promise<void> {
        try {
            await this.clientEndpoint.startSession(this);
            await this.transport.start();
            logger.debug(`Started ${this.transportType} session ${this.sessionId}`);
        } catch (error) {
            logger.error(`Error starting ${this.transportType} session ${this.sessionId}:`, error);
            throw error;
        }
    }

    async authorize(authHeader: string | undefined): Promise<any> {
        if (this.messageProcessor) {
            this.authPayload = await this.messageProcessor.authorize(authHeader);
        }
    }

    async forwardMessageToServer(message: JSONRPCMessage): Promise<void> {
        if (!this.isActive) return;
        logger.debug('[Session] Forwarding message to server (via client endpoint):', message);
        if (this.messageProcessor) {
            message = await this.messageProcessor.forwardMessageToServer(this.sessionId, message, this.authPayload);
        }
        await this.clientEndpoint.sendMessage(message);
    }
    
    async returnMessageToClient(message: JSONRPCMessage): Promise<void> {
        if (!this.isActive) return;
        logger.debug('[Session] Sending response to client (via server endpoint):', message);
        if (this.messageProcessor) {
            message = await this.messageProcessor.returnMessageToClient(this.sessionId, message, this.authPayload);
        }
        await this.transport.send(message);
    }

    async close(): Promise<void> {
        if (!this.isActive) return;
        this.isActive = false;
        logger.debug('Closing transport and session:', this.sessionId);
        // Close our transport first to prevent any more messages from being sent
        await this.transport.close();
        // Then close the client endpoint
        await this.clientEndpoint.closeSession();
    }

    async onClientEndpointClose(): Promise<void> {
        logger.debug(`Client endpoint closed for ${this.transportType} session ${this.sessionId}`);
        await this.close();
        // Server transports will be listening - they will remove the session from the session manager and do any other protocol-specific cleanup
        this.emit('clientEndpointClose');
    }
}