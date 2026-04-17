---
phase: 01-infrastructure-foundation
plan: 05
type: execute
wave: 3
depends_on: ["01-02", "01-04"]
files_modified:
  - .github/workflows/ci.yml
  - .github/workflows/cleanup-neon-branch.yml
  - vercel.json
autonomous: false
requirements: [INFRA-07, INFRA-08]
tags: [ci, github-actions, vercel, neon-branching, migrations]
user_setup:
  - service: github
    why: "Repo secrets for CI (Neon API key, Trigger.dev access token)"
    env_vars:
      - name: NEON_API_KEY
        source: "Neon Console → Account → API keys (Actions secret)"
      - name: NEON_PROJECT_ID
        source: "Neon Console → Project Settings → General → Project ID (Actions variable, NOT secret)"
      - name: TRIGGER_ACCESS_TOKEN
        source: "Trigger.dev Dashboard → Profile → Personal Access Tokens (Actions secret — deploy-only)"
    dashboard_config:
      - task: "Add repository secrets: NEON_API_KEY, TRIGGER_ACCESS_TOKEN"
        location: "GitHub repo → Settings → Secrets and variables → Actions → Secrets"
      - task: "Add repository variable: NEON_PROJECT_ID (not a secret)"
        location: "GitHub repo → Settings → Secrets and variables → Actions → Variables"
  - service: vercel
    why: "Preview + production deployments of the Next.js app; env vars per environment"
    env_vars:
      - name: DATABASE_URL
        source: "Neon main-branch connection string for Production env; Neon branch URL for Preview env is injected at runtime by build step"
      - name: UPSTASH_REDIS_REST_URL
        source: "Upstash (same as .env.local for Preview; production DB for Production)"
      - name: UPSTASH_REDIS_REST_TOKEN
        source: "Upstash"
      - name: TRIGGER_SECRET_KEY
        source: "Trigger.dev (dev env key for Preview; prod env key for Production)"
      - name: RSSHUB_BASE_URL
        source: "https://lurnings-rsshub.hf.space"
      - name: RSSHUB_ACCESS_KEY
        source: "HF Space (rotated per D-02)"
      - name: ANTHROPIC_API_KEY
        source: "Anthropic console (placeholder; actual calls in Phase 3)"
      - name: VOYAGE_API_KEY
        source: "Voyage AI (placeholder; actual calls in Phase 3)"
    dashboard_config:
      - task: "Install Vercel GitHub app + link repo; import as Next.js project (framework auto-detected)"
        location: "https://vercel.com/new"
      - task: "Set all runtime env vars for Production AND Preview environments (the 8 above)"
        location: "Vercel Dashboard → Project → Settings → Environment Variables"
      - task: "Confirm Vercel Root Directory = repo root; Framework = Next.js; Install Command = pnpm install; Build Command = pnpm build"
        location: "Vercel Dashboard → Project → Settings → General"

must_haves:
  truths:
    - "Opening a PR triggers the CI workflow, which typechecks, lints, builds, creates a Neon branch, and runs `drizzle-kit migrate` against that branch"
    - "Closing a PR triggers cleanup-neon-branch.yml which deletes the per-PR Neon branch"
    - "CI fails if `pnpm typecheck`, `pnpm lint`, `pnpm build`, `pnpm db:check`, or `pnpm db:migrate` fail"
    - "Vercel GitHub app posts a preview URL on the PR; curling that preview URL's `/api/health` returns HTTP 200 with all services ok (ROADMAP Phase 1 SC #1)"
    - "`pnpm trigger:deploy` runs in CI on merge to main using TRIGGER_ACCESS_TOKEN (prod environment)"
  artifacts:
    - path: ".github/workflows/ci.yml"
      provides: "PR CI pipeline: install, typecheck, lint, build, drizzle-kit check, Neon branch, drizzle-kit migrate"
      contains: "neondatabase/create-branch-action@v6"
    - path: ".github/workflows/cleanup-neon-branch.yml"
      provides: "PR-close cleanup: delete Neon branch"
      contains: "neondatabase/delete-branch-action"
    - path: "vercel.json"
      provides: "Vercel framework hints + build command"
      contains: "installCommand"
  key_links:
    - from: ".github/workflows/ci.yml"
      to: "Neon Cloud API"
      via: "neondatabase/create-branch-action@v6 with NEON_API_KEY secret"
      pattern: "neondatabase/create-branch-action@v6"
    - from: ".github/workflows/ci.yml"
      to: "drizzle-kit migrate"
      via: "DATABASE_URL set from steps.neon-branch.outputs.db_url"
      pattern: "steps\\.\\w+\\.outputs\\.db_url"
    - from: "Vercel GitHub App"
      to: "Next.js preview deploy"
      via: "Independent of Actions; runs in parallel but Actions migrations complete before any preview API calls (D-18)"
      pattern: "vercel"
