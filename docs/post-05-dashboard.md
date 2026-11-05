# Trello Clone 클론 코딩 (5) — 대시보드 메인 화면 만들기

참고 영상: https://www.youtube.com/watch?v=ugxI1o5SyMs
영상 구간: `01:57:35` 대시보드 메인 화면

(4)편에서 보드를 Supabase에 **저장하고 불러오는 것**까지 만들었다.
이번 글에서는 불러온 보드를 **대시보드 화면에 그린다.**

화면은 위아래 두 부분으로 나뉜다.

- **상단**: 환영 문구, 통계 카드 4개
- **하단**: "Your Boards" 제목과 버튼들, 검색창, 보드 목록(그리드 / 리스트)

이번 편은 **모양만** 만든다. 검색, 필터, 보드 상세 페이지 같은 기능은 다음 편부터 붙인다.

---

## 0. 완성 화면 구조

```
┌─────────────────────────────────────────────────────┐
│ Navbar                                              │
├─────────────────────────────────────────────────────┤
│ 다시 오신 것을 환영합니다, OO! ✋        [+ create Board] │  ← 상단
│ ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐         │
│ │ Total  │ │ Active │ │ Recent │ │ Active │         │  ← 통계 카드 4개
│ └────────┘ └────────┘ └────────┘ └────────┘         │
├─────────────────────────────────────────────────────┤
│ Your Boards            [▦][☰] [Filter] [+ Create]   │  ← 하단
│ 🔍 Search boards...                                 │
│ ┌──────┐ ┌──────┐ ┌──────┐ ┌┄┄┄┄┄┄┐                 │
│ │Board │ │Board │ │Board │ ┆  +   ┆                 │  ← 보드 목록
│ └──────┘ └──────┘ └──────┘ └┄┄┄┄┄┄┘                 │
└─────────────────────────────────────────────────────┘
```

모두 `app/dashboard/page.tsx` 한 파일에 있다.

---

## 1. `useBoards` 에서 필요한 값 꺼내기

```tsx
'use client'

import { useState } from "react";
import Navbar from "@/components/navbar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useBoards } from "@/lib/hooks/useBoards";
import { useUser } from "@clerk/nextjs";
import { Filter, Grid3X3, List, Loader2, Plus, Rocket, Search, SquareKanban } from "lucide-react";
import { Input } from "@/components/ui/input";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";

export default function DashboardPage(){

    const {user} = useUser()
    const {createBoard, boards, loading, error} = useBoards()
    const [viewMode, setViewMode] = useState<"grid" | "list">("grid")

    const handleCreateBoard = async () => {
        await createBoard({title: "New Board"})
    }
    // ...
}
```

- (4)편에서는 `createBoard` 만 꺼냈다. 이번에는 `boards`(보드 목록), `loading`(불러오는 중인가), `error`(에러 메시지)도 꺼낸다.
- `viewMode`: 보드를 **그리드**로 볼지 **리스트**로 볼지 기억하는 값. 4번에서 쓴다.
- `useState<"grid" | "list">`: 두 글자 중 하나만 들어오도록 타입을 좁혔다. `setViewMode("table")` 처럼 쓰면 TypeScript가 막아 준다.

---

## 2. 로딩·에러 화면 — 먼저 돌려주기

```tsx
if(loading){
    return <div> <Loader2/><span>Loading your boards... </span> </div>
}

if(error){
    return(
        <div>
            <h2> Error loading boards </h2>
            <p>{error}</p>
        </div>
    )
}

return(
    // 원래 화면
)
```

- 컴포넌트 안에서 `return` 을 **여러 번** 쓸 수 있다. 위에서 먼저 걸리면 아래 화면은 그리지 않는다. 이런 걸 "early return(일찍 돌려주기)"이라고 한다.
- `loading` 은 `useBoards` 에서 `true` 로 시작한다. `loadBoards` 가 끝나면 `false` 가 되어 원래 화면이 나온다.
- `Loader2` 는 lucide의 동그란 로딩 아이콘이다.

> **참고**
> - 지금은 로딩·에러 화면에 `Navbar` 가 없다. 보드를 불러오는 잠깐 동안 위쪽 메뉴가 사라졌다가 나타난다.
> - `Loader2` 는 그냥 두면 멈춰 있다. 빙글빙글 돌게 하려면 `className="animate-spin"` 을 붙여야 한다. 둘 다 영상 코드 그대로 두었다.

