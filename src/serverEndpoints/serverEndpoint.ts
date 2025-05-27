import { ClientEndpoint } from "../clientEndpoints/clientEndpoint";
import { ServerEndpointConfig } from "../types/config";
import { SessionManagerImpl } from "./sessionManager";
import logger from "../logger";
import { MessageProcessor } from "../types/messageProcessor";


export abstract class ServerEndpoint {
    protected readonly ONLY_CLIENT_ENDPOINT = "ONLY_CLIENT_ENDPOINT";
    protected clientEndpoints: Map<string, ClientEndpoint> = new Map();
    
    constructor(
        protected config: ServerEndpointConfig, 
        protected sessionManager: SessionManagerImpl) {
    }

    async addClientEndpoint(name: string, clientEndpoint: ClientEndpoint): Promise<void> {
        this.clientEndpoints.set(name, clientEndpoint);
    }

    async setClientEndpoint(clientEndpoint: ClientEndpoint): Promise<void> {
        this.addClientEndpoint(this.ONLY_CLIENT_ENDPOINT, clientEndpoint);
    }

    abstract start(messageProcessor?: MessageProcessor): Promise<void>;

    async stop(): Promise<void> {
        logger.info(`Stopping ${this.constructor.name} transport`);
        try {
            // Close all sessions (which will close their client endpoints)
            this.sessionManager.getSessions().forEach(session => session.close());
            // We wait for async shutdown of the client endpoints
            await new Promise(resolve => setTimeout(resolve, 1000));
            process.exit(0);
        } catch (error) {
            logger.error('Error stopping transport:', error);
            process.exit(1);
        }
    }
}