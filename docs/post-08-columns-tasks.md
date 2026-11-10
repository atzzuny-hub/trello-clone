# Trello Clone 클론 코딩 (8) — 컬럼·태스크 불러오기와 Filter·Add Task Dialog

참고 영상: https://www.youtube.com/watch?v=ugxI1o5SyMs
영상 구간: `03:59:55` Finished Board Page Setup & State Management

(7)편에서는 보드 상세 페이지 헤더의 ⋯ 버튼으로 보드 제목과 색을 바꿨다. 그런데 페이지 본문은 아직 비어 있다. (6)편에서 `columns` 를 불러만 두고 그리지 않았기 때문이다.
이번 글에서는 보드 상세 페이지의 **나머지 뼈대**를 만든다.

- 헤더 오른쪽에 **Filter 버튼**과 Filter Dialog
- 본문 위쪽에 **Total Tasks**(전체 태스크 수)와 **Add Task** 버튼, 태스크 입력 Dialog
- 각 컬럼에 들어 있는 **태스크를 같이 불러와서** 컬럼 상자(To Do, In Progress …)로 그리기

Filter와 Add Task는 이번 편에서는 **모양만** 만든다. 태스크를 실제로 저장하는 `createTask` 는 (9)편에서, 필터가 실제로 걸러 내는 동작은 영상 뒤쪽(`06:05:00` 근처 Task filtering UI)에서 만든다.

작업 순서는 이렇다.

1. 컬럼 + 그 안의 태스크를 담는 타입 `ColumnWithTasks` — `lib/supabase/models.ts`
2. 보드 하나의 태스크를 전부 불러오는 `taskService.getTasksByBoard` — `lib/services.ts`
3. `getBoardWithColumns` 에서 태스크를 컬럼별로 나눠 담기
4. `useBoard` 가 `ColumnWithTasks[]` 를 들고 있게 바꾸기 — `lib/hooks/useBoards.ts`
5. Navbar에 Filter 버튼 추가 — `components/navbar.tsx`
6. Filter Dialog (모양만) — `app/boards/[id]/page.tsx`
7. Total Tasks와 Add Task Dialog (모양만)
8. `Column` 컴포넌트로 컬럼 그리기

---

## 0. 전체 흐름

```
useBoard(id)                                   ← lib/hooks/useBoards.ts
   │
   ▼
boardDataService.getBoardWithColumns()         ← lib/services.ts
   ├─ boardService.getBoard      ┐ 동시에 (6편)
   ├─ columnService.getColumns   ┘
   └─ taskService.getTasksByBoard              ← 이번 편에서 추가
   │
   ▼ 태스크를 column_id 로 나눠서 컬럼마다 tasks 를 붙인다
columnsWithTasks = [
  { id, title: "To Do", ..., tasks: [태스크, 태스크] },
  { id, title: "In Progress", ..., tasks: [] },
  ...
]
   │
   ▼
page.tsx
   ├─ Navbar ─ Filter 버튼 ─▶ Filter Dialog
   ├─ Total Tasks = 모든 컬럼의 tasks 개수 합
   ├─ Add Task 버튼 ─▶ Create New Task Dialog
   └─ columns.map ─▶ <Column> (제목 + 태스크 수)
```

---

## 1. 타입 — `ColumnWithTasks`

`lib/supabase/models.ts` 에 추가한다.

```ts
export type ColumnWithTasks = Column & {
    tasks: Task[]
}
```

- `Column` 은 (6)편까지 쓰던 컬럼 타입(`id`, `board_id`, `title`, `sort_order` …)이다.
- `&` 는 **두 타입을 합친다**는 뜻이다. "`Column` 의 모든 항목 + `tasks` 배열"을 가진 타입이 된다.
- 같은 걸 `interface ColumnWithTasks extends Column { tasks: Task[] }` 로 써도 된다. 영상은 `type` + `&` 를 썼다.
- `Task` 는 이 파일에서 `ColumnWithTasks` 보다 **아래에** 선언돼 있다. 타입은 파일 전체에서 미리 알려져 있어서, 순서가 거꾸로여도 에러가 나지 않는다.

