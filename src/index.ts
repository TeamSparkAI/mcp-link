import { startBridge } from './api';
import { createConfig } from './config';
import { JSONRPCMessage } from '@modelcontextprotocol/sdk/types';
import logger from './logger';

async function runBridge() {
    try {
        // Create a logging message processor as an example...
        const messageProcessor = {
            forwardMessageToServer: async (sessionId: string, message: JSONRPCMessage) => {
                logger.info('[MessageProcessor] Forwarding message to server', message);``
                return message;
            },
            returnMessageToClient: async (sessionId: string, message: JSONRPCMessage) => {
                logger.info('[MessageProcessor] Returning message to client', message);
                return message;
            }
        }

        const config = createConfig();
        const serverEndpoint = await startBridge(config.server, config.clients, messageProcessor);

        process.on('unhandledRejection', (reason, promise) => {
            logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
        });

        process.on('uncaughtException', (error) => {
            logger.error('Uncaught Exception:', error);
        });

        process.on('SIGINT', () => {
            logger.debug('SIGINT');
            serverEndpoint.stop();
        });

        process.on('SIGTERM', () => {
            logger.debug('SIGTERM');
            serverEndpoint.stop();
        });

    } catch (error) {
        logger.error('Failed to start bridge:', error);
        process.exit(1);
    }
}

runBridge();