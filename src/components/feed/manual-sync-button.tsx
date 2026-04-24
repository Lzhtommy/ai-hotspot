'use client';

/**
 * ManualSyncButton — quick 260424-oyc.
 *
 * Admin-only manual trigger for the `ingest-hourly` Trigger.dev task. Renders
 * the right-most button in FeedTopBar's action row, replacing the
 * Phase-4-era `disabled title="Phase 6 开放"` placeholder.
 *
 * Authority layers (D-02, D-03):
 *   - `canSync` prop decides the disabled state for the non-admin UX path.
 *     NON-authoritative — the server `/api/admin/sync` endpoint enforces
 *     `assertAdmin()` regardless of what the client claims.
 *   - Server-side Upstash sliding-window(1 / 120 s / admin user id) is the
 *     authoritative cooldown. This component OPTIONALLY reads localStorage
 *     to show a visual countdown for the same window; if localStorage
 *     disagrees with the server the server wins (429 → "请稍后再试").
 *
 * Status text (inline, same row, left of the button):
 *   idle       → ""
 *   loading    → "同步中…"
 *   success    → "已触发同步" (auto-clears after 3 s)
 *   429        → "请稍后再试"
 *   401/403    → "仅管理员可操作" (defensive — button is disabled for non-admins)
 *   other err  → "触发失败,请稍后再试"
 *
 * Consumed by:
 *   - src/components/feed/feed-top-bar.tsx
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
      /* localStorage unavailable (private mode) — no countdown */
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

  const label = loading ? '同步中…' : cooling ? `手动同步 (${remainingSec}s)` : '手动同步';

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      {status && (
        <span style={{ fontSize: 12, color: 'var(--fg-3)' }} role="status" aria-live="polite">
          {status}
        </span>
      )}
      <Button variant="primary" size="md" disabled={disabled} title={title} onClick={onClick}>
        <span className="max-sm:hidden">{label}</span>
      </Button>
    </div>
  );
}
