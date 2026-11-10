# Trello Clone 클론 코딩 (7) — Dialog로 보드 제목과 색상 바꾸기

참고 영상: https://www.youtube.com/watch?v=ugxI1o5SyMs
영상 구간: `03:50:00` Board Page Header & "Edit Board" Dialog

(6)편에서 보드 상세 페이지 헤더에 **⋯ 버튼** 자리를 만들어 두었다. 하지만 페이지에서 `onEditBoard` 를 넘기지 않아서 버튼이 보이지 않았다.
이번 글에서는 그 버튼을 누르면 **Dialog(모달 창)** 가 열리고, 보드 **제목과 색상**을 바꿔 저장하는 기능을 만든다.

작업 순서는 이렇다.

1. 보드를 수정하는 DB 함수 추가 — `lib/services.ts`
2. 그 함수를 부르는 `updateBoard` 를 `useBoard` 훅에 추가 — `lib/hooks/useBoards.ts`
3. 페이지에 Dialog 상태 3개 만들고 ⋯ 버튼과 연결 — `app/boards/[id]/page.tsx`
4. Dialog 안에 제목 입력칸, 색상 고르기, 버튼 그리기
5. 저장 버튼을 누르면 `updateBoard` 호출

---

## 0. 전체 흐름

```
[⋯ 버튼 클릭]  ← Navbar (6편에서 만든 버튼)
   │ onEditBoard()
   ▼
지금 제목·색을 newTitle / newColor 에 복사 → isEditingTitle = true
   │
   ▼
[Dialog 열림] 제목 고치기, 색 고르기
   │ Save Changes (form 제출)
   ▼
handleUpdateBoard()                       ← page.tsx
   ▼
useBoard().updateBoard()                  ← lib/hooks/useBoards.ts
   ▼
boardService.updateBoard()                ← lib/services.ts
   │ boards 테이블 update
   ▼
돌려받은 보드로 setBoard → 헤더 제목이 바로 바뀜, Dialog 닫힘
```

---

## 1. 보드 수정 함수 — `boardService.updateBoard`

`lib/services.ts` 의 `boardService` 에 추가한다.

```ts
async updateBoard(
    supabase: SupabaseClient,
    boardId : string,
    updates : Partial<Board>
): Promise<Board>{
    const {data, error} = await supabase
    .from("boards")
    .update({...updates, updated_at: new Date().toISOString()})
    .eq("id", boardId)
    .select()
    .single()

    if(error) throw error

    return data
}
```

| 코드 | 뜻 |
|---|---|
| `Partial<Board>` | `Board` 의 모든 항목을 "있어도 되고 없어도 되는" 것으로 바꾼 타입. 제목만, 또는 색만 바꿀 수 있다 |
| `.update({...updates, updated_at: ...})` | 바꿀 값에 **수정 시각**을 같이 넣는다. (3)편에서 `boards` 에 `updated_at` 컬럼을 추가해 둔 이유가 이것 |
| `new Date().toISOString()` | 지금 시각을 `2026-11-09T01:23:45.000Z` 같은 문자열로 만든다. DB의 `timestamptz` 컬럼이 이 형식을 받는다 |
| `.eq("id", boardId)` | **이 id인 보드만** 수정한다. 이게 없으면 조건 없는 update가 된다 |
| `.select().single()` | 수정된 줄을 다시 받아 온다. 화면을 이 값으로 바꾸기 위해서 |

> `.eq()` 를 빼먹어도 남의 보드까지 바뀌지는 않는다. (4)편에서 만든 RLS 정책이 "내 보드만 수정 가능"으로 막아 주기 때문이다. 그래도 **내 보드 전체**가 같은 제목으로 바뀔 수 있으니 조건은 꼭 넣는다.

---

## 2. `useBoard` 훅에 `updateBoard` 추가

`lib/hooks/useBoards.ts` 의 `useBoard` 안에 추가하고, `return` 에도 넣는다.

```ts
async function updateBoard(boardId: string, updates: Partial<Board>) {
    try{
        const updateBoard = await boardService.updateBoard(
            supabase!,
            boardId,
            updates
        )
        setBoard(updateBoard)
        return updateBoard

    }catch(err){
        setError(err instanceof Error ? err.message : "보드 업데이트에 실패했습니다.")
    }
}

return{
    board,
    columns,
    loading,
    error,
    updateBoard
}
```