---

## 3. 상단 — 환영 문구와 통계 카드

### 3-1. 환영 문구

```tsx
<h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">
    다시 오신 것을 환영합니다,{" "}
    {user?.firstName ?? user?.emailAddresses[0]?.emailAddress}! ✋
</h1>
```

- `user?.firstName ?? ...`: 이름이 있으면 이름, 없으면(`null`·`undefined`) 첫 번째 이메일을 보여 준다. `??` 는 "왼쪽이 비어 있으면 오른쪽"이라는 뜻이다.
- `{" "}`: JSX는 줄바꿈 앞뒤 공백을 지운다. 쉼표 뒤에 띄어쓰기를 확실히 넣으려고 공백 한 칸을 문자열로 넣었다.

### 3-2. 통계 카드 4개를 감싸는 그리드

```tsx
<div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-6 sm:mb-8">
    <Card>...</Card>
    <Card>...</Card>
    <Card>...</Card>
    <Card>...</Card>
</div>
```

Tailwind는 **작은 화면이 기본**이고, 앞에 붙은 이름(`sm:`, `lg:`)은 "그 크기 **이상**이면"이라는 뜻이다.

| 접두어 | 화면 너비 | 여기서 하는 일 |
|---|---|---|
| (없음) | 모든 화면 | 한 줄에 2개 (`grid-cols-2`) |
| `sm:` | 640px 이상 | 카드 사이 간격을 넓게 (`gap-6`) |
| `lg:` | 1024px 이상 | 한 줄에 4개 (`grid-cols-4`) |

그래서 휴대폰에서는 2×2, 노트북에서는 1×4로 보인다.

### 3-3. 카드 하나의 모양

```tsx
<Card>
    <CardContent className="p-4 sm:p-6">
        <div className="flex items-center justify-between">
            <div>
                <p className="text-xs sm:text-sm font-medium text-gray-600">Total Boards</p>
                <p className="text-xl sm:text-2xl font-bold text-gray-900">{boards.length}</p>
            </div>
            <div className="h-10 w-10 sm:h-12 sm:w-12 bg-blue-100 rounded-lg flex items-center justify-center">
                <SquareKanban className="h-5 w-5 sm:h-6 sm:w-6 text-blue-600" />
            </div>
        </div>
    </CardContent>
</Card>
```

- `Card`, `CardContent`: shadcn이 만든 카드 컴포넌트. 흰 배경, 테두리, 둥근 모서리가 이미 들어 있다.
- `flex justify-between`: 왼쪽(글자)과 오른쪽(아이콘)을 양 끝으로 민다.
- 오른쪽 아이콘 상자: `h-10 w-10` 정사각형에 연한 배경색(`bg-blue-100`)을 깔고, `flex items-center justify-center` 로 아이콘을 정가운데에 둔다.

카드 4개는 글자, 숫자, 아이콘, 색만 다르다.

| 카드 | 숫자 | 아이콘 | 색 |
|---|---|---|---|
| Total Boards | `boards.length` | `SquareKanban` | 파랑 |
| Active Projects | `boards.length` | `Rocket` | 초록 |
| Recent Activity | 최근 7일 안에 수정된 보드 수 | 📊 | 보라 |
| Active Projects | `boards.length` | `SquareKanban` | 파랑 |

> **영상과 다른 점**
> - lucide-react 1.x에는 `Trello` 아이콘이 없어서 `SquareKanban` 을 썼다((1)편과 같은 이유).
> - "Active Projects" 와 4번째 카드의 숫자는 아직 모두 `boards.length` 다. 진짜 의미 있는 숫자는 기능을 붙이면서 바꿀 예정이다.

### 3-4. Recent Activity — 최근 7일 안에 수정된 보드 세기

```tsx
{
    boards.filter((board) => {
        const updateAt = new Date(board.updated_at);
        const onWeekAgo = new Date()

        onWeekAgo.setDate(onWeekAgo.getDate()-7);
        return updateAt > onWeekAgo
    }).length
}
```

- `boards.filter(...)`: 조건이 `true` 인 보드만 남긴 **새 배열**을 만든다. 거기에 `.length` 를 붙여 개수를 센다.
- `new Date(board.updated_at)`: DB에서 문자열로 온 날짜를 `Date` 로 바꾼다. 그래야 크기 비교(`>`)를 할 수 있다.
- `new Date()` 는 지금 이 순간이다. `setDate(getDate() - 7)` 로 날짜를 7일 앞으로 돌리면 "일주일 전"이 된다.
  - 1일에서 7을 빼도 괜찮다. `Date` 가 알아서 지난달 말로 넘겨 준다.
