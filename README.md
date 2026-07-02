# 메시지하우스 Context Builder — 앱

PRD v0.2의 핵심 파이프라인(파일 업로드 → RAG 분석 → 메시지하우스 자동 구성 → 검토·확정 → 보내기)을 실제로 동작하게 구현한 Next.js 앱이에요. `MessageHouse_ContextBuilder_소스코드`가 정적 클릭형 목업이라면, 이 앱은 그 워크플로우를 DB·API·AI 프로바이더로 구현한 프로덕션 지향 버전이에요.

## 목차

- [구현 범위 요약](#구현-범위-요약)
- [사용자 워크플로우](#사용자-워크플로우)
- [기술 스택](#기술-스택)
- [시작하기](#시작하기)
- [환경변수](#환경변수-env)
- [데이터베이스](#데이터베이스)
- [인증·팀·권한](#인증팀권한)
- [핵심 파이프라인](#핵심-파이프라인)
  - [데이터 파이프라인 다이어그램](#데이터-파이프라인-다이어그램)
- [RAG (검색 증강 생성)](#rag-검색-증강-생성)
- [AI·리서치·임베딩 프로바이더](#ai리서치임베딩-프로바이더)
- [파일 파싱](#파일-파싱)
- [보내기 (Export)](#보내기-export)
- [외부 연동 OAuth 설정](#외부-연동-oauth-설정)
- [API 레퍼런스](#api-레퍼런스)
- [화면·라우트](#화면라우트)
- [데이터 모델](#데이터-모델)
- [프로젝트 구조](#프로젝트-구조)
- [테스트](#테스트)
- [알려진 제약·후속 과제](#알려진-제약후속-과제)

---

## 구현 범위 요약

### 동작하는 기능

| 영역 | 내용 |
|------|------|
| **파일 업로드** | `.txt` / `.md` / `.pdf` / `.docx` / `.hwp` / `.hwpx` → 텍스트 추출 → DB 저장 (원본 바이너리는 저장하지 않음) |
| **문서 분석** | 핵심 주제·주장·수치·용어·독자·리스크 자동 추출. **4,000자 이상** 문서는 BGE-m3-ko RAG 청크 검색 후 분석 |
| **자동 웹 리서치** | Tavily 연동 (키 없으면 Stub 데모 데이터) — 뉴스·업계 트렌드·경쟁사·규제·AIEO 키워드 |
| **RAG 벡터 검색** | 업로드 문서 청크 + **조직 문서 라이브러리** 청크를 메시지하우스 생성 시 주입 |
| **조직 문서 라이브러리** | 팀 공유 문서 업로드·RAG 인덱싱 (`/org-documents`) |
| **팀 권한 / 인증** | 회원가입·로그인·역할(owner/admin/editor/viewer) 기반 API 보호 |
| **팀 초대 링크 + 이메일 발송** | 관리자가 초대 → `/invite/[token]`으로 가입·합류. `RESEND_API_KEY` 있으면 이메일 자동 발송, 없으면 링크 복사 폴백 |
| **메시지하우스 생성** | 지붕·기둥 3개·기반·빈 탄·AIEO·Risk Flags·금지/공식 용어 |
| **검토·수정** | 인라인 편집 + 저장. 확정 후 수정 시 자동으로 `review` 상태로 되돌림 |
| **Human-in-the-Loop 3-flag 게이트** | 서버에서 강제 검증 — 클라이언트 우회해도 게이트 없이는 확정 불가 |
| **Context Pack 라이브러리** | 목록·상태·버전 관리 |
| **보내기** | JSON / Markdown / Claude 프롬프트 + **Notion·Google Drive 저장** (확정 Pack, OAuth) |
| **파이프라인 오케스트레이션** | analyze → research → generate 일괄 실행, SSE 스트리밍 진행률 |
| **영속 저장** | SQLite(기본) 또는 PostgreSQL + pgvector |

### 알려진 후속 과제

- 파일 **암호화 저장**·**30일 자동 삭제** (PRD 보안 요구)
- 한 계정당 **단일 팀** 제한 (현재 구조)
- CSRF 토큰 검증, 로그인/가입/초대 엔드포인트 레이트 리미팅 (아래 리뷰 참고)

기본 상태(`AUTH_DISABLED=true`, API 키 없음)에서는 로그인 없이 **데모 모드**로 전체 플로우를 테스트할 수 있어요. `AUTH_DISABLED=false`로 설정하면 회원가입·로그인이 필수예요.

---

## 사용자 워크플로우

```
라이브러리 (/) 
  → 새 Pack (/packs/new) — 이슈명·업종 입력, 파일 업로드
  → 분석 (/packs/[id]/analysis) — 파일별 분석 결과 + 자동 리서치
  → 검토 (/packs/[id]/review) — 메시지하우스 인라인 편집, 3-flag 게이트, 확정
  → 보내기 (/packs/[id]/export) — JSON / Markdown / Claude 프롬프트 + Notion·Drive 저장
```

파이프라인 단계는 `upload → analyze → research → generate → review → confirm → export` 순서로 정의돼 있어요. 각 단계의 완료·실행 중·실패 상태는 `derivePipelineStatus()`가 Pack 레코드의 타임스탬프·필드·`pipelineRunningStep`·`pipelineError`로부터 계산해요.

---

## 기술 스택

| 계층 | 기술 |
|------|------|
| 프레임워크 | Next.js 16 (App Router), React 19 |
| 언어 | TypeScript 5 |
| ORM / DB | Prisma 7 — SQLite(기본) 또는 PostgreSQL |
| 벡터 검색 | SQLite 인메모리 코사인 / pgvector |
| AI | Claude (Anthropic SDK), Gemini (`@google/genai`), Stub |
| 임베딩 | BGE-m3-ko (Hugging Face), OpenAI text-embedding-3-large, Stub |
| 리서치 | Tavily API, Stub |
| 파일 파싱 | pdf-parse, mammoth (DOCX), kordoc (HWP/HWPX) |
| 검증 | Zod 4 |
| 단위 테스트 | Vitest |
| E2E 테스트 | Playwright |

---

## 시작하기

### 로컬 개발 (SQLite, 기본)

```bash
npm install
cp .env.example .env
npx prisma migrate dev    # 최초 1회 — SQLite DB 생성
npm run dev
```

http://localhost:3000 을 열면 Context Pack 라이브러리가 보여요. **새 Context Pack 시작하기**로 전체 플로우를 진행할 수 있어요.

### PostgreSQL + pgvector (선택)

대용량·프로덕션 환경에서는 pgvector를 쓸 수 있어요.

```bash
npm run db:pg:up          # docker compose로 PostgreSQL 16 + pgvector 기동 (포트 5433)
# .env 에 PostgreSQL URL 설정 (아래 환경변수 참고)
npm run db:pg:migrate     # SQLite → PostgreSQL 데이터 이전 (선택)
npx prisma migrate dev
npm run dev
```

---

## 환경변수 (`.env`)

| 변수 | 설명 |
|------|------|
| `DATABASE_URL` | DB 연결 문자열. 기본 `file:./dev.db` (SQLite). PostgreSQL 예: `postgresql://messagehouse:messagehouse@localhost:5433/messagehouse` |
| `AUTH_DISABLED` | `true`(기본) — 로그인 없이 데모. `false` — 인증 필수 |
| `ANTHROPIC_API_KEY` | Claude API 키. 있으면 실제 AI 분석·생성 |
| `GEMINI_API_KEY` | `ANTHROPIC_API_KEY` 없을 때 대안 |
| `AI_PROVIDER` | `stub` / `claude` / `gemini` / (미설정 시 키 자동 선택 → 없으면 stub) |
| `TAVILY_API_KEY` | Tavily 웹 리서치 |
| `RESEARCH_PROVIDER` | `stub` / `tavily` / (미설정 시 키 자동 선택) |
| `HF_TOKEN` | Hugging Face — BGE-m3-ko 한국어 임베딩 |
| `OPENAI_API_KEY` | text-embedding-3-large 대안 |
| `EMBEDDING_PROVIDER` | `stub` / `bge-m3-ko` / `openai` / (미설정 시 키 자동 선택) |
| `VECTOR_BACKEND` | `sqlite` / `pgvector` — 미설정 시 DB 프로바이더에 맞춰 자동 |
| `PG_POOL_MAX` | PostgreSQL 커넥션 풀 크기 (기본 10) |
| `INTEGRATION_TOKEN_SECRET` | Notion·Drive OAuth 토큰 암호화 키 (프로덕션 필수) |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Google Drive OAuth |
| `NOTION_CLIENT_ID` / `NOTION_CLIENT_SECRET` | Notion OAuth |

**프로바이더 자동 선택 우선순위**

- **AI**: `AI_PROVIDER` 명시 → `ANTHROPIC_API_KEY` → `GEMINI_API_KEY` → Stub
- **리서치**: `RESEARCH_PROVIDER` 명시 → `TAVILY_API_KEY` → Stub
- **임베딩**: `EMBEDDING_PROVIDER` 명시 → `HF_TOKEN` → `OPENAI_API_KEY` → Stub

API 키 없이 `npm run dev`만 해도 Stub 프로바이더로 전체 UI·플로우를 즉시 테스트할 수 있어요.

---

## 데이터베이스

### SQLite (기본)

- `DATABASE_URL=file:./dev.db`
- 벡터는 `DocumentChunk` / `OrgDocumentChunk` 테이블의 JSON 임베딩 + 앱 내 코사인 유사도 검색
- 로컬 개발·데모에 적합

### PostgreSQL + pgvector

- `docker-compose.yml` — `pgvector/pgvector:pg16` 이미지, 호스트 포트 **5433**
- `VECTOR_BACKEND=pgvector` + PostgreSQL URL 설정 시 네이티브 벡터 연산 사용
- `scripts/migrate-sqlite-to-pg.ts` — 기존 SQLite 데이터 이전 스크립트 (`npm run db:pg:migrate`)

Prisma 스키마는 `prisma/schema.prisma`에 정의돼 있고, 마이그레이션은 `prisma/migrations/`에 있어요.

---

## 인증·팀·권한

### 세션

- 쿠키 `mh_session` (httpOnly, 14일 만료)
- `Session` 테이블에 토큰 저장, 만료 시 자동 삭제

### 역할 (TeamRole)

| 역할 | 권한 수준 | 대표 작업 |
|------|-----------|-----------|
| `viewer` | 0 | Pack·문서 조회 |
| `editor` | 1 | Pack 생성·수정, 파일 업로드, 파이프라인 실행 |
| `admin` | 2 | 팀원 역할 변경, 초대 발급·취소, Pack 삭제 |
| `owner` | 3 | 팀 소유 (회원가입 시 자동 부여) |

`hasMinRole()`로 API 라우트마다 최소 역할을 검사해요.

### 미들웨어 (`src/middleware.ts`)

`AUTH_DISABLED=false`일 때:

- 공개 경로: `/login`, `/register`, `/invite/*`, `/api/auth/*`, `/api/invites/*`
- 그 외: 세션 없으면 API는 401, 페이지는 `/login?next=...` 리다이렉트

### 데모 모드 (`AUTH_DISABLED=true`)

- `requireAuth()`가 `null` 반환 — 권한 검사 스킵
- `getDemoTeamId()`로 `__demo__` 이름의 공유 팀 사용
- 조직 문서·Pack이 데모 팀에 귀속

### 팀 초대

1. admin이 `POST /api/team/invites` — 이메일·역할(admin/editor/viewer) 지정
2. 7일 만료 토큰 생성, `invitePath` (`/invite/[token]`) 반환
3. 수신자가 초대 페이지에서:
   - **신규**: 이름·비밀번호 입력 → 가입 + 팀 합류 + 자동 로그인
   - **기존 계정**: 로그인 후 수락 (초대 이메일과 계정 이메일 일치 필수)
4. 한 계정은 하나의 팀만 가입 가능

`RESEND_API_KEY`가 있으면 초대 생성 시 이메일을 자동 발송해요 (`EmailProvider`, Stub/Resend). 키가 없거나 발송이 실패해도 초대 자체는 막히지 않고, 화면에서 링크를 복사해 전달할 수 있어요.

### 팀 설정 (`/settings/team`)

- 팀원 목록·역할 변경 (`PATCH /api/team/members/[userId]`)
- 초대 목록·발급·취소

---

## 핵심 파이프라인

오케스트레이터: `src/lib/pipeline/orchestrator.ts`

### 데이터 파이프라인 다이어그램

#### 1. End-to-End 데이터 흐름

사용자 입력부터 Context Pack 보내기까지, 데이터가 지나는 경로예요.

```mermaid
flowchart LR
  subgraph Input["입력"]
    Files["소스 파일\n(txt/md/pdf/docx/hwp)"]
    Meta["이슈명·업종"]
    OrgDoc["조직 문서\n(팀 라이브러리)"]
  end

  subgraph Ingest["수집·인덱싱"]
    Parse["fileParsing\n텍스트 추출"]
    Chunk["chunkText\n800자 청크"]
    Embed["Embedding\nBGE-m3-ko 등"]
  end

  subgraph Store["DB"]
    SF["SourceFile\nextractedText"]
    DC["DocumentChunk\nvector"]
    ODC["OrgDocumentChunk\nvector"]
    CP["ContextPack"]
  end

  subgraph Process["파이프라인"]
    A["analyze\n문서 분석"]
    R["research\n웹 리서치"]
    G["generate\n메시지하우스"]
  end

  subgraph HITL["Human-in-the-Loop"]
    Rev["review\n인라인 편집"]
    Gate["3-flag 게이트"]
    Conf["confirmed"]
  end

  subgraph Output["보내기"]
    JSON["JSON"]
    MD["Markdown"]
    Claude["Claude 프롬프트"]
  end

  Files --> Parse --> SF
  Parse --> Chunk --> Embed --> DC
  OrgDoc --> Chunk --> Embed --> ODC
  Meta --> CP

  SF --> A
  DC --> A
  A --> CP
  CP --> R --> CP
  SF --> G
  DC --> G
  ODC --> G
  CP --> G
  G --> Rev --> Gate --> Conf
  Conf --> JSON & MD & Claude
```

#### 2. 파이프라인 7단계 상태

`derivePipelineStatus()`가 Pack 레코드로부터 계산하는 단계 순서예요.

```mermaid
stateDiagram-v2
  [*] --> upload: Pack 생성
  upload --> analyze: 파일 업로드 완료
  analyze --> research: 모든 파일 analyzedAt
  research --> generate: researchResult 저장
  generate --> review: roofMessage 생성\nstatus=review
  review --> confirm: 3-flag 통과\nPATCH status=confirmed
  confirm --> export: confirmedAt 기록
  export --> [*]

  review --> review: 메시지하우스 수정\n(자동 revert)
  confirm --> review: 확정 후 본문 수정
```

#### 3. 오케스트레이터 실행 흐름

`runContextPackPipeline()` / SSE `runContextPackPipelineStream()`의 내부 로직이에요. `needsStep()`이 이미 완료된 단계는 건너뛰고, `force: true`면 강제 재실행해요.

```mermaid
flowchart TD
  Start(["POST /pipeline\n또는 SSE /pipeline/stream"]) --> Load["loadPack(packId)"]
  Load --> Clear["clearPipelineError()"]
  Clear --> Loop{"targetSteps\n(analyze → research → generate)"}

  Loop --> Need{"needsStep?\n미완료 또는 force"}
  Need -->|skip| Loop
  Need -->|run| Running["setPipelineRunning(step)"]
  Running --> Step{"step"}

  Step -->|analyze| RunA["runAnalyzeStep()\n파일별 AI 분석"]
  Step -->|research| RunR["runResearchStep()\nTavily/Stub"]
  Step -->|generate| RunG["runGenerateStep()\n메시지하우스 생성"]

  RunA --> DoneA["analyzedAt 갱신"]
  RunR --> DoneR["researchResult 저장"]
  RunG --> DoneG["status=review\ngeneratedAt 갱신"]

  DoneA & DoneR & DoneG --> SSE{"SSE?"}
  SSE -->|yes| Emit["yield step_start\nstep_done / status"]
  SSE -->|no| Loop
  Emit --> Loop

  Loop -->|모든 단계 완료| ClearRun["clearPipelineRunning()"]
  ClearRun --> End(["pipeline 상태 반환"])

  Running -.->|오류| Err["setPipelineError()\npipelineErrorStep 기록"]
  Err --> Fail(["502 / SSE error 이벤트"])
```

**target 옵션**

| `target` | 실행 단계 |
|----------|-----------|
| `analyzed` | analyze |
| `researched` | analyze → research |
| `generated` | analyze → research → generate |

#### 4. 업로드 & RAG 인덱싱

파일 업로드 직후 텍스트 추출과 벡터 인덱싱이 동기적으로 일어나요. 인덱싱 실패 시 `SourceFile` 레코드는 롤백돼요.

```mermaid
sequenceDiagram
  participant U as 사용자
  participant API as POST .../files
  participant FP as fileParsing
  participant DB as Prisma DB
  participant RAG as indexSourceFile
  participant EMB as Embedding Provider
  participant VS as VectorSearch

  U->>API: multipart 파일
  API->>FP: extractText(buffer)
  FP-->>API: extractedText
  API->>DB: SourceFile.create
  API->>RAG: indexSourceFile(id)
  RAG->>RAG: chunkText (800/150)
  RAG->>EMB: embed(chunks)
  EMB-->>RAG: vectors
  alt pgvector
    RAG->>VS: insertDocumentChunkVector
  else sqlite
    RAG->>DB: DocumentChunk.createMany (JSON embedding)
  end
  RAG-->>API: chunk count
  API-->>U: 201 files[]
```

#### 5. analyze 단계 — RAG 분기

4,000자 기준으로 전체 텍스트 vs 관련 청크 검색이 갈라져요.

```mermaid
flowchart TD
  Start(["runAnalyzeStep"]) --> Pending["analyzedAt 없는 파일 순회"]
  Pending --> Len{"text.length\n> 4,000?"}

  Len -->|No| Full["전체 extractedText\n→ AI 프롬프트"]
  Len -->|Yes| Index{"DocumentChunk\n존재?"}
  Index -->|No| Idx["indexSourceFile()"]
  Index -->|Yes| Search
  Idx --> Search["retrieveRelevantChunks\n분석 쿼리 top-8"]
  Search --> Budget["12,000자 budget\n청크 조합"]
  Budget --> RagText["RAG 컨텍스트\n→ AI 프롬프트"]

  Full --> AI["AI.analyzeDocument()"]
  RagText --> AI
  AI --> Save["SourceFile 갱신\ntopic/claim/numbers/...\nanalyzedAt"]
  Save --> Pending
  Pending -->|완료| Pack["ContextPack.analyzedAt 갱신"]
```

#### 6. generate 단계 — 입력 조립

분석 결과·리서치·RAG 청크를 합쳐 메시지하우스를 생성해요.

```mermaid
flowchart LR
  subgraph Inputs["입력 데이터"]
    Issue["issue + industry"]
    Analyses["파일별 분석\n(topic/claim/...)"]
    Research["researchResult\n뉴스·트렌드·규제..."]
    Query["RAG 쿼리\n이슈+업종+주제"]
  end

  subgraph RAG["RAG 검색"]
    QV["embedQuery()"]
    PackC["Pack DocumentChunk"]
    OrgC["OrgDocumentChunk"]
    Merge["score 병합 top-K"]
  end

  subgraph AI["생성"]
    Gen["AI.generateMessageHouse()"]
    Zod["MessageHouseSchema\nZod 검증"]
  end

  subgraph Result["ContextPack 저장"]
    MH["roofMessage\npillars(3)\nfoundation\nobjections\naieoSummary\nriskFlags\nterms"]
    Status["status = review\ngeneratedAt"]
  end

  Issue --> Gen
  Analyses --> Gen
  Research --> Gen
  Query --> QV --> PackC & OrgC --> Merge --> Gen
  Gen --> Zod --> MH --> Status
```

#### 7. Context Pack 상태 머신

Pack `status` 필드 전이와 Human-in-the-Loop 게이트예요.

```mermaid
stateDiagram-v2
  state draft {
    [*] --> draft
  }
  state review {
    [*] --> editing: 메시지하우스 표시
    editing --> gate_check: 확정 요청
    gate_check --> editing: 게이트 미통과 (400)
  }
  state confirmed {
    [*] --> locked: confirmedAt 기록
  }

  draft --> review: generate 완료\nroofMessage 생성
  review --> confirmed: PATCH status=confirmed\n+ 3-flag 서버 검증
  confirmed --> review: 메시지하우스 필드 수정\n게이트 초기화
```

### 단계

| 단계 | 함수 | 설명 |
|------|------|------|
| **analyze** | `runAnalyzeStep()` | 파일별 AI 분석. 4,000자↑ 문서는 RAG 컨텍스트 주입 |
| **research** | `runResearchStep()` | 이슈·업종·분석 주제 기반 웹 리서치 |
| **generate** | `runGenerateStep()` | 분석 + 리서치 + RAG 청크로 메시지하우스 생성 → `status: review` |

### 실행 방식

- **개별 API**: `POST /api/context-packs/[id]/analyze|research|generate`
- **일괄 실행**: `POST /api/context-packs/[id]/pipeline` — `target`: `analyzed` | `researched` | `generated`
- **SSE 스트림**: `GET /api/context-packs/[id]/pipeline/stream` — `step_start` / `step_done` / `status` / `done` / `error` 이벤트
- **상태 조회**: `GET /api/context-packs/[id]/pipeline`

`force: true`면 이미 완료된 단계도 재실행해요.

### Context Pack 상태 머신

위 [다이어그램 7](#7-context-pack-상태-머신) 참고. `draft → review → confirmed`이며, 확정 후 메시지하우스 수정 시 `review`로 자동 revert돼요.

- `confirmed` 전환 시 **서버 강제 검증**:
  1. `gateMessageReviewed` — 최종 메시지 확인
  2. `gateNoConfidential` — 미공개 정보 없음
  3. `gateNumbersVerified` — AI 수치 원본 대조
  4. `roofMessage` 존재

### 메시지하우스 구조 (생성 결과)

| 필드 | 설명 |
|------|------|
| `roofMessage` | 지붕 (핵심 메시지) |
| `pillars` | 기둥 3개 — theme, message, evidence, source |
| `foundation` | 기반 메시지 |
| `objections` | 빈 탄 (오해 방지) |
| `aieoSummary` | AIEO 관점 요약 |
| `riskFlags` | 리스크 플래그 |
| `forbiddenTerms` | 금지 표현 |
| `officialTerms` | 공식 용어 |

---

## RAG (검색 증강 생성)

구현: `src/lib/rag/`

### RAG 데이터 흐름

조직 문서와 Pack 파일이 인덱싱된 뒤, analyze·generate 단계에서 각각 다른 방식으로 검색돼요.

```mermaid
flowchart TB
  subgraph Sources["문서 소스"]
    SF["SourceFile\n(Pack 업로드)"]
    OD["OrgDocument\n(팀 라이브러리)"]
  end

  subgraph Index["인덱싱 파이프라인"]
    CT["chunkText\n800자 / 150 overlap"]
    EM["getEmbeddingProvider()"]
    DC["DocumentChunk\n+ contextPackId"]
    ODC["OrgDocumentChunk\n+ teamId"]
  end

  subgraph Search["검색"]
  VS["getVectorSearch()\nsqlite 코사인 | pgvector"]
  end

  subgraph Use["사용처"]
    UA["analyze: buildRagContextForAnalysis\n4,000자↑ 파일별 top-8"]
    UG["generate: retrieveRelevantChunks\nPack+Org 병합 top-K"]
  end

  SF --> CT --> EM --> DC
  OD --> CT --> EM --> ODC
  DC & ODC --> VS
  VS --> UA
  VS --> UG
  UA --> AI1["AI analyzeDocument"]
  UG --> AI2["AI generateMessageHouse"]
```

### 청킹

- `chunkText()` — 800자 청크, 150자 오버랩, 문단 경계 우선
- 업로드 직후 `indexSourceFile()` / `indexOrgDocument()`로 임베딩·저장

### 분석 시 RAG (`buildRagContextForAnalysis`)

- **4,000자 이하**: 전체 텍스트 사용
- **4,000자 초과**: BGE-m3-ko로 관련 청크 top-8 검색 → 최대 12,000자 budget으로 조합

### 생성 시 RAG (`retrieveRelevantChunks`)

- Pack 내 `DocumentChunk` + 팀 `OrgDocumentChunk`를 쿼리 벡터로 검색
- Pack 청크와 조직 청크를 score 기준 병합 후 top-K 반환
- 메시지하우스 생성 프롬프트에 주입

### 벡터 백엔드

| 백엔드 | 구현 | 저장 |
|--------|------|------|
| `sqlite` | `SqliteVectorSearch` — JSON 임베딩 + 코사인 | Prisma `DocumentChunk.embedding` |
| `pgvector` | `PgVectorSearch` — 네이티브 `<=>` 연산 | PostgreSQL `vector` 컬럼 |

---

## AI·리서치·임베딩 프로바이더

### AI (`src/lib/ai/`)

| 프로바이더 | 클래스 | 용도 |
|------------|--------|------|
| Stub | `StubAiProvider` | 데모용 고정 분석·생성 결과 |
| Claude | `ClaudeAiProvider` | `analyzeDocument`, `generateMessageHouse` |
| Gemini | `GeminiAiProvider` | Claude 대안 |

AI 응답은 JSON으로 파싱 후 Zod 스키마(`DocumentAnalysisSchema`, `MessageHouseSchema`)로 검증해요.

### 리서치 (`src/lib/research/`)

| 프로바이더 | 결과 필드 |
|------------|-----------|
| Stub / Tavily | `news`, `industryTrends`, `competitorMoves`, `regulations`, `aieoKeywords`, `differentiationPoint` |

### 임베딩 (`src/lib/embedding/`)

| 프로바이더 | 모델 |
|------------|------|
| Stub | 결정론적 데모 벡터 |
| BGE-m3-ko | `dragonkue/BGE-m3-ko` (한국어 최적) |
| OpenAI | `text-embedding-3-large` |

---

## 파일 파싱

`src/lib/fileParsing.ts`

| 형식 | 라이브러리 |
|------|------------|
| `.txt`, `.md` | UTF-8 디코딩 |
| `.pdf` | pdf-parse |
| `.docx` | mammoth |
| `.hwp`, `.hwpx` | kordoc → markdown |

### 업로드 제한

- Context Pack 파일: 최대 **10개**, 총 **50MB**
- 조직 문서: 파일당 **20MB**
- 추출 텍스트만 DB 저장 (원본 바이너리 미보관)
- 인덱싱 실패 시 해당 레코드 롤백

---

## 보내기 (Export)

`GET /api/context-packs/[id]/export?format=json|markdown|claude`

| 형식 | 함수 | 용도 |
|------|------|------|
| `json` | `toExportJson()` | 구조화된 Context Pack JSON |
| `markdown` | `toExportMarkdown()` | 사람이 읽기 쉬운 MD |
| `claude` | `toExportClaudePrompt()` | Claude 등 LLM에 바로 붙여넣을 시스템 프롬프트 |

### Notion · Google Drive (외부 저장)

`AUTH_DISABLED=false` + OAuth 앱 등록이 필요해요. 사용자별 OAuth 토큰은 `INTEGRATION_TOKEN_SECRET`으로 암호화해 DB에 저장돼요.

| 단계 | Google Drive | Notion |
|------|--------------|--------|
| 연동 | `/settings/integrations` → Google OAuth (`drive.file`) | 동일 → Notion OAuth |
| 저장 위치 | 기본 폴더 ID (선택) | 데이터베이스 ID **또는** 상위 페이지 ID |
| Export | `POST .../export/destinations` `{ provider: "google_drive", format }` | `{ provider: "notion", format }` |
| 재보내기 | 동일 Pack·provider면 기존 파일/페이지 **업데이트** | 동일 |

- **확정(`confirmed`) Pack만** 외부 저장 가능 (`assertConfirmedForDestinationExport`)
- 최소 역할: **editor**

환경변수: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `NOTION_CLIENT_ID`, `NOTION_CLIENT_SECRET`, `INTEGRATION_TOKEN_SECRET`

OAuth 리다이렉트 URI (로컬 예시):

- `http://localhost:3000/api/integrations/google/callback`
- `http://localhost:3000/api/integrations/notion/callback`

**단계별 등록 가이드**: [`docs/integrations-oauth-setup.md`](docs/integrations-oauth-setup.md)

---

## 외부 연동 OAuth 설정

Google·Notion OAuth 앱 등록은 개발자 콘솔에서 **본인 계정 로그인**이 필요해요. 아래는 요약이며, 전체 절차는 [`docs/integrations-oauth-setup.md`](docs/integrations-oauth-setup.md)를 따르세요.

### 이미 준비된 항목

| 항목 | 상태 |
|------|------|
| `.env` `AUTH_DISABLED=false` | 설정됨 |
| `INTEGRATION_TOKEN_SECRET` | 생성·저장됨 |
| Notion Export DB **MessageHouse Context Packs** | 생성됨 — DB ID `f246b7ad3edb4203be2c29cbdbb4ccb6` |

### 사용자가 완료할 항목

1. **Google Cloud Console** — Drive API 활성화 → OAuth 클라이언트(웹) 생성 → 리디렉션 URI 등록 → `.env`에 ID/시크릿
2. **Notion My integrations** — Public integration 생성 → Redirect URI 등록 → `.env`에 OAuth client ID/secret
3. Notion DB 페이지에서 **MessageHouse Context Builder** integration **연결** (권한 부여)
4. `npm run dev` 재시작 → `/settings/integrations`에서 OAuth 연결 및 DB ID 저장

브라우저에서 Google Cloud·Notion integrations 페이지를 열어 두었어요. 로그인 후 위 단계를 진행해주세요.

---

## API 레퍼런스

### 인증

| 메서드 | 경로 | 설명 | 최소 역할 |
|--------|------|------|-----------|
| POST | `/api/auth/register` | 회원가입 + 팀 생성 | — |
| POST | `/api/auth/login` | 로그인 | — |
| POST | `/api/auth/logout` | 로그아웃 | — |
| GET | `/api/auth/me` | 세션·팀 정보 | — |

### Context Pack

| 메서드 | 경로 | 설명 | 최소 역할 |
|--------|------|------|-----------|
| GET | `/api/context-packs` | Pack 목록 | viewer |
| POST | `/api/context-packs` | Pack 생성 | editor |
| GET | `/api/context-packs/[id]` | Pack 상세 + 파일 | viewer |
| PATCH | `/api/context-packs/[id]` | 메타·메시지하우스·게이트·상태 수정 | editor |
| DELETE | `/api/context-packs/[id]` | Pack 삭제 | admin |
| POST | `/api/context-packs/[id]/files` | 파일 업로드 (multipart) | editor |
| DELETE | `/api/context-packs/[id]/files/[fileId]` | 파일 삭제 | editor |
| POST | `/api/context-packs/[id]/analyze` | 분석 단계 | editor |
| POST | `/api/context-packs/[id]/research` | 리서치 단계 | editor |
| POST | `/api/context-packs/[id]/generate` | 생성 단계 | editor |
| GET/POST | `/api/context-packs/[id]/pipeline` | 파이프라인 상태·일괄 실행 | viewer / editor |
| GET | `/api/context-packs/[id]/pipeline/stream` | SSE 진행 스트림 | editor |
| GET | `/api/context-packs/[id]/export` | 보내기 | viewer |
| GET/POST | `/api/context-packs/[id]/export/destinations` | Notion·Drive 저장 이력·실행 | viewer / editor |

### 외부 연동

| 메서드 | 경로 | 설명 | 최소 역할 |
|--------|------|------|-----------|
| GET | `/api/integrations` | 연동 상태·OAuth 설정 여부 | viewer |
| GET | `/api/integrations/google/connect` | Google OAuth 시작 | editor |
| GET | `/api/integrations/google/callback` | Google OAuth 콜백 | editor |
| GET | `/api/integrations/notion/connect` | Notion OAuth 시작 | editor |
| GET | `/api/integrations/notion/callback` | Notion OAuth 콜백 | editor |
| PATCH/DELETE | `/api/integrations/[provider]` | 저장 위치·연동 해제 | editor |

### 조직 문서

| 메서드 | 경로 | 설명 | 최소 역할 |
|--------|------|------|-----------|
| GET | `/api/org-documents` | 문서 목록 | viewer |
| POST | `/api/org-documents` | 문서 업로드 + 인덱싱 | editor |
| DELETE | `/api/org-documents/[id]` | 문서 삭제 | editor |

### 팀

| 메서드 | 경로 | 설명 | 최소 역할 |
|--------|------|------|-----------|
| GET | `/api/team/members` | 팀원 목록 | viewer |
| PATCH | `/api/team/members/[userId]` | 역할 변경 | admin |
| GET | `/api/team/invites` | 초대 목록 | admin |
| POST | `/api/team/invites` | 초대 발급 | admin |
| DELETE | `/api/team/invites?id=` | 초대 취소 | admin |

### 초대 (공개)

| 메서드 | 경로 | 설명 |
|--------|------|------|
| GET | `/api/invites/[token]` | 초대 미리보기 |
| POST | `/api/invites/[token]` | 가입+수락 또는 기존 계정 수락 |

---

## 화면·라우트

| 경로 | 설명 |
|------|------|
| `/` | Context Pack 라이브러리 |
| `/packs/new` | 새 Pack — 이슈·업종·파일 업로드 |
| `/packs/[id]/analysis` | 파일 분석 결과·리서치·생성 트리거 |
| `/packs/[id]/review` | 메시지하우스 검토·편집·3-flag·확정 |
| `/packs/[id]/export` | JSON / MD / Claude 프롬프트 + Notion·Drive 저장 |
| `/org-documents` | 조직 문서 라이브러리 |
| `/settings/team` | 팀원·초대 관리 |
| `/settings/integrations` | Notion·Google Drive OAuth·저장 위치 |
| `/login`, `/register` | 인증 UI |
| `/invite/[token]` | 초대 수락 |

---

## 데이터 모델

주요 엔티티 (`prisma/schema.prisma`):

```
User ──┬── TeamMember ── Team ──┬── ContextPack ── SourceFile ── DocumentChunk
       ├── Session              ├── OrgDocument ── OrgDocumentChunk
       └── TeamInvite (발송)     └── (팀 공유 리소스)
```

### ContextPack 핵심 필드

- **메타**: `issue`, `industry`, `status` (draft/review/confirmed), `version`
- **메시지하우스**: `roofMessage`, `pillars`, `foundation`, `objections`, `aieoSummary`, `riskFlags`, `forbiddenTerms`, `officialTerms`
- **리서치**: `researchResult`, `researchStatus`, `researchedAt`
- **파이프라인**: `analyzedAt`, `generatedAt`, `confirmedAt`, `pipelineRunningStep`, `pipelineError`, `pipelineErrorStep`
- **게이트**: `gateMessageReviewed`, `gateNoConfidential`, `gateNumbersVerified`
- **팀**: `teamId`, `createdById`

### SourceFile 분석 필드

`docType`, `topic`, `claim`, `numbers`, `terms`, `audience`, `risk`, `analyzedAt`

---

## 프로젝트 구조

```
src/
  app/
    page.tsx                        # 라이브러리
    login/ · register/              # 인증 UI
    invite/[token]/                 # 초대 수락
    org-documents/                  # 조직 문서 라이브러리
    settings/team/                  # 팀원·초대 관리
    packs/
      new/                          # 새 Pack
      [id]/analysis/                # 분석·리서치
      [id]/review/                  # 검토·확정
      [id]/export/                  # 보내기
    api/
      auth/                         # login, logout, register, me
      context-packs/                # Pack CRUD + 파이프라인 + 파일 + export
      org-documents/                # 조직 문서
      team/                         # members, invites
      invites/[token]/              # 초대 API
  components/
    Header.tsx                      # 공통 헤더·네비
  lib/
    auth/                           # 세션, 비밀번호, 초대, API 헬퍼
    ai/                             # Claude, Gemini, Stub + 프롬프트·스키마
    research/                       # Tavily, Stub
    embedding/                      # BGE-m3-ko, OpenAI, Stub + vectorSearch
    rag/                            # 청킹, 인덱싱, 검색
    pipeline/                       # 오케스트레이터, 단계, 상태
    fileParsing.ts                  # 다형식 텍스트 추출
    exportFormats.ts                # JSON / MD / Claude 프롬프트
    contextPackStatus.ts            # 상태 전이·게이트·PATCH 빌더
    contextPackSerialization.ts     # JSON 직렬화·canConfirm
    apiClient.ts                    # 클라이언트 fetch 래퍼
    db.ts · db/config.ts            # Prisma 클라이언트·DB/벡터 설정
  middleware.ts                     # 인증 가드
prisma/
  schema.prisma
  migrations/
e2e/
  pipeline.spec.ts                  # 전체 플로우 E2E
scripts/
  migrate-sqlite-to-pg.ts           # SQLite → PostgreSQL 이전
docker-compose.yml                  # PostgreSQL + pgvector
```

---

## 테스트

```bash
# 단위 테스트 (Vitest)
npm test
npm run test:watch

# E2E (Playwright) — 전용 DB·stub 프로바이더로 자동 기동
npm run test:e2e
npm run test:e2e:ui
```

E2E는 `playwright.config.ts`에서 `DATABASE_URL=file:./e2e.db`, `VECTOR_BACKEND=sqlite`, stub AI/리서치/임베딩을 사용해요. 로컬 `.env`에 PostgreSQL·pgvector가 있어도 E2E 서버는 이 값으로 덮어씁니다.

E2E 시나리오 (`e2e/pipeline.spec.ts`): 업로드 → 분석 → 리서치 → 생성 → 3-flag 확정 → 보내기

주요 테스트 파일:

- `src/lib/auth/` — 인증·초대 플로우
- `src/lib/pipeline/status.test.ts` — 파이프라인 상태 도출
- `src/lib/ai/`, `src/lib/research/`, `src/lib/embedding/` — 프로바이더 선택·파싱
- `src/lib/fileParsing.test.ts` — 파일 형식별 추출
- `src/lib/exportFormats.test.ts` — 보내기 형식

---

## 알려진 제약·후속 과제

- Next.js 16 / Prisma 7 / React 19 조합은 최신 버전이라 문서·생태계가 아직 앏아요.
- HWP는 `kordoc`로 파싱해요. 암호화·구버전 HWP 3.x는 환경에 따라 실패할 수 있어요.
- 업로드된 파일은 DB에 **추출 텍스트만** 저장돼요 (원본 바이너리 미보관).
- Stub 프로바이더는 네트워크 없이 동작하지만, 실제 품질 검증에는 API 키 설정이 필요해요.
- 파일 암호화·자동 삭제는 PRD 요구사항으로 남아 있어요.
- 사용자당 단일 팀 제한 — 멀티 팀 지원은 스키마·API 확장이 필요해요.
- 상태 변경 API는 Origin/Referer 검증(CSRF 방어)을 거쳐요. 로그인(10회/10분)·가입(5회/시간)·팀 초대(20회/시간)는 IP·팀 기준 레이트 리미팅이 적용돼요. 단일 프로세스 in-memory 구현이라 다중 인스턴스로 수평 확장하면 별도 공유 스토어(Redis 등)가 필요해요.
- `INTEGRATION_TOKEN_SECRET` — 개발 환경은 미설정 시 하드코딩된 키로 폴백하지만, **`NODE_ENV=production`에서 미설정이면 배포가 즉시 실패**하도록 막아뒀어요.
