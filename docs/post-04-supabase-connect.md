# Trello Clone 클론 코딩 (4) — Clerk 로그인으로 Supabase에 보드 저장하기

참고 영상: https://www.youtube.com/watch?v=ugxI1o5SyMs
영상 구간: `??:??:??`

(3)편에서 Supabase에 `boards`·`columns`·`tasks` 테이블을 만들었다.
이번 글에서는 **Next.js 코드에서 그 테이블에 실제로 데이터를 넣는다.**
목표는 대시보드의 **Create Board** 버튼을 누르면 보드 1개와 기본 리스트 4개(To Do, In Progress, Review, Done)가 저장되는 것이다.

코드보다 **설정 때문에 훨씬 오래 막혔다.** 에러를 하나 고치면 다음 에러가 나왔다.
그래서 먼저 **각 파일과 설정이 무슨 역할인지** 정리하고, 그다음 코드와 막혔던 부분을 순서대로 적는다.

---

## 0. 먼저 큰 그림: 누가 무슨 일을 하나

비유로 보면 이렇다.

| 등장인물 | 비유 | 하는 일 |
|---|---|---|
| **Clerk** | 신분증 발급처 | 로그인을 처리하고, 로그인한 사람에게 **토큰(JWT)** 을 발급한다 |
| **토큰(JWT)** | 신분증 | 안에 `sub`(사용자 ID, `user_3LXz...`)가 적혀 있다 |
| **Supabase Third-party Auth** | "Clerk 신분증도 받아 줌" 등록 | Supabase가 Clerk이 발급한 토큰을 믿게 만든다 |
| **Data API (Exposed tables)** | 창구 열기 | 테이블을 앱(브라우저)에서 접근할 수 있게 연다 |
| **grant** | 출입 권한 | 로그인한 사용자(`authenticated`)가 테이블을 읽고 쓸 수 있게 허락한다 |
| **RLS 정책** | 경비원 | 행(row) 하나하나마다 "이건 네 거 맞아?"를 검사한다 |
| **`requesting_user_id()`** | 신분증에서 이름 읽기 | 토큰 안의 `sub` 를 꺼내 주는 SQL 함수 |

요청 하나가 지나가는 길은 이렇다.

```
[Create Board 버튼]
   │ handleCreateBoard()
   ▼
useBoards.createBoard()                ← lib/hooks/useBoards.ts
   │ useSupabase()로 받은 supabase 클라이언트를 넘김
   ▼
boardDataService.createBoardWithDefaultColumns()   ← lib/services.ts
   │ 1) boards 에 insert  2) columns 에 4개 insert
   ▼
supabase 클라이언트                      ← lib/supabase/SupabaseProvider.tsx
   │ 요청마다 Clerk 토큰을 붙여서 보냄 (accessToken 옵션)
   ▼
Supabase 서버
   ├─ 토큰 검사: Clerk이 발급한 거 맞나?     ← Third-party Auth
   ├─ 테이블이 열려 있나?                   ← Data API Exposed tables
   ├─ authenticated 역할에 권한이 있나?      ← grant
   └─ 이 행이 네 거 맞나?                   ← RLS 정책 (requesting_user_id() = user_id)
   ▼
저장 성공 🎉
```

**네 개의 검문소 중 하나라도 막히면 에러가 난다.** 이번에 하나씩 다 걸렸다(6번 참고).

### 파일 역할 한 줄 요약

| 파일 | 역할 | 지금 쓰나 |
|---|---|---|
| `lib/supabase/models.ts` | 테이블 한 줄이 어떤 모양인지 TypeScript 타입으로 적어 둔 것 | ✅ |
| `lib/supabase/SupabaseProvider.tsx` | Clerk 토큰을 붙인 Supabase 클라이언트를 **한 번 만들어서** 앱 전체에 나눠 줌 | ✅ |
| `app/layout.tsx` | 앱 전체를 `SupabaseProvider` 로 감쌈 | ✅ |
| `lib/services.ts` | 실제 DB 작업(보드 조회·생성, 리스트 생성) 함수 모음 | ✅ |
| `lib/hooks/useBoards.ts` | 화면(컴포넌트)에서 쓰기 편하게 services를 감싼 훅 | ✅ |
| `lib/supabase/client.ts` | 브라우저용 클라이언트를 만드는 함수 | ❌ Provider로 대체됨 |
| `lib/supabase/server.ts` | 서버(서버 컴포넌트 등)용 클라이언트를 만드는 함수 | ❌ 아직 안 씀 |

