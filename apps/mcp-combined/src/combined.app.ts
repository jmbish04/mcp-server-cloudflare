import { Hono } from 'hono';
import { cors } from 'hono/cors';

// Import all the sub-applications
import browserApp from '../../browser-rendering/src/browser.app';
import docsApp from '../../docs-vectorize/src/docs-vectorize.app';
import sandboxApp from '../../sandbox-container/server/sandbox.server.app';
import bindingsApp from '../../workers-bindings/src/bindings.app';
import buildsApp from '../../workers-builds/src/workers-builds.app';
import observabilityApp from '../../workers-observability/src/workers-observability.app';

// Re-export the necessary types and classes for the worker environment
export { BrowserMCP, BrowserUserDetails } from '../../browser-rendering/src/browser.app';
export { CloudflareDocumentationMCP } from '../../docs-vectorize/src/docs-vectorize.app';
export { ContainerManager, ContainerMcpAgent, UserContainer } from '../../sandbox-container/server/sandbox.server.app';
export { WorkersBindingsMCP, BindingsUserDetails } from '../../workers-bindings/src/bindings.app';
export { BuildsMCP, BuildsUserDetails } from '../../workers-builds/src/workers-builds.app';
export { ObservabilityMCP, ObservabilityUserDetails } from '../../workers-observability/src/workers-observability.app';

const app = new Hono();

/**
 * Apply CORS middleware to all routes.
 * This will automatically handle the OPTIONS preflight requests and add
 * the necessary headers to allow connections from the AI Playground and local Inspector.
 */
app.use('*', cors({
  origin: [
    'https://playground.ai.cloudflare.com',
    'http://localhost:6274' // For local MCP Inspector
  ],
  allowHeaders: ['Authorization', 'Content-Type'],
  allowMethods: ['POST', 'GET', 'OPTIONS'],
  maxAge: 86400, // Optional: Cache preflight response for 1 day
}));

/**
 * Defines a root handler to show the comprehensive welcome message.
 */
app.get('/', (c) => {
  return c.text(`# Combined MCP Server

This worker exposes multiple, powerful Model Context Protocol (MCP) servers under a single Cloudflare Worker, allowing you to connect to Cloudflare's services from an MCP client (e.g., Cursor, Claude) and use natural language to accomplish a wide range of tasks.

This combined server allows your MCP Client to read configurations from your account, process information, make suggestions based on data, and even make those suggested changes for you. All of these actions can happen across Cloudflare's many services, including application development, security, and performance.

## Exposed Services

Use the following path prefixes to access the tools from each specialized server. Each server keeps its original endpoint structure. For example, to access the MCP API for browser rendering, use /browser/mcp and /browser/sse.

---

### /sandbox – Sandbox Container tools

Integrates tools for running a secure, sandboxed container where your LLM can execute arbitrary code, such as Node or Python.

| **Category** | **Tool** | **Description** |
| :--- | :--- | :--- |
| **Container Lifecycle** | container_initialize | (Re)starts a container. Containers are intended to be ephemeral, don't save state, and are only guaranteed to last for about 10 minutes. |
| | container_ping | Pings the container to check for connectivity. |
| **Filesystem** | container_file_write | Writes content to a file within the container. |
| | container_files_list | Lists all files and directories in the working directory. |
| | container_file_read | Reads the contents of a single file or directory. |
| | container_file_delete | Deletes a single file or directory. |
| **Execution** | container_exec | Runs a shell command inside the container. |

---
*More server details will be added here in the same format (e.g., for /browser, /docs, etc.) as their READMEs become available.*
---

## Accessing the Combined MCP Server

To use this server, you must connect your MCP client to its primary URL:
**https://mcp-server-cloudflare.hacolby.workers.dev**

If your MCP client has first-class support for remote servers (like the Cloudflare AI Playground), you can provide the server URL directly in its interface.

If your client does not yet support remote servers, you will need to use 'mcp-remote' in its configuration file to specify which servers your client can access.

\`\`\`json
{
	"mcpServers": {
		"my-combined-server": {
			"command": "npx",
			"args": ["mcp-remote", "https://mcp-server-cloudflare.hacolby.workers.dev/sse"]
		}
	}
}
\`\`\`

Once configured, restart your MCP client. A browser window will open for the OAuth login flow. After you grant access, all the combined tools will become available to use.`);
});


// Route requests to the appropriate sub-application
app.route('/browser', browserApp);
app.route('/docs', docsApp);
app.route('/sandbox', sandboxApp);
app.route('/bindings', bindingsApp);
app.route('/builds', buildsApp);
app.route('/observability', observabilityApp);

export default app;
