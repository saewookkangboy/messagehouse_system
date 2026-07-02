# HWP · 조직 문서 · 인증 설계 (F-05 ~ F-07)

> 작성일: 2026-07-02

## F-06 HWP 파싱

- `kordoc`로 `.hwp`(5.x) / `.hwpx` 텍스트 추출
- 기존 `extractText` 파이프라인에 통합

## F-05 조직 문서 라이브러리

- `OrgDocument` + `OrgDocumentChunk` — 팀 단위 공유
- 업로드 시 RAG 인덱싱 (`indexOrgDocument`)
- Context Pack 생성 시 팩 문서 + 조직 문서 청크를 합쳐 Top-K 검색

## F-07 팀 권한 / 인증

- `User` / `Team` / `TeamMember` / `Session`
- 역할: owner > admin > editor > viewer
- httpOnly 쿠키 세션 (`mh_session`)
- `AUTH_DISABLED=true` — 데모 모드(기존 무인증 동작 유지)

| 역할 | Context Pack | 조직 문서 | 팀원 관리 |
|---|---|---|---|
| viewer | 조회 | 조회 | — |
| editor | 생성·편집 | 업로드 | — |
| admin | 삭제 포함 | 삭제 | 역할 변경·제거 |
| owner | 전체 | 전체 | 전체 |