---

## 1. `models.ts` — 데이터의 모양 정하기

`lib/supabase/models.ts`

```ts
export interface Board{
    id: string;
    title: string;
    description: string | null;
    color: string;
    user_id: string;
    created_at: string;
    updated_at: string; // 업데이트 여부 확인용 컬럼 추가
}

export interface Column{
    id:string;
    board_id: string;
    title: string;
    sort_order: number;
    created_at: string;
    user_id: string;
}

export interface Task{
    id: string;
    column_id: string;
    title: string;
    description: string | null;
    assignee: string | null;
    due_date: string | null;
    priority: "low" | "medium" | "high" ;
    sort_order: number;
    created_at: string;
    updated_at: string;
}
```

- 테이블 컬럼과 **이름을 똑같이** 맞춘다. Supabase가 돌려주는 데이터가 이 모양이다.
- `string | null`: 비어 있을 수 있는 컬럼(Is Nullable 체크한 컬럼).
- 날짜(`created_at`, `due_date`)도 JSON으로 오면 문자열이라 `string`.
- `priority` 는 세 값 중 하나만 오도록 좁혔다.
- `Column` 의 `user_id` 는 영상 중간에 추가하라고 해서 넣었다. Supabase `columns` 테이블에도 같은 이름의 컬럼을 만들어야 한다(4-1).

> **영상과 다른 점**
> - `Board` 에 `updated_at` 을 추가했다. (3)편에서 `boards` 테이블에 `updated_at` 컬럼을 추가했기 때문이다.
> - 테이블의 `id` 는 `int8`(숫자)인데 타입은 `string` 이다. 영상이 `string` 이라 그대로 따랐다. 실제로 오는 값은 숫자라서, 나중에 `===` 로 비교할 때 주의해야 한다.

---

## 2. Supabase 클라이언트 — `client.ts`, `server.ts`

**클라이언트**는 "Supabase에 요청을 보내는 리모컨"이다. URL과 anon 키를 넣어 한 번 만들어 두고, `supabase.from("boards").insert(...)` 처럼 쓴다.

`lib/supabase/server.ts` — 서버에서 쓰는 클라이언트

```ts
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function createClient() {
    const cookieStore = await cookies();

    return createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies:{
                getAll(){
                    return cookieStore.getAll()
                },
                setAll(cookiesToSet){
                    try{
                        cookiesToSet.forEach(({name, value, options}) =>
                            cookieStore.set(name, value, options)
                        );
                    }catch{}
                }
            }
        }
    )
}
```

- `next/headers` 의 `cookies()` 는 **서버에서만** 쓸 수 있다. 그래서 이 파일은 서버 컴포넌트·서버 액션 전용이다.
- `setAll` 의 `try/catch`: 서버 컴포넌트에서는 쿠키를 쓸 수 없어서 에러가 나는데, 그걸 조용히 무시하는 것이다(Supabase 공식 예제 그대로).
- 이번에는 아직 쓰지 않는다.

`lib/supabase/client.ts` — 브라우저에서 쓰는 클라이언트

```ts
import { useSession } from '@clerk/nextjs';
import {createBrowserClient} from '@supabase/ssr'

export function createClient(){
    const {session} = useSession()

    return createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            accessToken: async () => session?.getToken() ?? null
        }
    );
}
```

- `accessToken` 옵션: **요청을 보낼 때마다 Clerk 토큰을 꺼내 붙이라**는 뜻이다. 이게 "Clerk 로그인으로 Supabase를 쓴다"의 핵심이다.
- 처음에는 `services.ts` 맨 위에서 `const supabase = createClient()` 로 한 번 만들어 쓰려고 했다.
  그런데 `useSession()` 은 **React 훅**이라 컴포넌트 안에서만 부를 수 있다. 파일 맨 위에서 부르면 동작하지 않는다.
