# Trello Clone 클론 코딩 (6) — 보드 상세 페이지: 보드 불러오기와 헤더

참고 영상: https://www.youtube.com/watch?v=ugxI1o5SyMs
영상 구간: `02:32:00` 보드 상세 페이지

(5)편 대시보드에서 보드 카드를 누르면 `/boards/보드id` 로 이동한다. 그런데 그 주소에 페이지가 없어서 404가 떴다.
이번 글에서는 그 **보드 상세 페이지**를 만든다.

컬럼과 태스크는 아직 그리지 않는다. 이번 편은 아래 두 가지까지다.

- 주소의 보드 id로 **보드와 컬럼을 불러오기**
- 위쪽 **헤더**에 "← Back to dashboard | 보드 제목" 보여 주기

작업 순서는 이렇다.

1. Navbar에 보드 페이지용 헤더 추가 — `components/navbar.tsx`
2. `/boards/[id]` 페이지 파일 만들기 — `app/boards/[id]/page.tsx`
3. 보드 하나와 컬럼을 불러오는 함수 추가 — `lib/services.ts`
4. 그 함수를 부르는 `useBoard` 훅 만들기 — `lib/hooks/useBoards.ts`
5. 페이지에서 보드 제목을 꺼내 Navbar에 넘기기

---

## 0. 완성 화면 구조

```
┌──────────────────────────────────────────────────┐
│ ← Back to dashboard │ ▦ 보드 제목                   │  ← 보드 페이지 헤더
├──────────────────────────────────────────────────┤
│                                                  │
│   (회색 배경 — 컬럼은 다음 편에서 그린다)            │
│                                                  │
└──────────────────────────────────────────────────┘

작은 화면:
┌────────────────────────┐
│ ← Back  ▦ 보드 제목      │   ← 글자가 짧아지고 구분선이 사라짐
└────────────────────────┘
```

---

## 1. Navbar에 보드 페이지용 헤더 추가

`components/navbar.tsx`

### 1-1. Props 받기 — 제목은 페이지가 알려 준다

```tsx
interface Props{
    boardTitle?: string;
    onEditBoard?: ()=> void;
}

export default function Navbar({boardTitle, onEditBoard} : Props){
```

- 지금까지 Navbar는 아무 값도 받지 않았다.
- 보드 페이지 헤더에는 **보드 제목**이 들어가야 한다. 그런데 어떤 보드인지는 Navbar가 아니라 **페이지**가 안다.
- 그래서 페이지가 Navbar에 값을 넘겨주도록 **Props**(부모 컴포넌트가 자식에게 건네주는 값)를 만든다.

| Props | 역할 |
|---|---|
| `boardTitle` | 헤더에 보여 줄 보드 제목 |
| `onEditBoard` | ⋯ 버튼을 눌렀을 때 실행할 함수. `()=> void` 는 "인자도 없고 돌려주는 값도 없는 함수"라는 타입 |

- 이름 뒤의 `?` 는 **선택**이라는 뜻이다. 안 넘겨도 된다.
- 메인 페이지(`app/page.tsx`)와 대시보드는 지금도 `<Navbar/>` 로 아무것도 넘기지 않는다. `?` 가 없으면 이 두 곳에서 "`boardTitle` 이 빠졌다"는 타입 에러가 난다.

### 1-2. 지금 보드 페이지인지 확인하기

```tsx
const pathname = usePathname()

const isDashboardPage = pathname === "/dashboard"
const isBoardPage = pathname.startsWith("/boards/")
```

- `usePathname()`: 지금 주소에서 경로 부분(`/boards/abc`)을 돌려준다.
- `isBoardPage` 는 대시보드 Navbar를 만들 때 미리 만들어 두고 쓰지 않던 변수다. 이번에 처음 쓴다.
- `startsWith("/boards/")`: 주소가 `/boards/` 로 **시작하면** `true`.
  - 보드 id는 보드마다 다르다(`/boards/abc`, `/boards/xyz`). 그래서 `===` 로 정확히 비교할 수 없다.

