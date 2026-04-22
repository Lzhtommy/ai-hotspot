/**
 * Canary source seed — Phase 2 D-18, D-19, D-20.
 *
 * Populates the `sources` table with 3 known-working RSSHub routes so the
 * ingestion cron (src/trigger/ingest-hourly.ts) has real data to poll.
 *
 * Idempotent: ON CONFLICT (rss_url) DO NOTHING — re-running is a no-op.
 * Not invoked by CI. Run manually via `pnpm db:seed` against a dev/preview Neon branch.
 *
 * Admin UI for full source CRUD is Phase 6 (ADMIN-02..06).
 *
 * Run: `pnpm db:seed`
 */
import 'dotenv/config';
import { config } from 'dotenv';
config({ path: '.env.local' });

import { db } from '../src/lib/db/client';
import { sources } from '../src/lib/db/schema';

interface SeedRow {
  name: string;
  rssUrl: string;
  language: 'zh' | 'en';
  weight: string; // numeric column — Drizzle takes it as string
}

// D-18: 3 canary routes. Routes are RSSHub paths (no base URL, no access key).
// fetchRSSHub() prepends RSSHUB_BASE_URL and appends ?key=... at request time.
const SEEDS: SeedRow[] = [
  { name: 'Anthropic Blog', rssUrl: '/anthropic/news', language: 'en', weight: '1.0' },
  { name: 'Hacker News AI', rssUrl: '/hackernews/newest/ai', language: 'en', weight: '0.8' },
  { name: 'buzzing.cc', rssUrl: '/buzzing/whatsnew', language: 'zh', weight: '1.0' },
];

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL not set — .env.local should provide the Neon dev branch URL.');
  }

  let attempted = 0;
  for (const s of SEEDS) {
    await db
      .insert(sources)
      .values({
        name: s.name,
        rssUrl: s.rssUrl,
        language: s.language,
        weight: s.weight,
        // is_active defaults to true; counters default to 0; created_at defaults to now()
      })
      .onConflictDoNothing({ target: sources.rssUrl });
    attempted += 1;
  }

  // Report post-seed state.
  const rows = await db
    .select({ id: sources.id, name: sources.name, rssUrl: sources.rssUrl })
    .from(sources);
  console.log(`Seeded ${attempted} rows (idempotent). Total sources now: ${rows.length}.`);
  for (const r of rows) console.log(`  #${r.id}  ${r.name}  ${r.rssUrl}`);
}

main().catch((e) => {
  console.error('SEED FAILED:', e);
  process.exit(1);
});
