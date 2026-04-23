/**
 * /admin/access-denied — Phase 6 Plan 06-00.
 *
 * Reachable by non-admin authenticated users. `requireAdmin()` redirects
 * here when role !== 'admin'. Must NOT itself call `requireAdmin()` — doing
 * so would create a redirect loop (non-admin → access-denied → access-denied
 * → ...). This route is intentionally publicly reachable; it exposes no
 * admin data, only a textual explanation + link back home.
 *
 * Rendered as a bare RSC (outside the /admin layout gate's redirect path —
 * Next.js still wraps it in the admin layout because it lives in /admin/*,
 * but `requireAdmin()` will short-circuit with a redirect to this very
 * page for non-admins, which is fine as the layout's redirect is a no-op
 * once the browser is already here. Admins who stumble in just see the
 * access-denied page with their admin chrome — acceptable.)
 *
 * Static because the content is fully user-independent.
 */
import Link from 'next/link';

export const dynamic = 'force-static';

export default function AdminAccessDeniedPage() {
  return (
    <div
      style={{
        maxWidth: 480,
        margin: '48px auto',
        padding: 24,
        textAlign: 'center',
      }}
    >
      <h1
        style={{
          fontSize: 20,
          fontWeight: 600,
          color: 'var(--ink-900)',
          margin: '0 0 12px',
        }}
      >
        无权访问
      </h1>
      <p
        style={{
          fontSize: 13,
          color: 'var(--fg-3)',
          lineHeight: 1.6,
          margin: '0 0 20px',
        }}
      >
        此页面仅限管理员。若你认为这是个误会,请联系站点管理员开通权限。
      </p>
      <Link
        href="/"
        style={{
          display: 'inline-block',
          padding: '8px 16px',
          borderRadius: 6,
          background: 'var(--surface-1)',
          color: 'var(--ink-900)',
          fontSize: 13,
          textDecoration: 'none',
          border: '1px solid var(--line-weak)',
        }}
      >
        返回首页
      </Link>
    </div>
  );
}
