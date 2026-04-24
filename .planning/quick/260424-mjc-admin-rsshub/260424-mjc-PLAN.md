---
phase: 260424-mjc-admin-rsshub
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/server/actions/admin-sources.ts
  - src/components/admin/source-form.tsx
  - tests/unit/admin-sources-actions.test.ts
autonomous: true
requirements:
  - QUICK-260424-MJC — admin 新建信源表单接受 RSSHub 路由路径与完整 URL 两种格式
user_setup: []

must_haves:
  truths:
    - 管理员在 /admin/sources/new 输入以 / 开头的 RSSHub 路由路径（如 /hackernews/newest/ai）可通过前端浏览器校验（不再触发「请输入网址」原生提示）
    - 管理员输入完整 http(s):// URL 仍然通过前端与服务端校验（不退化）
    - SourceCreateSchema 的 rssUrl 校验放弃 z.string().url()，改用 refine：接受 http(s):// URL 或以 / 开头且长度≥2 的路径
    - 非法格式（纯文本如 "abc"、以 // 开头的协议相对 URL、空字符串、超长字符串）被服务端 Zod 拒绝并返回 { ok:false, error:'VALIDATION' }
    - ERROR_COPY.VALIDATION 文案提示用户「可填写完整 URL 或以 / 开头的 RSSHub 路由」
    - 单元测试覆盖：/ 开头路径通过、完整 URL 通过、非法格式拒绝三类用例
  artifacts:
    - path: "src/server/actions/admin-sources.ts"
      provides: "SourceCreateSchema.rssUrl 新校验规则（支持两种格式）"
      contains: "refine"
    - path: "src/components/admin/source-form.tsx"
      provides: "rssUrl 输入框 type 从 url 改为 text + 更新占位符/说明文字/ERROR_COPY.VALIDATION"
      contains: "type=\"text\""
    - path: "tests/unit/admin-sources-actions.test.ts"
      provides: "createSourceAction 接受 RSSHub 路径与完整 URL 的回归测试"
      contains: "createSourceAction"
  key_links:
    - from: "src/components/admin/source-form.tsx"
      to: "src/server/actions/admin-sources.ts"
      via: "FormData → createSourceAction(fd)"
      pattern: "createSourceAction\\(formData\\)"
    - from: "src/server/actions/admin-sources.ts"
      to: "drizzle/seed-sources.ts (范式一致)"
      via: "rssUrl 以 / 开头的路径格式与 seed 数据对齐"
      pattern: "startsWith\\('/'\\)"
---

<objective>
修复 /admin/sources/new 表单与 createSourceAction 的校验不一致：当前前端 `type="url"` + 服务端 `z.string().url()` 只接受完整 URL，但 Phase 02-04 决策 D-20（密钥不落库、base 可旋转）以及 seed-sources.ts / docs/admin.md:87 的设计都明确要求「rssUrl 字段存 RSSHub 路由路径（以 / 开头）」。

Purpose: 让管理员能在 UI 中输入设计已记录的两种合法格式 —— 完整 RSS URL（原生源，如 Hugging Face Blog feed.xml）或 RSSHub 路由（以 / 开头，运行时由 fetchRSSHub 拼接 base + key），修复校验链的断裂点。

Output: 服务端 Zod 规则、前端 input type/占位符/ERROR_COPY 文案、回归测试。

## 边界与非本次范围（明确不做）

1. **不改 fetch-source 分流逻辑**：当前 Phase 2 ingestion 只调 fetchRSSHub(path)，原生 URL 的 fetch 分流（若 rssUrl 以 http(s):// 开头则直接 fetch，否则走 fetchRSSHub）属于后续工作。本次仅修复「能存进库」的校验层。
2. **不改数据库 schema**：rss_url 列的 UNIQUE 约束与长度限制保持原样。
3. **不改 fetchRSSHub**：其 `path.startsWith('/')` 契约已经正确。
4. **不改 seed-sources.ts**：其 3 条记录早已使用路径格式（/anthropic/news 等），本次修复就是让 UI 与 seed 对齐。
5. **不做新一轮 data migration**：现有数据已是路径 or 完整 URL 的有效形态。
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@CLAUDE.md
@.planning/STATE.md
@src/server/actions/admin-sources.ts
@src/components/admin/source-form.tsx
@src/lib/rsshub.ts
@drizzle/seed-sources.ts
@docs/admin.md
@tests/unit/admin-sources-actions.test.ts

<interfaces>
<!-- Key contracts the executor needs. -->