- 그래서 이 역할을 다음 단계의 **`SupabaseProvider`** 가 대신 맡았다. 지금 이 파일은 쓰지 않는다.

---

## 3. `SupabaseProvider` — 클라이언트를 한 번 만들어 앱 전체에 나눠 주기

**Provider(제공자)** 는 React Context를 이용해 "값 하나를 만들어서 아래 모든 컴포넌트가 꺼내 쓰게 하는" 패턴이다.
여기서 나눠 주는 값은 **Clerk 토큰이 붙은 Supabase 클라이언트**다.

`lib/supabase/SupabaseProvider.tsx`

```tsx
'use client'

import { useSession } from "@clerk/nextjs";
import { createClient, SupabaseClient } from "@supabase/supabase-js"
import { createContext, useContext, useEffect, useState } from "react";

type SupabaseContext = {
    supabase: SupabaseClient | null;
    isLoaded: boolean
}

const Context = createContext<SupabaseContext>({
    supabase: null, isLoaded: false
});

export default function SupabaseProvider({children}:{children:React.ReactNode}){

    const {session} = useSession();
    const [supabase, setSupabase] = useState<SupabaseClient | null>(null)
    const [isLoaded, setIsLoaded] = useState<boolean>(false)

    useEffect(()=>{
        if(!session) return;

        const client = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
            {
                accessToken: async () => session?.getToken() ?? null
            }
        )

        setSupabase(client)
        setIsLoaded(true)
    },[session])

    return(
        <Context.Provider value={{supabase, isLoaded}}>
            {!isLoaded ? <div> Loading... </div> : children}
        </Context.Provider>
    )
}

export const useSupabase = () => {
    const context = useContext(Context)
    if(context === undefined) {
        throw new Error("useSupabase는 provider 내부에 있어야 합니다.")
    }
    return context
}
```

순서대로 보면:

1. `createContext<SupabaseContext>(...)`: 나눠 줄 값의 **상자**를 만든다. 상자 안에는 `supabase`(클라이언트)와 `isLoaded`(준비 끝났나)가 들어간다.
2. `useSession()`: Clerk에서 지금 로그인 세션을 가져온다.
3. `useEffect(..., [session])`: 세션이 생기면(=로그인하면) 그때 클라이언트를 만든다.
   - `createClient` 는 `@supabase/supabase-js` 의 기본 함수다. `accessToken` 옵션으로 Clerk 토큰을 붙인다.
4. `<Context.Provider value=...>`: 만든 클라이언트를 상자에 넣어 아래 컴포넌트들에게 내려 준다. 준비 전에는 `Loading...` 을 보여 준다.
5. `useSupabase()`: 아래 컴포넌트에서 상자를 여는 훅. `const { supabase } = useSupabase()` 로 꺼낸다.

`app/layout.tsx` 에서 앱 전체를 감싼다. **`ClerkProvider` 안쪽**이어야 `useSession()` 을 쓸 수 있다.

```tsx
<ClerkProvider>
  <html lang="en">
    <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
      <SupabaseProvider>
        {children}
      </SupabaseProvider>
    </body>
  </html>
</ClerkProvider>
```

> **주의:** 로그아웃 상태에서는 `session` 이 없어서 `isLoaded` 가 계속 `false` 다. 그러면 **메인 페이지까지 `Loading...` 만 보인다.**
> 로그인 화면이 안 보이면 이 부분을 의심하자. 나중에 Provider를 대시보드 쪽에만 두거나, 세션이 없을 때도 `children` 을 보여 주도록 고칠 예정이다.

---

## 4. `services.ts` — 실제 DB 작업 모음

`lib/services.ts`

