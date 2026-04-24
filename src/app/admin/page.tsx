/**
 * /admin landing — Phase 6 Plan 06-00.
 *
 * Welcome surface for authenticated admins. Gate is inherited from
 * src/app/admin/layout.tsx (requireAdmin). The four cards below are
 * placeholders that link into the sub-routes landed by later Phase 6 plans:
 *
 *   - /admin/sources      — 信源管理 (Plan 06-02)
 *   - /admin/users        — 用户管理 (Plan 06-03)
 *   - /admin/costs        — 成本监控 (Plan 06-04)
 *   - /admin/dead-letter  — 死信队列 (Plan 06-05)
 *
 * Copy is Chinese-only per CLAUDE.md §UI language.
 */
import Link from 'next/link';
import { Icon, type IconName } from '@/components/layout/icon';

interface AdminCard {
  id: string;
  title: string;
  subtitle: string;
  href: string;
  icon: IconName;
}

const CARDS: readonly AdminCard[] = [
  {
    id: 'sources',
    title: '信源管理',
    subtitle: '添加、编辑、调整权重与健康状态',
    href: '/admin/sources',
    icon: 'globe',
  },
  {
    id: 'users',
    title: '用户管理',
    subtitle: '查看、搜索、封禁与角色调整',
    href: '/admin/users',
    icon: 'users',
  },
  {
    id: 'costs',
    title: '成本监控',
    subtitle: 'LLM 与嵌入调用的花销与 token 趋势',
    href: '/admin/costs',
    icon: 'settings',
  },
  {
    id: 'dead-letter',
    title: '死信队列',
    subtitle: '抓取与处理失败的条目回放与排查',
    href: '/admin/dead-letter',
    icon: 'alert-circle',
  },
];

export default function AdminHomePage() {
  return (
    <div>
      <header style={{ marginBottom: 24 }}>
        <h1
          style={{
            fontSize: 22,
            fontWeight: 600,
            color: 'var(--ink-900)',
            letterSpacing: '-0.01em',
            margin: 0,
          }}
        >
          管理后台
        </h1>
        <p
          style={{
            marginTop: 6,
            fontSize: 13,
            color: 'var(--fg-3)',
          }}
        >
          选择下方模块进行管理。仅管理员可见。
        </p>
      </header>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
          gap: 16,
        }}
      >
        {CARDS.map((card) => (
          <Link
            key={card.id}
            href={card.href}
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
              padding: 16,
              borderRadius: 10,
              border: '1px solid var(--line-weak)',
              background: 'var(--paper)',
              color: 'var(--ink-900)',
              textDecoration: 'none',
              transition: 'border-color 120ms var(--ease), background 120ms var(--ease)',
              minHeight: 108,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span
                aria-hidden="true"
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 6,
                  background: 'var(--surface-1)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Icon name={card.icon} size={15} />
              </span>
              <span
                style={{
                  fontSize: 15,
                  fontWeight: 600,
                  letterSpacing: '-0.005em',
                }}
              >
                {card.title}
              </span>
              <span
                aria-hidden="true"
                style={{ marginLeft: 'auto', color: 'var(--fg-3)', fontSize: 16 }}
              >
                →
              </span>
            </div>
            <p
              style={{
                margin: 0,
                fontSize: 12.5,
                color: 'var(--fg-3)',
                lineHeight: 1.5,
              }}
            >
              {card.subtitle}
            </p>
          </Link>
        ))}
      </div>
    </div>
  );
}