DB의 `columns` 테이블에는 `tasks` 칸이 없다. 이 타입은 **화면에서 쓰기 편하게 우리가 조립한 모양**이다.

---

## 2. 보드의 태스크 불러오기 — `taskService.getTasksByBoard`

`lib/services.ts` 에 `taskService` 를 새로 만든다.

```ts
import { Board, Column, Task } from "./supabase/models";

export const taskService = {
    async getTasksByBoard(supabase: SupabaseClient, boardId: string) : Promise<Task[]>{
        const {data, error} = await supabase
        .from("tasks")
        .select(
            `
                *,
                columns!inner(board_id)
            `
        )
        .eq("columns.board_id", boardId)
        .order("sort_order", { ascending: true})

        if(error) throw error

        return data || [];
    }
}
```

### 왜 `columns!inner(board_id)` 가 필요할까

(3)편에서 만든 `tasks` 테이블에는 **`board_id` 가 없다.** 태스크는 `column_id` 만 갖고, 컬럼이 `board_id` 를 갖는다.

```
boards ──< columns ──< tasks
  id        id           id
            board_id     column_id
```

그래서 "이 보드의 태스크"를 바로 `.eq("board_id", ...)` 로 찾을 수 없다. 태스크 → 컬럼으로 **한 칸 건너가서** 컬럼의 `board_id` 를 봐야 한다.

| 코드 | 뜻 |
|---|---|
| `*` | 태스크의 모든 칸 |
| `columns(board_id)` | 태스크의 `column_id` 로 연결된 **컬럼을 같이 가져오되**, 그 컬럼의 `board_id` 만 가져온다 |
| `!inner` | 연결된 컬럼이 조건에 맞는 태스크**만 남긴다**(SQL의 INNER JOIN) |
| `.eq("columns.board_id", boardId)` | 연결된 컬럼의 `board_id` 가 이 보드인 것만 |
| `.order("sort_order", ...)` | 컬럼 안 순서대로 정렬 |

> **`!inner` 를 빼면?**
> `.eq("columns.board_id", ...)` 조건이 **같이 가져온 컬럼 쪽에만** 걸린다. 다른 보드의 태스크도 그대로 오고, 그 태스크의 `columns` 값만 `null` 이 된다. `!inner` 를 붙여야 조건에 안 맞는 **태스크 자체가 빠진다.**

- 결과로 오는 태스크에는 `columns: { board_id: "..." }` 라는 칸이 하나 더 붙어 있다. `Task` 타입에는 없는 칸이지만, 쓰지 않으니 그냥 둔다.
- (3)편에서 `tasks` 테이블 RLS 정책을 "태스크 → 컬럼 → 보드의 `user_id` 가 나인 것"으로 만들었고, (4)편에서 Clerk 사용자 ID(`requesting_user_id()`)를 쓰게 고쳤다. 그래서 이 조건이 없어도 남의 태스크는 오지 않는다. `.eq()` 는 **내 보드 여러 개 중 이 보드 것만** 고르는 역할이다.
- `data || []`: 에러가 없으면 Supabase는 결과가 0개여도 `null` 이 아니라 빈 배열 `[]` 을 준다. `|| []` 는 혹시 `null` 이 오더라도 받는 쪽에서 `.filter()` 를 바로 쓸 수 있게 해 두는 안전장치다.

> `services.ts` 맨 위에 있던 `import { createClient } from "./supabase/client"` 는 쓰지 않아서 지웠다. (4)편에서 Supabase 클라이언트를 함수 인자(`supabase: SupabaseClient`)로 받게 바꾼 뒤로 남아 있던 줄이다.

---

## 3. 컬럼마다 태스크 나눠 담기 — `getBoardWithColumns`

(6)편에서 만든 `boardDataService.getBoardWithColumns` 를 고친다.

```ts
async getBoardWithColumns(supabase: SupabaseClient, boardId: string){
    const [board, columns] = await Promise.all([
        boardService.getBoard(supabase, boardId),
        columnService.getColumns(supabase, boardId)
    ])

    if(!board) throw new Error("보드를 찾을 수 없습니다")

    const tasks = await taskService.getTasksByBoard(supabase, boardId)

    const columnsWithTasks = columns.map((column) => ({
        ...column,
        tasks: tasks.filter((task) => task.column_id === column.id),
    }))

    return{
        board,
        columnsWithTasks
    }
},
```

