import { MessageProcessor } from "./messageProcessor";

export type BridgeServerMode = 'sse' | 'stdio' | 'streamable';
export type BridgeClientMode = 'stdio' | 'sse' | 'streamable' | 'stdio-container';

export interface ContainerVolume {
    source: string;
    destination: string;
    options?: string;
}

export interface ServerEndpointConfig {
    mode: BridgeServerMode;
    port?: number;
    host?: string;
}

export interface ClientEndpointConfig {
    name?: string;
    mode: BridgeClientMode;
    endpoint?: string;
    endpointHeaders?: Record<string, string>;
    command?: string;
    env?: Record<string, string>;
    args?: string[];
    containerImage?: string;
    containerVolumes?: string[];
}

export interface BridgeConfig {
    server: ServerEndpointConfig;
    clients: ClientEndpointConfig[];
}