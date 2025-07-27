import BrowserApp, { BrowserMCP, UserDetails as BrowserUserDetails } from '../../browser-rendering/src/browser.app'
import DocsApp, { CloudflareDocumentationMCP } from '../../docs-vectorize/src/docs-vectorize.app'
import SandboxApp, { ContainerManager, ContainerMcpAgent, UserContainer } from '../../sandbox-container/server/sandbox.server.app'
import BindingsApp, { WorkersBindingsMCP, UserDetails as BindingsUserDetails } from '../../workers-bindings/src/bindings.app'
import BuildsApp, { BuildsMCP, UserDetails as BuildsUserDetails } from '../../workers-builds/src/workers-builds.app'
import ObservabilityApp, { ObservabilityMCP, UserDetails as ObservabilityUserDetails } from '../../workers-observability/src/workers-observability.app'

export { BrowserMCP, BrowserUserDetails }
export { CloudflareDocumentationMCP }
export { ContainerManager, ContainerMcpAgent, UserContainer }
export { WorkersBindingsMCP, BindingsUserDetails }
export { BuildsMCP, BuildsUserDetails }
export { ObservabilityMCP, ObservabilityUserDetails }

const apps: Record<string, { fetch: (req: Request, env: Env, ctx: ExecutionContext) => Promise<Response> }> = {
  browser: BrowserApp,
  docs: DocsApp,
  sandbox: SandboxApp,
  bindings: BindingsApp,
  builds: BuildsApp,
  observability: ObservabilityApp,
}

export default {
  async fetch(req: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(req.url)
    const [, prefix, ...rest] = url.pathname.split('/')
    const handler = apps[prefix]
    if (!handler) {
      return new Response('Not found', { status: 404 })
    }

    const newUrl = new URL(req.url)
    const pathname = '/' + rest.filter(Boolean).join('/');
    newUrl.pathname = pathname;
    const newReq = new Request(newUrl.toString(), req)
    return handler.fetch(newReq, env, ctx)
  },
}