- `updateAt > onWeekAgo`: 수정한 날이 일주일 전보다 뒤면, 즉 최근이면 남긴다.
- (3)편에서 `boards` 에 `updated_at` 컬럼을 추가해 둔 덕분에 이 계산이 가능하다.

---

## 4. 하단 — "Your Boards" 제목과 버튼들

```tsx
<div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4 sm:mb-6 space-y-4 sm:space-y-0">
    <div>
        <h2 className="text-xl sm:text-2xl font-bold text-gray-900">Your Boards</h2>
        <p className="text-gray-600">Manage your projects and tasks</p>
    </div>

    <div className="flex flex-col sm:flex-row sm:items-center space-y-2 sm:space-y-0">
        <div className="flex items-center space-x-2 bg-white border p-1">
            <Button
                variant={viewMode === "grid" ? "default" : "ghost"}
                size="sm"
                onClick={()=>setViewMode("grid")}
            >
                <Grid3X3/>
            </Button>
            <Button
                variant={viewMode === "list" ? "default" : "ghost"}
                size="sm"
                onClick={()=>setViewMode("list")}
            >
                <List/>
            </Button>
        </div>
        <Button variant="outline" size="sm">
            <Filter/>
            Filter
        </Button>
        <Button onClick={handleCreateBoard}>
            <Plus/>
            Create Board
        </Button>
    </div>
</div>
```

- **`flex-col sm:flex-row`**: 휴대폰에서는 제목과 버튼을 **위아래**로, 640px 이상에서는 **좌우**로 놓는다.
- **`space-y-4 sm:space-y-0`**: 위아래로 쌓일 때만 사이에 간격을 준다. 좌우로 놓이면 세로 간격은 필요 없으니 0으로 지운다.
- **그리드 / 리스트 전환 버튼**
  - 누르면 `setViewMode("grid")` 또는 `setViewMode("list")` 로 값을 바꾼다.
  - `variant={viewMode === "grid" ? "default" : "ghost"}`: 지금 선택된 쪽은 진한 버튼(`default`), 아닌 쪽은 배경 없는 버튼(`ghost`)이다. 그래서 어느 쪽이 켜져 있는지 보인다.
  - `useState` 값이 바뀌면 React가 화면을 다시 그린다. 그래서 버튼 색과 아래 목록 모양이 함께 바뀐다.
- **Filter 버튼**: 아직 `onClick` 이 없다. 모양만 있다.
- **Create Board 버튼**: 상단 버튼과 같은 `handleCreateBoard` 를 부른다.

---

## 5. 검색창 — 입력칸 안에 아이콘 넣기

```tsx
<div className="relative mb-4 sm:mb-6">
    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400"/>
    <Input id="search" placeholder="Search boards..." className="pl-10"/>
</div>
```

입력칸 왼쪽 안에 돋보기를 띄우는 흔한 방법이다.

- 바깥 `div` 에 `relative`: "아이콘 위치의 기준은 나야"라고 정한다.
- 아이콘에 `absolute left-3`: 기준 상자의 왼쪽에서 조금 떨어진 곳에 띄운다.
- `top-1/2 -translate-y-1/2`: 위에서 50% 내려간 다음, 아이콘 높이의 절반만큼 다시 올린다. 그러면 **세로 정가운데**에 온다.
- 입력칸에 `pl-10`(왼쪽 안쪽 여백): 글자가 아이콘 밑에 깔리지 않게 왼쪽을 비워 둔다.
- 아직 입력값을 저장하거나 보드를 걸러 내지는 않는다.

---

## 6. 보드 목록 — 그리드 / 리스트

### 6-1. 세 갈래로 나누기

```tsx
{boards.length === 0 ? (
    <div> No boards yet</div>
) : viewMode === "grid" ? (
    // 그리드
) : (
    // 리스트
)}
```

삼항 연산자(`조건 ? A : B`)를 두 번 이어 붙였다. 위에서부터 읽으면 된다.

1. 보드가 하나도 없으면 → "No boards yet"
2. 아니고, 그리드 모드면 → 그리드
3. 둘 다 아니면 → 리스트

### 6-2. 그리드