From src/server/actions/admin-sources.ts (current state):
```typescript
const SourceCreateSchema = z.object({
  name: z.string().trim().min(1).max(200),
  rssUrl: z.string().trim().url().max(2000),   // ← change target
  language: z.enum(['zh', 'en']).default('zh'),
  weight: z.string().regex(WEIGHT_RE).default('1.0'),
  category: z.string().trim().max(40).nullable().optional(),
  isActive: z.boolean().default(true),
});

type ErrorCode = 'VALIDATION' | 'UNAUTHENTICATED' | 'FORBIDDEN' | 'URL_EXISTS' | 'INTERNAL';
export async function createSourceAction(formData: FormData): Promise<AdminActionResult<{ id: number }>>;
```

From src/components/admin/source-form.tsx (current state, line 126-144):
```tsx
<input
  id="source-rssUrl"
  name="rssUrl"
  type="url"                              // ← change target
  required={!isEdit}
  disabled={isEdit}
  maxLength={2000}
  defaultValue={prefill?.rssUrl ?? ''}
  placeholder="https://rsshub.example.com/anthropic/news"   // ← change target
  ...
/>
```

ERROR_COPY (line 61-67) — VALIDATION message must be updated:
```tsx
const ERROR_COPY: Record<string, string> = {
  VALIDATION: '表单填写有误,请检查各字段。',   // ← update to mention the two allowed formats
  ...
};
```

From src/lib/rsshub.ts — path contract (unchanged):
```typescript
export async function fetchRSSHub(path: string, opts: FetchOpts = {}): Promise<Response>
// path should begin with "/"; base + ?key are prepended/appended at call time.
```

From drizzle/seed-sources.ts — existing canonical values:
```typescript
{ rssUrl: '/anthropic/news', ... },
{ rssUrl: '/hackernews/newest/ai', ... },
{ rssUrl: '/buzzing/whatsnew', ... },
```
</interfaces>

<reference_regex>
<!-- Suggested refine predicate (constraints block). Keep as specified. -->
```typescript
z.string()
  .trim()
  .min(1)
  .max(2000)
  .refine(
    (v) => /^https?:\/\//.test(v) || (v.startsWith('/') && v.length >= 2),
    { message: '请输入完整 URL（http:// 或 https:// 开头）或以 / 开头的 RSSHub 路由' }
  )
```

