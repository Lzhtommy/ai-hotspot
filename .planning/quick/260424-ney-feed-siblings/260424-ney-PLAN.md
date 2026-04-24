---
phase: quick-260424-ney
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/lib/feed/get-feed.ts
  - src/lib/feed/get-feed.test.ts
  - src/app/(reader)/page.tsx
  - src/app/(reader)/all/page.tsx
autonomous: true
requirements:
  - FEED-SIB-01
must_haves:
  truths:
    - "Clicking the cluster expand button on / renders the sibling list (previously: chevron flipped but list stayed empty)"
    - "Clicking the cluster expand button on /all renders the sibling list"
    - "Primary item never appears in its own sibling list"
    - "Non-clustered items still render without error (clusterSiblings may be empty map)"
    - "Old Redis cache entries (pre-fix) do not serve stale data missing the clusterSiblings field"
  artifacts:
    - path: "src/lib/feed/get-feed.ts"
      provides: "getFeed() returns GetFeedResult with clusterSiblings map; buildFeedKey prefixed with feed:v2:"
      contains: "clusterSiblings"
    - path: "src/app/(reader)/page.tsx"
      provides: "FeaturedPage passes clusterSiblings to Timeline"
      contains: "clusterSiblings"
    - path: "src/app/(reader)/all/page.tsx"
      provides: "AllFeedPage passes clusterSiblings to Timeline"
      contains: "clusterSiblings"
    - path: "src/lib/feed/get-feed.test.ts"
      provides: "Tests covering empty-cluster short-circuit + populated sibling map + primary self-exclusion"
      contains: "clusterSiblings"
  key_links:
    - from: "src/lib/feed/get-feed.ts"
      to: "src/components/feed/timeline.tsx"
      via: "GetFeedResult.clusterSiblings prop threading"
      pattern: "clusterSiblings"
    - from: "src/app/(reader)/page.tsx"
      to: "src/components/feed/timeline.tsx"
      via: "<Timeline clusterSiblings={...} />"
      pattern: "clusterSiblings=\\{"
    - from: "src/app/(reader)/all/page.tsx"
      to: "src/components/feed/timeline.tsx"
      via: "<Timeline clusterSiblings={...} />"
      pattern: "clusterSiblings=\\{"
---

<objective>
修复 feed 列表页「另有 N 个源也报道了此事件」按钮点击后兄弟条目不显示的问题。

根因：`Timeline` 与 `FeedCard` 已支持 `clusterSiblings` prop，但 `getFeed()` 从未产出此字段，3 个 reader 页面也从未向 Timeline 传递。结果 `ClusterSection` 的 `siblings` 永远 undefined，expanded 分支 `expanded && siblings && siblings.length > 0` 永远短路为 false。

Purpose: 让列表页的聚类展开交互真实渲染兄弟条目，与详情页 (`get-item.ts`) 行为一致。
Output: 数据层批量取 siblings + 页面层传参 + 回归测试。UI 组件零改动（ClusterSection/ClusterTrigger/ClusterSiblings/FeedCard/Timeline 都已就绪）。

**非本次范围**：`/favorites` 页不经 `getFeed`，自己拼 `feedItems`。v1 接受 favorites 页暂不支持聚类展开（用户从 favorites 进入的场景较少，且需为该页独立做 siblings 批量取）。若后续要启用，须在 `src/app/(reader)/favorites/page.tsx` 追加同类批量查询与 prop 传递。
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@./CLAUDE.md

<!-- 主要改动点 -->
@src/lib/feed/get-feed.ts
@src/lib/feed/get-feed.test.ts

<!-- 已有批量 sibling 取样板（详情页场景，单 primary） -->
@src/lib/feed/get-item.ts

<!-- schema 参考：items / clusters / sources -->
@src/lib/db/schema.ts

<!-- 下游消费者（不改动） -->
@src/components/feed/timeline.tsx
@src/components/feed/feed-card.tsx
@src/components/feed/cluster-section.tsx
@src/components/feed/cluster-siblings.tsx

