---
phase: 01-infrastructure-foundation
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - package.json
  - pnpm-lock.yaml
  - tsconfig.json
  - next.config.ts
  - .nvmrc
  - .gitignore
  - .env.example
  - .eslintrc.json
  - .prettierrc
  - .husky/pre-commit
  - src/app/layout.tsx
  - src/app/page.tsx
  - src/app/globals.css
  - postcss.config.mjs
autonomous: true
requirements: [INFRA-01, INFRA-07]
tags: [scaffold, nextjs, tooling, pnpm, husky, security]
user_setup:
  - service: github
    why: "CI/CD, Vercel GitHub app, repo hosting"
    env_vars: []
    dashboard_config:
      - task: "Create empty public/private GitHub repo and link as `origin`"
        location: "https://github.com/new"
  - service: vercel
    why: "Host the Next.js preview + production deployments (Phase 1 success criterion #1)"
    env_vars: []
    dashboard_config:
      - task: "Install Vercel GitHub App against the repo (no deploy yet — Plan 05 wires env + settings)"
        location: "https://vercel.com/new"

must_haves:
  truths:
    - "`pnpm install && pnpm typecheck && pnpm build` succeeds locally on Node 20.9+"
    - "`git commit` with a file containing a UUID is rejected by the pre-commit hook"
    - "`.env.example` lists every variable name needed by later plans with no real values committed"
    - "Repo has initial git history with a baseline commit; `pnpm-lock.yaml` is committed"
    - "Running `pnpm lint` exits 0 on the scaffolded codebase"
  artifacts:
    - path: "package.json"
      provides: "pnpm scripts (dev, build, typecheck, lint, format), engines.node >=20.9, packageManager pnpm@>=9"
      contains: "\"typecheck\""
    - path: "tsconfig.json"
      provides: "Strict TypeScript config"
      contains: "\"strict\": true"
    - path: ".nvmrc"
      provides: "Node version pin (20)"
      contains: "20"
    - path: ".env.example"
      provides: "Canonical env var registry (D-06, D-07)"
      contains: "RSSHUB_ACCESS_KEY="
    - path: ".husky/pre-commit"
      provides: "Secret scanning + lint-staged hook (D-08)"
      contains: "[0-9a-f]"
    - path: ".gitignore"
      provides: "Excludes .env.local, node_modules, .next, etc."
      contains: ".env.local"
    - path: "src/app/page.tsx"
      provides: "Next.js 15 App Router placeholder home page"
    - path: "src/app/layout.tsx"
      provides: "Root layout, metadata, html[lang=zh-CN]"
  key_links:
    - from: ".husky/pre-commit"
      to: "staged diff"
      via: "grep UUID pattern"
      pattern: "[0-9a-f]\\{8\\}-[0-9a-f]\\{4\\}"
    - from: "package.json scripts"
      to: ".github/workflows/ci.yml"
      via: "CI calls pnpm typecheck / lint / build"
      pattern: "typecheck|lint|build"
---

<objective>
Bootstrap the greenfield Next.js 15 App Router repo with pnpm, TypeScript-strict tooling, Husky pre-commit secret scanning, Prettier, ESLint, Tailwind CSS v4, and a canonical `.env.example` — so every downstream plan in Phase 1 (and all of Phases 2-6) has a stable foundation to build against.

Purpose: This is Wave 1 of the entire project. It IS the baseline — no code exists yet. Every convention (file layout, tooling, env topology, pre-commit hygiene) lands here.
Output: A committable Next.js 15 project that `pnpm typecheck && pnpm lint && pnpm build` passes cleanly, with secret-scanning guardrails enabled before any real secret can be committed.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/ROADMAP.md
@.planning/REQUIREMENTS.md
@.planning/STATE.md
@.planning/phases/01-infrastructure-foundation/01-CONTEXT.md
@.planning/phases/01-infrastructure-foundation/01-RESEARCH.md
@CLAUDE.md

<interfaces>
<!-- No prior code. This plan creates the canonical file layout that Plans 02-06 will populate. -->
<!-- Env var names below are LOCKED by D-06/D-07. Later plans consume these exact names. -->

