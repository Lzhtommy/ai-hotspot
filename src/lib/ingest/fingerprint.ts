/**
 * SHA-256 fingerprints for item dedup — Phase 2 D-05, D-07.
 *
 * urlFingerprint: primary dedup signal, populates items.url_fingerprint UNIQUE.
 * contentHash: secondary signal, populates items.content_hash (not UNIQUE; consumed by Phase 3).
 *
 * Pure — no I/O. UTF-8 byte encoding. Hex output matches PostgreSQL's
 * `encode(digest(..., 'sha256'), 'hex')`.
 *
 * Consumed by:
 *   - src/trigger/fetch-source.ts (Plan 03)
 */
import { createHash } from 'node:crypto';

export function urlFingerprint(normalizedUrl: string): string {
  return createHash('sha256').update(normalizedUrl, 'utf8').digest('hex');
}

export function contentHash(normalizedUrl: string, title: string): string {
  return createHash('sha256').update(`${normalizedUrl}\n${title}`, 'utf8').digest('hex');
}
