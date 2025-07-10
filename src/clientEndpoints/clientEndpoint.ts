import { JSONRPCMessage } from "@modelcontextprotocol/sdk/types";
import { Session } from "../serverEndpoints/session";
import { ClientEndpointConfig } from "../types/config";
import { SessionManager } from "../serverEndpoints/sessionManager";

export class ClientEndpointLogEntry {
    constructor(
        public readonly timestamp: Date,
        public readonly message: string) {}
}

export abstract class ClientEndpoint {
    protected config: ClientEndpointConfig;
    protected sessionManager: SessionManager;
    protected logEvents: ClientEndpointLogEntry[] = [];

    constructor(config: ClientEndpointConfig, sessionManager: SessionManager) {
        this.config = config;
        this.sessionManager = sessionManager;
    }

    abstract startSession(session: Session): Promise<void>;
    abstract sendMessage(message: JSONRPCMessage): Promise<void>;
    abstract closeSession(): Promise<void>;

    protected logEvent(message: string) {
        this.logEvents.push(new ClientEndpointLogEntry(new Date(), message));
        if (this.logEvents.length > 100) {
            this.logEvents.shift();
        }
    }

    getConfig(): ClientEndpointConfig {
        return this.config;
    }

    getLogEvents(): ClientEndpointLogEntry[] {
        return this.logEvents;
    }
}