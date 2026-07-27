---
title: "Kthena: Kubernetes-Native LLM Inference with Prefill-Decode Disaggregation"
date: "2026-07-13"
author: "Gary Innerarity"
description: "How Kthena separates compute-heavy prefill from memory-bound decode to deliver optimized LLM inference at scale on Kubernetes."
tags: [kthena, kubernetes, llm-inference, volcano, prefill-decode, lora, ai-infrastructure]
audio: "/assets/audio/kthena-llm-inference.mp3"
platformStacks: "https://github.com/ospf2fullstack/PlatformStacks/tree/main/kthena-llm-inference"
draft: true
---

# Kthena: Kubernetes-Native LLM Inference with Prefill-Decode Disaggregation

You've deployed your LLM on Kubernetes. The model loads. Inference works. But then production traffic hits, and you discover the ugly truth: your GPU utilization is abysmal, latency spikes during long prompts, and short completions queue behind massive prefill operations. Welcome to the prefill-decode problem — and why Kthena exists.

## The Fundamental Problem with LLM Inference

Every LLM inference request has two distinct computational phases that couldn't be more different:

**Prefill** processes your entire input prompt in parallel. It's compute-bound — it wants raw FLOPS, tensor cores screaming at maximum throughput. A 4,000-token prompt demands intense parallel computation to build the initial KV cache.

**Decode** generates tokens one at a time, autoregressively. It's memory-bandwidth-bound — each token generation reads the entire KV cache but performs relatively little computation. It wants high-bandwidth memory (HBM) access, not compute density.

The traditional approach? Run both phases on the same GPU. The result? Your expensive H100s sit at 30-40% utilization during decode (wasting compute capacity) while prefill operations block time-sensitive decode completions (spiking latency). You're paying for hardware you're not fully using while delivering worse user experience.

## What Is Kthena?

