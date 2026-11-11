# Trello Clone 클론 코딩 (12) — 컬럼 추가하고 이름 바꾸기

참고 영상: https://www.youtube.com/watch?v=ugxI1o5SyMs
영상 구간: `05:13:00` ~ `05:39:00` Adding "Add New Column" dialog & createColumn logic / Implementing "Edit Column" dialog & updateColumn feature

(11)편에서 카드를 끌어서 옮겼다. 이번에는 카드가 아니라 **컬럼(리스트) 자체**를 다룬다.

> 영상 설명란 챕터 표에는 이 두 챕터가 `05:45:00`·`05:55:00` 으로 적혀 있지만, 챕터 시간은 대충 끊은 대략값이다. 이 글은 실제로 본 시간(`05:13:00` ~ `05:39:00`) 기준이다.

1. 컬럼 목록 맨 오른쪽의 **add another list** 버튼으로 새 컬럼을 만든다.
2. 컬럼 머리의 **⋯ 버튼**으로 컬럼 이름을 바꾼다. (8)편부터 자리만 있고 눌러도 아무 일도 안 하던 버튼이다.

각 단계는 **할 일 → 코드 → 호출(누가 언제 부르나) → 동작(화면에서 무슨 일이 일어나나)** 순서로 적었다.

---

## 0. 전체 흐름

```
[컬럼 추가]
add another list 클릭 → setIsCreatingColumn(true) → Create New Column 팝업
  → 제목 입력 → Create Columns
  → handleCreateColumn          (page.tsx)
  → createColumn                (useBoards.ts) 
  → columnService.createColumn  (services.ts)  columns 에 한 줄 추가 (POST)
  → setColumns                  새 컬럼을 목록 맨 끝에 붙인다

[컬럼 이름 바꾸기]
⋯ 클릭 → onEditColumn(column) → handleEditColumn (page.tsx) → Edit Column 팝업 (지금 제목이 채워져 있음)
  → 제목 고치기 → Edit Columns
  → handleUpdateColumn               (page.tsx)
  → updateColumn                     (useBoards.ts)
  → columnService.updateColumnTitle  (services.ts)  columns 의 title 수정 (PATCH)
  → setColumns                       그 컬럼만 새 제목으로 바꾼다
```

두 흐름 모두 (7)편 보드 수정, (9)편 태스크 만들기와 같은 **page → hook → service** 3층 구조다.

| 층 | 파일 | 하는 일 |
|---|---|---|
| page | `app/boards/[id]/page.tsx` | 버튼·팝업·입력값(state)을 다룬다 |
| hook | `lib/hooks/useBoards.ts` 의 `useBoard` | 서비스를 부르고, 끝나면 화면 상태(`columns`)를 바꾼다 |
| service | `lib/services.ts` 의 `columnService` | Supabase에 무엇을 보낼지만 안다 |

---

## 1. add another list 버튼 — `isCreatingColumn`

**할 일:** 컬럼 목록 맨 끝에 점선 버튼을 놓고, 누르면 "팝업을 열어라"는 상태를 `true` 로 바꾼다.

`app/boards/[id]/page.tsx`

```tsx
const [isCreatingColumn, setIsCreatingColumn] = useState(false)
```

```tsx
{columns.map((column, key) => (
    <DroppableColumn ...>
        ...
    </DroppableColumn>
))}

<div className="w-full lg:flex-shrink-0 lg:w-80">
    <Button 
        variant="outline" 
        className="w-full h-full min-h-[200px] border-dashed border-2 text-gray-500 hover:text-gray-700"
        onClick={()=>setIsCreatingColumn(true)}
    >
        <Plus/>
        add another list
    </Button>
</div>
```

- `columns.map(...)` **바로 뒤**, 컬럼들과 같은 줄(`flex flex-col lg:flex-row`) 안에 넣었다. 그래서 컬럼 한 칸처럼 마지막 컬럼 뒤에 붙는다. 1024px(`lg`) 이상에서는 컬럼이 가로로 늘어서니 **오른쪽**에, 좁은 화면에서는 컬럼이 위아래로 쌓이니 **맨 아래**에 생긴다((9)편 6절).
- 감싸는 `div` 의 `w-full lg:flex-shrink-0 lg:w-80` 은 `DroppableColumn` 바깥 `div` 와 같은 클래스다. 넓은 화면에서 컬럼과 **같은 너비(320px)** 이고, 가로 스크롤이 생겨도 줄어들지 않는다.

| 클래스 | 뜻 |
|---|---|
| `variant="outline"` | shadcn 버튼의 테두리만 있는 모양 |
| `border-dashed border-2` | 테두리를 2px **점선**으로 |
| `min-h-[200px]` | 최소 높이 200px |
| `text-gray-500 hover:text-gray-700` | 회색 글자, 마우스를 올리면 조금 진하게 |

