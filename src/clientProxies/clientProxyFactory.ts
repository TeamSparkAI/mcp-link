import { ProxiedMcpServer } from "./clientProxy";
import { ProxiedSseMcpServer } from "./clientProxySSE";
import { ProxiedStdioContainerMcpServer } from "./clientProxyStdioContainer";
import { ProxiedStdioMcpServer } from "./clientProxyStdio";
import { ProxiedStreamableMcpServer } from "./clientProxyStreamable";
import { ProxyConfig } from "../types/config";

export function createClientProxy(config: ProxyConfig): ProxiedMcpServer {
    switch (config.clientMode) {
        case 'stdio':
            return new ProxiedStdioMcpServer(config);
        case 'sse':
            return new ProxiedSseMcpServer(config);
        case 'streamable':
            return new ProxiedStreamableMcpServer(config);
        case 'stdio-container':
            return new ProxiedStdioContainerMcpServer(config);
        default:
            throw new Error(`Unsupported client mode: ${config.clientMode}`);
    }
}