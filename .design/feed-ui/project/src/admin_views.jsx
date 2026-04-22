// ============================================================================
// Admin views — Sources, Users, Strategies, Backend overview
// ============================================================================

const AdminTopBar = ({ title, subtitle, actions }) => (
  <div
    style={{
      background: 'var(--paper)',
      borderBottom: '1px solid var(--line-weak)',
      padding: '18px 32px',
      position: 'sticky',
      top: 0,
      zIndex: 20,
    }}
  >
    <div
      style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}
    >
      <div>
        <h1
          style={{
            fontSize: 22,
            fontWeight: 600,
            color: 'var(--ink-900)',
            letterSpacing: '-0.015em',
            margin: 0,
          }}
        >
          {title}
        </h1>
        {subtitle && (
          <div style={{ fontSize: 12.5, color: 'var(--fg-3)', marginTop: 3 }}>{subtitle}</div>
        )}
      </div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>{actions}</div>
    </div>
  </div>
);

const HealthDot = ({ health }) => {
  const color =
    health === 'ok'
      ? 'var(--success-500)'
      : health === 'degraded'
        ? 'var(--accent-500)'
        : 'var(--danger-500)';
  const label = health === 'ok' ? '正常' : health === 'degraded' ? '缓慢' : '错误';
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        fontSize: 12,
        color: 'var(--fg-2)',
      }}
    >
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: color }} />
      {label}
    </span>
  );
};

const Th = ({ children, width, align = 'left' }) => (
  <th
    style={{
      textAlign: align,
      padding: '10px 14px',
      fontSize: 11,
      fontWeight: 600,
      color: 'var(--fg-3)',
      letterSpacing: '0.06em',
      textTransform: 'uppercase',
      borderBottom: '1px solid var(--line-weak)',
      background: 'var(--surface-1)',
      width,
      whiteSpace: 'nowrap',
    }}
  >
    {children}
  </th>
);
const Td = ({ children, align = 'left', style }) => (
  <td
    style={{
      padding: '12px 14px',
      fontSize: 13,
      color: 'var(--ink-800)',
      borderBottom: '1px solid var(--line-weak)',
      textAlign: align,
      letterSpacing: '-0.002em',
      ...style,
    }}
  >
    {children}
  </td>
);

const SourcesAdmin = () => (
  <div style={{ flex: 1, overflow: 'auto', background: 'var(--bg-app)' }} className="scroll">
    <AdminTopBar
      title="信源"
      subtitle="通过 RSSHub 聚合的 19 个信源 · 每小时轮询 · 失败自动重试 3 次"
      actions={
        <>
          <Button variant="secondary" size="sm" icon="download">
            导出配置
          </Button>
          <Button variant="primary" size="sm" icon="plus">
            添加信源
          </Button>
        </>
      }
    />

    <div style={{ padding: '24px 32px 80px' }}>
      {/* Stats row */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 12,
          marginBottom: 20,
        }}
      >
        {[
          { label: '信源总数', value: '19', meta: '17 活跃 · 2 异常' },
          { label: '24h 入库', value: '369', meta: '较昨日 +12%' },
          { label: '聚类事件', value: '47', meta: '5 个大事件' },
          { label: 'LLM 调用', value: '1,204', meta: '成本 $8.42' },
        ].map((s) => (
          <div
            key={s.label}
            style={{
              background: 'var(--surface-0)',
              border: '1px solid var(--line-weak)',
              borderRadius: 10,
              padding: 16,
            }}
          >
            <Eyebrow>{s.label}</Eyebrow>
            <div
              style={{
                fontSize: 26,
                fontWeight: 600,
                color: 'var(--ink-900)',
                letterSpacing: '-0.018em',
                marginTop: 6,
                lineHeight: 1,
                fontFamily: 'var(--font-mono)',
              }}
            >
              {s.value}
            </div>
            <div style={{ fontSize: 11.5, color: 'var(--fg-3)', marginTop: 6 }}>{s.meta}</div>
          </div>
        ))}
      </div>

      {/* Sources table */}
      <div
        style={{
          background: 'var(--surface-0)',
          border: '1px solid var(--line-weak)',
          borderRadius: 10,
          overflow: 'hidden',
        }}
      >
        <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'inherit' }}>
          <thead>
            <tr>
              <Th>信源名称</Th>
              <Th>RSSHub 路由</Th>
              <Th align="right">权重</Th>
              <Th align="right">24h 条数</Th>
              <Th>状态</Th>
              <Th width="80" align="right">
                操作
              </Th>
            </tr>
          </thead>
          <tbody>
            {window.SOURCES_LIST.map((s, i) => (
              <tr
                key={s.id}
                style={{ transition: 'background 120ms var(--ease)' }}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--surface-1)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              >
                <Td>
                  <div style={{ fontWeight: 500, color: 'var(--ink-900)' }}>{s.name}</div>
                </Td>
                <Td>
                  <code
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: 11.5,
                      color: 'var(--fg-2)',
                      background: 'var(--surface-1)',
                      padding: '2px 6px',
                      borderRadius: 3,
                      border: '1px solid var(--line-weak)',
                    }}
                  >
                    {s.route}
                  </code>
                </Td>
                <Td align="right">
                  <span style={{ fontFamily: 'var(--font-mono)' }}>{s.weight.toFixed(1)}</span>
                </Td>
                <Td align="right">
                  <span
                    style={{
                      fontFamily: 'var(--font-mono)',
                      color: s.items24h === 0 ? 'var(--fg-4)' : 'var(--ink-900)',
                    }}
                  >
                    {s.items24h}
                  </span>
                </Td>
                <Td>
                  <HealthDot health={s.health} />
                </Td>
                <Td align="right">
                  <IconButton icon="edit" size={26} title="编辑" />
                  <IconButton icon="more-horizontal" size={26} title="更多" />
                </Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  </div>
);