Rationale for `v.length >= 2`: rejects the bare string "/" (meaningless path) while allowing "/x" (shortest real RSSHub route).
</reference_regex>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: 放宽 SourceCreateSchema.rssUrl 校验并更新现有测试契约</name>
  <files>
    src/server/actions/admin-sources.ts,
    tests/unit/admin-sources-actions.test.ts
  </files>
  <behavior>
    在 tests/unit/admin-sources-actions.test.ts 底部新增一个 describe 块 `createSourceAction — rssUrl format acceptance`，覆盖以下用例（均使用已存在的 mock 模式：authMock 返回 admin session、createSourceCoreMock 返回 { id: 1 }）：

    - Test A（accept RSSHub path）: FormData 含 `rssUrl='/hackernews/newest/ai'` + name/weight/isActive 合法 → 预期 `createSourceAction` 返回 `{ ok: true, id: 1 }`；`createSourceCoreMock` 被调用 1 次；传入的对象 `rssUrl` 完全等于 `/hackernews/newest/ai`（无任何改写）。
    - Test B（accept full https URL）: FormData 含 `rssUrl='https://huggingface.co/blog/feed.xml'` → `{ ok: true, id: 1 }`；repo mock 收到原值。
    - Test C（accept full http URL — 非 https 也接受，由 fetch 层决定是否降级）: FormData 含 `rssUrl='http://example.com/feed.xml'` → `{ ok: true }`。
    - Test D（reject plain text）: FormData 含 `rssUrl='hackernews/newest/ai'`（缺少前导 /）→ `{ ok: false, error: 'VALIDATION' }`；`createSourceCoreMock` 未被调用。
    - Test E（reject bare slash）: FormData 含 `rssUrl='/'` → VALIDATION（长度 < 2）。
    - Test F（reject empty）: FormData 含 `rssUrl=''` → VALIDATION（readString 将空字符串折叠为 undefined → z.string() 必填失败）。
    - Test G（reject protocol-relative）: FormData 含 `rssUrl='//evil.com/rss'` → VALIDATION（不匹配 http(s):// 且不以 /x 开头——注意 `//` 确实以 / 开头且长度>=2，**此用例要求 refine 需额外排除 `//` 前缀**，参见实现备注）。
    - Test H（reject overlong）: FormData 含 `rssUrl='/' + 'a'.repeat(2001)` → VALIDATION（.max(2000)）。

    **实现备注 —— 针对 Test G 的细化 refine**: 仅靠 `v.startsWith('/') && v.length>=2` 会错误放行 `//evil.com`。应改用：
    ```typescript
    .refine(
      (v) =>
        /^https?:\/\//.test(v) ||
        (v.startsWith('/') && !v.startsWith('//') && v.length >= 2),
      { message: '请输入完整 URL（http:// 或 https:// 开头）或以 / 开头的 RSSHub 路由' }
    )
    ```
    如果上一行的判断使 Test E（'/'）结果变化，按 length>=2 的实际结果为 false（正确拒绝）。

    所有 FormData 构造参考文件内已有 `beforeEach` + `vi.hoisted()` mock 模式（使用 `createSourceCoreMock` 重置）。mock 需要新增 `createSourceCoreMock.mockClear()` 到 `beforeEach`。
  </behavior>
  <action>
    1. **修改 `src/server/actions/admin-sources.ts`**
       - 将 SourceCreateSchema 中的 `rssUrl: z.string().trim().url().max(2000)` 替换为：
         ```typescript
         rssUrl: z
           .string()
           .trim()
           .min(1)
           .max(2000)
           .refine(
             (v) =>
               /^https?:\/\//.test(v) ||
               (v.startsWith('/') && !v.startsWith('//') && v.length >= 2),
             { message: '请输入完整 URL（http:// 或 https:// 开头）或以 / 开头的 RSSHub 路由' }
           ),
         ```
       - 其他 schema（SourceUpdateSchema、readString/readBool、所有 action 函数）不改动。rssUrl 在 update 流程中本就不读取（action 注释第 196-199 行已说明）。
       - 不新增注释式废话（CLAUDE.md §no unnecessary comments）。refine 的 message 已承担文档职责。

    2. **扩展 `tests/unit/admin-sources-actions.test.ts`**
       - 在文件底部现有 `describe('updateSourceAction — WR-07 ...')` 块之后新增 `describe('createSourceAction — rssUrl format acceptance', ...)`，按 behavior 节中的 Test A–H 逐项实现。
       - 复用顶部已 `vi.hoisted` 的 `authMock` 与 `createSourceCoreMock`；为新 describe 的 `beforeEach` 加入 `createSourceCoreMock.mockClear()`（若尚未包含）。
       - 由于 import 语句里仅有 `updateSourceAction`，需要补充 `createSourceAction`:
         ```typescript
         import { createSourceAction, updateSourceAction } from '@/server/actions/admin-sources';
         ```
       - FormData 构造范式：
         ```typescript
         const fd = new FormData();
         fd.set('name', 'X');
         fd.set('rssUrl', '/hackernews/newest/ai');
         fd.set('weight', '1.0');
         fd.set('language', 'zh');
         fd.append('isActive', 'false');   // sentinel
         fd.append('isActive', 'true');    // checked
         ```
       - 对 VALIDATION 用例，assert `createSourceCoreMock` 未被调用：`expect(createSourceCoreMock).not.toHaveBeenCalled();`。

    3. **不要**在本 task 中改动前端（source-form.tsx）—— 留给 Task 2，以保证此 task 产出的测试先 fail（服务端仍然 z.string().url() 时 Test A 必 fail），再随本 task 的 schema 修改一起 pass（RED → GREEN 同一 task 内完成因为 behavior + 实现同步修改；此处 tdd="true" 仅要求测试文件与实现文件同 task 出现，且先写 behavior 章节再写实现细节）。
  </action>
  <verify>
    <automated>pnpm test tests/unit/admin-sources-actions.test.ts --run</automated>
  </verify>
  <done>
    - SourceCreateSchema.rssUrl 使用 refine 同时接受完整 URL 与 / 开头路径
    - tests/unit/admin-sources-actions.test.ts 的新 describe 8 个用例全部通过
    - 原有 updateSourceAction WR-07 三个用例仍然通过（无回归）
    - pnpm typecheck 通过（refine 的返回类型仍为 string，不影响 downstream）
  </done>
</task>

