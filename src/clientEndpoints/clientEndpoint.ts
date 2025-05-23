import { JSONRPCMessage } from "@modelcontextprotocol/sdk/types";
import { Session } from "../serverEndpoints/session";

export interface ClientEndpoint {
    startSession(session: Session): Promise<void>;
    sendMessage(message: JSONRPCMessage): Promise<void>;
    closeSession(): Promise<void>;
}