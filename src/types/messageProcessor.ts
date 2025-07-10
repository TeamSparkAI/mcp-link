import { JSONRPCMessage } from "@modelcontextprotocol/sdk/types";

export interface BaseMessageProcessor {
    forwardMessageToServer(serverName: string | null, sessionId: string, message: JSONRPCMessage): Promise<JSONRPCMessage>;
    returnMessageToClient(serverName: string | null, sessionId: string, message: JSONRPCMessage): Promise<JSONRPCMessage>;
}

export interface AuthorizedMessageProcessor {
    authorize(serverName: string | null, authHeader: string | null): Promise<any>;
    forwardMessageToServer(serverName: string | null, sessionId: string, message: JSONRPCMessage, authPayload: any): Promise<JSONRPCMessage>;
    returnMessageToClient(serverName: string | null, sessionId: string, message: JSONRPCMessage, authPayload: any): Promise<JSONRPCMessage>;
}

export type MessageProcessor = BaseMessageProcessor | AuthorizedMessageProcessor;