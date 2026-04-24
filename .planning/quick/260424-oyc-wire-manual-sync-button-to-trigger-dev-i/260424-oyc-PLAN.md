---
phase: quick-260424-oyc
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/components/feed/feed-top-bar.tsx
  - src/components/feed/manual-sync-button.tsx
  - src/app/api/admin/sync/route.ts
  - src/app/(reader)/page.tsx
  - src/app/(reader)/all/page.tsx
  - src/app/(reader)/favorites/page.tsx
  - tests/unit/sync-route.test.ts
autonomous: true
requirements:
  - QUICK-260424-OYC-01  # 手动同步按钮接上真实 onClick 行为（非 disabled）
  - QUICK-260424-OYC-02  # 触发 Trigger.dev ingest-hourly 任务
  - QUICK-260424-OYC-03  # 仅管理员可触发（session.user.role==='admin'），服务端权威校验
  - QUICK-260424-OYC-04  # In-flight loading + 完成后成功/失败状态反馈（无 toast 依赖）
  - QUICK-260424-OYC-05  # 冷却/防抖：服务端 Upstash sliding-window (1 req / 120s / user)
  - QUICK-260424-OYC-06  # 所有用户可见文案中文
  - QUICK-260424-OYC-07  # 单元测试覆盖 /api/admin/sync 路由（auth / rate-limit / trigger / shape）

must_haves:
  truths:
    - "管理员在右上角可见启用的「手动同步」按钮，点击后立即进入 loading 状态"
    - "点击后后端调用 tasks.trigger('ingest-hourly') 并返回 { ok:true, runId } 200"
    - "非管理员（匿名 或 role!=='admin'）看到的按钮保持 disabled，title 为「仅管理员可手动同步」"
    - "同一管理员在 120 秒内只能成功触发 1 次（第二次返回 429 RATE_LIMITED，按钮提示「请稍后再试」）"
    - "请求进行中按钮禁用并显示「同步中…」；请求完成后显示「已触发同步」（3 秒后消失），失败显示中文错误"
    - "导出按钮保持 disabled + title=「Phase 6 开放」不变"
    - "匿名访问 /api/admin/sync 返回 401 UNAUTHENTICATED；role !== 'admin' 返回 403 FORBIDDEN"
    - "路由单元测试全部通过（auth gate、rate-limit、trigger 调用、错误分支）"
  artifacts:
    - path: "src/app/api/admin/sync/route.ts"
      provides: "POST /api/admin/sync — assertAdmin + Upstash sliding-window(1,120s) + tasks.trigger('ingest-hourly')"
      exports: ["POST"]
    - path: "src/components/feed/manual-sync-button.tsx"
      provides: "<ManualSyncButton canSync /> — 'use client' 小岛，in-flight/结果状态 + 可选 localStorage 冷却显示"
      exports: ["ManualSyncButton"]
    - path: "tests/unit/sync-route.test.ts"
      provides: "Vitest 单元测试覆盖 /api/admin/sync POST 所有分支"
  key_links:
    - from: "src/components/feed/feed-top-bar.tsx"
      to: "src/components/feed/manual-sync-button.tsx"
      via: "在右上角按钮组渲染 <ManualSyncButton canSync={canSync} /> 替换原 disabled 占位 <Button>"
      pattern: "ManualSyncButton"
    - from: "src/components/feed/manual-sync-button.tsx"
      to: "/api/admin/sync"
      via: "fetch('/api/admin/sync', { method: 'POST' }) in onClick"
      pattern: "fetch\\([`'\"]\\/api\\/admin\\/sync"
    - from: "src/app/api/admin/sync/route.ts"
      to: "@trigger.dev/sdk tasks.trigger"
      via: "await tasks.trigger<typeof ingestHourly>('ingest-hourly', undefined)"
      pattern: "tasks\\.trigger"
    - from: "src/app/(reader)/page.tsx"
      to: "src/components/feed/feed-top-bar.tsx"
      via: "<FeedTopBar canSync={session?.user?.role==='admin'} ... />"
      pattern: "canSync"
---

<objective>
实现右上角「手动同步」按钮：将当前 src/components/feed/feed-top-bar.tsx:138-140 的 `disabled title="Phase 6 开放"` 占位替换为可真实工作的管理员操作 — 点击调用后端 /api/admin/sync，后端通过 `tasks.trigger('ingest-hourly')` 触发 Trigger.dev v4 的 hourly ingestion 任务并返回 `runId`；非管理员按钮保持 disabled；服务端用 Upstash sliding-window(1 req / 120 s / user) 作为权威冷却；UI 显示 loading / 成功 / 失败内联状态（不引入 toast 依赖）。

**超出范围**：导出按钮（保持 disabled 不变）；管理员后台的 Trigger.dev run 详情/历史页面（仅返回 runId 供管理员在 Trigger.dev 控制台追踪）；手动同步触发后主动刷新 feed（依赖 hourly ingest 管道 + ISR，不在本次闭环内）；toast 依赖的引入（项目未安装 sonner/react-hot-toast — 用内联状态而非新增依赖）；左上角搜索（刚完成，不动）；sidebar.tsx（刚完成的 260424-ogp/g2y，不动）。