<!-- 页面层（要改：传 prop） -->
@src/app/(reader)/page.tsx
@src/app/(reader)/all/page.tsx

<!-- favorites 页（不改，但记录边界） -->
@src/app/(reader)/favorites/page.tsx

<interfaces>
<!-- 下游组件已有的 prop 契约（均已就位，仅列出供数据层对齐） -->

From src/components/feed/timeline.tsx:
```ts
interface TimelineProps {
  items: FeedListItem[];
  clusterSiblings?: Record<string, FeedListItem[]>; // key = String(clusterId)
  now?: Date;
  isAuthenticated?: boolean;
  interactionMap?: Map<string, { favorited: boolean; vote: -1 | 0 | 1 }>;
  initial?: { favorited: boolean; vote: -1 | 0 | 1 };
}
```

From src/components/feed/feed-card.tsx:
```ts
interface FeedCardProps {
  item: FeedListItem;
  siblings?: FeedListItem[];
  // ...
}
```

From src/components/feed/cluster-section.tsx:
```ts
interface ClusterSectionProps {
  clusterId: string;
  memberCount: number;
  siblings?: FeedListItem[];
}
// body: {expanded && siblings && siblings.length > 0 && <ClusterSiblings .../>}
```

From src/lib/feed/get-feed.ts (current, pre-fix):
```ts
export type FeedListItem = { id; title; titleZh; summaryZh; recommendation;
  score; tags; sourceId; sourceName; sourceKind; publishedAt; clusterId;
  clusterMemberCount; url };
export type GetFeedResult = { items: FeedListItem[]; page; totalPages;
  lastSyncMinutes }; // ← must add clusterSiblings
```

From src/lib/feed/get-item.ts (reference pattern, lines 76-108):
```ts
// 批量取 cluster siblings（单 primary 场景）
// 选择相同字段集 → toFeedListItem 映射 → 按 publishedAt ASC 排序
```

