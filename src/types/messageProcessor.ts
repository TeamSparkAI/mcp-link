import { JSONRPCMessage } from "@modelcontextprotocol/sdk/types";

export interface MessageProcessor {
    forwardMessageToServer(message: JSONRPCMessage): Promise<JSONRPCMessage>;
    returnMessageToClient(message: JSONRPCMessage): Promise<JSONRPCMessage>;
}