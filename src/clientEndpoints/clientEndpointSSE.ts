import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse";
import { ClientEndpoint } from "./clientEndpoint";
import { jsonRpcError, Session } from "../serverEndpoints/session";
import { JSONRPCMessage } from "@modelcontextprotocol/sdk/types";
import { ClientEndpointConfig } from "../types/config";
import { SessionManager } from "../serverEndpoints/sessionManager";
import logger from "../logger";

export class ClientEndpointSse implements ClientEndpoint {
    private endpoint: URL;
    private headers: Record<string, string>;
    private sseClient: SSEClientTransport | null = null;
    private sessionManager: SessionManager;
    
    constructor(config: ClientEndpointConfig, sessionManager: SessionManager) {
        this.sessionManager = sessionManager;
        if (!config.endpoint) {
            throw new Error('Client endpoint is required');
        }
        this.endpoint = new URL(config.endpoint);
        this.headers = config.endpointHeaders || {};
    }
  
    private createTransport() {
        // There is a nasty bug where when an SSE client transport loses connection, it will reconnect, but not renegotiate the MCP protocol, 
        // so the transport will be in a broken state and subsequent calls to fetch will fail.
        // https://github.com/modelcontextprotocol/typescript-sdk/issues/510    
        //
        // The workaround below is to intercept the session initialization fetch call to identify ones where the session will be corrupted
        // and recycle the transport accordingly.
        //
        // We would need to recycle the sseClient when this happens, which is complicated by the fact that the session has a reference to the
        // transport (versus a reference to the endpoint, which could forward the message to the transport).  That's a modestly good-sized 
        // refactor.
        //
        // !!! Ideally we should just fix this bug at the source and use the fixed lib.
        //
        let fetchCount: number = 0;

        const onEventSourceInitFetch = async (url: string | URL, init: RequestInit | undefined, headers?: Headers): Promise<Response> => {
            logger.debug(`[ClientEndpointSSE] onEventSourceInit, fetchCount: ${fetchCount}`);
            fetchCount++;
            if (fetchCount > 1) {
                // !!! Do whatever we need to do to trigger reconnect
                return new Response(null, { status: 400, statusText: 'SSE Connection terminated, will reconnect on next message' });
            } else {
                return fetch(url.toString(), { ...init, headers });
            }
        };

        if (Object.keys(this.headers).length > 0) {
            // Create a fetch wrapper that adds headers
            const fetchWithHeaders = (url: string | URL, init?: RequestInit) => {
                const headers = new Headers(init?.headers);
                Object.entries(this.headers).forEach(([key, value]) => {
                    headers.set(key, value);
                });
                return onEventSourceInitFetch(url, init, headers);
            };
            
            const transport = new SSEClientTransport(this.endpoint, {
                eventSourceInit: {
                    fetch: fetchWithHeaders
                }
            });

            return transport;
        } else {
            return new SSEClientTransport(this.endpoint, {
                eventSourceInit: {
                    fetch: (url, init) => {
                        return onEventSourceInitFetch(url, init);
                    }
                }
            });
        }
    }

    async startSession(session: Session): Promise<void> {  
        // Connect to the SSE endpoint
        logger.debug(`Connecting to SSE client endpoint: ${this.endpoint}`);
        this.sseClient = this.createTransport();
        await this.sseClient.start();

        this.sseClient.onmessage = async (message: JSONRPCMessage) => {
            logger.debug(`Received message from SSE client endpoint: ${message}`);
            await session.returnMessageToClient(message);
        };
  
        this.sseClient.onerror = async (error: Error) => {
            logger.error(`SSE client - Server Error: ${error}`);
            const errorMessage: JSONRPCMessage = jsonRpcError(error.toString());
            await session.returnMessageToClient(errorMessage);
        };

        this.sseClient.onclose = async () => {
            logger.debug('SSE client session closed');
            await session.onClientEndpointClose();
        };
    }
  
    async sendMessage(message: JSONRPCMessage): Promise<void> {
        if (this.sseClient) {
            logger.debug(`Forwarding message to SSE client endpoint: ${message}`);
            this.sseClient.send(message);
        }
    }
   
    async closeSession(): Promise<void> {
        await this.sseClient?.close();
        this.sseClient = null;
    }
}