const StrategiesAdmin = () => (
  <div style={{ flex: 1, overflow: 'auto', background: 'var(--bg-app)' }} className="scroll">
    <AdminTopBar
      title="策略"
      subtitle="管理员管理的全局筛选与加权策略 · 变更即时生效"
      actions={
        <>
          <Button variant="secondary" size="sm" icon="code">
            查看日志
          </Button>
          <Button variant="primary" size="sm" icon="plus">
            新建策略
          </Button>
        </>
      }
    />

    <div style={{ padding: '24px 32px 80px', maxWidth: 960, margin: '0 auto' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {window.STRATEGIES.map((s) => (
          <div
            key={s.id}
            style={{
              background: 'var(--surface-0)',
              border: '1px solid var(--line-weak)',
              borderRadius: 10,
              padding: '16px 20px',
              display: 'flex',
              alignItems: 'center',
              gap: 20,
            }}
          >
            {/* Toggle */}
            <label style={{ display: 'inline-flex', cursor: 'pointer', flexShrink: 0 }}>
              <span
                style={{
                  position: 'relative',
                  width: 34,
                  height: 20,
                  background: s.enabled ? 'var(--ink-900)' : 'var(--surface-2)',
                  borderRadius: 999,
                  transition: 'background 120ms var(--ease)',
                }}
              >
                <span
                  style={{
                    position: 'absolute',
                    top: 2,
                    left: s.enabled ? 16 : 2,
                    width: 16,
                    height: 16,
                    borderRadius: '50%',
                    background: '#fff',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                    transition: 'left 120ms var(--ease)',
                  }}
                />
              </span>
            </label>

            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  fontSize: 14,
                  fontWeight: 600,
                  color: 'var(--ink-900)',
                  letterSpacing: '-0.005em',
                }}
              >
                {s.name}
              </div>
              <div style={{ fontSize: 12.5, color: 'var(--fg-3)', marginTop: 3, lineHeight: 1.5 }}>
                {s.desc}
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 18, flexShrink: 0 }}>
              <div style={{ textAlign: 'right' }}>
                <div
                  style={{
                    fontSize: 10,
                    color: 'var(--fg-3)',
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase',
                    fontWeight: 600,
                  }}
                >
                  权重
                </div>
                <div
                  style={{
                    fontSize: 14,
                    fontFamily: 'var(--font-mono)',
                    fontWeight: 600,
                    color: 'var(--ink-900)',
                  }}
                >
                  ×{s.weight.toFixed(1)}
                </div>
              </div>
              <div style={{ textAlign: 'right', minWidth: 60 }}>
                <div
                  style={{
                    fontSize: 10,
                    color: 'var(--fg-3)',
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase',
                    fontWeight: 600,
                  }}
                >
                  7日命中
                </div>
                <div
                  style={{
                    fontSize: 14,
                    fontFamily: 'var(--font-mono)',
                    fontWeight: 600,
                    color: s.triggers == null ? 'var(--fg-4)' : 'var(--ink-900)',
                  }}
                >
                  {s.triggers == null ? '—' : s.triggers}
                </div>
              </div>
              <IconButton icon="edit" size={30} title="编辑" />
              <IconButton icon="more-horizontal" size={30} title="更多" />
            </div>
          </div>
        ))}
      </div>

      {/* Prompt editor preview */}
      <div
        style={{
          marginTop: 24,
          background: 'var(--surface-0)',
          border: '1px solid var(--line-weak)',
          borderRadius: 10,
          padding: 20,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 10,
          }}
        >
          <div>
            <Eyebrow>Claude 评分 Prompt</Eyebrow>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink-900)', marginTop: 3 }}>
              hotness-scorer-v4.md
            </div>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <Button variant="ghost" size="sm" icon="eye">
              预览
            </Button>
            <Button variant="secondary" size="sm" icon="edit">
              编辑
            </Button>
          </div>
        </div>
        <pre
          style={{
            margin: 0,
            padding: 14,
            background: 'var(--surface-1)',
            border: '1px solid var(--line-weak)',
            borderRadius: 6,
            fontFamily: 'var(--font-mono)',
            fontSize: 12,
            lineHeight: 1.6,
            color: 'var(--ink-800)',
            overflow: 'auto',
            maxHeight: 160,
          }}
        >{`You are a senior AI news analyst for Chinese developers.
Score the following item from 0 to 100 by importance to
working AI practitioners. Weight:
  - technical novelty (40)
  - practical near-term impact (30)
  - cross-source corroboration (20)
  - signal-to-noise of the source itself (10)
Do not reward hype, vague claims, or recycled content.
Return only the integer.`}</pre>
      </div>
    </div>
  </div>
);