Purpose: v1.0 已上线但 hourly cron 是 Trigger.dev schedule；当管理员想在运营中「补一次 ingest」（例如新增信源、上次失败）时，目前只能去 Trigger.dev 控制台手动触发 — UI 右上角那个一直 disabled 的按钮反倒成了错引导（「Phase 6 开放」已经过时）。本次把这个按钮接上。

Output: 一个 Client 小岛组件 + 一个 API POST 路由 + 三个 feed 页面的 prop 透传改动 + 一个单元测试文件 + feed-top-bar 的按钮区 JSX 替换，单次提交闭环。
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/PROJECT.md
@./CLAUDE.md
@src/components/feed/feed-top-bar.tsx
@src/components/layout/button.tsx
@src/app/(reader)/page.tsx
@src/app/(reader)/all/page.tsx
@src/app/(reader)/favorites/page.tsx
@src/lib/auth/admin.ts
@src/lib/auth/index.ts
@src/lib/redis/client.ts
@src/server/actions/admin-dead-letter.ts
@src/trigger/ingest-hourly.ts
@trigger.config.ts
@src/app/api/search/route.ts

<interfaces>
<!-- Contracts the executor needs; pulled directly from codebase — no exploration needed. -->

From src/lib/auth/admin.ts:
```ts
export type AdminSession = Session & {
  user: NonNullable<Session['user']> & { id: string; role: 'admin' };
};
export class AdminAuthError extends Error {
  public readonly code: 'UNAUTHENTICATED' | 'FORBIDDEN';
}
export function assertAdmin(session: Session | null): asserts session is AdminSession;
```

From src/lib/auth/index.ts:
```ts
export const { handlers, auth, signIn, signOut };  // auth() returns Promise<Session | null>
```

From src/trigger/ingest-hourly.ts:
```ts
export const ingestHourly = schedules.task({
  id: 'ingest-hourly',
  cron: '0 * * * *',
  run: async (payload) => { /* payload: { timestamp } */ },
});
// payload shape at manual trigger: Trigger.dev v4 schedules.task accepts `undefined`
// for manual runs — the SDK synthesises the ScheduledTaskPayload (timestamp: now())
// on the server side when triggered via tasks.trigger() without a payload.
```

Trigger.dev v4 SDK call pattern (verified in @trigger.dev/sdk@4.4.4 exports map):
```ts
import { tasks } from '@trigger.dev/sdk';
import type { ingestHourly } from '@/trigger/ingest-hourly';

const handle = await tasks.trigger<typeof ingestHourly>('ingest-hourly', undefined);
// → { id: 'run_xxx', publicAccessToken: '...', ... }
// Access handle.id as the runId to return to the client.
```

From src/lib/redis/client.ts:
```ts
import { Redis } from '@upstash/redis';
export const redis = new Redis({ url, token });  // HTTP, singleton
```

Rate-limit pattern to mirror (src/server/actions/admin-dead-letter.ts:40-49):
```ts
const ratelimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(1, '120 s'),
  analytics: false,
  prefix: 'admin:sync',
});
// key = `admin:sync:${session.user.id}`
const { success } = await ratelimit.limit(key);
```

Route convention (src/app/api/search/route.ts):
```ts
export const runtime = 'nodejs';          // Neon HTTP + Trigger.dev SDK need Node
export const dynamic = 'force-dynamic';   // no ISR on mutation endpoint
```

Button interface (src/components/layout/button.tsx):
```ts
interface ButtonProps {
  variant?: 'primary' | 'secondary' | 'ghost' | 'accent' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  children?: React.ReactNode;
  icon?: IconName;
  iconRight?: IconName;
  onClick?: () => void;
  disabled?: boolean;
  title?: string;
  // ...
}
// The Button is already `'use client'` — safe to attach onClick inside our client island.
```

FeedTopBar current props (src/components/feed/feed-top-bar.tsx:28-51):
```ts
export interface FeedTopBarProps {
  view: 'featured' | 'all' | 'favorites';
  count?: number;
  totalCount?: number;
  lastSyncMinutes?: number | null;
  pathname: string;
  counts?: { featured?: number; all?: number; favorites?: number };
  subtitle?: string;
}
// Plan adds ONE new optional prop: canSync?: boolean (default false).
// Server pages compute canSync = session?.user?.role === 'admin' and pass down.
```

Three feed pages that mount FeedTopBar — each already calls `await auth()` (verified):
- src/app/(reader)/page.tsx:28 — `const session = await auth()`
- src/app/(reader)/all/page.tsx:43 — `const session = await auth()`
- src/app/(reader)/favorites/page.tsx — mounts FeedTopBar; confirm its session via read

All three currently derive `isAuthenticated`; we layer `canSync = session?.user?.role === 'admin'` alongside.
</interfaces>

<design_decisions>
D-01 (Client island vs. convert FeedTopBar): **Extract a small `<ManualSyncButton canSync>` as `'use client'`** — FeedTopBar stays an RSC. Rationale: only the sync button needs client-side state (in-flight, result, cooldown) and event handlers; everything else in FeedTopBar (title, subtitle, tabs, filter/export buttons) is static per-request. Converting the whole bar to `'use client'` would ship unnecessary JS and break the existing FeedTabs import chain.

