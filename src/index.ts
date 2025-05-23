import { createClientEndpoint } from './clientEndpoints/clientEndpointFactory';
import { createConfig } from './config';
import { SessionManagerImpl } from './serverEndpoints/sessionManager';
import { createServerEndpoint } from './serverEndpoints/serverEndpointFactory';
import { BridgeConfig } from './types/config';
import { ServerEndpoint } from './serverEndpoints/serverEndpoint';
import { JSONRPCMessage } from '@modelcontextprotocol/sdk/types';
import logger from './logger';

async function startBridge(config: BridgeConfig) : Promise<ServerEndpoint> {
    logger.info('Starting bridge in mode:', config.serverMode);

    const sessionManager = new SessionManagerImpl();

    const clientEndpoint = createClientEndpoint(config, sessionManager);

    const serverEndpoint = createServerEndpoint(config, clientEndpoint, sessionManager);
    await serverEndpoint.start();

    return serverEndpoint;
}

async function runBridge() {
    try {
        const config = createConfig();

        // Create a logging message processor as an example...
        config.messageProcessor = {
            forwardMessageToServer: async (message: JSONRPCMessage) => {
                logger.info('[MessageProcessor] Forwarding message to server', message);``
                return message;
            },
            returnMessageToClient: async (message: JSONRPCMessage) => {
                logger.info('[MessageProcessor] Returning message to client', message);
                return message;
            }
        }

        const serverEndpoint = await startBridge(config);

        process.on('unhandledRejection', (reason, promise) => {
            logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
        });

        process.on('uncaughtException', (error) => {
            logger.error('Uncaught Exception:', error);
        });

        process.on('SIGINT', () => {
            logger.info('SIGINT');
            serverEndpoint.stop();
        });

        process.on('SIGTERM', () => {
            logger.info('SIGTERM');
            serverEndpoint.stop();
        });

    } catch (error) {
        logger.error('Failed to start bridge:', error);
        process.exit(1);
    }
}

runBridge();