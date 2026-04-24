'use client';

/**
 * SourceForm — Phase 6 Plan 06-02 (ADMIN-03, ADMIN-04).
 *
 * Shared form for creating a new source or editing an existing one.
 * Client Component because we:
 *   - manage transient UI state (submitting, error banner) via useState
 *   - intercept onSubmit so we can call the server action with a FormData
 *     instance rather than the `action={fn}` prop form (the latter is a
 *     Next.js compiler transform that Vitest cannot reach — using onSubmit
 *     + FormData matches the pattern established in Phase 5 Plan 05-04+).
 *
 * Field set:
 *   - name          text, required
 *   - rssUrl        url, required on create; RENDERED AS DISABLED on edit
 *                   because changing a live source's URL orphans ingested
 *                   items from their origin (see the rationale in
 *                   `updateSourceAction` — rssUrl is never read on update).
 *   - language      select zh|en (default zh)
 *   - weight        numeric string (0–99.9), default 1.0
 *   - category      select lab|social|forum|cn_media|other|""  (free-form
 *                   in DB per D-admin-taxonomy; UI restricts to the v1 set)
 *   - isActive      checkbox (default checked on create)
 *
 * Chinese copy throughout per CLAUDE.md §UI language.
 *
 * Consumed by:
 *   - src/app/admin/sources/new/page.tsx        (mode='create')
 *   - src/app/admin/sources/[id]/edit/page.tsx  (mode='edit')
 */

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import {
  createSourceAction,
  updateSourceAction,
} from '@/server/actions/admin-sources';
import type { SourceAdminRow } from '@/lib/admin/sources-repo';

interface CategoryOption {
  value: string;
  label: string;
}

const CATEGORY_OPTIONS: readonly CategoryOption[] = [
  { value: '', label: '未分类' },
  { value: 'lab', label: '官方实验室' },
  { value: 'social', label: '社交平台' },
  { value: 'forum', label: '论坛社区' },
  { value: 'cn_media', label: '中文媒体' },
  { value: 'other', label: '其他' },
];

interface SourceFormProps {
  mode: 'create' | 'edit';
  /** Required when mode === 'edit'. Prefilled values. */
  source?: SourceAdminRow;
}

// Map the narrow server-action error codes to user-facing Chinese strings.
// Only codes a real admin can hit appear here; 'UNAUTHENTICATED' / 'FORBIDDEN'
// should be impossible after the layout gate but are included defensively.
const ERROR_COPY: Record<string, string> = {
  VALIDATION: '表单填写有误,请检查各字段。',
  UNAUTHENTICATED: '会话已失效,请重新登录。',
  FORBIDDEN: '当前账号无管理员权限。',
  INTERNAL: '服务器出错,请稍后再试。',
};

