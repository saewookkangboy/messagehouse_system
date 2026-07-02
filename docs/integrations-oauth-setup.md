# Notion · Google Drive OAuth 연동 설정

로컬 개발 기준 URL: `http://localhost:3000`

## 0. 사전 준비 (완료된 항목)

`.env`에 아래가 설정되어 있어야 해요.

```bash
AUTH_DISABLED=false
INTEGRATION_TOKEN_SECRET=<랜덤 32바이트 이상>
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
NOTION_CLIENT_ID=
NOTION_CLIENT_SECRET=
```

`INTEGRATION_TOKEN_SECRET`은 이미 생성·저장됐어요. OAuth 클라이언트 ID/시크릿만 채우면 됩니다.

---

## 1. Google Drive OAuth

### 1-1. Google Cloud 프로젝트

1. [Google Cloud Console](https://console.cloud.google.com/) 접속
2. 프로젝트 생성 또는 기존 프로젝트 선택 (예: `messagehouse-context-builder`)

### 1-2. Drive API 활성화

1. **API 및 서비스 → 라이브러리**
2. **Google Drive API** 검색 → **사용** 클릭

### 1-3. OAuth 동의 화면

1. **API 및 서비스 → OAuth 동의 화면**
2. User Type: **외부** (내부 Google Workspace만 쓸 경우 **내부**)
3. 앱 이름: `MessageHouse Context Builder`
4. 사용자 지원 이메일·개발자 연락처 입력
5. 범위 추가: `https://www.googleapis.com/auth/drive.file` (앱이 만든 파일만)
6. 테스트 사용자: 본인 Google 계정 추가 (앱이 **Testing** 상태일 때)

### 1-4. OAuth 클라이언트 ID

1. **API 및 서비스 → 사용자 인증 정보 → 사용자 인증 정보 만들기 → OAuth 클라이언트 ID**
2. 애플리케이션 유형: **웹 애플리케이션**
3. 이름: `MessageHouse Local` (또는 Production)
4. **승인된 리디렉션 URI** 추가:

```
http://localhost:3000/api/integrations/google/callback
```

프로덕션 배포 시 추가:

```
https://<your-domain>/api/integrations/google/callback
```

5. 생성 후 **클라이언트 ID**·**클라이언트 보안 비밀**을 `.env`에 입력:

```bash
GOOGLE_CLIENT_ID=xxxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-xxxx
```

### 1-5. (선택) 기본 업로드 폴더

1. Google Drive에서 폴더 생성 (예: `MessageHouse Exports`)
2. 폴더 URL에서 ID 복사: `https://drive.google.com/drive/folders/<FOLDER_ID>`
3. 앱 **연동 설정** (`/settings/integrations`) → **기본 폴더 ID**에 붙여넣기

---

## 2. Notion OAuth

### 2-1. Public Integration 생성

1. [Notion My integrations](https://www.notion.so/my-integrations) 접속
2. **New integration** → 유형 **Public** (OAuth)
3. 이름: `MessageHouse Context Builder`
4. **Redirect URIs** 추가:

```
http://localhost:3000/api/integrations/notion/callback
```

프로덕션:

```
https://<your-domain>/api/integrations/notion/callback
```

5. **Capabilities**: **Read content**, **Update content**, **Insert content** 체크
6. **OAuth domain & URIs**에 로컬은 `http://localhost:3000` 등록 (Notion 정책에 따라 표시되는 항목에 맞게 입력)
7. **Submit** 후 **OAuth client ID**·**OAuth client secret**을 `.env`에 입력:

```bash
NOTION_CLIENT_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
NOTION_CLIENT_SECRET=secret_xxxxxxxxxxxxxxxxxxxxxxxx
```

### 2-2. Export용 데이터베이스 (이미 생성됨)

워크스페이스에 **MessageHouse Context Packs** DB가 만들어져 있어요.

| 항목 | 값 |
|------|-----|
| Notion 페이지 | https://app.notion.com/p/f246b7ad3edb4203be2c29cbdbb4ccb6 |
| **데이터베이스 ID** (연동 설정에 입력) | `f246b7ad3edb4203be2c29cbdbb4ccb6` |
| 제목 속성명 | `Name` |

스키마: Name (title), Version, Industry, Exported At

### 2-3. Integration에 DB 권한 부여 (필수)

OAuth 연동만으로는 DB에 쓸 수 없어요. **연동 생성 후** 아래를 반드시 해주세요.

1. Notion에서 **MessageHouse Context Packs** DB 페이지 열기
2. 우측 상단 **···** → **연결** (Connections) → **MessageHouse Context Builder** integration 선택
3. 또는 DB 페이지에서 **Share** → integration 추가

### 2-4. 앱 연동 설정

1. `npm run dev` 실행 후 로그인 (`AUTH_DISABLED=false`)
2. **연동** (`/settings/integrations`) → **Notion 연결** (OAuth)
3. **데이터베이스 ID**에 `f246b7ad3edb4203be2c29cbdbb4ccb6` 입력 → **저장 위치 저장**
4. **DB 제목 속성명**: `Name` (기본값)

---

## 3. 동작 확인

```bash
npm run dev
```

1. 회원가입/로그인
2. Context Pack 생성 → 파이프라인 → **검토에서 확정**
3. **Export** → **Notion에 저장** / **Google Drive에 저장**
4. 생성된 URL이 열리는지 확인

---

## 4. 트러블슈팅

| 증상 | 해결 |
|------|------|
| `GOOGLE_CLIENT_ID가 설정되지 않았어요` | `.env` 저장 후 dev 서버 재시작 |
| Google `redirect_uri_mismatch` | 콘솔 리디렉션 URI가 콜백 URL과 **완전히 동일**한지 확인 |
| Notion `object_not_found` | DB/페이지에 integration **연결**했는지 확인 |
| Notion 저장 위치 오류 | DB ID 또는 상위 페이지 ID 중 하나 설정 |
| `auth_disabled` | `AUTH_DISABLED=false` + 재시작 |
| Google Testing 모드 | 동의 화면에 테스트 사용자로 본인 이메일 추가 |

---

## 5. 프로덕션 체크리스트

- [ ] `INTEGRATION_TOKEN_SECRET` 프로덕션 전용 값으로 교체
- [ ] Google OAuth 동의 화면 **게시** (또는 내부 앱으로 운영)
- [ ] Notion Integration **배포 승인** (Public integration)
- [ ] 프로덕션 도메인 리디렉션 URI 양쪽 콘솔에 등록
- [ ] HTTPS 필수
