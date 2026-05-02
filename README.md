# Lost Ark Homework Party Builder

Lost Ark OpenAPI로 대표 캐릭터의 원정대 캐릭터를 가져오고, 레벨별 숙제/레이드 파티를 자동 생성하는 작은 웹앱입니다.

## 실행

```powershell
Copy-Item .env.example .env
```

`.env`에 Lost Ark OpenAPI JWT를 넣은 뒤 실행합니다.

```powershell
npm run dev
```

브라우저에서 `http://localhost:5177`을 엽니다.

API 키가 없어도 화면의 `샘플 불러오기`로 파티 생성 로직을 확인할 수 있습니다.

## 구조

- `server.js`: 정적 파일 서버와 Lost Ark OpenAPI 프록시
- `public/app.js`: 원정대 조회, 숙제 규칙 편집, 파티 자동 생성 UI
- `public/partyLogic.js`: 레벨 필터링과 파티 편성 로직
- `public/styles.css`: 앱 스타일

## API

- `GET /api/roster?name=대표캐릭터명`

서버는 내부에서 Lost Ark OpenAPI의 `/characters/{characterName}/siblings`를 호출합니다. API 키는 프론트엔드로 노출하지 않습니다.