---

<objective>
Wire the CI/CD pipeline so every PR automatically: typechecks, lints, builds the Next.js app, creates a Neon branch, migrates it, and triggers the Vercel preview deploy — satisfying ROADMAP Phase 1 Success Criterion #1 ("`git push` to main triggers a Vercel build that passes typecheck and runs Drizzle migrations on the preview environment") and INFRA-08.

Purpose: Automate the acceptance gate. Without CI, Phase 1 is just "it works on my machine". With CI, every future phase inherits the guarantee that merges can't break the schema or build.
Output: `.github/workflows/ci.yml` + `cleanup-neon-branch.yml` + `vercel.json`, plus a green PR-CI run proving the wiring.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/01-infrastructure-foundation/01-CONTEXT.md
@.planning/phases/01-infrastructure-foundation/01-RESEARCH.md
@.planning/phases/01-infrastructure-foundation/01-04-SUMMARY.md

<interfaces>
<!-- Consumes the completed artifacts from Plans 01-04 -->

From Plan 01:
- `package.json` scripts: `typecheck`, `lint`, `build`, `db:check`, `db:migrate`, `db:generate`
- `pnpm-lock.yaml` committed (required for `pnpm install --frozen-lockfile`)
- Node 20.9+ (engines)

From Plan 02:
- `drizzle.config.ts` with `dialect: 'postgresql'` and `dbCredentials.url: process.env.DATABASE_URL`
- `drizzle/0000_enable_pgvector.sql` + `drizzle/0001_initial_schema.sql` + `drizzle/meta/_journal.json` all committed

From Plan 03:
- `package.json` script `trigger:deploy` (for deploy job)
- `TRIGGER_ACCESS_TOKEN` in GH Actions secrets will authenticate the CLI

From Plan 04:
- `/api/health` returns 200 with all four services ok — curl target in manual CI verification

External verified inputs:
- GitHub Action: `neondatabase/create-branch-action@v6` (RESEARCH.md §Pattern 8 verified)
- GitHub Action: `neondatabase/delete-branch-action@v3`
- GitHub Action: `pnpm/action-setup@v4`, `actions/setup-node@v4`
- Vercel GitHub App (auto-deploys; no Actions integration needed)

