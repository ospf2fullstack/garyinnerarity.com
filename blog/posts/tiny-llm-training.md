---
title: "Training a Tiny LLM From Scratch: What 10 Million Parameters Taught Me About How GPT Actually Works"
date: "2026-06-01"
author: "Gary Innerarity"
description: "Build and train a 10M parameter GPT-style transformer from scratch in PyTorch — understand attention, RoPE, SwiGLU, and modern LLM architecture by building it yourself."
tags: [llm, machine-learning, transformers, pytorch, ai, engineering]
audio: "/assets/audio/tiny-llm-training.mp3"
platformStacks: "https://github.com/ospf2fullstack/PlatformStacks/tree/main/tiny-llm-training"
draft: true
---

# Training a Tiny LLM From Scratch: What 10 Million Parameters Taught Me About How GPT Actually Works

There's a moment in every engineer's journey with LLMs where the magic stops feeling like magic. For me, it came when I realized that GPT-4, Claude, and LLaMA are all just scaled-up versions of the same architecture — and that architecture fits in about 300 lines of Python.

So I decided to build one. Not a production model. Not even GPT-2. A tiny transformer — around 10 million parameters — trained on Shakespeare in about 30 minutes on a single GPU. The same fundamental architecture as the models processing billions of requests per day, just smaller. Every concept transfers directly.

## The Problem: Understanding by Building

Reading papers about transformers is one thing. Watching attention heads light up in visualizations is another. But there's no substitute for watching a model go from random noise to generating coherent English, one training step at a time.

The question I wanted to answer: **What is the minimum viable transformer that actually learns language?** Not memorizes — *learns*. Generalizes from training data to produce novel sequences that follow grammatical and semantic patterns.

The answer: surprisingly small. A 4-layer, 4-head transformer with 256-dimensional embeddings — roughly 10 million parameters — can learn the structure of English in under an hour. It won't write poetry that moves you, but it'll write poetry that *scans*.

## Architecture: Modern LLM Components at Toy Scale

Here's the key insight that makes this project valuable: the architecture of a 10M parameter model is **identical** to a 70B parameter model. The differences are four numbers in a config file:

| Component | Tiny GPT (Ours) | GPT-2 Small | LLaMA 7B |
|-----------|----------------|-------------|-----------|
| Parameters | ~10M | 117M | 7B |
| Embedding dim | 256 | 768 | 4096 |
| Attention heads | 4 | 12 | 32 |
| Layers | 4 | 12 | 32 |
| Context window | 512 | 1024 | 4096 |

Same transformer blocks. Same attention mechanism. Same training loop. The scale thing hits you when you realize that scaling from our toy to GPT-2 means changing four integers. Scaling from GPT-2 to GPT-3 is the same operation again.

### The Modern Upgrade Path

Rather than building a vanilla 2017-era transformer, I implemented the modern components found in LLaMA, Mistral, and Qwen:

**RMSNorm** replaces LayerNorm. It's 15% faster, uses fewer parameters, and works just as well. The core idea is simple: normalize by the root mean square of activations instead of computing mean and variance separately.

**Rotary Position Embeddings (RoPE)** replace learned position embeddings. This was the single biggest improvement in my experiments — a 0.31 reduction in validation loss. RoPE encodes position information by rotating query and key vectors in pairs, which elegantly captures relative position without any learned parameters.

**SwiGLU** replaces the standard ReLU feed-forward network. It's a gated linear unit with SiLU activation that lets the network learn *which information to pass through* — a meaningful upgrade from the binary on/off of ReLU.

**KV Cache** for inference. During generation, we cache previously computed key-value pairs so we only compute attention for the new token. This turns O(n²) generation into O(n) per step.

## The Training Loop: What Actually Happens

Training starts with random weights. The initial loss is approximately `ln(50257) ≈ 10.8` — exactly what you'd expect from a model randomly guessing across 50,257 possible tokens. It literally knows nothing.

```python
@dataclass
class GPTConfig:
    vocab_size: int = 50257    # GPT-2 BPE vocabulary
    d_model: int = 256         # What makes it "tiny"
    n_layers: int = 4          # Transformer blocks
    n_heads: int = 4           # Attention heads
    max_seq_len: int = 512     # Context window
    dropout: float = 0.1       # Regularization
```

Within the first 500 steps, loss drops rapidly from 10.8 to around 3.0. The model has learned basic token frequencies — common words like "the", "and", "to" dominate predictions. By step 2000, loss is around 2.0. The model has learned word-level patterns and basic syntax. By step 5000, loss settles around 1.5. The model generates recognizable (if imperfect) English prose.

