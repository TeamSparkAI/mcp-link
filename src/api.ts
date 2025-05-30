import { createClientEndpoint } from "./clientEndpoints/clientEndpointFactory";
import { ServerEndpoint } from "./serverEndpoints/serverEndpoint";
import { createServerEndpoint } from "./serverEndpoints/serverEndpointFactory";
import { SessionManagerImpl } from "./serverEndpoints/sessionManager";
import { ClientEndpointConfig, ServerEndpointConfig } from "./types/config";
import logger from "./logger";
import { MessageProcessor } from "./types/messageProcessor";
import { MessageProcessorWrapper } from "./messageProcessorWrapper";

export { ServerEndpoint };

export async function startBridge(server: ServerEndpointConfig, clients: ClientEndpointConfig[], messageProcessor?: MessageProcessor) : Promise<ServerEndpoint> {
    logger.debug('Starting bridge in mode:', server.mode);

    const sessionManager = new SessionManagerImpl();

    const serverEndpoint = createServerEndpoint(server, sessionManager);

    if (clients.length == 0) {
        throw new Error('No clients configured');
    } else if (clients.length == 1 && !clients[0].name) {
        const clientEndpoint = createClientEndpoint(clients[0], sessionManager);
        serverEndpoint.setClientEndpoint(clientEndpoint);
    } else {
        for (const client of clients) {
            if (!client.name) {
                throw new Error('Client name is required for multiple clients');
            }
            const clientEndpoint = createClientEndpoint(client, sessionManager);
            serverEndpoint.addClientEndpoint(client.name!, clientEndpoint);
        }
    }

    await serverEndpoint.start(messageProcessor ? new MessageProcessorWrapper(messageProcessor) : undefined);

    return serverEndpoint;
}

export * from './types/config';
export * from './types/messageProcessor';