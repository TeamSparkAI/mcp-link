import { JSONRPCMessage } from "@modelcontextprotocol/sdk/types";
import { Session } from "../serverTransports/session";

export interface ProxiedMcpServer {
    startSession(session: Session): Promise<void>;
    sendMessage(message: JSONRPCMessage): Promise<void>;
    closeSession(): Promise<void>;
}