Canonical env var names (from RESEARCH.md §.env.example):
- DATABASE_URL
- UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN
- TRIGGER_SECRET_KEY, TRIGGER_ACCESS_TOKEN
- RSSHUB_BASE_URL, RSSHUB_ACCESS_KEY
- ANTHROPIC_API_KEY, VOYAGE_API_KEY
- AUTH_SECRET, AUTH_URL, GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, RESEND_API_KEY
- LANGFUSE_PUBLIC_KEY, LANGFUSE_SECRET_KEY, LANGFUSE_BASE_URL, SENTRY_DSN

Canonical directory layout (from RESEARCH.md §Project Structure):
- src/app/ (App Router pages + API routes)
- src/lib/db/ (Drizzle client + schema — Plan 02 creates these files)
- src/lib/redis/ (Upstash client — Plan 03)
- src/lib/rsshub.ts (RSSHub fetch wrapper — Plan 04)
- src/trigger/ (Trigger.dev tasks — Plan 03)
- drizzle/ (migration output — Plan 02)
- docs/ (runbooks — Plan 06)

Node/pnpm pins (D-14, RESEARCH.md §Standard Stack):
- Node >=20.9 (pinned in .nvmrc as "20" and engines.node >= "20.9")
- pnpm >=9 (set packageManager field in package.json)
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Initialize git + scaffold Next.js 15 with pnpm</name>
  <read_first>
    - .planning/phases/01-infrastructure-foundation/01-CONTEXT.md (D-13 single-repo, D-14 pnpm, D-08 no secrets)
    - .planning/phases/01-infrastructure-foundation/01-RESEARCH.md §Standard Stack §Installation (authoritative `pnpm create next-app` command)
    - CLAUDE.md §Project §Constraints (Chinese UI, Next.js 15 App Router pin)
  </read_first>
  <files>.git/, package.json, pnpm-lock.yaml, tsconfig.json, next.config.ts, src/app/layout.tsx, src/app/page.tsx, src/app/globals.css, postcss.config.mjs, .gitignore, .nvmrc</files>
  <action>
    1. Run `git init` at the repo root (if `.git` doesn't already exist — check first). Set default branch to `main`: `git branch -m main` if needed.
    2. Confirm `node --version` reports >= 20.9. If not, abort and surface the error.
    3. Create `.nvmrc` with content exactly `20` (one line).
    4. Scaffold Next.js 15 via: `pnpm create next-app@latest . --ts --tailwind --eslint --app --src-dir --import-alias "@/*" --use-pnpm --yes`.
       - **CRITICAL pin:** CLAUDE.md Tech Stack locks Next.js to 15.x. `pnpm create next-app@latest` may install 16.x. After scaffold, explicitly pin: `pnpm add next@^15 react@^18 react-dom@^18`. Verify `package.json` shows `"next": "^15"` (NOT `^16`). Document the pin with a `// next.js pinned to 15.x per CLAUDE.md` comment at the top of `next.config.ts`.
    5. After scaffold, inspect `tsconfig.json` and ensure `"strict": true` is set (the Next.js template does this — confirm). If not, add it.
    6. Verify `.gitignore` contains at minimum: `node_modules`, `.next`, `.env*.local`, `.env` (but NOT `.env.example`), `.DS_Store`, `*.tsbuildinfo`, `/drizzle/meta/` (optional — Plan 02 may adjust). Add `.env.local` explicitly if not present.
    7. Add these fields to `package.json` root:
       ```json
       "engines": { "node": ">=20.9" },
       "packageManager": "pnpm@9.15.0"
       ```
       (use `pnpm --version` to choose the actual pnpm version installed on the machine; fall back to `9.15.0` if indeterminate).
    8. Update `package.json` scripts to include:
       ```json
       "typecheck": "tsc --noEmit",
       "lint": "next lint",
       "format": "prettier --write \"**/*.{ts,tsx,js,jsx,json,md,yml,yaml,css}\" --ignore-path .gitignore",
       "format:check": "prettier --check \"**/*.{ts,tsx,js,jsx,json,md,yml,yaml,css}\" --ignore-path .gitignore"
       ```
       Keep the scaffold's `dev`, `build`, `start` scripts as-is.
    9. Set `src/app/layout.tsx` html lang to `zh-CN`: `<html lang="zh-CN">` (CLAUDE.md UI language constraint).
    10. Run `pnpm install` if the scaffold didn't already (ensure `pnpm-lock.yaml` exists and is committed).
    11. Run `pnpm typecheck && pnpm lint && pnpm build` — all three must exit 0 before finishing this task.
  </action>
  <verify>
    <automated>node -v | grep -E "^v(20\.(9|[1-9][0-9])|2[1-9]|[3-9][0-9])" && pnpm -v && test -f package.json && test -f pnpm-lock.yaml && test -f tsconfig.json && test -f .nvmrc && test -f src/app/layout.tsx && grep -q "\"strict\": true" tsconfig.json && grep -q "\"typecheck\"" package.json && grep -q "\"next\": \"\\^15" package.json && grep -q "zh-CN" src/app/layout.tsx && pnpm typecheck && pnpm lint && pnpm build</automated>
  </verify>
  <done>
    - `.git/` exists with `main` as default branch
    - Next.js 15.x installed (NOT 16.x) — `grep "\"next\": \"\\^15" package.json` matches
    - `pnpm typecheck`, `pnpm lint`, `pnpm build` all exit 0
    - `src/app/layout.tsx` has `<html lang="zh-CN">`
    - `pnpm-lock.yaml` committable (not ignored)
    - `engines.node >= 20.9` and `packageManager` field set in package.json
  </done>
</task>

<task type="auto">
  <name>Task 2: Install husky + lint-staged + Prettier and land pre-commit UUID secret hook</name>
  <read_first>
    - .planning/phases/01-infrastructure-foundation/01-CONTEXT.md (D-08 pre-commit UUID grep; D-02 HF ACCESS_KEY rotation)
    - .planning/phases/01-infrastructure-foundation/01-RESEARCH.md §Pattern 9: Pre-commit Secret Hook (verbatim hook content) §Common Pitfalls: lint-staged
    - package.json (current scripts — so lint-staged keys are consistent)
  </read_first>
  <files>package.json, .husky/pre-commit, .prettierrc, .prettierignore</files>
  <action>
    1. Install dev dependencies: `pnpm add -D husky@^9 lint-staged@^16 prettier@^3`.
    2. Initialize husky: `pnpm exec husky init`. This creates `.husky/pre-commit` with a default `pnpm test` line — replace that line entirely.
    3. Overwrite `.husky/pre-commit` with the exact content below (sourced verbatim from RESEARCH.md §Pattern 9):
       ```sh
       #!/usr/bin/env sh
       . "$(dirname -- "$0")/_/husky.sh"

       # Block commits containing UUID-shaped ACCESS_KEY values.
       # HF Space ACCESS_KEY format: UUID (8-4-4-4-12 hex) per D-08 / RESEARCH.md A2.
       # FIXME: verify exact HF Space ACCESS_KEY format with user; if not UUID, broaden the regex.
       STAGED=$(git diff --cached --name-only --diff-filter=ACM | grep -vE '^(\.env\.example|CLAUDE\.md)$' || true)
       if [ -n "$STAGED" ]; then
         if echo "$STAGED" | xargs grep -lE '[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}' 2>/dev/null; then
           echo "ERROR: Staged content contains a UUID (possible ACCESS_KEY or DB URL token)."
           echo "Remove the secret from staged files before committing. If this is a false positive"
           echo "(e.g. a test fixture UUID), move it to .env.example or CLAUDE.md, or use --no-verify"
           echo "with explicit user approval."
           exit 1
         fi
       fi

       pnpm lint-staged
       ```
       Make it executable: `chmod +x .husky/pre-commit`.
    4. Add `lint-staged` config to `package.json` root (NOT a separate file):
       ```json
       "lint-staged": {
         "*.{ts,tsx,js,jsx}": ["eslint --fix", "prettier --write"],
         "*.{json,md,yaml,yml,css}": ["prettier --write"]
       }
       ```
    5. Create `.prettierrc` at repo root with JSON content:
       ```json
       {
         "semi": true,
         "singleQuote": true,
         "trailingComma": "all",
         "printWidth": 100,
         "tabWidth": 2
       }
       ```
    6. Create `.prettierignore`:
       ```
       .next
       node_modules
       pnpm-lock.yaml
       drizzle/meta
       .planning/**/*.md
       ```
    7. Smoke test the hook: create a scratch file `/tmp/uuid-smoke.ts` with a UUID string, `git add /tmp/uuid-smoke.ts` (symlinked into repo), `git commit -m test` — expect exit 1. Then `git reset` and delete the scratch. (Execute the smoke test inline; if it cannot be run due to environment constraints, document the manual verification in the Done list.)
    8. Run `pnpm format` to apply Prettier across the scaffolded files, then `pnpm typecheck && pnpm lint` must still pass.
  </action>
  <verify>
    <automated>test -x .husky/pre-commit && grep -q "[0-9a-fA-F]{8}" .husky/pre-commit && grep -q "lint-staged" package.json && test -f .prettierrc && test -f .prettierignore && pnpm typecheck && pnpm lint</automated>
  </verify>
  <done>
    - `.husky/pre-commit` exists and is executable with UUID grep + `pnpm lint-staged` tail
    - `package.json` has `lint-staged` stanza with ts/tsx/json globs
    - `.prettierrc` + `.prettierignore` land at repo root
    - Scratch UUID commit is rejected (exit 1) — verified manually or via integration test
    - `pnpm typecheck` + `pnpm lint` still exit 0 after formatter runs
  </done>
</task>

<task type="auto">
  <name>Task 3: Create .env.example as canonical variable registry</name>
  <read_first>
    - .planning/phases/01-infrastructure-foundation/01-RESEARCH.md §`.env.example` — Complete Variable List (authoritative content — copy verbatim)
    - .planning/phases/01-infrastructure-foundation/01-CONTEXT.md (D-06, D-07, D-08 — single source of truth, identical names across vaults, no values ever committed)
  </read_first>
  <files>.env.example</files>
  <action>
    Create `.env.example` at the repo root with the EXACT content below (sourced verbatim from RESEARCH.md §.env.example — Complete Variable List). All values MUST be empty strings after `=`; no real secrets in this file. If you change any variable NAME, later plans and CI will break.

    ```bash
    # ============================================================
    # AI Hotspot — Environment Variables
    # Source of truth for variable names across all three vaults:
    # 1. Vercel project env (Next.js runtime)
    # 2. Trigger.dev Cloud env (worker runtime)
    # 3. Hugging Face Space (RSSHub config — set in HF Space secrets UI)
    #
    # DO NOT commit actual values. This file documents names only.
    # ============================================================

    # --- Database (Vercel + Trigger.dev) ---
    DATABASE_URL=
    # CI note: DATABASE_URL is set per-PR by create-branch-action output

    # --- Redis (Vercel) ---
    UPSTASH_REDIS_REST_URL=
    UPSTASH_REDIS_REST_TOKEN=

    # --- Trigger.dev (Vercel runtime — for triggering tasks) ---
    TRIGGER_SECRET_KEY=

    # --- Trigger.dev (CLI / GitHub Actions CI — for deployment) ---
    TRIGGER_ACCESS_TOKEN=

    # --- RSSHub (Vercel + Trigger.dev) ---
    RSSHUB_BASE_URL=
    RSSHUB_ACCESS_KEY=

    # --- LLM APIs (Vercel + Trigger.dev) ---
    ANTHROPIC_API_KEY=
    VOYAGE_API_KEY=

    # --- Authentication (Vercel) — placeholders; implemented in Phase 5 ---
    AUTH_SECRET=
    AUTH_URL=
    GITHUB_CLIENT_ID=
    GITHUB_CLIENT_SECRET=
    GOOGLE_CLIENT_ID=
    GOOGLE_CLIENT_SECRET=
    RESEND_API_KEY=

    # --- Observability (Vercel + Trigger.dev) — placeholders; implemented in Phase 6 ---
    LANGFUSE_PUBLIC_KEY=
    LANGFUSE_SECRET_KEY=
    LANGFUSE_BASE_URL=
    SENTRY_DSN=

    # --- Neon CI (GitHub Actions secrets/vars — not in Vercel) ---
    # NEON_API_KEY=
    # NEON_PROJECT_ID=

    # --- HF Space variables (set in HF Space secrets UI, not here) ---
    # ALLOW_USER_HOTLINK=false
    # DISALLOW_ROBOT=true
    # REQUEST_RETRY=2
    # CACHE_EXPIRE=900
    # CACHE_CONTENT_EXPIRE=3600
    # ACCESS_KEY=<same value as RSSHUB_ACCESS_KEY>
    ```

    Verify every line ends with `=` (no values). The pre-commit hook is allow-listed to skip `.env.example`, so even a UUID-shaped comment here would not trigger it — but DO NOT put real values.
  </action>
  <verify>
    <automated>test -f .env.example && grep -c "^[A-Z_]*=$" .env.example | awk '$1 >= 18 { exit 0 } { exit 1 }' && ! grep -E "^[A-Z_]+=[^ ]+$" .env.example | grep -vE "^[A-Z_]+=$"</automated>
  </verify>
  <done>
    - `.env.example` exists at repo root
    - Contains at minimum: DATABASE_URL, UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN, TRIGGER_SECRET_KEY, TRIGGER_ACCESS_TOKEN, RSSHUB_BASE_URL, RSSHUB_ACCESS_KEY, ANTHROPIC_API_KEY, VOYAGE_API_KEY, AUTH_SECRET, AUTH_URL, GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, RESEND_API_KEY, LANGFUSE_PUBLIC_KEY, LANGFUSE_SECRET_KEY, LANGFUSE_BASE_URL, SENTRY_DSN (20 vars minimum)
    - Every uncommented line ends with `=` and has no value
    - File NOT listed in `.gitignore`
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Developer laptop → git repo | Pre-commit hook is the last line of defense before secrets enter VCS history |
| .env.local → .env.example | `.env.local` never leaves the laptop; `.env.example` is the public schema |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-1-01 | Information Disclosure | `.gitignore` + `.env.example` | mitigate | `.env*.local` in `.gitignore`; `.env.example` contains only key names with empty `=` values; every entry audited in Task 3 |
| T-1-01b | Information Disclosure | `.husky/pre-commit` hook | mitigate | UUID-regex grep over staged diff in `ACM` filter; exits 1 on match; `.env.example` and `CLAUDE.md` allow-listed to avoid false positives on documented placeholder keys |
| T-1-02 | Information Disclosure (secondary) | `RSSHUB_ACCESS_KEY` env handling | mitigate | `RSSHUB_ACCESS_KEY` documented in `.env.example` only; runtime usage deferred to Plans 04/06; `NEXT_PUBLIC_` prefix forbidden (enforced by code review + ESLint no-process-env rule in Plan 04) |
| T-1-06 | Information Disclosure | CI secret handling | accept (deferred) | GH Actions secrets wiring lands in Plan 05; Plan 01 only defines the variable names — no CI YAML exists yet |
</threat_model>

<verification>
Run locally after all three tasks complete:
```bash
pnpm install --frozen-lockfile
pnpm typecheck
pnpm lint
pnpm build
test -x .husky/pre-commit
grep -q "RSSHUB_ACCESS_KEY=" .env.example
node -v     # must be >= 20.9
grep -q "\"next\": \"\\^15" package.json   # Next.js pinned to 15.x
```

Every command must exit 0.
</verification>

<success_criteria>
- Greenfield repo now has a typechecking, lint-clean, buildable Next.js 15 App Router scaffold
- `package.json` declares pnpm@>=9, node>=20.9, and the five lifecycle scripts (`dev`, `build`, `start`, `typecheck`, `lint`, `format`)
- Secret-scanning pre-commit hook is armed — a UUID-containing staged file fails the commit
- `.env.example` is the canonical variable registry that Plans 02-06 will reference
- Pattern for `src/` layout, `src/app/` routing, and Tailwind v4 is established for Plan 04 (`/api/health`) and all later UI work
</success_criteria>

<output>
After completion, create `.planning/phases/01-infrastructure-foundation/01-01-SUMMARY.md` with:
- Actual Next.js version installed (15.x.x)
- pnpm version pinned in `packageManager`
- Confirmation Prettier + ESLint + Husky all passed `pnpm typecheck && pnpm lint && pnpm build`
- Whether the pre-commit UUID smoke test was verified (yes/no + method)
- Any deltas from the planned file list
</output>
</content>
</invoke>