이제 Navbar는 주소에 따라 세 가지 모양이 된다.

| 주소 | 조건 | 모양 |
|---|---|---|
| `/dashboard` | `isDashboardPage` | 로고 + 프로필 버튼(`UserButton`) |
| `/boards/...` | `isBoardPage` | 뒤로 가기 + 보드 제목 **(이번에 추가)** |
| 그 밖(`/`) | 마지막 `return` | 로고 + 로그인 / Go to Dashboard 버튼 |

`if` 안에서 `return` 하면 함수가 거기서 끝난다. 그래서 아래의 다른 모양은 그려지지 않는다. (5)편의 로딩 화면과 같은 "먼저 돌려주기" 방식이다.

### 1-3. 헤더 모양 그리기

```tsx
if(isBoardPage){
    return(
        <header className='bg-white border-b sticky top-0 z-50'>
            <div className='container mx-auto px-4 py-3 sm:py-4'>
                <div className='flex items-center justify-between'>
                    <div className='flex items-center space-x-2 sm:space-x-4 min-w-0'>
                        <Link href='/dashboard' className='flex items-center space-x-1 sm:space-x-2 text-gray-600 hover:text-gray-900 flex-shrink-0'>
                            <ArrowLeft className='h-4 w-4 sm:h-5 sm:w-5'/>
                            <span className='hidden sm:inline'>Back to dashboard</span>
                            <span className='sm:hidden'>Back</span>
                        </Link>
                        <div className='h-4 sm:h-6 w-px bg-gray-300 hidden sm:block'/>
                        <div className='flex items-center space-x-1 sm:space-x-2 min-w-0'>
                            <SquareKanban className='text-blue-600'/>
                            <div className='flex text-lg items-center space-x-1 sm:space-x-2 min-w-0'>
                                <span className='text-lg font-bold text-gray-900 truncate'>
                                    {boardTitle}
                                </span>
                                {onEditBoard && (
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className='h-7 w-7 flex-shrink-0 p-0'
                                        onClick={onEditBoard}
                                    >
                                        <MoreHorizontal/>
                                    </Button>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </header>
    )
}
```

아이콘 `ArrowLeft`, `MoreHorizontal` 은 import에 추가한다.

```tsx
import { ArrowLeft, ArrowRight, MoreHorizontal, SquareKanban } from 'lucide-react'
```

위에서부터 한 덩어리씩 보자.

**① 바깥 틀 — `<header>`**

- `sticky top-0`: 스크롤해도 화면 맨 위에 붙어 있는다.
- `z-50`: 겹칠 때 다른 요소보다 위에 보이게 하는 순서(z-index)다. 나중에 컬럼이 아래로 스크롤돼도 헤더를 덮지 않는다.
- `container mx-auto px-4`: 폭을 제한하고 가운데 정렬한다. 다른 Navbar와 같다.
- 다른 Navbar는 `bg-white/80 backdrop-blur-sm`(반투명 + 뒤 흐림)이다. 보드 헤더는 그냥 `bg-white`(불투명)다.
- `flex justify-between`: 왼쪽과 오른쪽 끝으로 벌린다. 지금은 안에 왼쪽 묶음 하나뿐이라 티가 나지 않는다.

**② 왼쪽 묶음 — `min-w-0`**

```tsx
<div className='flex items-center space-x-2 sm:space-x-4 min-w-0'>
```

- `flex` 안의 요소는 기본적으로 **내용보다 작아지지 않으려고** 한다. 그래서 보드 제목이 아주 길면 헤더 밖으로 삐져나간다.
- `min-w-0`(최소 폭 0)으로 "필요하면 줄어들어도 된다"고 허락한다. 이게 있어야 아래 `truncate`(말줄임)가 동작한다.

**③ 뒤로 가기 링크 — `flex-shrink-0`, `hidden sm:inline`**

