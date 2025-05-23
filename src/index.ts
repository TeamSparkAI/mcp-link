import { createClientProxy } from './clientProxies/clientProxyFactory';
import { createConfig } from './config';
import { SessionManagerImpl } from './serverTransports/sessionManager';
import { createServerTransport } from './serverTransports/serverTransportFactory';
import logger from './logger';

async function startBridge() {
    try {
        const config = createConfig();
        logger.info('Starting bridge in mode:', config.serverMode);

        const sessionManager = new SessionManagerImpl();

        const clientProxy = createClientProxy(config, sessionManager);

        const serverTransport = createServerTransport(config, clientProxy, sessionManager);
        await serverTransport.start();

        process.on('unhandledRejection', (reason, promise) => {
            logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
        });

        process.on('uncaughtException', (error) => {
            logger.error('Uncaught Exception:', error);
        });

        process.on('SIGINT', () => {
            logger.info('SIGINT');
            serverTransport.stop();
        });

        process.on('SIGTERM', () => {
            logger.info('SIGTERM');
            serverTransport.stop();
        });

    } catch (error) {
        logger.error('Failed to start bridge:', error);
        process.exit(1);
    }
}

startBridge();