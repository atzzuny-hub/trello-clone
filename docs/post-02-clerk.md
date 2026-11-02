# Trello Clone 클론 코딩 (2) — Clerk 로그인 연동

참고 영상: https://www.youtube.com/watch?v=ugxI1o5SyMs
영상 구간: `00:20:00` Installing Core Dependencies & UI Libraries

패키지 설치와 shadcn 컴포넌트 추가는 (1)편에 정리했다.
이번 글에서는 **Clerk으로 로그인·회원가입을 붙이고**, Navbar에 로그인 버튼과 대시보드 이동 버튼을 만든다.

## Clerk이 뭔가

로그인, 회원가입, 세션 관리를 대신 해 주는 인증 서비스다.
로그인 화면이나 비밀번호 처리 같은 걸 직접 만들지 않아도 되고, 컴포넌트와 훅(`useUser` 등)만 가져다 쓰면 된다.

> 원래는 Supabase Auth를 쓰고 싶었지만, 이번에는 영상대로 Clerk을 쓴다.
> 인증 방식을 바꾸면 DB 테이블, 보안 규칙(RLS), 데이터 불러오는 코드까지 다 달라지기 때문이다.
> 영상으로 한 번 완성한 다음 Supabase Auth로 바꿔 볼 계획이다.

---

## 1. Clerk 프로젝트 만들기

1. https://dashboard.clerk.com/ 에서 가입
2. 애플리케이션 생성 — 이름은 `trelloClone`
3. 로그인 방식으로 **GitHub**, **Email** 선택 후 생성
4. 생성 후 나오는 **Set your Clerk API keys** 의 키 두 개를 복사

---

## 2. 환경 변수 설정

프로젝트 루트에 `.env` 파일을 만들고 복사한 키를 붙여 넣는다.

```bash
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_***
CLERK_SECRET_KEY=sk_test_***
```

> **참고**
> - `NEXT_PUBLIC_` 으로 시작하는 값은 **브라우저에도 전달된다.** Publishable Key는 공개돼도 되는 키라서 괜찮다.
> - `CLERK_SECRET_KEY` 는 **서버에서만 쓰는 비밀 키**다. 절대 공개되면 안 된다.
> - create-next-app이 만든 `.gitignore` 에 `.env*` 가 들어 있어서 `.env` 는 git에 올라가지 않는다. 그래도 커밋 전에 한 번 확인하자.
> - 블로그에 올릴 때도 키 값은 지우고 올린다.

---

## 3. 미들웨어 설정 — `middleware.ts`

프로젝트 루트(`app` 폴더와 같은 위치)에 `middleware.ts` 를 만든다.

```ts
import { clerkMiddleware } from '@clerk/nextjs/server';

export default clerkMiddleware();

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for Clerk's auto-proxy path
    '/__clerk/:path*',
    // Always run for API routes
    '/(api|trpc)(.*)',
  ],
};
```

- 미들웨어는 **페이지가 그려지기 전에 모든 요청에서 먼저 실행되는 코드**다. Clerk은 여기서 요청마다 로그인 상태를 확인한다.
- `matcher` 는 미들웨어를 실행할 경로다. 이미지·CSS 같은 정적 파일은 빼고, API 경로는 항상 실행하도록 되어 있다.
- `clerkMiddleware()` 는 기본적으로 **어떤 페이지도 막지 않는다.** 로그인 정보만 읽어 두는 역할이고, 페이지 보호는 따로 설정해야 한다.

> **영상과 다른 점 — `proxy.ts` 가 아니라 `middleware.ts`**
> - 지금 Clerk 대시보드와 문서는 **Next.js 16 기준**이라 `proxy.ts` 로 만들라고 안내한다. Next.js 16에서 `middleware.ts` 이름이 `proxy.ts` 로 바뀌었기 때문이다.
> - 이 프로젝트는 **Next.js 15**라서 `middleware.ts` 여야 한다. Next.js 15는 `middleware` 라는 이름의 파일만 찾는다.
> - `proxy.ts` 로 만들면 **에러도 안 나고 그냥 실행되지 않는다.** 그래서 문제를 찾기가 어렵다.
> - 실행되는지 확인하는 방법: 개발 서버를 켜고 아래 명령을 실행해서 `x-clerk-auth-status` 헤더가 나오면 미들웨어가 동작하는 것이다.
>   ```bash
>   curl -I http://localhost:3000
>   ```

---

## 4. `ClerkProvider` 로 앱 감싸기

`app/layout.tsx`

```tsx
import { ClerkProvider } from '@clerk/nextjs'

// ...

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider>
      <html lang="en">
        <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
          {children}
        </body>
      </html>
    </ClerkProvider>
  );
}
```

- 앱 전체를 `ClerkProvider` 로 감싸야 어느 컴포넌트에서든 `useUser()` 같은 Clerk 기능을 쓸 수 있다.