- `setBoard(updateBoard)`: DB가 돌려준 **수정된 보드**로 상태를 바꾼다. `board` 가 바뀌면 페이지가 다시 그려지고, Navbar에 넘기는 `board?.title` 도 새 제목이 된다. 새로고침이 필요 없다.
- 4편의 `createBoard` 처럼 `supabase!` 를 쓴다. `!` 는 "여기선 null이 아니라고 내가 보장할게"라는 뜻이다. 보드 페이지는 로그인한 상태에서만 쓰니까 `supabase` 가 있다고 본 것이다.

---

## 3. 페이지에 Dialog 상태 만들기

`app/boards/[id]/page.tsx`

```tsx
const {board, updateBoard} = useBoard(id)

const [isEditingTitle, setIsEditingTitle] = useState(false); // 모달창 열고 닫기
const [newTitle, setNewTitle] = useState("")
const [newColor, setNewColor] = useState("")
```

| 상태 | 하는 일 |
|---|---|
| `isEditingTitle` | Dialog가 열렸는지. `true` 면 열림 |
| `newTitle` | 입력칸에 적고 있는 제목. 저장 전까지는 `board.title` 과 따로 논다 |
| `newColor` | 고른 색 클래스 이름 (`"bg-red-500"` 같은 문자열) |

`board.title` 을 바로 고치지 않고 `newTitle` 을 따로 두는 이유: **Cancel을 누르면 원래대로** 돌아가야 하기 때문이다. 저장 버튼을 누를 때만 DB와 `board` 를 바꾼다.

### ⋯ 버튼과 연결하기

```tsx
<Navbar
    boardTitle={board?.title}
    onEditBoard={()=>{
        setNewTitle(board?.title ?? "")
        setNewColor(board?.color ?? "")
        setIsEditingTitle(true)
    }}
/>
```

- (6)편에서 Navbar는 `onEditBoard && (...)` 로 **함수를 받았을 때만** ⋯ 버튼을 그리게 해 두었다. 이제 함수를 넘기니까 버튼이 나타난다.
- 열기 직전에 **지금 제목과 색을 복사**해 둔다. 그래서 Dialog를 열면 입력칸에 현재 제목이 이미 들어 있고, 현재 색에 테두리가 표시된다.
- `?? ""`: 보드를 아직 못 불러와서 `undefined` 면 빈 문자열을 쓴다. `useState("")` 로 만든 상태라 문자열만 넣어야 한다.

---

## 4. Dialog 그리기

shadcn의 `Dialog`, `Input`, `Label` 을 쓴다. (1)편에서 `npx shadcn add` 로 받아 둔 컴포넌트다.

```tsx
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
```

### 4-1. 열고 닫기 — `open` / `onOpenChange`

```tsx
<Dialog open={isEditingTitle} onOpenChange={setIsEditingTitle}>
    <DialogContent className="w-[95vw] max-w-[425px] mx-auto">
        <DialogHeader>
            <DialogTitle>Editing Board</DialogTitle>
        </DialogHeader>
        ...
    </DialogContent>
</Dialog>
```

- `open`: 열지 말지를 **우리 상태로** 정한다. ⋯ 버튼에서 `setIsEditingTitle(true)` 를 하면 열린다.
- `onOpenChange`: Dialog가 스스로 닫히려 할 때(바깥 클릭, `Esc`, 오른쪽 위 X) 불린다. `false` 를 넘겨 주므로 `setIsEditingTitle` 을 그대로 연결하면 상태도 같이 닫힌다.
- `DialogTitle`: 화면에 보이는 제목이면서, 화면 낭독기에 "이 창의 이름"을 알려 준다. 빼면 Radix가 콘솔에 경고를 띄운다.
- `w-[95vw]`: 휴대폰처럼 좁은 화면에서는 화면 폭의 95%.

### 4-2. 제목 입력칸

```tsx
<form className="space-y-4" onSubmit={handleUpdateBoard}>
    <div className="space-y-2">
        <Label htmlFor="boardTitle">Board Title</Label>
        <Input
            id="boardTitle"
            value={newTitle}
            onChange={(e)=> setNewTitle(e.target.value)}
            placeholder="Enter board title..."
            required
        />
    </div>
    ...
</form>
```

- `<form onSubmit>`: 입력칸에서 **Enter만 눌러도** 저장된다. 버튼 `onClick` 으로만 만들면 Enter가 안 먹는다.
- `htmlFor="boardTitle"` 와 `id="boardTitle"`: 이름표(Label)와 입력칸을 연결한다. "Board Title" 글자를 눌러도 입력칸에 커서가 간다.
- `value` + `onChange`: 입력칸 내용을 React 상태와 묶는다(제어 컴포넌트). 글자를 칠 때마다 `newTitle` 이 바뀌고, `newTitle` 이 바뀌면 입력칸도 바뀐다.
- `required`: 비어 있으면 브라우저가 제출을 막고 "이 입력란을 작성하세요" 말풍선을 띄운다.