```tsx
<Link href='/dashboard' className='... flex-shrink-0'>
    <ArrowLeft className='h-4 w-4 sm:h-5 sm:w-5'/>
    <span className='hidden sm:inline'>Back to dashboard</span>
    <span className='sm:hidden'>Back</span>
</Link>
```

- `href='/dashboard'`: 누르면 대시보드로 돌아간다.
- `flex-shrink-0`: ②와 반대다. 이 링크는 **절대 줄어들지 않는다.** 제목이 길어져도 "Back" 글자는 찌그러지지 않는다.
- 같은 자리에 글자를 두 개 넣고, 화면 크기에 따라 하나만 보여 준다.

| 클래스 | 작은 화면 (640px 미만) | `sm` 이상 |
|---|---|---|
| `hidden sm:inline` | 숨김 | **"Back to dashboard"** 보임 |
| `sm:hidden` | **"Back"** 보임 | 숨김 |

- 아이콘도 `h-4 w-4` → `sm:h-5 sm:w-5` 로 큰 화면에서 조금 커진다.

**④ 세로 구분선**

```tsx
<div className='h-4 sm:h-6 w-px bg-gray-300 hidden sm:block'/>
```

- 내용이 없는 `div` 에 폭 1px(`w-px`), 높이, 회색 배경을 주면 **세로 줄**이 된다.
- `hidden sm:block`: 작은 화면에서는 숨긴다.
- 안에 넣을 내용이 없어서 `<div ... />` 처럼 혼자 닫았다(JSX에서는 이렇게 쓸 수 있다).

**⑤ 보드 제목**

```tsx
<SquareKanban className='text-blue-600'/>
<span className='text-lg font-bold text-gray-900 truncate'>
    {boardTitle}
</span>
```

- `{boardTitle}`: 페이지에서 Props로 넘겨받은 제목을 그대로 보여 준다.
- `truncate`: 한 줄로 두고, 넘치면 뒤를 `...` 로 자른다.

> **영상과 다른 점**
> 영상은 `lucide-react` 의 `Trello` 아이콘을 쓴다. 설치된 lucide-react 1.x에는 브랜드 아이콘이 없어서, 이전 편들처럼 `SquareKanban` 으로 바꿨다.

**⑥ ⋯ 버튼 — 조건부로 그리기**

```tsx
{onEditBoard && (
    <Button variant="ghost" size="sm" className='h-7 w-7 flex-shrink-0 p-0' onClick={onEditBoard}>
        <MoreHorizontal/>
    </Button>
)}
```

- `A && (B)`: A가 있을 때만 B를 그린다(**조건부 렌더링**).
  - 페이지가 `onEditBoard` 를 넘겨주면 → 버튼이 보인다.
  - 안 넘겨주면 → 아무것도 안 그린다.
- `variant="ghost"`: 배경 없는 버튼.
- `h-7 w-7 p-0`: 안쪽 여백 없이 아이콘만 들어가는 작은 정사각형.
- `MoreHorizontal`: 가로 점 세 개(⋯) 아이콘.
- 지금은 페이지에서 `onEditBoard` 를 넘기지 않아서 **버튼이 보이지 않는다.** 보드 수정 기능을 만들 때 연결한다.

---

## 2. `/boards/[id]` 페이지 만들기

### 2-1. 폴더 이름 `[id]` — 동적 라우트

```
app/
├── page.tsx              → /
├── dashboard/
│   └── page.tsx          → /dashboard
└── boards/
    └── [id]/
        └── page.tsx      → /boards/아무거나
```

- App Router에서는 **폴더 이름이 곧 주소**다.
- 대괄호 `[id]` 는 "이 자리에 무엇이 오든 이 페이지를 보여 줘라"는 뜻이다. 이걸 **동적 라우트**(주소 일부가 바뀌는 경로)라고 한다.
  - `/boards/1`, `/boards/7f3a...` 모두 이 파일 하나가 처리한다.
- 대괄호 안의 이름 `id` 가 나중에 값을 꺼낼 때 쓰는 이름이 된다.

(5)편 보드 카드의 `<Link href={`/boards/${board.id}`}>` 가 이제 404 대신 이 페이지로 온다.

