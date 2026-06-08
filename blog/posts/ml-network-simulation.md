---
title: "ML Network Simulation: Building a Digital Twin for Your Infrastructure"
date: "2026-06-08"
author: "Gary Innerarity"
description: "How to build machine learning models that predict network behavior — replacing expensive packet-level simulators with fast, accurate GNN-based digital twins for servers, switches, and routers."
tags: [machine-learning, networking, graph-neural-networks, digital-twin, infrastructure, engineering]
audio: "/assets/audio/ml-network-simulation.mp3"
platformStacks: "https://github.com/ospf2fullstack/PlatformStacks/tree/main/ml-network-simulation"
draft: true
---

# ML Network Simulation: Building a Digital Twin for Your Infrastructure

Your network is failing. Not catastrophically — not yet — but packets are queuing at switch buffers longer than they should, tail latency is creeping up during peak hours, and you have no idea which link will saturate first when traffic grows 30% next quarter. The traditional answer is to fire up ns-3 or OMNeT++ and simulate your entire topology at the packet level. But here's the problem: a single data center switch chip forwards 25 billion packets per second. Even the most efficient packet-level simulator can't model that in real time for even one device, let alone an entire fabric.

What if you could train a machine learning model to predict your network's behavior — delay, throughput, packet loss, queue occupancy — in milliseconds instead of hours? That's exactly what the emerging field of ML-based network simulation delivers, and it's not theoretical anymore.

## The Problem with Traditional Network Simulation

Network engineers have relied on two main approaches for decades:

**Packet-level simulators** (ns-3, OMNeT++, htsim) model every individual packet interaction — arrivals, queue insertions, scheduling decisions, departures. They're accurate but impossibly slow at scale. Simulating 60 seconds of traffic on a 256-host fat-tree topology can take hours of wall-clock time.

**Queueing theory** (M/M/1, M/G/1, network calculus) provides closed-form analytical models. They're fast but rely on strong assumptions — Poisson arrivals, independent flows, stationary traffic — that almost never hold in real data center networks where traffic is bursty, autocorrelated, and application-driven.

Neither approach gives you what you actually need: fast, accurate predictions of how your specific network will behave under realistic traffic patterns.

## The Machine Learning Alternative: Graph Neural Networks

The breakthrough insight is that networks are graphs. Routers and switches are nodes. Links are edges. Flows traverse paths through this graph. And the performance of any individual flow depends on complex interactions with every other flow sharing its path — exactly the kind of relational reasoning that Graph Neural Networks (GNNs) excel at.

The state-of-the-art approach, pioneered by the RouteNet family of models, works like this:

1. **Model the network as a heterogeneous graph** with three types of entities: flows, queues, and links
2. **Initialize each entity with features**: flow size and traffic model, queue buffer size and scheduling policy, link capacity and propagation delay
3. **Run iterative message passing** where flows aggregate information from the queues and links they traverse, queues aggregate from the flows passing through them, and links aggregate from their queues
4. **Predict performance metrics** from the final hidden states: per-flow delay, jitter, packet loss, completion time

This three-stage message passing resolves the circular dependencies inherent in network behavior — a flow's completion time depends on queue states, which depend on other flows, which depend on their own queue interactions downstream.

## What Can These Models Actually Predict?

The results are remarkable. Recent papers demonstrate:

| Model | Speedup vs ns-3 | Delay Error | Generalization |
|-------|-----------------|-------------|----------------|
| m4 (MIT, 2025) | 104x | 45% reduction vs flow-level baselines | Cross-topology, cross-CC |
| RouteNet-Gauss (UPC, 2025) | 488x | 95% error reduction vs DES | 10x larger topologies |
| RouteNet-Erlang | Real-time (ms) | 6% worst-case | Unseen topologies 10x larger |
| M3Net | ~100x | 17.4% MAPE | Multi-metric (delay + jitter + loss) |

These aren't toy benchmarks. The m4 model predicts individual flow completion times across fat-tree topologies with 256 hosts, under multiple congestion control protocols (CUBIC, BBR, DCTCP), with varying workloads. RouteNet-Gauss trains on data from real Huawei routers and switches running production traffic patterns.

## Architecture Deep Dive: How the Message Passing Works

The key innovation is decomposing network dynamics into spatial and temporal components. At each simulation step:

```
For each flow f traversing path [q1, l1, q2, l2, ...]:
  h_f = FlowRNN(h_f, aggregate(h_q for q in f.queues))
  
For each queue q serving flows F_q:
  h_q = QueueRNN(h_q, aggregate(h_f for f in F_q))
  
For each link l with queues Q_l:
  h_l = LinkRNN(h_l, aggregate(h_q for q in Q_l))
```

The crucial detail: flow aggregation respects **path order**. A flow experiences queues sequentially — the delay at queue 3 depends on what happened at queues 1 and 2. This is why simple GNNs (which treat neighborhoods as unordered sets) underperform compared to architectures that encode ordering via RNNs or attention mechanisms.

## Practical Applications

