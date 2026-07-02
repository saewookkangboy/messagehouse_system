-- prisma db push (schema.postgresql.prisma) 이후 실행
-- JSON TEXT 임베딩 → vector(1024) + HNSW 인덱스

ALTER TABLE "DocumentChunk"
  ALTER COLUMN "embedding" TYPE vector(1024)
  USING "embedding"::vector;

ALTER TABLE "OrgDocumentChunk"
  ALTER COLUMN "embedding" TYPE vector(1024)
  USING "embedding"::vector;

CREATE INDEX IF NOT EXISTS "DocumentChunk_embedding_hnsw_idx"
  ON "DocumentChunk"
  USING hnsw ("embedding" vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

CREATE INDEX IF NOT EXISTS "OrgDocumentChunk_embedding_hnsw_idx"
  ON "OrgDocumentChunk"
  USING hnsw ("embedding" vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);