```ts
import { SupabaseClient } from "@supabase/supabase-js";
import { Board, Column } from "./supabase/models";

export const boardService = {
    async getBoards(supabase: SupabaseClient, userId: string): Promise<Board[]>{
        const {data, error} = await supabase
        .from("boards")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false})

        if(error) throw error
        return data || []
    },

    async createBoard(
        supabase: SupabaseClient,
        board: Omit<Board, "id" | "created_at" | "updated_at">
    ): Promise<Board>{
        const {data, error} = await supabase
        .from("boards")
        .insert(board)
        .select()
        .single()

        if(error) throw error
        return data
    }
}

export const columnService = {
    async createColumn(
        supabase: SupabaseClient,
        column: Omit<Column, "id" | "created_at">
    ): Promise<Column>{
        const {data, error} = await supabase
        .from("columns")
        .insert(column)
        .select()
        .single()

        if(error) throw error
        return data
    }
}

export const boardDataService = {
    async createBoardWithDefaultColumns(
        supabase: SupabaseClient,
        boardData:{
            title: string,
            description?: string,
            color?: string,
            userId: string
        }
    ){
        const board = await boardService.createBoard(supabase, {
            title: boardData.title,
            description: boardData.description || null,
            color: boardData.color || "bg-blue-500",
            user_id: boardData.userId
        });

        const defaultColumns = [
            {title: "To Do", sort_order:0},
            {title: "In Progress", sort_order:1},
            {title: "Review", sort_order:2},
            {title: "Done", sort_order:3},
        ];

        await Promise.all(
            defaultColumns.map((column) =>
                columnService.createColumn(supabase, {
                    ...column,
                    board_id: board.id,
                    user_id: boardData.userId
                })
            )
        )

        return board
    }
}
```

- **서비스를 세 개로 나눴다.**
  - `boardService`: `boards` 테이블만 다룬다.
  - `columnService`: `columns` 테이블만 다룬다.
  - `boardDataService`: 둘을 묶어서 "보드 + 기본 리스트 4개 만들기"를 한 번에 한다.
- **모든 함수가 첫 번째 인자로 `supabase` 를 받는다.** 클라이언트는 Provider가 만들고, 서비스는 받아서 쓰기만 한다. 서비스 파일에서 훅을 부르지 않아도 된다.
- `Omit<Board, "id" | "created_at" | "updated_at">`: `Board` 타입에서 세 필드를 **뺀** 타입이다. 이 값들은 DB가 자동으로 채우니까 보낼 때는 필요 없다.
- `.insert(board).select().single()`: 넣고(`insert`), 넣은 줄을 다시 읽어서(`select`), 배열이 아닌 객체 하나로(`single`) 받는다. 그래야 새로 생긴 `board.id` 를 알 수 있다.
- `Promise.all(...)`: 리스트 4개를 **동시에** 넣고, 4개가 다 끝날 때까지 기다린다.

> **영상과 다른 점**
> - 영상은 처음에 파일 맨 위에서 `const supabase = createClient()` 로 만들어 썼다. Clerk 토큰을 붙이려면 훅(`useSession`)이 필요해서, **각 함수가 `supabase` 를 인자로 받도록** 바꿨다.

### 4-1. 리스트(`columns`)에도 `user_id` 저장하기

영상 중간에 리스트에도 주인(`user_id`)을 적어 두라고 해서 따라 했다.

1. **Supabase Table Editor → `columns` 테이블 → 컬럼 추가**: 이름 `user_id`, 타입 `text`.
   `boards.user_id` 와 같은 Clerk 사용자 ID(`user_3LXz...`) 문자열이 들어간다.
2. **`models.ts`**: `Column` 에 `user_id: string` 추가 (1번 코드).
3. **`services.ts`**: 기본 리스트 4개를 만들 때 `user_id: boardData.userId` 를 함께 넣는다 (위 코드).

- 지금 RLS 정책(6-3)은 여전히 `boards` 를 거쳐서 주인을 확인한다. 그래서 `columns.user_id` 는 아직 정책에서 쓰이지 않는다. 저장만 해 두는 상태다.
- 컬럼 이름은 **DB와 코드에서 글자 하나까지 똑같아야** 한다. 대소문자도 구분한다. 여기서 한 번 막혔다(7번 ④).

