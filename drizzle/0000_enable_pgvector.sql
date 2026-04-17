-- Enable pgvector extension for the Voyage voyage-3.5 1024-dim embedding column.
-- Must run before 0001_initial_schema.sql because items.embedding = vector(1024).
-- Source: D-10 / RESEARCH.md §Pattern 4 / neon.com/docs/extensions/pgvector
CREATE EXTENSION IF NOT EXISTS vector;