```tsx
<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
    {boards.map((board, key) => (
        <Link href={`/boards/${board.id}`} key={key}>
            <Card className="hover:shadow-lg transition-shadow cursor-pointer group">
                <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                        <div className={`w-4 h-4 ${board.color} rounded`}/>
                        <Badge variant="secondary" className="text-xs">New</Badge>
                    </div>
                </CardHeader>
                <CardContent className="p-4 sm:p-6">
                    <CardTitle className="text-base sm:text-lg mb-2 group-hover:text-blue-600 transition-colors">{board.title}</CardTitle>
                    <CardDescription className="text-sm mb-4">{board.description}</CardDescription>
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between text-xs text-gray-500 space-y-1 sm:space-y-0">
                        <span>
                            Created{" "}
                            {new Date(board.created_at).toLocaleDateString()}
                        </span>
                        <span>
                            Updated{" "}
                            {new Date(board.updated_at).toLocaleDateString()}
                        </span>
                    </div>
                </CardContent>
            </Card>
        </Link>
    ))}

    {/* 맨 끝: 새 보드 만들기 카드 */}
    <Card className="border-2 border-dashed border-gray-300 hover:border-blue-400 transition-colors cursor-pointer group">
        <CardContent className="p-4 sm:p-6 flex flex-col items-center justify-center h-full min-h-[200px]">
            <Plus className="h-6 w-6 sm:h-8 sm:w-8 text-gray-400 group-hover:text-blue-600 mb-2"/>
            <p className="text-sm sm:text-base text-gray-600 group-hover:text-blue-600 font-medium">Create new board</p>
        </CardContent>
    </Card>
</div>
```

- **한 줄에 몇 개?** 휴대폰 1개 → `sm`(640px) 2개 → `lg`(1024px) 3개 → `xl`(1280px) 4개. 3-2의 통계 카드와 같은 원리다.
- **`boards.map(...)`**: 보드 배열을 하나씩 돌면서 카드로 바꾼다. React는 목록의 각 항목을 구분하려고 `key` 를 요구한다.
- **`<Link href={`/boards/${board.id}`}>`**: 카드를 누르면 `/boards/1` 같은 보드 상세 페이지로 간다. 아직 그 페이지를 만들지 않아서 지금은 404가 뜬다.
- **`${board.color}`**: 보드를 만들 때 저장한 색 클래스(`bg-blue-500`)를 그대로 `className` 에 넣는다. 그래서 작은 색 네모가 보드마다 다른 색으로 보인다.
- **`group` / `group-hover:`**: 부모에 `group` 을 붙이면, 자식이 "부모에 마우스가 올라갔을 때" 스타일을 바꿀 수 있다. 카드 어디에 마우스를 올려도 제목이 파랗게 변한다.
- **`hover:shadow-lg transition-shadow`**: 마우스를 올리면 그림자가 부드럽게 커진다.
- **`toLocaleDateString()`**: 날짜를 브라우저 언어에 맞춰 `2026. 11. 5.` 처럼 보여 준다.
- **`Badge`**: shadcn의 작은 꼬리표. 지금은 모든 보드에 "New" 가 고정으로 붙는다.
- **점선 카드(`border-dashed`)**: 목록 맨 끝의 "Create new board" 자리다. 아직 `onClick` 이 없어서 눌러도 아무 일이 없다.

> **참고 — `key` 에 순서 번호를 썼다**
> `map((board, key) => ...)` 의 두 번째 값은 **순서 번호(index)** 다. 영상대로 이걸 `key` 로 썼다.
> 보드를 삭제하거나 순서를 바꾸면 번호가 밀려서 React가 항목을 헷갈릴 수 있다. 그래서 보통은 바뀌지 않는 `board.id` 를 쓴다(`key={board.id}`).

### 6-3. 리스트

```tsx
<div>
    {boards.map((board, key) => (
        <div key={key} className={key > 0 ? "mt-4" : ""}>
            <Link href={`/boards/${board.id}`}>
                <Card ...>  {/* 그리드와 같은 카드 */}
            </Link>
        </div>
    ))}
    <Card className="mt-4 border-2 border-dashed ..."> {/* 새 보드 만들기 카드 */}
</div>
```

- 그리드와 **카드 내용은 똑같다.** 바깥 틀만 다르다.
- `grid` 를 쓰지 않으니 카드가 한 줄에 하나씩, 화면 너비만큼 쌓인다.
- `key > 0 ? "mt-4" : ""`: 첫 번째 카드만 빼고 위쪽에 여백(`mt-4`)을 준다. 카드 사이를 띄우는 방법이다.

