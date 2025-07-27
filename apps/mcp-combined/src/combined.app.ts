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
    '[https://playground.ai.cloudflare.com](https://playground.ai.cloudflare.com)',
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

### \`/browser\` – Browser Rendering Tools

Integrates tools powered by the Cloudflare Browser Rendering API to fetch web pages, convert them to markdown, and take screenshots.

| **Tool** | **Description** |
| :--- | :--- |
| <code>get_url_html_content</code> | Retrieves the HTML content of the specified URL. |
| <code>get_url_markdown</code> | Fetches the webpage content and converts it into Markdown format. |
| <code>get_url_screenshot</code> | Captures a screenshot of the webpage. Optionally, specify the viewport size. |

#### **Prompt Examples**
- \`Get the HTML content of https://example.com.\`
- \`Convert https://example.com to Markdown.\`
- \`Take a screenshot of https://example.com.\`

---

### \`/docs\` – Documentation Vectorize Tools

Connects to a Vectorize DB (indexed with the Cloudflare docs) to provide up-to-date reference information.

| **Category** | **Tool** | **Description** |
| :--- | :--- | :--- |
| **Cloudflare Documentation** | <code>search_cloudflare_documentation</code> | Search the Cloudflare documentation. |

#### **Prompt Examples**
- \`Do Cloudflare Workers costs depend on response sizes? I want to serve some images (map tiles) from an R2 bucket and I'm concerned about costs.\`
- \`How many indexes are supported in Workers Analytics Engine? Give an example using the Workers binding api.\`
- \`Can you give me some information on how to use the Workers AutoRAG binding\`

---

### \`/sandbox\` – Sandbox Container Tools

Integrates tools for running a secure, sandboxed container where your LLM can execute arbitrary code, such as Node or Python.

| **Category** | **Tool** | **Description** |
| :--- | :--- | :--- |
| **Container Lifecycle** | <code>container_initialize</code> | (Re)starts a container. Containers are ephemeral and don't save state. |
| | <code>container_ping</code> | Pings the container to check for connectivity. |
| **Filesystem** | <code>container_file_write</code> | Writes content to a file within the container. |
| | <code>container_files_list</code> | Lists all files and directories in the working directory. |
| | <code>container_file_read</code> | Reads the contents of a single file or directory. |
| | <code>container_file_delete</code> | Deletes a single file or directory. |
| **Execution** | <code>container_exec</code> | Runs a shell command inside the container. |

#### **Prompt Examples**
- \`Create a visualization using matplotlib. Run it in the container that you can start.\`
- \`Clone and explore this github repo: [repo link]. Setup and run the tests in your development environment.\`

---

### \`/bindings\` – Workers Bindings Tools

Integrates tools for managing resources in the Cloudflare Workers Platform, which you can connect to your Worker via Bindings.

| **Category** | **Tool** | **Description** |
| :--- | :--- | :--- |
| **Account** | <code>accounts_list</code> | List all accounts in your Cloudflare account |
| | <code>set_active_account</code> | Set active account to be used for tool calls that require accountId |
| **KV Namespaces** | <code>kv_namespaces_list</code> | List all of the kv namespaces in your Cloudflare account |
| | <code>kv_namespace_create</code> | Create a new kv namespace in your Cloudflare account |
| **Workers** | <code>workers_list</code> | List all Workers in your Cloudflare account |
| **R2 Buckets** | <code>r2_buckets_list</code> | List r2 buckets in your Cloudflare account |
| **D1 Databases** | <code>d1_databases_list</code> | List all of the D1 databases in your Cloudflare account |
| **Hyperdrive** | <code>hyperdrive_configs_list</code> | List Hyperdrive configurations in your Cloudflare account |


#### **Prompt Examples**
- \`List my Cloudflare accounts.\`
- \`Show me my KV namespaces.\`
- \`List my Cloudflare Workers.\`
- \`Show me my R2 buckets.\`
- \`List my D1 databases.\`

---

### \`/builds\` – Workers Builds Tools

Provides insights and management capabilities for your Cloudflare Workers Builds.

| **Category** | **Tool** | **Description** |
| :--- | :--- | :--- |
| **Workers Builds** | <code>workers_builds_set_active_worker</code> | Sets the active Worker ID for subsequent calls. |
| | <code>workers_builds_list_builds</code> | Lists builds for a Cloudflare Worker. |
| | <code>workers_builds_get_build</code> | Retrieves details for a specific build by its UUID. |
| | <code>workers_builds_get_build_logs</code> | Fetches the logs for a Cloudflare Workers build by its UUID. |

#### **Prompt Examples**
- \`Set my-worker as the active worker.\`
- \`List the last 5 builds for my worker 'my-ci-worker'.\`
- \`Did the latest build for worker frontend-app succeed?\`

---

### \`/observability\` – Workers Observability Tools

Integrates tools powered by Workers Observability to analyze logs and metrics from your Cloudflare Workers.

| **Category** | **Tool** | **Description** |
| :--- | :--- | :--- |
| **Workers Analytics** | <code>query_worker_observability</code> | Queries Workers Observability API to analyze logs and metrics. |
| **Schema Discovery** | <code>observability_keys</code> | Discovers available data fields in your Workers logs. |
| **Value Exploration** | <code>observability_values</code> | Finds available values for specific fields in Workers logs. |

#### **Prompt Examples**
- \`Can you tell me about any potential issues on this particular worker 'my-worker-name'?\`
- \`Show me the CPU time usage for my worker 'api-gateway' over the last 24 hours\`
- \`What were the top 5 countries by request count for my worker yesterday?\`

---

## Accessing the Combined MCP Server

To use this server, you must connect your MCP client to its primary URL:
**[https://mcp-server-cloudflare.hacolby.workers.dev](https://mcp-server-cloudflare.hacolby.workers.dev)**

If your MCP client has first-class support for remote servers (like the Cloudflare AI Playground), you can provide the server URL directly in its interface.

If your client does not yet support remote servers, you will need to use 'mcp-remote' in its configuration file to specify which servers your client can access.

\`\`\`json
{
	"mcpServers": {
		"my-combined-server": {
			"command": "npx",
			"args": ["mcp-remote", "[https://mcp-server-cloudflare.hacolby.workers.dev/sse](https://mcp-server-cloudflare.hacolby.workers.dev/sse)"]
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