Drizzle 批量 IN 查询：`import { inArray, not } from 'drizzle-orm'` 已在 `src/lib/user-actions/get-interactions.ts` 使用。
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: getFeed 产出 clusterSiblings（数据层）</name>
  <files>src/lib/feed/get-feed.ts</files>
  <behavior>
    - 当 rows 中没有任何 clusterId（全部为 null）→ result.clusterSiblings === {}（空对象，不发 sibling SQL）
    - 当 rows 中至少一条有 clusterId → 对每个 clusterId 返回 FeedListItem[] 映射，其中：
      * 不包含 primary 本身（WHERE id NOT IN primaryIds）
      * 仅包含 status = 'published' 的 sibling
      * 按 publishedAt ASC 排序（与 get-item.ts 一致）
      * 映射形状与主 rows 完全一致（用相同的 toFeedListItem 风格代码，sourceName from sources.name, sourceKind from sources.language）
    - buildFeedKey() 所有返回值统一加 `feed:v2:` 前缀（使旧缓存失效，避免命中 pre-fix shape）
    - GetFeedResult 增加字段：`clusterSiblings: Record<string, FeedListItem[]>`（非可选；空 cluster 情况返回 `{}`）
    - cache miss 路径：拼好 clusterSiblings 后连同其他字段一起写入 Redis（`await redis.set(key, result, { ex: TTL })` 已覆盖，因为 result 已包含新字段）
    - cache hit 路径：直接返回 cached（因 key 前缀变更，旧条目不会命中；新写入的条目已携带 clusterSiblings）
  </behavior>
  <action>
    修改 `src/lib/feed/get-feed.ts`：

    1. 在文件顶部 import 增加 `inArray, not` 以供批量 IN 查询使用：
       ```ts
       import { and, asc, desc, eq, gte, inArray, not, sql } from 'drizzle-orm';
       ```

    2. `GetFeedResult` 类型补字段（非可选）：
       ```ts
       export type GetFeedResult = {
         items: FeedListItem[];
         page: number;
         totalPages: number;
         lastSyncMinutes: number | null;
         clusterSiblings: Record<string, FeedListItem[]>;
       };
       ```

    3. `buildFeedKey()` 两个分支统一加 `feed:v2:` 前缀：
       ```ts
       if (p.view === 'featured') return `feed:v2:featured:page:${p.page}`;
       // ...
       return `feed:v2:all:page:${p.page}:tags:${tags}:source:${source}`;
       ```

    4. 在 rows 映射之后、返回 result 之前，插入批量 sibling 查询块（参考 get-item.ts line 76-108 样板，改造为批量版本）：
       ```ts
       // Build primary → clusterId map (only for primaries that ARE in a cluster)
       const primaryIds = rows
         .filter((r) => r.clusterId != null)
         .map((r) => r.id); // bigint[]
       const clusterIds = Array.from(
         new Set(
           rows
             .filter((r) => r.clusterId != null)
             .map((r) => r.clusterId as bigint),
         ),
       );

       const clusterSiblings: Record<string, FeedListItem[]> = {};

       if (clusterIds.length > 0) {
         const siblingRows = await db
           .select({
             id: items.id,
             title: items.title,
             titleZh: items.titleZh,
             summaryZh: items.summaryZh,
             recommendation: items.recommendation,
             score: items.score,
             tags: items.tags,
             sourceId: items.sourceId,
             sourceName: sources.name,
             sourceKind: sources.language,
             publishedAt: items.publishedAt,
             clusterId: items.clusterId,
             url: items.url,
           })
           .from(items)
           .leftJoin(sources, eq(sources.id, items.sourceId))
           .where(
             and(
               inArray(items.clusterId, clusterIds),
               not(inArray(items.id, primaryIds)),
               eq(items.status, 'published'),
             ),
           )
           .orderBy(asc(items.publishedAt));

         for (const s of siblingRows) {
           if (s.clusterId == null) continue;
           const key = String(s.clusterId);
           const mapped: FeedListItem = {
             id: String(s.id),
             title: s.title,
             titleZh: s.titleZh ?? null,
             summaryZh: s.summaryZh ?? null,
             recommendation: s.recommendation ?? null,
             score: s.score ?? 0,
             tags: s.tags ?? null,
             sourceId: s.sourceId,
             sourceName: s.sourceName ?? '',
             sourceKind: s.sourceKind ?? null,
             publishedAt:
               s.publishedAt instanceof Date
                 ? s.publishedAt.toISOString()
                 : String(s.publishedAt),
             clusterId: String(s.clusterId),
             clusterMemberCount: 1, // 该列表上下文不需要真值；UI 已从 primary.clusterMemberCount 取
             url: s.url,
           };
           (clusterSiblings[key] ??= []).push(mapped);
         }
       }
       ```

    5. 在 `const result: GetFeedResult = { ... }` 对象里新增 `clusterSiblings` 字段。

    约束对齐：
      - 仅改动 `get-feed.ts`；不动 get-item.ts；不重构 toFeedListItem（允许内联）。
      - 空 cluster 集合（primaryIds 为 0）→ 直接短路，不发 SQL（由 `if (clusterIds.length > 0)` 保护）。
      - 不引入新依赖；`inArray` / `not` / `asc` 均来自 drizzle-orm，项目已在用。
      - 遵循 CLAUDE.md 「no unnecessary comments」 —— 仅保留「batch siblings」一行简洁注释标注查询意图即可。
      - 不引入 feature flag、不引入 "v1/v2/placeholder" 表述。
  </action>
  <verify>
    <automated>pnpm test src/lib/feed/get-feed.test.ts</automated>
  </verify>
  <done>
    - `getFeed()` 返回值包含 `clusterSiblings: Record&lt;string, FeedListItem[]&gt;`
    - `buildFeedKey` 所有输出以 `feed:v2:` 开头
    - 空 cluster 情况不调用 `db.select` 第二次（只调主查询一次）
    - `pnpm typecheck` 通过（GetFeedResult 新字段编译期检查通过所有消费方）
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: 扩展 get-feed 测试覆盖 clusterSiblings 行为</name>
  <files>src/lib/feed/get-feed.test.ts</files>
  <behavior>
    新增测试用例：
    (a) buildFeedKey 全部产出带 `feed:v2:` 前缀（现有断言需统一修改，期望值全部加 v2: 前缀）
    (b) cache miss + 无 cluster rows：result.clusterSiblings === {} 且 db.select 仅被调用 1 次（主查询），不发 sibling SQL
    (c) cache miss + 有 cluster primary（clusterId=42）：
        - db.select 被调用 2 次（主 + sibling）
        - result.clusterSiblings['42'] 为非空数组
        - result.clusterSiblings['42'] 中不包含 primary 自身（即映射后 id !== primary.id）
    (d) cache hit：cached 对象携带 clusterSiblings 字段时原样回传（回归 — 验证字段被传通）
  </behavior>
  <action>
    修改 `src/lib/feed/get-feed.test.ts`：

    1. 更新所有现有 `buildFeedKey` 断言：
       - `'feed:featured:page:1'` → `'feed:v2:featured:page:1'`
       - `'feed:all:page:1:tags::source:all'` → `'feed:v2:all:page:1:tags::source:all'`
       - 其他同理，全部前缀 `feed:v2:`

    2. 现有 `CACHED_RESULT` fixture 增加 `clusterSiblings: {}` 字段（满足新的非可选类型）。

    3. 现有「cache miss」测试：更新 db.select chainable 语义——primary 主查询仍返回 `offset: vi.fn().mockResolvedValue([])`，因此不会触发 sibling 分支。断言 `mockDb.select` 被调用恰好一次；断言 `result.clusterSiblings` 深等于 `{}`。

    4. **新增测试 1 — 「cache miss with cluster primary populates clusterSiblings」**：
       ```ts
       it('cache miss + cluster primary: fetches siblings and populates clusterSiblings map (primary self-excluded)', async () => {
         const mockRedis = {
           get: vi.fn().mockResolvedValue(null),
           set: vi.fn().mockResolvedValue('OK'),
         };

         // 主查询返回 1 条带 clusterId=42n 的 primary（id=100n）
         const primaryRow = {
           id: 100n,
           title: 'Primary',
           titleZh: null,
           summaryZh: null,
           recommendation: null,
           score: 80,
           tags: null,
           sourceId: 1,
           sourceName: 'Source A',
           sourceKind: null,
           publishedAt: new Date('2026-04-22T01:00:00Z'),
           clusterId: 42n,
           clusterMemberCount: 3,
           url: 'https://example.com/100',
         };

         // Sibling 查询返回 2 条（不含 primary 100n）
         const siblingRows = [
           { ...primaryRow, id: 101n, sourceName: 'Source B', url: 'https://example.com/101',
             publishedAt: new Date('2026-04-22T02:00:00Z'), clusterMemberCount: undefined },
           { ...primaryRow, id: 102n, sourceName: 'Source C', url: 'https://example.com/102',
             publishedAt: new Date('2026-04-22T03:00:00Z'), clusterMemberCount: undefined },
         ];

         // 先返回 primary chain（.offset 出），再返回 sibling chain（.orderBy 出）
         const primaryChain = {
           from: vi.fn().mockReturnThis(),
           leftJoin: vi.fn().mockReturnThis(),
           where: vi.fn().mockReturnThis(),
           orderBy: vi.fn().mockReturnThis(),
           limit: vi.fn().mockReturnThis(),
           offset: vi.fn().mockResolvedValue([primaryRow]),
         };
         const siblingChain = {
           from: vi.fn().mockReturnThis(),
           leftJoin: vi.fn().mockReturnThis(),
           where: vi.fn().mockReturnThis(),
           orderBy: vi.fn().mockResolvedValue(siblingRows),
         };
         const mockDb = {
           select: vi.fn()
             .mockReturnValueOnce(primaryChain)   // 主查询
             .mockReturnValueOnce(siblingChain),  // sibling 批量查询
           execute: vi.fn()
             .mockResolvedValueOnce({ rows: [{ n: 1 }] })
             .mockResolvedValueOnce({ rows: [{ last_fetched: null }] }),
         };

         const result = await getFeed(
           { view: 'featured', page: 1 },
           { db: mockDb as never, redis: mockRedis as never },
         );

         expect(mockDb.select).toHaveBeenCalledTimes(2);
         expect(result.clusterSiblings['42']).toBeDefined();
         expect(result.clusterSiblings['42']).toHaveLength(2);
         // Primary 不自引用
         expect(result.clusterSiblings['42'].every((s) => s.id !== '100')).toBe(true);
         // Siblings 映射形状
         expect(result.clusterSiblings['42'][0]).toMatchObject({
           id: '101',
           sourceName: 'Source B',
           clusterId: '42',
         });
       });
       ```

    4. **新增测试 2 — 「cache miss without clusters leaves clusterSiblings empty」**：
       ```ts
       it('cache miss without cluster primaries: clusterSiblings is empty and sibling query is not issued', async () => {
         const mockRedis = {
           get: vi.fn().mockResolvedValue(null),
           set: vi.fn().mockResolvedValue('OK'),
         };
         const nonClusterRow = {
           id: 200n,
           title: 't',
           titleZh: null,
           summaryZh: null,
           recommendation: null,
           score: 50,
           tags: null,
           sourceId: 1,
           sourceName: 'S',
           sourceKind: null,
           publishedAt: new Date('2026-04-22T00:00:00Z'),
           clusterId: null,                 // ← 关键：无 cluster
           clusterMemberCount: 1,
           url: 'https://example.com/200',
         };
         const primaryChain = {
           from: vi.fn().mockReturnThis(),
           leftJoin: vi.fn().mockReturnThis(),
           where: vi.fn().mockReturnThis(),
           orderBy: vi.fn().mockReturnThis(),
           limit: vi.fn().mockReturnThis(),
           offset: vi.fn().mockResolvedValue([nonClusterRow]),
         };
         const mockDb = {
           select: vi.fn().mockReturnValueOnce(primaryChain),  // 仅一次
           execute: vi.fn()
             .mockResolvedValueOnce({ rows: [{ n: 1 }] })
             .mockResolvedValueOnce({ rows: [{ last_fetched: null }] }),
         };

         const result = await getFeed(
           { view: 'all', page: 1 },
           { db: mockDb as never, redis: mockRedis as never },
         );

         expect(mockDb.select).toHaveBeenCalledOnce();
         expect(result.clusterSiblings).toEqual({});
       });
       ```

    5. 现有 cache-hit 测试：`CACHED_RESULT` 已在步骤 2 补 `clusterSiblings: {}`，无需新增 — 该测试现在同时保证 cache-hit 路径透传新字段。

    约束对齐：
      - 不触碰 UI 组件测试（feed-card.test.tsx 等 5 个 UI 组件测试保持零改动）。
      - 不引入新的测试工具 / helper；继续沿用 vi.fn() chainable pattern（与现有测试一致）。
  </action>
  <verify>
    <automated>pnpm test src/lib/feed/get-feed.test.ts</automated>
  </verify>
  <done>
    - 现有 buildFeedKey / cache-hit / cache-miss 测试全部通过（已更新前缀与 fixture）
    - 2 个新增测试覆盖 (a) 带 cluster 的 sibling 映射 + primary 自排除 (b) 无 cluster 的短路
    - vitest 显示全部 pass，无跳过用例
  </done>
