import { BridgeConfig } from "../types/config";
import { ClientEndpoint } from "../clientEndpoints/clientEndpoint";
import { SessionManagerImpl } from "./sessionManager";
import { ServerEndpoint } from "./serverEndpoint";
import { ServerEndpointStdio } from "./serverEndpointStdio";
import { ServerEndpointSse } from "./serverEndpointSse";
import { ServerEndpointStreamable } from "./serverEndpointStreamable";

export function createServerEndpoint(config: BridgeConfig, clientEndpoint: ClientEndpoint, sessionManager: SessionManagerImpl): ServerEndpoint {
    switch (config.serverMode) {
        case 'stdio':
            return new ServerEndpointStdio(config, clientEndpoint, sessionManager);
        case 'sse':
            return new ServerEndpointSse(config, clientEndpoint, sessionManager);
        case 'streamable':
            return new ServerEndpointStreamable(config, clientEndpoint, sessionManager);
        default:
            throw new Error(`Unknown server transport: ${config.serverMode}`);
    }
}