- 태스크는 **보드 전체 것을 한 번에** 불러온다(요청 1번). 그다음 자바스크립트에서 컬럼별로 나눈다. 컬럼마다 따로 요청하면 컬럼 4개 = 요청 4번이 된다.
- `columns.map((column) => ({ ...column, tasks: ... }))`
  - `...column`: 컬럼의 칸(`id`, `title` …)을 그대로 복사한다.
  - `tasks: tasks.filter(...)`: 그 컬럼의 `id` 와 `column_id` 가 같은 태스크만 골라 붙인다.
  - `=> ({ ... })`: 화살표 함수에서 객체를 바로 돌려줄 때는 `( )` 로 감싼다. 안 감싸면 `{ }` 를 함수 몸통으로 읽는다.
- 돌려주는 이름이 `columns` 에서 **`columnsWithTasks`** 로 바뀌었다. 그래서 이걸 받는 `useBoard` 도 고쳐야 한다.

---

## 4. `useBoard` 가 `ColumnWithTasks[]` 를 들고 있게

`lib/hooks/useBoards.ts`

```ts
import { Board, Column, ColumnWithTasks } from "../supabase/models";

export function useBoard(boardId: string){
    ...
    const [columns, setColumns] = useState<ColumnWithTasks[]>([])
    ...
            const data = await boardDataService.getBoardWithColumns(supabase!, boardId)
            setBoard(data.board)
            setColumns(data.columnsWithTasks)
    ...
}
```

- 상태 타입을 `Column[]` → `ColumnWithTasks[]` 로 바꿨다. 이제 페이지에서 `column.tasks` 를 써도 TypeScript가 "그런 칸 없다"고 하지 않는다.
- `data.columns` 를 그대로 두면 `Property 'columns' does not exist` 에러가 난다. 3단계에서 돌려주는 이름을 바꿨기 때문이다.

---

## 5. Navbar에 Filter 버튼

`components/navbar.tsx`. Navbar는 (6)편에서 보드 페이지용 헤더를 따로 그리게 만들어 두었다. 거기에 props 두 개와 버튼을 추가한다.

```tsx
import { ArrowLeft, ArrowRight, Filter, MoreHorizontal, SquareKanban } from 'lucide-react'
import { Badge } from "@/components/ui/badge";

interface Props{
    boardTitle?: string;
    onEditBoard?: ()=> void;

    onFilterClick?: ()=> void;
    filterCount?: number
}

export default function Navbar({boardTitle, onEditBoard, onFilterClick, filterCount=2} : Props){
```

보드 헤더 안, 제목 묶음 **다음에** 넣는다. 헤더가 `flex justify-between` 이라 이 묶음은 오른쪽 끝에 붙는다.

```tsx
<div className='flex items-center space-x-2 sm:space-x-4 flex-shrink-0'>
    {onFilterClick &&
        <Button
            variant="outline"
            size='sm'
            className={`text-xs sm:text-sm ${
                filterCount > 0 ? "bg-blue-100 border-blue-200" : ""}
            `}
            onClick={onFilterClick}
        >
            <Filter className='h-3 w-3 sm:w-4 sm:h-4 mr-1 sm:mr-2'/>
            <span className='hidden sm:inline'>Filter</span>
            {filterCount > 0 &&
                <Badge variant={'secondary'} className='text-xs ml-1 sm:ml-2 bg-blue-100 border-blue-200'>
                    {filterCount}
                </Badge>
            }
        </Button>
    }
</div>
```

| 코드 | 뜻 |
|---|---|
| `onFilterClick &&` | ⋯ 버튼(`onEditBoard &&`)과 같은 방식. 함수를 받았을 때만 버튼을 그린다 |
| `filterCount > 0 ? "bg-blue-100 ..." : ""` | 필터가 하나라도 걸려 있으면 버튼을 파랗게 |
| `hidden sm:inline` | 좁은 화면에서는 "Filter" 글자를 숨기고 아이콘만 |
| `{filterCount > 0 && <Badge>}` | 걸린 필터 개수를 작은 배지로 |
| `flex-shrink-0` | 제목이 길어도 이 버튼 묶음은 줄어들지 않게 |

