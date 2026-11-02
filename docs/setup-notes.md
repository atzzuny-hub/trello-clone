# Trello Clone 클론 코딩 (1) — Next.js 앱 세팅 & 개발 서버 실행

참고 영상: https://www.youtube.com/watch?v=ugxI1o5SyMs
영상 구간: `00:06:00` Next.js App Bootstrapping & Dev Server

유튜브 영상을 보면서 Trello 클론 코딩을 따라 하고 있다.
그런데 영상이 찍힌 뒤로 패키지들이 업데이트돼서, 그대로 따라 하면 **설치 에러나 import 에러가 나는 부분**이 있었다.
이 글에는 따라 한 순서와 함께 **영상과 달라진 부분, 그리고 그 이유**를 정리했다.

## 진행 방향

- **Next.js는 영상과 같은 15 버전으로 맞췄다.**
  최신 16으로 가면 미들웨어 파일 이름(`middleware.ts` → `proxy.ts`) 같은 구조 차이가 생겨서, 영상을 따라가기가 더 어려워진다.
- **인증은 영상대로 Clerk을 쓴다.**
  원래는 Supabase Auth를 쓰고 싶었다. 하지만 인증 방식은 DB 테이블의 `user_id`, 보안 규칙(RLS), 데이터 불러오는 코드까지 다 연결돼 있어서, 처음부터 바꾸면 거의 모든 단계가 영상과 달라진다.
  그래서 **영상으로 한 번 끝까지 완성한 다음, Supabase Auth로 바꿔서 다시 만들어 볼 계획**이다.
- 나머지 패키지(shadcn, lucide-react, Tailwind)는 최신 버전을 그대로 쓰고, 영상과 다른 부분만 맞춰서 고쳤다.

## 사용한 버전

| 패키지 | 버전 | 비고 |
|---|---|---|
| next | 15.5.28 | 영상과 같은 15 버전으로 고정 |
| react / react-dom | 19.1.10 | Clerk 때문에 19.1.4 이상 필요 |
| tailwindcss | 4.3.3 | v4 — `tailwind.config.js` 없음 |
| shadcn (CLI) | 4.23.0 | 스타일 `radix-nova`, `cn` / `radix-ui` 패키지 사용 |
| lucide-react | 1.66.0 | 1.x — 브랜드 아이콘(Trello 등) 없음 |
| @clerk/nextjs | 7.9.23 | |

---

## 1. Next.js 설치

```bash
npx create-next-app@15 .
```

