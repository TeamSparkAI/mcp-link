import { ClientEndpoint } from "../clientEndpoints/clientEndpoint";
import { ClientEndpointConfig, ServerEndpointConfig } from "../types/config";
import { SessionManagerImpl } from "./sessionManager";
import logger, { setLogLevel } from "../logger";
import { AuthorizedMessageProcessor, MessageProcessor } from "../types/messageProcessor";
import { createClientEndpoint } from "../clientEndpoints/clientEndpointFactory";


export abstract class ServerEndpoint {
    protected readonly ONLY_CLIENT_ENDPOINT = "ONLY_CLIENT_ENDPOINT";
    protected clientEndpoints: Map<string, ClientEndpoint> = new Map();
    
    constructor(
        protected config: ServerEndpointConfig, 
        protected sessionManager: SessionManagerImpl
    ) {
        setLogLevel(config.logLevel || 'info');
    }

    async addClientEndpoint(name: string, clientEndpoint: ClientEndpointConfig): Promise<void> {
        logger.info(`Adding client endpoint ${name}`);
        this.clientEndpoints.set(name, createClientEndpoint(clientEndpoint, this.sessionManager));
    }

    async removeClientEndpoint(name: string): Promise<void> {
        logger.info(`Removing client endpoint ${name}`);
        // Find, close, and remove all sessions for this client endpoint
        const sessions = this.sessionManager.getSessions();
        for (const session of sessions) {
            if (session.serverName === name) {
                await session.close();
                this.sessionManager.removeSession(session.id);
            }
        }
        this.clientEndpoints.delete(name);
    }

    async setClientEndpoint(clientEndpoint: ClientEndpointConfig): Promise<void> {
        this.addClientEndpoint(this.ONLY_CLIENT_ENDPOINT, clientEndpoint);
    }

    getClientEndpoint(name: string): ClientEndpoint | undefined {
        return this.clientEndpoints.get(name);
    }

    getClientEndpoints(): Map<string, ClientEndpoint> {
        return this.clientEndpoints;
    }

    abstract start(messageProcessor?: AuthorizedMessageProcessor): Promise<void>;

    async stop(terminateProcess: boolean = true): Promise<void> {
        logger.info(`Stopping ${this.constructor.name} transport`);
        try {
            // Close all sessions (which will close their client endpoints)
            const sessions = this.sessionManager.getSessions();
            logger.debug(`Closing ${sessions.length} sessions`);
            await Promise.all(sessions.map(session => {
                logger.debug(`Closing session ${session.id}`);
                return session.close();
            }));
            logger.debug('Terminate process:', terminateProcess);
            if (terminateProcess) {
                logger.debug('Terminating process');
                process.exit(0);
            }
        } catch (error) {
            logger.error('Error stopping transport:', error);
            if (terminateProcess) {
                process.exit(1);
            } else {
                throw error;
            }
        }
    }
}