- **호출:** 버튼 클릭 → `setIsCreatingColumn(true)` → 페이지가 다시 그려진다.
- **동작:** 점선 버튼이 보인다. 눌러도 아직 보이는 변화는 없다. 상태만 `true` 가 되고, 그 상태로 열 팝업은 2번에서 만든다.

---

## 2. Create New Column 팝업

**할 일:** `isCreatingColumn` 이 `true` 일 때 열리는 팝업과 제목 입력칸을 만든다.

```tsx
const [newColumnTitle, setNewColumnTitle] = useState('')
```

팝업은 페이지 맨 아래, 보드 전체를 감싼 `<div className="min-h-screen ...">` **뒤**에 두었다. `return` 안에 맨 바깥 요소가 둘이 되니까 전체를 `<> ... </>`(Fragment, 화면에는 아무것도 그리지 않는 묶음)로 감쌌다.

```tsx
return(
    <>
        <div className="min-h-screen bg-gray-50">
            ...
        </div> 

        <Dialog open={isCreatingColumn} onOpenChange={setIsCreatingColumn}>
            <DialogContent className="w-[95vw] max-w-[425px] mx-auto">
                <DialogHeader>
                    <DialogTitle>Create New Column</DialogTitle>
                    <p>Add new column to organize your tasks</p>
                </DialogHeader>
                <form className="space-y-4" onSubmit={handleCreateColumn}>
                    <div className="space-y-2">
                        <Label>Column Title</Label>
                        <Input 
                            id="columnsTitle" 
                            value={newColumnTitle} 
                            onChange={(e)=>setNewColumnTitle(e.target.value)} 
                            placeholder="제목을 입력하세요"
                            required
                        />
                    </div>
                    <div className="space-y-2 flex justify-end">
                        <Button 
                            type="button"
                            variant="outline"
                            onClick={()=>setIsCreatingColumn(false)}
                        >
                            Cancel
                        </Button>
                        <Button type="submit">Create Columns</Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    </>
)
```

| 코드 | 뜻 |
|---|---|
| `open={isCreatingColumn}` | 상태가 `true` 면 열리고 `false` 면 닫힌다 |
| `onOpenChange={setIsCreatingColumn}` | 바깥 클릭·ESC·X 버튼으로 닫으면 shadcn이 `false` 를 넘겨 준다. (7)편 보드 수정 팝업과 같다 |
| `value` + `onChange` | 입력칸 내용을 `newColumnTitle` 과 묶는다(**제어 컴포넌트**, (7)편 4-2) |
| `required` | 비어 있으면 브라우저가 제출을 막고 입력하라는 말풍선을 띄운다 |
| Cancel 의 `type="button"` | `form` 안의 버튼은 따로 적지 않으면 **제출 버튼**이 된다. `type="button"` 이라 제출하지 않고 팝업만 닫는다 |
| Create Columns 의 `type="submit"` | 누르면 `form` 의 `onSubmit`, 즉 `handleCreateColumn` 이 실행된다(3번) |

- **호출:** 1번 버튼 → `isCreatingColumn` 이 `true` → `<Dialog open={true}>`. 글자를 칠 때마다 `onChange` → `setNewColumnTitle`.
- **동작:** 팝업이 뜨고 제목을 입력할 수 있다. Cancel 이나 바깥 클릭으로 닫힌다.
  - 닫을 때 `newColumnTitle` 을 비우지 않아서, 다시 열면 **아까 쓰던 글자가 남아 있다.**
  - 단, `onSubmit={handleCreateColumn}` 의 `handleCreateColumn` 은 3-3에서 만든다. 함수가 없는 채로 저장하면 팝업이 닫혀 있어도 페이지를 그리는 순간 `ReferenceError: handleCreateColumn is not defined` 로 화면 전체가 깨진다. JSX 안의 값은 팝업이 열렸든 닫혔든 페이지를 그릴 때 함께 계산되기 때문이다. 3-3까지 만든 뒤에 확인하거나, 빈 함수라도 먼저 만들어 둔다. 4-3의 `handleUpdateColumn`(5-3에서 만듦)도 마찬가지다.

---

## 3. 저장하기 — `handleCreateColumn` → `createColumn` → `columnService.createColumn`

### 3-1. `columnService.createColumn` — 이미 있다

`lib/services.ts` 에는 새로 쓸 코드가 **없다.** 이 함수는 (4)편에서 이미 만들었다.

```ts
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
},
```

