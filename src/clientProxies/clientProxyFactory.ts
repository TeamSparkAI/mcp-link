import { ProxiedMcpServer } from "./clientProxy";
import { ProxiedSseMcpServer } from "./clientProxySSE";
import { ProxiedStdioContainerMcpServer } from "./clientProxyStdioContainer";
import { ProxiedStdioMcpServer } from "./clientProxyStdio";
import { ProxiedStreamableMcpServer } from "./clientProxyStreamable";
import { ProxyConfig } from "../types/config";
import { SessionManager } from "../serverTransports/sessionManager";

export function createClientProxy(config: ProxyConfig, sessionManager: SessionManager): ProxiedMcpServer {
    switch (config.clientMode) {
        case 'stdio':
            return new ProxiedStdioMcpServer(config, sessionManager);
        case 'sse':
            return new ProxiedSseMcpServer(config, sessionManager);
        case 'streamable':
            return new ProxiedStreamableMcpServer(config, sessionManager);
        case 'stdio-container':
            return new ProxiedStdioContainerMcpServer(config, sessionManager);
        default:
            throw new Error(`Unsupported client mode: ${config.clientMode}`);
    }
}