- `filterCount=2`: 아직 필터 기능이 없어서 **배지가 어떻게 보이는지 확인하려고 넣은 임시 값**이다. 페이지에서도 `filterCount={2}` 를 넘긴다. 필터를 만들면 실제 개수로 바꾼다.

---

## 6. Filter Dialog (모양만)

`app/boards/[id]/page.tsx`. 열고 닫는 방식은 (7)편의 보드 수정 Dialog와 똑같다.

```tsx
const [isFilterOpen, setIsFilterOpen] = useState(false);
```

```tsx
<Navbar
    boardTitle={board?.title}
    onEditBoard={() => { ... }}
    onFilterClick={()=>setIsFilterOpen(true)}
    filterCount={2}
/>
```

```tsx
<Dialog open={isFilterOpen} onOpenChange={setIsFilterOpen}>
    <DialogContent className="w-[95vw] max-w-[425px] mx-auto">
        <DialogHeader>
            <DialogTitle>Filter Tasks</DialogTitle>
            <p>
                우선순위, 담당자 또는 마감일을 기준으로 작업을 필터링하세요.
            </p>
        </DialogHeader>
        <div className="space-y-4">
            <div className="space-y-2">
                <Label>Priority</Label>
                <div className="flex flex-wrap gap-2">
                    {["low", "medium", "high"].map((priority, key) => (
                        <Button key={key} variant={'outline'} size="sm">
                            {priority.charAt(0).toUpperCase() + priority.slice(1)}
                        </Button>
                    ))}
                </div>
            </div>

            <div className="space-y-2">
                <Label>Due Date</Label>
                <Input type="date"/>
            </div>

            <div className="flex justify-between pt-4">
                <Button type="button" variant="outline">Clear Filters</Button>
                <Button type="button" onClick={()=>setIsFilterOpen(false)}>Apply Filters</Button>
            </div>
        </div>
    </DialogContent>
</Dialog>
```

- `priority.charAt(0).toUpperCase() + priority.slice(1)`: 첫 글자만 대문자로. `"low"` → `"L"` + `"ow"` → `"Low"`.
- `<Input type="date"/>`: 브라우저가 기본으로 주는 **날짜 고르기 칸**. 달력 아이콘을 누르면 달력이 뜬다.
- `justify-between`: Clear Filters는 왼쪽 끝, Apply Filters는 오른쪽 끝.
- 지금은 **Apply Filters로 닫기만** 된다. 우선순위 버튼, 날짜, Clear Filters는 눌러도 아무 일도 안 한다.
- 담당자(Assignee) 칸은 주석으로 막아 두었다. 영상 작성자의 최종 코드에도 담당자 필터 칸은 없다.

> **영상과 다른 점**
> 설명 문구를 한국어로 바꿨다. 영상의 설명 문단은 `<p className="text-sm text-gray-600">` 처럼 작은 회색 글씨인데, 여기서는 클래스 없이 `<p>` 만 썼다.

---

## 7. Total Tasks와 Add Task Dialog (모양만)

`useBoard` 에서 `columns` 도 꺼낸다. (7)편까지는 `board`, `updateBoard` 만 꺼냈었다.

```tsx
const {board, updateBoard, columns} = useBoard(id)
```

### 7-1. Total Tasks

```tsx
{/* Board Content */}
<main className="container mx-auto px-2 sm:px-4 py-4 ms:py-6">
    {/* Stats */}
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6 space-y-4 sm:space-y-0">
        <div className="flex flex-wrap items-center gap-4 sm:gap-6">
            <div className="text-sm text-gray-600">
                <span className="font-medium">Total Tasks:</span>
                {columns.reduce((sum, col) => sum + col.tasks.length, 0)}
            </div>
        </div>

        {/* add task dialog */}
        ...
    </div>
    ...
</main>
```

`columns.reduce((sum, col) => sum + col.tasks.length, 0)` 은 배열을 돌면서 값을 하나로 **모은다.**

```
처음 sum = 0                 ← 마지막 인자 0
To Do        (태스크 2개)  → 0 + 2 = 2
In Progress  (태스크 1개)  → 2 + 1 = 3
Review       (태스크 0개)  → 3 + 0 = 3
Done         (태스크 1개)  → 3 + 1 = 4   → 화면에 4
```

