import { ClientEndpoint } from "../clientEndpoints/clientEndpoint";
import { ServerEndpointConfig } from "../types/config";
import { SessionManagerImpl } from "./sessionManager";
import logger, { setLogLevel } from "../logger";
import { AuthorizedMessageProcessor, MessageProcessor } from "../types/messageProcessor";


export abstract class ServerEndpoint {
    protected readonly ONLY_CLIENT_ENDPOINT = "ONLY_CLIENT_ENDPOINT";
    protected clientEndpoints: Map<string, ClientEndpoint> = new Map();
    
    constructor(
        protected config: ServerEndpointConfig, 
        protected sessionManager: SessionManagerImpl
    ) {
        setLogLevel(config.logLevel || 'info');
    }

    async addClientEndpoint(name: string, clientEndpoint: ClientEndpoint): Promise<void> {
        this.clientEndpoints.set(name, clientEndpoint);
    }

    async setClientEndpoint(clientEndpoint: ClientEndpoint): Promise<void> {
        this.addClientEndpoint(this.ONLY_CLIENT_ENDPOINT, clientEndpoint);
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
            // We wait for async shutdown of the client endpoints
            //await new Promise(resolve => setTimeout(resolve, 1000));
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