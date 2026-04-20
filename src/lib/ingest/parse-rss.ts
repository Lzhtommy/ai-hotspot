/**
 * RSS/Atom parser wrapper — Phase 2 D-15, D-21.
 *
 * Consumes a fetch Response (returned by fetchRSSHub) and yields normalized
 * RssEntry[] for downstream fingerprinting + insert. Prefers content:encoded
 * over description (D-15). Truncates bodyRaw at 50_000 chars with
 * `<!-- truncated -->` sentinel.
 *
 * Parser: rss-parser 3.x (chosen per D-21 — see 02-02-PLAN.md <research_findings>).
 *
 * Pure: no outbound fetch. Takes a received Response, reads its body text, and
 * parses in-memory. All I/O ownership stays with the caller (fetchRSSHub).
 *
 * Consumed by:
 *   - src/trigger/fetch-source.ts (Plan 03)
 */
import Parser from 'rss-parser';
import type { RssEntry } from './types';

export class RSSParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RSSParseError';
  }
}

const BODY_MAX = 50_000;
const TRUNCATION_SENTINEL = '<!-- truncated -->';

// rss-parser options: expose content:encoded explicitly so we can prefer it
// over description (D-15). The remap writes the value to item.contentEncoded.
type CustomItem = {
  contentEncoded?: string;
};

const parser: Parser<Record<string, never>, CustomItem> = new Parser({
  customFields: {
    item: [['content:encoded', 'contentEncoded']],
  },
});

function truncate(body: string): string {
  if (body.length <= BODY_MAX) return body;
  return body.slice(0, BODY_MAX - TRUNCATION_SENTINEL.length) + TRUNCATION_SENTINEL;
}

/**
 * Extract the source-local offset as an RFC3339 string. Returns null when the
 * raw pubDate has no detectable offset / named zone, or when parsing fails.
 *
 * rss-parser normalizes item.isoDate to UTC (losing the original offset), so
 * we re-derive a source-tz string from the raw pubDate ourselves:
 *   - "Z" / "GMT" / "UTC" → emit the UTC ISO string ending in "Z"
 *   - "+HHMM" / "-HHMM" / "+HH:MM" → emit an ISO8601 string preserving the
 *     original offset (e.g. "2026-04-20T09:00:00+08:00")
 *   - Named zones (e.g., "EST", "PST") → null (ambiguous, not worth mapping in v1)
 */
function sourceTzString(rawPubDate: string | undefined): string | null {
  if (!rawPubDate) return null;

  const offsetMatch = rawPubDate.match(/([+-]\d{2}:?\d{2}|Z|GMT|UTC)/);
  if (!offsetMatch) return null;

  const d = new Date(rawPubDate);
  if (Number.isNaN(d.getTime())) return null;

  const offsetText = offsetMatch[1];
  if (offsetText === 'Z' || offsetText === 'GMT' || offsetText === 'UTC') {
    return d.toISOString(); // "...Z"
  }

  // Normalize "+0800" → "+08:00"; leave "+08:00" untouched.
  const normalizedOffset = offsetText.includes(':')
    ? offsetText
    : `${offsetText.slice(0, 3)}:${offsetText.slice(3)}`;

  // Compute the local-wall-clock representation by shifting the UTC instant by
  // the original offset, then format as "YYYY-MM-DDTHH:MM:SS{offset}".
  const sign = normalizedOffset.startsWith('-') ? -1 : 1;
  const offsetMinutes =
    sign *
    (parseInt(normalizedOffset.slice(1, 3), 10) * 60 +
      parseInt(normalizedOffset.slice(4, 6), 10));
  const local = new Date(d.getTime() + offsetMinutes * 60_000);
  const iso = local.toISOString().slice(0, 19); // "YYYY-MM-DDTHH:MM:SS"
  return `${iso}${normalizedOffset}`;
}

export async function parseRSS(res: Response): Promise<RssEntry[]> {
  const xml = await res.text();
  let feed;
  try {
    feed = await parser.parseString(xml);
  } catch (err) {
    throw new RSSParseError(
      `RSS parse failed: ${err instanceof Error ? err.message.slice(0, 200) : 'unknown'}`,
    );
  }

  const now = new Date();
  const entries: RssEntry[] = [];

  for (const item of feed.items ?? []) {
    const url = item.link ?? '';
    const title = item.title ?? '';
    if (!url || !title) continue; // skip malformed entries

    // Prefer content:encoded → Atom content → contentSnippet → description (D-15).
    const body =
      item.contentEncoded ??
      item.content ?? // Atom <content>, rss-parser surfaces this directly
      item.contentSnippet ??
      (item as unknown as { description?: string }).description ??
      '';

    // Timestamps
    let publishedAtUtc: Date;
    let publishedAtSourceTz: string | null;
    const raw = item.pubDate ?? item.isoDate;
    if (raw) {
      const d = new Date(raw);
      if (Number.isNaN(d.getTime())) {
        publishedAtUtc = now;
        publishedAtSourceTz = null;
      } else {
        publishedAtUtc = d;
        publishedAtSourceTz = sourceTzString(item.pubDate);
        // Atom feeds come through with only isoDate; preserve UTC "Z" in that case
        if (publishedAtSourceTz === null && item.isoDate) {
          publishedAtSourceTz = new Date(item.isoDate).toISOString();
        }
      }
    } else {
      publishedAtUtc = now;
      publishedAtSourceTz = null;
    }

    entries.push({
      url,
      title,
      publishedAtUtc,
      publishedAtSourceTz,
      bodyRaw: truncate(body),
    });
  }

  return entries;
}
