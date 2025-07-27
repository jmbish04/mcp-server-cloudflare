import { Hono } from 'hono';
import { cors } from 'hono/cors';

// Import all the sub-applications
import BrowserApp, { BrowserMCP, UserDetails as BrowserUserDetails } from '../../browser-rendering/src/browser.app';
import DocsApp, { CloudflareDocumentationMCP } from '../../docs-vectorize/src/docs-vectorize.app';
import SandboxApp, { ContainerManager, ContainerMcpAgent, UserContainer } from '../../sandbox-container/server/sandbox.server.app';
import BindingsApp, { WorkersBindingsMCP, UserDetails as BindingsUserDetails } from '../../workers-bindings/src/bindings.app';
import BuildsApp, { BuildsMCP, UserDetails as BuildsUserDetails } from '../../workers-builds/src/workers-builds.app';
import ObservabilityApp, { ObservabilityMCP, UserDetails as ObservabilityUserDetails } from '../../workers-observability/src/workers-observability.app';

// >>> ADD THIS IMPORT for the UserDetails Durable Object CLASS itself <<<
import { UserDetails } from '../../packages/mcp-common/src/durable-objects/user_details.do';


// Re-export the necessary types and classes for the worker environment
export { BrowserMCP, BrowserUserDetails };
export { CloudflareDocumentationMCP };
export { ContainerManager, ContainerMcpAgent, UserContainer };
export { WorkersBindingsMCP, BindingsUserDetails };
export { BuildsMCP, BuildsUserDetails };
export { ObservabilityMCP, ObservabilityUserDetails };

// >>> ADD THIS EXPORT for the UserDetails Durable Object CLASS itself <<<
export { UserDetails }; // This makes the class directly discoverable by Wrangler


// Define the apps record as before
const apps: Record<string, { fetch: (req: Request, env: Env, ctx: ExecutionContext) => Promise<Response> }> = {
  browser: BrowserApp,
  docs: DocsApp,
  sandbox: SandboxApp,
  bindings: BindingsApp,
  builds: BuildsApp,
  observability: ObservabilityApp,
};

// Create a small Hono app just for the CORS middleware, this is a clean way to reuse it.
const corsApp = new Hono();
corsApp.use('*', cors({
  origin: '*',
  allowHeaders: ['Authorization', 'Content-Type'],
  allowMethods: ['POST', 'GET', 'OPTIONS'],
  maxAge: 86400, // Cache preflight response for 1 day
}));

export default {
  async fetch(req: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    // 1. Handle preflight (OPTIONS) requests first using the Hono cors middleware.
    if (req.method === 'OPTIONS') {
      const optionsResponse = await corsApp.request(req, env, ctx);
      if (optionsResponse.status === 204 || optionsResponse.headers.has('Access-Control-Allow-Origin')) {
        return optionsResponse;
      }
    }

    // 2. Proceed with your original routing logic for non-OPTIONS requests
    const url = new URL(req.url);
    const [, prefix, ...rest] = url.pathname.split('/');
    const handler = apps[prefix];

    if (!handler) {
      const notFoundResponse = new Response('Not found', { status: 404 });
      const finalResponse = await corsApp.request(req, env, ctx, notFoundResponse);
      return finalResponse;
    }

    const newUrl = new URL(req.url);
    const pathname = '/' + rest.filter(Boolean).join('/');
    newUrl.pathname = pathname;
    const newReq = new Request(newUrl.toString(), req);

    // 3. Create a re-mapped `env` object for the sub-application
    let subAppEnv = { ...env } as Env; // Start with the original env

    // Dynamically map the correct MCP_OBJECT based on the prefix
    switch (prefix) {
      case 'browser':
        // If browser-rendering uses a DO called MCP_OBJECT, map it here:
        subAppEnv.MCP_OBJECT = env.BROWSER_MCP_DO;
        subAppEnv.USER_DETAILS = env.USER_DETAILS_DO;
        break;
      case 'docs':
        subAppEnv.MCP_OBJECT = env.DOCS_MCP_DO;
        break;
      case 'sandbox':
        subAppEnv.MCP_OBJECT = env.SANDBOX_MCP_DO;
        subAppEnv.CONTAINER_MANAGER = env.CONTAINER_MANAGER_DO;
        subAppEnv.USER_CONTAINER = env.USER_CONTAINER_DO;
        break;
      case 'bindings':
        subAppEnv.MCP_OBJECT = env.BINDINGS_MCP_DO;
        subAppEnv.USER_DETAILS = env.USER_DETAILS_DO;
        break;
      case 'builds':
        subAppEnv.MCP_OBJECT = env.BUILDS_MCP_DO;
        subAppEnv.USER_DETAILS = env.USER_DETAILS_DO;
        break;
      case 'observability':
        subAppEnv.MCP_OBJECT = env.OBSERVABILITY_MCP_DO;
        subAppEnv.USER_DETAILS = env.USER_DETAILS_DO;
        break;
    }
    // Also ensure AI, Vectorize, KV, Metrics are passed through if needed by sub-apps
    // These generally have consistent binding names, so they are already on `env`.

    // 4. Fetch the response from the sub-application with the modified env
    const subAppResponse = await handler.fetch(newReq, subAppEnv, ctx);

    // 5. Apply CORS headers to the sub-application's response
    const finalResponse = await corsApp.request(req, env, ctx, subAppResponse);
    return finalResponse;
  },
};

// =========================================================================
// Add global type declarations for your Durable Objects and other bindings
// This is crucial for TypeScript to understand your `env` object.
// Place this in a d.ts file or at the top of your combined.app.ts
// =========================================================================
declare global {
  interface Env {
    // Durable Object Bindings from your combined wrangler.toml
    BROWSER_MCP_DO: DurableObjectNamespace;
    DOCS_MCP_DO: DurableObjectNamespace;
    SANDBOX_MCP_DO: DurableObjectNamespace;
    CONTAINER_MANAGER_DO: DurableObjectNamespace;
    USER_CONTAINER_DO: DurableObjectNamespace;
    BINDINGS_MCP_DO: DurableObjectNamespace;
    BUILDS_MCP_DO: DurableObjectNamespace;
    OBSERVABILITY_MCP_DO: DurableObjectNamespace;
    USER_DETAILS_DO: DurableObjectNamespace; // Shared

    // AI Binding
    AI: any; // Or specific AI types if you have them

    // Vectorize Binding
    VECTORIZE: VectorizeIndex;

    // KV Namespaces
    OAUTH_KV: KVNamespace;
    USER_BLOCKLIST: KVNamespace;

    // Analytics Engine
    MCP_METRICS: AnalyticsEngineDataset;

    // Vars
    ENVIRONMENT: string;
    MCP_SERVER_NAME: string;
    MCP_SERVER_VERSION: string;
    CLOUDFLARE_CLIENT_ID?: string; // Optional if placeholder
    CLOUDFLARE_CLIENT_SECRET?: string; // Optional if placeholder
    GIT_HASH?: string;
    SENTRY_DSN?: string;
  }
}
