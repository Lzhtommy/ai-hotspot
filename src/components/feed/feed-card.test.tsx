/**
 * FeedCard unit tests — Phase 4 FEED-03, FEED-05, FEED-11.
 *
 * Uses react-dom/server renderToString (Node-compatible, no jsdom required).
 * Tests verify all 8 card anatomy steps render for a fully-populated item,
 * and conditional rendering for recommendation, cluster, and FEED-11 titleZh.
 */

import { describe, it, expect } from 'vitest';
import { renderToString } from 'react-dom/server';

// RED: these imports fail until feed-card.tsx and timeline.tsx are implemented
import { FeedCard } from './feed-card';
import { Timeline } from './timeline';
import type { FeedListItem } from '@/lib/feed/get-feed';

// Sample fully-populated item for anatomy tests
const fullItem: FeedListItem = {
  id: '42',
  title: 'Claude 3.5 Sonnet Released',
  titleZh: 'Claude 3.5 Sonnet 发布',
  summaryZh: '这是一篇关于 Claude 3.5 Sonnet 发布的摘要，包含详细信息和功能介绍。',
  recommendation: '此模型在编码和推理方面取得了重大突破，值得关注。',
  score: 88,
  tags: ['模型发布', 'Anthropic'],
  sourceId: 1,
  sourceName: 'Anthropic',
  sourceKind: 'official',
  publishedAt: '2026-04-20T10:00:00.000Z',
  clusterId: 'cluster-99',
  clusterMemberCount: 3,
  url: 'https://www.anthropic.com/news/claude-3-5-sonnet',
};

// Item with no recommendation, cluster=1, low score
const minimalItem: FeedListItem = {
  id: '7',
  title: 'Minor Update',
  titleZh: null,
  summaryZh: '简短的摘要。',
  recommendation: null,
  score: 55,
  tags: ['Agent'],
  sourceId: 2,
  sourceName: 'OpenAI',
  sourceKind: null,
  publishedAt: '2026-04-20T09:00:00.000Z',
  clusterId: null,
  clusterMemberCount: 1,
  url: 'https://openai.com/blog/update',
};

// Item with English title but Chinese titleZh (FEED-11)
const feedItem11: FeedListItem = {
  id: '99',
  title: 'Gemini 2.0 Flash Launch',
  titleZh: 'Gemini 2.0 Flash 正式发布',
  summaryZh: 'Google 发布了 Gemini 2.0 Flash 模型。',
  recommendation: null,
  score: 72,
  tags: ['模型发布', 'Google'],
  sourceId: 3,
  sourceName: 'Google',
  sourceKind: null,
  publishedAt: '2026-04-19T14:00:00.000Z',
  clusterId: null,
  clusterMemberCount: 1,
  url: 'https://blog.google/gemini-flash',
};

// Siblings for cluster test
const siblings: FeedListItem[] = [
  {
    id: '43',
    title: 'Claude Sonnet Benchmark',
    titleZh: 'Claude Sonnet 基准测试结果',
    summaryZh: '基准测试摘要',
    recommendation: null,
    score: 75,
    tags: ['Benchmark'],
    sourceId: 4,
    sourceName: 'HackerNews',
    sourceKind: null,
    publishedAt: '2026-04-20T11:00:00.000Z',
    clusterId: 'cluster-99',
    clusterMemberCount: 3,
    url: 'https://news.ycombinator.com/item?id=12345',
  },
];

describe('FeedCard — 8-step anatomy', () => {
  it('renders titleZh (step 2)', () => {
    const html = renderToString(<FeedCard item={fullItem} />);
    expect(html).toContain('Claude 3.5 Sonnet 发布');
  });

  it('renders summaryZh (step 3)', () => {
    const html = renderToString(<FeedCard item={fullItem} />);
    expect(html).toContain('这是一篇关于 Claude 3.5 Sonnet');
  });

  it('renders 推荐理由 callout when recommendation is present (step 4)', () => {
    const html = renderToString(<FeedCard item={fullItem} />);
    expect(html).toContain('Claude 推荐理由');
    expect(html).toContain('此模型在编码和推理方面取得了重大突破');
  });

  it('does NOT render 推荐理由 when recommendation is null (step 4 conditional)', () => {
    const html = renderToString(<FeedCard item={minimalItem} />);
    expect(html).not.toContain('Claude 推荐理由');
  });

  it('renders tags (step 5)', () => {
    const html = renderToString(<FeedCard item={fullItem} />);
    expect(html).toContain('模型发布');
    expect(html).toContain('Anthropic');
  });

  it('renders cluster trigger when clusterMemberCount > 1 (step 6)', () => {
    const html = renderToString(<FeedCard item={fullItem} siblings={siblings} />);
    expect(html).toContain('个源也报道了此事件');
  });

  it('does NOT render cluster trigger when clusterMemberCount === 1 (step 6 conditional)', () => {
    const html = renderToString(<FeedCard item={minimalItem} />);
    expect(html).not.toContain('个源也报道了此事件');
  });

  it('renders action bar aria-labels (step 8)', () => {
    const html = renderToString(<FeedCard item={fullItem} />);
    // Phase 5 05-07 UI-SPEC §FeedCardActions: Chinese inactive labels.
    expect(html).toContain('收藏');
    expect(html).toContain('点赞');
    expect(html).toContain('点踩');
    expect(html).toContain('打开原文');
  });

  it('renders HOT chip when score >= 80 (step 1 ScoreBadge)', () => {
    const html = renderToString(<FeedCard item={fullItem} />);
    expect(html).toContain('HOT');
  });

  it('renders score aria-label', () => {
    const html = renderToString(<FeedCard item={fullItem} />);
    expect(html).toContain('热度评分 88/100');
  });

  it('renders outbound link with rel=noopener noreferrer', () => {
    const html = renderToString(<FeedCard item={fullItem} />);
    expect(html).toContain('rel="noopener noreferrer"');
  });

  it('title wrapped in a Link to /items/{id}', () => {
    const html = renderToString(<FeedCard item={fullItem} />);
    expect(html).toContain('/items/42');
  });

  it('uses titleZh over title when both present (FEED-11)', () => {
    const html = renderToString(<FeedCard item={feedItem11} />);
    // Chinese titleZh is shown inside the <h3>
    expect(html).toContain('Gemini 2.0 Flash 正式发布');
    // The English-only title string should NOT appear as the rendered heading content
    // (the Link inside h3 renders titleZh, not the raw English title)
    expect(html).not.toContain('>Gemini 2.0 Flash Launch<');
  });
});

describe('Timeline', () => {
  it('renders items in groups', () => {
    const html = renderToString(<Timeline items={[fullItem, minimalItem]} />);
    expect(html).toContain('条');
  });

  it('renders day and hour labels', () => {
    const html = renderToString(
      <Timeline items={[fullItem]} now={new Date('2026-04-20T12:00:00Z')} />,
    );
    // Should have a time label (HH:00 format)
    expect(html).toMatch(/\d{2}:00/);
  });

  it('renders FeedCard titles within Timeline', () => {
    const html = renderToString(<Timeline items={[fullItem]} />);
    expect(html).toContain('Claude 3.5 Sonnet 发布');
  });
});
