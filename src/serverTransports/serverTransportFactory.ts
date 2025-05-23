import { ProxyConfig } from "../types/config";
import { ProxiedMcpServer } from "../clientProxies/clientProxy";
import { SessionManagerImpl } from "./sessionManager";
import { ServerTransport } from "./serverTransport";
import { ServerTransportStdio } from "./serverTransportStdio";
import { ServerTransportSse } from "./serverTransportSse";
import { ServerTransportStreamable } from "./serverTransportStreamable";

export function createServerTransport(config: ProxyConfig, proxiedMcpServer: ProxiedMcpServer, sessionManager: SessionManagerImpl): ServerTransport {
    switch (config.serverMode) {
        case 'stdio':
            return new ServerTransportStdio(config, proxiedMcpServer, sessionManager);
        case 'sse':
            return new ServerTransportSse(config, proxiedMcpServer, sessionManager);
        case 'streamable':
            return new ServerTransportStreamable(config, proxiedMcpServer, sessionManager);
        default:
            throw new Error(`Unknown server transport: ${config.serverMode}`);
    }
}