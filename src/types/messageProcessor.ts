import { JSONRPCMessage } from "@modelcontextprotocol/sdk/types";

export interface BaseMessageProcessor {
    forwardMessageToServer(sessionId: string, message: JSONRPCMessage): Promise<JSONRPCMessage>;
    returnMessageToClient(sessionId: string, message: JSONRPCMessage): Promise<JSONRPCMessage>;
}

export interface AuthorizedMessageProcessor {
    authorize(authHeader: string | undefined): Promise<any>;
    forwardMessageToServer(sessionId: string, message: JSONRPCMessage, authPayload: any): Promise<JSONRPCMessage>;
    returnMessageToClient(sessionId: string, message: JSONRPCMessage, authPayload: any): Promise<JSONRPCMessage>;
}

export type MessageProcessor = BaseMessageProcessor | AuthorizedMessageProcessor;