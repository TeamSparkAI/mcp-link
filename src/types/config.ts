import { MessageProcessor } from "./messageProcessor";

export type BridgeServerMode = 'sse' | 'stdio' | 'streamable';
export type BridgeClientMode = 'stdio' | 'sse' | 'streamable' | 'stdio-container';

export interface ContainerVolume {
    source: string;
    destination: string;
    options?: string;
}

export interface BridgeConfig {
    serverMode: BridgeServerMode;
    serverPort?: number;
    serverHost?: string;
    clientMode: BridgeClientMode;
    clientContainerImage?: string;
    clientEndpoint?: string;
    clientCommand?: string;
    env?: Record<string, string>;
    volumes?: string[];
    args?: string[];
    messageProcessor?: MessageProcessor;
}