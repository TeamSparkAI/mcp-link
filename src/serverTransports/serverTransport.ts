import { ProxiedMcpServer } from "../clientProxies/clientProxy";
import { ProxyConfig } from "../types/config";
import { SessionManagerImpl } from "./sessionManager";
import logger from "../logger";

export abstract class ServerTransport {
    constructor(
        protected config: ProxyConfig, 
        protected proxiedMcpServer: ProxiedMcpServer,
        protected sessionManager: SessionManagerImpl) {
    }

    abstract start(): Promise<void>;

    async stop(): Promise<void> {
        logger.info(`Stopping ${this.constructor.name} transport`);
        try {
            // Close all sessions (which will close their proxied MCP servers)
            this.sessionManager.getSessions().forEach(session => session.close());
            // We wait for async shutdown of the proxied MCP servers
            await new Promise(resolve => setTimeout(resolve, 1000));
            process.exit(0);
        } catch (error) {
            logger.error('Error stopping transport:', error);
            process.exit(1);
        }
    }
}