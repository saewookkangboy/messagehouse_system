# RAG 벡터 검색 (F-04) 설계

> 작성일: 2026-07-02  
> Superpowers brainstorming 산출물

## 목표

업로드된 조직 문서를 청크 단위로 임베딩·저장하고, 메시지하우스 생성 시 이슈·업종과 관련된 원문을 벡터 검색해 LLM 프롬프트에 주입한다.

## 임베딩 모델 선택

| 모델 | 한국어 Retrieval | 비용 | 선택 |
|---|---|---|---|
| **dragonkue/BGE-m3-ko** | Kor-IR·KLUE 기준 최상위권 (text-embedding-3-large 대비 +5~8pt) | HF Inference (무료 티어) | **기본** |
| OpenAI text-embedding-3-large | 양호하나 한국어 recall 낮음 | API 과금 | 대안 |
| Stub (해시 기반) | 데모용 | 무료 | 키 없을 때 |

BGE-m3-ko는 BAAI/bge-m3의 한국어 파인튜닝 버전으로, 1024차원·8192 토큰 컨텍스트를 지원한다.

## 아키텍처

- **저장**: SQLite `DocumentChunk` (SourceFile 1:N, embedding JSON)
- **인덱싱**: 파일 업로드 직후 `chunkText` → `embed` → DB 저장
- **검색**: 생성 API에서 쿼리 임베딩 → 코사인 유사도 Top-5 → `buildGeneratePrompt` RAG 블록
- **Provider 패턴**: `getEmbeddingProvider()` — AI/Research와 동일한 stub·env 선택 로직

## 환경변수

- `HF_TOKEN` — BGE-m3-ko (기본 우선)
- `OPENAI_API_KEY` — text-embedding-3-large (HF 없을 때)
- `EMBEDDING_PROVIDER=stub|bge-m3-ko|openai` — 강제 지정

## 범위 밖 (후속)

- 조직 공통 문서 라이브러리 (팩 간 공유)
- HWP 파싱
- 하이브리드 sparse+dense (BGE-M3 full capability)
- 별도 벡터 DB (pgvector 등) — 문서 수 증가 시 검토
