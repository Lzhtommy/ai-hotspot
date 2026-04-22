/**
 * Phase 4 verification harness — asserts FEED-08 + FEED-09 programmatically.
 *
 * Run: pnpm verify:feed
 *
 * Expects:
 *   - `pnpm build` has been run (reads .next/ output for FEED-08 static scan)
 *   - The dev server is up at TEST_BASE_URL (default http://localhost:3000)
 *
 * Exits 0 on all PASS, 1 on any FAIL.
 *
 * Consumed by:
 *   - CI / human UAT for Phase 4 validation
 */
import 'dotenv/config';
import { config } from 'dotenv';
config({ path: '.env.local' });

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { db } from '../src/lib/db/client';
import { items } from '../src/lib/db/schema';
import { eq } from 'drizzle-orm';

const BASE = process.env.TEST_BASE_URL ?? 'http://localhost:3000';

function log(ok: boolean, label: string, detail?: string) {
  const tag = ok ? 'PASS' : 'FAIL';
  console.log(`[${tag}] ${label}${detail ? ' — ' + detail : ''}`);
}

function walk(dir: string, out: string[] = []): string[] {
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const entry of entries) {
    const p = join(dir, entry);
    let s;
    try {
      s = statSync(p);
    } catch {
      continue;
    }
    if (s.isDirectory()) walk(p, out);
    else if (/\.(js|html|css|json)$/.test(entry)) out.push(p);
  }
  return out;
}

async function assertFeed08(): Promise<boolean> {
  // Part 1: Static grep of .next/ output — must not contain fonts.googleapis.com or fonts.gstatic.com
  let staticOk = false;
  try {
    const files = walk('.next');
    if (files.length === 0) {
      log(
        false,
        'FEED-08 build-output scan',
        '.next directory not found or empty — run `pnpm build` first',
      );
      return false;
    }
    const violating: string[] = [];
    for (const f of files) {
      let body: string;
      try {
        body = readFileSync(f, 'utf8');
      } catch {
        continue;
      }
      if (/fonts\.googleapis\.com|fonts\.gstatic\.com/.test(body)) violating.push(f);
    }
    staticOk = violating.length === 0;
    log(
      staticOk,
      'FEED-08 build-output free of Google Fonts URLs',
      staticOk
        ? `${files.length} files scanned`
        : `violations in: ${violating.slice(0, 3).join(', ')}${violating.length > 3 ? ` (+${violating.length - 3} more)` : ''}`,
    );
  } catch (e) {
    log(false, 'FEED-08 scan failed', e instanceof Error ? e.message : 'unknown error');
    return false;
  }

  // Part 2: Runtime fetch of /, /all, /items/<id> — assert response bodies contain no fonts.*.com URLs
  let runtimeOk = true;
  try {
    const paths: string[] = ['/', '/all'];
    const rows = await db
      .select({ id: items.id })
      .from(items)
      .where(eq(items.status, 'published'))
      .limit(1);
    if (rows[0]) paths.push(`/items/${String(rows[0].id)}`);

    for (const path of paths) {
      const res = await fetch(`${BASE}${path}`);
      const body = await res.text();
      const bad = /fonts\.googleapis\.com|fonts\.gstatic\.com/.test(body);
      log(!bad, `FEED-08 runtime ${path} free of Google Fonts URLs`);
      if (bad) runtimeOk = false;
    }
  } catch (e) {
    log(
      false,
      'FEED-08 runtime check failed',
      e instanceof Error ? e.name + ': ' + e.message : 'unknown error',
    );
    runtimeOk = false;
  }

  return staticOk && runtimeOk;
}

async function assertFeed09(): Promise<boolean> {
  const rows = await db
    .select({ id: items.id })
    .from(items)
    .where(eq(items.status, 'published'))
    .limit(1);

  if (rows.length === 0) {
    log(false, 'FEED-09 no published item to test against');
    return false;
  }

  const id = String(rows[0].id);

  let res: Response;
  try {
    res = await fetch(`${BASE}/items/${id}`);
  } catch (e) {
    log(
      false,
      'FEED-09 fetch failed',
      e instanceof Error ? e.name + ': ' + e.message : 'unknown error',
    );
    return false;
  }

  const html = await res.text();
  const checks: Record<string, boolean> = {
    'og:title': /<meta[^>]+property="og:title"[^>]+content="[^"]+"/.test(html),
    'og:description': /<meta[^>]+property="og:description"[^>]+content="[^"]*"/.test(html),
    'og:image absolute': /<meta[^>]+property="og:image"[^>]+content="https?:\/\/[^"]+"/.test(html),
    'og:url absolute': /<meta[^>]+property="og:url"[^>]+content="https?:\/\/[^"]+"/.test(html),
  };

  const allOk = Object.values(checks).every(Boolean);
  for (const [k, v] of Object.entries(checks)) log(v, `FEED-09 ${k}`);

  if (allOk) {
    console.log(`\n[VERIFIED] FEED-08 + FEED-09 assertions complete for item id=${id}`);
  }
  return allOk;
}

async function main(): Promise<boolean> {
  console.log(`\n=== Phase 4 Feed UI Verification ===`);
  console.log(`Base URL: ${BASE}\n`);

  const f08 = await assertFeed08();
  console.log('');
  const f09 = await assertFeed09();

  const allOk = f08 && f09;
  console.log(`\n=== Result: ${allOk ? 'PASS' : 'FAIL'} ===\n`);
  return allOk;
}

main()
  .then((ok) => {
    process.exit(ok ? 0 : 1);
  })
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
