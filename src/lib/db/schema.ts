// src/lib/db/schema.ts
// Source: ARCHITECTURE.md schema sketch + REQUIREMENTS.md column inference
// All 11 tables per D-09 (INFRA-03). pgvector 1024-dim per D-10 (Voyage voyage-3.5).
import {
  pgTable,
  serial,
  bigserial,
  bigint,
  text,
  boolean,
  integer,
  smallint,
  numeric,
  timestamp,
  uuid,
  primaryKey,
  index,
  vector,
} from 'drizzle-orm/pg-core';

// SOURCES — RSSHub routes or raw RSS URLs
export const sources = pgTable('sources', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  rssUrl: text('rss_url').notNull().unique(),
  language: text('language').notNull().default('zh'), // 'zh' | 'en'
  weight: numeric('weight', { precision: 3, scale: 1 }).notNull().default('1.0'),
  isActive: boolean('is_active').notNull().default(true),
  consecutiveEmptyCount: integer('consecutive_empty_count').notNull().default(0),
  consecutiveErrorCount: integer('consecutive_error_count').notNull().default(0),
  lastFetchedAt: timestamp('last_fetched_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  // Phase 6 — admin + ops
  deletedAt: timestamp('deleted_at', { withTimezone: true }), // ADMIN-05 soft-delete
  category: text('category'), // ADMIN-03: 'lab' | 'social' | 'forum' | 'cn_media' | 'other' (free-form in v1; UI-enforced)
});

// ITEMS — one row per ingested RSS entry
export const items = pgTable(
  'items',
  {
    id: bigserial('id', { mode: 'bigint' }).primaryKey(),
    sourceId: integer('source_id')
      .notNull()
      .references(() => sources.id),
    url: text('url').notNull().unique(),
    urlFingerprint: text('url_fingerprint').notNull().unique(), // SHA-256(normalized url)
    contentHash: text('content_hash').notNull(), // SHA-256(url + title) for dedup
    title: text('title').notNull(),
    titleZh: text('title_zh'),
    bodyRaw: text('body_raw'),
    bodyZh: text('body_zh'),
    summaryZh: text('summary_zh'),
    recommendation: text('recommendation'), // 推荐理由
    score: integer('score'), // 0-100
    tags: text('tags').array(),
    embedding: vector('embedding', { dimensions: 1024 }), // Voyage voyage-3.5
    clusterId: bigint('cluster_id', { mode: 'bigint' }), // FK set after clusters defined
    isClusterPrimary: boolean('is_cluster_primary').notNull().default(false),
    status: text('status').notNull().default('pending'), // pending|processing|published|failed|dead_letter
    publishedAt: timestamp('published_at', { withTimezone: true }).notNull(),
    publishedAtSourceTz: text('published_at_source_tz'), // D-11: nullable RFC3339 string preserving source offset (e.g., "2026-04-20T09:00:00+08:00"). Some RSS entries have no tz info — then NULL.
    ingestedAt: timestamp('ingested_at', { withTimezone: true }).notNull().defaultNow(),
    processedAt: timestamp('processed_at', { withTimezone: true }),
    failureReason: text('failure_reason'),
    retryCount: integer('retry_count').notNull().default(0),
  },
  (table) => ({
    statusPublishedIdx: index('items_status_published_at_idx').on(
      table.status,
      table.publishedAt.desc(),
    ),
    clusterIdx: index('items_cluster_id_idx').on(table.clusterId),
    sourceIdx: index('items_source_id_idx').on(table.sourceId),
    tagsIdx: index('items_tags_idx').using('gin', table.tags),
  }),
);