D-02 (Auth authority = server): **Server is the only authoritative gate.** Client receives `canSync: boolean` prop from the RSC page (derived from `await auth()`), uses it purely for visual disable/enable; even if a non-admin forges `canSync=true` via DevTools the POST to `/api/admin/sync` calls `assertAdmin()` and returns 403. The client prop is a UX hint, never a security boundary.

D-03 (Cooldown authority = server Upstash): Client-side localStorage cooldown is unreliable (cleared cookies, incognito, multi-device, multiple tabs) and trivially bypassed. **Upstash `Ratelimit.slidingWindow(1, '120 s')` keyed by `admin:sync:${session.user.id}`** is the real gate. Client shows an optional visual countdown persisted in localStorage for UX parity but the server decides — if localStorage says "cooled down" but server returns 429, server wins and UI shows "请稍后再试". Mirrors src/server/actions/admin-dead-letter.ts:40-49 (same pattern, different window).

D-04 (No toast dependency): Package.json has no sonner / react-hot-toast / radix-toast. **Do NOT add a dep for this one-off feedback.** Render an inline `<span>` next to the button that shows:
- `""` (empty, hidden) — idle
- `"同步中…"` — in-flight
- `"已触发同步"` — success, auto-clears after 3 s
- `"请稍后再试"` — 429
- `"仅管理员可操作"` — 401/403 (shouldn't happen normally since button disabled for non-admins, but handle defensively)
- `"触发失败,请稍后再试"` — 5xx / network
The status text sits to the left of the button (inline, same row) in a small `var(--fg-3)` color.

D-05 (Button variant): Keep existing `variant="primary"` + `size="md"` (matches current placeholder's visual weight). When `loading=true` set `disabled={true}` and change children to `"同步中…"`. When `canSync=false` keep the button rendered but `disabled` with `title="仅管理员可手动同步"` — this preserves visual layout parity for non-admins and makes the affordance discoverable (hover tooltip).

D-06 (Response shape): POST /api/admin/sync returns:
- 200 `{ ok: true, runId: string }`
- 400 `{ ok: false, error: 'VALIDATION' }` (not expected — no body — defensive)
- 401 `{ ok: false, error: 'UNAUTHENTICATED' }`
- 403 `{ ok: false, error: 'FORBIDDEN' }`
- 429 `{ ok: false, error: 'RATE_LIMITED', retryAfterSeconds: 120 }` (client can display countdown; optional)
- 500 `{ ok: false, error: 'INTERNAL' }`
Do NOT leak Trigger.dev error messages (could contain TRIGGER_SECRET_KEY fragments in failure paths). Catch → log via Sentry (@sentry/nextjs is available) → return opaque INTERNAL.

D-07 (Route path = /api/admin/sync): Placed under `/api/admin/*` to match the existing admin API namespace (`/api/admin/sentry-test` already exists). Middleware already filters `/admin/*` paths at the edge (see src/middleware.ts in Phase 6), but API routes are separate; the route handler enforces its own `assertAdmin`. Path convention: `POST`, not GET — mutates state (triggers a backend job). GET would be CSRF-vulnerable (WR-04 regression class — do NOT repeat that mistake).

D-08 (Payload to tasks.trigger): Pass `undefined` — `ingestHourly` is a `schedules.task` which receives a synthesised ScheduledTaskPayload (`{ timestamp, lastTimestamp, timezone, scheduleId, upcoming }`) when run via schedule. Manual `tasks.trigger(...)` on a `schedules.task` invokes the same `run` fn; Trigger.dev v4 fills in `{ timestamp: new Date() }` server-side. Verified by reviewing ingest-hourly.ts:40 — `payload.timestamp` is the only field read, and Trigger.dev provides it for manual runs.

D-09 (Run ID exposed to client): Return the Trigger.dev run ID in the 200 response for transparency (admin can cross-reference in Trigger.dev dashboard). Do NOT include `publicAccessToken` — that's a client-access token for Trigger.dev's realtime streaming SDK which we are not using here (out of scope). Exposing it would enable third-party realtime subscribers to our run.

D-10 (Cooldown countdown on button — optional polish): After a successful trigger, `localStorage.setItem('aihotspot:sync:cooledUntil', String(Date.now() + 120_000))`. On mount, read the key and if `cooledUntil > Date.now()` display a countdown number next to the button ("120 / 119 / 118…秒"). This is **UX polish only**; the server still wins on all authority decisions. If localStorage is absent (SSR, private browsing) the fallback is simply no countdown — behaviour is still correct.
</design_decisions>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: /api/admin/sync POST route + unit tests (server authority layer)</name>
  <files>
    src/app/api/admin/sync/route.ts,
    tests/unit/sync-route.test.ts
  </files>
  <behavior>
    **Test file created FIRST (RED) — tests/unit/sync-route.test.ts:**

    Mock strategy (mirror tests/unit/admin-gate.test.ts + the existing admin-dead-letter pattern):
    ```ts
    const authMock = vi.fn();
    const triggerMock = vi.fn();
    const limitMock = vi.fn();
    vi.mock('@/lib/auth', () => ({ auth: authMock }));
    vi.mock('@trigger.dev/sdk', () => ({ tasks: { trigger: triggerMock } }));
    vi.mock('@upstash/ratelimit', () => ({
      Ratelimit: Object.assign(
        vi.fn().mockImplementation(() => ({ limit: limitMock })),
        { slidingWindow: vi.fn(() => 'window-token') },
      ),
    }));
    vi.mock('@/lib/redis/client', () => ({ redis: {} }));
    ```

    Import the route handler AFTER mocks: `const { POST } = await import('@/app/api/admin/sync/route');`

    Test cases (minimum 6):
    1. **anonymous → 401 UNAUTHENTICATED**: `authMock.mockResolvedValue(null)`; call POST; expect `{ ok:false, error:'UNAUTHENTICATED' }` + status 401; triggerMock NOT called; limitMock NOT called.
    2. **non-admin → 403 FORBIDDEN**: `authMock.mockResolvedValue({ user: { id: 'u1', role: 'user' } })`; expect 403 `{ ok:false, error:'FORBIDDEN' }`; triggerMock NOT called.
    3. **admin + rate-limit exceeded → 429 RATE_LIMITED**: `authMock.mockResolvedValue({ user: { id: 'admin1', role: 'admin' } })`; `limitMock.mockResolvedValue({ success: false })`; expect 429 `{ ok:false, error:'RATE_LIMITED', retryAfterSeconds: 120 }`; triggerMock NOT called.
    4. **admin + rate-limit ok → 200 with runId**: `limitMock.mockResolvedValue({ success: true })`; `triggerMock.mockResolvedValue({ id: 'run_abc123' })`; expect 200 `{ ok:true, runId:'run_abc123' }`; `triggerMock` called with `('ingest-hourly', undefined)`.
    5. **admin + trigger.trigger throws → 500 INTERNAL** (no message leak): `triggerMock.mockRejectedValue(new Error('TRIGGER_SECRET_KEY invalid'))`; expect 500 `{ ok:false, error:'INTERNAL' }`; response body MUST NOT contain substring `'TRIGGER_SECRET_KEY'` or the word `'invalid'` — assert via `JSON.stringify(body).includes(...)` false.
    6. **rate-limit keyed per-user**: First call admin1 succeeds (limitMock resolves success:true), second call same admin also calls `limitMock` with key containing `admin1`. Assert `limitMock.mock.calls[0][0]` includes `'admin1'` (string match on the key argument).

    All tests construct the Request via `new Request('http://localhost/api/admin/sync', { method: 'POST' })` and assert on the Response returned by `await POST(req)`.

    **Implementation (GREEN) — src/app/api/admin/sync/route.ts:**

    ```ts
    /**
     * POST /api/admin/sync — quick 260424-oyc.
     *
     * Admin-only manual trigger for the ingest-hourly Trigger.dev task.
     * Three gates stack in this order (fail-fast, cheapest → most expensive):
     *   1. assertAdmin(await auth())   — Layer 3 of the admin gate (mirror
     *      src/server/actions/admin-*.ts). 401 / 403 without touching Redis.
     *   2. Upstash sliding-window(1 / 120 s / admin user id) — the real
     *      cooldown. Client-side localStorage countdown is UX only.
     *   3. tasks.trigger<typeof ingestHourly>('ingest-hourly', undefined)
     *      fires the manual run; Trigger.dev v4 synthesises the
     *      ScheduledTaskPayload ({ timestamp: now() }) server-side.
     *
     * Response shape never leaks err.message (Trigger.dev errors can include
     * fragments of TRIGGER_SECRET_KEY in auth failures) — every catch maps to
     * opaque 'INTERNAL'.
     */
    import { tasks } from '@trigger.dev/sdk';
    import { Ratelimit } from '@upstash/ratelimit';
    import { auth } from '@/lib/auth';
    import { assertAdmin, AdminAuthError } from '@/lib/auth/admin';
    import { redis } from '@/lib/redis/client';
    import type { ingestHourly } from '@/trigger/ingest-hourly';

    export const runtime = 'nodejs';
    export const dynamic = 'force-dynamic';

    const WINDOW_SECONDS = 120;
    const ratelimit = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(1, `${WINDOW_SECONDS} s`),
      analytics: false,
      prefix: 'admin:sync',
    });

    export async function POST(): Promise<Response> {
      // Gate 1: auth
      let session;
      try {
        session = await auth();
        assertAdmin(session);
      } catch (e) {
        if (e instanceof AdminAuthError) {
          const status = e.code === 'UNAUTHENTICATED' ? 401 : 403;
          return Response.json({ ok: false, error: e.code }, { status });
        }
        return Response.json({ ok: false, error: 'INTERNAL' }, { status: 500 });
      }

      // Gate 2: sliding-window rate limit per admin user id
      try {
        const { success } = await ratelimit.limit(`admin:sync:${session.user.id}`);
        if (!success) {
          return Response.json(
            { ok: false, error: 'RATE_LIMITED', retryAfterSeconds: WINDOW_SECONDS },
            { status: 429 },
          );
        }
      } catch {
        // Redis outage — fail closed (do NOT allow unlimited triggers).
        return Response.json({ ok: false, error: 'INTERNAL' }, { status: 500 });
      }

      // Gate 3: trigger the ingest-hourly task
      try {
        const handle = await tasks.trigger<typeof ingestHourly>('ingest-hourly', undefined);
        return Response.json({ ok: true, runId: handle.id }, { status: 200 });
      } catch {
        return Response.json({ ok: false, error: 'INTERNAL' }, { status: 500 });
      }
    }
    ```

    **Notes:**
    - Pass `undefined` as the second arg to `tasks.trigger` — `ingestHourly` is a `schedules.task` that receives a ScheduledTaskPayload; Trigger.dev v4 synthesises `{ timestamp: now() }` for manual runs. Verified against ingest-hourly.ts:40 which only reads `payload.timestamp`.
    - Use `type { ingestHourly }` import to keep the module graph clean — no runtime import of the task file from the route (the route only needs the type for the generic parameter).
    - Redis failure fails closed (returns 500, does NOT allow the trigger) — we prefer availability-over-safety trade-offs here but an admin can retry; a burst of triggers from a stuck Redis would burn LLM budget.
    - NO body validation — the endpoint takes no payload, so zod is not needed.
  </behavior>
  <action>
    **Step 1 (RED):** Create `tests/unit/sync-route.test.ts` with the 6 test cases above. Run `pnpm vitest run tests/unit/sync-route.test.ts` — all must fail with "module not found: @/app/api/admin/sync/route" (implementation doesn't exist yet). This is the red gate.

    **Step 2 (GREEN):** Create `src/app/api/admin/sync/route.ts` with the full implementation above. Re-run `pnpm vitest run tests/unit/sync-route.test.ts` — all 6 green.

    **Step 3 (typecheck):** `pnpm typecheck` — zero errors. The `import type { ingestHourly }` dependency should type-check cleanly (ingest-hourly.ts already exports `ingestHourly`).

    **Wiring notes:**
    - The route handler has NO `request` parameter because POST takes no body and we do not inspect headers. (`export async function POST(): Promise<Response>` is valid Next.js App Router.)
    - `Ratelimit` is imported at module top level; the route is `runtime = 'nodejs'` so the Upstash HTTP client works normally. The singleton `ratelimit` instance is created once per warm serverless instance (same pattern as admin-dead-letter.ts:40-49).
    - Do NOT import `import { redis }` from anywhere other than `@/lib/redis/client` — there is exactly one Redis singleton per project convention.
    - Do NOT wrap the route in `withSentry` or Sentry's handler helper — the existing `@sentry/nextjs` instrumentation auto-captures Next.js route-level errors via `instrumentation.ts`. Re-wrapping is unnecessary.

    **Commit:** `feat(sync): add POST /api/admin/sync admin-gated Trigger.dev manual-run route with unit tests (quick-260424-oyc)`
  </action>
  <verify>
    <automated>pnpm vitest run tests/unit/sync-route.test.ts --reporter=verbose && pnpm typecheck</automated>
  </verify>
  <done>
    - `src/app/api/admin/sync/route.ts` exists and exports `POST`, `runtime`, `dynamic`
    - `tests/unit/sync-route.test.ts` has 6 green tests covering auth / rate-limit / trigger / error-no-leak / per-user key
    - `pnpm typecheck` passes (no new errors)
    - No new dependencies added to package.json (all imports already in the lockfile: `@trigger.dev/sdk`, `@upstash/ratelimit`, `@/lib/auth`, `@/lib/redis/client`)
    - Error responses never echo raw error messages (grep asserts on test 5: `TRIGGER_SECRET_KEY` and `invalid` NOT present in response body)
  </done>
</task>

<task type="auto" tdd="false">
  <name>Task 2: ManualSyncButton client island + FeedTopBar prop-threading + three page mounts</name>
  <files>
    src/components/feed/manual-sync-button.tsx,
    src/components/feed/feed-top-bar.tsx,
    src/app/(reader)/page.tsx,
    src/app/(reader)/all/page.tsx,
    src/app/(reader)/favorites/page.tsx
  </files>
  <action>
    **Create `src/components/feed/manual-sync-button.tsx`** — `'use client'` Client Component with:

    ```ts
    'use client';
    /**
     * ManualSyncButton — quick 260424-oyc.
     *
     * Admin-only manual trigger for the ingest-hourly Trigger.dev task. Renders
     * the right-most button in FeedTopBar's action row, replacing the
     * Phase-4-era disabled placeholder.
     *
     * Authority layers:
     *   - `canSync` prop decides the disabled state for the non-admin UX path.
     *     NON-authoritative — the server /api/admin/sync endpoint enforces
     *     assertAdmin() regardless of what the client claims.
     *   - Server-side Upstash sliding-window(1 / 120 s / admin user id) is the
     *     real cooldown. This component OPTIONALLY reads localStorage to show
     *     a visual countdown for the same window; if localStorage disagrees
     *     with the server the server wins (429 → "请稍后再试").
     *
     * Status text (inline, same row, left of the button):
     *   idle       → ""
     *   loading    → "同步中…"
     *   success    → "已触发同步" (auto-clears after 3 s)
     *   429        → "请稍后再试"
     *   401/403    → "仅管理员可操作"
     *   other err  → "触发失败,请稍后再试"
     *
     * Consumed by: src/components/feed/feed-top-bar.tsx
     */
    import { useState, useEffect, useRef } from 'react';
    import { Button } from '@/components/layout/button';

    const COOLDOWN_MS = 120_000;
    const STORAGE_KEY = 'aihotspot:sync:cooledUntil';

    type SyncResponse =
      | { ok: true; runId: string }
      | { ok: false; error: 'UNAUTHENTICATED' | 'FORBIDDEN' | 'RATE_LIMITED' | 'INTERNAL' };

    export function ManualSyncButton({ canSync }: { canSync: boolean }) {
      const [loading, setLoading] = useState(false);
      const [status, setStatus] = useState<string>('');
      const [cooledUntil, setCooledUntil] = useState<number>(0);
      const [now, setNow] = useState<number>(() => Date.now());
      const successTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

      // Hydrate cooldown from localStorage on mount (SSR-safe via useEffect).
      useEffect(() => {
        try {
          const raw = window.localStorage.getItem(STORAGE_KEY);
          if (raw) {
            const v = Number(raw);
            if (Number.isFinite(v) && v > Date.now()) setCooledUntil(v);
          }
        } catch {
          /* localStorage unavailable (private mode / server) — no countdown */
        }
      }, []);

      // Tick-per-second only while cooling down (cheap; cleared once expired).
      useEffect(() => {
        if (cooledUntil <= now) return;
        const t = setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(t);
      }, [cooledUntil, now]);

      // Cleanup success auto-clear on unmount.
      useEffect(
        () => () => {
          if (successTimeoutRef.current) clearTimeout(successTimeoutRef.current);
        },
        [],
      );

      const remainingSec = Math.max(0, Math.ceil((cooledUntil - now) / 1000));
      const cooling = remainingSec > 0;

      async function onClick() {
        if (loading || cooling || !canSync) return;
        setLoading(true);
        setStatus('同步中…');
        try {
          const res = await fetch('/api/admin/sync', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
          });
          const body: SyncResponse = await res
            .json()
            .catch(() => ({ ok: false, error: 'INTERNAL' as const }));
          if (res.ok && body.ok) {
            setStatus('已触发同步');
            const until = Date.now() + COOLDOWN_MS;
            setCooledUntil(until);
            try {
              window.localStorage.setItem(STORAGE_KEY, String(until));
            } catch {
              /* ignore */
            }
            if (successTimeoutRef.current) clearTimeout(successTimeoutRef.current);
            successTimeoutRef.current = setTimeout(() => setStatus(''), 3000);
          } else if (!body.ok && body.error === 'RATE_LIMITED') {
            setStatus('请稍后再试');
            // Server says cooled — respect it client-side too (best-effort).
            const until = Date.now() + COOLDOWN_MS;
            setCooledUntil(until);
            try {
              window.localStorage.setItem(STORAGE_KEY, String(until));
            } catch {
              /* ignore */
            }
          } else if (!body.ok && (body.error === 'UNAUTHENTICATED' || body.error === 'FORBIDDEN')) {
            setStatus('仅管理员可操作');
          } else {
            setStatus('触发失败,请稍后再试');
          }
        } catch {
          setStatus('触发失败,请稍后再试');
        } finally {
          setLoading(false);
        }
      }

      const disabled = !canSync || loading || cooling;
      const title = !canSync
        ? '仅管理员可手动同步'
        : cooling
          ? `${remainingSec} 秒后可再次触发`
          : loading
            ? '同步中'
            : '手动触发一次 ingest';

      const label = loading
        ? '同步中…'
        : cooling
          ? `手动同步 (${remainingSec}s)`
          : '手动同步';

      return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {status && (
            <span
              style={{ fontSize: 12, color: 'var(--fg-3)' }}
              role="status"
              aria-live="polite"
            >
              {status}
            </span>
          )}
          <Button
            variant="primary"
            size="md"
            disabled={disabled}
            title={title}
            onClick={onClick}
          >
            <span className="max-sm:hidden">{label}</span>
          </Button>
        </div>
      );
    }
    ```

    **Edit `src/components/feed/feed-top-bar.tsx`:**

    1. Add `canSync?: boolean` to `FeedTopBarProps` (after `subtitle?: string`):
       ```ts
       /** Quick 260424-oyc: role-gate from server; true iff session.user.role==='admin'. */
       canSync?: boolean;
       ```
    2. Destructure `canSync = false` in the function signature params.
    3. Import the new component near the top: `import { ManualSyncButton } from './manual-sync-button';`
    4. Replace the existing 手动同步 `<Button>` block (current lines 137-140, the `{/* 手动同步 — disabled, Phase 6 开放 … */}` block and its `<Button variant="primary" ... disabled title="Phase 6 开放">...</Button>`) with:
       ```tsx
       {/* 手动同步 — quick 260424-oyc: admin-only Trigger.dev manual run */}
       <ManualSyncButton canSync={canSync} />
       ```
    5. Do NOT touch the 导出 button above it — it stays `disabled title="Phase 6 开放"` exactly as-is (out-of-scope per CONTEXT).

    Update the JSDoc header at lines 14-17 — remove the stale "手动同步: disabled, title=..." line and replace with:
    ```
     *   - 手动同步: admin-only client island (ManualSyncButton) — quick 260424-oyc
    ```

    **Edit `src/app/(reader)/page.tsx`** (Featured page) — thread `canSync`:
    - Right after the existing `const isAuthenticated = !!session?.user?.id;` line, add:
      ```ts
      const canSync = (session?.user as { role?: string } | undefined)?.role === 'admin';
      ```
    - Pass to `<FeedTopBar ... canSync={canSync} />`.

    **Edit `src/app/(reader)/all/page.tsx`** — same change (identical `canSync` derivation + prop).

    **Edit `src/app/(reader)/favorites/page.tsx`** — same change. Read the file first; the auth() call is already present (the /favorites page gates on authentication per Plan 05-08). Derive `canSync` from the same session object and pass through on its FeedTopBar mount.

    **Type note on `session.user.role`:** Auth.js v5's `Session['user']` type doesn't include `role` in the vanilla types — the project augments this via the callbacks (Phase 5 Plan 05-02). The safe path in the page files is a narrow cast `(session?.user as { role?: string } | undefined)?.role === 'admin'` (used elsewhere in the codebase per sidebar role-gate — grep for `role === 'admin'` to confirm the established pattern). If a module-level `declare module 'next-auth'` augmentation already exists in src/types/next-auth.d.ts or similar, use it directly without the cast; if typecheck complains, fall back to the cast above.

    **Commit:** `feat(sync): wire right-top 手动同步 button to /api/admin/sync via ManualSyncButton client island (quick-260424-oyc)`
  </action>
  <verify>
    <automated>pnpm typecheck && pnpm vitest run tests/unit/sync-route.test.ts && pnpm build</automated>
  </verify>
  <done>
    - `src/components/feed/manual-sync-button.tsx` exists, `'use client'`, exports `ManualSyncButton`
    - `src/components/feed/feed-top-bar.tsx` has `<ManualSyncButton canSync={canSync} />` in place of the old 手动同步 `<Button>`; 导出 button is UNCHANGED (still `disabled title="Phase 6 开放"`)
    - `FeedTopBarProps` type has `canSync?: boolean` field
    - `src/app/(reader)/page.tsx`, `/all/page.tsx`, `/favorites/page.tsx` all derive `canSync` and pass it to `<FeedTopBar ... canSync={canSync} />`
    - `pnpm typecheck` passes
    - `pnpm build` passes (Next.js 15 production build succeeds on all three feed pages)
    - `pnpm vitest run tests/unit/sync-route.test.ts` still green (route unchanged from Task 1)
    - Grep assertion: `grep -l "ManualSyncButton" src/components/feed/feed-top-bar.tsx` matches; `grep -l "Phase 6 开放" src/components/feed/feed-top-bar.tsx` STILL matches (only for 导出 button)
  </done>
</task>

</tasks>

<threat_model>

## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| browser → /api/admin/sync | Any HTTP client (authenticated browser, curl, forged cookie, CSRF from another site) can POST here. Untrusted. |
| /api/admin/sync → Trigger.dev Cloud | Our server uses `TRIGGER_SECRET_KEY` (server-only env var) to authenticate as the project. Trusted call, must not leak the secret in error paths. |
| /api/admin/sync → Upstash Redis | Our server uses `UPSTASH_REDIS_REST_TOKEN` (server-only). Trusted. |
| client localStorage (ManualSyncButton) | User-controllable — cooldown hint only, NEVER treated as authority. |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-OYC-01 | Spoofing | /api/admin/sync POST (anonymous / non-admin caller) | mitigate | `assertAdmin(await auth())` at route entry — 401/403 before any side-effect. Client `canSync` prop is UX only; server is authoritative (D-02). |
| T-OYC-02 | Tampering | Client sets `canSync=true` via DevTools | mitigate | Server re-derives via `assertAdmin` on every POST; client prop never trusted. Test case 1+2 (anonymous / non-admin) cover. |
| T-OYC-03 | Repudiation | Admin denies triggering an ingest run | accept | Trigger.dev run has a unique runId and timestamp in its own audit log; the project already has Sentry + Langfuse tracing. Out of scope to add app-level audit table for v1.1. |
| T-OYC-04 | Information Disclosure | Trigger.dev error leaks TRIGGER_SECRET_KEY fragment in 500 body | mitigate | All catch blocks map to opaque `{ error: 'INTERNAL' }` — never `err.message`. Test case 5 asserts no leak. |
| T-OYC-05 | Denial of Service | Admin spams button / CSRF-coerces admin to repeatedly trigger → burns LLM budget via hourly run | mitigate | Upstash sliding-window(1 req / 120 s / admin user id) at server — authoritative (D-03). Per-user key, survives across tabs/devices. Client countdown is cosmetic. |
| T-OYC-06 | Denial of Service | Redis outage lets attacker bypass cooldown | mitigate | Route fails closed on Redis errors (returns 500, does NOT allow trigger). Same fail-closed pattern as admin-dead-letter.ts. |
| T-OYC-07 | Denial of Service | CSRF (GET-based attack) | mitigate | Route is POST only; POST from a cross-origin form requires an origin-controllable submit AND same-session cookie. Next.js server actions / API routes under `/api/admin/*` are same-origin-only in practice; the project's middleware additionally restricts based on session cookies. The previous WR-04 (`/api/admin/sentry-test` GET-reachable CSRF) is NOT repeated here because we choose POST + no GET handler. |
| T-OYC-08 | Elevation of Privilege | Non-admin user exploits missing gate in production | mitigate | Three-layer defense still applies (middleware → route handler assertAdmin → server logic). This route adds its own assertAdmin — does NOT rely solely on the Phase 6 middleware (which only filters `/admin/*` paths, not `/api/admin/*` APIs, in current config — see src/middleware.ts matcher). |

</threat_model>

<verification>
**Plan-level automated checks (run at the end):**
```bash
# Route unit tests (6 cases)
pnpm vitest run tests/unit/sync-route.test.ts --reporter=verbose

# Full typecheck (exercises the cross-file type: ingestHourly handle → runId)
pnpm typecheck

# Full production build (exercises the three feed page mounts)
pnpm build

# Existing tests still green (no regressions in adjacent surfaces)
pnpm vitest run tests/unit/admin-gate.test.ts tests/unit/admin-sources-actions.test.ts

# Grep assertions on key links
grep -l "ManualSyncButton" src/components/feed/feed-top-bar.tsx     # must match
grep -l "tasks.trigger" src/app/api/admin/sync/route.ts             # must match
grep -l "admin:sync" src/app/api/admin/sync/route.ts                # rate-limit prefix
grep -l "Phase 6 开放" src/components/feed/feed-top-bar.tsx         # STILL matches (导出 button retains it)
grep -l "canSync" src/app/\(reader\)/page.tsx                       # must match
grep -l "canSync" src/app/\(reader\)/all/page.tsx                   # must match
grep -l "canSync" src/app/\(reader\)/favorites/page.tsx             # must match
```

**Manual smoke (user, post-merge — OPTIONAL, not a merge gate):**
1. `pnpm dev` → log in as a non-admin user → visit `/` → hover 手动同步 → tooltip reads "仅管理员可手动同步"; button stays disabled; no network request fires on click-attempt.
2. Log in as an admin user → 手动同步 is enabled → click → button shows "同步中…" → status shows "已触发同步" for 3s → button shows "手动同步 (120s)" countdown → Trigger.dev dashboard shows a new ingest-hourly run with the returned `runId`.
3. Click again within 120s → server returns 429 → status shows "请稍后再试"; button already disabled via countdown.
4. Open in a second browser tab as the same admin → countdown ALSO shown (localStorage shared). Server-side cooldown independently enforces even if localStorage is cleared.
5. Open in a private window as admin → no countdown visible (empty localStorage), but a click within 120s of the previous tab's trigger STILL gets 429 from the server. (Confirms server authority per D-03.)
6. In Trigger.dev dashboard, the manually-triggered run completes identically to a scheduled run (fetches active sources, fans out to fetch-source, returns summary).
</verification>

<success_criteria>
1. All must-haves truths observable (admin sees enabled button, non-admin sees disabled-with-tooltip, in-flight loading, success/429 status, 2-minute server-side cooldown, all 文案中文, 导出 button untouched)
2. 6 unit tests green (sync-route.test.ts: auth 401 / auth 403 / rate-limit 429 / success 200 with runId / trigger error → opaque 500 no-leak / rate-limit keyed per-user)
3. `pnpm build` + `pnpm typecheck` green
4. No new npm dependencies (all libraries — @trigger.dev/sdk, @upstash/ratelimit, @upstash/redis, next-auth, react — already in package.json)
5. `src/components/feed/feed-top-bar.tsx` remains a Server Component; only `<ManualSyncButton>` is `'use client'`
6. 导出 button bit-identical (still `disabled title="Phase 6 开放"`)
7. 左上角搜索 (quick-260424-ogp SidebarSearch) and sidebar admin nav (quick-260424-g2y) NOT modified — verified by `git diff --stat` showing zero lines changed in src/components/layout/sidebar*.tsx or src/components/layout/sidebar-search.tsx
8. Scope boundary: no Trigger.dev run status polling / live-updating, no app-level audit table, no toast dependency introduced
</success_criteria>

<output>
After completion, create `.planning/quick/260424-oyc-wire-manual-sync-button-to-trigger-dev-i/260424-oyc-SUMMARY.md` with:
- Artifacts: files created/modified with LOC
- Commits: SHAs of the two commits
- Test results: 6/6 green for sync-route, + adjacency checks (admin-gate, admin-sources-actions still green)
- Live verification: note whether the user was able to manually trigger ingest-hourly via the UI (requires real admin session + TRIGGER_SECRET_KEY in env)
- Deferred follow-ups (for v1.1 / v2 backlog):
  - Live run-status polling (subscribe to Trigger.dev realtime via the returned runId + @trigger.dev/react) — deferred: requires new client dependency
  - App-level audit table for manual triggers (who / when / runId) — deferred: T-OYC-03 accepted via Trigger.dev native audit
  - Feed page auto-revalidate after run completion (POST-trigger polling or realtime + router.refresh) — deferred: current ISR revalidate=300 is sufficient for hourly ingest cadence
  - Export button implementation (CONTEXT explicitly out of scope)
</output>
