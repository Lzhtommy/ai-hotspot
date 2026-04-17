# Phase 1: Infrastructure Foundation - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-17
**Phase:** 1 — Infrastructure Foundation
**Areas discussed:** RSSHub hosting (plus HF cold-start follow-up)

---

## Gray area selection

| Option | Description | Selected |
|--------|-------------|----------|
| RSSHub hosting | Railway vs Hetzner vs Fly vs pre-existing deployment | ✓ |
| Schema bootstrap scope | All 11 tables now vs minimal-now + grow per phase | |
| Preview DB strategy | Neon branch per PR vs shared dev DB vs no preview DB | |
| Repo layout + health-check surface | Single repo vs monorepo, what /api/health covers | |

**User's choice:** RSSHub hosting only. Others delegated to Claude's discretion — see CONTEXT.md "Claude's Discretion (locked)" subsections.

---

## RSSHub hosting

### Q1: Where should RSSHub run?

| Option | Description | Selected |
|--------|-------------|----------|
| Railway (Recommended) | One-click RSSHub template, HK/SG, managed Docker, auto-SSL. ~$5/mo | |
| Hetzner CAX11 + Docker | Bare VPS (ARM, ~€3.29/mo). Full control, Caddy/Certbot for SSL | |
| Fly.io Machines | Docker on global edge, HK/SIN region, scale-to-zero. ~$3–8/mo | |
| **Other (user free-text)** | | ✓ |

**User's choice:** Already deployed on Hugging Face Spaces at `https://lurnings-rsshub.hf.space/`. ACCESS_KEY already configured on the Space. Phase 1 wires the existing Space, does not provision new infra.

### Q2: How should RSSHub cache requests?

| Option | Description | Selected |
|--------|-------------|----------|
| Reuse Upstash Redis (Recommended) | RSSHub hits Upstash via REDIS_URL. One cache | |
| Co-located Redis container | Sidecar Redis on RSSHub host | |
| Memory cache (default) | RSSHub's in-process cache; ephemeral | ✓ |

**User's choice:** Memory cache. Acceptable because hourly polling tolerates cache loss on Space restart, and Upstash is reserved for the Next.js app's own feed caching.

### Q3: What guards the RSSHub endpoint from abuse?

| Option | Description | Selected |
|--------|-------------|----------|
| ACCESS_KEY only (Recommended) | Single shared secret, REQUIREMENTS mandates it | ✓ |
| ACCESS_KEY + Cloudflare in front | Add WAF/DDoS; DNS at Cloudflare | |
| ACCESS_KEY + IP allowlist | Limit to Vercel + Trigger.dev egress IPs | |

**User's choice:** ACCESS_KEY only. User confirmed the key is set on the HF Space.
**Notes:** The specific key value was pasted in chat — CONTEXT.md D-02 captures the rotation action. Secret is not written to any repo file.

### Q4: RSSHub runtime policy flags — lock these defaults?

| Option | Description | Selected |
|--------|-------------|----------|
| Harden defaults (Recommended) | ALLOW_USER_HOTLINK=false, DISALLOW_ROBOT=true, REQUEST_RETRY=2, CACHE_EXPIRE=900, CACHE_CONTENT_EXPIRE=3600 | ✓ |
| Permissive defaults | RSSHub defaults as-is | |
| Claude's discretion | Planner picks values | |

**User's choice:** Harden defaults. Phase 1 planner verifies the flags on the existing Space (or raises a follow-up to set them) but does not redeploy.

---

## HF cold-start follow-up

### Q5: How should we handle HF Space cold-starts?

| Option | Description | Selected |
|--------|-------------|----------|
| Accept cold-start, retry in ingest (Recommended) | Phase 2 ingest relies on Trigger.dev retry; Phase 1 health-check warms first | ✓ |
| Keep-alive ping | 10-minute cron to keep Space warm | |
| Upgrade Space to persistent | Pay HF for always-on | |
| Rotate the key now | Prioritize rotation before further discussion | |

**User's choice:** Accept cold-start + retry. Rotation is still flagged as an action in CONTEXT.md D-02 — it wasn't deprioritized, just not chosen as the blocking next step.

---

## Claude's Discretion

Areas the user explicitly delegated:
- Schema bootstrap scope (locked to REQUIREMENTS INFRA-03: all 11 tables in Phase 1 migration)
- Preview DB strategy (Neon branching per PR)
- Repo layout (single Next.js repo, Trigger.dev in `src/trigger/`)
- Health-check surface (`/api/health` pings Neon + pgvector + Redis + RSSHub + Trigger.dev; JSON response; 200/503)
- CI pipeline shape (GH Actions: typecheck + lint + build + migrate on PR Neon branch)
- Env/secret topology (three vaults: Vercel, Trigger.dev Cloud, HF Space; shared var names via `.env.example`)

## Deferred Ideas

- Keep-alive ping for HF Space (revisit if cold-start causes Phase 2 issues)
- Cloudflare / IP allowlist in front of RSSHub
- Migration off HF Space to Railway/Hetzner/Fly if HF sleep disrupts ingestion
- Secrets scanning beyond pre-commit hook (gitleaks, GitHub push protection)
