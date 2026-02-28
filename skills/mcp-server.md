# MCP Server (Python)

A minimal Model Context Protocol (MCP) server exposing tools to any MCP-compatible host (Claude Desktop, Copilot, custom agents).

## Overview

MCP servers expose **tools**, **resources**, and **prompts** over a standard protocol. Hosts discover capabilities via the `tools/list` endpoint and invoke them via `tools/call`.

This skill covers the minimal Python implementation using the official `mcp` SDK (stdio transport).

## Setup

```bash
pip install mcp
```

## Minimal Server

```python
# server.py
from mcp.server import Server
from mcp.server.stdio import stdio_server
from mcp.types import Tool, TextContent
import json

app = Server("my-mcp-server")

# ── Register tools ─────────────────────────────────────────────
@app.list_tools()
async def list_tools() -> list[Tool]:
    return [
        Tool(
            name="get_weather",
            description="Get the current weather for a city.",
            inputSchema={
                "type": "object",
                "properties": {
                    "city": {
                        "type": "string",
                        "description": "City name, e.g. 'Austin, TX'"
                    }
                },
                "required": ["city"]
            }
        ),
        Tool(
            name="run_query",
            description="Run a read-only SQL query against the internal database.",
            inputSchema={
                "type": "object",
                "properties": {
                    "sql": {
                        "type": "string",
                        "description": "A SELECT statement."
                    }
                },
                "required": ["sql"]
            }
        )
    ]

# ── Handle tool calls ──────────────────────────────────────────
@app.call_tool()
async def call_tool(name: str, arguments: dict) -> list[TextContent]:
    if name == "get_weather":
        city = arguments["city"]
        # Replace with real weather API call
        result = f"Currently 72°F and sunny in {city}."
        return [TextContent(type="text", text=result)]

    if name == "run_query":
        sql = arguments["sql"]
        # Replace with real DB call; enforce read-only at the DB layer
        result = f"Query executed: {sql}\nRows returned: 0 (stub)"
        return [TextContent(type="text", text=result)]

    raise ValueError(f"Unknown tool: {name}")

# ── Entry point ────────────────────────────────────────────────
if __name__ == "__main__":
    import asyncio
    asyncio.run(stdio_server(app))
```

## Claude Desktop Config

Add to `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "my-mcp-server": {
      "command": "python",
      "args": ["/absolute/path/to/server.py"]
    }
  }
}
```

## Resource Exposure (Optional)

```python
from mcp.types import Resource

@app.list_resources()
async def list_resources() -> list[Resource]:
    return [
        Resource(
            uri="resource://docs/readme",
            name="README",
            description="Project readme.",
            mimeType="text/markdown"
        )
    ]

@app.read_resource()
async def read_resource(uri: str) -> str:
    if uri == "resource://docs/readme":
        with open("README.md") as f:
            return f.read()
    raise ValueError(f"Unknown resource: {uri}")
```

## Notes

- Use **stdio transport** for local/desktop hosts; use **SSE transport** for remote/web hosts.
- Tool `inputSchema` must be valid JSON Schema — the host uses it to validate arguments before calling.
- Never expose write operations without explicit confirmation flows; prefer read-only tools by default.
- Version your server name (`my-mcp-server/1.0`) to allow hosts to handle compatibility gracefully.
