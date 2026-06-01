---
title: "Apache Kafka: Event Streaming from Zero to Production on Kubernetes"
date: "2026-06-01"
author: "Gary Innerarity"
description: "A practical guide to deploying Apache Kafka on Kubernetes with KRaft mode and the Strimzi Operator — from architecture decisions to production-ready manifests."
tags: [kafka, kubernetes, event-streaming, strimzi, kraft, engineering]
audio: "/assets/audio/apache-kafka.mp3"
platformStacks: "https://github.com/ospf2fullstack/PlatformStacks/tree/main/apache-kafka"
draft: true
---

# Apache Kafka: Event Streaming from Zero to Production on Kubernetes

You need to move data between services in real time. Not batch jobs that run overnight. Not REST calls that create tight coupling between every microservice. You need an event backbone — something that lets producers fire and forget, consumers process at their own pace, and the system survives broker failures without losing a single acknowledged message.

That's the problem Apache Kafka solves. And if you're already running Kubernetes, the question isn't whether to use Kafka — it's how to run it without creating an operational nightmare.

## Why Kafka Still Dominates Event Streaming

In 2026, Apache Kafka handles trillions of messages per day across organizations like LinkedIn, Netflix, Uber, and Goldman Sachs. Its architecture hasn't been replaced because the fundamentals are right: append-only logs, partitioned parallelism, and consumer group coordination give you both throughput and ordering guarantees that message queues can't match.

Here's what makes Kafka different from a traditional message broker:

- **Persistent log storage** — Messages aren't deleted after consumption. Consumers track their own position (offset), enabling replay, reprocessing, and multiple independent consumer groups reading the same data.
- **Partitioned parallelism** — Topics split across partitions, and consumer parallelism scales linearly with partition count. A 12-partition topic supports up to 12 concurrent consumers in a group.
- **Exactly-once semantics** — With idempotent producers and transactional APIs, Kafka provides exactly-once delivery across producer retries and consumer reprocessing.
- **Horizontal scaling** — Adding brokers increases cluster capacity. Partition reassignment distributes load across the new topology.

The throughput numbers back this up. A 3-broker cluster on modern hardware can sustain 100+ MB/s of producer throughput with sub-10ms p99 latency when configured correctly.

## The KRaft Revolution: ZooKeeper Is Gone

The biggest architectural shift in Kafka's history happened with Kafka 4.0 in March 2025: ZooKeeper support was completely removed. Every Kafka cluster now runs on **KRaft** (Kafka Raft) — an internal consensus protocol that manages cluster metadata without any external dependency.

This matters for three operational reasons:

1. **Fewer moving parts** — No more ZooKeeper ensemble to provision, monitor, and troubleshoot. One less system to page you at 3am.
2. **Faster failover** — Controller elections happen in seconds, not the 30-60 seconds typical of ZooKeeper-based leadership changes.
3. **Simpler Kubernetes deployments** — No separate StatefulSet for ZooKeeper. The Kafka cluster is self-contained.

KRaft supports two deployment modes:

| Mode | Controllers | Brokers | Best For |
|------|-------------|---------|----------|
| **Combined** | Each broker is also a controller | Same pods | Dev/test, small clusters (3-5 nodes) |
| **Separated** | Dedicated controller pods | Dedicated broker pods | Production (6+ nodes) |

For production, separated mode gives you resource isolation — controllers need fast storage for the metadata log but minimal CPU, while brokers need high-throughput I/O and substantial memory for page cache.

## Running Kafka on Kubernetes: The Real Challenges

Kubernetes is designed for stateless workloads. Kafka brokers are fundamentally stateful — they own partition log segments, maintain broker identity, and depend on persistent volumes that survive pod restarts. This tension creates specific challenges:

**Storage**: Kafka brokers require persistent volumes backed by fast storage (SSD/NVMe). You need a storage class with volume expansion enabled, `WaitForFirstConsumer` binding mode, and sufficient IOPS for your throughput targets.

**Network**: Kafka's protocol requires clients to connect to specific broker instances via advertised listeners. This means stable DNS names (via headless Services and StatefulSets), careful listener configuration for internal vs. external access, and pod anti-affinity to spread brokers across nodes.

**Resource allocation**: Kafka is memory-intensive. The JVM heap is only part of the story — the OS page cache is critical for serving recent messages without disk reads. Under-provisioning memory kills throughput before you see CPU saturation.

**Scaling**: Adding brokers creates compute capacity but doesn't automatically redistribute partitions. You need partition reassignment after scale-out, and graceful drain before scale-in.

## Strimzi: The Kubernetes Operator for Kafka

This is where the Strimzi Operator transforms the operational model. Instead of managing StatefulSets, ConfigMaps, and shell scripts manually, you declare your desired Kafka state as a Custom Resource and let the operator reconcile it.

What Strimzi handles for you:
- Rolling upgrades (version changes with zero downtime)
- TLS certificate generation and rotation
- Topic and user management via CRDs (version-controlled, GitOps-friendly)
- Cruise Control integration for automatic partition rebalancing
- JMX metrics export for Prometheus monitoring
- Rack-aware replica placement across availability zones

