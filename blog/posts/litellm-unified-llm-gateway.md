---
title: "LiteLLM: The Unified LLM Gateway Your Kubernetes Cluster Needs"
date: "2026-06-29"
author: "Gary Innerarity"
description: "How LiteLLM gives you a single OpenAI-compatible API for 100+ LLM providers with virtual keys, spend tracking, load balancing, and componentized Kubernetes deployment."
tags: [litellm, kubernetes, llm-gateway, api-gateway, ai-infrastructure, engineering]
audio: ""
platformStacks: "https://github.com/ospf2fullstack/PlatformStacks/tree/main/litellm"
draft: true
---

# LiteLLM: The Unified LLM Gateway Your Kubernetes Cluster Needs

You're building an AI-powered application. You start with OpenAI. Then the team wants Claude for reasoning tasks. Then a stakeholder asks about Azure OpenAI for compliance. Then someone discovers that Bedrock's Llama models are cheaper for summarization. Before you know it, you have four different SDKs, four authentication patterns, four error-handling strategies, and four different billing dashboards. Welcome to LLM provider sprawl.

LiteLLM exists to solve this problem. It's an open-source AI gateway — a single proxy that exposes one OpenAI-compatible API endpoint and translates your requests to any of 100+ LLM providers behind the scenes. Your applications talk to one endpoint with one key format. LiteLLM handles the rest.

## The Problem: Provider Lock-In Without The Lock

The irony of modern LLM development is that most providers converge on similar API shapes, yet each one has just enough differences to make switching painful. Different auth headers. Different streaming formats. Different error codes. Different rate limit behaviors. Different pricing granularities.

This isn't a problem you solve once. It's a tax you pay every time you:
- Switch providers for cost optimization
- Add fallback providers for reliability
- Test new models before committing
- Onboard different teams with different budget constraints
- Route traffic based on latency or compliance requirements

An LLM gateway centralizes all of this into infrastructure rather than application code.

## What LiteLLM Actually Does

At its core, LiteLLM is three things:

**1. A unified API translation layer.** Send standard OpenAI-format requests. LiteLLM maps them to whatever provider-specific format the upstream needs — Anthropic's Messages API, Bedrock's InvokeModel, Vertex AI's predict endpoint, or any of the other 100+ supported backends.

**2. A policy engine.** Virtual keys, per-team budgets, rate limits, guardrails, and spend tracking. The kind of governance you need when multiple teams share LLM infrastructure.

**3. A routing and reliability layer.** Latency-based routing, provider fallbacks, load balancing across multiple deployments of the same model, and A/B testing via traffic mirroring.

All of this runs as a stateless proxy that adds approximately 8ms P95 latency overhead at 1,000 requests per second. That's the proxy tax — and for most workloads, it's negligible compared to the 500ms+ you're waiting for the LLM response itself.

## Architecture: The Componentized Deployment Model

Here's where LiteLLM gets interesting for Kubernetes operators. In May 2025, the team introduced a componentized deployment model that splits the proxy into three independent microservices:

| Component  | Port | Responsibility |
|-----------|------|----------------|
| **Gateway** | 4000 | LLM data plane — chat completions, embeddings, audio, batches |
| **Backend** | 4001 | Management API — virtual keys, teams, budgets, SSO, analytics |
| **UI**      | 3000 | Next.js admin dashboard served by nginx |

Why does this matter? Because in the original monolithic deployment, a single heavy analytics query on the management API could starve the event loop and cause LLM request timeouts on the data plane. With the componentized split, the gateway and backend are completely isolated. A backend pod crashing during a spend aggregation query never affects the gateway's ability to serve `/v1/chat/completions`.

Each service gets its own Deployment, Service, HPA, and health checks. Kubernetes can recycle a struggling backend without touching the data plane. The blast radius of any failure is contained to its own service boundary.

## Deploying on Kubernetes

### Prerequisites

You need three things before deploying LiteLLM:

1. **PostgreSQL** — Required (not optional). Virtual keys, spend tracking, team management, and rate limiting all depend on it. Without Postgres, LiteLLM starts but most production features are broken.
2. **Redis** — Recommended. Required for prompt caching and distributed rate limiting. Without it, each pod maintains its own local state, which defeats the purpose of a distributed gateway.
3. **At least one provider API key** — Obviously.

### The Config That Matters

LiteLLM's behavior is driven by a `proxy_config.yaml` file. Here's the skeleton:

```yaml
model_list:
  - model_name: gpt-4o
    litellm_params:
      model: openai/gpt-4o
      api_key: os.environ/OPENAI_API_KEY
  - model_name: claude-sonnet
    litellm_params:
      model: anthropic/claude-sonnet-4-20250514
      api_key: os.environ/ANTHROPIC_API_KEY

router_settings:
  routing_strategy: latency-based-routing
  fallbacks:
    - gpt-4o: [claude-sonnet]
  num_retries: 2
  timeout: 60
  allowed_fails: 3
  cooldown_time: 30

litellm_settings:
  drop_params: true
  cache: true
  cache_params:
    type: redis
    host: os.environ/REDIS_HOST
    ttl: 600

general_settings:
  master_key: os.environ/LITELLM_MASTER_KEY
  database_url: os.environ/DATABASE_URL
  max_budget: 10000
```

The `model_list` defines your available models. The `router_settings` define how traffic routes between them. The `fallbacks` config is the killer feature — when GPT-4o fails or times out, traffic automatically fails over to Claude with zero application changes.

### Helm Chart Deployment

The official Helm chart supports the componentized architecture out of the box:

```bash
helm repo add litellm https://berriai.github.io/litellm-helm
helm install litellm litellm/litellm \
  --namespace litellm \
  --values values.yaml
```

The chart runs `prisma migrate deploy` as a pre-install hook, then brings up the gateway, backend, and UI as independent deployments. An Ingress fronts all three behind a single host — data-plane paths route to the gateway, UI assets to nginx, and the management API to the backend.

## Real-World Patterns

### Multi-Team Cost Isolation

LiteLLM's virtual key system lets you issue API keys to different teams, each with their own budget ceiling:

- Team A (engineering): $5,000/month, access to GPT-4o and Claude
- Team B (marketing): $1,000/month, access to GPT-4o-mini only
- Team C (research): $10,000/month, access to all models

Each team sees only their own spend. Admins see everything. Budget alerts fire to Slack when teams approach their limits.

### Provider Fallback Chains

Production reliability requires fallback chains. If your primary provider has an outage (and they all do, eventually), traffic needs to route somewhere else automatically:

```yaml
fallbacks:
  - gpt-4o: [claude-sonnet, gpt-4o-mini]
  - claude-sonnet: [gpt-4o, claude-haiku]
```

This is the kind of logic that's painful to implement in application code but trivial in gateway configuration.

### Observability Pipeline

LiteLLM exposes Prometheus metrics at `/metrics` and supports callbacks to Langfuse, DataDog, and S3 for request logging. The callbacks run asynchronously after the response returns, so they don't add user-facing latency. This gives you:

- Token usage per model per team
- Latency distributions per provider
- Error rates and fallback triggers
- Cost attribution across projects

## Gotchas and Real-World Considerations

**PostgreSQL is not optional for production.** The documentation mentions it's "recommended," but in practice, anything beyond a single-developer setup needs it. Plan for a managed Postgres instance with solid backups.

**Stable images exist for a reason.** LiteLLM publishes `-stable` tagged Docker images that undergo 12-hour load tests before release. Use these in production, not `main-latest`.

**The monolithic deployment is fine for small teams.** The componentized split adds operational complexity. If you're running a single team with moderate traffic, the standard single-container deployment works perfectly well. The split becomes valuable when your analytics queries start affecting data-plane latency.

**Redis is required for distributed rate limiting.** If you run multiple gateway pods without Redis, each pod maintains its own rate limit counters. This means your actual rate limit is `N × configured_limit` where N is your pod count.

**Watch your connection pool.** Heavy spend-tracking writes can exhaust Postgres connections. The componentized deployment with a read replica helps — read-heavy operations route to the replica while writes hit the primary.

## Deploy It Yourself

Ready to deploy LiteLLM in your own environment? Full engineering documentation, Helm charts, Kubernetes manifests, and deployment guides are available in the [PlatformStacks repository](https://github.com/ospf2fullstack/PlatformStacks/tree/main/litellm).

👉 **[View Deployment Documentation →](https://github.com/ospf2fullstack/PlatformStacks/tree/main/litellm/README.md)**

You'll find production-ready values files, componentized Helm configuration, raw Kubernetes manifests for simpler setups, and automation scripts to get running quickly.

## What's Next

LiteLLM is evolving rapidly. The team recently added MCP (Model Context Protocol) gateway capabilities, memory management for cross-session user preferences, and guardrails for content moderation. The trajectory is clear: LiteLLM is moving from "just a proxy" to a full AI platform control plane.

For teams running multiple LLM-powered applications on Kubernetes, the question isn't whether you need an LLM gateway — it's whether you build one yourself or use something purpose-built. LiteLLM handles the translation, governance, and reliability layers so your engineering team can focus on what actually differentiates your product: the application logic on top.

---

*You can find the full deployment docs and Helm charts linked in the blog post or at [github.com/ospf2fullstack/PlatformStacks](https://github.com/ospf2fullstack/PlatformStacks/tree/main/litellm).*