// CLUSTERS — one row per grouped event
export const clusters = pgTable('clusters', {
  id: bigserial('id', { mode: 'bigint' }).primaryKey(),
  primaryItemId: bigint('primary_item_id', { mode: 'bigint' }),
  centroid: vector('centroid', { dimensions: 1024 }),
  memberCount: integer('member_count').notNull().default(1),
  earliestSeenAt: timestamp('earliest_seen_at', { withTimezone: true }).notNull().defaultNow(),
  latestSeenAt: timestamp('latest_seen_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// ITEM_CLUSTERS — join table (allows many-to-many if needed later; v1: items.cluster_id suffices)
export const itemClusters = pgTable(
  'item_clusters',
  {
    itemId: bigint('item_id', { mode: 'bigint' })
      .notNull()
      .references(() => items.id, { onDelete: 'cascade' }),
    clusterId: bigint('cluster_id', { mode: 'bigint' })
      .notNull()
      .references(() => clusters.id, { onDelete: 'cascade' }),
    addedAt: timestamp('added_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.itemId, table.clusterId] }),
  }),
);

// TAGS — canonical tag taxonomy
export const tags = pgTable('tags', {
  id: serial('id').primaryKey(),
  name: text('name').notNull().unique(),
  nameZh: text('name_zh'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// ITEM_TAGS — normalized tag assignments
export const itemTags = pgTable(
  'item_tags',
  {
    itemId: bigint('item_id', { mode: 'bigint' })
      .notNull()
      .references(() => items.id, { onDelete: 'cascade' }),
    tagId: integer('tag_id')
      .notNull()
      .references(() => tags.id, { onDelete: 'cascade' }),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.itemId, table.tagId] }),
  }),
);

// USERS
export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull().unique(),
  name: text('name'),
  // Phase 5 D-02 — Auth.js adapter columns (nullable; filled by OAuth / magic-link flows)
  emailVerified: timestamp('email_verified', { withTimezone: true }),
  image: text('image'),
  avatarUrl: text('avatar_url'),
  role: text('role').notNull().default('user'), // 'user' | 'admin'
  isBanned: boolean('is_banned').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  lastSeenAt: timestamp('last_seen_at', { withTimezone: true }),
  // Phase 6 — ADMIN-08 ban audit trail
  bannedAt: timestamp('banned_at', { withTimezone: true }),
  bannedBy: uuid('banned_by'), // FK to users.id — self-referencing; declared as plain uuid to avoid TS circularity; FK enforced in SQL migration (users_banned_by_fk, ON DELETE SET NULL)
});

// FAVORITES
export const favorites = pgTable(
  'favorites',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    itemId: bigint('item_id', { mode: 'bigint' })
      .notNull()
      .references(() => items.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.userId, table.itemId] }),
  }),
);

// VOTES
export const votes = pgTable(
  'votes',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    itemId: bigint('item_id', { mode: 'bigint' })
      .notNull()
      .references(() => items.id, { onDelete: 'cascade' }),
    value: smallint('value').notNull(), // -1 | 1
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.userId, table.itemId] }),
  }),
);

// SETTINGS — admin-tunable config rows
export const settings = pgTable('settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// PIPELINE_RUNS — LLM token usage audit trail per item per run
export const pipelineRuns = pgTable(
  'pipeline_runs',
  {
    id: bigserial('id', { mode: 'bigint' }).primaryKey(),
    itemId: bigint('item_id', { mode: 'bigint' }).references(() => items.id, {
      onDelete: 'set null',
    }),
    model: text('model').notNull(),
    task: text('task').notNull(), // 'translate' | 'score' | 'summarize' | 'embed' | 'cluster'
    inputTokens: integer('input_tokens'),
    outputTokens: integer('output_tokens'),
    cacheReadTokens: integer('cache_read_tokens'),
    cacheWriteTokens: integer('cache_write_tokens'),
    estimatedCostUsd: numeric('estimated_cost_usd', { precision: 10, scale: 6 }),
    latencyMs: integer('latency_ms'),
    status: text('status').notNull(), // 'ok' | 'error'
    errorMessage: text('error_message'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    itemIdx: index('pipeline_runs_item_id_idx').on(table.itemId),
    dateIdx: index('pipeline_runs_created_at_idx').on(table.createdAt.desc()),
  }),
);

// Phase 5 — Auth.js v5 adapter tables (D-01).
// Column names MUST stay camelCase in SQL (quoted identifiers) — @auth/drizzle-adapter
// reads/writes "userId", "providerAccountId", "sessionToken" verbatim. This is the ONE
// place the project departs from snake_case SQL convention.
// FKs are uuid → uuid to match existing users.id (RESEARCH §Pitfall 2).
export const accounts = pgTable(
  'accounts',
  {
    userId: uuid('userId')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    type: text('type').notNull(),
    provider: text('provider').notNull(),
    providerAccountId: text('providerAccountId').notNull(),
    refresh_token: text('refresh_token'),
    access_token: text('access_token'),
    expires_at: integer('expires_at'),
    token_type: text('token_type'),
    scope: text('scope'),
    id_token: text('id_token'),
    session_state: text('session_state'),
  },
  (t) => ({ pk: primaryKey({ columns: [t.provider, t.providerAccountId] }) }),
);

export const sessions = pgTable('sessions', {
  sessionToken: text('sessionToken').primaryKey(),
  userId: uuid('userId')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  expires: timestamp('expires', { withTimezone: true, mode: 'date' }).notNull(),
});

export const verificationTokens = pgTable(
  'verification_tokens',
  {
    identifier: text('identifier').notNull(),
    token: text('token').notNull(),
    expires: timestamp('expires', { withTimezone: true, mode: 'date' }).notNull(),
  },
  (t) => ({ pk: primaryKey({ columns: [t.identifier, t.token] }) }),
);
