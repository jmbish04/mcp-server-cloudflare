import { Hono } from 'hono'; // We'll re-introduce Hono here for its utility, specifically the cors middleware's logic.
import { cors } from 'hono/cors'; // Import the cors middleware directly

import BrowserApp, { BrowserMCP, UserDetails as BrowserUserDetails } from '../../browser-rendering/src/browser.app'
import DocsApp, { CloudflareDocumentationMCP } from '../../docs-vectorize/src/docs-vectorize.app'
import SandboxApp, { ContainerManager, ContainerMcpAgent, UserContainer } from '../../sandbox-container/server/sandbox.server.app'
import BindingsApp, { WorkersBindingsMCP, UserDetails as BindingsUserDetails } from '../../workers-bindings/src/bindings.app'
import BuildsApp, { BuildsMCP, UserDetails as BuildsUserDetails } from '../../workers-builds/src/workers-builds.app'
import ObservabilityApp, { ObservabilityMCP, UserDetails as ObservabilityUserDetails } from '../../workers-observability/src/workers-observability.app'

// Re-exporting the MCP types and classes as before
export { BrowserMCP, BrowserUserDetails }
export { CloudflareDocumentationMCP }
export { ContainerManager, ContainerMcpAgent, UserContainer }
export { WorkersBindingsMCP, BindingsUserDetails }
export { BuildsMCP, BuildsUserDetails }
export { ObservabilityMCP, ObservabilityUserDetails }

// Define the apps record as before
const apps: Record<string, { fetch: (req: Request, env: Env, ctx: ExecutionContext) => Promise<Response> }> = {
  browser: BrowserApp,
  docs: DocsApp,
  sandbox: SandboxApp,
  bindings: BindingsApp,
  builds: BuildsApp,
  observability: ObservabilityApp,
}

// Create a small Hono app just for the CORS middleware, this is a clean way to reuse it.
const corsApp = new Hono();
corsApp.use('*', cors({
  origin: [
    'https://playground.ai.cloudflare.com',
    'http://localhost:6274' // For local MCP Inspector
  ],
  allowHeaders: ['Authorization', 'Content-Type'],
  allowMethods: ['POST', 'GET', 'OPTIONS'],
  maxAge: 86400, // Cache preflight response for 1 day
}));

export default {
  async fetch(req: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    // 1. Handle preflight (OPTIONS) requests first using the Hono cors middleware.
    // The Hono cors middleware will automatically respond to OPTIONS requests if applicable.
    // We create a temporary Hono instance to run the middleware on the current request.
    if (req.method === 'OPTIONS') {
      const optionsResponse = await corsApp.request(req, env, ctx);
      // If the cors middleware handled it, it will return a 204 or similar.
      // If it's a valid preflight, it will have the necessary headers.
      if (optionsResponse.status === 204 || optionsResponse.headers.has('Access-Control-Allow-Origin')) {
        return optionsResponse;
      }
    }

    // 2. Proceed with your original routing logic for non-OPTIONS requests
    const url = new URL(req.url)
    const [, prefix, ...rest] = url.pathname.split('/')
    const handler = apps[prefix]

    if (!handler) {
      // If no handler is found, we should still apply CORS headers to the 404 response
      const notFoundResponse = new Response('Not found', { status: 404 });
      const finalResponse = await corsApp.request(req, env, ctx, notFoundResponse); // Apply CORS to the 404 response
      return finalResponse;
    }

    const newUrl = new URL(req.url)
    const pathname = '/' + rest.filter(Boolean).join('/');
    newUrl.pathname = pathname;
    const newReq = new Request(newUrl.toString(), req)

    // 3. Fetch the response from the sub-application
    const subAppResponse = await handler.fetch(newReq, env, ctx);

    // 4. Apply CORS headers to the sub-application's response
    // We use the corsApp's request method again, passing the subAppResponse as the initial response.
    // This allows the middleware to add/modify headers as needed.
    const finalResponse = await corsApp.request(req, env, ctx, subAppResponse);
    return finalResponse;
  },
}