The optimizer is AdamW with cosine learning rate scheduling, warmup for the first 500 steps, and gradient clipping at 1.0. Mixed precision training (BF16) cuts memory usage in half and speeds training by 50% on modern GPUs.

## Gotchas and Real-World Lessons

**1. Overfitting is the enemy at this scale.** A 10M parameter model is powerful enough to memorize 1MB of Shakespeare completely. Dropout, early stopping, and monitoring validation loss (not just training loss) are essential.

**2. Apple Silicon (MPS) has training bugs.** PyTorch's MPS backend has memory leaks that silently kill training after 60-80 minutes. If you're on a Mac, use CPU for this size model — it's fast enough — or use Google Colab with a T4 GPU.

**3. When loss is good but output is garbage, the bug is in inference.** I spent hours debugging what turned out to be a position encoding bug that only manifested during autoregressive generation with KV cache, not during training.

**4. Weight tying saves 30% of parameters.** Sharing the embedding matrix between the input token embedding and the output projection head means the model learns a single token representation that works for both encoding and decoding.

**5. Change one thing at a time.** When I bundled all four modern upgrades (RMSNorm, RoPE, SwiGLU, KV cache) together, I couldn't tell what helped. Running them individually as a reverse ablation study revealed that RoPE contributed the most improvement.

## Scaling Laws in Practice

The magic of this project is what it teaches you about scaling:

| Scale | Params | Hardware | Training Time | Quality |
|-------|--------|----------|---------------|---------|
| Nano | 10M | Single GPU / CPU | 30-60 min | Basic patterns |
| Mini | 50M | Single GPU | 2-3 hours | Coherent text |
| Small | 200M | Multi-GPU | 8-10 hours | Good quality |
| Medium | 1B+ | GPU cluster | Days | Production-ready |

The architecture doesn't change. The training loop doesn't change. It's the same code with bigger numbers. That's the entire secret of the LLM revolution: scale was the missing ingredient, not architectural innovation.

Chinchilla scaling laws tell us that optimal training uses about 20 tokens per parameter. For our 10M model, that's 200M tokens — far more than TinyShakespeare's 1M characters. This means our model is overparameterized for its dataset, which is actually fine for learning purposes but explains why it memorizes easily.

## What You Actually Learn

Building a tiny LLM teaches you things that no paper or tutorial can:

- **Attention is just weighted averaging** — but the weights are learned, query-dependent, and masked. Once you implement it, the "magic" becomes a matrix multiply.
- **Residual connections are the gradient highway** — without them, information dies after 4+ layers. They're trivial to implement (`x = x + layer(x)`) but essential for deep networks.
- **Tokenization determines the ceiling** — BPE with 50K vocabulary on 1MB of text means most tokens appear rarely. Character-level (256 vocab) is simpler and works better at toy scale.
- **Loss curves tell the whole story** — you can diagnose every problem by reading the training loss. Flat = dead learning rate. Spike = exploding gradients. Divergence = numerical overflow.

## Deploy It Yourself

Ready to train your own tiny LLM? Full engineering documentation, training scripts, Helm charts for Kubernetes deployment, and configuration references are available in the [PlatformStacks repository](https://github.com/ospf2fullstack/PlatformStacks/tree/main/tiny-llm-training).

👉 **[View Deployment Documentation →](https://github.com/ospf2fullstack/PlatformStacks/tree/main/tiny-llm-training/README.md)**

The deployment includes:
- Complete PyTorch training script with RMSNorm, RoPE, SwiGLU, and KV Cache
- YAML configuration for model architecture and training hyperparameters
- Helm charts for running training jobs on Kubernetes
- Requirements and dependency management

## What's Next

This 10M parameter model is a starting point. From here, the path forward is clear:

1. **Better data** — Move from TinyShakespeare to TinyStories or a domain-specific corpus
2. **Supervised fine-tuning** — Add a chat template and train on instruction-following data
3. **Scale up** — Increase to 50M or 200M parameters for production-quality output
4. **Deploy** — Serve the model with KV cache optimization behind a REST API

The fundamental lesson: LLMs aren't magic. They're matrix multiplies, gradient descent, and scale. And once you've built one from scratch, you'll never look at ChatGPT the same way again.

---

*Gary Innerarity is a Solutions Engineer who builds systems at the intersection of infrastructure and intelligence. Find the full training implementation and deployment guide in [PlatformStacks](https://github.com/ospf2fullstack/PlatformStacks/tree/main/tiny-llm-training).*
