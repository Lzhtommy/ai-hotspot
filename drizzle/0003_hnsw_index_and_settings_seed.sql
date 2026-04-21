-- Phase 3 migration — adds HNSW index on items.embedding (CLUST-02) and seeds
-- the cluster threshold setting (CLUST-04).
-- Hand-authored (not drizzle-kit generated) because Drizzle's index DSL does not
-- yet emit HNSW + vector_cosine_ops + WITH (m, ef_construction). Mirrors the
-- precedent in 0000_enable_pgvector.sql.
-- Source: 03-RESEARCH.md §Pattern 2 + §Pitfall 5, neon.com/docs/extensions/pgvector

CREATE INDEX IF NOT EXISTS items_embedding_hnsw_idx
  ON items USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

INSERT INTO settings (key, value)
VALUES ('cluster_threshold', '0.82')
ON CONFLICT (key) DO NOTHING;