```
? Would you like to use TypeScript? › Yes
? Which linter would you like to use? › ESLint
? Would you like to use Tailwind CSS? › Yes
? Would you like your code inside a `src/` directory? › No
? Would you like to use App Router? › Yes
? Would you like to use Turbopack? › Yes
? Would you like to customize the import alias (`@/*` by default)? › No
```

> **영상과 다른 점**
> - 버전 없이 `npx create-next-app .` 을 실행하면 지금은 **Next.js 16**이 설치된다. 영상과 맞추려고 `@15`를 붙였다.
> - `.` 은 새 폴더를 만들지 않고 **현재 폴더에 설치**한다는 뜻이다.
> - linter 선택, Turbopack 사용 여부처럼 영상에 없던 질문이 나올 수 있다. 위처럼 고르면 된다.

---

## 2. 패키지 설치

```bash
npm install react@~19.1.4 react-dom@~19.1.4 @supabase/supabase-js @supabase/ssr @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities @radix-ui/react-dialog @radix-ui/react-label @radix-ui/react-select @radix-ui/react-slot lucide-react class-variance-authority tailwind-merge clsx tw-animate-css @clerk/nextjs
```

```bash
npx shadcn@latest init
```

어떤 패키지를 무슨 용도로 쓰는지:

| 패키지 | 용도 |
|---|---|
| `@supabase/supabase-js`, `@supabase/ssr` | Supabase DB 연결 (서버/클라이언트에서 쓰기 위한 SSR용 포함) |
| `@dnd-kit/core`, `sortable`, `utilities` | 카드·리스트 드래그 앤 드롭 |
| `@radix-ui/react-*` | shadcn 컴포넌트의 기반이 되는 UI 부품 |
| `lucide-react` | 아이콘 |
| `class-variance-authority`, `clsx`, `tailwind-merge` | 클래스 이름 조합 (shadcn 컴포넌트에서 사용) |
| `tw-animate-css` | Tailwind v4용 애니메이션 |
| `@clerk/nextjs` | 로그인·회원가입 |

> **영상과 다른 점**
> - **`react@~19.1.4 react-dom@~19.1.4` 를 같이 설치해야 한다.**
>   - create-next-app이 깔아 준 React 19.1.0은 2025년 12월에 공개된 React Server Components 보안 취약점이 패치되지 않은 버전이다.
>   - 최신 `@clerk/nextjs`는 패치된 버전(`~19.1.4` 이상)만 허용한다.
>   - React를 안 올리면 `ERESOLVE unable to resolve dependency tree` 에러로 설치가 실패한다.
>   - `--force` / `--legacy-peer-deps` 로 에러를 우회할 수도 있지만, 보안 패치가 빠진 React가 남으니 버전을 올리는 게 맞다.
> - **`@supabase/supabase-js` 를 추가했다.** `@supabase/ssr` 가 이 패키지를 필요로 한다.
> - **`tw-animate-css` 는 Tailwind v4용 애니메이션 패키지다.** 예전 `tailwindcss-animate` 를 대신한다.
> - shadcn 실행은 `npm` 이 아니라 **`npx`** 다. `npm shadcn ...` 으로 쓰면 실행되지 않는다.

### 최신 shadcn은 구조가 조금 다르다

`shadcn init` 이 만든 코드를 열어 보면 영상과 import가 다르다.

| 영상 (구버전 shadcn) | 지금 (최신 shadcn) |
|---|---|
| `lib/utils.ts` 에서 `clsx` + `tailwind-merge` 로 `cn` 함수를 직접 만든다 | `export { cn } from "cn"` — shadcn 팀이 만든 `cn` 패키지를 그대로 쓴다 |
| `import * as DialogPrimitive from "@radix-ui/react-dialog"` | `import { Dialog as DialogPrimitive } from "radix-ui"` — 통합 패키지 하나를 쓴다 |
| `tailwind.config.ts` 에 테마 설정 | `app/globals.css` 의 `@theme` 에 설정 (Tailwind v4) |
| 스타일 `new-york` / `default` | 스타일 `radix-nova` — 컴포넌트 모양이 영상과 조금 다를 수 있다 |

- `app/globals.css` 맨 위에 `@import "shadcn/tailwind.css";` 가 있다. 그래서 `shadcn` 패키지가 dependencies에 들어간다. 지우면 안 된다.
- 이 때문에 직접 설치한 `@radix-ui/react-*`, `clsx`, `tailwind-merge` 는 **실제 코드에서 쓰이지 않는다.**
  - 있어도 충돌은 없다. 정리하고 싶으면:
    ```bash
    npm uninstall @radix-ui/react-dialog @radix-ui/react-label @radix-ui/react-select @radix-ui/react-slot clsx tailwind-merge
    ```
- 영상처럼 `@/lib/utils` 에서 `cn` 을 import하는 코드는 그대로 써도 된다. `lib/utils.ts` 가 `cn` 을 다시 내보내기 때문이다.

---

## 3. shadcn 컴포넌트 추가

```bash
npx shadcn add button card input label textarea dialog select badge
```

> **참고**
> - `@latest` 없이 실행하면 프로젝트에 설치된 shadcn(4.23.0)이 쓰인다.
> - `button` 은 `init` 할 때 이미 만들어져 있어서 덮어쓸지 물어볼 수 있다. 수정한 게 없으면 덮어써도 된다.
> - 실제로 파일을 만들기 전에 미리 보고 싶으면 `--dry-run` 을 붙인다.
> - 컴포넌트 파일은 `components/ui/*.tsx` 에 생긴다.

---

## 4. Navbar 만들기

`components/navbar.tsx`

```tsx
"use client"

import { SquareKanban } from "lucide-react"

export default function Navbar() {
  return (
    <header className="border-b bg-white/80 backdrop-blur-sm sticky top-0 z-50">
      <div className="container mx-auto px-4 py-3 sm:py-4 flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <SquareKanban className="size-6 sm:size-8 text-blue-600" />
          <span className="text-xl sm:text-2xl font-bold text-gray-900">Trello Clone</span>
        </div>
      </div>
    </header>
  )
}
```

> **영상과 다른 점**
> - **영상의 `import { Trello } from "lucide-react"` 는 에러가 난다.**
>   lucide-react 1.x에서 브랜드 로고 아이콘(Trello, Github 등)이 빠졌기 때문이다.
>   비슷한 모양의 `SquareKanban` 으로 바꿨다. `Kanban`, `Columns3` 도 쓸 수 있다.
> - `size-6` 은 `h-6 w-6` 을 한 번에 쓰는 Tailwind 단축 클래스다. `sm:h-8 sm:w-8` 도 `sm:size-8` 로 줄였다.
> - 처음에 `border0b` 로 오타를 냈다. **`border-b`** 가 맞다.
> - `container` 는 자동으로 가운데 정렬되지 않아서 `mx-auto px-4` 를 같이 써야 한다.

---

## 5. 메인 페이지

`app/page.tsx`

```tsx
import Navbar from "@/components/navbar"

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-100">
      <Navbar />
    </div>
  )
}
```

> **참고**
> - Tailwind v4에서는 그라데이션 클래스의 새 이름이 `bg-linear-to-br` 이다.
>   예전 이름 `bg-gradient-to-br` 도 아직 동작해서 영상대로 써도 된다.

---

## 6. 개발 서버 실행

```bash
npm run dev
```

브라우저에서 http://localhost:3000 을 열면 그라데이션 배경 위에 Navbar가 보인다.

> **참고**
> - `package.json` 의 `dev` 스크립트가 `next dev --turbopack` 이라서 Turbopack으로 실행된다. 설치할 때 Turbopack을 Yes로 골랐기 때문이다.
> - 코드를 저장하면 브라우저에 바로 반영된다(Fast Refresh). 서버를 다시 켤 필요 없다.
> - 서버를 끌 때는 터미널에서 `Ctrl + C`.
> - 3000번 포트를 이미 쓰고 있으면 3001처럼 다른 포트로 자동으로 실행된다. 터미널에 나온 주소를 확인하면 된다.

---

## 다음에 할 것

- 영상을 따라 Clerk 로그인과 Supabase DB 연결하기
- 보드·리스트·카드 만들고 dnd-kit으로 드래그 앤 드롭 붙이기
- 다 만든 다음에 해 볼 것:
  - Clerk 대신 **Supabase Auth**로 바꾸기
    - `lib/supabase/client.ts`, `lib/supabase/server.ts` 만들고, `middleware.ts` 에서 로그인 세션 갱신
    - 환경 변수는 `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
    - DB 보안 규칙(RLS)에서 Clerk 사용자 ID 대신 `auth.uid()` 로 사용자 구분
  - Next.js 16으로 업그레이드 (`npx @next/codemod@latest upgrade latest`)
