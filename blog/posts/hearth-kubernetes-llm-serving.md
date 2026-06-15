---
title: "Hearth: The Kubernetes Operator That Makes Your Idle GPUs Stop Burning Money"
date: "2026-06-15"
author: "Gary Innerarity"
description: "Hearth is a vendor-neutral Kubernetes operator that brings declarative scale-to-zero LLM serving to your private cluster — one CRD, KEDA, and zero idle GPU costs."
tags: [hearth, kubernetes, llm-serving, keda, scale-to-zero, vllm, engineering]
audio: "/assets/audio/hearth-kubernetes-llm-serving.mp3"
platformStacks: "https://github.com/ospf2fullstack/PlatformStacks/tree/main/hearth-kubernetes-llm-serving"
draft: true
---

# Hearth: The Kubernetes Operator That Makes Your Idle GPUs Stop Burning Money

If you've ever self-hosted an open-source LLM on Kubernetes, you already know the pain: a GPU pinned to a model that gets traffic three hours a day still costs you twenty-four hours a day. You're paying for silence. And if you're running models like Qwen, DeepSeek, or GLM — or deploying on anything other than NVIDIA — the serving ecosystem wasn't built with you in mind.

**Hearth** changes that equation entirely.

## What is Hearth?

Hearth is a lightweight Kubernetes operator that turns "run an open-source LLM on my private cluster" into a single `LLMService` manifest. It provides three things that the LLM-on-K8s ecosystem has been missing at the small-to-medium scale:

1. **Declarative lifecycle management** — one CRD defines your model, scaling policy, and hardware preferences
2. **Scale-to-zero via KEDA** — idle models hold zero accelerators; your bill drops to zero when there's no traffic
3. **Vendor-neutral portability** — the same manifest runs on NVIDIA GPUs or Huawei Ascend NPUs without a single spec change

Currently at `v0.1.0` (alpha), Hearth's NVIDIA backend and full scale-to-zero path are verified end-to-end on real GPUs. It's not production-hardened yet — no auth, no multi-tenancy — but for internal, dev, latency-tolerant, cost-sensitive serving, it already delivers.

## The Problem Hearth Solves

The "LLM on Kubernetes" space has excellent platforms: KServe with llm-d for datacenter-scale serving, AIBrix as vLLM's control plane, Kthena for fleet-grade disaggregated inference. But these are *platforms* — they bring significant complexity (Knative, Istio, custom autoscalers) and are designed for large-scale, always-on workloads.

What if you just want to serve a few models on a few GPUs, and you don't want to pay for them when they're idle?

That's Hearth's lane. It's deliberately *not* a platform. It's the smallest thing that serves a few open-source LLMs well on a few accelerators:

- **One user-facing CRD + KEDA.** No router fleet, no webhook suite, no new autoscaler to learn.
- **Scale-to-zero is the center of gravity.** Idle models hold zero accelerators; a small gateway buffers the first request while the backend cold-starts.
- **Vendor-neutral, domestic-silicon-friendly.** The same manifest runs on NVIDIA or Ascend; backends are data, not code.

## How the Scale-to-Zero Flow Works

This is the clever bit. Hearth decouples the request gateway from the inference engine:

```
Client → Hearth Gateway → vLLM Pods (0..N)
                ↑
          KEDA polls /hearth/queue
```

Here's what happens when a request arrives at a scaled-to-zero model:

1. **Gateway accepts the request** — it buffers it and increments a `pending` counter exposed at `/hearth/queue`
2. **KEDA sees `pending > 0`** — polls the gateway metric, triggers scale `0 → 1`
3. **Cold start begins** — the pod loads model weights from a pre-warmed cache. Meanwhile, the gateway sends SSE heartbeat pulses to the client to prevent timeouts
4. **Backend becomes Ready** — gateway forwards the buffered request and streams tokens back normally
5. **Traffic stops** — after a configurable stabilization window, KEDA scales back to zero

The cold start penalty is real (30-120 seconds depending on model size and storage speed), but for batch workloads, async processing, or internal tools, that tradeoff is worth it. You can serve ten models on a cluster and only pay for the ones actively streaming tokens.

## The Declarative Model

Everything in Hearth flows from two CRDs:

### LLMService — What to Serve + How to Scale

```yaml
apiVersion: serving.hearth.dev/v1alpha1
kind: LLMService
metadata:
  name: qwen3-8b
  namespace: ai
spec:
  model:
    source:
      uri: modelscope://Qwen/Qwen3-8B-Instruct
  runtime:
    selector:
      vendor: [nvidia, ascend]  # Try NVIDIA first, fall back to Ascend
  resources:
    accelerators: 1
  scaling:
    min: 0       # Scale to zero!
    max: 3
    metric: queueDepth
    target: 10   # Scale up when 10+ requests queued per replica
```

### InferenceRuntime — Pluggable Backend Definition

