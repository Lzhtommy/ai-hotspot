---
phase: quick-260422-ogt
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - trigger.config.ts
autonomous: true
requirements:
  - QUICK-260422-OGT: Fix Trigger.dev deploy ENOENT for src/lib/llm/prompts/*.md
must_haves:
  truths:
    - "Deployed Trigger.dev container can read src/lib/llm/prompts/rubric.md at runtime"
    - "Deployed Trigger.dev container can read src/lib/llm/prompts/tag-taxonomy.md at runtime"
    - "Deployed Trigger.dev container can read src/lib/llm/prompts/few-shot.md at runtime"
    - "process.cwd() + 'src/lib/llm/prompts/<file>.md' resolves inside the /app working directory"
  artifacts:
    - path: "trigger.config.ts"
      provides: "Trigger.dev v4 project config with additionalFiles build extension"
      contains: "additionalFiles"
  key_links:
    - from: "trigger.config.ts"
      to: "src/lib/llm/prompts/*.md"
      via: "additionalFiles build extension (glob)"
      pattern: "additionalFiles\\(\\{\\s*files:\\s*\\[.*src/lib/llm/prompts"
---

<objective>
Fix the Trigger.dev v4 deploy failure where `src/trigger/process-item.ts` crashes at
runtime with `ENOENT: no such file or directory, open '/app/src/lib/llm/prompts/rubric.md'`.

Purpose: `src/lib/llm/prompt.ts` reads three markdown files (rubric.md, tag-taxonomy.md,
few-shot.md) via `readFileSync(join(process.cwd(), 'src/lib/llm/prompts', ...))` at module
load time. Trigger.dev's default bundler does not copy non-JS assets into the deployed
container, so the files exist in source but not in the shipped image.

Output: `trigger.config.ts` updated to use the `additionalFiles` build extension from
`@trigger.dev/build/extensions/core`, instructing the deploy bundler to copy the three
prompt markdown files into the container at their original relative paths. `@trigger.dev/build@4.4.4`
is already installed as a devDependency (verified in package.json line 63).
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@trigger.config.ts
@src/lib/llm/prompt.ts
@package.json

<interfaces>
<!-- Key contract: @trigger.dev/build/extensions/core exports additionalFiles. -->
<!-- Usage from Trigger.dev v4 docs: https://trigger.dev/docs/config/config-file -->

From @trigger.dev/build/extensions/core:
```typescript
export function additionalFiles(options: {
  files: string[];  // glob patterns, relative to project root
}): BuildExtension;
```

From src/lib/llm/prompt.ts (the consumer — DO NOT MODIFY):
```typescript
const PROMPTS_DIR = join(process.cwd(), 'src/lib/llm/prompts');
const RUBRIC_TEXT = readFileSync(join(PROMPTS_DIR, 'rubric.md'), 'utf8');
const TAG_TAXONOMY = readFileSync(join(PROMPTS_DIR, 'tag-taxonomy.md'), 'utf8');
const FEW_SHOT_EXAMPLES = readFileSync(join(PROMPTS_DIR, 'few-shot.md'), 'utf8');
```

Critical: the glob must preserve the `src/lib/llm/prompts/` relative layout inside the
deploy artifact so that `process.cwd()` (which is `/app` inside the container) + the
relative path resolves correctly. `additionalFiles` preserves relative paths by default
when glob patterns are anchored with `./`.
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add additionalFiles build extension to trigger.config.ts</name>
  <files>trigger.config.ts</files>
  <action>
Edit `trigger.config.ts` to add the `additionalFiles` build extension so the three
prompt markdown files are shipped into the deployed container.

Specifically:

1. Add a top-level import (after the existing `defineConfig` import):
   ```ts
   import { additionalFiles } from '@trigger.dev/build/extensions/core';
   ```

2. Inside the `defineConfig({ ... })` object, add a `build` property with an `extensions`
   array that invokes `additionalFiles` with the glob `./src/lib/llm/prompts/**/*.md`:
   ```ts
   build: {
     extensions: [
       additionalFiles({ files: ['./src/lib/llm/prompts/**/*.md'] }),
     ],
   },
   ```

3. Add a short inline comment above the `build` block documenting why this is needed
   (references `src/lib/llm/prompt.ts` runtime readFileSync and the observed ENOENT).
   Example:
   ```ts
   // src/lib/llm/prompt.ts reads three markdown files via readFileSync at module load.
   // Trigger.dev's bundler does not copy non-JS assets by default, causing ENOENT at
   // container runtime. additionalFiles copies the globbed files into the deploy artifact
   // preserving relative paths, so process.cwd() + 'src/lib/llm/prompts/*.md' resolves
   // correctly inside /app.
   ```

Preserve all existing config fields exactly (`project`, `dirs`, `runtime`, `logLevel`,
`maxDuration`, `retries`). Do NOT modify them.

Do NOT edit `src/lib/llm/prompt.ts` — the readFileSync approach is intentional (keeps
prompt-cache keys stable across processes per D-LLM comment in that file).

Do NOT change the glob to a flatter pattern (e.g. `*.md` at root) — the relative path
preservation is what makes `process.cwd() + 'src/lib/llm/prompts/rubric.md'` resolve.

Import path note: use `@trigger.dev/build/extensions/core` exactly. This subpath is
exported by `@trigger.dev/build@4.4.4` (already in devDependencies per package.json L63).
  </action>
  <verify>
    <automated>pnpm typecheck</automated>
  </verify>
  <done>
- `trigger.config.ts` imports `additionalFiles` from `@trigger.dev/build/extensions/core`
- `defineConfig` call contains `build.extensions: [additionalFiles({ files: ['./src/lib/llm/prompts/**/*.md'] })]`
- `pnpm typecheck` exits 0 (no type errors introduced)
- All pre-existing config fields (project, dirs, runtime, logLevel, maxDuration, retries) unchanged
  </done>
</task>

</tasks>

<verification>
Post-edit checks:

1. **Static:** `pnpm typecheck` passes — confirms `additionalFiles` export exists in
   `@trigger.dev/build/extensions/core` at the installed version (4.4.4) and the config
   shape is accepted by `TriggerConfig`.

2. **Deploy smoke (human-gated, outside this plan):** User runs `pnpm trigger:deploy`
   and then triggers `process-item` from the Trigger.dev dashboard. Expected: task
   completes without the `ENOENT ... /app/src/lib/llm/prompts/rubric.md` error.
   This happens in CI/production, not as part of this atomic task.
</verification>

<success_criteria>
- [ ] `trigger.config.ts` contains the `additionalFiles` import and the `build.extensions` block
- [ ] `pnpm typecheck` passes with zero errors
- [ ] No other files modified
- [ ] Glob pattern is `./src/lib/llm/prompts/**/*.md` (preserves relative path layout)
</success_criteria>

<output>
After completion, create `.planning/quick/260422-ogt-fix-trigger-dev-deploy-enoent-for-src-li/260422-ogt-SUMMARY.md`
summarizing the edit, typecheck result, and any notes for the follow-up deploy verification.
</output>