- (4)편에서 새 보드를 만들 때 기본 컬럼 4개(To Do, In Progress, Review, Done)를 넣으려고 만든 함수다. `createBoardWithDefaultColumns` 가 `Promise.all` 로 이 함수를 4번 부른다.
- 이번에는 같은 함수를 **한 번 더 부르기만** 한다. 서비스는 "columns 에 한 줄 넣기"만 알고 누가 왜 부르는지는 모르기 때문에, 다른 곳에서 그대로 다시 쓸 수 있다. `services.ts` 를 따로 둔 덕분이다.
- `Omit<Column, "id" | "created_at">`: `Column` 타입에서 `id` 와 `created_at` 을 뺀 모양이다. 두 값은 DB가 알아서 만든다. 나머지 `board_id`, `title`, `sort_order`, `user_id` 는 **꼭** 넘겨야 한다.
- `.insert(...).select().single()`: 넣고 나서 **방금 저장된 한 줄**을 돌려받는다. DB가 만든 `id` 가 들어 있다.

### 3-2. `useBoard` 의 `createColumn`

`lib/hooks/useBoards.ts` 의 `useBoard` 안에 추가한다. 그 전에 두 군데를 먼저 손본다.

```ts
import { boardDataService, boardService, columnService, taskService } from "../services";
```

```ts
export function useBoard(boardId: string){
    const {user} = useUser()   // 새로 추가
    const {supabase} = useSupabase()
    ...
```

- import 에 `columnService` 를 추가한다. 이 파일에서 `columnService` 를 직접 쓰는 건 이번이 처음이다.
- `useBoard` 맨 위에 `const {user} = useUser()` 를 넣는다. `useUser` 는 위쪽 `useBoards`(보드 목록 훅)에서 이미 쓰고 있어서 import 는 되어 있지만, `useBoard` 안에서는 `user` 를 꺼낸 적이 없었다. 컬럼의 `user_id` 를 채우려면 여기서도 꺼내야 한다.
- 둘 중 하나라도 빠뜨리면 `Cannot find name 'user'` / `Cannot find name 'columnService'` 에러가 난다.

```ts
async function  createColumn(title:string) {
    if(!board || !user) throw new Error("보드가 로드되지 않았습니다.")

    try{
        const newColumn = await columnService.createColumn(supabase!, {
            title, 
            board_id: board.id, 
            sort_order: columns.length,
            user_id: user?.id
        })

        setColumns((prev) => [...prev, {...newColumn, tasks: []}])
        return newColumn

    }catch(err){
        setError(err instanceof Error ? err.message : "열을 생성하지 못했습니다.")
    } 
}
```

| 코드 | 뜻 |
|---|---|
| `if(!board \|\| !user) throw ...` | 보드 id와 로그인한 사용자 id가 있어야 저장할 수 있다. 없으면 여기서 멈춘다 |
| `board_id: board.id` | 어느 보드의 컬럼인지 |
| `sort_order: columns.length` | 지금 컬럼 수를 순서 번호로 쓴다. 번호는 0부터라서 컬럼이 4개면 새 컬럼은 `4`, 즉 **맨 뒤**다. 불러올 때 `sort_order` 순으로 정렬하니 새로고침해도 맨 뒤에 있다 |
| `user_id: user?.id` | Clerk 사용자 id. (4)편 4-1에서 `columns` 에 만든 칸이다 |
| `[...prev, ...]` | 기존 컬럼을 펼치고 끝에 새 컬럼을 붙인 **새 배열**을 만든다. `prev` 는 고치지 않는다 |
| `{...newColumn, tasks: []}` | DB가 돌려준 컬럼 줄에는 `tasks` 가 없다. 화면 상태는 `ColumnWithTasks[]` 라 `tasks` 가 꼭 있어야 해서 **빈 배열**을 붙인다 |

> **`tasks: []` 를 빼면?**
> TypeScript가 "`Column` 에는 `tasks` 가 없다"며 막는다(`TS2345`). 타입 검사를 피해 넣더라도, 페이지가 다시 그려질 때 위쪽 **Total Tasks** 합계(`columns.reduce((sum, col) => sum + col.tasks.length, 0)`)를 계산하다가 `Cannot read properties of undefined (reading 'length')` 로 화면 전체가 깨진다. 컬럼 배지(`DroppableColumn` 의 `column.tasks.length`)까지 가기도 전에 페이지에서 먼저 멈춘다.

`return` 에도 추가한다.

```ts
return{
    ...
    moveTask,
    createColumn
}
```

### 3-3. 페이지의 `handleCreateColumn`

```tsx
const {board, createColumn, updateBoard, columns, createRealTask, setColumns, moveTask} = useBoard(id)
```

```tsx
async function handleCreateColumn(e:React.FormEvent) {
    e.preventDefault()

    if(!newColumnTitle.trim()) return;

    await createColumn(newColumnTitle.trim())

    setNewColumnTitle('');
    setIsCreatingColumn(false)
}
```

