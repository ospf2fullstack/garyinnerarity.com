---
title: "KAITO: The Kubernetes Operator That Makes GPU Inference Feel Like Magic"
date: "2026-06-19"
author: "Gary Innerarity"
description: "KAITO automates LLM inference on Kubernetes by auto-provisioning GPU nodes, configuring vLLM, and exposing OpenAI-compatible APIs — all from a single CRD."
tags: [kaito, kubernetes, gpu, inference, vllm, cncf, ai-infrastructure]
audio: "/assets/audio/kaito-kubernetes-ai-inference.mp3"
platformStacks: "https://github.com/ospf2fullstack/PlatformStacks/tree/main/kaito"
draft: true
---

# KAITO: The Kubernetes Operator That Makes GPU Inference Feel Like Magic

You want to run an LLM on Kubernetes. Sounds simple enough — until you're three hours deep into GPU node provisioning, fighting with NVIDIA driver compatibility, manually calculating tensor parallelism settings, and wondering why your 70B parameter model keeps OOM-killing your pods.

This is the exact pain point that KAITO — the **Kubernetes AI Toolchain Operator** — was built to eliminate. And after spending time with it, I'm convinced it represents the most thoughtful abstraction layer for GPU inference workloads in the Kubernetes ecosystem today.

## What is KAITO?

KAITO is a CNCF Sandbox project (accepted October 2024) that automates three core AI workloads on Kubernetes:

1. **LLM Inference** — Deploy any vLLM-supported model with a single CRD
2. **Fine-tuning** — LoRA and QLoRA parameter-efficient tuning with adapter management
3. **RAG Engine** — Retrieval Augmented Generation deployment and orchestration

The project originated from Microsoft's Azure Kubernetes Service team and has grown to over 686 contributors across 211 organizations. It's cloud-agnostic — running on Azure AKS, AWS EKS, or any conformant Kubernetes cluster.

## The Core Innovation: Declarative GPU Provisioning

Here's what makes KAITO genuinely different from manually deploying vLLM or using a simpler inference operator: **it thinks about GPU resources for you.**

When you create a Workspace CRD, the KAITO controller:

1. **Estimates GPU memory requirements** based on the model metadata and your specified instance type
2. **Calculates optimal GPU count** for distributed inference
3. **Triggers node auto-provisioning** through Karpenter-compatible APIs
4. **Configures inference engine parameters** — tensor parallelism (TP), data parallelism (DP), pipeline parallelism (PP) — based on GPU hardware topology
5. **Exposes an OpenAI-compatible API** as a Kubernetes Service

All of this from a YAML file that looks like this:

```yaml
apiVersion: kaito.sh/v1beta1
kind: Workspace
metadata:
  name: workspace-phi-4-mini
spec:
  resource:
    instanceType: "Standard_NC6s_v3"
    labelSelector:
      matchLabels:
        apps: phi-4-mini
  inference:
    preset:
      name: phi-4-mini-instruct
```

That's it. No Dockerfile. No vLLM configuration. No GPU scheduling annotations. No persistent volume claims for model weights. KAITO handles all of it.

## Architecture Deep Dive

KAITO's architecture is built around three Custom Resource Definitions that form a complete inference lifecycle:

### Workspace CRD — The Foundation

The Workspace is your primary interface. It declares what model you want, what hardware to run it on, and whether you're doing inference or fine-tuning. The controller translates this into GPU nodes, vLLM deployments, and service endpoints.

The key insight here is the **separation between intent and implementation**. You express "I want Llama 3.3 70B running" — KAITO figures out that means 2x A100 GPUs with tensor parallelism across both devices, NVMe-backed model storage, and KV cache offloading enabled by default.

### InferenceSet CRD — Autoscaling

Once your model is running, InferenceSet manages replica scaling based on actual inference load. It integrates with KEDA (Kubernetes Event-Driven Autoscaling) using a custom plugin that collects vLLM metrics — queue depth, time-to-first-token, tokens-per-second — and scales workspace replicas accordingly.

This is production-grade autoscaling that responds to real inference demand, not just CPU utilization.

### InferenceExtension — Gateway Integration

KAITO integrates with the Gateway API Inference Extension (a Kubernetes SIG project) to enable model-aware routing. This means your gateway can route requests to specific model versions, handle A/B testing between fine-tuned variants, or implement priority-based request scheduling.

## Practical Gotchas and Real-World Considerations

After deploying KAITO across different environments, here are the things the documentation doesn't emphasize enough:

### 1. BYO Nodes vs. Auto-Provisioning Are Mutually Exclusive