</task>

<task type="auto">
  <name>Task 3: 页面层传递 clusterSiblings（精选 + 全部）</name>
  <files>src/app/(reader)/page.tsx, src/app/(reader)/all/page.tsx</files>
  <action>
    1. `src/app/(reader)/page.tsx`:
       - `const { items, lastSyncMinutes } = await getFeed(...);` → `const { items, lastSyncMinutes, clusterSiblings } = await getFeed(...);`
       - `<Timeline items={items} ... />` → `<Timeline items={items} clusterSiblings={clusterSiblings} ... />`（保留现有 isAuthenticated / interactionMap / initial props 顺序）

    2. `src/app/(reader)/all/page.tsx`:
       - `const { items, totalPages, lastSyncMinutes } = await getFeed(...);` → `const { items, totalPages, lastSyncMinutes, clusterSiblings } = await getFeed(...);`
       - `<Timeline items={items} ... />` → `<Timeline items={items} clusterSiblings={clusterSiblings} ... />`

    3. `src/app/(reader)/favorites/page.tsx`: **不改动**。在 favorites page 顶部注释块末尾追加一行（现有 JSDoc 内）标注边界：
       ```
       * Note: 列表聚类展开 (clusterSiblings) 暂不在 favorites 页启用。若后续需要，需
       *       为此页添加与 get-feed.ts 类似的批量 sibling 取；favorites 不经 getFeed。
       ```
       （仅注释；文件逻辑不变）

    约束对齐：
      - 不新增任何 import / 组件。
      - 不改 ISR revalidate 值（CLAUDE.md §1 要求 feed 页 revalidate=300，保持）。
      - 不改中文 UI 文案。
      - 保留现有 Plan 05-07 prop-threading contract（isAuthenticated / interactionMap / initial 一字不动）。
  </action>
  <verify>
    <automated>pnpm typecheck &amp;&amp; pnpm test src/lib/feed/get-feed.test.ts</automated>
  </verify>
  <done>
    - `src/app/(reader)/page.tsx` 与 `src/app/(reader)/all/page.tsx` 都从 getFeed 解构 clusterSiblings 并传给 Timeline
    - `src/app/(reader)/favorites/page.tsx` 仅 JSDoc 追加一行边界说明，代码逻辑零改动
    - `pnpm typecheck` 无 TS 错误
    - 手工冒烟（非自动）：`pnpm dev` 后访问 /，点开任一 cluster 展开按钮，兄弟条目出现；同样在 /all 验证
  </done>