| 코드 | 뜻 |
|---|---|
| `e:React.FormEvent` | 제출 이벤트의 타입. (9)편 4절에서 본 것처럼 지금 설치된 `@types/react` 19.3에서는 deprecated(더 이상 쓰지 말라는) 표시로 취소선이 그어진다. 정확히 쓰면 `React.SubmitEvent<HTMLFormElement>` 다. 5-3의 `handleUpdateColumn` 도 같다 |
| `e.preventDefault()` | `form` 제출의 기본 동작(페이지 새로고침)을 막는다((10)편 3절) |
| `newColumnTitle.trim()` | 앞뒤 공백을 지운다. 공백만 쳤으면 빈 글자가 되어 `return`. `required` 는 공백만 친 것은 못 막아서 한 번 더 확인한다 |
| `await createColumn(...)` | 저장이 끝날 때까지 기다린다 |
| `setNewColumnTitle('')`, `setIsCreatingColumn(false)` | 입력칸을 비우고 팝업을 닫는다 |

- **호출:** Create Columns → `onSubmit` → `handleCreateColumn` → `createColumn` → `columnService.createColumn` → Supabase에 `POST /rest/v1/columns` → `201` 과 저장된 줄 → `setColumns`
- **동작:** 팝업이 닫히고 add another list 버튼 바로 앞에 **빈 컬럼**(배지 `0`)이 생긴다. 새로고침해도 그대로 있다.

---

## 4. ⋯ 버튼으로 수정 팝업 열기 — `handleEditColumn`

**할 일:** 어느 컬럼의 ⋯ 를 눌렀는지 기억하고, 그 컬럼 제목을 입력칸에 채운 채로 팝업을 연다.

### 4-1. (8)·(10)편에서 남겨 둔 빈칸 두 개 채우기

(10)편까지 ⋯ 버튼은 눌러도 아무 일이 없었다. 이유가 두 가지였다.

```tsx
// (10)편까지 — 버튼에 onClick 이 없다
<Button variant="ghost" size="sm" className="flex-shrink-0">
    <MoreHorizontal/>
</Button>

// (10)편까지 — 넘기는 함수도 빈 함수
onEditColumn={() => { } } // 영상에서 컬럼 수정 함수 만들면 교체
```

이번에 둘 다 채웠다.

```tsx
// DroppableColumn — 버튼에 onClick 추가
<Button variant="ghost" size="sm" className="flex-shrink-0" onClick={()=>onEditColumn(column)}>
    <MoreHorizontal/>
</Button>
```

```tsx
// 페이지 — 빈 함수를 handleEditColumn 으로 교체
<DroppableColumn
    key={key}
    column={column}
    onCreateTask={handleCreateTask}
    onEditColumn={handleEditColumn}
>
```

- `onClick={()=>onEditColumn(column)}`: 화살표 함수로 감싸서 **이 컬럼(`column`)** 을 넘긴다. `onClick={onEditColumn}` 처럼 그대로 넘기면 `column` 자리에 **클릭 이벤트**가 들어간다. (10)편 3절의 `onCreateTask` 와 같은 이야기다. 다만 `onEditColumn` 은 (8)편부터 타입이 `(column: ColumnWithTasks) => void` 로 정확히 적혀 있어서(`onCreateTask` 처럼 `any` 가 아니라서), 잘못 넘기면 TypeScript가 `TS2322` 빨간 줄로 잡아 준다.

### 4-2. 상태 3개와 `handleEditColumn`

```tsx
const [isEditingColumn, setIsEditingColumn] = useState(false)
const [editingColumnTitle, setEditingColumnTitle] = useState('')
const [editingColumn, setEditingColumn] = useState<ColumnWithTasks | null>(null)
```

```tsx
function handleEditColumn(column: ColumnWithTasks){
    setIsEditingColumn(true)
    setEditingColumn(column)
    setEditingColumnTitle(column.title)
}
```

| 상태 | 하는 일 |
|---|---|
| `isEditingColumn` | 팝업이 열렸나 |
| `editingColumn` | **어느** 컬럼을 고치는 중인가. 저장할 때 그 컬럼의 `id` 가 필요하다. 처음엔 고르는 컬럼이 없으니 `null` |
| `editingColumnTitle` | 입력칸에 보이는 제목. `column.title` 을 **복사**해서 이것만 고친다 |

- 입력칸이 `column.title` 이 아니라 **복사본**을 고치기 때문에, 글자를 지우거나 바꿔도 화면의 컬럼 제목은 그대로다. Cancel 하면 원래 제목이 그대로 남는다.
- (7)편 보드 수정에서 ⋯ 를 누를 때 `setNewTitle(board?.title ?? "")` 로 지금 제목을 복사해 둔 것과 같은 방식이다.

### 4-3. Edit Column 팝업

2번 Create New Column 팝업을 복사해서 바꿨다.