---

## 5. `useBoards` 훅과 대시보드 버튼

`lib/hooks/useBoards.ts`

```ts
"use client"

import { useUser } from "@clerk/nextjs"
import { useState } from "react";
import { Board } from "../supabase/models";
import { boardDataService } from "../services";
import { useSupabase } from "../supabase/SupabaseProvider";

export function useBoards(){

    const {user} = useUser();
    const {supabase} = useSupabase()
    const [boards, setBoards] = useState<Board[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    async function createBoard(boardData:{
        title: string,
        description?: string,
        color?: string
    }) {
        if(!user) throw new Error("사용자가 인증되지 않았습니다.")

        try{
            const newBoard = await boardDataService.createBoardWithDefaultColumns(
                supabase!,
                { ...boardData, userId: user?.id }
            )
            setBoards((prev) => [newBoard, ...prev])
        }catch(err){
            setError(err instanceof Error ? err.message : "보드를 생성하지 못했습니다.")
        }
    }

    return {boards, loading, error, createBoard}
}
```

- `useUser()` 로 Clerk 사용자 ID(`user.id` = `user_3LXz...`)를 가져와 `userId` 로 넘긴다. 이 값이 `boards.user_id` 에 저장된다.
- `useSupabase()` 로 Provider가 만든 클라이언트를 꺼낸다.
- 만든 보드는 `setBoards` 로 목록 맨 앞에 추가한다.

`app/dashboard/page.tsx` (버튼 부분)

```tsx
const {createBoard} = useBoards()

const handleCreateBoard = async () => {
    await createBoard({title: "New Board"})
}

<Button className="w-full sm:w-auto" onClick={handleCreateBoard}>
    <Plus className="h-4 w-4 mr-2"/>
    create Board
</Button>
```

### 5-1. 대시보드에 들어오면 내 보드 불러오기 — `loadBoards`

Supabase 세팅의 마지막 조각이다. 저장(`createBoard`)만 있던 훅에 **불러오기**를 붙였다.

`lib/hooks/useBoards.ts` (추가한 부분)

```ts
import { useEffect, useState } from "react";
import { boardDataService, boardService } from "../services";

// ... useState 들 아래

useEffect(()=>{
    if(user) {
        loadBoards()
    }
},[user, supabase])

async function loadBoards() {
    if(!user) return

    try{
        setLoading(true)
        setError(null)
        const data = await boardService.getBoards(supabase!, user.id)
        setBoards(data)
    }catch(err){
        setError(err instanceof Error ? err.message : "보드를 불러오지 못했습니다.")
    }finally{
        setLoading(false)
    }
}
```

- `useEffect(..., [user, supabase])`: 화면이 처음 뜰 때, 그리고 `user` 나 `supabase` 가 바뀔 때 안의 코드를 실행한다. Clerk 사용자 정보는 조금 늦게 도착하므로 `if(user)` 로 도착한 뒤에만 불러온다.
- `boardService.getBoards(supabase!, user.id)`: 4번에서 만든 함수. `user_id` 가 내 Clerk ID인 보드를 최신순으로 가져온다. RLS 정책도 같은 조건이라 남의 보드는 애초에 오지 않는다.
- `setLoading(true)` → 끝나면 `finally` 에서 `setLoading(false)`: 성공하든 실패하든 "불러오는 중" 표시를 끝낸다.
- `supabase!`: Provider가 클라이언트를 다 만든 뒤에야 `children` 을 보여 주므로(3번), 여기서는 `null` 이 아니라고 TypeScript에 알려 준다.
- 아직 `boards` 를 화면에 그리지는 않는다. 목록 UI는 다음 편에서 만든다.

> **영상과 다른 점**
> - 영상에는 `columnService` 안에도 `getBoards` 가 있다. `boardService.getBoards` 와 하는 일이 같고 아무 데서도 쓰지 않아서 **주석 처리**했다.
> - 우리 코드에서는 이 함수가 타입 에러를 낸다(7번 ⑤). 영상은 파일 맨 위 `const supabase = createClient()` 를 그대로 쓰기 때문에 에러가 나지 않았던 것으로 보인다.

