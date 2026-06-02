# Stick Over Flow

Google Sheets에 흩어진 로스트아크 레이드 일정을 웹에서 더 빠르게 확인하고, 개인 일정과 참여 현황까지 한 번에 관리할 수 있도록 만든 일정 관리 웹앱입니다.

## 프로젝트 소개

`Stick Over Flow`는 스프레드시트를 그대로 데이터 소스로 유지하면서도, 실제 사용에서는 더 보기 쉽고 탐색하기 쉬운 UI를 제공하는 것을 목표로 만든 프로젝트입니다.

기존에는 레이드 일정, 개인 불참 일정, 참여 캐릭터 현황을 각각 따로 확인해야 했기 때문에:

- 금일 레이드 일정을 빠르게 확인하기 어렵고
- 특정 인원의 주간 참여 현황을 찾기 번거롭고
- 캐릭터 상세 스펙 확인을 위해 외부 사이트를 다시 열어야 하는 문제가 있었습니다.

이 프로젝트에서는 Google Sheets 기반 운영 방식은 유지하면서, 웹 화면에서 일정 확인, 참여자 탐색, 개인 일정 등록, 캐릭터 상세 조회까지 자연스럽게 이어지도록 구성했습니다.

## 한 줄 소개

로스트아크 레이드 일정을 Google Sheets와 OpenAPI 기반으로 시각화한 반응형 일정 관리 웹앱입니다.

## 주요 기능

- `금일 일정` 탭에서 오늘 진행되는 레이드만 모아 카드 형태로 표시
- 참여자 이름 필터를 통해 특정 인원이 포함된 일정만 빠르게 강조
- `주간 일정` 탭에서 리스트형 / 캘린더형 두 가지 방식으로 일정 탐색
- 주간 참여자 이름 검색으로 특정 인원의 참여 캐릭터와 레이드 목록 확인
- `개인 일정` 탭에서 날짜, 이름, 사유를 등록하고 목록 조회
- `레이드 참여 현황` 탭에서 이름 검색으로 참여 중인 캐릭터와 참여 레이드 확인
- 캐릭터 클릭 시 Lost Ark OpenAPI 기반 상세 모달 제공
- 프로필, 장비, 보석, 아크 패시브, 아크 그리드, 카드, 스킬 정보 탭 분리 제공
- Google Sheets 로딩 실패 시 fallback 데이터를 보여주는 예외 처리

## 기술 스택

- Frontend: `React 19`, `Vite 7`
- Styling: `CSS Modules`
- Date UI: `date-fns`, `react-datepicker`
- API / Server: `Node.js`, `Vercel Serverless Functions`
- Data Source: `Google Sheets`, `Google Apps Script`, `Lost Ark OpenAPI`
- Deployment: `Vercel` 기준 구조

## 구현 포인트

### 1. Google Sheets를 서비스 데이터 소스로 유지한 구조

운영 편의성 때문에 기존 스프레드시트를 버리지 않고, `/api/raid-sheet` 프록시를 통해 Google Visualization API 형식의 시트 데이터를 읽어오도록 구성했습니다.  
덕분에 관리자는 익숙한 시트에서 데이터를 수정하고, 사용자는 웹 UI에서 더 직관적으로 소비할 수 있습니다.

### 2. 일정 탐색 흐름에 맞춘 화면 분리

하나의 화면에 모든 정보를 몰아넣지 않고 사용 목적에 따라 탭을 분리했습니다.

- `금일 일정`: 오늘 바로 확인해야 하는 레이드
- `주간 일정`: 주간 단위 일정 전체 탐색
- `개인 일정`: 불참/개인 사유 등록과 조회
- `레이드 참여 현황`: 특정 인원의 참여 캐릭터 검색

이렇게 역할을 나누어 정보량이 많아도 복잡하게 느껴지지 않도록 구성했습니다.

### 3. 캐릭터 상세 조회를 위한 OpenAPI 연동

캐릭터 이름 클릭 시 `/api/lostark/characters/[characterName]` 엔드포인트를 통해 Lost Ark OpenAPI를 호출하고, 프로필 외에도 장비, 보석, 카드, 스킬, 아크 패시브 정보를 함께 묶어서 제공합니다.  
여러 엔드포인트 응답을 한 번에 정리해 프론트에서 사용하기 쉬운 구조로 정규화한 점이 핵심 구현 포인트입니다.

### 4. 캐시와 예외 처리

- 시트 데이터는 메모리 캐시를 두어 불필요한 재호출을 줄임
- 캐릭터 상세 정보도 5분 TTL 캐시 적용
- Apps Script가 HTML 에러 페이지를 반환하는 경우 별도 메시지 처리
- 시트 로딩 실패 시 fallback 일정으로 화면이 완전히 비지 않도록 구성