```tsx
<Dialog open={isEditingColumn} onOpenChange={setIsEditingColumn}>
    <DialogContent className="w-[95vw] max-w-[425px] mx-auto">
        <DialogHeader>
            <DialogTitle>Edit Column</DialogTitle>
            <p>Update the title of your column</p>
        </DialogHeader>
        <form className="space-y-4" onSubmit={handleUpdateColumn}>
            <div className="space-y-2">
                <Label>Column Title</Label>
                <Input 
                    id="columnsTitle" 
                    value={editingColumnTitle} 
                    onChange={(e)=>setEditingColumnTitle(e.target.value)} 
                    placeholder="제목을 입력하세요"
                    required
                />
            </div>
            <div className="space-y-2 flex justify-end">
                <Button 
                    type="button"
                    variant="outline"
                    onClick={()=>{
                        setIsEditingColumn(false)
                        setEditingColumnTitle("")
                        setEditingColumn(null)
                    }}
                >
                    Cancel
                </Button>
                <Button type="submit">Edit Columns</Button>
            </div>
        </form>
    </DialogContent>
</Dialog>
```

글자(팝업 제목·설명·제출 버튼 이름)를 빼면, Create 팝업과 동작이 다른 곳은 네 군데다.

| 자리 | Create New Column | Edit Column |
|---|---|---|
| 여는 상태 | `isCreatingColumn` | `isEditingColumn` |
| 입력칸 값 | `newColumnTitle` (처음엔 빈칸) | `editingColumnTitle` (처음부터 지금 제목) |
| 제출 함수 | `handleCreateColumn` | `handleUpdateColumn` (5번) |
| Cancel | 팝업만 닫는다 | 팝업을 닫고 **상태 3개를 비운다** |

- **호출:**

  ```
  ⋯ 클릭
  → DroppableColumn 의 onClick → onEditColumn(column)
  → 페이지가 넘긴 handleEditColumn(column)
  → setIsEditingColumn(true) · setEditingColumn(column) · setEditingColumnTitle(column.title)
  → 페이지가 다시 그려짐 → <Dialog open={true}>
  ```

- **동작:** 팝업이 뜨고 입력칸에 **그 컬럼의 지금 제목**이 들어 있다. 어느 컬럼의 ⋯ 를 눌렀느냐에 따라 채워지는 제목이 다르다.

---

## 5. 이름 저장하기 — `handleUpdateColumn` → `updateColumn` → `columnService.updateColumnTitle`

### 5-1. `columnService.updateColumnTitle`

`lib/services.ts` 의 `columnService` 에 추가한다.

```ts
async updateColumnTitle(
    supabase: SupabaseClient,
    columnId : string,
    title : string,
): Promise<Column>{
    const {data, error} = await supabase
    .from("columns")
    .update({title})
    .eq("id", columnId)
    .select()
    .single()

    if(error) throw error
    
    return data
}
```

| 코드 | 뜻 |
|---|---|
| `.update({title})` | `{title: title}` 의 줄임. `title` 칸만 바꾼다 |
| `.eq("id", columnId)` | id가 `columnId` 인 줄만 |
| `.select().single()` | 바뀐 뒤의 **한 줄**을 돌려받는다 |

- (11)편 `taskService.moveTask` 는 `.select()` 가 없어서 아무것도 돌려받지 않았다(`204`, 본문 없음). 이번에는 `.select().single()` 이 있어서 바뀐 줄을 받아 화면에 쓸 수 있다.
- `boardService.updateBoard` 처럼 `updated_at` 을 같이 보내지 않는다. `columns` 테이블에는 `updated_at` 칸이 없다((3)편). 보냈다면 (11)편 에러 ④처럼 `PGRST204` 가 났을 것이다.
- 반환 타입은 처음에 `updateBoard` 를 복사해서 `Promise<Board>` 였다가 `Promise<Column>` 으로 고쳤다(6-4).

### 5-2. `useBoard` 의 `updateColumn`

```ts
async function updateColumn(columnId:string, title:string) {
    try{
        const updateColumn = await columnService.updateColumnTitle(supabase!, columnId, title)

        setColumns((prev) => prev.map((col) => col.id === columnId ? {...col, ...updateColumn} : col))
        return updateColumn
        
    }catch(err){
        setError(err instanceof Error ? err.message : "열의 이름을 바꾸지 못했습니다.")
    } 
}
```

```ts
return{
    ...
    createColumn,
    updateColumn
}
```

| 코드 | 뜻 |
|---|---|
| `prev.map(...)` | 컬럼을 하나씩 보면서 **새 배열**을 만든다 |
| `col.id === columnId ? ... : col` | 고친 컬럼이면 새 객체로 바꾸고, 아니면 **그대로** 둔다 |
| `{...col, ...updateColumn}` | 원래 컬럼의 값을 먼저 펼치고, 그 위에 DB가 돌려준 값(새 `title` 등)을 **덮어쓴다** |