### 4-3. 색상 고르기

```tsx
<div className="space-y-2">
    <Label htmlFor="boardColor">Board Color</Label>
    <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
        {[
            "bg-blue-500",
            "bg-green-500",
            "bg-yellow-500",
            "bg-red-500",
            "bg-purple-500",
            "bg-pink-500",
            "bg-indigo-500",
            "bg-gray-500",
            "bg-orange-500",
            "bg-teal-500",
            "bg-cyan-500",
            "bg-emerald-500",
        ].map((color, index) => (
            <button
                type="button"
                key={index}
                className={
                    `w-8 h-8 rounded-full ${color} ${color === newColor ? "ring-2 ring-offset-2" : ""}`
                }
                onClick={()=>setNewColor(color)}
            />
        ))}
    </div>
</div>
```

- 색 12개를 배열로 적고 `.map()` 으로 동그라미 버튼 12개를 만든다.
- `grid-cols-4 sm:grid-cols-6`: 좁은 화면은 한 줄에 4개(3줄), 640px 이상은 6개(2줄).
- `` `w-8 h-8 rounded-full ${color}` ``: 32px 동그라미에 그 색 배경을 칠한다.
- `color === newColor ? "ring-2 ring-offset-2" : ""`: **지금 고른 색**에만 바깥 테두리를 그린다. `ring-offset-2` 는 동그라미와 테두리 사이에 2px 틈을 띄워서 고리처럼 보이게 한다.
- `type="button"` 이 **꼭 필요하다.** `<form>` 안의 `<button>` 은 기본이 `type="submit"` 이라, 빼면 색만 눌러도 폼이 제출된다.

> **색 이름을 문자열 그대로 적는 이유**
> Tailwind는 코드에 **글자 그대로 적힌** 클래스 이름만 찾아서 CSS를 만든다. `` `bg-${name}-500` `` 처럼 조립하면 `bg-red-500` 이라는 글자가 코드에 없어서 CSS가 안 만들어진다. 그래서 배열에 `"bg-red-500"` 을 통째로 적는다.

### 4-4. 버튼

```tsx
<div className="flex justify-end space-x-2">
    <Button
        type="button"
        variant={"outline"}
        onClick={()=>setIsEditingTitle(false)}
    >
        Cancel
    </Button>
    <Button
        type="submit"
    >
        Save Changes
    </Button>
</div>
```

- **Cancel**: `type="button"` 이라 제출하지 않고 Dialog만 닫는다. `newTitle` 은 다음에 열 때 다시 복사되니 따로 되돌릴 필요가 없다.
- **Save Changes**: `type="submit"` 이라 누르면 `<form onSubmit>` 의 `handleUpdateBoard` 가 실행된다.

---

## 5. 저장하기 — `handleUpdateBoard`

```tsx
async function handleUpdateBoard(e: React.FormEvent){
    e.preventDefault()

    if(!newTitle.trim() || !board) return;

    try{
        await updateBoard(board.id, {
            title: newTitle.trim(),
            color: newColor || board.color
        })
        setIsEditingTitle(false)
    }catch{

    }
}
```

| 코드 | 뜻 |
|---|---|
| `e.preventDefault()` | 폼을 제출하면 브라우저는 원래 **페이지를 새로고침**한다. 그걸 막는다 |
| `newTitle.trim()` | 앞뒤 공백을 지운다. `required` 는 공백만 친 `"   "` 을 통과시키기 때문에 한 번 더 검사한다 |
| `!board` | 보드를 아직 못 불러왔으면 저장하지 않는다 |
| `newColor \|\| board.color` | 색을 안 골랐으면(빈 문자열) 원래 색을 그대로 쓴다 |
| `setIsEditingTitle(false)` | 저장이 끝나면 Dialog를 닫는다 |

---

## 6. 고친 부분 — 클래스 오타 세 개

코드를 정리하다가 세 군데를 고쳤다. 모두 **`npx tsc --noEmit` 은 통과**한다. Tailwind 클래스와 버튼 글자는 그냥 문자열이라 TypeScript가 검사하지 않기 때문이다.

| 위치 | 고치기 전 | 고친 후 | 증상 |
|---|---|---|---|
| `DialogContent` | `max-width:26.5625rem` | `max-w-[425px]` | 클래스가 아니라 **CSS 문법**이라 아무 효과가 없었다 |
| 색상 grid | `sm:grid-col-6` | `sm:grid-cols-6` | `s` 가 빠져서 넓은 화면에서도 4개씩 나왔다 |
| 취소 버튼 | `Cancle` | `Cancel` | 화면에 보이는 영어 철자 |