실사용 도구라는 성격에 맞게 "기능이 아예 멈추지 않게 하는 것"에 집중했습니다.

## 프로젝트 구조

```text
src/
  App.jsx
  pages/
    RaidSchedulePage/
    PersonalSchedulePage/
    PersonalRaidPage/
api/
  raid-sheet.js
  personal-schedule.js
  character.js
  lostark/characters/[characterName].js
server.js
dev-server.js
vercel.json
```

## 데이터 흐름

### 레이드 일정

1. 프론트에서 `/api/raid-sheet` 호출
2. 서버가 Google Sheets gviz 응답을 파싱
3. `raidParser`에서 일정 카드 형식으로 정규화
4. `금일 일정` / `주간 일정` 화면에 맞춰 렌더링

### 개인 일정

1. 프론트에서 `/api/personal-schedule`로 조회 또는 등록
2. 서버가 Google Apps Script Web App으로 프록시
3. 시트 기반 개인 일정 목록을 화면에 반영

### 캐릭터 상세 정보

1. 사용자가 캐릭터 이름 클릭
2. 프론트에서 `/api/lostark/characters/:name` 호출
3. 서버가 Lost Ark OpenAPI 여러 엔드포인트를 병렬 조회
4. 응답을 정규화해 모달 탭 UI로 표시

## 실행 방법

### 1. 패키지 설치

```bash
npm install
```

### 2. 환경 변수 설정

`.env.example`을 기준으로 `.env.local` 또는 `.env` 파일을 준비합니다.

```bash
LOSTARK_API_KEY=your_lostark_openapi_jwt_here
PERSONAL_SCHEDULE_SCRIPT_URL=https://script.google.com/macros/s/your_deployment_id/exec
PORT=5178
```

### 3. 개발 서버 실행

```bash
npm run dev
```

- 프론트엔드: `http://127.0.0.1:5177`
- API 서버: `http://127.0.0.1:5178`

### 4. 빌드 / 미리보기

```bash
npm run build
npm run preview
```

## 환경 변수 설명

| 변수명 | 설명 |
| --- | --- |
| `LOSTARK_API_KEY` | Lost Ark OpenAPI 호출용 서버 전용 키 |
| `PERSONAL_SCHEDULE_SCRIPT_URL` | 개인 일정 등록/조회용 Google Apps Script Web App URL |
| `PORT` | 로컬 API 서버 포트 |

## 포트폴리오 설명용 문구

### 짧은 소개

Google Sheets 기반으로 관리하던 로스트아크 레이드 일정을 더 직관적으로 확인할 수 있도록 제작한 반응형 웹앱입니다.  
금일 일정, 주간 일정, 개인 일정, 참여 현황을 분리해 탐색성을 높였고, Lost Ark OpenAPI를 연동해 캐릭터 상세 정보까지 한 화면에서 확인할 수 있도록 구현했습니다.

### 자세한 소개

이 프로젝트는 기존에 스프레드시트로 운영되던 레이드 일정을 웹 UI로 재구성해, 실제 사용자가 더 빠르게 일정을 확인하고 참여 현황을 파악할 수 있도록 만든 일정 관리 도구입니다.  
Google Sheets를 그대로 데이터 소스로 유지하면서도, 프론트에서는 금일 일정, 주간 일정, 개인 일정, 레이드 참여 현황을 역할별로 나누어 정보 구조를 단순화했습니다.  
또한 Lost Ark OpenAPI를 연동해 캐릭터 프로필, 장비, 보석, 카드, 스킬 정보를 모달 형태로 제공하고, 시트 프록시 및 캐시 구조를 통해 데이터 로딩 안정성과 사용성을 함께 개선했습니다.

## 기술적으로 강조할 수 있는 부분

- Google Sheets를 서비스 데이터 소스로 유지하면서 웹 UI로 전환한 구조 설계
- Lost Ark OpenAPI 다중 엔드포인트 응답을 정규화해 단일 상세 화면으로 통합
- 이름 필터, 캘린더/리스트 전환 등 실제 사용 흐름 중심의 탐색 UI 설계
- Apps Script 프록시, 캐시, fallback 처리 등 운영 안정성을 고려한 예외 대응

## 배운 점

- 단순히 데이터를 보여주는 것보다, 사용자가 어떤 맥락에서 정보를 찾는지에 따라 화면을 나누는 것이 중요하다는 점
- 외부 데이터 소스가 여러 개인 프로젝트에서는 정규화 계층과 예외 처리가 사용자 경험에 큰 영향을 준다는 점
- 실사용 도구는 예쁜 UI만큼이나 "끊기지 않는 동작"과 관리 편의성이 중요하다는 점
