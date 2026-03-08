# Storyline Studio — Claude Code Instructions

## Context Management Protocol

**Problem**: Multi-agent research and planning workflows can fill the context window past the point of recovery. When this happens, the only fallback is manually mining JSONL chat logs — fragile and wasteful.

**Rules for large research/planning sessions:**

1. **Never hold all research in context at once.** When launching parallel research agents (especially 5+), write each agent's results to a working doc on disk *immediately* as they return — don't accumulate them in the conversation. Use `docs/research/` or a dedicated scratch file.

2. **Incremental synthesis over batch synthesis.** Instead of: launch 20 agents → collect all results → synthesize at the end, do: launch 3-5 agents → write results to disk → synthesize that batch into the plan → compact if needed → repeat. Smaller batches, continuous progress.

3. **Checkpoint before deepening.** Before launching a deepen/review pass, save the current plan state. If context blows up mid-deepen, the plan is still intact and you only lose unsynthesized research (which can be re-run).

4. **Use working docs as context bridges.** When approaching ~60-70% context usage during a research-heavy session, proactively:
   - Write a `docs/research/working-session-[date].md` with all findings so far
   - Summarize the current state and what remains
   - This file survives compaction and new sessions

5. **Warn the user.** If you're about to launch a batch of agents that will produce large results (e.g., 6+ research agents, full plan reviews), tell the user: "This will generate a lot of context. I'll write results to disk incrementally to avoid overflow."

## Project Structure

- `app/` — Next.js 15 application (src directory layout)
- `app/prisma/` — Prisma schema and migrations
- `app/src/app/(admin)/` — Admin route group
- `app/src/app/(survey)/` — Survey respondent route group
- `app/src/app/api/` — API routes
- `app/src/lib/` — Shared utilities, schemas, types
- `docs/plans/` — Feature plans (markdown)
- `docs/research/` — Research documents and recovered findings
- `docs/solutions/` — Institutional learnings (documented fixes)

## Tech Stack

Next.js 15, React 19, TypeScript, Prisma 6+, Supabase (Auth + Realtime only), PostgreSQL, Cloudflare R2, Tailwind + shadcn/ui, Vercel

## Brand

- Colors: Cream `#F4F3EF`, Navy `#100C21`, Storyline Blue `#121C8A`
- Fonts: Scto Grotesk A (body), Items Normal (display), Phonic Monospaced (subheadings, uppercase, max 5 words)
- Self-hosted via `next/font/local`
