---
phase: 01-infrastructure-foundation
plan: 01
subsystem: infra
tags: [scaffold, nextjs, nextjs-15, pnpm, typescript-strict, tailwindcss-v4, husky, lint-staged, prettier, eslint-flat, env-registry, security]

# Dependency graph
requires: []
provides:
  - "Next.js 15 App Router scaffold with src/ layout and TS strict mode"
  - "pnpm workspace root pinned to pnpm@10.32.1 + engines.node>=20.9"
  - ".nvmrc=20 for contributor onboarding"
  - "Husky 9 pre-commit hook with UUID-based secret-scan heuristic"
  - "lint-staged config running eslint --fix + prettier on staged files"
  - "Prettier 3 config (singleQuote, trailingComma=all, printWidth=100)"
  - "ESLint 9 flat config via FlatCompat bridging Next 15's legacy preset"
  - ".env.example canonical variable registry (20 active vars)"
  - ".gitignore allow-list for .env.example + block for .env*.local"
affects: [01-02-drizzle-schema, 01-03-trigger-redis, 01-04-rsshub-health, 01-05-ci-pipeline, 01-06-docs-runbooks, Phase 2, Phase 3, Phase 4, Phase 5, Phase 6]

# Tech tracking
tech-stack:
  added:
    - "next@15.5.15 (pinned to ^15 per CLAUDE.md)"
    - "react@18.3.1 + react-dom@18.3.1"
    - "typescript@5.9.3 (strict mode)"
    - "tailwindcss@4.2.2 + @tailwindcss/postcss"
    - "eslint@9 with eslint-config-next@^15 via @eslint/eslintrc FlatCompat"
    - "husky@9.1.7"
    - "lint-staged@16.4.0"
    - "prettier@3.8.3"
  patterns:
    - "Single-package repo (no monorepo); Trigger.dev code will live under src/trigger/"
    - "Env var names are the source of truth; values live in three vaults (Vercel, Trigger.dev Cloud, HF Space)"
    - "Pre-commit secret-scan is advisory UUID heuristic (gitleaks deferred to Phase 6)"
    - "Prettier respects .prettierignore + .gitignore implicitly (no --ignore-path override)"
    - "html lang=zh-CN from root layout (Chinese-only UI per CLAUDE.md)"

key-files:
  created:
    - "package.json (engines, packageManager, scripts, lint-staged)"
    - "pnpm-lock.yaml (committed)"
    - "tsconfig.json (strict=true)"
    - ".nvmrc (20)"
    - ".gitignore (scaffold + .env allow-list)"
    - ".env.example (canonical registry)"
    - ".prettierrc"
    - ".prettierignore"
    - ".husky/pre-commit (UUID scan + lint-staged)"
    - "eslint.config.mjs (FlatCompat wrapper)"
    - "next.config.ts (with Next-15-pin comment)"
    - "postcss.config.mjs"
    - "src/app/layout.tsx (html lang=zh-CN, AI Hotspot metadata)"
    - "src/app/page.tsx (scaffold placeholder)"
    - "src/app/globals.css (Tailwind v4 entry)"
    - "public/*.svg (scaffold assets)"
  modified: []

key-decisions:
  - "Scaffolded in temp dir then copied to project root (pnpm create next-app refuses non-empty dirs)"
  - "Kept branch as master (remote origin/master already tracks); renaming to main would require remote-branch-rename and is out of scope for a local bootstrap"
  - "Pinned React to ^18 (not ^19) per the plan's `pnpm add next@^15 react@^18 react-dom@^18` directive; Next 15.5 supports both but plan locks 18"
  - "ESLint flat config uses @eslint/eslintrc FlatCompat because eslint-config-next@15 is legacy-only; Next 16 ships native flat config but we pinned to 15"
  - "Dropped `--ignore-path .gitignore` override on format scripts so Prettier uses .prettierignore + .gitignore together (initial format run reformatted .planning/ markdown; reverted and fixed)"
  - "Cleaned husky v9 deprecated shim lines (#!/usr/bin/env sh + _husky.sh source) — husky 9.1+ no longer needs them; v10 will error on them"

patterns-established:
  - "Pattern: env var names live in .env.example only; real values never enter git"
  - "Pattern: pre-commit hook = UUID grep + lint-staged; false positives move to .env.example or CLAUDE.md allow-list"
  - "Pattern: commit messages use scope `01-01` (phase-plan) per plan convention"

requirements-completed: [INFRA-01, INFRA-07]

# Metrics
duration: 6min
completed: 2026-04-17
---

# Phase 01 Plan 01: Repo Bootstrap Summary

**Next.js 15 App Router scaffold on pnpm with TypeScript strict, Tailwind v4, ESLint 9 flat config, Husky UUID-secret-scan pre-commit hook, and a 20-variable .env.example canonical registry — every Phase-1 downstream plan now has a typechecking, lint-clean, buildable baseline to land against.**

