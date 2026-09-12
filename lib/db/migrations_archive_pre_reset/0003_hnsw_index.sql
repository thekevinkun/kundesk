-- Add HNSW index on the chunks embedding column for fast cosine similarity search.
-- This replaces the sequential scan that happens with no index.
-- vector_cosine_ops tells pgvector to use cosine distance (<=>) for this index.
-- ef_construction=128 controls build quality — higher = better recall, slower build.
-- m=16 controls graph connectivity — 16 is the recommended default.
CREATE INDEX IF NOT EXISTS chunks_embedding_idx
  ON chunks
  USING hnsw ((embedding::vector(1536)) vector_cosine_ops)
  WITH (m = 16, ef_construction = 128);