---

## 6. Supabase 설정 — 검문소 네 개 통과하기

코드를 다 짜도 버튼을 누르면 에러가 났다. Supabase 쪽 설정 네 가지가 모두 맞아야 저장된다.

### 6-1. Clerk ↔ Supabase 연결 (Third-party Auth)

Supabase가 Clerk 토큰을 믿게 만드는 설정이다.

1. https://dashboard.clerk.com/setup/supabase 에서 연결을 켜고 **Clerk 도메인**(`https://***.clerk.accounts.dev`)을 복사한다.
2. Supabase 대시보드 → **Authentication → Third-party Auth** → **Add provider → Clerk** → 복사한 도메인을 붙여 넣는다.

> 양쪽 다 해야 한다. Clerk 쪽 연결을 켜야 토큰에 `role: "authenticated"` 가 들어가고, Supabase 쪽에 등록해야 그 토큰을 받아 준다.

### 6-2. `requesting_user_id()` 함수 — 토큰에서 Clerk ID 꺼내기

SQL Editor에서 실행한다.

```sql
CREATE OR REPLACE FUNCTION requesting_user_id()
RETURNS TEXT AS $$
  SELECT NULLIF(
    current_setting('request.jwt.claims', true)::json->>'sub',
    ''
  )::text;
$$ LANGUAGE SQL STABLE;
```

- `current_setting('request.jwt.claims', true)`: 지금 요청에 붙어 온 토큰 내용(JSON).
- `->>'sub'`: 그중 `sub`(사용자 ID)를 **글자(text)로** 꺼낸다.
- `NULLIF(..., '')`: 빈 문자열이면 `null` 로 바꾼다.

**왜 필요한가?** (3)편에서 정책을 `auth.uid()` 로 만들었다. 그런데 `auth.uid()` 는 사용자 ID를 **uuid 타입으로 바꿔서** 돌려준다.
Clerk ID는 `user_3LXz...` 처럼 uuid가 아니라서 비교가 제대로 되지 않는다. 그래서 글자 그대로 꺼내는 함수를 따로 만들었다.

> **영상과 다른 점**
> - (3)편에 적어 둔 "확인 필요"가 실제로 문제였다. 모든 정책의 `auth.uid()::text` 를 `requesting_user_id()` 로 바꿨다.

### 6-3. RLS 정책을 `requesting_user_id()` 로 바꾸기

**boards** — 기존 정책을 이름 상관없이 전부 지우고 새로 만들었다(이유는 7번).

```sql
-- 1) boards 에 붙은 정책을 전부 삭제
DO $$
DECLARE p record;
BEGIN
  FOR p IN SELECT policyname FROM pg_policies
           WHERE schemaname = 'public' AND tablename = 'boards'
  LOOP
    EXECUTE format('DROP POLICY %I ON public.boards', p.policyname);
  END LOOP;
END $$;

-- 2) 정책 4개 새로 만들기
CREATE POLICY "Users can view their own boards" ON boards
  FOR SELECT USING (requesting_user_id() = user_id);

CREATE POLICY "Users can insert their own boards" ON boards
  FOR INSERT WITH CHECK (requesting_user_id() = user_id);

CREATE POLICY "Users can update their own boards" ON boards
  FOR UPDATE USING (requesting_user_id() = user_id);

CREATE POLICY "Users can delete their own boards" ON boards
  FOR DELETE USING (requesting_user_id() = user_id);
```

- `DO $$ ... $$`: SQL 안에서 반복문을 돌리는 블록.
- `pg_policies` 에서 boards 정책 이름을 하나씩 꺼내 `DROP POLICY` 한다. 정책이 없으면 그냥 넘어간다.

**columns** — 보드 주인만 그 보드의 리스트를 다룰 수 있게.

