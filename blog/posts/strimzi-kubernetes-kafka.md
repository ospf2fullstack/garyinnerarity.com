---
title: "Strimzi: Running Apache Kafka on Kubernetes the Right Way"
date: "2026-06-01"
author: "Gary Innerarity"
description: "Learn how Strimzi brings Kafka to Kubernetes with operators, making deployment and management remarkably simple."
tags: [strimzi, kafka, kubernetes, operators, engineering]
audio: "/assets/audio/strimzi-kubernetes-kafka.mp3"
platformStacks: "https://github.com/ospf2fullstack/PlatformStacks/tree/main/strimzi-kafka"
draft: true
---

# Strimzi: Running Apache Kafka on Kubernetes the Right Way

If you've ever tried to run Apache Kafka on Kubernetes from scratch, you know it's not for the faint of heart. Between managing StatefulSets, configuring storage, handling broker scaling, and wrestling with ZooKeeper (or now KRaft), there's a lot that can go wrong. That's where **Strimzi** comes in—a Kubernetes operator that brings enterprise-grade Kafka deployment to your cluster with a fraction of the operational overhead.

## The Problem with Kafka on Kubernetes

Running Kafka directly on Kubernetes using native resources is certainly possible. You can create StatefulSets, Services, and ConfigMaps manually, and many teams have done exactly that. But here's what typically happens:

First, there's the **operational complexity**. Kafka is a distributed system with multiple components—brokers, ZooKeeper (or now KRaft controllers), and often ZooKeeper itself. Managing these components requires deep knowledge of Kafka internals. When something goes wrong, you're on your own.

Then there's **upgrade management**. Kafka version upgrades are notoriously tricky. You need to carefully orchestrate rolling restarts, ensure replication factors are maintained, and avoid data loss. Without automation, this becomes a manual, error-prone process.

Finally, there's **scaling**. Adding or removing brokers requires partition reassignment, which is complex and risky. Most teams avoid it entirely, over-provisioning instead.

## Enter Strimzi: The Kubernetes-Native Approach

Strimzi is an open-source Kubernetes operator that provides a way to run Apache Kafka clusters on Kubernetes using native Kubernetes concepts. Instead of manually creating and managing Kubernetes resources, you define your Kafka cluster using custom resources, and Strimzi's operators handle the rest.

The key insight behind Strimzi is **declarative configuration**. You tell Kubernetes what you want (a 3-broker Kafka cluster with TLS encryption), and Strimzi figures out how to make it happen. It creates the necessary StatefulSets, Services, ConfigMaps, and other resources automatically. When you change your configuration, Strimzi reconciles the state, handling rolling updates and all the complex orchestration behind the scenes.

## How Strimzi Works

Strimzi provides several operators that work together:

The **Cluster Operator** is the main component. It watches for `Kafka` custom resources and manages the deployment of Kafka brokers, ZooKeeper (or KRaft), and other components. It handles everything from creating pods to managing storage to configuring listeners.

The **Topic Operator** watches for `KafkaTopic` resources. When you create a topic definition, it automatically creates the topic in Kafka and keeps it synchronized. Delete the resource, and the topic goes away. This brings GitOps-style management to your Kafka topics.

The **User Operator** similarly manages `KafkaUser` resources. It handles user creation, authentication (TLS or SCRAM-SHA), and authorization (ACLs). You can manage access control entirely through Kubernetes.

The **Entity Operator** combines the Topic and User operators into a single deployment for efficiency.

## Real-World Impact

The impact of Strimzi on operational efficiency is substantial. One enterprise team reported that deploying Kafka clusters went from a 90-day process to under 1 hour. Downtime due to configuration errors? Essentially eliminated. Support overhead plummeted because the operator handles so many edge cases automatically.

Another team handling massive scale—over 1 petabyte of compressed messages per day—used Strimzi to scale from 4 to 13 petabytes daily without adding operational staff. The operator's automated partition rebalancing and scaling capabilities made this growth manageable.

## Key Features That Make a Difference

**KRaft Mode**: Modern Strimzi versions support KRaft (Kafka Raft metadata mode), eliminating the need for ZooKeeper entirely. This simplifies the architecture and reduces operational complexity.

**Node Pools**: You can now define different node pools with different configurations—maybe you need some high-memory brokers for specific workloads and others optimized for throughput.

**Security**: Strimzi makes security easy. TLS encryption, SCRAM-SHA authentication, and ACL-based authorization are all configurable through the custom resources. Certificate management is handled automatically.

**Monitoring**: Built-in Prometheus metrics integration means you can start monitoring immediately. Grafana dashboards are included.

**Cruise Control Integration**: Automatic partition rebalancing, scaling operations, and workload distribution are all handled through the `KafkaRebalance` custom resource.

## What You Need to Get Started

To run Strimzi, you'll need:

- A Kubernetes cluster (version 1.27 or later for Strimzi 0.48+)
- kubectl configured with cluster access
- Helm 3.x for installation (though you can also use YAML manifests)

The installation is straightforward—add the Strimzi Helm repository, install the operator, and then create your Kafka custom resource. Within minutes, you have a running Kafka cluster.

## The Gotchas

No technology is perfect, and Strimzi has some considerations:

**Resource Requirements**: Kafka is resource-hungry. Plan for adequate CPU and memory, plus appropriate storage (preferably fast SSDs for the write-ahead logs).

**Kubernetes Knowledge Required**: While Strimzi abstracts away much of the complexity, you'll still need to understand Kubernetes concepts like pods, services, storage classes, and network policies.

**Version Compatibility**: Strimzi version must be compatible with both your Kubernetes version and your desired Kafka version. Check the compatibility matrix before upgrading.

**Learning Curve**: There's still a learning curve. Understanding the custom resources, feature gates, and configuration options takes time. But this is far less painful than learning all the intricacies of Kafka operations.

## Deploy It Yourself

Ready to deploy Strimzi in your own environment? Full engineering documentation, Helm charts, Terraform modules, and deployment guides are available in the [PlatformStacks repository](https://github.com/ospf2fullstack/PlatformStacks/tree/main/strimzi-kafka).

👉 **[View Deployment Documentation →](https://github.com/ospf2fullstack/PlatformStacks/tree/main/strimzi-kafka/README.md)**

You can find the full deployment docs and Helm charts linked in the blog post or at github.com/ospf2fullstack/PlatformStacks