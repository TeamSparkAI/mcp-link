import { Command } from 'commander';
import { ProxyConfig, ProxyServerMode, ProxyClientMode } from './types/config';
import logger from './logger';

import dotenv from 'dotenv';
dotenv.config();

function parseServerMode(envVar: string | undefined): ProxyServerMode {
    if (!envVar) {
        return 'stdio'; // Default mode
    }

    const mode = envVar.toLowerCase();
    if (mode === 'sse' || mode === 'stdio' || mode === 'streamable') {
        return mode;
    }

    logger.warn("Invalid server mode:", envVar);
    throw new Error(`Invalid server mode "${envVar}"`);
}

function parseClientMode(envVar: string | undefined): ProxyClientMode {
    if (!envVar) {
        return 'stdio-container'; // Default mode
    }

    const mode = envVar.toLowerCase();
    if (mode === 'stdio' || mode === 'sse' || mode === 'streamable' || mode === 'stdio-container') {
        return mode;
    }

    logger.warn("Invalid client mode:", envVar);
    throw new Error(`Invalid client mode "${envVar}"`);
}

interface CommandOptions {
    serverMode?: string;
    clientMode?: string;
    port?: string;
    host?: string;
    image?: string;
    endpoint?: string;
    command?: string;
    env: string[];
    volume: string[];
}

// Function to collect multiple values into an array
function collect(value: string, previous: string[]) {
    return previous.concat([value]);
}

export function createConfig(): ProxyConfig {
    // Create a new Command instance
    const program = new Command();

    // Configure the command line interface
    program
        .name('mcpbridge')
        .description('TeamSpark AI MCP Bridge')
        .option('--serverMode <mode>', 'Server mode (sse, stdio, streamable)', 'stdio')
        .option('--clientMode <mode>', 'Client mode (stdio, sse, streamable, stdio-container)', 'stdio-container')
        .option('--port <number>', 'Server port', '3000')
        .option('--host <string>', 'Server host', 'localhost')
        .option('--image <string>', 'Client container image')
        .option('--endpoint <string>', 'Client endpoint')
        .option('--command <string>', 'Client command')
        .option('--env <value>', 'Environment variable (key=value)', collect, [])
        .option('--volume <value>', 'Volume mapping', collect, [])
        .allowUnknownOption()
        .allowExcessArguments()
        .addHelpText('after', `
Examples:
  $ mcpbridge --serverMode=stdio --clientMode=stdio-container --image=mcp/fetch
  $ mcpbridge --image=mcp/fetch
  $ mcpbridge --serverMode=sse --port=8080 --image=mcp/fetch
  $ mcpbridge --serverMode=streamable --clientMode=stdio --command=npx mcp-fetch
        `);

    // Parse command line arguments
    program.parse();

    // Show help if no arguments provided
    if (process.argv.length <= 2) {
        program.help();
    }

    const options = program.opts<CommandOptions>();
    const args = program.args;

    return {
        serverMode: parseServerMode(options.serverMode || process.env.SERVER_MODE),
        serverPort: parseInt(options.port || process.env.PORT || '3000'),
        serverHost: options.host || process.env.HOST || 'localhost',
        clientMode: parseClientMode(options.clientMode || process.env.CLIENT_MODE),
        clientContainerImage: options.image || process.env.CONTAINER_IMAGE,
        clientEndpoint: options.endpoint || process.env.CLIENT_ENDPOINT,
        clientCommand: options.command || process.env.CLIENT_COMMAND,
        env: options.env.reduce((acc, curr) => {
            const [key, value] = curr.split('=');
            if (key && value) {
                acc[key] = value;
            }
            return acc;
        }, {} as Record<string, string>),
        volumes: options.volume,
        args: args,
    };
}