```sql
CREATE POLICY "Users can view columns from their own boards" ON columns
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM boards
      WHERE boards.id = columns.board_id
      AND boards.user_id = requesting_user_id()
    )
  );

CREATE POLICY "Users can insert columns into their own boards" ON columns
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM boards
      WHERE boards.id = columns.board_id
      AND boards.user_id = requesting_user_id()
    )
  );

CREATE POLICY "Users can update columns from their own boards" ON columns
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM boards
      WHERE boards.id = columns.board_id
      AND boards.user_id = requesting_user_id()
    )
  );

CREATE POLICY "Users can delete columns from their own boards" ON columns
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM boards
      WHERE boards.id = columns.board_id
      AND boards.user_id = requesting_user_id()
    )
  );
```

**tasks** — 이미 있던 정책을 `ALTER POLICY` 로 고쳤다. 예시로 SELECT 하나만 적는다(INSERT는 `with check`, UPDATE·DELETE는 `using` 으로 같은 조건).

```sql
-- 수정 전: boards.user_id = (auth.uid())::text
-- 수정 후:
alter policy "Users can view tasks from their own boards"
on "public"."tasks"
to public
using (
    EXISTS (
      SELECT 1 FROM columns
      JOIN boards ON boards.id = columns.board_id
      WHERE columns.id = tasks.column_id
      AND boards.user_id = requesting_user_id()
    )
);
```

> Policies 화면에서 정책을 눌러 수정하면 Supabase가 위처럼 `alter policy ... to public using (...)` 형태로 보여 준다. 괄호가 겹겹이 붙어 있어도 뜻은 같다.

### 6-4. Data API 열기 + 권한(grant) 주기

**Integrations → Data API → Settings** 에서

- **Exposed tables**: `0 of 3` → `boards`, `columns`, `tasks` 를 체크해서 `3 of 3` → **Save**
- **Exposed functions**: 켜지 않는다. `requesting_user_id()` 는 정책 안에서 DB가 직접 부르는 함수라 API로 열 필요가 없다.
- **Automatically expose new tables**: 꺼 둔다. 대신 테이블을 새로 만들면 여기서 직접 켜야 한다.

그리고 SQL Editor에서 로그인한 사용자에게 권한을 준다.

```sql
grant select, insert, update, delete
on public.boards, public.columns, public.tasks
to authenticated;
```

- `authenticated`: Supabase에서 "로그인한 사용자"를 뜻하는 역할(role). Clerk 토큰의 `role: "authenticated"` 가 여기에 해당한다.
- grant는 "테이블에 들어갈 수 있다"는 출입 권한이고, RLS는 "그 안에서 어떤 줄을 만질 수 있다"는 검사다. **둘 다 있어야 한다.**

---

## 7. 막혔던 부분 정리

### TypeScript 에러

| 에러 | 원인 | 해결 |
|---|---|---|
| `created_at` 이 없다고 함 | `Omit<..., "create_at">` 오타 | `"created_at"` 으로 수정 |
| `'}' expected` | `boardDataService` 객체의 닫는 `}` 누락 | 괄호 추가 |
| `createColumn(...column)` 타입 에러 | 객체를 인자 여러 개로 펼쳐서 넘김 | `createColumn(supabase, { ...column, board_id: board.id })` |
| `'supabase' does not exist in type ...` | `createContext<SupabaseClient>` 로 상자 타입을 잘못 지정 | `createContext<SupabaseContext>` |
| `useContext(context)` 에러 | 변수 이름 대소문자 | `useContext(Context)` |
| `createClient` 인자 개수 에러 | 인자 없는 `./client` 의 `createClient` 를 import | `@supabase/supabase-js` 에서 import |
| ⑤ `Cannot find name 'supabase'` (`services.ts`) | `columnService.getBoards` 가 옛날 방식이라 `supabase` 를 인자로 받지 않음. 파일 맨 위 `const supabase` 는 주석 처리돼 있음 | `boardService.getBoards` 와 중복이라 주석 처리 (5-1) |

> **`npm run dev` 는 타입 에러가 있어도 돌아간다.** 개발 서버는 타입 검사 없이 타입 표시만 지우고 실행하기 때문이다. 그래서 에디터의 빨간 줄을 무시하고 넘어가기 쉽다. 하지만 `npm run build` 는 타입 검사를 해서 실패한다. 수정 후에는 `npx tsc --noEmit` 으로 확인하자.