**`col` 을 같이 펼쳐야 하고, 펼치는 순서도 중요하다.**

- DB가 돌려준 컬럼 줄에는 `tasks` 가 없다(3-2의 `tasks: []` 와 같은 이유). `col.id === columnId ? updateColumn : col` 처럼 DB 값만 넣으면 TypeScript가 막는다. 억지로 넣어도 `tasks` 가 `undefined` 라서 화면이 깨진다(3-2와 같다). `col` 을 같이 펼쳐야 `tasks` 가 남는다.
- 순서는 `title` 때문에 중요하다. 같은 이름의 값은 **뒤에 펼친 쪽이 이긴다.** `{...updateColumn, ...col}` 로 뒤집으면 `col` 의 옛 제목이 새 제목을 다시 덮는다. DB에는 저장됐는데 화면은 새로고침하기 전까지 옛 제목 그대로다. 이 실수는 TypeScript도 못 잡는다.

> **(11)편과 비교 — 원본을 고치지 않는다**
> (11)편 `handleDragOver` 는 `prev` 안의 컬럼 객체를 직접 고쳐서(`column.tasks = tasks`) 개발 모드 StrictMode에서 순서가 섞였다(11-1). 여기서는 `map` 으로 새 배열을, `{...col, ...}` 로 새 객체를 만든다. `prev` 는 그대로라서 React가 이 함수를 두 번 실행해도 결과가 같다.

- 함수 이름도 `updateColumn`, 안에서 만든 변수 이름도 `updateColumn` 이다. 함수 안에서는 **변수가 이겨서** 동작은 문제없지만 읽을 때 헷갈린다. `useBoard` 의 `updateBoard` 도 같은 모양이다(`const updateBoard = ...`).
- `catch` 메시지도 처음엔 `createColumn` 에서 복사한 `"열을 생성하지 못했습니다."` 그대로였다가 고쳤다(6-4).

### 5-3. 페이지의 `handleUpdateColumn`

```tsx
const {board, createColumn, updateBoard, columns, createRealTask, setColumns, moveTask, updateColumn} = useBoard(id)
```

```tsx
async function handleUpdateColumn(e:React.FormEvent) {
    e.preventDefault()

    if(!editingColumnTitle.trim() || !editingColumn) return;

    await updateColumn(editingColumn?.id, editingColumnTitle.trim())

    setEditingColumnTitle('');
    setIsEditingColumn(false)
    setEditingColumn(null)
}
```

| 코드 | 뜻 |
|---|---|
| `!editingColumnTitle.trim()` | 제목을 다 지웠으면 저장하지 않는다 |
| `!editingColumn` | 고를 컬럼이 없으면(`null`) 저장하지 않는다. 이 줄 덕분에 아래에서 `editingColumn` 은 `null` 이 아니라고 TypeScript가 안다. 그래서 `editingColumn?.id` 의 `?.` 는 없어도 된다(있어도 동작은 같다) |
| `updateColumn(editingColumn?.id, ...)` | 4번에서 기억해 둔 컬럼의 `id` 를 여기서 쓴다 |
| 마지막 세 줄 | Cancel 과 같은 정리. 상태 3개를 비우고 팝업을 닫는다 |

- **호출:** Edit Columns → `onSubmit` → `handleUpdateColumn` → `updateColumn` → `columnService.updateColumnTitle` → Supabase에 `PATCH /rest/v1/columns?id=eq.…` → `200` 과 바뀐 줄 → `setColumns`
- **동작:** 팝업이 닫히고 그 컬럼의 제목만 바뀐다. 카드와 배지 숫자는 그대로다. 새로고침해도 새 제목이다.

> **RLS는 괜찮았나?**
> (11)편 에러 ⑤에서는 tasks UPDATE 정책이 아직 `auth.uid()` 를 써서 `22P02` 가 났다. 그때 `auth.uid()` 를 쓰는 정책을 SQL로 찾았더니 tasks 하나뿐이었다. columns 의 UPDATE 정책은 (4)편에서 이미 `requesting_user_id()` 로 고쳐 두었기 때문에 이번에는 바로 저장됐다.

---

## 6. 헷갈렸던 점

### 6-1. 팝업을 여는 방법이 두 가지 — `DialogTrigger` vs `open` 상태

같은 페이지에 팝업 여는 방법이 두 가지 섞여 있다.

| | 컬럼별 Add Task ((10)편) | 컬럼 수정 (이번 편) |
|---|---|---|
| 팝업 위치 | **각 컬럼 안**에 하나씩 | **페이지에 하나** |
| 여는 방법 | `<DialogTrigger>` 가 직접 연다 | 페이지의 `isEditingColumn` 상태로 연다 |
| 어느 컬럼인지 | 팝업이 그 컬럼 안에 있어서 `column` 을 바로 쓸 수 있다. 다만 지금 코드는 `column` 을 넘기지 않아서 항상 첫 컬럼에 들어간다((10)편에서 남긴 것) | `editingColumn` 상태에 기억해 둔다 |
| 저장 후 닫기 | 닫으라고 바꿀 상태가 없어서 `document.querySelector('[data-state="open"]')` 로 열린 버튼을 찾아 한 번 더 누른다((9)편 4절) | `setIsEditingColumn(false)` 한 줄 |