### 1. Capacity Planning
Run thousands of "what-if" scenarios in seconds: What happens to p99 latency if traffic grows 50%? Which links saturate first? Where should you add capacity?

### 2. Congestion Control Tuning
Compare CUBIC vs BBR vs DCTCP on your exact topology with your exact workload distribution — without touching production.

### 3. Failure Mode Analysis
Simulate link failures, switch reboots, and gray failures (partial degradation) to understand blast radius before incidents happen.

### 4. Real-Time Anomaly Detection
Deploy the model as a digital twin alongside your monitoring stack. When predicted metrics diverge from observed metrics, something unexpected is happening.

### 5. Routing Optimization
Evaluate routing policy changes (ECMP weights, traffic engineering paths) by predicting the impact on every flow in the network.

## Getting Started: The Training Pipeline

Building your own network simulation model follows this pipeline:

**Step 1: Generate ground-truth data.** Run packet-level simulations (ns-3 is the gold standard) across diverse scenarios — varying topologies, traffic distributions, congestion control algorithms, and queue scheduling policies. You need thousands of labeled scenarios.

**Step 2: Extract features.** For each scenario, capture: topology structure, per-flow attributes (size, path, start time), queue configurations (buffer size, scheduling policy, priority), and link properties (capacity, delay).

**Step 3: Train the GNN.** Use PyTorch Geometric or a custom message-passing implementation. Key hyperparameters: hidden dimension (128 works well), message passing iterations (8-12), and readout architecture (MLP over queue occupancy predictions).

**Step 4: Validate on unseen topologies.** The model must generalize to topologies not seen during training. Scale-independence is achieved by normalizing features relative to link capacity and inferring delays from queue occupancy rather than predicting absolute values.

**Step 5: Deploy for inference.** The trained model runs inference in milliseconds on CPU, making it suitable for real-time monitoring and online decision-making.

## Key Gotchas and Real-World Considerations

**Training data diversity matters more than volume.** A model trained only on Poisson traffic will fail on bursty workloads. Include multiple traffic models (on-off, Pareto, constant-bit-rate) and scheduling policies (FIFO, WFQ, Strict Priority, DRR).

**Topology generalization is hard.** The model needs to learn topology-independent dynamics. Techniques that work: normalize by link capacity, predict queue occupancy as a fraction rather than absolute packet counts, and train on diverse topology families.

**Temporal dynamics require special handling.** Production traffic is non-stationary. RouteNet-Gauss addresses this with Temporal Aggregated Performance Estimation (TAPE) — dividing scenarios into fixed time windows and predicting per-window metrics.

**Don't forget the control plane.** Most models assume static routing. If your network uses adaptive routing (SDN, segment routing), you'll need to incorporate route changes as input features.

## The Open Source Ecosystem

Several research-quality implementations are available:

- **[RouteNet-Gauss](https://github.com/BNN-UPC/RouteNet-Gauss)** — TensorFlow, includes datasets from real testbed hardware
- **[m4](https://github.com/netiken/m4)** — C++/Python, integrates with ns-3 and SimAI for GPU cluster simulations
- **[TwinNet](https://github.com/BNN-UPC/TwinNet)** — TensorFlow, includes routing and scheduling optimizer
- **[5G Digital Twin](https://github.com/poornachandran2006/5G_Digital_Twin)** — PyTorch, LSTM+XGBoost+PPO for congestion prediction and load balancing

## Deploy It Yourself

Ready to deploy an ML-based network simulator in your own environment? Full engineering documentation, training scripts, model configurations, Dockerfiles, and deployment guides are available in the [PlatformStacks repository](https://github.com/ospf2fullstack/PlatformStacks/tree/main/ml-network-simulation).

👉 **[View Deployment Documentation →](https://github.com/ospf2fullstack/PlatformStacks/tree/main/ml-network-simulation/README.md)**

The platform includes a complete training data generator for fat-tree topologies, a configurable GNN model, and containerized deployment for both training and inference workloads.

## What's Next

The field is evolving rapidly. Three trends to watch:

1. **Language models for traffic engineering** — LMTE (INFOCOM 2026) uses LLMs to reason about WAN routing decisions
2. **Topological deep learning** — OrdGCCN models higher-order interactions beyond standard graphs
3. **Self-adaptive digital twins** — Concept-drift detection to keep virtual models synchronized with physical network changes

Network simulation is one of those rare domains where ML doesn't just match traditional methods — it fundamentally changes what's possible. A 488x speedup isn't an incremental improvement. It's the difference between "we ran one scenario overnight" and "we explored the entire parameter space before lunch."

The infrastructure to do this is open source, the research is published, and the hardware you already own is sufficient. The only question is whether you'll build your digital twin before your next capacity failure forces you to.

---

*Gary Innerarity is a Solutions Engineer who builds at the intersection of networking, infrastructure, and machine learning. You can find the full deployment documentation and deployment scripts for this project linked in the blog post or at github.com/ospf2fullstack/PlatformStacks.*