---

## 5. Navbar에 로그인 버튼 붙이기

`components/navbar.tsx`

```tsx
"use client"

import { SignInButton, SignUpButton, useUser } from '@clerk/nextjs'
import { ArrowRight, SquareKanban } from 'lucide-react'
import { Button } from './ui/button'
import Link from 'next/link'

export default function Navbar() {
  const { isSignedIn, user } = useUser()

  return (
    <header className='border-b bg-white/80 backdrop-blur-sm sticky top-0 z-50'>
      <div className='container mx-auto px-4 py-3 sm:py-4 flex items-center justify-between'>
        <div className='flex items-center space-x-2'>
          <SquareKanban className="size-6 sm:size-8 text-blue-600" />
          <span className='text-xl sm:text-2xl font-bold text-gray-900'>Trello Clone</span>
        </div>

        <div className='flex items-center space-x-2 sm:space-x-4'>
          {isSignedIn ? (
            <div className='flex flex-col sm:flex-row items-end sm:items-center space-y-1 sm:space-y-0 sm:space-x-4'>
              <span className='text-xs sm:text-sm text-gray-600 hidden sm:block'>
                Welcome, {user.firstName ?? user.emailAddresses[0]?.emailAddress}
              </span>
              <Button asChild size='sm' className='text-xs sm:text-sm'>
                <Link href="/dashboard">
                  Go to Dashboard <ArrowRight />
                </Link>
              </Button>
            </div>
          ) : (
            <div>
              <SignInButton>
                <Button variant="ghost" size='sm' className='text-xs sm:text-sm'>
                  Sign in
                </Button>
              </SignInButton>
              <SignUpButton>
                <Button size='sm' className='text-xs sm:text-sm'>
                  Sign Up
                </Button>
              </SignUpButton>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
```

- `useUser()` 는 현재 로그인 상태를 알려 주는 Clerk 훅이다.
  - `isSignedIn`: 로그인했으면 `true`
  - `user`: 로그인한 사용자 정보(이름, 이메일 등)
- `SignInButton`, `SignUpButton` 으로 버튼을 감싸면, 누를 때 Clerk 로그인·회원가입 화면이 열린다. 직접 로그인 화면을 만들 필요가 없다.
- 훅을 쓰기 때문에 맨 위에 `"use client"` 가 필요하다.

> **영상과 다른 점 / 내가 막혔던 부분**
> - **`Welcome, {User.firstName}` 에러**
>   - 처음에 `import { User } from '@clerk/nextjs/server'` 를 가져와서 `User.firstName` 으로 썼더니 에러가 났다.
>   - `@clerk/nextjs/server` 는 **서버 전용**이라 `"use client"` 컴포넌트에서 쓸 수 없다.
>   - `User` 는 사용자 데이터의 형태를 정의한 클래스일 뿐, 지금 로그인한 사람의 정보가 아니다.
>   - 로그인한 사용자 정보는 `useUser()` 가 돌려주는 소문자 **`user`** 에 들어 있다.
> - **이름이 없을 때 대비**
>   - 이메일로만 가입하면 `firstName` 이 비어서 "Welcome, " 만 나온다.
>   - `??` 로 이름이 없으면 이메일을 보여 주게 했다. `emailAddresses[0]?.emailAddress` 의 `?.` 는 이메일이 없어도 에러가 나지 않게 해 준다.
> - **`<Link>` 안에 `<Button>` 대신 `asChild`**
>   - `<Link><Button>...</Button></Link>` 는 링크(`<a>`) 안에 버튼(`<button>`)이 들어가서 HTML 규칙에 어긋난다.
>   - shadcn의 `Button` 에 `asChild` 를 주면 버튼 스타일만 입힌 링크(`<a>`) 하나로 렌더링된다.

---

## 6. 대시보드 페이지 만들기

`app/dashboard/page.tsx`

```tsx
export default function DashboardPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      메인
    </div>
  )
}
```

- App Router에서는 `app/dashboard/page.tsx` 파일을 만들면 `/dashboard` 주소가 생긴다.
- 지금은 "Go to Dashboard" 버튼이 이동할 자리만 만들어 둔 상태다.

---

## 7. 확인

```bash
npm run dev
```

1. http://localhost:3000 에서 **Sign in / Sign Up** 버튼이 보인다.
2. Sign Up으로 가입하면 Navbar가 **Welcome, 이름** 과 **Go to Dashboard** 버튼으로 바뀐다.
3. Go to Dashboard를 누르면 `/dashboard` 로 이동한다.

---

## 다음에 할 것

- **대시보드 보호하기** — 지금은 로그아웃 상태에서도 `/dashboard` 에 들어가진다.
  `middleware.ts` 에서 `createRouteMatcher` 와 `auth.protect()` 로 로그인한 사람만 들어가게 막아야 한다.
- Supabase 연결하고 보드 데이터 저장하기
