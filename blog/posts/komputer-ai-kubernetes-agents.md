---
title: "Komputer.AI: Running Distributed Claude Agents as Kubernetes-Native Workloads"
date: "2026-07-06"
author: "Gary Innerarity"
description: "How Komputer.AI turns Claude AI agents into first-class Kubernetes resources with CRDs, persistent workspaces, and real-time event streaming"
tags: [komputer-ai, kubernetes, ai-agents, claude, operators, crd, distributed-systems]
audio: "/assets/audio/komputer-ai-kubernetes-agents.mp3"
platformStacks: "https://github.com/ospf2fullstack/PlatformStacks/tree/main/komputer-ai"
draft: true
---

# Komputer.AI: Running Distributed Claude Agents as Kubernetes-Native Workloads

You've got a Kubernetes cluster humming along. Deployments, services, ingress controllers, GitOps pipelines — the whole production stack. Now you want to run AI agents. Not a chatbot behind an API gateway. Actual persistent, autonomous agents that execute multi-step tasks, maintain state across sessions, coordinate with each other, and integrate with your existing tools.

The moment you try to bolt LLM agents onto Kubernetes the traditional way — maybe wrapping them in a Flask app, storing conversation state in a database, wiring up some job queue — you realize how much operational surface area you're creating. Agent lifecycle, workspace persistence, cost tracking, concurrency control, event streaming... it's a platform problem disguised as a deployment problem.

Komputer.AI solves this by making agents **first-class Kubernetes resources**. The same way you `kubectl apply` a Deployment, you `kubectl apply` a KomputerAgent. The operator handles the rest.

## What Komputer.AI Actually Is

Komputer.AI is a stateless, Kubernetes-native platform for running persistent Claude AI agents. It's built entirely on Custom Resource Definitions, a Kubernetes operator pattern, and the standard Kubernetes API. Agents aren't containers you happen to run on K8s — they're CRDs that the cluster manages natively.

The platform is MIT-licensed, written in Go (operator and API) and Python (agent runtime), and ships as a Helm chart you can deploy in under five minutes.

Here's what the architecture looks like:

```
┌──────────────────────────────────────────────────────────────┐
│                     Kubernetes Cluster                         │
├──────────────────────────────────────────────────────────────┤
│                                                                │
│  komputer-api ◄──► Redis (Events) ◄──► komputer-ui           │
│  (REST + WebSocket)                    (Dashboard)            │
│       │                                                        │
│       ▼                                                        │
│  komputer-operator                                            │
│  (Watches KomputerAgent CRDs)                                 │
│       │                                                        │
│       ├──► Agent Pod [1] + PVC (persistent workspace)         │
│       ├──► Agent Pod [2] + PVC                                │
│       └──► Agent Pod [N] + PVC                                │
│                                                                │
└──────────────────────────────────────────────────────────────┘
```

Six microservices, all containerized, all Kubernetes-native:

- **komputer-operator** (Go) — The reconciliation engine. Watches KomputerAgent CRs, provisions Pods and PVCs, manages the full agent lifecycle.
- **komputer-api** (Go) — REST + WebSocket gateway for creating agents, sending tasks, and streaming real-time events to consumers.
- **komputer-agent** (Python) — The actual agent runtime. Runs Claude with bash tools, web tools, and a persistent filesystem workspace that survives restarts.
- **komputer-ui** (TypeScript) — Web dashboard for managing agents, viewing costs, configuring connectors, and monitoring task execution.
- **komputer-cli** (Go) — Terminal-native interface for operators who prefer `kubectl`-style workflows.
- **komputer-sdk** (Python, Go, TypeScript) — Typed SDKs for programmatic integration.

## The Agent Lifecycle: From CRD to Running Task

This is where Komputer.AI clicks. The lifecycle is pure Kubernetes:

