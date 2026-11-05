import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import { createMcpServer } from '@/lib/server/mcp';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/** Public origin for links back to the app, as the client reached us (through the reverse proxy). */
function publicOrigin(request: Request): string {
    const url = new URL(request.url);
    const host = request.headers.get('x-forwarded-host')?.split(',')[0].trim() || url.host;
    const proto = request.headers.get('x-forwarded-proto')?.split(',')[0].trim() || url.protocol.slice(0, -1);
    return `${proto}://${host}`;
}

// POST /api/mcp — MCP server (Streamable HTTP) with the assistant's tools, for Claude, ChatGPT, Gemini
// and other MCP clients. Stateless with JSON responses: no sessions, every request gets its own server.
export async function POST(request: Request) {
    const server = createMcpServer(publicOrigin(request));
    const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
    await server.connect(transport);
    try {
        // In JSON mode this resolves once every response is in the body
        return await transport.handleRequest(request);
    } finally {
        await server.close();
    }
}

// Stateless: no server-to-client stream to open (GET) and no session to end (DELETE)
function methodNotAllowed() {
    return Response.json(
        { jsonrpc: '2.0', error: { code: -32000, message: 'Method not allowed.' }, id: null },
        { status: 405, headers: { Allow: 'POST' } },
    );
}

export { methodNotAllowed as GET, methodNotAllowed as DELETE };
