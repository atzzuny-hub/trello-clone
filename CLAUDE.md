# CLAUDE.md

유튜브 영상(https://www.youtube.com/watch?v=ugxI1o5SyMs)을 보며 공부 목적으로 따라 만드는 Trello 클론.
진행 상황과 다음 할 일은 `README.md` 의 "진행 상황"을 먼저 본다.

## 사용자

- 한국어로 대화한다. 설명은 쉽게, 용어는 풀어서.
- 영상을 따라가며 배우는 중이다. 영상 코드와 달라지는 수정은 이유를 설명하고, 영상과 크게 달라지는 리팩터링은 먼저 물어본다.

## 버전 규칙 (영상과 맞추기 위한 결정 — 바꾸지 말 것)

- **Next.js 15 유지.** 16으로 업그레이드하지 않는다. 업그레이드는 영상을 다 끝낸 뒤 따로 한다.
- **미들웨어 파일은 `middleware.ts`.** Clerk 문서는 Next.js 16 기준 `proxy.ts` 를 안내하지만 Next.js 15는 `middleware` 파일만 실행한다. `proxy.ts` 는 에러 없이 무시된다.
  - 동작 확인: `curl -I http://localhost:3000` 응답에 `x-clerk-auth-status` 헤더가 있으면 실행 중.
- **React는 `~19.1.4`.** `@clerk/nextjs` 가 이 이상만 허용한다. `--force` / `--legacy-peer-deps` 로 우회하지 않는다.
- **인증은 지금은 Clerk.** 영상을 완성한 뒤 Supabase Auth로 바꿀 계획이다. 그 전까지 Clerk 코드를 Supabase Auth로 바꾸지 않는다.

## 라이브러리 주의점

- **lucide-react 1.x:** 브랜드 아이콘(`Trello`, `Github` 등)이 없다. Trello 로고 대신 `SquareKanban` 을 쓴다.
- **shadcn (style `radix-nova`):**
  - `cn` 은 `cn` 패키지에서 온다(`lib/utils.ts` 가 다시 내보냄). `@/lib/utils` 에서 import 한다.
  - Radix는 통합 패키지 `radix-ui` 에서 import 한다(`import { Dialog } from "radix-ui"`). `@radix-ui/react-*`, `clsx`, `tailwind-merge` 는 설치돼 있지만 코드에서 쓰지 않는다.
  - 링크 버튼은 `<Button asChild><Link /></Button>` 형태로 쓴다(`<Link><Button>` 금지).
  - `components/ui/*` 는 shadcn이 생성한 파일이다. 직접 고치기보다 `npx shadcn add` 로 받는다.
- **Tailwind v4:** `tailwind.config.js` 가 없다. 테마는 `app/globals.css` 의 `@theme` 에서 설정한다.
- **Clerk:** 클라이언트 컴포넌트에서는 `@clerk/nextjs` 의 `useUser()` 등을 쓴다. `@clerk/nextjs/server` 는 서버 전용이라 `"use client"` 파일에서 import 하지 않는다.

## 명령어

```bash
npm run dev          # 개발 서버 (Turbopack, localhost:3000)
npx tsc --noEmit     # 타입 검사
npm run lint         # ESLint
```

변경 후에는 최소한 `npx tsc --noEmit` 으로 확인한다.

## 코드 스타일

- 사용자가 작성한 파일(`components/navbar.tsx` 등)은 작은따옴표 + 4칸 들여쓰기. 그 파일을 고칠 때는 기존 스타일을 따른다.
- shadcn 생성 파일은 큰따옴표 + 2칸. 다시 포맷하지 않는다.

## 환경 변수

- `.env` 에 `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`. git에 올리지 않는다.
- 새 환경 변수를 추가하면 `.env.example` 에도 이름만 추가한다.
- 키 값을 출력하거나 문서·블로그 글에 넣지 않는다(`pk_test_***` 처럼 가린다).

## 커밋

- 작업 단위로 나눠 커밋한다.
- 메시지는 `chore:` / `feat:` / `fix:` / `docs:` + 한국어 요약, 본문에 변경 내용을 `-` 목록으로.

## 블로그 정리 글 (`docs/`)

영상 챕터마다 블로그 글 한 편을 쓴다.

- 글: `docs/post-NN-<주제>.md` — 제목 `# Trello Clone 클론 코딩 (N) — <주제>`, 그 아래 영상 링크와 `영상 구간: \`hh:mm:ss\` <챕터 제목>`.
- 단계마다 코드 + 설명, 영상과 다른 부분은 `> **영상과 다른 점**` 인용 블록으로 적는다. 막혔던 에러와 해결도 남긴다.
- 썸네일: 이전 편의 `docs/thumbnail-N.html` 을 복사해 `클론 코딩 #N`, 제목, 부제, 스택 칩만 바꾼 뒤 PNG로 렌더링한다.
  ```bash
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new --hide-scrollbars --force-device-scale-factor=1 --window-size=1200,630 --screenshot="$PWD/docs/thumbnail-N.png" "file://$PWD/docs/thumbnail-N.html"
  ```
- 태그도 함께 제안한다(전체 목록 + 10개 이내 버전).
- 글을 추가하면 `README.md` 의 진행 상황 표도 갱신한다.