- `sm:flex-row sm:justify-between`: 넓은 화면에서는 Total Tasks는 왼쪽, Add Task 버튼은 오른쪽. 좁은 화면에서는 위아래로 쌓인다.
- `ms:py-6` 은 `sm:py-6` 의 **오타**다(아래 9절).

### 7-2. Add Task Dialog

이번에는 `open` 상태를 만들지 않고 **`DialogTrigger`** 를 쓴다.

```tsx
<Dialog>
    <DialogTrigger asChild>
        <Button className="w-full sm:w-auto">
            <Plus/> Add Task
        </Button>
    </DialogTrigger>
    <DialogContent className="w-[95vw] max-w-[425px] mx-auto">
        <DialogHeader>
            <DialogTitle>Create New Task</DialogTitle>
            <p>
                보드에 작업을 추가하세요
            </p>
        </DialogHeader>

        <form className="space-y-4">
            ...입력칸들...
            <div className="flex justify-end space-x-2 pt-4">
                <Button type="submit">Create Task</Button>
            </div>
        </form>
    </DialogContent>
</Dialog>
```

| 방식 | 쓰는 곳 | 특징 |
|---|---|---|
| `open` + `onOpenChange` (우리 상태) | 보드 수정, Filter | 버튼이 Navbar 처럼 **다른 컴포넌트**에 있어도 열 수 있다 |
| `DialogTrigger` | Add Task | 열기 버튼이 **Dialog 바로 안에** 있을 때. 상태를 Radix가 알아서 관리한다 |

- `asChild`: `DialogTrigger` 가 자기 버튼을 따로 만들지 않고, 안에 있는 우리 `<Button>` 에 "누르면 열기" 기능만 붙인다. 안 쓰면 `<button>` 안에 `<button>` 이 들어가는 잘못된 HTML이 된다.
- `w-full sm:w-auto`: 좁은 화면에서는 버튼이 가로로 꽉 차고, 넓은 화면에서는 글자 길이만큼.

입력칸은 다섯 개다.

```tsx
<div className="space-y-2">
    <Label>Title *</Label>
    <Input
        id="title"
        name="title"
        placeholder="작업 제목을 입력하세요"
    />
</div>
<div className="space-y-2">
    <Label>Description</Label>
    <Textarea
        id="description"
        name="description"
        placeholder="작업 설명을 입력하세요"
        rows={3}
    />
</div>
<div className="space-y-2">
    <Label>Assignee</Label>
    <Input
        id="assignee"
        name="assignee"
        placeholder="누가 이걸 해야 할까요?"
    />
</div>
<div className="space-y-2">
    <Label>Priority</Label>
    <Select name="priority" defaultValue="medium">
        <SelectTrigger>
            <SelectValue/>
        </SelectTrigger>
        <SelectContent>
            {["low", "medium", "high"].map((priority, key) => (
                <SelectItem key={key} value={priority}>
                    {priority.charAt(0).toUpperCase() + priority.slice(1)}
                </SelectItem>
            ))}
        </SelectContent>
    </Select>
</div>

<div className="space-y-2">
    <Label>Due Date</Label>
    <Input type="date" id="dueDate"/>
</div>
```

- (7)편 보드 수정 Dialog는 `value` + `onChange` 로 입력값을 React 상태에 묶었다(제어 컴포넌트). 여기는 상태 없이 **`name`** 만 붙였다. (9)편에서 폼을 제출할 때 `FormData` 로 `name` 별 값을 한꺼번에 꺼낸다.
- `Textarea`: 여러 줄 입력칸. `rows={3}` 은 원래 처음 높이를 3줄로 정하는 속성이다. 다만 shadcn `Textarea` 에는 `field-sizing-content`(내용만큼 자라기)와 `min-h-16` 이 들어 있다. 이걸 지원하는 Chrome 같은 브라우저에서는 `rows` 가 무시되고, 최소 높이(64px)에서 시작해 글이 길어지면 같이 커진다.
- `Select`(shadcn, Radix 기반): 브라우저 기본 `<select>` 대신 모양을 꾸밀 수 있는 선택 상자.
  - `defaultValue="medium"`: 처음에 Medium이 골라져 있다.
  - `SelectValue`: 지금 고른 값의 글자(`Medium`)를 보여 주는 자리.
  - `name="priority"`: Radix Select는 화면에 안 보이는 기본 `<select>` 를 같이 그려서, 폼을 제출할 때 이 값도 함께 보낸다.