### Supabase 에러 — 하나 고치면 다음 게 나왔다

**① 403 — 테이블이 API에 안 열려 있음**

- Data API 설정을 보니 `Exposed tables: 0 of 3`.
- 테이블 3개를 열고, `grant ... to authenticated` 실행 → 해결 (6-4).

**② 403 — `new row violates row-level security policy for table "boards"` (code `42501`)**

- 같은 403이지만 이번엔 **테이블엔 들어갔는데 RLS 정책이 거절**한 것이다. `requesting_user_id() = user_id` 가 참이 아니었다.
- Network 탭 **Payload** 에서 `user_id: "user_3LXz..."` 가 제대로 가는 것은 확인했다.
- 정책을 고치려고 `ALTER POLICY "Users can view their own boards" ...` 를 실행했더니
  `ERROR: 42704: policy "Users can view their own boards" for table "boards" does not exist`.
  → **boards 정책이 아예 없었다.** RLS를 켜 놓고 정책이 하나도 없으면 Postgres는 **전부 거절**한다.
- 6-3의 "전부 지우고 새로 만들기" SQL로 해결.

**③ columns 정책이 주석 처리돼 있었다**

- SQL Editor의 저장된 쿼리를 다시 보니 columns `CREATE POLICY` 가 전부 `--` 로 막혀 있었다. 주석은 Run 해도 실행되지 않는다.
- 이대로면 보드는 저장되고, 이어서 리스트를 넣을 때 `... for table "columns"` 에러가 난다.
- 주석을 풀고(`Cmd + /`) 실행 → 해결.

**④ `columns` 에 `user_id` 를 넣었더니 에러 — `user_Id` 오타**

- 4-1에서 코드에 `user_Id`(가운데 `I` 가 대문자)로 적었다. DB 컬럼은 `user_id` 다.
- Postgres는 컬럼 이름의 대소문자를 구분한다. 그래서 Supabase는 `user_Id` 라는 컬럼이 없다며 저장을 거절한다.
- **`npx tsc --noEmit` 은 통과했다.** `models.ts` 와 `services.ts` 양쪽에 똑같이 `user_Id` 로 적어서, TypeScript가 보기엔 서로 맞았기 때문이다. 타입은 DB를 모른다. 타입을 DB 컬럼 이름과 맞추는 건 직접 해야 한다.
- 두 파일 모두 `user_id` 로 고쳐서 해결.

### 디버깅에 쓴 것들

- **Network 탭 → Response**: Supabase가 돌려준 `code`, `message` 를 본다. 403이라도 `message` 가 다르면 원인이 다르다.
- **Network 탭 → Payload**: 내가 실제로 보낸 데이터(`user_id` 등)를 본다.
- **정책 확인 쿼리**: 지금 DB에 실제로 걸려 있는 정책을 본다. 테이블마다 4줄씩, 총 12줄이 나와야 한다.

  ```sql
  select tablename, cmd, qual, with_check
  from pg_policies
  where tablename in ('boards', 'columns', 'tasks')
  order by tablename, cmd;
  ```

> **SQL Editor의 저장된 쿼리는 메모장일 뿐이다.**
> 어느 파일에 적었는지는 DB와 상관없고, **Run 한 것만** DB에 반영된다.
> 그래서 "적어 놨는데 왜 안 되지?" 싶으면 `pg_policies` 로 실제 상태를 확인하는 게 제일 빠르다.

---

## 8. 결과

**Create Board** 를 누르면 Supabase **Table Editor** 에서

- `boards` 에 `New Board` 1줄 (`user_id` = 내 Clerk ID)
- `columns` 에 To Do / In Progress / Review / Done 4줄 (`board_id` = 방금 만든 보드, `user_id` = 내 Clerk ID)

이 생긴다. 🎉

다음에는 만든 보드 목록을 대시보드에 불러와 보여 준다(`getBoards`).