> **`max-width:26.5625rem` 이 들어간 이유**
> VS Code Tailwind 확장이 `max-w-[425px]` 에 밑줄을 긋고 "`max-w-106.25` 로 쓸 수 있다"고 제안한다. 그때 같이 뜨는 미리보기가 `.max-w-\[425px\] { max-width: 425px; }` 같은 **CSS 결과**다. 이걸 클래스 자리에 옮겨 적으면 Tailwind는 모르는 글자로 보고 무시한다.
> - Tailwind v4 에서 `max-w-숫자` 는 **숫자 × 0.25rem(4px)** 이라 `max-w-106.25` = 425px 이다.
> - 영상과 맞추기 위해 대괄호 표기 `max-w-[425px]` 를 그대로 썼다. 제안은 경고일 뿐이라 무시해도 된다.

> **참고: 넓은 화면에서는 425px이 아니라 384px**
> shadcn `DialogContent` 에는 원래 `sm:max-w-sm`(384px)이 들어 있다. `sm:` 은 "640px 이상일 때"라서, 우리가 준 `max-w-[425px]` 보다 우선한다. 넓은 화면에서도 425px로 하고 싶으면 `sm:max-w-[425px]` 로 적어야 한다. 지금은 영상 코드대로 두었다.

---

## 7. 새 컴퓨터에서 막혔던 것

이번 편 작업을 다른 컴퓨터(Mac mini)에서 이어 하다가 기능 외적인 문제로 한참 막혔다. 원인이 전부 **설정**이었다.

### ① `npm install` — `EACCES` 권한 에러

```
npm error code EACCES
npm error Your cache folder contains root-owned files
```

- 예전에 `sudo npm ...` 으로 실행해서 `~/.npm` 캐시 안에 **관리자(root) 소유 파일**이 생긴 것이 원인이었다.
- `sudo chown -R 501:20 "/Users/<내 계정>/.npm"` 으로 주인을 내 계정으로 되돌려서 해결. 앞으로 `npm` 앞에 `sudo` 를 붙이지 않는다.

### ② 화면이 계속 `Loading...` — 로그아웃 상태면 앱 전체가 멈춤

- `.env` 에 Supabase 키 두 개(`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`)가 빠져 있었다. 새 컴퓨터에서 Clerk 키만 옮겨 적었기 때문이다.
- 키를 넣어도 **로그아웃 상태**에서는 홈 화면까지 `Loading...` 이었다. Sign in 버튼이 안 보여서 로그인할 방법이 없었다.
- (4)편의 `SupabaseProvider` 가 **로그인했을 때만** `isLoaded` 를 `true` 로 바꾸고 있었기 때문이다.

```tsx
// 고치기 전
useEffect(()=>{
    if(!session) return;   // 로그아웃이면 여기서 끝 → isLoaded가 영원히 false
    ...
},[session])
```

```tsx
// 고친 후
const {session, isLoaded: isSessionLoaded} = useSession();

useEffect(()=>{
    // Clerk가 로그인 상태를 아직 확인하는 중이면 기다린다
    if(!isSessionLoaded) return;

    // 로그아웃 상태면 Supabase 없이 화면을 보여 준다 (로그인 버튼이 보여야 하므로)
    if(!session) {
        setSupabase(null)
        setIsLoaded(true)
        return;
    }
    ...
},[session])
```

> **영상과 다른 점**
> 영상 코드는 로그아웃 상태를 따로 처리하지 않는다. 기존 컴퓨터에서는 이미 로그인돼 있어서 몰랐던 문제다. `useSession()` 의 `isLoaded` 는 "Clerk가 로그인 여부 확인을 마쳤는지"라서, 확인이 끝났는데 세션이 없으면 그냥 화면을 보여 주도록 바꿨다. 이 컴포넌트에 같은 이름의 `isLoaded` 상태가 이미 있어서 `isSessionLoaded` 로 이름을 바꿔 받았다.

### ③ Create Board가 먹통 — Supabase 주소 끝의 `/rest/v1/`

```
수정 전: NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co/rest/v1/
수정 후: NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
```

- Supabase 라이브러리는 주소 뒤에 `/rest/v1` 을 **알아서 붙인다.** 이미 붙어 있으면 `.../rest/v1/rest/v1/boards` 로 요청이 간다.
- 대시보드의 REST 예시를 복사하면 꼬리가 딸려 오기 쉽다. **Project URL** 만 넣는다.

