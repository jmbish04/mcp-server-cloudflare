# Combined MCP Server

This worker exposes multiple MCP servers under a single Cloudflare Worker. Use the following path prefixes to access each server:

- `/browser` – Browser Rendering tools
- `/docs` – Documentation Vectorize tools
- `/sandbox` – Sandbox Container tools
- `/bindings` – Workers Bindings tools
- `/builds` – Workers Builds tools
- `/observability` – Workers Observability tools

Each server keeps its original endpoint structure. For example, to access the MCP API for browser rendering, use `/browser/mcp` and `/browser/sse`.