</task>

</tasks>

<verification>
**Automated:**
- `pnpm typecheck` — GetFeedResult 新字段在所有消费点编译期一致
- `pnpm test src/lib/feed/get-feed.test.ts` — 数据层回归 + 2 个新增 cluster 测试全绿
- `pnpm test` — 完整测试套件（确保未破坏 feed-card / 其他 UI 测试）
- `pnpm build` — Next.js 生产构建通过（ISR 页面仍可 generate）

**Manual smoke (post-merge local):**
- `pnpm dev`，访问 `/` → 找到 `clusterMemberCount > 1` 的卡片 → 点击「另有 N 个源也报道了此事件」→ chevron 翻转**且**siblings 列表出现
- `/all` 同上验证
- `/favorites` 不应 regress（已登录访问正常渲染，cluster 展开按钮点击时 chevron 翻转但 siblings 不出现 — 符合本次范围外标注）
</verification>

<success_criteria>
- Feed 列表页（/ 与 /all）点击 cluster 展开按钮，兄弟条目实际渲染（根因消除）
- Primary 不自引用（siblings 列表不含当前卡片自己）
- 仅 status='published' 的 sibling 出现
- 旧 Redis 缓存不会命中（feed:v2: 前缀隔离）
- /favorites 页零改动（边界显式注释记录）
- 5 个 UI 组件（Timeline/FeedCard/ClusterSection/ClusterTrigger/ClusterSiblings）零代码改动
- typecheck + test + build 全绿
</success_criteria>

<output>
After completion, create `.planning/quick/260424-ney-feed-siblings/260424-ney-SUMMARY.md`
</output>