const UsersAdmin = () => (
  <div style={{ flex: 1, overflow: 'auto', background: 'var(--bg-app)' }} className="scroll">
    <AdminTopBar
      title="用户"
      subtitle={`${window.USERS.length} 位注册用户 · 其中 1 位封禁`}
      actions={
        <>
          <div style={{ width: 260 }}>
            <div style={{ position: 'relative' }}>
              <span
                style={{
                  position: 'absolute',
                  left: 10,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'var(--ink-500)',
                  display: 'flex',
                }}
              >
                <Icon name="search" size={13} />
              </span>
              <input
                placeholder="搜索邮箱…"
                style={{
                  width: '100%',
                  height: 32,
                  padding: '0 12px 0 32px',
                  border: '1px solid var(--line)',
                  borderRadius: 6,
                  fontFamily: 'inherit',
                  fontSize: 13,
                  background: 'var(--surface-0)',
                  color: 'var(--ink-900)',
                }}
              />
            </div>
          </div>
          <Button variant="secondary" size="sm" icon="download">
            导出
          </Button>
        </>
      }
    />

    <div style={{ padding: '24px 32px 80px' }}>
      <div
        style={{
          background: 'var(--surface-0)',
          border: '1px solid var(--line-weak)',
          borderRadius: 10,
          overflow: 'hidden',
        }}
      >
        <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'inherit' }}>
          <thead>
            <tr>
              <Th>邮箱</Th>
              <Th>角色</Th>
              <Th>注册日期</Th>
              <Th align="right">收藏</Th>
              <Th align="right">点赞</Th>
              <Th>状态</Th>
              <Th width="60" align="right"></Th>
            </tr>
          </thead>
          <tbody>
            {window.USERS.map((u) => (
              <tr
                key={u.id}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--surface-1)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              >
                <Td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div
                      style={{
                        width: 24,
                        height: 24,
                        borderRadius: '50%',
                        background: 'var(--surface-2)',
                        color: 'var(--ink-700)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 10,
                        fontWeight: 600,
                      }}
                    >
                      {u.email.slice(0, 2).toUpperCase()}
                    </div>
                    <span style={{ color: 'var(--ink-900)', fontWeight: 500 }}>{u.email}</span>
                  </div>
                </Td>
                <Td>
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      padding: '2px 8px',
                      fontSize: 11,
                      fontWeight: 500,
                      color:
                        u.role === '管理员'
                          ? 'var(--accent-700)'
                          : u.role === '运营'
                            ? 'var(--info-500)'
                            : 'var(--ink-700)',
                      background:
                        u.role === '管理员'
                          ? 'var(--accent-50)'
                          : u.role === '运营'
                            ? 'var(--info-50)'
                            : 'var(--surface-1)',
                      border: '1px solid var(--line-weak)',
                      borderRadius: 3,
                    }}
                  >
                    {u.role}
                  </span>
                </Td>
                <Td>
                  <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--fg-2)' }}>
                    {u.joined}
                  </span>
                </Td>
                <Td align="right">
                  <span style={{ fontFamily: 'var(--font-mono)' }}>{u.favorites}</span>
                </Td>
                <Td align="right">
                  <span style={{ fontFamily: 'var(--font-mono)' }}>{u.likes}</span>
                </Td>
                <Td>
                  <span
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12 }}
                  >
                    <span
                      style={{
                        width: 6,
                        height: 6,
                        borderRadius: '50%',
                        background:
                          u.status === '封禁' ? 'var(--danger-500)' : 'var(--success-500)',
                      }}
                    />
                    <span
                      style={{ color: u.status === '封禁' ? 'var(--danger-500)' : 'var(--fg-2)' }}
                    >
                      {u.status}
                    </span>
                  </span>
                </Td>
                <Td align="right">
                  <IconButton icon="more-horizontal" size={26} />
                </Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  </div>
);