A production Kafka cluster defined as a Strimzi CRD looks like this:

```yaml
apiVersion: kafka.strimzi.io/v1beta2
kind: Kafka
metadata:
  name: production-kafka
  namespace: kafka
spec:
  kafka:
    version: 3.9.0
    replicas: 3
    listeners:
      - name: tls
        port: 9093
        type: internal
        tls: true
        authentication:
          type: tls
    config:
      default.replication.factor: 3
      min.insync.replicas: 2
      auto.create.topics.enable: false
    storage:
      type: jbod
      volumes:
        - id: 0
          type: persistent-claim
          size: 500Gi
          class: fast-ssd
    resources:
      requests:
        memory: 8Gi
        cpu: "2"
      limits:
        memory: 12Gi
        cpu: "4"
```

Apply it, wait 3-5 minutes, and you have a production-grade cluster with TLS, persistent storage, and the operator watching for drift.

## Production Configuration That Actually Matters

After deploying dozens of Kafka clusters, these are the settings that separate "it works in dev" from "it survives a broker failure at peak load":

### The Durability Trinity

```
default.replication.factor = 3
min.insync.replicas = 2
acks = all (producer-side)
```

These three settings together mean: every message is written to 3 brokers, acknowledged only after 2 have confirmed, and the producer won't accept "success" until all in-sync replicas confirm. You can lose one broker with zero data loss and zero downtime.

### Disable Auto-Create Topics

```
auto.create.topics.enable = false
```

In production, a typo in a topic name shouldn't create a new topic with default settings. Manage topics declaratively through Strimzi's `KafkaTopic` CRD or your CI/CD pipeline.

### Enable Idempotent Producers

```
enable.idempotence = true
max.in.flight.requests.per.connection = 5
```

Idempotent producers deduplicate retried messages using sequence numbers. Since Kafka 0.11, this works safely with up to 5 in-flight requests — the old advice to set `max.in.flight=1` is outdated.

### Pod Anti-Affinity and Rack Awareness

```yaml
rack:
  topologyKey: topology.kubernetes.io/zone
template:
  pod:
    affinity:
      podAntiAffinity:
        requiredDuringSchedulingIgnoredDuringExecution:
          - topologyKey: kubernetes.io/hostname
```

This ensures no two brokers share a node, and replicas spread across availability zones. When a zone goes down, your cluster stays available.

## Monitoring: The Metrics That Matter

Kafka exposes hundreds of JMX metrics. Focus on these five for alerts:

| Metric | Alert When | What It Means |
|--------|-----------|---------------|
| `UnderReplicatedPartitions` | > 0 for 5 min | A broker is falling behind on replication |
| `ActiveControllerCount` | != 1 cluster-wide | Controller election problem |
| `OfflinePartitionsCount` | > 0 | Partitions with no available leader |
| Consumer lag | Growing unbounded | Consumers can't keep up with producers |
| Broker disk usage | > 80% | Approaching storage limits |

Strimzi integrates directly with Prometheus via JMX Exporter. Enable it in your Kafka CR, deploy a PodMonitor, and import the community Grafana dashboards for instant visibility.

## What's Next for Kafka Architecture

Three developments are reshaping how we think about Kafka on Kubernetes in 2026:

**Tiered Storage (KIP-405)** — Offload cold log segments to object storage (S3, GCS) while keeping hot data on local SSD. This decouples retention from broker disk capacity, enabling month-long retention without massive volumes.

**Share Groups (KIP-932)** — Production-ready in Kafka 4.2. Multiple consumers can process records from the same partition concurrently, breaking the partition-count-equals-parallelism constraint for workloads that don't need ordering.

**Next-Generation Consumer Rebalance (KIP-848)** — Server-side incremental rebalancing eliminates the "stop-the-world" pauses that made HPA-based consumer scaling dangerous. Kubernetes autoscaling for Kafka consumers is finally safe.

## Deploy It Yourself

Ready to deploy Apache Kafka in your own environment? Full engineering documentation, Helm charts, Kubernetes manifests, and deployment guides are available in the [PlatformStacks repository](https://github.com/ospf2fullstack/PlatformStacks/tree/main/apache-kafka).

👉 **[View Deployment Documentation →](https://github.com/ospf2fullstack/PlatformStacks/tree/main/apache-kafka/README.md)**

The deployment includes:
- Strimzi Operator installation via Helm
- Production Kafka cluster manifest with KRaft mode
- One-click install script with pre-flight checks
- Architecture Decision Records explaining key choices
- Monitoring configuration with Prometheus alerting rules

## Final Thoughts

Kafka on Kubernetes is no longer experimental. With Strimzi managing the operator lifecycle, KRaft eliminating external dependencies, and the ecosystem maturing around tiered storage and share groups, the path from zero to production is well-paved.

The key decisions are straightforward: use KRaft (you have no choice on 4.0+), deploy separated mode for production, set the durability trinity (`replication=3, ISR=2, acks=all`), and let Strimzi handle the operational complexity. Start with 3 brokers, monitor the five critical metrics, and scale when your throughput demands it.

The hard part isn't the technology anymore — it's the discipline to configure it correctly from day one instead of learning from a 3am page.