1. **Create** — You (or your CI pipeline, or another agent) creates a `KomputerAgent` Custom Resource via the API or `kubectl apply`.
2. **Reconcile** — The operator detects the new CR, provisions a PVC for the agent's persistent workspace, and creates a Pod.
3. **Execute** — The agent Pod starts, initializes Claude with the provided instructions, and begins working.
4. **Stream** — As the agent works, it publishes structured events to Redis — tool calls, intermediate messages, results, cost data.
5. **Consume** — The API reads events from Redis, updates the CR's status field (`InProgress`, `Complete`, `Failed`), and dispatches events via WebSocket to any connected clients.
6. **Persist** — After task completion, the Pod stays running (configurable). The workspace PVC retains all files. The agent accepts new tasks without cold-starting.

The key insight: the agent Pod is **persistent**. It doesn't spin up, do one thing, and die. It sleeps between tasks, wakes on demand, and maintains continuity of workspace and context. This is what separates Komputer.AI from running Claude in a one-shot Kubernetes Job.

## Why CRDs Matter Here

Making agents CRDs isn't just API aesthetics. It unlocks the entire Kubernetes ecosystem:

- **GitOps** — Store agent definitions in Git. Review changes in PRs. Roll out with ArgoCD or Flux.
- **RBAC** — Control who can create/delete agents using native Kubernetes roles.
- **Admission controllers** — Enforce policies (max cost, allowed models, required labels) before agents are created.
- **kubectl** — `kubectl get komputeragents`, `kubectl describe`, `kubectl logs` — your existing muscle memory works.
- **Observability** — CRD status fields give you a structured, queryable view of agent state without custom dashboards.

```yaml
apiVersion: komputer.ai/v1
kind: KomputerAgent
metadata:
  name: research-analyst
  namespace: komputer-ai
spec:
  model: claude-sonnet-4-6
  instructions: |
    Analyze the latest quarterly earnings reports for FAANG companies.
    Produce a comparative summary with key trends and outliers.
  workspace:
    storageSize: "5Gi"
  lifecycle:
    sleepAfterIdle: "15m"
    maxTaskDuration: "30m"
  skills:
    - financial-analysis
  connectors:
    - google-workspace-mcp
```

That's it. `kubectl apply -f agent.yaml` and you have a persistent Claude agent with a 5GiB workspace, financial analysis skills, and Google Workspace access.

## Manager/Worker Orchestration

Single agents are useful. Fleets of coordinated agents are transformative. Komputer.AI has first-class support for hierarchical orchestration:

A **manager agent** can programmatically create sub-agents, assign them specific tasks, monitor their progress, and synthesize their outputs. The sub-agents inherit configurable defaults but can be overridden at runtime.

```yaml
apiVersion: komputer.ai/v1
kind: KomputerAgent
metadata:
  name: project-lead
spec:
  model: claude-sonnet-4-6
  role: manager
  maxSubAgents: 5
  subAgentTemplate:
    model: claude-haiku-4-5-20251001
    workspace:
      storageSize: "2Gi"
  instructions: |
    Break this research project into sub-tasks.
    Delegate each to a worker agent.
    Synthesize their findings into a cohesive report.
```

The manager creates sub-agents as additional KomputerAgent CRs — which the operator reconciles into their own Pods. Everything stays within the Kubernetes resource model. No external orchestration framework. No message bus you have to operate separately.

## Real-Time Event Streaming

Every action an agent takes — every tool call, every message, every cost event — flows through Redis and out via WebSocket. Two delivery modes:

**Broadcast** — Every connected client sees every event. Good for dashboards, debugging, or single-consumer patterns.

**Consumer Groups** — Queue-style delivery where each event routes to exactly one consumer within a named group. This is how you build distributed processing pipelines without duplicate work.

```python
from komputer_ai.client import KomputerClient

client = KomputerClient("http://komputer-api:8080")

# Broadcast: see everything
for event in client.watch_agent("research-analyst"):
    print(f"[{event.type}] {event.payload}")

# Consumer group: distributed processing
for event in client.watch_agent("research-analyst", group="my-webhook-forwarder"):
    forward_to_slack(event)
```

