import Docker, { Container, ContainerCreateOptions } from 'dockerode';
import { ClientEndpoint } from "./clientEndpoint";
import { jsonRpcError, Session } from "../serverEndpoints/session";
import { JSONRPCMessage } from "@modelcontextprotocol/sdk/types";
import { ReadBuffer, serializeMessage } from "@modelcontextprotocol/sdk/shared/stdio";
import { PassThrough } from 'stream';
import { ClientEndpointConfig } from "../types/config";
import { SessionManager } from "../serverEndpoints/sessionManager";
import logger from "../logger";

const docker = new Docker();

export class ClientEndpointStdioContainer extends ClientEndpoint {
    private image: string;
    private volumes: string[];
    private env: Record<string, string>;
    private args: string[];
    private container: Container | null = null;
    private stdinStream: NodeJS.ReadWriteStream | null = null;
    private sessions: Map<string, { container: Container, stdin: NodeJS.ReadWriteStream, pendingMessageId: number | null, stdout: PassThrough, stderr: PassThrough }> = new Map();
  
    constructor(config: ClientEndpointConfig, sessionManager: SessionManager) {
        super(config, sessionManager);
        if (!config.containerImage) {
            throw new Error('Client container image is required');
        }
        this.image = config.containerImage;
        this.volumes = config.containerVolumes || [];
        this.env = config.env || {};
        this.args = config.args || [];
        this.monitorContainerStop();
    }

    private async monitorContainerStop() {
        try {
            const events = await docker.getEvents({
            filters: {
                event: ['stop', 'die'],
                label: ['mcp.proxy=true'],
                type: ['container']
            }
            });

            events.on('data', (chunk) => {
                const event = JSON.parse(chunk.toString());
                if (event.Type === 'container' && event.Action === 'die') {
                    const containerSessionId = event.Actor.Attributes['mcp.sessionId'];
                    logger.debug('Container stopped for sessionId:', containerSessionId);
                    const session = this.sessionManager.getSession(containerSessionId);
                    if (session) {
                        session.onClientEndpointClose();
                    }
                }
            });

            events.on('error', (err) => {
                logger.error('Error receiving Docker events:', err);
            });

            logger.debug('Listening for Docker container stop events...');
        } catch (error) {
            logger.error('Error connecting to Docker event stream:', error);
        }
    }
  
    // Set up message handling for container stdout
    setupMessageHandling(stdout: PassThrough, session: Session) {
        const readBuffer = new ReadBuffer();
        
        stdout.on('data', async (chunk: Buffer) => {
            logger.debug('Received chunk:', chunk.toString());
            readBuffer.append(chunk);
            
            // Process any complete messages in the buffer
            while (true) {
                try {
                    const message = readBuffer.readMessage();
                    if (message === null) {
                        break;
                    }
                    
                    logger.debug('Sending message to session:', session.id);
                    await session.returnMessageToClient(message);
                } catch (error) {
                    logger.error('Error parsing message:', error);
                }
            }
        });
    
        stdout.on('error', async (error: Error) => {
            logger.error('Container Error:', error);
            const errorMessage: JSONRPCMessage = jsonRpcError(error.toString());
            await session.returnMessageToClient(errorMessage);
            stdout.removeAllListeners();
            stdout.end();
            readBuffer.clear();
        });
    
        stdout.on('end', () => {
            logger.debug('Container stdout stream ended');
            stdout.removeAllListeners();
            readBuffer.clear();
        });
    }

    async initializeContainer(image: string, session: Session): Promise<{ container: Container, stdin: NodeJS.ReadWriteStream, stdout: PassThrough, stderr: PassThrough }> {
        try {
            logger.debug('Creating new container:', image);
            const options: ContainerCreateOptions = {
                Image: image,
                OpenStdin: true,
                StdinOnce: true, // Required for stdin to work
                AttachStdin: true,
                AttachStdout: true,
                AttachStderr: true,
                Labels: {
                "mcp.proxy": "true",
                "mcp.sessionId": session.id
                },
                Cmd: this.args, // These args will be passed to the container's ENTRYPOINT
                Env: Object.entries(this.env).map(([key, value]) => `${key}=${value}`),
            }

            if (this.volumes.length > 0) {
                options.HostConfig = {
                    Binds: this.volumes
                }
            }

            logger.debug('Creating container with options:', options);

            const container = await docker.createContainer(options);
            await container.start();
    
            const containerInfo = await container.inspect();
            logger.debug('Started container:', containerInfo.Name);
        
            const stream = await container.attach({
                stream: true,
                stdin: true,
                stdout: true,
                stderr: true,
                hijack: true, // Required for stdin to work
            });
            
            // Demultiplex the stream into stdout and stderr
            const stdout = new PassThrough();
            const stderr = new PassThrough();
            docker.modem.demuxStream(stream, stdout, stderr);
        
            logger.debug('[initializeContainer] Setting up message handling');
            this.setupMessageHandling(stdout, session);

            return { container, stdin: stream, stdout, stderr };
        } catch (error) {
            logger.error('Error initializing container:', error);
            throw error;
        }
    }
    
    async startSession(session: Session): Promise<void> {
        logger.debug('[startSession] Starting session');
        const { container, stdin, stdout, stderr } = await this.initializeContainer(this.image, session);
        let pendingMessageId: number | null = null;
        this.sessions.set(session.id, { container, stdin, pendingMessageId, stdout, stderr });
        logger.debug('[startSession] Container initialized, setting up session');
        logger.debug('[startSession] Session setup complete');
    }

    async sendMessage(session: Session, message: JSONRPCMessage): Promise<void> {
        const entry = this.sessions.get(session.id);
        if (entry) {
            const wireMessage = serializeMessage(message);
            logger.debug('Forwarding message to container stdin:', wireMessage);
            if ('id' in message && typeof message.id === 'number') {
                entry.pendingMessageId = message.id;
            }
            entry.stdin.write(wireMessage);
        } else {
            logger.error('No container session found for session:', session.id);
        }
    }

    async closeSession(session: Session): Promise<void> {
        const entry = this.sessions.get(session.id);
        if (entry) {
            entry.stdin.end();
            await entry.container.stop();
            await entry.container.remove();
            this.sessions.delete(session.id);
        } else {
            logger.debug('No container session to close for session:', session.id);
        }
    }
}