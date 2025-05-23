import { Client } from '@modelcontextprotocol/sdk/client/index';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse';
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio";
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp';
import { Transport } from '@modelcontextprotocol/sdk/shared/transport';
import { CallToolResult } from "@modelcontextprotocol/sdk/types";
import { ChildProcess, spawn } from 'child_process';
import { join } from 'path';

// Get the full path to server-everything (installed as a dev dependency which we run from the local code)
const serverEverythingPath = require.resolve('@modelcontextprotocol/server-everything/dist/index.js');

function getTestClient() {
    return new Client({
        name: "test-client",
        version: "1.0.0"
    });
}

async function sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function getBridgeStdioTransport(args: string[]) {
    return new StdioClientTransport({
        command: "tsx",
        args: [join(__dirname, '../src/index.js'), ...args],
    });
}

async function runBridgeServer(args: string[]): Promise<ChildProcess> {
    const server = spawn('tsx', [join(__dirname, '../src/index.js'), ...args]);
    // Wait for the server to start
    await sleep(1000);
    return server;
}

async function runEverythingServer(mode: string, testPort: number): Promise<ChildProcess> {
    const server = spawn('node', [serverEverythingPath, mode], {
        env: {
            ...process.env,
            PORT: testPort.toString()
        }
    });
    // Wait for the server to start
    await sleep(1000);
    return server;
}

async function terminateServer(server: ChildProcess) {
    server.kill();
    await sleep(1000);
}

describe('MCP Bridge', () => {
    describe('stdio->stdio', () => {
        let transport: Transport;
        const client = getTestClient();
        
        beforeAll(async () => {
            transport = getBridgeStdioTransport(['--serverMode=stdio', '--clientMode=stdio', '--command=node', serverEverythingPath]);
        });

        it('should successfully execute echo command', async () => {    
            await client.connect(transport);
            const result = await client.callTool({name: 'echo', arguments: { message: 'Hello, World!' }}) as CallToolResult;
            console.log('Got result:', result.content);
            expect(result.content).toBeDefined();
            expect(result.content?.[0]).toEqual({ type: 'text', text: 'Echo: Hello, World!' });
        });

        afterAll(async () => {
            console.log('Cleaning up...');
            await client.close();
            await sleep(1000);
            console.log('Cleanup complete');
        });
    });

    describe('stdio->sse', () => {
        let transport: Transport;
        const client = getTestClient();
        let server: ChildProcess;
        const testPort = 34567;

        beforeAll(async () => {
            server = await runEverythingServer('sse', testPort);
            transport = getBridgeStdioTransport(['--serverMode=stdio', '--clientMode=sse', '--endpoint=http://localhost:' + testPort + '/sse']);
        });

        it('should successfully execute echo command', async () => {
            await client.connect(transport);
            const result = await client.callTool({name: 'echo', arguments: { message: 'Hello, World!' }}) as CallToolResult;
            console.log('Got result:', result.content);
            expect(result.content).toBeDefined();
            expect(result.content?.[0]).toEqual({ type: 'text', text: 'Echo: Hello, World!' });
        });

        afterAll(async () => {
            // SSE server cleanup
            console.log('Cleaning up...');
            await client.close();
            await sleep(1000);
            await terminateServer(server);
            console.log('Cleanup complete');
        });
    });

    describe('stdio->streamable', () => {
        let transport: Transport;
        const client = getTestClient();
        let server: ChildProcess;
        const testPort = 34567;

        beforeAll(async () => {
            server = await runEverythingServer('streamableHttp', testPort);
            transport = getBridgeStdioTransport(['--serverMode=stdio', '--clientMode=streamable', '--endpoint=http://localhost:' + testPort + '/mcp']);
        });

        it('should successfully execute echo command', async () => {
            await client.connect(transport);
            const result = await client.callTool({name: 'echo', arguments: { message: 'Hello, World!' }}) as CallToolResult;
            console.log('Got result:', result.content);
            expect(result.content).toBeDefined();
            expect(result.content?.[0]).toEqual({ type: 'text', text: 'Echo: Hello, World!' });
        });

        afterAll(async () => {
            // SSE server cleanup
            console.log('Cleaning up...');
            await client.close();
            await sleep(1000);
            await terminateServer(server);
            console.log('Cleanup complete');
        });
    });

    describe('stdio->stdio-container', () => {
        let transport: Transport;
        const client = getTestClient();
        
        beforeAll(async () => {
            transport = getBridgeStdioTransport(['--serverMode=stdio', '--clientMode=stdio-container', '--image=mcp/everything']);
        });

        it('should successfully execute echo command', async () => {    
            await client.connect(transport);
            const result = await client.callTool({name: 'echo', arguments: { message: 'Hello, World!' }}) as CallToolResult;
            console.log('Got result:', result.content);
            expect(result.content).toBeDefined();
            expect(result.content?.[0]).toEqual({ type: 'text', text: 'Echo: Hello, World!' });
        });

        afterAll(async () => {
            console.log('Cleaning up...');
            await client.close(); // This SIGTERMs the stdio target (our app) but doesn't wait for it to exit, and we do an async shutdown of the container
            await sleep(15000); // It takes around 10 seconds for the container shutdown to complete
            console.log('Cleanup complete');
        });
    });

    describe('sse->stdio', () => {
        let transport: Transport;
        const client = getTestClient();
        let server: ChildProcess;
        const testPort = 34567;
        
        beforeAll(async () => {
            server = await runBridgeServer(['--serverMode=sse', '--port=' + testPort, '--clientMode=stdio', '--command=node', serverEverythingPath]);
            transport = new SSEClientTransport(new URL('http://localhost:' + testPort + '/sse'));
        });

        it('should successfully execute echo command', async () => {    
            await client.connect(transport);
            const result = await client.callTool({name: 'echo', arguments: { message: 'Hello, World!' }}) as CallToolResult;
            console.log('Got result:', result.content);
            expect(result.content).toBeDefined();
            expect(result.content?.[0]).toEqual({ type: 'text', text: 'Echo: Hello, World!' });
        });
        
        afterAll(async () => {
            console.log('Cleaning up...');
            await client.close();
            await sleep(1000);
            await terminateServer(server);
            console.log('Cleanup complete');
        });
    });

    describe('streamable->stdio', () => {
        let transport: Transport;
        const client = getTestClient();
        let server: ChildProcess;
        const testPort = 34567;
        
        beforeAll(async () => {
            server = await runBridgeServer(['--serverMode=streamable', '--port=' + testPort, '--clientMode=stdio', '--command=node', serverEverythingPath]);
            transport = new StreamableHTTPClientTransport(new URL('http://localhost:' + testPort + '/mcp'));
        });

        it('should successfully execute echo command', async () => {
            await client.connect(transport);
            const result = await client.callTool({name: 'echo', arguments: { message: 'Hello, World!' }}) as CallToolResult;
            console.log('Got result:', result.content);
            expect(result.content).toBeDefined();
            expect(result.content?.[0]).toEqual({ type: 'text', text: 'Echo: Hello, World!' });
        });
        
        afterAll(async () => {
            console.log('Cleaning up...');
            await client.close();
            await sleep(1000);
            await terminateServer(server);
            console.log('Cleanup complete');
        });
    });

    // Add remaining suites (cover all permutations):
    // - sse->sse
    // - sse->streamable
    // - sse->stdio-container
    // - streamable->sse
    // - streamable->streamable
    // - streamable->stdio-container
});