export function SourceForm({ mode, source }: SourceFormProps) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setError(null);

    const formData = new FormData(e.currentTarget);
    // Ensure the category field is posted even when the user leaves the
    // default "未分类" option selected, so the server action can clear it
    // on edit. An empty string is normalized to null in the server-side
    // zod parser (readString returns undefined for '').
    try {
      const result =
        mode === 'create'
          ? await createSourceAction(formData)
          : await updateSourceAction(formData);

      if (result.ok) {
        router.push('/admin/sources');
        router.refresh();
        return;
      }
      setError(ERROR_COPY[result.error] ?? ERROR_COPY.INTERNAL!);
    } catch {
      // Server Actions throw on transport errors; swallow and show generic.
      setError(ERROR_COPY.INTERNAL!);
    } finally {
      setSubmitting(false);
    }
  }

  const isEdit = mode === 'edit';
  const prefill = source;

  return (
    <form onSubmit={handleSubmit} style={formStyle}>
      <h2 style={titleStyle}>{isEdit ? '编辑信源' : '新建信源'}</h2>

      {/* Hidden id on edit so the server action knows which row to patch. */}
      {isEdit && prefill ? (
        <input type="hidden" name="id" value={prefill.id} />
      ) : null}

      <Field label="名称" htmlFor="source-name">
        <input
          id="source-name"
          name="name"
          type="text"
          required
          maxLength={200}
          defaultValue={prefill?.name ?? ''}
          style={inputStyle}
        />
      </Field>

      <Field label="RSS 地址" htmlFor="source-rssUrl">
        <input
          id="source-rssUrl"
          name="rssUrl"
          type="url"
          required={!isEdit}
          disabled={isEdit}
          maxLength={2000}
          defaultValue={prefill?.rssUrl ?? ''}
          placeholder="https://rsshub.example.com/anthropic/news"
          style={{
            ...inputStyle,
            background: isEdit ? 'var(--surface-1)' : 'var(--paper)',
            color: isEdit ? 'var(--fg-3)' : 'var(--ink-900)',
            cursor: isEdit ? 'not-allowed' : 'text',
          }}
        />
        {isEdit ? (
          <p style={hintStyle}>RSS 地址创建后不可修改,如需替换请软删除后重新创建。</p>
        ) : null}
      </Field>

      <Field label="语言" htmlFor="source-language">
        <select
          id="source-language"
          name="language"
          defaultValue={prefill?.language ?? 'zh'}
          style={inputStyle}
        >
          <option value="zh">中文</option>
          <option value="en">英文</option>
        </select>
      </Field>

      <Field label="权重" htmlFor="source-weight">
        <input
          id="source-weight"
          name="weight"
          type="text"
          inputMode="decimal"
          pattern="\d+(\.\d)?"
          required
          defaultValue={prefill?.weight ?? '1.0'}
          style={inputStyle}
        />
        <p style={hintStyle}>数字,保留一位小数,例如 1.0、2.5、10。</p>
      </Field>

      <Field label="分类" htmlFor="source-category">
        <select
          id="source-category"
          name="category"
          defaultValue={prefill?.category ?? ''}
          style={inputStyle}
        >
          {CATEGORY_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </Field>

      <label style={checkboxLabelStyle}>
        <input
          type="checkbox"
          name="isActive"
          defaultChecked={prefill ? prefill.isActive : true}
        />
        <span>启用(取消勾选则加入后不轮询)</span>
      </label>

      {error ? (
        <div role="alert" style={errorStyle}>
          {error}
        </div>
      ) : null}

      <div style={actionsStyle}>
        <button type="submit" disabled={submitting} style={primaryButtonStyle}>
          {submitting ? '保存中…' : isEdit ? '保存修改' : '创建信源'}
        </button>
        <button
          type="button"
          onClick={() => router.push('/admin/sources')}
          style={secondaryButtonStyle}
          disabled={submitting}
        >
          取消
        </button>
      </div>
    </form>
  );
}

// ────────────────────────────────────────────────────────────────────────
// Layout primitives (inline styles match AdminShell convention).
// ────────────────────────────────────────────────────────────────────────

function Field({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor: string;
  children: React.ReactNode;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <label
        htmlFor={htmlFor}
        style={{ fontSize: 12.5, color: 'var(--ink-700)', fontWeight: 500 }}
      >
        {label}
      </label>
      {children}
    </div>
  );
}

const formStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 16,
  maxWidth: 520,
  padding: 20,
  background: 'var(--paper)',
  border: '1px solid var(--line-weak)',
  borderRadius: 10,
};

const titleStyle: React.CSSProperties = {
  margin: 0,
  fontSize: 16,
  fontWeight: 600,
  color: 'var(--ink-900)',
  letterSpacing: '-0.005em',
};

const inputStyle: React.CSSProperties = {
  padding: '8px 10px',
  fontSize: 13,
  border: '1px solid var(--line-weak)',
  borderRadius: 6,
  background: 'var(--paper)',
  color: 'var(--ink-900)',
  fontFamily: 'var(--font-sans)',
};

const hintStyle: React.CSSProperties = {
  margin: 0,
  fontSize: 11.5,
  color: 'var(--fg-3)',
};

const checkboxLabelStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  fontSize: 13,
  color: 'var(--ink-700)',
  cursor: 'pointer',
};

const errorStyle: React.CSSProperties = {
  padding: '8px 12px',
  fontSize: 12.5,
  color: 'var(--danger, #ef4444)',
  background: 'rgba(239, 68, 68, 0.08)',
  border: '1px solid rgba(239, 68, 68, 0.2)',
  borderRadius: 6,
};

const actionsStyle: React.CSSProperties = {
  display: 'flex',
  gap: 10,
  marginTop: 4,
};

const primaryButtonStyle: React.CSSProperties = {
  padding: '8px 16px',
  fontSize: 13,
  fontWeight: 500,
  color: 'var(--surface-0)',
  background: 'var(--accent, #10b981)',
  border: 'none',
  borderRadius: 6,
  cursor: 'pointer',
};

const secondaryButtonStyle: React.CSSProperties = {
  padding: '8px 16px',
  fontSize: 13,
  color: 'var(--ink-700)',
  background: 'transparent',
  border: '1px solid var(--line-weak)',
  borderRadius: 6,
  cursor: 'pointer',
};