- `Badge`, `Select`, `Textarea` 는 (1)편에서 `npx shadcn add` 로 이미 받아 둔 컴포넌트라 새로 설치하지 않았다.

> **영상과 다른 점**
> Add Task Dialog도 설명 문구(`보드에 작업을 추가하세요`)와 입력칸 placeholder를 한국어로 바꿨다. 영상은 `Enter task title`, `Who should do this?` 같은 영어 문구다. 설명 문단은 Filter Dialog처럼 클래스 없이 `<p>` 만 썼다.

> 마감일 칸 `<Input type="date" id="dueDate"/>` 에는 **`name` 이 없다.** 이번 편에서는 저장을 안 해서 티가 안 나지만, (9)편에서 마감일이 저장되지 않는 원인이 된다.

---

## 8. 컬럼 그리기 — `Column` 컴포넌트

같은 `page.tsx` 위쪽에 컬럼 상자 하나를 그리는 컴포넌트를 만든다.

```tsx
function Column({
    column,
    children,
    onCreateTask,
    onEditColumn
}:{
    column: ColumnWithTasks;
    children: React.ReactNode;
    onCreateTask: (taskData:any) => Promise<void>;
    onEditColumn: (column:ColumnWithTasks) => void
}){
    return(
        <div className="w-full lg:flex-shrink-0 lg:w-80">
            <div className="bg-white rounded-lg shadow-sm border">
                {/* Column Header */}
                <div className="p-3 sm:p-4 border-b">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2 min-2-0">
                            <h3 className="font-semibold text-gray-900 text-sm sm:text-base">
                                {column.title}
                            </h3>
                            <Badge variant='secondary' className="text-xs flex-shrink-0">
                                {column.tasks.length}
                            </Badge>
                        </div>
                        <Button variant="ghost" size="sm" className="flex-shrink-0">
                            <MoreHorizontal/>
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    )
}
```

| props | 지금 쓰임 |
|---|---|
| `column` | 컬럼 제목과 태스크 개수(`column.tasks.length`)를 그린다 |
| `children` | 컬럼 안에 넣을 내용(태스크 목록). **아직 그리지 않는다** |
| `onCreateTask` | 컬럼에서 바로 태스크 추가하기. 영상 뒤쪽에서 연결 |
| `onEditColumn` | 컬럼 이름 바꾸기. 영상 뒤쪽에서 연결 |

- `w-full lg:flex-shrink-0 lg:w-80`: 좁은 화면에서는 가로로 꽉 차고, `lg`(1024px) 이상에서는 **320px 고정**에 줄어들지 않는다. 나중에 컬럼을 가로로 늘어놓고 옆으로 스크롤할 때를 위한 준비다.
- 제목 옆 `Badge` 에 그 컬럼의 태스크 수가 나온다. 오른쪽 ⋯ 버튼은 아직 아무 일도 안 한다.
- `min-2-0` 은 `min-w-0` 의 **오타**다(아래 9절).

페이지 아래쪽에서 컬럼마다 `Column` 을 그린다.

```tsx
{/* Board Columns  */}
<div>
    {columns.map((column, key) => (
        <Column
            key={key}
            column={column}
            onCreateTask={async () => { } } // 영상에서 태스크 만들기 함수 만들면 교체
            onEditColumn={() => { } } // 영상에서 컬럼 수정 함수 만들면 교체
        >
            <div>
                {column.tasks.map((task, key) => (
                    <div key={key}>{task.title}</div>
                ))}
            </div>
        </Column>
    ))}
</div>
```