The consumer group routing is Redis-coordinated and works across multiple API replicas. If you're running three instances of a downstream service, each event is delivered to exactly one instance — no deduplication logic required on your end.

## MCP Connectors: Plugging Into Your Stack

Agents need tools. Komputer.AI uses Model Context Protocol (MCP) connectors to give agents access to external services:

- **GitHub** — Read repos, create issues, review PRs
- **Slack** — Send messages, read channels, respond to threads
- **Google Workspace** — Access Drive, Calendar, Gmail
- **Atlassian** — Jira issues, Confluence pages
- **Notion** — Pages, databases, comments
- **Custom** — Any HTTP API via OAuth, bearer, or custom headers

Connectors are defined as their own CRDs, reusable across multiple agents:

```yaml
apiVersion: komputer.ai/v1
kind: KomputerConnector
metadata:
  name: github-mcp
spec:
  type: mcp
  server:
    url: "https://mcp.github.com"
  auth:
    type: oauth
    secretRef: github-oauth-secret
```

## The Gotchas: What to Know Before Deploying

**PVC storage class matters.** Agent workspaces use ReadWriteOnce PVCs. If your storage class doesn't support dynamic provisioning, agents will hang in `Pending`. On k3s/local-path, this just works. On cloud providers, ensure your default StorageClass is configured.

**Redis is the event backbone.** If Redis goes down, event streaming stops. The operator and agents continue functioning (they write to local state), but you lose real-time visibility until Redis recovers. For production, run Redis with persistence and consider a Sentinel or cluster topology.

**Cost tracking is per-API-key.** If you share a single Anthropic API key across all agents, cost attribution relies on Komputer.AI's internal tracking (which is task-level accurate). For billing isolation between teams, use separate API keys per namespace.

**Concurrency limits are global.** The `maxConcurrentAgents` setting applies cluster-wide. If you need per-namespace limits, you'll need to deploy multiple operator instances or use Kubernetes ResourceQuotas on the agent Pods themselves.

**Agent sleep/wake latency.** When an agent Pod sleeps (scales to zero resources but keeps the container), wake-up is near-instant. But if the Pod is actually evicted and needs to restart, there's a cold-start penalty of 5-15 seconds depending on image pull caching.

## When to Use Komputer.AI vs. Alternatives

Use Komputer.AI when:
- You want agents as managed Kubernetes resources with full GitOps support
- You need persistent, long-lived agents (not one-shot jobs)
- Manager/worker hierarchies are part of your design
- You're already invested in the Kubernetes ecosystem and want agents to fit naturally
- Cost tracking and concurrency control matter at the platform level

Consider alternatives (like Kelos, kagent, or raw Kubernetes Jobs) when:
- You need multi-model support beyond Claude
- Your agents are truly stateless (no persistent workspace needed)
- You want framework-agnostic agent execution (LangGraph, CrewAI, etc.)

## Deploy It Yourself

Ready to deploy Komputer.AI in your own cluster? Full engineering documentation, Helm charts, example manifests, and installation scripts are available in the [PlatformStacks repository](https://github.com/ospf2fullstack/PlatformStacks/tree/main/komputer-ai).

👉 [**View Deployment Documentation →**](https://github.com/ospf2fullstack/PlatformStacks/tree/main/komputer-ai/README.md)

The deployment guide covers prerequisites, Helm installation, CRD configuration, manager/worker patterns, MCP connector setup, and troubleshooting.

## What's Next

Komputer.AI represents a clear architectural direction: AI agents should be managed the same way we manage every other workload. Not as special snowflakes with bespoke orchestration, but as resources in the system we already operate.

The platform is actively developed, MIT-licensed, and ready for teams that want to go beyond single-agent experiments into production multi-agent systems — all without leaving the Kubernetes control plane.

You can find the full deployment docs and Helm charts linked in the blog post or at [github.com/ospf2fullstack/PlatformStacks](https://github.com/ospf2fullstack/PlatformStacks/tree/main/komputer-ai).
