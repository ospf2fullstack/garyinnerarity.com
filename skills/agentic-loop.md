# Agentic Loop Pattern

A minimal implementation of a plan-execute-observe loop suitable for tool-using LLM agents.

## Overview

The agentic loop is the core execution pattern for autonomous AI agents. The model iterates through:
1. **Think** — reason about the current state and available tools
2. **Act** — invoke a tool or produce a response
3. **Observe** — surface tool results back to the model context
4. **Repeat** — continue until a stopping condition is met

## Stopping Conditions

- Model returns a final answer (no tool call in response)
- Max iterations reached
- Hard-coded sentinel token detected
- External interrupt or user override

## Python Implementation

```python
import json
from openai import OpenAI

client = OpenAI()

def run_agent(system_prompt: str, user_message: str, tools: list, tool_map: dict, max_iterations: int = 10) -> str:
    """
    Minimal agentic loop.
    
    Args:
        system_prompt: Role and context for the agent.
        user_message:  Initial user query.
        tools:         List of tool schemas (OpenAI function-calling format).
        tool_map:      Dict mapping tool name -> callable.
        max_iterations: Safety ceiling on loop depth.
    
    Returns:
        Final model response as a string.
    """
    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user",   "content": user_message},
    ]

    for iteration in range(max_iterations):
        response = client.chat.completions.create(
            model="gpt-4o",
            messages=messages,
            tools=tools,
            tool_choice="auto",
        )

        message = response.choices[0].message
        messages.append(message)  # append assistant turn

        # Stopping condition — no tool call → final answer
        if not message.tool_calls:
            return message.content

        # Execute each tool call and append results
        for tool_call in message.tool_calls:
            fn_name   = tool_call.function.name
            fn_args   = json.loads(tool_call.function.arguments)
            fn_result = tool_map[fn_name](**fn_args)

            messages.append({
                "role":         "tool",
                "tool_call_id": tool_call.id,
                "content":      str(fn_result),
            })

    raise RuntimeError(f"Agent exceeded max_iterations ({max_iterations})")
```

## Minimal Tool Schema

```python
tools = [
    {
        "type": "function",
        "function": {
            "name": "search_web",
            "description": "Search the web and return a summary of top results.",
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {
                        "type": "string",
                        "description": "The search query."
                    }
                },
                "required": ["query"]
            }
        }
    }
]

tool_map = {
    "search_web": lambda query: f"Results for: {query}"  # replace with real implementation
}
```

## Usage

```python
result = run_agent(
    system_prompt="You are a research assistant. Use tools to answer questions accurately.",
    user_message="What is the current state of agentic AI frameworks in 2025?",
    tools=tools,
    tool_map=tool_map,
)
print(result)
```

## Notes

- Always append the full assistant message object (not just content) before tool results — this preserves the `tool_calls` field required by the API.
- Use `tool_choice="auto"` by default; switch to `"required"` if you need to force at least one tool call on a given turn.
- Log `iteration` count in production to surface runaway loops early.