const BackendAdmin = () => {
  // Overview: pipeline status, recent LLM calls, cost
  return (
    <div style={{ flex: 1, overflow: 'auto', background: 'var(--bg-app)' }} className="scroll">
      <AdminTopBar
        title="后台"
        subtitle="聚合管线 · LLM 调用 · 成本"
        actions={
          <Button variant="secondary" size="sm" icon="settings">
            系统配置
          </Button>
        }
      />

      <div style={{ padding: '24px 32px 80px', maxWidth: 1100, margin: '0 auto' }}>
        {/* Stats */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: 12,
            marginBottom: 20,
          }}
        >
          {[
            { l: '本小时入库', v: '34', m: '正常' },
            { l: 'LLM 调用 24h', v: '1,204', m: '成功率 99.2%' },
            { l: 'Token 消耗 24h', v: '3.2M', m: '输入 2.1M · 输出 1.1M' },
            { l: '成本 24h', v: '$8.42', m: 'Sonnet 4.5 · Haiku 4.5' },
          ].map((s) => (
            <div
              key={s.l}
              style={{
                background: 'var(--surface-0)',
                border: '1px solid var(--line-weak)',
                borderRadius: 10,
                padding: 16,
              }}
            >
              <Eyebrow>{s.l}</Eyebrow>
              <div
                style={{
                  fontSize: 26,
                  fontWeight: 600,
                  color: 'var(--ink-900)',
                  letterSpacing: '-0.018em',
                  marginTop: 6,
                  lineHeight: 1,
                  fontFamily: 'var(--font-mono)',
                }}
              >
                {s.v}
              </div>
              <div style={{ fontSize: 11.5, color: 'var(--fg-3)', marginTop: 6 }}>{s.m}</div>
            </div>
          ))}
        </div>

        {/* Pipeline status */}
        <div
          style={{
            background: 'var(--surface-0)',
            border: '1px solid var(--line-weak)',
            borderRadius: 10,
            padding: 20,
            marginBottom: 12,
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 14,
            }}
          >
            <div>
              <Eyebrow>聚合管线</Eyebrow>
              <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--ink-900)', marginTop: 3 }}>
                下一次同步 · 48 分钟后
              </div>
            </div>
            <Button variant="secondary" size="sm" icon="loader">
              立即同步
            </Button>
          </div>
          <div style={{ display: 'flex', gap: 2, marginTop: 12 }}>
            {[
              { name: '拉取 RSS', status: 'ok', t: '2.4s' },
              { name: '去重', status: 'ok', t: '0.3s' },
              { name: '翻译', status: 'ok', t: '18.7s' },
              { name: '摘要', status: 'ok', t: '44.2s' },
              { name: '评分', status: 'ok', t: '31.5s' },
              { name: '聚类', status: 'ok', t: '6.1s' },
              { name: '推荐理由', status: 'ok', t: '22.0s' },
              { name: '入库', status: 'ok', t: '0.8s' },
            ].map((p) => (
              <div key={p.name} style={{ flex: 1 }}>
                <div style={{ height: 4, background: 'var(--success-500)', borderRadius: 2 }} />
                <div
                  style={{ fontSize: 11, color: 'var(--ink-800)', marginTop: 6, fontWeight: 500 }}
                >
                  {p.name}
                </div>
                <div
                  style={{ fontSize: 10.5, color: 'var(--fg-3)', fontFamily: 'var(--font-mono)' }}
                >
                  {p.t}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Recent LLM log */}
        <div
          style={{
            background: 'var(--surface-0)',
            border: '1px solid var(--line-weak)',
            borderRadius: 10,
            overflow: 'hidden',
          }}
        >
          <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--line-weak)' }}>
            <Eyebrow>最近 LLM 调用</Eyebrow>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <Th>时间</Th>
                <Th>任务</Th>
                <Th>模型</Th>
                <Th align="right">输入</Th>
                <Th align="right">输出</Th>
                <Th align="right">耗时</Th>
                <Th>状态</Th>
              </tr>
            </thead>
            <tbody>
              {[
                {
                  t: '14:32:04',
                  k: '评分',
                  m: 'claude-sonnet-4.5',
                  i: 2104,
                  o: 12,
                  ms: 812,
                  s: 'ok',
                },
                {
                  t: '14:31:58',
                  k: '摘要',
                  m: 'claude-sonnet-4.5',
                  i: 3820,
                  o: 184,
                  ms: 2341,
                  s: 'ok',
                },
                {
                  t: '14:31:45',
                  k: '推荐理由',
                  m: 'claude-sonnet-4.5',
                  i: 2240,
                  o: 96,
                  ms: 1430,
                  s: 'ok',
                },
                {
                  t: '14:31:22',
                  k: '聚类',
                  m: 'claude-haiku-4.5',
                  i: 5680,
                  o: 44,
                  ms: 642,
                  s: 'ok',
                },
                {
                  t: '14:30:58',
                  k: '翻译',
                  m: 'claude-haiku-4.5',
                  i: 1824,
                  o: 880,
                  ms: 1108,
                  s: 'ok',
                },
                {
                  t: '14:30:31',
                  k: '评分',
                  m: 'claude-sonnet-4.5',
                  i: 2140,
                  o: 12,
                  ms: 3200,
                  s: 'retry',
                },
              ].map((r, i) => (
                <tr key={i}>
                  <Td>
                    <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--fg-2)' }}>
                      {r.t}
                    </span>
                  </Td>
                  <Td>{r.k}</Td>
                  <Td>
                    <code
                      style={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: 11.5,
                        color: 'var(--fg-2)',
                      }}
                    >
                      {r.m}
                    </code>
                  </Td>
                  <Td align="right">
                    <span style={{ fontFamily: 'var(--font-mono)' }}>{r.i.toLocaleString()}</span>
                  </Td>
                  <Td align="right">
                    <span style={{ fontFamily: 'var(--font-mono)' }}>{r.o}</span>
                  </Td>
                  <Td align="right">
                    <span style={{ fontFamily: 'var(--font-mono)' }}>{r.ms}ms</span>
                  </Td>
                  <Td>
                    <span
                      style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12 }}
                    >
                      <span
                        style={{
                          width: 6,
                          height: 6,
                          borderRadius: '50%',
                          background: r.s === 'ok' ? 'var(--success-500)' : 'var(--accent-500)',
                        }}
                      />
                      {r.s === 'ok' ? '成功' : '重试后成功'}
                    </span>
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

Object.assign(window, { SourcesAdmin, StrategiesAdmin, UsersAdmin, BackendAdmin, AdminTopBar });
