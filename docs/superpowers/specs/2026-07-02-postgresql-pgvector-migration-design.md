# PostgreSQL + pgvector 전환 설계

> 작성일: 2026-07-02  
> 선행 작업: SQLite DB hardening (인덱스, lifecycle, status 전이, export 정합성)  
> 목표: 조직(팀) 기능·프로덕션 배포 전 SQLite → PostgreSQL + pgvector 이전

## 1. 전환 배경

| 항목 | SQLite (현재) | PostgreSQL + pgvector (목표) |
|------|---------------|------------------------------|
| 동시 쓰기 | 단일 writer | 다중 연결·팀 동시 사용 |
| 벡터 검색 | JSON + 앱 메모리 full scan | HNSW/IVFFlat 인덱스 |
| RLS | 없음 | Supabase/Neon RLS로 팀 격리 |
| JSON 검증 | 앱(Zod)만 | `jsonb` + CHECK |
| 백업·복제 | 파일 복사 | 관리형 PG 스냅샷 |

현재 `DocumentChunk.embedding`은 `TEXT`(JSON number[])이며, `retrieveRelevantChunks`가 Pack/팀 전체 청크를 읽어 코사인 유사도를 계산합니다. 문서·청크가 늘면 병목이 되므로 **pgvector 전환은 조직 기능보다 먼저** 설계·검증합니다.

## 2. 타깃 아키텍처

```
┌─────────────────────────────────────────────────────────┐
│  Next.js (Vercel Fluid Compute)                          │
│  Prisma Client ──► PostgreSQL (Neon / Supabase / RDS)   │
│                    ├── pgvector extension               │
│                    ├── RLS (team_id 기반)               │
│                    └── Connection pooler (PgBouncer)      │
└─────────────────────────────────────────────────────────┘
```

### 환경 분리

| 환경 | DB | 비고 |
|------|-----|------|
| local dev | SQLite **또는** Docker PG | 빠른 루프는 SQLite 유지 가능 |
| preview/staging | Neon branch / Supabase preview | pgvector 필수 |
| production | Neon / Supabase Pro | RLS + 백업 |

## 3. 스키마 변경 (PostgreSQL)

### 3.1 datasource 전환

```prisma
datasource db {
  provider   = "postgresql"
  url        = env("DATABASE_URL")
  extensions = [pgvector(map: "vector", schema: "extensions")]
}
```

Prisma 7에서는 `prisma migrate` 전에 DB에 `CREATE EXTENSION vector` 실행이 필요합니다 (Supabase/Neon은 대시보드 또는 SQL로 활성화).

### 3.2 임베딩 컬럼

**현재 (SQLite)**

```prisma
embedding String // JSON: number[]
```

**목표 (PostgreSQL)**

```prisma
/// 1024-dim BGE-m3-ko
embedding Unsupported("vector(1024)")
```

앱 코드는 `prisma.$queryRaw` 또는 전용 `VectorSearchRepository`로 검색:

```sql
SELECT id, text, chunk_index,
       1 - (embedding <=> $1::vector) AS score
FROM "DocumentChunk"
WHERE "contextPackId" = $2
ORDER BY embedding <=> $1::vector
LIMIT 5;
```

`<=>`는 cosine distance (pgvector). 인덱스:

```sql
CREATE INDEX document_chunk_embedding_hnsw_idx
  ON "DocumentChunk"
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);
```

`OrgDocumentChunk`에도 동일 패턴 적용. 팀 단위 검색 시 `teamId` 필터 + `orgDocumentId` 인덱스 병용.

### 3.3 JSON → jsonb

| 테이블 | 컬럼 | PostgreSQL 타입 |
|--------|------|-----------------|
| ContextPack | pillars, objections, riskFlags, researchResult | `Json` → `jsonb` |
| (유지) | roofMessage, foundation 등 단일 텍스트 | `TEXT` |

`jsonb` 이점: GIN 인덱스(필요 시), `@>` containment 쿼리, DB 레벨 `jsonb_typeof` CHECK.

### 3.4 lifecycle·status (이미 SQLite에 반영)

PostgreSQL 이전 시 그대로 유지:

- `analyzedAt`, `generatedAt`, `confirmedAt`
- `researchStatus` enum
- `@@index([status, updatedAt])`, `@@index([updatedAt])`
- `DocumentChunk.contextPackId` (비정규화)

### 3.5 팀 격리 (RLS 스케치)

조직 기능 활성화 시 Supabase RLS 예시:

```sql
ALTER TABLE "ContextPack" ENABLE ROW LEVEL SECURITY;

CREATE POLICY context_pack_team_select ON "ContextPack"
  FOR SELECT USING (
    "teamId" IS NULL
    OR "teamId" IN (
      SELECT "teamId" FROM "TeamMember"
      WHERE "userId" = auth.uid()::text
    )
  );
```

Prisma + RLS: `auth.uid()`는 Supabase Auth 연동 시. 자체 세션(`Session` 테이블)이면 API 레이어에서 `teamId` 필터를 유지하고 RLS는 2단계로 도입.