### 2-2. 주소에서 id 꺼내기 — `useParams`

```tsx
'use client'

import Navbar from "@/components/navbar";
import { useParams } from "next/navigation";

export default function BoardPage(){

    const {id} = useParams<{id:string}>();
    // ...
}
```

- `useParams()`: 지금 주소의 동적 부분을 **객체**로 돌려주는 훅이다.
  - `/boards/abc` → `{ id: "abc" }`
- 객체라서 `{ }` 로 꺼낸다. ((5)편에서 헷갈렸던 `useState` 는 배열이라 `[ ]` 였다.)
- `<{id:string}>`: "`id` 는 문자열"이라고 타입을 알려 준다. 이걸 안 쓰면 `id` 타입이 `string | string[]` 로 잡혀서, 문자열만 받는 함수에 넘길 때 에러가 난다.
- `'use client'`: `useParams` 같은 **훅**은 클라이언트 컴포넌트에서만 쓸 수 있다. 4번에서 만드는 `useBoard` 도 훅이다.

> **참고: 왜 `params` 대신 `useParams` 일까?**
> 페이지 함수는 `function Page({ params })` 처럼 주소 값을 Props로 받을 수도 있다. 그런데 Next.js 15부터 이 `params` 는 **Promise**(값이 나중에 도착하는 상자)다. `await` 나 React의 `use()` 로 열어야 값을 꺼낼 수 있다.
> `'use client'` 컴포넌트는 `async` 함수가 될 수 없어서 `await` 를 못 쓴다. `useParams()` 는 이런 과정 없이 바로 값을 준다.

---

## 3. 보드 하나와 컬럼 불러오기 — `lib/services.ts`

페이지에 필요한 데이터는 두 가지다.

- **보드 1개** — 제목을 헤더에 보여 줄 때
- **그 보드의 컬럼들** — 다음 편에서 To Do / In Progress ... 를 그릴 때

### 3-1. `boardService.getBoard` — 보드 하나

```ts
export const boardService = {
    async getBoard(supabase: SupabaseClient,
        boardId: string
    ) : Promise<Board>{
        const {data, error} = await supabase
        .from("boards")
        .select("*")
        .eq("id", boardId)
        .single()

        if(error) throw error

        return data
    },

    async getBoards(...) { ... },   // (4)편
    async createBoard(...) { ... }, // (4)편
}
```

- 이름이 비슷하니 헷갈리지 않게 비교하면 이렇다.
  - `getBoards`(복수, (4)편): 내 보드 **전부**
  - `getBoard`(단수, 이번 편): id로 보드 **하나**
- `.eq("id", boardId)`: `id` 컬럼이 `boardId` 인 행만 가져온다.
- `.single()`: 결과를 배열(`[ {...} ]`)이 아니라 **객체 하나**(`{...}`)로 받는다. 그래서 반환 타입도 `Board[]` 가 아니라 `Board` 다.
  - 결과가 0개이거나 2개 이상이면 에러를 낸다.
- 남의 보드 id를 주소창에 쳐도 볼 수 없다. (4)편에서 만든 **RLS 정책**이 내 보드만 돌려주기 때문이다. 결과가 0개가 되고, `.single()` 이 에러를 낸다.

### 3-2. `columnService.getColumns` — 보드의 컬럼들

```ts
export const columnService = {
    async getColumns(supabase: SupabaseClient, boardId: string) : Promise<Column[]>{
        const {data, error} = await supabase
        .from("columns")
        .select("*")
        .eq("board_id", boardId)
        .order("sort_order", { ascending: true})

        if(error) throw error

        return data || [];
    },

    async createColumn(...) { ... }, // (4)편
}
```

- `.eq("board_id", boardId)`: 이 보드에 속한 컬럼만 가져온다.
- `.order("sort_order", { ascending: true })`: `sort_order` 가 작은 것부터(오름차순) 정렬한다.
  - (4)편 `createBoardWithDefaultColumns` 에서 To Do `0`, In Progress `1`, Review `2`, Done `3` 으로 넣었다. 그래서 화면 왼쪽부터 이 순서로 나온다.