## Performance

- **Duration:** 6 min
- **Started:** 2026-04-17T07:07:26Z
- **Completed:** 2026-04-17T07:13:40Z (approx)
- **Tasks:** 3/3
- **Files created:** 18
- **Files modified:** 0 (greenfield)

## Accomplishments

- Next.js 15.5.15 App Router scaffold with src/ layout and TS strict mode, building in ~5.4s and producing a 108 kB First Load JS home route.
- Husky 9 pre-commit hook that rejects any staged file containing a UUID-shaped value (verified by smoke test — the rejection path fires and exit 1 is returned to git).
- Canonical `.env.example` with 20 active variable names covering DB, Redis, Trigger.dev, RSSHub, LLM APIs, Auth.js v5, and observability — zero values committed.
- `pnpm install --frozen-lockfile && pnpm typecheck && pnpm lint && pnpm build` all exit 0.

## Task Commits

Each task was committed atomically on branch `master`:

1. **Task 1: Scaffold Next.js 15 + pnpm + TypeScript strict** - `a49f22c` (feat)
2. **Task 2: Husky + lint-staged + Prettier + UUID pre-commit hook** - `fdb38ed` (feat)
3. **Task 3: .env.example canonical env registry** - `757adb2` (feat)

## Files Created/Modified

- `package.json` - Engines (>=20.9), packageManager pnpm@10.32.1, scripts (dev/build/start/lint/typecheck/format/format:check/prepare), deps (next ^15, react ^18), devDeps (eslint 9, tailwind 4, prettier 3, husky 9, lint-staged 16, @eslint/eslintrc), lint-staged config
- `pnpm-lock.yaml` - Committed lockfile for reproducible installs
- `tsconfig.json` - strict=true, bundler module resolution, @/* path alias to src/*
- `.nvmrc` - Node 20 pin for contributor shells
- `.gitignore` - Next.js defaults + .env*.local block + !.env.example allow
- `.env.example` - 20 active env vars + commented CI/HF-only vars
- `.prettierrc` - singleQuote, trailingComma=all, printWidth=100, tabWidth=2
- `.prettierignore` - excludes .planning/, CLAUDE.md, public/, svg, lockfile
- `.husky/pre-commit` - UUID grep + lint-staged (husky v9.1+ no-shim form)
- `eslint.config.mjs` - FlatCompat bridging Next 15's legacy `next/core-web-vitals` + `next/typescript` presets
- `next.config.ts` - Empty config + top-of-file comment documenting the Next-15 pin
- `postcss.config.mjs` - @tailwindcss/postcss plugin
- `src/app/layout.tsx` - html lang="zh-CN", AI Hotspot metadata (title + Chinese description)
- `src/app/page.tsx` - Scaffold placeholder (next task wave will replace)
- `src/app/globals.css` - Tailwind v4 @import

## Decisions Made

- **Branch kept as `master`:** remote already tracks `origin/master`; renaming to `main` would force a remote-branch rename outside the scope of a local scaffold plan.
- **React pinned to ^18 (not ^19):** followed the plan's explicit directive. Next 15.5 supports React 18 + 19; the plan's example `pnpm add next@^15 react@^18 react-dom@^18` is the source of truth.
- **FlatCompat for ESLint:** Next 15's `eslint-config-next` is legacy-format only; FlatCompat bridges it into ESLint 9's flat config. Next 16 ships native flat config, but we pinned to 15 per CLAUDE.md.
- **Prettier format scripts dropped `--ignore-path .gitignore`:** the override prevented `.prettierignore` from being consulted. Removed so both ignore files apply together.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 – Blocking] ESLint 9 flat config incompatible with eslint-config-next@15**
- **Found during:** Task 1 (first `pnpm lint` run)
- **Issue:** The scaffold's `eslint.config.mjs` imported `eslint-config-next/core-web-vitals` and `eslint-config-next/typescript` assuming flat-config exports. Those exports only exist in `eslint-config-next@16+`. With the Next-15 pin, `pnpm lint` died with `ERR_MODULE_NOT_FOUND`.
- **Fix:** Rewrote `eslint.config.mjs` to use `@eslint/eslintrc` `FlatCompat` to wrap the legacy presets. Added `@eslint/eslintrc@^3` as a devDependency.
- **Files modified:** `eslint.config.mjs`, `package.json`, `pnpm-lock.yaml`
- **Verification:** `pnpm lint` exits 0.
- **Committed in:** `a49f22c` (Task 1 commit)

**2. [Rule 1 – Bug] Husky v9 deprecated shim lines in hook**
- **Found during:** Task 2 UUID smoke-test
- **Issue:** `pnpm exec husky init` generated a `.husky/pre-commit` with the now-deprecated `#!/usr/bin/env sh` + `. "$(dirname ...)/_/husky.sh"` shim. These trigger deprecation warnings in husky 9.1+ and will error in husky 10.
- **Fix:** Removed the two shim lines. Husky 9 invokes hooks via its own runtime; explicit shell + source lines are no longer needed.
- **Files modified:** `.husky/pre-commit`
- **Verification:** UUID smoke test still fires and rejects the commit with exit 1.
- **Committed in:** `fdb38ed` (Task 2 commit)

**3. [Rule 1 – Bug] Format script was reformatting .planning/ and CLAUDE.md**
- **Found during:** Task 2 `pnpm format` run
- **Issue:** The plan's format script `prettier --write ... --ignore-path .gitignore` discarded `.prettierignore`. Prettier then reformatted all .planning/ markdown and CLAUDE.md — these documents are authored by the planning pipeline (and by the user) and must not be auto-formatted.
- **Fix:** Dropped `--ignore-path .gitignore` from `format` and `format:check` scripts. Prettier 3 natively consults both `.prettierignore` and `.gitignore` with no override. Broadened `.prettierignore` to explicitly exclude `.planning/`, `CLAUDE.md`, `public/`, and `*.svg`. Reverted the unintended reformatting with `git checkout -- .planning/ CLAUDE.md`.
- **Files modified:** `package.json`, `.prettierignore`
- **Verification:** `pnpm format:check` exits 0; `.planning/` and `CLAUDE.md` diffs are clean.
- **Committed in:** `fdb38ed` (Task 2 commit)

---

**Total deviations:** 3 auto-fixed (1 blocking, 2 bugs)
**Impact on plan:** All fixes essential for the plan's stated verification (`pnpm typecheck && pnpm lint && pnpm build` clean) and for not corrupting planning-dir authorship. No scope creep.

## Issues Encountered

- **`pnpm create next-app` refuses non-empty directories.** The repo root already contained `.planning/`, `.git/`, `CLAUDE.md`, and `.nvmrc`. Scaffolded into `/tmp/ai-hotspot-scaffold` and copied source files back. `next-env.d.ts` was ignored by the template's `.gitignore` and is regenerated on every `next build`, so it's left uncommitted by design.
- **Next 16 vs Next 15 pin.** `pnpm create next-app@latest` installed `next@16.2.4` + `react@19`. After scaffold, `package.json` was rewritten to `"next": "^15"`, `"react": "^18"`, `"react-dom": "^18"`, `"eslint-config-next": "^15"`, then `pnpm install` regenerated the lockfile at `next@15.5.15`. `next.config.ts` carries a comment documenting the pin.

## User Setup Required

None in this plan. The plan's `user_setup` frontmatter flags two follow-ups that are **not** Plan 01 completion gates but are prerequisites for Plan 05 (CI) and later Vercel deployments:

- **GitHub:** create the empty repo and add it as `origin`.
- **Vercel:** install the Vercel GitHub App against the repo (no deploy required yet).

These land naturally in Plan 05. No environment variables are set in Plan 01.

## Next Phase Readiness

- **Plan 01-02 (drizzle-schema):** `package.json` + `pnpm-lock.yaml` + `tsconfig.json` strict are in place. Plan 02 will add `drizzle-orm`, `@neondatabase/serverless`, and `drizzle-kit`, then land the 11-table Drizzle schema + pgvector migration.
- **Plan 01-03 (trigger-redis):** the `src/` layout is ready for `src/lib/redis/` and `src/trigger/`.
- **Plan 01-04 (rsshub-health):** `/api/health` route will land under `src/app/api/health/route.ts`; env vars `RSSHUB_BASE_URL` + `RSSHUB_ACCESS_KEY` are already declared.
- **Plan 01-05 (ci-pipeline):** `pnpm typecheck`, `pnpm lint`, `pnpm build` are stable CI targets.
- **Plan 01-06 (docs-runbooks):** `docs/` directory does not yet exist; Plan 06 creates it alongside runbooks.

### Known Stubs

None. All scaffold placeholders (`src/app/page.tsx` default Next template) are explicit scaffold output, not data-wired stubs — Plan 04+ will replace the home page UI.

## Self-Check: PASSED

- Files created confirmed on disk: `package.json`, `.env.example`, `.husky/pre-commit`, `.nvmrc`, `tsconfig.json`, `.prettierrc`, `.prettierignore`, `eslint.config.mjs`, `src/app/layout.tsx` — all present.
- Commits confirmed in `git log`: `a49f22c`, `fdb38ed`, `757adb2` — all reachable.
- All verification commands exit 0: `pnpm install --frozen-lockfile`, `pnpm typecheck`, `pnpm lint`, `pnpm build`.
- Pre-commit UUID smoke test: rejected a staged file containing a UUID-v4-shaped literal (8-4-4-4-12 hex) with exit 1 (verified twice — before and after removing the husky v9 deprecated shim). The literal value is intentionally not reproduced here so this summary does not trip the hook on its own commit.

---
*Phase: 01-infrastructure-foundation*
*Completed: 2026-04-17*
