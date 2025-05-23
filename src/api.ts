
import { createClientEndpoint } from "./clientEndpoints/clientEndpointFactory";
import { ServerEndpoint } from "./serverEndpoints/serverEndpoint";
import { createServerEndpoint } from "./serverEndpoints/serverEndpointFactory";
import { SessionManagerImpl } from "./serverEndpoints/sessionManager";
import { BridgeConfig } from "./types/config";
import logger from "./logger";

export async function startBridge(config: BridgeConfig) : Promise<ServerEndpoint> {
    logger.info('Starting bridge in mode:', config.serverMode);

    const sessionManager = new SessionManagerImpl();

    const clientEndpoint = createClientEndpoint(config, sessionManager);

    const serverEndpoint = createServerEndpoint(config, clientEndpoint, sessionManager);
    await serverEndpoint.start();

    return serverEndpoint;
}

export * from './types/config';
export * from './types/messageProcessor';