## 4. 마이그레이션 절차

### Phase 0 — 준비 (현재)

- [x] SQLite: lifecycle, researchStatus, 인덱스, contextPackId
- [x] status 전이 규칙 (`contextPackStatus.ts`)
- [x] export 정합성 (foundation, aieoSummary)
- [x] `VectorSearch` 인터페이스 + Sqlite/Pg 구현 (`src/lib/embedding/vectorSearch/`)
- [x] `scripts/migrate-sqlite-to-pg.ts` + `docker-compose.yml`
- [ ] CI에 PostgreSQL 서비스 컨테이너 + pgvector 스모크 테스트

### Phase 1 — 듀얼 스키마 개발

- [x] `prisma/schema.postgresql.prisma`
- [x] `src/lib/db.ts` — SQLite / PostgreSQL 분기
- [x] `VECTOR_BACKEND` 환경변수

### Phase 2 — 데이터 이전

- [x] `scripts/migrate-sqlite-to-pg.ts` (`npm run db:pg:migrate`)

1. SQLite `dev.db` → 앱 레벨 export/import 스크립트:

```bash
docker compose up -d
SQLITE_URL="file:./dev.db" \
TARGET_DATABASE_URL="postgresql://messagehouse:messagehouse@localhost:5433/messagehouse" \
npm run db:pg:migrate
```

스크립트 순서:

1. Team, User, TeamMember, Session
2. ContextPack (lifecycle 컬럼 포함)
3. SourceFile
4. DocumentChunk — embedding JSON → `vector(1024)` cast
5. OrgDocument, OrgDocumentChunk

3. 청크 embedding 변환:

```typescript
const vec = JSON.parse(chunk.embedding) as number[];
await prisma.$executeRaw`
  INSERT INTO "DocumentChunk" (..., embedding)
  VALUES (..., ${`[${vec.join(",")}]`}::vector)
`;
```

### Phase 3 — 검색 경로 스왑

- [x] `retrieveRelevantChunks` → `getVectorSearch()` 사용
- [x] feature flag: `VECTOR_BACKEND=sqlite|pgvector`
- [x] 동일 쿼리로 Top-K 결과 diff 테스트 (`npm run test:rag-regression`)

### Phase 4 — 프로덕션 컷오버

1. Staging에서 전체 E2E (업로드 → 분석 → 생성 → 확정 → export)
2. Maintenance window 또는 read-only → import → DNS/ENV 전환
3. SQLite `DATABASE_URL` 제거, `directUrl` + pooler URL 분리 (Neon)

## 5. 환경변수

| 변수 | 설명 |
|------|------|
| `DATABASE_URL` | Pooler URL (`?pgbouncer=true`) |
| `DIRECT_DATABASE_URL` | 마이그레이션용 direct 연결 |
| `VECTOR_BACKEND` | `sqlite` \| `pgvector` |
| `EMBEDDING_PROVIDER` | 기존과 동일 |

## 6. 성능 목표

| 시나리오 | SQLite (현재) | pgvector 목표 |
|----------|---------------|---------------|
| Pack 500청크 Top-5 | ~50–200ms (full scan) | <20ms (HNSW) |
| 팀 Org 라이브러리 10k청크 | 수 초 | <50ms |
| 홈 Pack 목록 1k rows | 인덱스 후 <10ms | <10ms |

## 7. 리스크·완화

| 리스크 | 완화 |
|--------|------|
| Prisma `Unsupported("vector")` 쓰기 불편 | create/update는 raw SQL 또는 `Prisma.$executeRaw` |
| 임베딩 차원 불일치 | `EMBEDDING_DIMENSIONS=1024` 상수 + DB CHECK |
| 모델 변경 시 재임베딩 | `model` 컬럼 + 배치 job `indexingStatus` |
| RLS + Prisma | service role vs anon key 분리, API는 service role |

## 8. 범위 밖 (후속)

- 메시지하우스 `MessageHouseRevision` 스냅샷 테이블
- 원본 파일 Blob Storage 분리
- 하이브리드 sparse+dense (BGE-M3 full)
- Cross-region read replica

## 9. 다음 액션 체크리스트

1. ~~`scripts/migrate-sqlite-to-pg.ts` 스캐폴드~~ ✅
2. ~~`src/lib/embedding/vectorSearch/` — Sqlite + Pg 구현~~ ✅
3. ~~Docker Compose `pgvector/pgvector:pg16` 로컬 스택~~ ✅ (`docker-compose.yml`)
4. GitHub Actions: PG 서비스 + `prisma migrate deploy` + RAG 스모크 테스트
5. Staging Neon 프로젝트 생성 + `DATABASE_URL` preview 환경변수

---

**관련 문서**

- `docs/superpowers/specs/2026-07-02-rag-vector-search-design.md` — RAG F-04
- `prisma/schema.prisma` — 현재 SQLite SSOT
- `src/lib/contextPackStatus.ts` — status 전이 규칙
