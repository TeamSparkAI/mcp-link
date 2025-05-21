import { createClientProxy } from './clientProxies/clientProxyFactory';
import { startSSETransport } from './serverTransports/sse';
import { startStdioTransport } from './serverTransports/stdio';
import { startStreamableTransport } from './serverTransports/streamable';
import { createConfig } from './config';
import logger from './logger';

async function startProxy() {
    try {
        const config = createConfig();
        logger.info('Starting proxy in mode:', config.serverMode);

        const clientProxy = createClientProxy(config);

        switch (config.serverMode) {
            case 'sse':
                await startSSETransport(config, clientProxy);
                break;
            case 'stdio':
                await startStdioTransport(config, clientProxy);
                break;
            case 'streamable':
                await startStreamableTransport(config, clientProxy);
                break;
            default:
                throw new Error(`Unsupported transport server mode: ${config.serverMode}`);
        }
    } catch (error) {
        logger.error('Failed to start proxy:', error);
        process.exit(1);
    }
}

startProxy();