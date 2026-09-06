# 새싹콩 🌱

오늘의 기분과 활동을 기록하면 캘린더에 콩이 자라나는 감정 일기장.
프레임워크 없는 정적 웹앱이라 어떤 폰에서도 바로 열립니다.

## 특징

- **어떤 화면에서도 안 깨지는 UI** — 모든 치수를 `clamp()` 로 잡아 320px 소형 폰부터 태블릿·데스크톱까지 대응합니다.
- **아이폰 노치·홈 인디케이터 대응** — `viewport-fit=cover` + `env(safe-area-inset-*)` 로 실제 기기의 안전 영역을 피해 배치합니다. (프로토타입에 있던 가짜 노치 목업은 제거했습니다.)
- **모바일 키보드 대응** — `visualViewport` 로 키보드 높이를 읽어 바텀 시트를 밀어 올립니다.
- **로컬 우선 저장** — 기록은 항상 기기에 먼저 저장되므로 오프라인/로그인 실패 상태에서도 앱이 그대로 동작합니다.
- **Supabase 동기화** — 익명 로그인으로 계정 입력 없이 클라우드에 백업되고, 기기 간 최신 기록이 병합됩니다.
- **콩이 꾸미기** — 기분 다섯 개마다 내 사진을 붙일 수 있습니다. 원형 틀에서 끌어 맞추고,
  흰 배경이면 테두리에서 번져 들어가는 flood fill 로 오려냅니다. 288px webp 로 줄여
  기기에 저장하고, 로그인돼 있으면 `mood_photos` 로 따라 올라갑니다.
- **라이트/다크 모드** — 기기 설정을 따라갑니다.
- **PWA** — 홈 화면에 추가하면 전체 화면 앱처럼 실행됩니다.

## 파일 구성

| 파일 | 설명 |
| --- | --- |
| `index.html` | 화면 구조 |
| `styles.css` | 반응형 스타일, 다크 모드, 안전 영역 처리 |
| `app.js` | 앱 로직, 로컬 저장, Supabase 동기화 |
| `config.js` | Supabase URL / publishable 키 |
| `mood.js` | 기분 정의, 콩이 이미지, 직접 올린 얼굴 |
| `photo.js` | 사진 크롭·확대 편집기, 흰 배경 지우기 |
| `supabase/schema.sql` | `entries` 테이블 + RLS 정책 |
| `supabase/mood_photos.sql` | 직접 올린 콩이 얼굴 + RLS 정책 |

## Supabase 설정

1. `supabase/schema.sql` 을 SQL Editor 에서 실행합니다. (이미 적용되어 있습니다.)
   `supabase/growth.sql` 과 `supabase/mood_photos.sql` 도 같은 방식으로 실행합니다.
   `mood_photos` 가 없으면 사진은 그 기기에만 남고 동기화만 조용히 건너뜁니다.
2. **Authentication → Sign In / Providers → Anonymous Sign-Ins** 를 켭니다.
   꺼져 있으면 앱은 "이 기기에만 저장" 모드로 동작합니다.
3. **Authentication → URL Configuration → Site URL** 에 배포 도메인을 넣습니다.

`config.js` 의 publishable 키는 공개용으로 설계된 키입니다. 실제 데이터 보호는
`entries` 테이블의 RLS 정책(`auth.uid() = user_id`)이 담당합니다.

## 로컬 실행

```bash
npx serve .
```

`file://` 로 직접 열면 ES 모듈이 차단되므로 반드시 로컬 서버로 여세요.
