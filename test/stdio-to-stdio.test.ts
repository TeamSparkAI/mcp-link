import { Client } from '@modelcontextprotocol/sdk/client/index';
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio";
import { CallToolResult } from "@modelcontextprotocol/sdk/types";
import { join } from 'path';

describe('MCP Bridge stdio->stdio', () => {
    let client: Client;
    let transport: StdioClientTransport;

    beforeAll(async () => {
        // Create MCP client with stdio transport
        transport = new StdioClientTransport({
            command: "node",
            args: [join(__dirname, '../dist/index.js'), '--serverMode=stdio', '--clientMode=stdio', '--command=npx', '@modelcontextprotocol/server-everything'],
            //stderr: "pipe"  // Pipe stderr instead of inheriting it
        });

        client = new Client({
            name: "test-client",
            version: "1.0.0"
        });

        await client.connect(transport);
    });

    afterAll(async () => {
        console.log('Cleaning up...');
        await client.close();
        await new Promise(resolve => setTimeout(resolve, 1000));
        console.log('Cleanup complete');
        client.complete
    });

    it('should successfully execute echo command', async () => {
        const result = await client.callTool({name: 'echo', arguments: { message: 'Hello, World!' }}) as CallToolResult;
        console.log('Got result:', result.content);
        expect(result.content).toBeDefined();
        expect(result.content?.[0]).toEqual({ type: 'text', text: 'Echo: Hello, World!' });
    });
});