- `onCreateTask`, `onEditColumn` 은 아직 만들 함수가 없어서 **아무것도 안 하는 빈 함수**를 넘겼다. 왜 빈 함수라도 넘겨야 하는지는 바로 아래 에러에서 다룬다.
- `<Column>` 과 `</Column>` 사이에 적은 태스크 목록이 `children` 으로 들어간다. 하지만 `Column` 안에 `{children}` 을 그리는 자리가 없어서 **아직 화면에는 안 나온다.** 태스크 개수 배지만 보인다. (9)편에서 고친다.
- 바깥 `<div>` 에 클래스가 없어서 지금은 컬럼이 **위아래로** 쌓인다. 가로로 늘어놓는 건 (9)편에서 한다.

---

## 9. 막혔던 에러

### ① `Column` props 누락 — `TS2739`

처음에는 영상을 따라 `Column` 에 children만 넘겼다.

```tsx
<Column key={key}>{column.title}</Column>
```

에디터에 빨간 줄이 생기고, `npx tsc --noEmit` 을 돌리면 이렇게 나온다.

```
error TS2739: Type '{ children: string; key: number; }' is missing the following properties from type '{ column: ColumnWithTasks; children: ReactNode; onCreateTask: (taskData: any) => Promise<void>; onEditColumn: (column: ColumnWithTasks) => void; }': column, onCreateTask, onEditColumn
```

- 뜻: "`Column` 은 `column`, `onCreateTask`, `onEditColumn` 을 **꼭** 받아야 하는데 안 넘겼다."
- props 타입에 `?` 가 없으면 **필수**다. `onFilterClick?:` 처럼 `?` 를 붙인 Navbar props는 안 넘겨도 되는 것과 비교된다.
- 타입 문제만이 아니다. `Column` 안에서 `column.title` 을 읽는데 `column` 을 안 넘기면 `undefined.title` 이 된다. 컬럼이 하나라도 있으면 실행 중에 `Cannot read properties of undefined (reading 'title')` 로 화면이 깨진다.

**해결:** `column={column}` 을 넘기고, 아직 없는 두 함수는 빈 함수로 임시 연결했다(8절 코드).

> **영상과 다른 점**
> 영상에서는 이 시점에 props를 다 넘기지 않았는데도 에러가 보이지 않았다.
> `npm run dev`(`next dev`)는 **타입 검사를 하지 않는다.** TypeScript 에러는 에디터의 빨간 줄, `npx tsc --noEmit`, `npm run build` 에서만 보인다. 그래서 개발 서버 화면만 보면 타입 에러가 있는지 모른다. (영상에서는 그 순간 `Column` 이 props를 아직 읽지 않았거나 컬럼이 비어 있었을 수도 있다. 정확히는 확인하지 못했다.)
> 그래서 이 프로젝트는 고칠 때마다 `npx tsc --noEmit` 을 돌린다.

### ② Filter 배지에 숫자가 안 나옴 — `Badge` 를 lucide-react에서 가져옴

```tsx
{filterCount > 0 && <Badge>{filterCount}</Badge>}
```

`filterCount` 는 2인데 배지 자리에 **숫자 대신 작은 아이콘**만 보였다. import를 보니 이렇게 돼 있었다.

```tsx
import { ArrowLeft, ArrowRight, Badge, Filter, MoreHorizontal, SquareKanban } from 'lucide-react'
```

- lucide-react에도 **`Badge` 라는 아이콘**(배지 모양 그림)이 있다. VS Code 자동 import가 shadcn `Badge` 대신 이걸 가져왔다.
- lucide 아이콘은 `<svg>` 그림이다. `children` 으로 넘긴 `{filterCount}` 는 버려지지 않고 `<svg>` 안에 글자로 들어간다. 그런데 SVG는 `<text>` 태그 밖에 있는 글자를 화면에 그리지 않는다. 그래서 개발자 도구로 보면 `2` 가 HTML 안에 있는데도 눈에는 아이콘만 보였다.
- 이때처럼 `<Badge>{filterCount}</Badge>` 만 쓰면 **타입 에러도 안 난다.** 아이콘도 `children` 을 받는 것 자체는 허용하기 때문이다. (shadcn 처럼 `variant="secondary"` 를 붙였다면 아이콘에는 없는 props라 `TS2322` 에러가 나서 바로 알아챘을 것이다.)

**해결:** lucide import에서 `Badge` 를 빼고 shadcn 것을 가져온다.