Kthena is a Kubernetes-native LLM inference platform from the [Volcano.sh](https://volcano.sh) project. It's not another inference engine — it's an intelligent **orchestration layer** that sits atop engines like vLLM, SGLang, Triton, and TorchServe. Think of it as the "control brain" that decides how to deploy, route, scale, and recover your inference workloads.

The core insight: instead of replacing your inference engine, Kthena extends Kubernetes with purpose-built CRDs (Custom Resource Definitions) to manage the entire LLM lifecycle declaratively. You describe what you want — models, traffic rules, scaling targets, prefill/decode separation — and Kthena's control plane reconciles the rest.

### Architecture at a Glance

Kthena cleanly separates into two planes:

- **Control Plane (Kthena Controller Manager)**: Reconciles CRDs, manages pod lifecycle, integrates with the Volcano scheduler for gang scheduling and topology-aware placement, and applies autoscaling policies.
- **Data Plane (Kthena Router)**: Classifies each incoming request by model name, headers, or URI patterns. Applies load-balancing policies. Performs PD-aware routing — selecting the right prefill and decode pod pair for each request. All at request-level granularity with high throughput.

## Prefill-Decode Disaggregation: The Core Innovation

This is where Kthena differentiates itself. Rather than running both phases on the same pod, you declare separate **ServingGroups** for prefill and decode:

```yaml
apiVersion: workload.serving.volcano.sh/v1alpha1
kind: ModelServing
metadata:
  name: qwen3-pd
spec:
  schedulerName: volcano
  replicas: 1
  template:
    roles:
      - name: prefill
        replicas: 2   # Scale prefill independently
        entryTemplate:
          spec:
            containers:
              - name: vllm-prefill
                image: ghcr.io/volcano-sh/vllm-openai:v0.10.0-cu128-nixl-v0.4.1-lmcache-0.3.2
                args:
                  - --kv-transfer-config
                  - '{"kv_connector":"NixlConnector","kv_role":"kv_both"}'
                resources:
                  limits:
                    nvidia.com/gpu: 1
      - name: decode
        replicas: 4   # More decode replicas for token generation
        entryTemplate:
          spec:
            containers:
              - name: vllm-decode
                image: ghcr.io/volcano-sh/vllm-openai:v0.10.0-cu128-nixl-v0.4.1-lmcache-0.3.2
                args:
                  - --kv-transfer-config
                  - '{"kv_connector":"NixlConnector","kv_role":"kv_both"}'
                resources:
                  limits:
                    nvidia.com/gpu: 1
```

The key elements:

1. **Independent Scaling**: Scale prefill and decode replicas independently. Got lots of long prompts? Add prefill pods. Need faster streaming? Add decode pods. The P/D ratio becomes a tunable knob.

2. **Hardware Specialization**: Dedicate high-compute nodes (H100s) for prefill and high-bandwidth nodes for decode. Or mix heterogeneous accelerators — A100s for decode, H100s for prefill.

3. **KV Cache Coordination**: The magic glue. When prefill completes, the KV cache transfers seamlessly to decode pods via connectors like NIXL (RDMA-optimized for NVIDIA), Mooncake (for Huawei Ascend NPUs), or LMCache. No application-level plumbing required.

4. **PD-Aware Routing**: The Kthena Router understands PD groups. It selects a decode pod first, then pairs it with a compatible prefill pod in the same group — ensuring co-located cache hits and minimal data movement.

## Dynamic LoRA Management: Hot-Swap Without Downtime

Fine-tuned models are the norm in production. Kthena treats LoRA adapters as first-class citizens:

```yaml
apiVersion: workload.serving.volcano.sh/v1alpha1
kind: ModelBooster
metadata:
  name: deepseek-lora
spec:
  backend:
    env:
      - name: "VLLM_ALLOW_RUNTIME_LORA_UPDATING"
        value: "True"
    loraAdapters:
      - name: "lora-finance"
        artifactURL: "s3://model-bucket/lora-finance-v2"
      - name: "lora-medical"
        artifactURL: "huggingface://org/lora-medical-v1"
```

Change the `loraAdapters` field and Kthena's Runtime sidecar downloads, loads, or unloads adapters **without restarting pods**. The router then applies LoRA-affinity routing — requests specifying a particular adapter get directed to pods that already have it loaded:

```yaml
apiVersion: networking.serving.volcano.sh/v1alpha1
kind: ModelRoute
metadata:
  name: deepseek-lora
spec:
  loraAdapters:
    - "lora-finance"
    - "lora-medical"
  rules:
    - name: "lora-route"
      targetModels:
        - modelServerName: "deepseek-lora"
```

No cold-loading penalty. No inference outage. Adapters swap in under the hood while traffic continues flowing.

## Intelligent Routing Beyond Round-Robin

The Kthena Router isn't a simple load balancer. It's a request-level scheduler with pluggable scoring plugins:

| Algorithm | When to Use |
|-----------|-------------|
| **Least Request** | General-purpose, even load distribution |
| **Least Latency** | Latency-sensitive workloads (chatbots) |
| **KV-Cache Awareness** | Maximize cache reuse across requests |
| **Prefix-Cache Matching** | Shared system prompts across users |
| **LoRA Affinity** | Route to pods with the right adapter loaded |
| **PD-Group Aware** | Pair prefill/decode pods optimally |

Plus traffic governance: canary releases, weighted distribution, token-based rate limiting, and automated failover — all declarative via CRDs.

## The Volcano Scheduler Advantage

Kthena doesn't just deploy pods — it leverages Volcano's scheduling primitives:

- **Gang Scheduling**: All pods in a ServingGroup start together or not at all. No partially-scheduled inference groups consuming GPUs while waiting for their companions.
- **Topology-Aware Placement**: Pods that need low-latency KV cache transfers get placed within the same network fabric tier (same rack, same switch).
- **Cost-Driven Autoscaling**: Scale based on GPU utilization, queue depth, or custom metrics — with budget constraints that prevent runaway costs.

## Gotchas and Real-World Considerations

1. **KV Transfer Latency**: RDMA (NixlConnector) is dramatically faster than TCP for KV cache transfers. If your network doesn't support RDMA, expect higher PD latency. Test with realistic prompt lengths.

2. **Model Size vs. Disaggregation Benefit**: For small models (< 7B parameters), the overhead of PD disaggregation may exceed the benefit. Start with standard serving and disaggregate when you hit utilization ceilings.

3. **Gang Scheduling Resource Requirements**: `minRoleReplicas` must match available GPU resources. If you request 4 GPUs for gang scheduling but only 3 are free, nothing starts. Plan cluster capacity accordingly.

4. **Router Is a Reference Implementation**: The Kthena router doesn't natively support the Kubernetes Gateway Inference Extension (yet). For production, consider deploying it behind a standard API gateway for TLS termination and external auth.

5. **Engine Compatibility**: Not all engines support all features. vLLM has the deepest integration for PD disaggregation. SGLang support is strong but uses Mooncake connectors. Triton and TorchServe support standard serving only.

## Deploy It Yourself

Ready to deploy Kthena in your own environment? Full engineering documentation, Helm charts, deployment guides, and configuration references are available in the [PlatformStacks repository](https://github.com/ospf2fullstack/PlatformStacks/tree/main/kthena-llm-inference).

👉 [**View Deployment Documentation →**](https://github.com/ospf2fullstack/PlatformStacks/tree/main/kthena-llm-inference/README.md)

## What's Next

Kthena represents where Kubernetes-native AI infrastructure is heading: declarative, disaggregated, and intelligent. The separation of prefill and decode isn't just an optimization — it's a fundamental shift in how we think about LLM serving architecture.

If you're running LLMs in production and fighting GPU utilization, latency variance, or LoRA management complexity, Kthena gives you the control surfaces to actually solve these problems at the infrastructure level rather than hacking around them in application code.

The Volcano.sh team is actively iterating on the router (Gateway Inference Extension support), expert parallelism patterns, and deeper cost optimization. This is early but production-capable infrastructure worth watching closely.

---

*You can find the full deployment docs and Helm charts linked in the blog post or at [github.com/ospf2fullstack/PlatformStacks](https://github.com/ospf2fullstack/PlatformStacks/tree/main/kthena-llm-inference).*