- Add Task는 버튼과 팝업이 **같은 컴포넌트(`DroppableColumn`) 안**에 있다. 그래서 `DialogTrigger` 로 감싸기만 하면, 버튼을 누를 때 열리고 바깥 클릭·ESC·X 버튼으로 닫히는 것은 shadcn이 알아서 한다. 대신 코드에서 "이제 닫아라"라고 할 방법이 없어서, 저장한 뒤 닫을 때 위처럼 버튼을 찾아 누르는 방법을 썼다. (9)편 4절에서 "상태로 여닫는 쪽이 안전하다"고 적은 바로 그 차이다.
- 컬럼 수정은 버튼은 `DroppableColumn` 안에, 팝업은 페이지에 있다. 버튼이 팝업을 직접 열 수 없으니 `onEditColumn(column)` 으로 페이지에 "이 컬럼이 눌렸다"고 알리고, 페이지가 상태를 바꿔서 연다. (7)편 보드 수정(Navbar의 ⋯ → `onEditBoard`)도 같은 방식이다.
- 팝업을 하나만 두면 컬럼이 10개여도 수정 팝업은 1개다. 대신 "지금 어느 컬럼을 고치는 중인지"를 상태로 따로 들고 있어야 한다.

### 6-2. 입력값을 읽는 방법도 두 가지 — `FormData` vs `value` + `onChange`

| | Add Task ((9)·(10)편) | 컬럼 추가·수정 (이번 편) |
|---|---|---|
| 읽는 방법 | 제출할 때 `new FormData(e.currentTarget)` 로 한꺼번에 읽는다 | 글자를 칠 때마다 상태에 저장한다(제어 컴포넌트) |
| 입력칸 수 | 제목·설명·담당자·마감일·우선순위… 여러 개 | 제목 **하나** |
| 처음 값 | 빈칸 | 수정 팝업은 **지금 제목**을 채워야 한다 |

- 입력칸이 많으면 상태를 칸마다 만들기 번거로워서 `FormData` 가 편하다.
- 입력칸이 하나이고 처음 값을 채워 넣거나 다 쓴 뒤 비워야 하면 상태로 묶는 쪽이 편하다. `setEditingColumnTitle(column.title)` 한 줄로 입력칸에 제목이 들어간다.

### 6-3. 만드는 중에 잠깐 — 복사해 둔 `handleUpdateColumn`

수정 팝업을 먼저 만들 때 `handleUpdateColumn` 을 `handleCreateColumn` 그대로 복사해 두었다. 안에서 여전히 `newColumnTitle` 과 `createColumn` 을 쓰고 있었다.

```tsx
// 만드는 중이던 상태
async function handleUpdateColumn(e:React.FormEvent) {
    e.preventDefault()
    if(!newColumnTitle.trim()) return;
    await createColumn(newColumnTitle.trim())   // ← 수정이 아니라 추가
    ...
}
```

그 상태에서는 Create 팝업에 글자를 쓰고 Cancel 로 닫은 뒤, 수정 팝업에서 저장하면 **수정이 아니라 새 컬럼이 생겼다.** Cancel 이 `newColumnTitle` 을 비우지 않기 때문이다(2번). 함수를 복사할 때는 안에서 쓰는 상태와 함수 이름까지 다 바꿨는지 확인해야 한다. 5-3에서 `editingColumnTitle`, `editingColumn`, `updateColumn` 으로 모두 바꿨다.


### 6-4. 다 만들고 나서 고친 것 — 복사하면서 남은 흔적

6-3처럼 코드를 복사해서 만들다 보니 **이름이나 글자를 덜 바꾼 곳**이 세 군데 남아 있었다. 글을 정리하면서 찾아서 고쳤다.

| 곳 | 처음 | 고친 것 |
|---|---|---|
| 두 팝업의 취소 버튼 | `Cencel` | `Cancel` |
| `columnService.updateColumnTitle` 반환 타입 | `Promise<Board>` (`updateBoard` 를 복사한 흔적) | `Promise<Column>` |
| `useBoard` 의 `updateColumn` 에러 메시지 | `"열을 생성하지 못했습니다."` (`createColumn` 을 복사한 흔적) | `"열의 이름을 바꾸지 못했습니다."` |