- `data || []`: 데이터가 없으면 빈 배열을 돌려준다.

> (4)편에서 `columnService` 안에 있던 `getBoards` 는 `boardService.getBoards` 와 하는 일이 같아서 주석 처리했었다. 이번에 그 주석을 지우고, 같은 자리에 **컬럼을 가져오는** `getColumns` 를 만들었다. `columnService` 에 들어갈 건 컬럼 함수였던 셈이다.

### 3-3. `boardDataService.getBoardWithColumns` — 둘을 한 번에

```ts
export const boardDataService = {

    async getBoardWithColumns(supabase: SupabaseClient, boardId: string){
        const [board, columns] = await Promise.all([
            boardService.getBoard(supabase, boardId),
            columnService.getColumns(supabase, boardId)
        ])

        if(!board) throw new Error("보드를 찾을 수 없습니다")

        return{
            board,
            columns
        }
    },

    async createBoardWithDefaultColumns(...) { ... }, // (4)편
}
```

- `boardDataService` 는 (4)편의 `createBoardWithDefaultColumns` 처럼 **보드 + 컬럼을 묶어서** 다루는 곳이다. 이번에는 "만들기"가 아니라 "불러오기"다.
- `Promise.all([A, B])`: A와 B를 **동시에** 출발시키고, 둘 다 끝날 때까지 기다린다.
  - 결과는 넣은 순서대로 배열 `[A결과, B결과]` 로 온다. 그래서 `[board, columns]` 처럼 `[ ]` 로 꺼낸다.
  - `await` 를 두 번 쓰면 보드 요청이 끝난 **뒤에** 컬럼 요청이 출발한다. `Promise.all` 은 한꺼번에 보내니까 더 빠르다.
  - 둘 중 하나라도 실패하면 전체가 실패한다. 그 에러는 4번 훅의 `catch` 로 간다.

```
getBoardWithColumns(boardId)
├─ boardService.getBoard     → boards 테이블에서 1개      ┐ 동시에 출발
└─ columnService.getColumns  → columns 테이블에서 여러 개  ┘
              ↓ 둘 다 끝나면
        { board, columns }
```

- `if(!board) throw ...`: 보드가 없으면 에러를 던지는 안전장치다.
  - 다만 `getBoard` 가 `.single()` 이라, 보드가 없으면 **이미 거기서** 에러가 난다. 실제로 이 줄까지 오는 일은 거의 없다.

---

## 4. `useBoard` 훅 만들기 — `lib/hooks/useBoards.ts`

서비스 함수를 페이지에서 바로 부르지 않고, (4)편 `useBoards` 처럼 **훅**으로 감싼다. 훅이 "불러오는 중인가 / 에러인가 / 결과"를 state로 들고 있어서, 페이지는 꺼내 쓰기만 하면 된다.

같은 파일 아래에 추가하고, `Column` 타입 import도 추가한다.

```ts
import { Board, Column } from "../supabase/models";

// ... useBoards() 는 그대로 ...

export function useBoard(boardId: string){
    const {supabase} = useSupabase()
    const [board, setBoard] = useState<Board | null>(null)
    const [columns, setColumns] = useState<Column[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    useEffect(()=>{
        if(boardId) {
            loadBoard()
        }
    },[boardId, supabase])

    async function loadBoard() {
        if(!boardId) return

        try{
            setLoading(true)
            setError(null)
            const data = await boardDataService.getBoardWithColumns(supabase!, boardId)
            setBoard(data.board)
            setColumns(data.columns)
        }catch(err){
            setError(err instanceof Error ? err.message : "보드를 불러오지 못했습니다.")
        }finally{
            setLoading(false)
        }
    }

    return{
        board,
        columns,
        loading,
        error
    }
}
```

**state 4개**