<task type="auto">
  <name>Task 2: 前端表单 input type/占位符/提示与 ERROR_COPY 文案对齐</name>
  <files>src/components/admin/source-form.tsx</files>
  <action>
    在 `src/components/admin/source-form.tsx` 中进行以下修改，范围严格限定在 rssUrl 字段与 ERROR_COPY：

    1. **rssUrl 输入框（line 126-141）**：
       - `type="url"` → `type="text"`（浏览器 URL 原生校验会拒绝 `/hackernews/...` 这类非 URL 字符串；必须改为 text 让服务端 refine 接管）。
       - `placeholder="https://rsshub.example.com/anthropic/news"` → `placeholder="/anthropic/news 或 https://example.com/feed.xml"`（体现两种格式）。
       - 新增一行 hint 紧跟在 input 后（仅 create 模式显示，与现有 `isEdit ? <p>...</p> : null` 结构对称）：
         ```tsx
         {!isEdit ? (
           <p style={hintStyle}>
             可填写完整 URL(http:// 或 https:// 开头),或以 / 开头的 RSSHub 路由路径。
           </p>
         ) : null}
         ```
         注意：现有 edit 模式下的 hint（line 142-144 的「RSS 地址创建后不可修改…」）保持不变；两种 hint 互斥显示。
       - `maxLength={2000}` 保持不变（与服务端 .max(2000) 对齐）。
       - `required={!isEdit}`、`disabled={isEdit}` 保持不变。

    2. **ERROR_COPY.VALIDATION（line 62）**：
       - 旧：`'表单填写有误,请检查各字段。'`
       - 新：`'表单填写有误:RSS 地址需为完整 URL(http:// 或 https://) 或以 / 开头的 RSSHub 路由,请检查各字段。'`
       - 其他 ERROR_COPY 条目不动。

    3. **其他字段（name、language、weight、category、isActive）、样式、handleSubmit、样式常量**：全部保持不变。

    4. **不添加** 新的 useState、新的 useEffect、新的客户端正则校验。客户端降级为无校验（除 required），由服务端 Zod refine 承担唯一校验入口——这与 CLAUDE.md §zod 一致（zod 是 runtime schema validation 的唯一来源）。
  </action>
  <verify>
    <automated>pnpm test tests/unit/admin-sources-actions.test.ts --run && pnpm typecheck</automated>
  </verify>
  <done>
    - rssUrl input 为 `type="text"`
    - 新 placeholder 与 create-模式 hint 就位,edit-模式 hint 未破坏
    - ERROR_COPY.VALIDATION 提及两种格式
    - pnpm typecheck 通过
    - Task 1 的测试仍然绿(前端改动不影响服务端 action 单测,仅作为回归门)
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| 浏览器 → Server Action | 管理员 FormData 提交,带 admin session cookie,跨此边界进入 Server Action |
| Server Action → DB (Neon) | createSourceCore insert(rssUrl) 写入 sources 表 |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-QMJC-01 | Tampering (Input) | createSourceAction rssUrl | mitigate | refine 规则排除 `//` 协议相对前缀、排除纯路径 `/`、强制 max 2000 字符,防止存入非法值触发下游 fetchRSSHub URL 拼接时的协议注入或异常。|
| T-QMJC-02 | Information Disclosure | refine 错误信息 | accept | refine message 是用户可见的友好中文提示,不暴露 DB schema 或正则实现细节——管理员已通过三层鉴权,提示内容为产品功能而非敏感数据。|
| T-QMJC-03 | Denial of Service | 超长 rssUrl | mitigate | .max(2000) 已限制;同一约束存在于 DB 列与前端 maxLength,防止存储 / 日志放大。|
| T-QMJC-04 | Elevation of Privilege | Server Action | accept | 已由 Phase 6 Plan 06-00 三层 admin gate(middleware + layout + assertAdmin)覆盖;本次仅改校验规则,不触及鉴权链。|
</threat_model>

<verification>
1. `pnpm test tests/unit/admin-sources-actions.test.ts --run` — 新增 8 个 createSourceAction 用例 + 原 WR-07 用例全部绿。
2. `pnpm typecheck` — 无类型错误。
3. `pnpm lint src/server/actions/admin-sources.ts src/components/admin/source-form.tsx tests/unit/admin-sources-actions.test.ts` — 无 lint 错误。
4. 手动冒烟(可选,execute 阶段视情况): 本地 `pnpm dev`,登录 admin,访问 /admin/sources/new,依次输入 `/hackernews/newest/ai`、`https://huggingface.co/blog/feed.xml`、`abc` 三个值,前两者通过进入 /admin/sources 列表,第三个显示 ERROR_COPY.VALIDATION 新文案。
</verification>

<success_criteria>
- `/admin/sources/new` 表单接受 `/开头路径` 与 `http(s):// URL`,拒绝其他所有形态并给出中文提示
- 单元测试覆盖全部 8 个场景(3 accept + 5 reject),全部通过
- 数据库 seed 与 UI 表单对 rssUrl 的格式约定一致(两者都接受路径或完整 URL)
- 服务端 refine 是唯一校验来源,客户端 input 为 type="text" 不进行原生 URL 校验
- 无回归:其他 admin source 相关测试(admin-sources.test.ts、updateSourceAction WR-07)保持绿
</success_criteria>

<output>
After completion, create `.planning/quick/260424-mjc-admin-rsshub/260424-mjc-SUMMARY.md`
</output>