**반환 타입이 틀렸는데 TypeScript는 왜 가만히 있었나?**
`services.ts` 는 `SupabaseClient` 에 DB 타입을 알려 주지 않고 쓴다(`SupabaseClient<Database>` 가 아니라 그냥 `SupabaseClient`). 그래서 Supabase가 돌려주는 `data` 의 타입이 `any` 고, `any` 는 어떤 반환 타입 자리에도 들어간다. `Promise<Board>` 라고 적어도, `Promise<Column>` 이라고 적어도 통과한다((10)편 3절에서 본 `any` 와 같은 이야기). 실제로 돌아오는 것은 컬럼 줄이라 `Promise<Column>` 이 맞다.

---

## 7. 아직 남은 것

| 항목 | 지금 상태 |
|---|---|
| 지난 주석 | `onEditColumn={handleEditColumn} // 영상에서 컬럼 수정 함수 만들면 교체` — 이미 교체했으니 지워도 된다 |
| 팝업 너비 | `max-w-[425px]` 를 줬지만 넓은 화면에서는 shadcn의 `sm:max-w-sm` 이 이겨서 384px이다((7)편과 같다) |
| `Label` 과 입력칸 연결 | `htmlFor` 가 없어서 라벨을 눌러도 입력칸에 커서가 가지 않는다. 두 팝업의 입력칸 `id` 도 둘 다 `columnsTitle` 이다(두 팝업이 동시에 열리지는 않아서 부딪히지는 않는다) |
| `createColumn` 의 `throw` | `try` **밖**에 있어서 `setError` 로 가지 않는다. `handleCreateColumn` 에도 `try` 가 없어서 거기서도 잡히지 않고 **처리되지 않은 에러**가 된다(개발 모드에서는 Next.js 에러 화면에 뜬다). `await` 아래 두 줄도 실행되지 않아서 팝업이 **열린 채로 남는다**(바로 아래 줄과 반대). 보드나 로그인 정보가 없을 때, 즉 보드를 다 불러오기 전에 누르거나 로그아웃 상태·잘못된 보드 주소처럼 보드 불러오기가 실패한 경우에 생긴다 |
| 실패해도 팝업이 닫힘 | `createColumn`·`updateColumn` 은 실패하면 `setError` 만 부르고 끝난다. 페이지는 그걸 모르고 팝업을 닫는다. `error` 를 화면에 보여 주지도 않아서 실패는 Network 탭에서만 보인다((11)편과 같다) |
| 컬럼 지우기·순서 바꾸기 | 아직 없다 |
| (11)편에서 남긴 것 | 다른 컬럼의 같은 순번 카드 위에 놓기, 컬럼·카드 id 겹침, 같은 컬럼 안 순서 저장, 휴대폰에서 끌기, 카드 코드 중복 |
| (10)편 이전에 남긴 것 | 컬럼별 Add Task가 항상 첫 컬럼에 들어감, `onCreateTask` 의 `any` 타입, Add Task 팝업 `Label` 의 `htmlFor` 없음, `min-2-0`·`ms:py-6` 오타, `"No descriptiom"`, `node:test` import, `/dashboard` 로그인 보호 |

---

## 8. 결과

보드 상세 페이지에서

- 마지막 컬럼 뒤에 회색 점선 **+ add another list** 버튼이 생긴다. 넓은 화면(1024px 이상)에서는 오른쪽, 좁은 화면에서는 맨 아래다.
- 누르면 **Create New Column** 팝업이 뜨고, 제목을 입력해 **Create Columns** 를 누르면 버튼 바로 앞에 빈 컬럼(배지 `0`)이 생긴다. 새로고침해도 남아 있다.
- 새 컬럼도 `DroppableColumn` 으로 그려지니 (11)편처럼 카드를 끌어다 놓을 수 있다. 다만 새 컬럼의 **+ Add Task** 를 눌러도 카드는 첫 컬럼에 생긴다((10)편에서 남긴 것).
- 컬럼 머리의 **⋯** 를 누르면 **Edit Column** 팝업에 그 컬럼의 지금 제목이 들어 있다. 고쳐서 **Edit Columns** 를 누르면 그 컬럼 제목만 바뀌고, 새로고침해도 유지된다.

---

## 태그

**전체:** `Next.js`, `Next.js 15`, `React`, `TypeScript`, `Supabase`, `shadcn/ui`, `Radix UI`, `Dialog`, `DialogTrigger`, `모달`, `useState`, `제어 컴포넌트`, `FormData`, `form`, `onSubmit`, `preventDefault`, `props`, `콜백`, `불변성`, `스프레드 연산자`, `any 타입`, `CRUD`, `insert`, `update`, `Fragment`, `트렐로 클론`, `클론 코딩`, `토이 프로젝트`

**10개 이내:** `Next.js`, `React`, `TypeScript`, `Supabase`, `shadcn/ui`, `Dialog`, `useState`, `CRUD`, `트렐로 클론`, `클론 코딩`