| state | 처음 값 | 역할 |
|---|---|---|
| `board` | `null` | 불러온 보드. 처음엔 아직 없어서 `Board \| null` |
| `columns` | `[]` | 불러온 컬럼 목록 |
| `loading` | `true` | 불러오는 중인가. 들어오자마자 불러오니까 `true` 로 시작 |
| `error` | `null` | 에러 메시지 |

**`useEffect` — 언제 불러오나**

- 의존성 배열 `[boardId, supabase]`: 이 값이 바뀌면 다시 불러온다.
  - 다른 보드로 이동해서 주소의 id가 바뀌면 → 새 보드를 불러온다.
- `if(boardId)`: id가 비어 있으면 요청하지 않는다.

**`loadBoard` — 실제로 불러오기**

- `try / catch / finally` 모양은 (4)편 `loadBoards` 와 똑같다.
  - `try`: 불러와서 `setBoard`, `setColumns` 에 넣는다.
  - `catch`: 실패하면 에러 메시지를 `error` 에 넣는다.
  - `finally`: 성공이든 실패든 마지막에 `loading` 을 `false` 로.
- `supabase!`: `!` 는 "이 값은 `null` 이 아니다"라고 TypeScript에게 약속하는 표시다.
  - `SupabaseProvider` 는 supabase 클라이언트가 준비되기 전에는 화면 대신 `Loading...` 만 보여 준다. 그래서 이 훅이 실행될 때는 이미 준비돼 있다.

**`useBoards` 와 비교**

| | `useBoards` ((4)편) | `useBoard` (이번 편) |
|---|---|---|
| 받는 값 | 없음 (`useUser()` 로 user를 직접 꺼냄) | `boardId` |
| 불러오는 것 | 내 보드 목록 | 보드 1개 + 그 보드의 컬럼들 |
| 쓰는 서비스 | `boardService.getBoards` | `boardDataService.getBoardWithColumns` |
| 다시 불러오는 때 | `user`, `supabase` 가 바뀔 때 | `boardId`, `supabase` 가 바뀔 때 |
| 돌려주는 값 | `boards`, `loading`, `error`, `createBoard` | `board`, `columns`, `loading`, `error` |

---

## 5. 페이지에서 보드 제목을 Navbar로 넘기기

`app/boards/[id]/page.tsx` 전체

```tsx
'use client'

import Navbar from "@/components/navbar";
import { useBoard } from "@/lib/hooks/useBoards";
import { useParams } from "next/navigation";


export default function BoardPage(){

    const {id} = useParams<{id:string}>();
    const {board} = useBoard(id)
    return(
        <div className="min-h-screen bg-gray-50">
            <Navbar boardTitle={board?.title} />
        </div>
    )
}
```

- `useBoard(id)`: 2번에서 꺼낸 id로 보드를 불러온다.
- `const {board} = ...`: 지금은 `board` 만 꺼낸다. `columns` 는 다음 편에서 컬럼을 그릴 때 꺼낸다.
- `board?.title`: `?.` 는 **옵셔널 체이닝**이다.
  - 처음 화면이 그려질 때 `board` 는 아직 `null` 이다. 이때 `board.title` 이라고 쓰면 "null에서 title을 읽을 수 없다"는 에러로 화면이 깨진다.
  - `?.` 는 앞이 `null` 이면 거기서 멈추고 `undefined` 를 돌려준다.
  - Navbar의 `boardTitle` 은 `?`(선택)라서 `undefined` 를 받아도 괜찮다.
  - 그래서 불러오는 동안 제목 자리가 잠깐 비어 있다가, 다 불러오면 채워진다.
- `min-h-screen bg-gray-50`: 화면 전체 높이의 연한 회색 배경. 나중에 컬럼이 놓일 바탕이다.
- Navbar가 주소를 보고 `isBoardPage` 로 판단하니까, 페이지는 "보드 페이지용 헤더를 써 줘"라고 따로 말할 필요가 없다. 제목만 넘기면 된다.

---

## 6. 전체 흐름 한눈에 보기

