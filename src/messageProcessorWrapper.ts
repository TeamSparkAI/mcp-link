import { JSONRPCMessage } from "@modelcontextprotocol/sdk/types";
import { MessageProcessor, AuthorizedMessageProcessor } from "./types/messageProcessor";

export class MessageProcessorWrapper implements AuthorizedMessageProcessor {
    private processor: MessageProcessor;

    constructor(processor: MessageProcessor) {
        this.processor = processor;
    }

    async authorize(authHeader: string | undefined): Promise<any> {
        if ('authorize' in this.processor) {
            return this.processor.authorize(authHeader);
        }
        // For BaseMessageProcessor, return undefined as auth payload
        return undefined;
    }

    async forwardMessageToServer(sessionId: string, message: JSONRPCMessage, authPayload: any): Promise<JSONRPCMessage> {
        if ('authorize' in this.processor) {
            return this.processor.forwardMessageToServer(sessionId, message, authPayload);
        }
        // For BaseMessageProcessor, ignore authPayload
        return this.processor.forwardMessageToServer(sessionId, message);
    }

    async returnMessageToClient(sessionId: string, message: JSONRPCMessage, authPayload: any): Promise<JSONRPCMessage> {
        if ('authorize' in this.processor) {
            return this.processor.returnMessageToClient(sessionId, message, authPayload);
        }
        // For BaseMessageProcessor, ignore authPayload
        return this.processor.returnMessageToClient(sessionId, message);
    }
} 