```tsx
import { ArrowLeft, ArrowRight, Filter, MoreHorizontal, SquareKanban } from 'lucide-react'
import { Badge } from "@/components/ui/badge";
```

> 자동 import 목록에 같은 이름이 여러 개 뜨면 **경로를 꼭 확인**한다. `Badge`, `Calendar`, `Table`, `Command` 처럼 lucide 아이콘 이름과 shadcn 컴포넌트 이름이 겹치는 경우가 꽤 있다.

### ③ 아직 코드에 남아 있는 클래스 오타

둘 다 에러 없이 **조용히 무시된다.** Tailwind는 모르는 클래스 이름을 만나면 CSS를 안 만들 뿐이다.

| 위치 | 지금 | 맞는 것 | 증상 |
|---|---|---|---|
| `<main>` | `ms:py-6` | `sm:py-6` | 넓은 화면에서 위아래 여백이 안 늘어난다 |
| `Column` 제목 묶음 | `min-2-0` | `min-w-0` | 보통 제목은 줄바꿈되니 차이가 거의 없다. 띄어쓰기 없는 아주 긴 제목일 때만 묶음이 줄어들지 못해 ⋯ 버튼이 컬럼 밖으로 밀려난다 |

> 하나 더: 화면에 `Total Tasks:4` 처럼 숫자가 콜론에 **붙어** 나온다. `</span>` 과 `{...}` 사이에 줄바꿈만 있으면 JSX가 그 공백을 지우기 때문이다. 영상 코드는 `<span className="font-medium">Total Tasks: </span>` 처럼 콜론 뒤에 공백을 하나 넣었다.

---

## 10. 아직 안 된 것

| 항목 | 지금 상태 |
|---|---|
| Create Task 버튼 | `<form>` 에 `onSubmit` 이 없다. 누르면 브라우저 기본 동작으로 폼이 제출돼서 **페이지가 새로고침**되고 주소 뒤에 `?title=...` 이 붙는다. (9)편에서 `handleCreateTask` 를 연결한다 |
| 태스크 목록 | `Column` 이 `children` 을 그리지 않아 개수 배지만 보인다 |
| 컬럼 배치 | 위아래로 쌓인다. 가로 배치와 가로 스크롤은 (9)편 |
| Filter | 버튼·날짜가 동작하지 않고, 배지 숫자 `2` 는 임시 값 |
| 컬럼 ⋯ 버튼 | 아무 일도 안 한다(`onEditColumn` 이 빈 함수) |
| `/dashboard` 로그인 보호 | 로그아웃 상태에서도 열린다 |

---

## 11. 결과

보드 상세 페이지에서

- 헤더 오른쪽에 파란 **Filter** 버튼과 배지 `2` 가 보인다. 누르면 **Filter Tasks** Dialog가 열린다(Low / Medium / High, 날짜 칸, Clear Filters / Apply Filters).
- 본문 위에 **Total Tasks:** 와 전체 태스크 수, 오른쪽에 **Add Task** 버튼이 있다. 누르면 **Create New Task** Dialog가 열린다(제목, 설명, 담당자, 우선순위 Medium 기본, 마감일).
- 그 아래 To Do / In Progress / Review / Done 컬럼 상자가 쌓여 있고, 제목 옆 배지에 각 컬럼의 태스크 수가 나온다.

다음 편에서는 Create Task 버튼으로 태스크를 실제로 저장하고(`createTask`), 컬럼 안에 태스크 카드를 그린다.

---

## 태그

**전체:** `Next.js`, `Next.js 15`, `React`, `TypeScript`, `Supabase`, `PostgREST`, `inner join`, `Clerk`, `shadcn/ui`, `Radix UI`, `Dialog`, `DialogTrigger`, `Select`, `Badge`, `lucide-react`, `Tailwind CSS`, `Tailwind v4`, `Array.reduce`, `props`, `TS2739`, `자동 import`, `트렐로 클론`, `클론 코딩`, `토이 프로젝트`

**10개 이내:** `Next.js`, `Supabase`, `TypeScript`, `shadcn/ui`, `Dialog`, `Tailwind CSS`, `PostgREST`, `TS2739`, `트렐로 클론`, `클론 코딩`
