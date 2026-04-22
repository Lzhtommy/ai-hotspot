'use client';

/**
 * Cluster expand/collapse section — Phase 4 FEED-03, D-17 steps 6+7.
 *
 * Small Client Component that owns the expanded state for the cluster trigger + sibling list.
 * Rendered by the RSC FeedCard outer; the client boundary is minimal — only this component
 * re-renders on toggle, not the entire card.
 *
 * Consumed by:
 *   - src/components/feed/feed-card.tsx
 */

import { useState } from 'react';
import { ClusterTrigger } from './cluster-trigger';
import { ClusterSiblings } from './cluster-siblings';
import type { FeedListItem } from '@/lib/feed/get-feed';

interface ClusterSectionProps {
  clusterId: string;
  memberCount: number;
  siblings?: FeedListItem[];
}

/**
 * Renders the cluster trigger button and, when expanded, the siblings list.
 * Only this component is a Client Component — FeedCard outer stays RSC.
 */
export function ClusterSection({ clusterId, memberCount, siblings }: ClusterSectionProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <>
      <ClusterTrigger
        clusterId={clusterId}
        memberCount={memberCount}
        expanded={expanded}
        onToggle={() => setExpanded((e) => !e)}
      />
      {expanded && siblings && siblings.length > 0 && (
        <ClusterSiblings clusterId={clusterId} siblings={siblings} />
      )}
    </>
  );
}