### ④ 그래도 먹통 — `String contains non ISO-8859-1 code point`

버튼을 눌러도 아무 반응이 없고 Network 탭에 Supabase 요청도 없었다. `useBoards` 의 `catch` 가 에러를 `setError` 로 **저장만** 하고, 화면 어디에도 보여 주지 않았기 때문이다. `catch` 에 `console.error` 를 넣어 보니 진짜 에러가 나왔다.

```
TypeError: Failed to execute 'set' on 'Headers': String contains non ISO-8859-1 code point.
```

- Supabase는 anon 키를 HTTP 헤더(`apikey`)에 넣어 보낸다. 헤더에는 기본 영문·숫자·기호만 들어갈 수 있다.
- `.env` 의 anon 키와 `CLERK_SECRET_KEY` 가 **화면에 줄여서 표시된 값**(`sk_test_e…XZb9` 처럼 가운데가 `…`)이었다. 글자를 드래그해서 복사하는 바람에 `…` 가 들어갔다.
- 대시보드에서 키 **상자를 클릭하거나 복사 아이콘**을 눌러 전체 값을 다시 복사해서 해결.

> **키가 맞는지 값을 보지 않고 확인하는 방법**
> 키는 화면에 출력하면 안 되니, 길이와 이상한 글자만 검사했다.
> ```bash
> perl -CSD -ne 'if(/^(\w+)=(.*)$/){my($n,$v)=($1,$2); my @b; while($v=~/([^\x21-\x7e])/g){push @b,sprintf("pos %d U+%04X",pos($v),ord($1))} printf "%s: len=%d %s\n",$n,length($v),(@b?join(", ",@b):"OK")}' .env
> ```
> `U+2026` 이 나오면 `…`(말줄임표)가 들어간 것이다.

### 정리: 디버깅에서 배운 것

- **에러가 안 보이면 에러를 찍는다.** `catch` 에서 `setError` 만 하고 화면에 안 보여 주면 "아무 반응 없음"처럼 보인다.
- **Network 탭에 요청이 없으면** 서버 문제가 아니라 **요청을 만들기 전에** 실패한 것이다(주소, 키, 헤더).
- `NEXT_PUBLIC_` 으로 시작하는 환경 변수는 개발 서버가 **시작될 때** 읽힌다. `.env` 를 고치면 서버를 다시 켠다.

---

## 8. 아직 안 된 것

| 항목 | 지금 상태 |
|---|---|
| 저장 실패 시 | `updateBoard` 가 `catch` 에서 에러를 삼키고 `undefined` 를 돌려준다. 그래서 `handleUpdateBoard` 는 성공한 줄 알고 Dialog를 닫는다 |
| `handleUpdateBoard` 의 `catch{}` | 비어 있다. 위 이유로 지금은 여기까지 에러가 오지도 않는다 |
| 바꾼 색 | DB에는 저장되지만 보드 페이지에서 아직 `board.color` 를 쓰는 곳이 없어 화면에 안 보인다. 대시보드 카드에는 반영된다 |
| `/dashboard` 로그인 보호 | 로그아웃 상태에서도 열린다. `middleware.ts` 에서 `auth.protect()` 를 추가해야 한다 |

---

## 9. 결과

보드 상세 페이지 헤더에서

- 제목 옆 **⋯ 버튼**이 보인다.
- 누르면 **Editing Board** Dialog가 열리고, 입력칸에 지금 제목이, 색상 동그라미에 지금 색 테두리가 표시된다.
- 제목을 바꾸고 색을 골라 **Save Changes**(또는 Enter)를 누르면 Dialog가 닫히고 헤더 제목이 바로 바뀐다.
- Supabase Table Editor의 `boards` 에서 `title`, `color`, `updated_at` 이 바뀐 것을 확인할 수 있다.
- **Cancel**, 바깥 클릭, `Esc` 로 닫으면 아무것도 바뀌지 않는다.

---

## 태그

**전체:** `Next.js`, `Next.js 15`, `React`, `TypeScript`, `Supabase`, `Clerk`, `shadcn/ui`, `Radix UI`, `Dialog`, `모달`, `Tailwind CSS`, `Tailwind v4`, `useState`, `제어 컴포넌트`, `form`, `CRUD`, `update`, `Partial`, `환경 변수`, `npm EACCES`, `ISO-8859-1`, `트렐로 클론`, `클론 코딩`, `토이 프로젝트`

**10개 이내:** `Next.js`, `Supabase`, `Clerk`, `shadcn/ui`, `Dialog`, `Tailwind CSS`, `TypeScript`, `CRUD`, `트렐로 클론`, `클론 코딩`