```
대시보드에서 보드 카드 클릭
   ↓  <Link href="/boards/abc">
app/boards/[id]/page.tsx
   ↓  useParams()  →  id = "abc"
useBoard("abc")                                  (lib/hooks/useBoards.ts)
   ↓  useEffect → loadBoard()
boardDataService.getBoardWithColumns(supabase, "abc")   (lib/services.ts)
   ├─ boardService.getBoard     ─┐
   └─ columnService.getColumns  ─┘ Promise.all (동시에)
   ↓  Supabase (RLS: 내 보드만)
setBoard(...) / setColumns(...)
   ↓  화면 다시 그림
<Navbar boardTitle={board?.title} />
   ↓  isBoardPage === true → 보드용 헤더
"← Back to dashboard │ ▦ 보드 제목"
```

---

## 7. 아직 안 된 것

| 항목 | 지금 상태 |
|---|---|
| ⋯ 버튼 | 페이지에서 `onEditBoard` 를 안 넘겨서 보이지 않음 |
| 로딩·에러 화면 | `loading`, `error` 를 꺼내지 않음. 불러오는 동안 제목이 비어 있고, 실패해도 아무 표시가 없음 |
| 컬럼 | `columns` 는 불러왔지만 아직 그리지 않음 |
| 없는 보드 / 남의 보드 id | 에러 화면 없이 제목만 비어 있음 |

---

## 8. 고친 부분 — 제목 묶음에 `flex` 가 빠져 있었다

다 만들고 코드를 다시 보니, 제목과 ⋯ 버튼을 감싸는 `div` 에 `flex` 가 빠져 있었다. 위 1-3 코드는 고친 버전이다.

```tsx
// ❌ 처음
<div className='text-lg items-center space-x-1 sm:space-x-2 min-w-0'>

// ✅ 고친 뒤
<div className='flex text-lg items-center space-x-1 sm:space-x-2 min-w-0'>
    <span className='text-lg font-bold text-gray-900 truncate'>{boardTitle}</span>
    ...
</div>
```

`flex` 가 없을 때 생기던 일은 이렇다.

| 클래스 | `flex` 없을 때 | `flex` 넣은 뒤 |
|---|---|---|
| `items-center` | 아무 효과 없음 (`flex` 와 같이 써야 동작) | 제목과 ⋯ 버튼이 세로 가운데로 맞음 |
| `truncate` (`span`) | 긴 제목이 `...` 로 안 잘리고 그대로 길게 나옴 | 넘치면 `...` 로 잘림 |
| `min-w-0` | 의미 없음 | 이 묶음이 줄어들 수 있게 허락 → `truncate` 가 동작 |

- `truncate` 가 안 됐던 이유: `<span>` 은 원래 글자처럼 옆으로 흐르는 요소라서 넘치는 부분을 잘라내지 못한다. 부모가 `flex` 가 되면 `span` 이 **상자처럼** 바뀌어서 그때부터 잘라낼 수 있다.
- 바로 바깥 `div` 가 `flex items-center space-x-1 sm:space-x-2 min-w-0` 이라, 이 `div` 도 같은 모양이 맞다고 보고 `flex` 를 넣었다.
- 제목이 짧을 때는 차이가 거의 안 보여서 알아채기 어려웠다.

> (5)편에서 정리한 것처럼 Tailwind 클래스는 그냥 문자열이다. 그래서 빠지거나 틀려도 `npx tsc --noEmit` 은 통과하고, 화면에서만 조금 어긋난다.

---

## 9. 결과

대시보드에서 보드 카드를 누르면 `/boards/보드id` 로 이동한다.

- 위에 **"← Back to dashboard │ ▦ 보드 제목"** 헤더가 나온다.
- **Back to dashboard** 를 누르면 대시보드로 돌아간다.
- 화면 폭을 줄이면 "Back" 으로 짧아지고 세로 구분선이 사라진다.
- 스크롤해도 헤더는 위에 붙어 있다.

다음 편에서는 불러온 `columns` 로 To Do / In Progress / Review / Done 컬럼을 그린다.