GitHub Repo secrets/vars required (user_setup frontmatter):
- secrets: `NEON_API_KEY`, `TRIGGER_ACCESS_TOKEN`
- vars: `NEON_PROJECT_ID`
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Author .github/workflows/ci.yml — install, typecheck, lint, build, Neon branch, migrate</name>
  <read_first>
    - .planning/phases/01-infrastructure-foundation/01-RESEARCH.md §Pattern 8 (full CI YAML — copy verbatim + adapt), §Anti-Patterns (do NOT use drizzle-kit push in CI), §Pitfall 1 (race between Actions migrations and Vercel preview boot), §Pitfall 5 (frozen-lockfile requires committed pnpm-lock.yaml)
    - .planning/phases/01-infrastructure-foundation/01-CONTEXT.md (D-11 branch-per-PR, D-17 required steps, D-18 Actions before Vercel)
    - package.json (scripts referenced by CI must exist exactly as named)
  </read_first>
  <files>.github/workflows/ci.yml</files>
  <action>
    Create `.github/workflows/ci.yml` with this EXACT content (adapted from RESEARCH.md §Pattern 8 with explicit env-var wiring and a post-migrate `db:check` drift gate per D-17):

    ```yaml
    name: CI

    on:
      pull_request:
        types: [opened, synchronize, reopened]
      push:
        branches: [main]

    concurrency:
      group: ci-${{ github.ref }}
      cancel-in-progress: true

    permissions:
      contents: read
      pull-requests: write     # so future comments on PR can be posted
      id-token: write          # for Neon OIDC if adopted later

    jobs:
      ci:
        name: Typecheck / Lint / Build / Migrate
        runs-on: ubuntu-latest
        timeout-minutes: 15
        steps:
          - name: Checkout
            uses: actions/checkout@v4

          - name: Setup pnpm
            uses: pnpm/action-setup@v4
            with:
              version: 9

          - name: Setup Node.js
            uses: actions/setup-node@v4
            with:
              node-version-file: '.nvmrc'
              cache: 'pnpm'

          - name: Install dependencies
            run: pnpm install --frozen-lockfile

          - name: Typecheck
            run: pnpm typecheck

          - name: Lint
            run: pnpm lint

          - name: Build
            run: pnpm build

          - name: Drizzle schema drift check
            run: pnpm db:check

          # --- Per-PR Neon branch + migrate (D-11, D-17) ---

          - name: Create Neon branch for PR
            if: github.event_name == 'pull_request'
            id: neon-branch
            uses: neondatabase/create-branch-action@v6
            with:
              project_id: ${{ vars.NEON_PROJECT_ID }}
              branch_name: pr-${{ github.event.number }}
              parent: main
              api_key: ${{ secrets.NEON_API_KEY }}
              username: ${{ vars.NEON_DB_USERNAME || 'neondb_owner' }}

          - name: Run Drizzle migrations on PR branch
            if: github.event_name == 'pull_request'
            run: pnpm db:migrate
            env:
              DATABASE_URL: ${{ steps.neon-branch.outputs.db_url }}

          - name: Run Drizzle migrations on main Neon branch
            if: github.event_name == 'push' && github.ref == 'refs/heads/main'
            run: pnpm db:migrate
            env:
              DATABASE_URL: ${{ secrets.DATABASE_URL_MAIN }}

      trigger-deploy:
        name: Deploy Trigger.dev tasks
        if: github.event_name == 'push' && github.ref == 'refs/heads/main'
        needs: ci
        runs-on: ubuntu-latest
        timeout-minutes: 10
        steps:
          - uses: actions/checkout@v4

          - uses: pnpm/action-setup@v4
            with:
              version: 9

          - uses: actions/setup-node@v4
            with:
              node-version-file: '.nvmrc'
              cache: 'pnpm'

          - run: pnpm install --frozen-lockfile

          - name: Deploy to Trigger.dev (prod)
            run: pnpm trigger:deploy --env prod
            env:
              TRIGGER_ACCESS_TOKEN: ${{ secrets.TRIGGER_ACCESS_TOKEN }}
    ```

    **Notes on the design:**
    - Single `ci` job runs on every PR and every main push. Migrate step is conditional on event type (per-PR branch for PRs; prod branch for main merges).
    - `DATABASE_URL_MAIN` is a secret that holds the Neon main-branch connection string — different from per-PR URL. User must add this secret. If they prefer NOT to run main-branch migrations from CI (choosing manual migration instead), delete the `push` migrate step and document in SUMMARY.
    - `trigger-deploy` job runs only on main merges after `ci` passes — satisfies INFRA-05 production deployment path.
    - `concurrency` stops redundant runs on rapid pushes.
    - `timeout-minutes` caps runaway jobs (Neon migrations are fast; 15m is plenty).
    - `drizzle-kit check` runs BEFORE migrate (catches schema drift early).

    Run `yaml-lint` or open the file in an editor to confirm valid YAML. Then commit — the file won't execute until pushed, but `actionlint` (if installed) can validate locally:
    ```bash
    pnpm dlx @action-validator/cli@latest .github/workflows/ci.yml || true
    ```
  </action>
  <verify>
    <automated>test -f .github/workflows/ci.yml && grep -q "neondatabase/create-branch-action@v6" .github/workflows/ci.yml && grep -q "pnpm db:migrate" .github/workflows/ci.yml && grep -q "pnpm db:check" .github/workflows/ci.yml && grep -q "pnpm typecheck" .github/workflows/ci.yml && grep -q "pnpm lint" .github/workflows/ci.yml && grep -q "pnpm build" .github/workflows/ci.yml && grep -q "trigger:deploy" .github/workflows/ci.yml && grep -q "node-version-file: '.nvmrc'" .github/workflows/ci.yml && grep -q "pnpm install --frozen-lockfile" .github/workflows/ci.yml && grep -q "TRIGGER_ACCESS_TOKEN" .github/workflows/ci.yml && grep -q "steps.neon-branch.outputs.db_url" .github/workflows/ci.yml</automated>
  </verify>
  <done>
    - `.github/workflows/ci.yml` exists with 2 jobs: `ci` (every PR + main) and `trigger-deploy` (main only)
    - CI steps in order: checkout → pnpm setup → node setup → install --frozen-lockfile → typecheck → lint → build → db:check → (if PR) create-neon-branch → (if PR) db:migrate with branch URL → (if main) db:migrate with main URL
    - Uses `neondatabase/create-branch-action@v6` with `project_id`, `branch_name`, `api_key` inputs
    - Uses `.nvmrc` for Node version pin
    - `TRIGGER_ACCESS_TOKEN` only appears in `trigger-deploy` job (runtime secret `TRIGGER_SECRET_KEY` does not appear — that's Vercel-only)
  </done>
</task>

<task type="auto">
  <name>Task 2: Author .github/workflows/cleanup-neon-branch.yml — delete branch on PR close</name>
  <read_first>
    - .planning/phases/01-infrastructure-foundation/01-RESEARCH.md §Pattern 8 cleanup job, §Don't Hand-Roll (official delete-branch-action)
    - .planning/phases/01-infrastructure-foundation/01-CONTEXT.md (D-11 branch auto-deletes when PR closes)
  </read_first>
  <files>.github/workflows/cleanup-neon-branch.yml</files>
  <action>
    Create `.github/workflows/cleanup-neon-branch.yml` (split into separate file so the `on: pull_request [closed]` trigger doesn't pollute the main CI workflow):

    ```yaml
    name: Cleanup Neon PR Branch

    on:
      pull_request:
        types: [closed]

    permissions:
      contents: read

    jobs:
      delete-neon-branch:
        name: Delete PR Neon branch
        runs-on: ubuntu-latest
        timeout-minutes: 5
        steps:
          - name: Delete Neon branch
            uses: neondatabase/delete-branch-action@v3
            with:
              project_id: ${{ vars.NEON_PROJECT_ID }}
              branch: pr-${{ github.event.number }}
              api_key: ${{ secrets.NEON_API_KEY }}
    ```

    Validate the YAML. This workflow is idempotent — if the branch doesn't exist, `delete-branch-action` exits cleanly.
  </action>
  <verify>
    <automated>test -f .github/workflows/cleanup-neon-branch.yml && grep -q "neondatabase/delete-branch-action@v3" .github/workflows/cleanup-neon-branch.yml && grep -q "pull_request:" .github/workflows/cleanup-neon-branch.yml && grep -q "types: \[closed\]" .github/workflows/cleanup-neon-branch.yml && grep -q "branch: pr-" .github/workflows/cleanup-neon-branch.yml</automated>
  </verify>
  <done>
    - `.github/workflows/cleanup-neon-branch.yml` exists with `neondatabase/delete-branch-action@v3`
    - Triggers only on `pull_request: types: [closed]`
    - Uses `vars.NEON_PROJECT_ID` and `secrets.NEON_API_KEY` exactly as named in the user_setup frontmatter
  </done>
</task>

<task type="auto">
  <name>Task 3: Author vercel.json + optional fallback migrate hook</name>
  <read_first>
    - .planning/phases/01-infrastructure-foundation/01-RESEARCH.md §Pitfall 1 (race between Actions migrations and Vercel preview — consider adding migrate to Vercel build as a fallback)
    - .planning/phases/01-infrastructure-foundation/01-CONTEXT.md (D-18 Vercel triggered by its own GitHub app; Actions and Vercel run in parallel)
    - package.json (confirm `build` and `db:migrate` scripts)
  </read_first>
  <files>vercel.json</files>
  <action>
    Create `vercel.json` at the repo root with this content:

    ```json
    {
      "$schema": "https://openapi.vercel.sh/vercel.json",
      "framework": "nextjs",
      "installCommand": "pnpm install --frozen-lockfile",
      "buildCommand": "pnpm build",
      "devCommand": "pnpm dev",
      "github": {
        "silent": false,
        "autoJobCancelation": true
      }
    }
    ```

    **Do NOT add `"buildCommand": "pnpm db:migrate && pnpm build"`** by default. Running migrations from Vercel's build can double-migrate (GitHub Actions already did it on PR), and Vercel's build environment doesn't have `NEON_API_KEY` to create a branch. The correct boundary is: Actions owns migrations, Vercel owns builds.

    **Exception — Pitfall 1 mitigation:** If the user observes preview-deploy crashes due to Actions migrations lagging Vercel preview boot (Phase 2+ symptom; no risk in Phase 1 because no RSC page queries the DB yet), they can later add `"buildCommand": "pnpm db:migrate && pnpm build"` with `DATABASE_URL` set to the preview Neon branch URL via Vercel env. Document this as a deferred hardening option in the SUMMARY.

    Verify the JSON is valid: `pnpm dlx jsonlint@latest vercel.json` (or `node -e "JSON.parse(require('fs').readFileSync('vercel.json','utf8'))"`).
  </action>
  <verify>
    <automated>test -f vercel.json && node -e "JSON.parse(require('fs').readFileSync('vercel.json','utf8'))" && grep -q "\"framework\": \"nextjs\"" vercel.json && grep -q "\"installCommand\": \"pnpm install --frozen-lockfile\"" vercel.json</automated>
  </verify>
  <done>
    - `vercel.json` exists at repo root with valid JSON
    - Declares `framework: nextjs`, `installCommand: pnpm install --frozen-lockfile`, `buildCommand: pnpm build`
    - Does NOT run `db:migrate` inside Vercel build (Actions owns migrations per D-18)
  </done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <name>Task 4: Manual gate — push a PR + verify CI green + Vercel preview /api/health returns 200</name>
  <read_first>
    - .github/workflows/ci.yml (built in Task 1)
    - .github/workflows/cleanup-neon-branch.yml (built in Task 2)
    - vercel.json (built in Task 3)
    - .planning/phases/01-infrastructure-foundation/01-04-SUMMARY.md (local /api/health baseline)
    - .planning/phases/01-infrastructure-foundation/01-VALIDATION.md §Manual-Only Verifications
  </read_first>
  <what-built>
    - Complete CI pipeline: `.github/workflows/ci.yml` + `.github/workflows/cleanup-neon-branch.yml`
    - Vercel config: `vercel.json`
    - All runtime env vars from Plans 01-04 are now expected to be set in Vercel project env + GitHub repo secrets/vars
  </what-built>
  <how-to-verify>
    **Preconditions (user-owned):**
    - GitHub repo has secrets: `NEON_API_KEY`, `TRIGGER_ACCESS_TOKEN`, `DATABASE_URL_MAIN` (if main-migrate enabled)
    - GitHub repo has variable: `NEON_PROJECT_ID`
    - Vercel project linked to the repo via GitHub App
    - Vercel project has all 8 runtime env vars set for Preview + Production (see frontmatter `user_setup`)
    - HF Space `RSSHUB_ACCESS_KEY` has been rotated per D-02 and the new value is in both Vercel and Trigger.dev env vaults

    **Step 1 — Commit + push:**
    ```bash
    git checkout -b phase-1-infrastructure
    git add -A
    git commit -m "Phase 1: infrastructure foundation (scaffold + DB + workers + CI + health)"
    git push -u origin phase-1-infrastructure
    ```
    Open a PR against `main`.

    **Step 2 — Verify GitHub Actions CI goes green:**
    Open the PR's Actions tab. The `CI` workflow should:
    1. Install deps (< 60s)
    2. Typecheck (pass)
    3. Lint (pass)
    4. Build (pass, < 2m)
    5. drizzle-kit check (pass — no drift)
    6. Create Neon branch `pr-<PR_NUMBER>` (< 10s)
    7. Run `db:migrate` against that branch (< 30s) — should apply both 0000 and 0001 migrations

    Total run time ~3-5 min. Every step green.

    **Step 3 — Verify Vercel posts a preview comment on the PR:**
    Within ~2 min of push, the Vercel GitHub App should comment on the PR with a preview URL like `https://ai-hotspot-<hash>-<user>.vercel.app`. If this doesn't happen:
    - Vercel GitHub App not installed → install at https://github.com/apps/vercel
    - Vercel project root directory wrong → fix in project settings
    - Missing env vars for preview → add via Vercel dashboard and redeploy

    **Step 4 — Curl the preview /api/health:**
    ```bash
    PREVIEW_URL="<URL from Vercel PR comment>"
    curl -sS -w "\nHTTP_STATUS:%{http_code}\n" $PREVIEW_URL/api/health
    ```
    **First call may return 503** with `rsshub` cold-start error (D-05). Wait 60s, retry.
    Second call should return HTTP 200 with `{ ok: true, services: { neon: "ok", redis: "ok", rsshub: "ok", trigger: "ok" } }`.

    **Step 5 — Verify the Neon branch was created:**
    Open Neon Console → Project → Branches. You should see `pr-<PR_NUMBER>` in the branch list with 11 tables + pgvector extension.

    **Step 6 — Close the PR (without merging, just for testing):**
    Close the PR. Within 5 minutes, the `Cleanup Neon PR Branch` workflow runs and the branch disappears from Neon Console.

    **Reopen the PR** (don't merge yet — Phase 1 verification happens in `/gsd-verify-work` next).

    **Acceptance criteria:**
    - CI workflow green on the PR
    - Vercel posted preview URL
    - Preview `/api/health` returned 200 with all four services "ok" within 2 retries
    - Neon branch `pr-<N>` appeared during the PR lifecycle
    - Cleanup workflow deleted the branch on PR close (verified by reopening and re-running)

    This manual step IS ROADMAP Phase 1 Success Criterion #1. Paste the PR URL, the CI run URL, the preview URL, and the curl output into the Plan 05 SUMMARY.
  </how-to-verify>
  <resume-signal>Type "approved" after the CI run is green, the preview URL returns 200 on `/api/health`, and the Neon branch lifecycle (create + delete) was observed. If anything failed, paste the failing step output so we can revise.</resume-signal>
  <files>(no file writes — push PR and verify remote CI + preview URL)</files>
  <action>See &lt;how-to-verify&gt; above — push PR, observe green CI, curl preview /api/health, verify Neon branch lifecycle.</action>
  <verify>
    <automated>MISSING — checkpoint task is human-gated against live GitHub + Vercel + Neon; no local automated equivalent possible. Plan 04's /api/health smoke was the last automatable gate.</automated>
  </verify>
  <done>PR CI run green; preview URL /api/health returns 200 with all four services "ok"; Neon branch `pr-&lt;N&gt;` appeared on PR open and disappeared on PR close; evidence pasted into Plan 05 SUMMARY.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| GitHub Actions → Neon API | TLS; `NEON_API_KEY` limited to branch-management scope only; no `pull_request_target` trigger |
| GitHub Actions → Trigger.dev | TLS; `TRIGGER_ACCESS_TOKEN` deploy-only; runtime `TRIGGER_SECRET_KEY` never enters Actions |
| Vercel build → Neon | TLS via Neon HTTP driver at runtime; `DATABASE_URL` stored in Vercel project env, separate per environment |
| PR branch → main | Every PR creates isolated Neon branch; no cross-branch data leakage |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-1-06 | Information Disclosure | CI secrets exfiltration | mitigate | `secrets.NEON_API_KEY` + `secrets.TRIGGER_ACCESS_TOKEN` + `secrets.DATABASE_URL_MAIN` stored as GitHub repo secrets (encrypted at rest); no `pull_request_target` trigger used (which would expose secrets to fork PRs); `permissions:` block limits token scope to `contents: read` + `pull-requests: write` |
| T-1-04 | Tampering (migration drift) | CI db:migrate vs local db:push | mitigate | `pnpm db:check` runs BEFORE `pnpm db:migrate` in CI — fails loudly on drift; `drizzle-kit push` never runs in CI (anti-pattern per RESEARCH.md) |
| T-1-04b | Tampering (malicious schema PR) | Fork PR introducing a destructive migration | mitigate | Per-PR Neon branch is isolated; malicious migrations only touch the ephemeral branch; `main` branch only migrates on push from a trusted branch (authenticated committer) |
| T-1-01 | Information Disclosure | `DATABASE_URL_MAIN` in CI logs | mitigate | Env-var set via `env:` block on specific steps only; GitHub Actions automatically masks `${{ secrets.* }}` in logs; no `echo $DATABASE_URL` or equivalent in workflow |
| T-1-07 | DoS | CI infinite loop triggering | mitigate | `concurrency` cancel-in-progress; `timeout-minutes: 15` on ci, `10` on deploy, `5` on cleanup |
</threat_model>

<verification>
**Local:**
```bash
# Validate YAML syntactically
pnpm dlx @action-validator/cli@latest .github/workflows/ci.yml
pnpm dlx @action-validator/cli@latest .github/workflows/cleanup-neon-branch.yml
node -e "JSON.parse(require('fs').readFileSync('vercel.json','utf8'))"
```

**Remote (Task 4 manual checkpoint):**
- PR opened → CI green → Vercel preview URL → curl `/api/health` returns 200
- PR closed → Neon branch `pr-<N>` deleted

Covers ROADMAP Phase 1 Success Criterion #1 end-to-end.
</verification>

<success_criteria>
- `.github/workflows/ci.yml` runs install, typecheck, lint, build, db:check, (branch-create), db:migrate on every PR
- `.github/workflows/cleanup-neon-branch.yml` deletes the PR Neon branch on close
- Trigger.dev production deploy runs on merge to main (INFRA-05 production path)
- `vercel.json` points Vercel at pnpm + Next.js 15 with no embedded migration command (D-18 ordering preserved)
- Manual PR flow produces a green CI run + preview URL whose `/api/health` returns 200 (ROADMAP Phase 1 SC #1)
</success_criteria>

<output>
After completion, create `.planning/phases/01-infrastructure-foundation/01-05-SUMMARY.md` with:
- Link to the successful CI run
- Preview URL from Vercel + curl output of `/api/health` (redact any error details if seen)
- Confirmation the Neon branch `pr-<N>` was created and later deleted
- Whether `DATABASE_URL_MAIN` secret was added (yes/no — if no, document manual migration plan)
- Any deltas from the planned YAML (e.g., if pnpm version had to be pinned differently)
</output>
