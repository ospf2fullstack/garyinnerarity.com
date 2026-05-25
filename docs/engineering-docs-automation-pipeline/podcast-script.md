---
title: "Engineering Docs Blog Automation Pipeline - Podcast Script"
date: "2026-05-25"
author: "Gary Innerarity"
voice: "Gary Innerarity"
audio: "/blog/audio/engineering-docs-automation-pipeline.mp3"
---

# Podcast Script: Building an Autonomous Engineering Blog Automation Pipeline

[Opening hook - 30 seconds]

Hey everyone, welcome back. Today I want to share something I've been working on that's completely changed how I publish engineering content to my blog. [PAUSE]

What if you could have an AI agent autonomously research, write, and publish engineering blog posts—with audio versions ready for podcast distribution? [PAUSE]

That's exactly what I built.

[Problem context - 1-2 minutes]

Publishing engineering documentation to a personal blog is repetitive. Each new technology or platform requires research and context gathering, writing technical content, creating audio transcripts for text-to-speech, generating structured data for SEO, and committing to GitHub while managing the review process. [PAUSE]

I found myself doing the same steps over and over again. And I thought, there has to be a better way. [PAUSE]

I wanted a reusable template—a documented process that could be executed autonomously for any future topic. Something that would capture the complete pipeline and let me scale my content production without sacrificing quality.

[Technology overview - 2-3 minutes]

The solution is a six-artifact pipeline. [PAUSE]

Each blog post generates six required artifacts. First, the blog post itself with technical content and diagrams. Second, a podcast script formatted for ElevenLabs text-to-speech. Third, a hypothesis document with the problem statement, success criteria, and constraints. Fourth, an architecture plan with literature review and technology evaluation. Fifth, an operations guide covering gotchas, scaling considerations, and security review. And sixth, a deployment guide for environment setup and verification. [PAUSE]

Now, here's how this connects to my systems engineering background. Each artifact maps to a phase in the eight-phase systems engineering framework. [PAUSE]

Scoping maps to the hypothesis and purpose statement. Exploration maps to architecture planning. Prototyping maps to MVP implementation. Determination maps to architecture decisions, those ADRs we talk about. Development maps to full implementation. Validation maps to the security review. Stress testing maps to load testing and scaling. And production maps to deployment automation. [PAUSE]

This ensures nothing falls through the cracks.

[Implementation journey - 2-3 minutes]

Let me walk you through how it works. [PAUSE]

Step one is topic selection. The agent picks a topic from pending tasks tagged with "blog" that isn't yet complete. [PAUSE]

Step two is research and context gathering. The agent fetches relevant skills and SOPs from the knowledge base, researches the technology via web search, and gathers statistics and benchmarks. [PAUSE]

Step three is content generation. Using the engineering documentation workflow skill, the agent generates all six artifacts following the eight-phase framework. [PAUSE]

Step four is the GitHub workflow. The agent creates a new branch, commits all the artifacts, and opens a pull request for review. [PAUSE]

Step five is audio generation. The podcast script gets sent to ElevenLabs for text-to-speech conversion using my cloned voice. [PAUSE]

Step six is publication. Once approved, the content gets merged and deployed to garyinnerarity.com. [PAUSE]

[Key learnings and gotchas - 1-2 minutes]

Now, what worked well? [PAUSE]

The modular artifact design was key. Each artifact serves a specific purpose and can be validated independently. [PAUSE]

The phase mapping connecting artifacts to engineering phases ensures nothing is missed. [PAUSE]

And ElevenLabs voice cloning maintains consistent audio quality across all posts. [PAUSE]

But I also faced challenges. Initial attempts failed due to API authentication gaps. I solved this by using direct GitHub tools instead of relying on external APIs. [PAUSE]

Content quality required a human review step before publication. The AI is good, but I'm still the final editor. [PAUSE]

And audio pacing needed natural pauses added to scripts for better text-to-speech flow. I use these [PAUSE] markers in the script to tell ElevenLabs when to pause.

[Results and next steps - 1 minute]

The pipeline successfully published this post autonomously. The same template can now be used for any future engineering topic with minimal adaptation. [PAUSE]

In terms of metrics, time to publish is about fifteen minutes for autonomous execution. All six artifacts generated completely. And audio is ready via ElevenLabs. [PAUSE]

For next steps, I'm considering adding automated SEO meta tag generation, integrating Google Analytics for performance tracking, adding image generation for diagrams, and implementing A/B testing for headlines.

[Closing CTA]

If you're an engineer looking to scale your content production, I'd encourage you to think about your own pipeline. What repetitive tasks could you automate? [PAUSE]

Thanks for listening, and I'll see you in the next one.

[End of script]