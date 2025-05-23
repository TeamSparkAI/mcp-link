import { ClientEndpoint } from "./clientEndpoint";
import { ClientEndpointSse } from "./clientEndpointSSE";
import { ClientEndpointStdioContainer } from "./clientEndpointStdioContainer";
import { ClientEndpointStdio } from "./clientEndpointStdio";
import { ClientEndpoiontStreamable } from "./clientEndpointStreamable";
import { BridgeConfig } from "../types/config";
import { SessionManager } from "../serverEndpoints/sessionManager";

export function createClientEndpoint(config: BridgeConfig, sessionManager: SessionManager): ClientEndpoint {
    switch (config.clientMode) {
        case 'stdio':
            return new ClientEndpointStdio(config, sessionManager);
        case 'sse':
            return new ClientEndpointSse(config, sessionManager);
        case 'streamable':
            return new ClientEndpoiontStreamable(config, sessionManager);
        case 'stdio-container':
            return new ClientEndpointStdioContainer(config, sessionManager);
        default:
            throw new Error(`Unsupported client mode: ${config.clientMode}`);
    }
}