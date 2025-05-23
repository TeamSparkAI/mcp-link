import { ClientEndpoint } from "../clientEndpoints/clientEndpoint";
import { BridgeConfig } from "../types/config";
import { SessionManagerImpl } from "./sessionManager";
import logger from "../logger";

export abstract class ServerEndpoint {
    constructor(
        protected config: BridgeConfig, 
        protected clientEndpoint: ClientEndpoint,
        protected sessionManager: SessionManagerImpl) {
    }

    abstract start(): Promise<void>;

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