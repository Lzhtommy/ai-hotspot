---
phase: quick-260422-ogt
plan: "01"
subsystem: trigger-config
tags: [trigger-dev, build-extension, runtime-assets, enoent-fix]
dependency_graph:
  requires: []
  provides: [trigger-dev-prompt-files-in-container]
  affects: [src/trigger/process-item.ts, src/lib/llm/prompt.ts]
tech_stack:
  added: []
  patterns: [additionalFiles build extension for non-JS assets]
key_files:
  modified:
    - trigger.config.ts
decisions:
  - "additionalFiles glob anchored with ./ to preserve relative path layout inside /app container"
  - "Glob ./src/lib/llm/prompts/**/*.md covers all three files (rubric.md, tag-taxonomy.md, few-shot.md) and any future additions"
metrics:
  duration: 5min
  completed: "2026-04-22T09:40:09Z"
  tasks_completed: 1
  files_modified: 1
---

# Phase quick-260422-ogt Plan 01: Fix Trigger.dev Deploy ENOENT for src/lib/llm/prompts/*.md Summary

**One-liner:** Added `additionalFiles` build extension to `trigger.config.ts` so Trigger.dev's bundler copies `src/lib/llm/prompts/*.md` into the deployed container, resolving the ENOENT crash in `src/lib/llm/prompt.ts`.

## What Was Done

`src/lib/llm/prompt.ts` reads three markdown files at module load time via `readFileSync(join(process.cwd(), 'src/lib/llm/prompts', ...))`. Trigger.dev's default bundler (esbuild) only packages JavaScript/TypeScript files; non-JS assets like `.md` files are not included in the deployed container image. At runtime, `process.cwd()` is `/app`, so the paths `/app/src/lib/llm/prompts/rubric.md`, `/app/src/lib/llm/prompts/tag-taxonomy.md`, and `/app/src/lib/llm/prompts/few-shot.md` did not exist, causing an immediate `ENOENT` crash whenever `process-item` was triggered.

Fix: imported `additionalFiles` from `@trigger.dev/build/extensions/core` (already installed as `@trigger.dev/build@4.4.4` in devDependencies) and added a `build.extensions` block to `defineConfig`. The glob `./src/lib/llm/prompts/**/*.md` anchored with `./` preserves the relative path layout inside the deploy artifact, so the three files land at their expected locations relative to `/app`.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Add additionalFiles build extension to trigger.config.ts | 523dc77 | trigger.config.ts |

## Verification

- `pnpm typecheck` exits 0 — confirms `additionalFiles` export exists in `@trigger.dev/build/extensions/core@4.4.4` and the `build.extensions` shape is accepted by `TriggerConfig`.
- All pre-existing config fields (`project`, `dirs`, `runtime`, `logLevel`, `maxDuration`, `retries`) unchanged.
- Glob pattern is `./src/lib/llm/prompts/**/*.md` — preserves relative path layout.

**Deploy smoke (human-gated):** After merging, run `pnpm trigger:deploy` and trigger `process-item` from the dashboard. Expected: task completes without `ENOENT ... /app/src/lib/llm/prompts/rubric.md`.

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None.

## Threat Flags

None — this change is build-config only (no new network endpoints, auth paths, or DB schema).

## Self-Check: PASSED

- [x] `trigger.config.ts` imports `additionalFiles` from `@trigger.dev/build/extensions/core` (line 2)
- [x] `defineConfig` contains `build.extensions: [additionalFiles({ files: ['./src/lib/llm/prompts/**/*.md'] })]` (lines 42-44)
- [x] `pnpm typecheck` passes with zero errors
- [x] Commit 523dc77 exists: `git log --oneline | grep 523dc77`
- [x] No other files modified
