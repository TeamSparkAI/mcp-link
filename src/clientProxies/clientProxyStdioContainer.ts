import Docker, { Container, ContainerCreateOptions } from 'dockerode';
import { ProxiedMcpServer } from "./clientProxy";
import { jsonRpcError, Session } from "../serverTransports/session";
import { JSONRPCMessage } from "@modelcontextprotocol/sdk/types";
import { ReadBuffer, serializeMessage } from "@modelcontextprotocol/sdk/shared/stdio";
import { PassThrough } from 'stream';
import { ProxyConfig } from "../types/config";
import logger from "../logger";

const docker = new Docker();

export class ProxiedStdioContainerMcpServer implements ProxiedMcpServer {
    private image: string;
    private volumes: string[];
    private env: Record<string, string>;
    private args: string[];
    private container: Container | null = null;
    private stdinStream: NodeJS.ReadWriteStream | null = null;
    private activeSessions: Map<string, Session>;
  
    constructor(config: ProxyConfig) {
        if (!config.clientContainerImage) {
            throw new Error('Client container image is required');
        }
        this.image = config.clientContainerImage;
        this.volumes = config.volumes || [];
        this.env = config.env || {};
        this.args = config.args || [];
        this.activeSessions = new Map<string, Session>();
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
                    logger.info('Container stopped for sessionId:', containerSessionId);
                    const session = this.activeSessions.get(containerSessionId);
                    if (session) {
                        session.close();
                        this.activeSessions.delete(session.id);
                    }
                }
            });

            events.on('error', (err) => {
                logger.error('Error receiving Docker events:', err);
            });

            logger.info('Listening for Docker container stop events...');
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
                await session.returnMessage(message);
            } catch (error) {
                logger.error('Error parsing message:', error);
            }
        }
        });
    
        stdout.on('error', async (error: Error) => {
            logger.error('Container Error:', error);
            const errorMessage: JSONRPCMessage = jsonRpcError(error.toString());
            await session.returnMessage(errorMessage);
            stdout.removeAllListeners();
            stdout.end();
            readBuffer.clear();
        });
    
        stdout.on('end', () => {
            logger.info('Container stdout stream ended');
            stdout.removeAllListeners();
            readBuffer.clear();
        });
    }

    async initializeContainer(image: string, session: Session): Promise<{ container: Container, stdin: NodeJS.ReadWriteStream }> {
        try {
            logger.info('Creating new container:', image);
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

            logger.info('Creating container with options:', options);

            const container = await docker.createContainer(options);
            await container.start();
    
            const containerInfo = await container.inspect();
            logger.info('Started container:', containerInfo.Name);
        
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
        
            this.setupMessageHandling(stdout, session);
            logger.info('Container initialized and ready');
            return { container, stdin: stream };
        } catch (error) {
            logger.error('Error initializing container', image, error);
            throw error;
        }
    }
    
    async startSession(session: Session): Promise<void> {
        const { container, stdin } = await this.initializeContainer(this.image, session);
        this.container = container;
        this.stdinStream = stdin;
        this.activeSessions.set(session.id, session);
    }
  
    async sendMessage(message: JSONRPCMessage): Promise<void> {
        if (this.stdinStream) {
            const wireMessage = serializeMessage(message);
            logger.debug('Forwarding message to container stdin:', wireMessage);
            this.stdinStream.write(wireMessage);
        }
    }
  
    async closeSession(): Promise<void> {
        if (this.stdinStream) {
            this.stdinStream.end();
            this.stdinStream = null;
        }
        await this.container?.stop();
        await this.container?.remove();
        this.container = null;
    }
}