You must choose one approach. If you have existing GPU nodes, install KAITO with `--set featureGates.disableNodeAutoProvisioning=true`. If you want auto-provisioning, you cannot also manually manage GPU nodes in the same cluster. Mixing them will cause scheduling conflicts.

### 2. GPU Driver Compatibility Is Still Your Problem

KAITO provisions nodes and deploys vLLM, but the underlying NVIDIA driver must be compatible with your target model's CUDA requirements. If you're running newer models that require CUDA 12.x features on nodes with older drivers, you'll hit cryptic runtime errors. Always verify your GPU Operator version matches your model requirements.

### 3. Model Download Time Is Non-Trivial

Large models (70B+ parameters) can take 15-30 minutes to download on first deployment. KAITO leverages NVMe-backed local storage for caching, but the initial cold start is real. Plan for this in your SLO calculations.

### 4. Cost Management Requires Intent

Auto-provisioning GPU nodes is powerful but expensive. A single A100 node on Azure costs ~$2,737/month. An 8x H100 cluster runs $82,125/month. KAITO doesn't have built-in cost guardrails — you'll want to combine it with cluster-level quotas and Karpenter consolidation policies.

### 5. LoRA Adapters Are the Power Move

KAITO's adapter design for fine-tuning is elegant. You train a LoRA adapter (which is small — often under 1GB), package it as a container image, and attach it to any running workspace. Multiple adapters can be attached to a single workspace, enabling multi-tenant fine-tuned models without duplicating base model deployments.

## How KAITO Compares

If you're evaluating inference operators, here's the decision framework:

- **KAITO** — Best for teams that want automatic GPU provisioning + enterprise-grade inference with minimal configuration. Strong Azure integration, growing multi-cloud support.
- **KubeAI** — Better if you want multi-runtime support (vLLM + Ollama + FasterWhisper) with prefix-aware load balancing and simpler scale-to-zero.
- **KServe** — Choose this if you need the full CNCF inference serving stack with canary deployments, explainability, and model monitoring built in.
- **Hearth** — Ideal for KEDA-native environments wanting vendor-neutral scale-to-zero with minimal CRD surface area.

KAITO's differentiator is the **intelligence layer** — it doesn't just deploy containers, it reasons about GPU topology and optimizes scheduling parameters automatically.

## Getting Started: From Zero to Inference in 5 Minutes

```bash
# 1. Add KAITO Helm repo
helm repo add kaito https://kaito-project.github.io/kaito/charts/kaito
helm repo update

# 2. Install (BYO nodes — simplest path)
helm upgrade --install kaito-workspace kaito/workspace \
  --namespace kaito-workspace \
  --create-namespace \
  --set clusterName="my-cluster" \
  --set featureGates.disableNodeAutoProvisioning=true \
  --wait

# 3. Label your GPU node
kubectl label node gpu-node-01 accelerator=nvidia

# 4. Deploy a model
kubectl apply -f - <<EOF
apiVersion: kaito.sh/v1beta1
kind: Workspace
metadata:
  name: workspace-phi-4-mini
spec:
  resource:
    labelSelector:
      matchLabels:
        accelerator: nvidia
  inference:
    preset:
      name: phi-4-mini-instruct
EOF

# 5. Test it
kubectl port-forward svc/workspace-phi-4-mini 8080:80
curl http://localhost:8080/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{"model":"phi-4-mini-instruct","messages":[{"role":"user","content":"Hello!"}]}'
```

## Deploy It Yourself

Ready to deploy KAITO in your own environment? Full engineering documentation, Helm charts, installation scripts, and Kubernetes workspace manifests are available in the [PlatformStacks repository](https://github.com/ospf2fullstack/PlatformStacks/tree/main/kaito).

👉 **[View Deployment Documentation →](https://github.com/ospf2fullstack/PlatformStacks/tree/main/kaito/README.md)**

The deployment guide covers both BYO-node and auto-provisioning paths, with examples for Azure AKS, AWS EKS, and self-managed clusters.

## What's Next

KAITO is evolving rapidly. The roadmap includes deeper Gateway API integration for model-aware traffic splitting, improved multi-cloud Karpenter support (the AWS path is already solid), and enhanced RAG engine capabilities. As a CNCF Sandbox project, it has the governance structure and community momentum to become the standard Kubernetes interface for GPU inference workloads.

If you're running LLMs on Kubernetes today — or planning to — KAITO deserves a serious evaluation. The abstraction it provides over GPU scheduling alone will save your platform team weeks of toil.

---

*Gary Innerarity is a Solutions Engineer focused on AI infrastructure, Kubernetes, and systems engineering. Follow his work at [garyinnerarity.com](https://garyinnerarity.com).*
