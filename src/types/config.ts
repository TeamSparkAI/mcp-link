export type ProxyServerMode = 'sse' | 'stdio' | 'streamable';
export type ProxyClientMode = 'stdio' | 'sse' | 'streamable' | 'stdio-container';

export interface ContainerVolume {
    source: string;
    destination: string;
    options?: string;
}

export interface ProxyConfig {
    serverMode: ProxyServerMode;
    serverPort?: number;
    serverHost?: string;
    clientMode: ProxyClientMode;
    clientContainerImage?: string;
    clientEndpoint?: string;
    clientCommand?: string;
    env?: Record<string, string>;
    volumes?: string[];
    args?: string[];
}