카드 코드가 두 번 똑같이 들어가 있다. 나중에 카드 부분을 컴포넌트로 빼면 한 번만 쓰면 된다. 지금은 영상대로 두었다.

---

## 7. 아직 기능이 없는 것들

| 화면 요소 | 지금 상태 |
|---|---|
| 그리드 / 리스트 전환 | ✅ 동작 |
| Create Board 버튼 (상단·하단) | ✅ 동작 — "New Board" 저장 |
| Filter 버튼 | 모양만 |
| 검색창 | 모양만 (입력해도 걸러지지 않음) |
| 보드 카드 클릭 → `/boards/[id]` | 페이지 없음 (404) |
| 점선 "Create new board" 카드 | 모양만 |
| "New" 배지 | 모든 보드에 고정 |

---

## 8. 막혔던 부분 정리

### `useState` 를 `{ }` 로 꺼내서 에러

```tsx
// ❌
const {viewMode, setViewMode} = useState<"grid" | "list">("grid")

// ✅
const [viewMode, setViewMode] = useState<"grid" | "list">("grid")
```

- `useState` 는 `[값, 바꾸는 함수]` 모양의 **배열**을 돌려준다. 배열은 `[ ]` 로 꺼내야 순서대로 받는다.
- `{ }` 는 **객체**에서 그 이름의 속성을 찾는다. 배열에는 `viewMode` 라는 속성이 없어서 TypeScript가 에러를 낸다.
- 헷갈린 이유: 바로 위 줄의 `useUser()`, `useBoards()` 는 **객체**를 돌려줘서 `{ }` 가 맞다.

```tsx
const {user} = useUser()                                          // 객체 → { }
const {createBoard, boards, loading, error} = useBoards()         // 객체 → { }
const [viewMode, setViewMode] = useState<"grid" | "list">("grid") // 배열 → [ ]
```

### 에러 없이 무시된 오타 (Tailwind 클래스)

다 그리고 코드를 다시 보니 오타가 몇 개 있었다. **`npx tsc --noEmit` 은 통과했다.** `className` 은 그냥 문자열이라 TypeScript가 내용을 검사하지 않는다. Tailwind도 모르는 클래스는 에러 없이 **무시**한다. 그래서 화면이 조금 어긋나도 알아채기 어렵다.

위 코드는 모두 고친 버전이다.

| 잘못 쓴 것 | 고친 것 | 틀렸을 때 생기던 일 |
|---|---|---|
| `item-center` (통계 카드 4곳) | `items-center` | 글자와 아이콘이 세로 가운데로 안 맞음 |
| `sm:text-sxl` | `sm:text-2xl` | 큰 화면에서 "Your Boards" 글자가 안 커짐 |
| `pd-3` (`CardHeader`) | `pb-3` | 카드 머리 아래 여백이 안 들어감 |
| `sm:justify-btween` | `sm:justify-between` | Created / Updated 가 양 끝으로 안 벌어짐 |
| `gruop-hover:` | `group-hover:` | 점선 카드에 마우스를 올려도 `+` 가 파래지지 않음 |
| `sm:items-center` 두 번 | 한 번 | 동작은 같음 (중복일 뿐) |

> **오타 찾는 팁:** VS Code에 **Tailwind CSS IntelliSense** 확장을 깔면, 클래스 이름을 칠 때 자동 완성 목록이 뜬다. 목록에 안 나오는 이름이면 오타일 가능성이 크다.

> 4번째 통계 카드 제목도 2번째와 같은 "Active Projects" 다. 영상 화면을 다시 보고 맞출 예정이다.

---

## 9. 결과

로그인해서 `/dashboard` 에 들어가면

- 위에 환영 문구와 통계 카드 4개(보드 수, 최근 7일 수정 수)
- 아래에 내 보드가 카드로 나오고, 버튼으로 그리드 ↔ 리스트를 바꿀 수 있다.
- **Create Board** 를 누르면 "New Board" 카드가 목록 맨 앞에 바로 생긴다. (4)편의 `setBoards((prev) => [newBoard, ...prev])` 덕분이다.

다음 편부터 검색·필터, 새 보드 만들기 창(Dialog), `/boards/[id]` 보드 상세 페이지 같은 기능을 하나씩 붙일 예정이다.