```yaml
apiVersion: serving.hearth.dev/v1alpha1
kind: InferenceRuntime
metadata:
  name: vllm-nvidia
spec:
  family: vllm
  vendor: nvidia
  priority: 100
  container:
    image: vllm/vllm-openai:latest
  accelerator:
    resourceName: nvidia.com/gpu
```

The operator reconciles these into a vLLM `Deployment`, a `Service`, a model cache PVC, and a KEDA `ScaledObject`. Adding support for a new chip vendor means creating an `InferenceRuntime` manifest — not forking the codebase.

## Vendor Neutrality — The Whole Point

Most LLM serving tooling is NVIDIA-first and English-first. Hearth's design center is different: **vendor-neutral, domestic-runtime-first orchestration**, with private/XinChuang delivery as a first-class concern.

The same `LLMService` that runs on an NVIDIA cluster runs on Ascend by simply having a `vllm-ascend` InferenceRuntime available. No spec change. The backend is selected automatically based on the `runtime.selector.vendor` priority list and what's actually installed in the cluster.

| Backend | Engine | Accelerator | Status |
|---------|--------|-------------|--------|
| NVIDIA | vLLM | `nvidia.com/gpu` | ✅ Verified on real GPUs |
| Ascend | vLLM-Ascend | `huawei.com/Ascend910` | 🧪 Scaffolded, golden-tested |
| Cambricon | vLLM-MLU | `cambricon.com/mlu` | 🗺️ Planned |

## Cost Model: Pay for GPU Time, Not GPU Existence

Here's the math that makes Hearth compelling for dev/staging environments:

| Scenario | Without Hearth | With Hearth |
|----------|---------------|-------------|
| 3 models, 8 hours active/day | 72 GPU-hours/day | 24 GPU-hours/day |
| 10 models, 2 hours active/day | 240 GPU-hours/day | 20 GPU-hours/day |
| Dev cluster, weekday-only traffic | 168 GPU-hours/week | ~40 GPU-hours/week |

If your GPU costs $2-4/hour, the savings compound fast. Scale-to-zero lets you keep many more models *available* without keeping them *running*.

## Getting Started in 60 Seconds

You can exercise the entire control plane on `kind` with no GPU:

```bash
# Install KEDA
helm install keda kedacore/keda -n keda --create-namespace

# Install Hearth
helm install hearth hearth/hearth -n hearth-system --create-namespace

# Deploy a model
kubectl apply -f llmservice.yaml

# Watch it scale
kubectl get llmservice -n ai -w
```

Hearth ships with a CPU `vllm-stub` for development — a fake vLLM that simulates startup delay, streaming, and metrics. The whole gateway + KEDA + scale-to-zero path runs on kind with no accelerator. This means you can develop and test without owning a GPU.

## Gotchas and Real-World Considerations

**Cold start latency is the tradeoff.** 30-120 seconds for model loading. Mitigations: use a fast storage class for the cache PVC, keep model weights pre-warmed, or use smaller models (Qwen3-0.6B cold-starts in seconds).

**No auth or multi-tenancy yet.** This is alpha. The gateway exposes an OpenAI-compatible endpoint with no API key. Production multi-tenant use needs the `gateway API-key auth` feature (tracked as P0 on the roadmap).

**KEDA is a hard dependency.** Without KEDA, you lose the autoscaling and scale-to-zero capability — which is the whole point. Plan for KEDA in your cluster from the start.

**Not for latency-critical serving.** If your use case demands sub-second time-to-first-token at all times, you need always-warm replicas. Hearth is for cost-sensitive, latency-tolerant workloads.

## Deploy It Yourself

Ready to deploy Hearth in your own environment? Full engineering documentation, Helm charts, Kubernetes manifests, and deployment guides are available in the [PlatformStacks repository](https://github.com/ospf2fullstack/PlatformStacks/tree/main/hearth-kubernetes-llm-serving).

👉 **[View Deployment Documentation →](https://github.com/ospf2fullstack/PlatformStacks/tree/main/hearth-kubernetes-llm-serving/README.md)**

## What's Next

Hearth is early — pre-release alpha — but the core thesis is solid: declarative lifecycle + scale-to-zero + vendor-neutral packaging, at the small end of the GPU cluster spectrum. The roadmap includes:

- **v1 milestone:** Real Ascend NPU validation (the project's core differentiator)
- **Gateway API-key auth** — the top blocker before shared/multi-user deployments
- **SharedPVC (RWX) cache** for multi-node scale-out
- **OCI and PVC model source schemes** — pull models from registries, not just HuggingFace/ModelScope

If you're managing a small GPU fleet and want your idle models to cost nothing, Hearth is worth watching — and contributing to. The no-GPU development path means you can hack on it today with nothing more than `kind` and KEDA.

---

*Hearth is open source at [github.com/hearth-project/hearth](https://github.com/hearth-project/hearth). You can find the full deployment docs and Helm charts linked in this blog post or at [github.com/ospf2fullstack/PlatformStacks](https://github.com/ospf2fullstack/PlatformStacks/tree/main/hearth-kubernetes-llm-serving).*
