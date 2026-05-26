---
title: "Building an Autonomous Engineering Blog Automation Pipeline"
date: "2026-05-25"
author: "Gary Innerarity"
description: "How I built a reusable SOP/skill template that automates the complete pipeline for publishing engineering documentation to my personal blog."
tags: ["automation", "engineering-documentation", "blog", "elevenlabs", "github", "ai", "pipeline"]
category: "Engineering"
audio: "/blog/audio/engineering-docs-automation-pipeline.mp3"
---

# Building an Autonomous Engineering Blog Automation Pipeline

What if you could have an AI agent autonomously research, write, and publish engineering blog posts—with audio versions ready for podcast distribution? That's exactly what I built.

## The Problem

Publishing engineering documentation to a personal blog is repetitive. Each new technology or platform requires:

- Research and context gathering
- Writing technical content
- Creating audio transcripts for text-to-speech
- Generating structured data for SEO
- Committing to GitHub and managing the review process

I wanted a reusable template—a documented process that could be executed autonomously for any future topic.

## The Solution: A 6-Artifact Pipeline

The automation pipeline produces **6 required artifacts** for each blog post:

| Artifact | Purpose |
|----------|---------|
| **Blog Post** | Technical content with diagrams |
| **Podcast Script** | ElevenLabs-ready transcript |
| **Hypothesis Document** | Problem statement, success criteria, constraints |
| **Architecture Plan** | Literature review, technology evaluation |
| **Operations Guide** | Gotchas, scaling considerations, security review |
| **Deployment Guide** | Environment setup, verification steps |

### The 8-Phase Systems Engineering Framework

Each artifact maps to a phase in my systems engineering workflow:

1. **Scoping** → Hypothesis/Purpose Statement
2. **Exploration** → Architecture Planning  
3. **Prototyping** → MVP Implementation
4. **Determination** → Architecture Decisions (ADRs)
5. **Development** → Full Implementation
6. **Validation** → Security Review
7. **Stress** → Load Testing & Scaling
8. **Production** → Deployment Automation

## How It Works

### Step 1: Topic Selection
The agent picks a topic from pending tasks tagged with `blog` that isn't yet complete.

### Step 2: Research & Context Gathering
- Fetches relevant skills/SOPs from the knowledge base
- Researches the technology via web search
- Gathers statistics and benchmarks

### Step 3: Content Generation
Using the Engineering Documentation Workflow skill, the agent generates all 6 artifacts following the 8-phase framework.

### Step 4: GitHub Workflow
- Creates a new branch
- Commits all artifacts
- Opens a pull request for review

### Step 5: Audio Generation
The podcast script is sent to ElevenLabs for text-to-speech conversion using a cloned voice.

### Step 6: Publication
Once approved, the content is merged and deployed to garyinnerarity.com.

## Key Learnings

### What Worked
- **Modular artifact design**: Each artifact serves a specific purpose and can be validated independently
- **Phase mapping**: Connecting artifacts to engineering phases ensures nothing is missed
- **Voice cloning**: ElevenLabs' voice cloning maintains consistent audio quality

### Challenges Overcome
- **Tool limitations**: Initial attempts failed due to API authentication gaps—solved by using direct GitHub tools
- **Content quality**: Required human review step before publication
- **Audio pacing**: Needed to add natural pauses [PAUSE] in scripts for better TTS flow

## Results

The pipeline successfully published this post autonomously. The same template can now be used for any future engineering topic with minimal adaptation.

### Metrics
- **Time to publish**: ~15 minutes (autonomous execution)
- **Artifacts generated**: 6/6 complete
- **Audio ready**: Yes (ElevenLabs)

## Next Steps

Future enhancements I'm considering:
1. Add automated SEO meta tag generation
2. Integrate Google Analytics for performance tracking
3. Add image generation for diagrams
4. Implement A/B testing for headlines

---

*This post was generated autonomously using the Engineering Docs Blog Automation Pipeline. The audio version here: [Listen Live](https://garyinnerarity.com/blog/audio/engineering-docs-automation-pipeline.mp3).*
