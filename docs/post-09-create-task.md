# Trello Clone 클론 코딩 (9) — 태스크 만들기(createTask)와 TaskCard

참고 영상: https://www.youtube.com/watch?v=ugxI1o5SyMs
영상 구간: `04:00:03` Implementing createTask & createRealTask functions

(8)편에서 Add Task Dialog를 **모양만** 만들었다. Create Task 버튼을 눌러도 저장되지 않고, 컬럼에는 태스크 개수 배지만 보였다.
이번 글에서는

- Create Task 버튼을 누르면 태스크를 **Supabase에 저장**하고
- 저장한 태스크를 새로고침 없이 **컬럼 안에 카드(TaskCard)로** 보여 주고
- 넓은 화면에서 컬럼을 **가로로 늘어놓고 옆으로 스크롤**되게 만든다.

> 영상 `04:00:03` 부터 `04:27:00` 즈음까지의 내용이다. 영상 설명란의 챕터 시간(`04:35:00` TaskCard, `04:50:00` 메타 정보 …)은 대충 끊은 대략값이라 실제 화면과 맞지 않는다. 이 글의 TaskCard와 담당자·마감일·우선순위 표시도 실제로는 `04:27:00` 전에 다 나온다.

작업 순서는 이렇다.

1. DB에 태스크 한 줄 넣기 — `taskService.createTask` (`lib/services.ts`)
2. 저장하고 화면 상태에도 추가하기 — `createRealTask` (`lib/hooks/useBoards.ts`)
3. 어느 컬럼에 넣을지 정하기 — 페이지의 `createTask` (`app/boards/[id]/page.tsx`)
4. 폼 제출 처리 — `handleCreateTask`
5. `Column` 이 안에 넣은 내용(`children`)을 그리게 하기
6. 컬럼 가로 배치와 스크롤바
7. 태스크 카드 — `TaskCard`

---

## 0. 전체 흐름

```
[Create Task 버튼]  (form 제출)
   │
   ▼
handleCreateTask(e)               ← page.tsx: FormData로 입력값 꺼내기
   ▼
createTask(taskData)              ← page.tsx: 넣을 컬럼 = columns[0] (To Do)
   ▼
createRealTask(columnId, data)    ← useBoards.ts: DB에 맞는 모양으로 바꾸기
   ▼
taskService.createTask()          ← services.ts: tasks 테이블 insert
   │ 저장된 태스크(DB가 만든 id 포함)를 돌려받음
   ▼
setColumns(...)                   ← 그 컬럼 tasks 끝에 추가 → 화면 다시 그림
   ▼
Dialog 닫기
   ▼
<Column> 안에 <TaskCard> 로 표시
```

이름이 비슷한 함수가 세 개라 헷갈린다. 영상 이름 그대로 썼다.

| 함수 | 파일 | 하는 일 |
|---|---|---|
| `createTask` | `page.tsx` | 화면 쪽. **어느 컬럼에** 넣을지 정한다 |
| `createRealTask` | `useBoards.ts` | 훅 쪽. 저장하고 **화면 상태(`columns`)에도** 추가한다 |
| `taskService.createTask` | `services.ts` | DB 쪽. `tasks` 테이블에 **한 줄 insert** 만 한다 |

---

## 1. DB에 태스크 넣기 — `taskService.createTask`

(8)편에서 만든 `taskService` 에 함수를 하나 더 추가한다.

```ts
async createTask(
    supabase: SupabaseClient,
    task: Omit<Task, "id" | "created_at" | "updated_at">
): Promise<Task>{
    const {data, error} = await supabase
    .from("tasks")
    .insert(task)
    .select()
    .single()

    if(error) throw error

    return data
}
```

| 코드 | 뜻 |
|---|---|
| `Omit<Task, "id" \| "created_at" \| "updated_at">` | `Task` 타입에서 세 칸을 **뺀** 타입. 이 세 칸은 우리가 보내지 않는다 |
| `.insert(task)` | `tasks` 테이블에 한 줄 넣는다 |
| `.select().single()` | 넣은 줄을 **다시 받아 온다.** DB가 만든 `id`, `created_at` 이 들어 있다 |
| `if(error) throw error` | 실패하면 에러를 위로 던진다. 받는 쪽(`createRealTask`)의 `catch` 로 간다 |

- `id` 와 `created_at` 은 (3)편에서 DB가 **알아서 채우게**(`generated ... as identity`, `default now()`) 만들었다. 그래서 뺀다.
- `updated_at` 은 사정이 다르다. `models.ts` 의 `Task` 타입에는 있지만, (3)편에서 만든 **`tasks` 테이블에는 이 칸이 아예 없다.** `Omit` 으로 빼 두었으니 지금은 문제없다. 나중에 태스크를 수정할 때 `updated_at` 을 보내면 "없는 칸" 에러가 날 수 있다.

> **영상과 다른 점 — `tasks.user_id` 지우기는 건너뛰었다**
> 영상은 이 즈음에 Supabase에서 `tasks` 테이블의 `user_id` 칸을 **지우라고** 한다. 우리 `tasks` 테이블에는 (3)편에서 만들 때부터 `user_id` 가 없다. Supabase **Table Editor**에서 `tasks` 테이블을 열어 보면 `user_id` 칸이 보이지 않는다. (REST API로 `/rest/v1/tasks?select=user_id` 를 요청해도 `column tasks.user_id does not exist` 에러가 난다.) 그래서 이 단계는 할 일이 없었다.
> - 지워도 되는 이유: 태스크의 주인 확인은 RLS 정책이 **태스크 → 컬럼 → 보드의 `user_id`** 로 따라가서 한다((3)편에서 만들고 (4)편에서 Clerk용으로 고침). 태스크마다 `user_id` 를 따로 들고 있을 필요가 없다.
> - 코드(`Task` 타입, `createRealTask`)도 `user_id` 를 보내지 않는다.

---

## 2. 저장하고 화면에도 추가하기 — `createRealTask`

`lib/hooks/useBoards.ts` 의 `useBoard` 안에 추가한다.

```ts
import { boardDataService, boardService, taskService } from "../services";
```

```ts
async function createRealTask(
    columnId: string,
    taskData:{
        title: string;
        description?: string;
        assignee?: string;
        dueDate?: string;
        priority?: "low" | "medium" | "high"
    }
) {
    try{
        const newTask = await taskService.createTask(supabase!, {
            title: taskData.title,
            description: taskData.description || null,
            assignee: taskData.assignee || null,
            due_date: taskData.dueDate || null,
            column_id: columnId,
            sort_order: columns.find(col => col.id === columnId)?.tasks.length || 0,
            priority: taskData.priority || "medium"
        })

        setColumns((prev)=> prev.map((col) => col.id === columnId ? {...col, tasks: [...col.tasks, newTask]} : col))

        return newTask
    }catch(err){
        setError(
            err instanceof Error ? err.message : "태스크 생성에 실패했습니다."
        )
    }
}

return{
    board,
    columns,
    loading,
    error,
    updateBoard,
    createRealTask
}
```

### 2-1. 화면 모양 → DB 모양으로 바꾸기

| 받은 값 (`taskData`) | DB에 보내는 값 | 이유 |
|---|---|---|
| `description` 없음 | `null` | 빈 값은 `""` 대신 `null` 로 저장. `Task` 타입도 `string \| null` 이다 |
| `dueDate` | **`due_date`** | 화면 쪽은 `dueDate`(카멜 표기), DB 칸 이름은 `due_date`(밑줄 표기). 여기서 이름을 바꿔 준다 |
| (없음) | `column_id: columnId` | 어느 컬럼에 넣을지 |
| (없음) | `sort_order` | 컬럼 안에서 몇 번째인지 |
| `priority` 없음 | `"medium"` | 기본값 |

`sort_order: columns.find(col => col.id === columnId)?.tasks.length || 0`

- `columns.find(...)`: 태스크를 넣을 컬럼을 찾는다.
- `?.tasks.length`: 그 컬럼의 **지금 태스크 개수.** 2개 있으면 새 태스크는 `sort_order` 2(0, 1 다음)가 돼서 **맨 끝**에 붙는다. `?.` 는 컬럼을 못 찾아 `undefined` 일 때 에러 대신 `undefined` 를 돌려준다.
- `|| 0`: 못 찾았으면 0.

### 2-2. 화면 상태에 바로 추가하기

```ts
setColumns((prev)=> prev.map((col) => col.id === columnId ? {...col, tasks: [...col.tasks, newTask]} : col))
```

줄을 나눠 보면 이렇다.

```ts
setColumns((prev) =>                 // prev = 지금 columns 배열
    prev.map((col) =>                // 컬럼을 하나씩 보면서
        col.id === columnId
            ? { ...col, tasks: [...col.tasks, newTask] }   // 넣을 컬럼: 복사본 + 태스크 하나 더
            : col                                           // 나머지: 그대로
    )
)
```

- DB에 저장한 뒤 **목록을 다시 불러오지 않고**, 돌려받은 `newTask` 를 상태에 직접 붙인다. 요청이 한 번 줄고 화면이 바로 바뀐다.
- `col.tasks.push(newTask)` 처럼 **원래 배열을 고치면 안 된다.** React는 "배열이 새것인지"로 바뀐 걸 알아차린다. 같은 배열에 넣기만 하면 화면이 안 바뀔 수 있다. 그래서 `map` 으로 새 배열, `{...col}` 로 새 객체, `[...col.tasks, newTask]` 로 새 tasks 배열을 만든다.
- `setColumns((prev) => ...)`: 값 대신 **함수**를 넘기면 React가 가장 최신 상태를 `prev` 로 넣어 준다. 빠르게 여러 번 추가해도 앞의 추가가 사라지지 않는다.

> **영상과 다른 점**
> 실패했을 때의 에러 문구를 한국어(`"태스크 생성에 실패했습니다."`)로 썼다. 영상은 `"Failed to create the task."` 이다.

---

## 3. 어느 컬럼에 넣을지 — 페이지의 `createTask`

`app/boards/[id]/page.tsx`. 먼저 훅에서 `createRealTask` 를 **꺼낸다.**

```tsx
const {board, updateBoard, columns, createRealTask} = useBoard(id)
```

```tsx
async function createTask(taskData:{
    title: string;
    description?: string;
    assignee?: string;
    dueDate?: string;
    priority?: "low" | "medium" | "high"
}) {
    const targetColumn = columns[0]
    if(!targetColumn){
        throw new Error("작업을 추가할 수 있는 열이 없습니다.")
    }

    await createRealTask(targetColumn.id, taskData)
}
```

- 위쪽 **Add Task 버튼**으로 만든 태스크는 **첫 번째 컬럼**(`columns[0]`, To Do)에 들어간다. 컬럼은 `sort_order` 순서로 불러오니 첫 번째가 To Do다.
- 컬럼마다 붙는 추가 버튼은 영상 챕터표상 다음 챕터에 나온다(아직 안 봤다). 영상 작성자의 최종 코드를 보면 그 버튼(글자는 `Add Task`)도 `handleCreateTask` → 이 `createTask` 를 그대로 써서, **어느 컬럼에서 눌러도 첫 번째 컬럼에 들어간다.**
- (8)편에서 `Column` 에 빈 함수로 넘겼던 `onCreateTask` 도 이제 진짜 함수로 바꾼다.

```tsx
<Column
    key={key}
    column={column}
    onCreateTask={createTask}
    onEditColumn={() => { } } // 영상에서 컬럼 수정 함수 만들면 교체
>
```

> **영상과 다른 점**
> - 컬럼이 없을 때의 에러 문구를 한국어(`"작업을 추가할 수 있는 열이 없습니다."`)로 썼다. 영상은 `"No column available to add task"` 이다.
> - 영상은 이 함수의 `priority` 를 필수(`priority:`)로 받는데, 여기서는 `createRealTask` 와 맞춰 선택(`priority?:`)으로 썼다.

---

## 4. 폼 제출 처리 — `handleCreateTask`

```tsx
async function handleCreateTask(e:any) {
    e.preventDefault()
    const formData =new FormData(e.currentTarget)
    const taskData = {
        title:formData.get("title") as string,
        description:(formData.get("description") as string) || undefined,
        assignee:(formData.get("assignee") as string) || undefined,
        dueDate:(formData.get("dueDate") as string) || undefined,
        priority:(formData.get("priority") as  | "low" | "medium" | "high") || "medium",
    }

    if(taskData.title.trim()){
        await createTask(taskData)

        const trigger = document.querySelector('[data-state="open"]') as HTMLElement
        if(trigger) trigger.click()
    }
}
```

```tsx
<form className="space-y-4" onSubmit={handleCreateTask}>
    ...
    <div className="space-y-2">
        <Label>Due Date</Label>
        <Input type="date" id="dueDate" name="dueDate"/>
    </div>
    ...
</form>
```

| 코드 | 뜻 |
|---|---|
| `e.preventDefault()` | (8)편에서 Create Task를 누르면 **새로고침되던** 브라우저 기본 동작을 막는다 |
| `new FormData(e.currentTarget)` | 폼 안의 입력칸 값을 **`name` 별로** 한꺼번에 모은다. `currentTarget` 은 `onSubmit` 이 붙은 `<form>` 자신 |
| `formData.get("title") as string` | `get` 은 `string` 또는 파일 또는 `null` 을 돌려줄 수 있다고 선언돼 있다. 글자 칸이니 `string` 이라고 알려 준다 |
| `\|\| undefined` | 빈 칸(`""`)이면 `undefined` 로. `createRealTask` 에서 다시 `null` 로 바뀐다 |
| `taskData.title.trim()` | 제목 칸에는 `required` 가 없어서 여기서 검사한다. 공백만 친 제목은 저장하지 않는다 |

- 우선순위는 shadcn `Select` 의 값이다. (8)편에서 본 것처럼 Radix Select가 숨은 `<select name="priority">` 를 같이 그려서 `FormData` 에 들어간다.
- 마감일 칸에 `name="dueDate"` 를 추가했다. **`formData.get("dueDate")` 와 글자가 똑같아야** 한다(아래 에러 ③).
- `e:any`: 영상대로 `any` 를 썼다. 정확히 쓰면 `e: React.SubmitEvent<HTMLFormElement>` 다. 예전 글에 자주 나오는 `React.FormEvent` 는 지금 설치된 `@types/react` 19.3에서 deprecated(더 이상 쓰지 말라는) 표시가 붙는다.

### 저장 후 Dialog 닫기 — `querySelector('[data-state="open"]')`

Add Task Dialog는 (8)편에서 `open` 상태 없이 `DialogTrigger` 로 만들었다. 그래서 코드에서 "닫아라"라고 할 상태가 없다. 영상은 **열기 버튼을 한 번 더 눌러서** 닫는다.

- Radix는 Dialog가 열려 있는 동안 열기 버튼(`DialogTrigger`)에 `data-state="open"` 이라는 속성을 붙인다.
- `document.querySelector('[data-state="open"]')` 는 이 속성을 가진 요소 중 **문서에서 가장 먼저 나오는 것**을 찾는다. Dialog 창 자체는 `<body>` 맨 끝에 따로 그려지기 때문에, 먼저 나오는 건 페이지 안의 **Add Task 버튼**이다.
- 그 버튼을 `.click()` 하면 Dialog가 닫힌다.

> 이 방법은 "가장 먼저 나오는 열린 것"에 기대고 있어서, 화면 구조가 바뀌면 엉뚱한 요소를 누를 수 있다. (7)편 보드 수정 Dialog처럼 `open` / `onOpenChange` 상태로 만들고 `setIsOpen(false)` 로 닫는 쪽이 안전하다. 지금은 영상을 따라 그대로 두었다.

> **영상과 다른 점**
> 영상 코드는 `'[data-state="open"'` 처럼 **닫는 `]` 가 빠져 있다.** 브라우저가 선택자 끝에서 괄호를 알아서 닫아 줘서 에러 없이 동작하지만, 여기서는 `]` 를 닫아 두었다.

---

## 5. `Column` 이 `children` 을 그리게 하기

(8)편의 `Column` 은 헤더만 그리고, `<Column>…</Column>` 사이에 넣은 내용(`children`)은 그릴 자리가 없었다. 헤더 아래에 자리를 만든다.

```tsx
                    </div>
                </div>

                {/* Column Content */}
                <div className="p-2">
                    {children}
                </div>
            </div>
        </div>
    )
}
```

페이지에서는 태스크마다 `TaskCard` 를 넘긴다.

```tsx
<Column ...>
    <div className="space-y-3">
        {column.tasks.map((task, key) => (
            <TaskCard task={task} key={key}/>
        ))}
    </div>
</Column>
```

- `children` 은 React가 정해 둔 props 이름이다. `<Column>` 과 `</Column>` 사이에 적은 것이 자동으로 `children` 으로 들어간다.
- `space-y-3`: 카드 사이 간격 12px.
- 이게 빠져 있어서 "등록은 되는데 화면에 안 나오는" 문제가 있었다(아래 에러 ②).

---

## 6. 컬럼 가로 배치와 스크롤바

(8)편에서 클래스가 없던 컬럼 묶음 `<div>` 에 클래스를 단다.

```tsx
{/* Board Columns  */}
<div
    className="flex flex-col lg:flex-row lg:space-x-6 lg:overflow-x-auto lg:pb-6 lg:px-2 lg:[&::-webkit-scrollbar]:h-2 lg:[&::-webkit-scrollbar-track]:bg-gray-100 lg:[&::-webkit-scrollbar-thumb]:bg-gray-300 lg:[&::-webkit-scrollbar-thumb]:rounded-full space-y-4 lg:space-y-0"
>
```

| 클래스 | 좁은 화면 | `lg`(1024px) 이상 |
|---|---|---|
| `flex flex-col` / `lg:flex-row` | 컬럼을 **위아래로** | 컬럼을 **가로로** |
| `space-y-4` / `lg:space-y-0` | 컬럼 사이 위아래 16px | 위아래 간격 없앰 |
| `lg:space-x-6` | - | 컬럼 사이 가로 24px |
| `lg:overflow-x-auto` | - | 안에 든 컬럼이 넘치면 **옆으로 스크롤** |
| `lg:pb-6` | - | 컬럼과 아래 스크롤바 사이 여백 24px |
| `lg:px-2` | - | 좌우 안쪽 여백 8px. 첫·마지막 컬럼이 가장자리에 딱 붙지 않게 |

(8)편에서 `Column` 에 넣어 둔 `lg:w-80 lg:flex-shrink-0` 이 여기서 쓰인다. 넓은 화면에서 컬럼은 **320px 고정이고 줄어들지 않는다.** 그래서 4개를 합친 폭(320×4 + 간격 24×3 = 1352px, 좌우 여백까지 1368px)이 **본문 폭**보다 넓으면 가로 스크롤이 생긴다.

- 본문 `<main className="container ...">` 의 `container` 는 화면 폭에 따라 최대 폭이 1024·1280·1536px로 정해진다.
- 그래서 1440px 모니터에서도 본문은 1280px라 스크롤바가 생기고, 1536px 이상 화면에서는 생기지 않는다.

### 스크롤바 꾸미기 — `[&::-webkit-scrollbar]`

```
lg:[&::-webkit-scrollbar]:h-2
│   │ │                    └─ 적용할 스타일: 높이 8px
│   │ └─ ::-webkit-scrollbar : 스크롤바 부분
│   └─ & : 이 요소 자신
└─ lg 이상에서만
```

- Tailwind의 **임의 변형**(arbitrary variant) 문법이다. `[ ]` 안에 CSS 선택자를 직접 적는다.
- `::-webkit-scrollbar`(스크롤바 전체), `-track`(바탕 길), `-thumb`(잡고 끄는 막대)로 나눠서 꾸몄다. 얇은 높이 8px, 연회색 길, 회색 둥근 막대.
- `-webkit-` 이 붙은 이름이라 Chrome·Safari·Edge에서만 먹는다. Firefox는 무시하고 기본 스크롤바를 보여 준다.

> **영상과 다른 점**
> 영상 작성자의 최종 코드에는 `lg:-mx-2`(좌우로 8px 끌어당기기)가 하나 더 있다. 영상의 이 시점에 있었는지 확인하지 못해서 넣지 않았다.

---

## 7. 태스크 카드 — `TaskCard`

`page.tsx` 에 카드 하나를 그리는 컴포넌트를 만든다. shadcn `Card` 와 lucide 아이콘 `User`, `Calendar` 를 쓴다.

```tsx
import { Card, CardContent } from "@/components/ui/card";
import { ColumnWithTasks, Task } from "@/lib/supabase/models";
import { Calendar, MoreHorizontal, Plus, User } from "lucide-react";
```

```tsx
function TaskCard({task}:{ task: Task}){

    function getPriorityColor(priority: 'low' | 'medium' | 'high'): string{
        switch(priority){
            case 'high':
                return "bg-red-500";
            case 'medium':
                return "bg-yellow-500";
            case 'low':
                return "bg-green-500";
            default :
                return "bg-yellow-500";
        }
    }

    return (
        <div>
            <Card className="cursor-pointer hover:shadow-md transition-shadow">
                <CardContent className="p-3 sm:p-4">
                    <div className="space-y-2 sm:space-y-3">
                        {/* task header */}
                        <div className="flex items-start justify-between">
                            <h4 className="font-medium text-gray-900 text-sm leading-tight flex-1 min-w-0 pr-2">{task.title}</h4>
                        </div>

                        {/* task descriptiom */}
                        <div className="text-xs text-gray-600 line-clamp-2">{task.description || "No descriptiom"}</div>

                        {/* task meta */}
                        <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-1 sm:space-x-2 min-w-0">
                                {task.assignee && (
                                    <div className="flex items-center space-x-1 text-xs text-gray-500">
                                        <User className="h-3 w-3"/>
                                        <span className="truncate">{task.assignee}</span>
                                    </div>
                                )}
                                {task.due_date && (
                                    <div className="flex items-center space-x-1 text-xs text-gray-500">
                                        <Calendar className="h-3 w-3"/>
                                        <span className="truncate">{task.due_date}</span>
                                    </div>
                                )}
                            </div>
                            <div className={`w-2 h-2 rounded-full flex-shrink-0 ${getPriorityColor(task.priority)}`}/>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
```

카드는 세 줄로 되어 있다.

| 부분 | 코드 | 설명 |
|---|---|---|
| 제목 | `<h4>` | `flex-1 min-w-0` 으로 남는 폭을 다 쓰되 줄어들 수 있게 |
| 설명 | `line-clamp-2` | **최대 2줄**까지만 보이고 넘치면 `…` |
| 메타 | 담당자 · 마감일 · 우선순위 점 | 왼쪽 묶음과 오른쪽 점을 `justify-between` 으로 양끝에 |

- `cursor-pointer hover:shadow-md transition-shadow`: 마우스를 올리면 손가락 모양 커서에 그림자가 부드럽게 진해진다. 나중에 카드를 끌어서 옮길 때(드래그 앤 드롭)를 위한 느낌이다.
- `task.assignee && (...)`: 담당자가 **있을 때만** 사람 아이콘과 이름을 그린다. 마감일도 같다. 값이 `null` 이면 그 칸은 아예 안 나온다.
- `truncate`: 글자를 한 줄로 두고, 넘치는 부분을 `…` 로 자르는 클래스다. 다만 flex 안에서는 **`span` 바로 위의 flex 부모**(담당자 `div`)도 줄어들 수 있어야(`min-w-0`) 실제로 잘린다. 지금 코드(영상도 같다)는 바깥 묶음에만 `min-w-0` 이 있다. 그래서 담당자 이름이 아주 길면 `…` 없이 넘쳐서 카드 가장자리에서 그냥 잘리고, 마감일이 밀려 안 보일 수 있다.
- `h-3 w-3`: 아이콘 12px. 안 주면 lucide 기본 크기(24px)라 글자보다 훨씬 크다.
- 마감일은 DB의 `date` 값 그대로 `2026-11-10` 처럼 나온다.

### 우선순위 색 점 — `getPriorityColor`

- `w-2 h-2 rounded-full`: 8px 동그라미.
- `getPriorityColor(task.priority)`: high는 빨강, medium은 노랑, low는 초록. 예상 못 한 값이면 `default` 로 노랑.
- (7)편 색상 고르기와 같은 이유로, 클래스 이름을 `"bg-red-500"` 처럼 **통째로** 적는다. Tailwind는 코드에 글자 그대로 있는 클래스만 CSS로 만든다.

> **영상과 다른 점**
> - 컴포넌트 이름을 `Task` 가 아니라 **`TaskCard`** 로 지었다. `Task` 로 지으면 타입 `Task` 와 이름이 겹쳐서 에러가 난다(아래 에러 ⑤). 영상 작성자의 최종 코드도 `SortableTask`, `TaskOverlay` 처럼 다른 이름을 쓴다.
> - 설명 줄을 영상은 `<p>` 로, 여기서는 `<div>` 로 썼다. 보이는 모양은 같다.

---

## 8. 막혔던 에러

### ① `Cannot find name 'createRealTask'` — `TS2552`

```
Cannot find name 'createRealTask'. Did you mean 'createTask'? ts(2552)
```

- 훅 안에 `createRealTask` 를 만들고 `return` 에도 넣었는데, 페이지에서 **꺼내지 않았다.**

  ```tsx
  const {board, updateBoard, columns} = useBoard(id)   // createRealTask 가 없다
  ```

- 함수 안에서 만든 이름은 그 함수 밖에서 이름만으로는 쓸 수 없다(스코프). 훅이 돌려준 객체에서 `{ }` 로 **꺼내야** 페이지에서 쓸 수 있다.
- `Did you mean 'createTask'?` 는 페이지에 이름이 비슷한 `createTask` 가 있어서 TypeScript가 짐작한 것일 뿐이다. `createTask` 로 바꾸면 안 된다(자기 자신을 부르게 된다).

**해결:** `const {board, updateBoard, columns, createRealTask} = useBoard(id)`

### ② 태스크를 등록해도 화면에 안 나온다 — `Column` 이 `children` 을 안 그림

영상에서는 Create Task를 누르면 컬럼 아래에 태스크가 바로 나오는데, 여기서는 아무것도 안 나왔다. 저장과 상태 추가는 되고 있었다(컬럼 배지 숫자는 늘어난다). 그런데 카드가 안 보였다.

- 처음에는 Dialog 닫는 줄 `document.querySelector('[data-state="open"')`(닫는 `]` 빠짐)을 의심했다. 하지만 `data-state="open"` 속성을 단 시험용 버튼을 하나 만들어 두고 브라우저 콘솔에서 이 선택자를 실행해 보니, **에러 없이 그 버튼을 찾았다.** 끝의 `]` 가 빠져도 브라우저가 알아서 닫아 준다. 게다가 이 줄은 저장(`await createTask`)이 끝난 **뒤에** 실행되니 저장·표시와는 상관이 없다.
- 진짜 원인은 `Column` 이었다. 페이지는 `<Column>` 안에 태스크 목록을 `children` 으로 넘기는데, `Column` 의 JSX에 `{children}` 을 그리는 자리가 없어서 **넘긴 내용이 그냥 버려졌다.**

**해결:** 5절의 `{/* Column Content */}` 블록 추가.

> 데이터는 맞는데 화면에 안 나오면, **그리는 쪽**(컴포넌트가 받은 props를 실제로 JSX에 쓰는지)부터 본다.

### ③ 마감일이 안 나온다 — Input의 `name` 이 `formData.get()` 과 달랐다

태스크를 만들 때 날짜를 골랐는데도 카드에 마감일이 안 나왔다. `TaskCard` 의 `{task.due_date && (...)}` 코드는 맞았다. 따라가 보니 마감일이 처음부터 `null` 로 저장되고 있었다.

1. **처음:** 마감일 칸에 `name` 이 아예 없었다(`<Input type="date" id="dueDate"/>`). `FormData` 는 `id` 가 아니라 **`name`** 으로 값을 모은다. 그래서 `formData.get("dueDate")` 가 항상 `null` 이었다.
2. **`name` 을 넣었는데도 안 나옴:** `name="due_date"` 로 넣었다. 코드는 `formData.get("dueDate")` 로 찾으니 이름이 달라서 여전히 `null`.
3. **해결:** `name="dueDate"`. 영상 코드도 이렇다.

이름이 두 가지라 헷갈렸다.

| 어디 | 이름 | |
|---|---|---|
| 폼 Input `name` ↔ `formData.get(...)` ↔ `taskData.dueDate` | `dueDate` | 화면 쪽 |
| DB 칸 · `Task` 타입 · `task.due_date` | `due_date` | DB 쪽 |

두 이름은 `createRealTask` 의 `due_date: taskData.dueDate || null` 한 줄에서 이어진다. **폼 안에서는 `dueDate` 로 맞춘다.**

> 고친 뒤에도 **이미 만든 태스크**는 마감일이 `null` 로 저장돼 있어서 안 보인다. 날짜를 넣어 새로 만들어야 확인할 수 있다.

### ④ 넓은 화면에서 가로 스크롤이 안 생긴다 — 클래스 오타

컬럼 묶음 클래스에 오타가 두 개 있었다.

| 고치기 전 | 고친 후 |
|---|---|
| `lg:overflow-auto-x-auto` | `lg:overflow-x-auto` |
| `lg:[&}}-webkit-scrollbar` (끊긴 조각) | `lg:[&::-webkit-scrollbar-thumb]:rounded-full` |

- `lg:overflow-auto-x-auto` 는 없는 클래스라 **가로 스크롤 자체가 안 생겼다.** 스크롤이 없으니 스크롤바 꾸미기 클래스 3개는 정상인데도 볼 일이 없었다.
- 두 번째는 클래스를 옮겨 적다가 중간이 끊긴 조각이었다. 영상 작성자 저장소의 코드를 보고 원래 `lg:[&::-webkit-scrollbar-thumb]:rounded-full` 인 것을 확인했다.
- 개발 서버가 만든 CSS 파일을 열어 보니 오타 난 클래스는 규칙이 **아예 없었다.** 고친 뒤에는 생기는 것을 확인했다.

> Tailwind는 틀린 클래스를 만나도 **에러를 내지 않고 조용히 무시한다.** `npx tsc --noEmit` 도 통과한다(클래스는 그냥 문자열이라서). 모양이 안 바뀌면 클래스 철자부터 의심한다.

### ⑤ `'Task' refers to a value` — `TS2749`

처음에는 카드 컴포넌트 이름을 `Task` 로 지었다.

```tsx
function Task({task}:{ task: Task}){
```

```
'Task' refers to a value, but is being used as a type here. Did you mean 'typeof Task'? ts(2749)
```

- 이때 페이지는 `models.ts` 에서 `ColumnWithTasks` 만 import 하고 있었고, 타입 `Task` 는 가져오지 않았다.
- TypeScript는 **값 이름**(함수·변수)과 **타입 이름**을 따로 찾는다. `task: Task` 자리에서 타입 `Task` 는 찾지 못하고, 같은 이름의 **값**(방금 만든 함수 `Task`)만 찾았다. 그래서 "값을 타입 자리에 썼다"는 에러가 난다. (함수 이름이 `Task` 가 아니었다면 `Cannot find name 'Task'`(TS2304)가 났을 것이다.)
- 같은 이름이 파일 안에 이미 있으니 VS Code가 `models.ts` 의 `Task` 타입을 **자동 import 하자고 제안하지도 않았다.**
- 손으로 `import { Task } from "@/lib/supabase/models"` 를 적으면 이번엔 다른 에러가 난다.

  ```
  Import 'Task' conflicts with local value, so must be declared with a type-only import when 'isolatedModules' is enabled. ts(2865)
  ```

- `Did you mean 'typeof Task'?` 는 따르면 안 된다. "이 함수의 타입"이라는 뜻이라 원하는 것과 전혀 다르다.

**해결:** 컴포넌트 이름을 `TaskCard` 로 바꾸고, 타입 `Task` 는 `models.ts` 에서 가져온다.

```tsx
import { ColumnWithTasks, Task } from "@/lib/supabase/models";

function TaskCard({task}:{ task: Task}){
```

> **다른 방법도 있긴 하다**
> - 에러 메시지대로 `import type { Task } from "@/lib/supabase/models"` 로 적으면 에러가 사라진다. TypeScript는 **값 이름**(함수, 변수)과 **타입 이름**을 따로 관리해서, `Task` 가 함수이면서 타입일 수도 있기 때문이다.
> - `import { Task as TaskType }` 처럼 타입에 별명을 붙여도 된다.
> - 하지만 한 파일에서 `Task` 가 두 가지 뜻이면 읽는 사람이 헷갈린다. 컴포넌트 이름을 바꾸는 쪽이 가장 덜 헷갈린다.

---

## 9. 아직 남은 것

| 항목 | 지금 상태 |
|---|---|
| 태스크 추가 위치 | 위쪽 Add Task 버튼은 항상 첫 번째 컬럼(To Do)에 넣는다. 컬럼별 추가 버튼은 다음 챕터 예정(최종 코드 기준으로는 그 버튼도 첫 번째 컬럼에 넣는다) |
| 긴 담당자 이름 | 담당자 `div` 에 `min-w-0` 이 없어 `…` 로 잘리지 않고 넘친다(영상 코드도 같다) |
| 저장 실패 시 | `createRealTask` 가 `catch` 에서 에러를 삼키고 `setError` 만 한다. 화면에 에러가 안 보이고 Dialog는 그대로 닫힌다((7)편과 같은 문제) |
| `useBoards.ts` 의 `import { describe } from "node:test"` | `description` 을 치다가 자동 import가 잘못 붙은 줄로 보인다. 쓰지 않아서 동작엔 문제없지만 지워야 한다 |
| `"No descriptiom"` | `description` 오타. 설명 없는 카드에 그대로 보인다(영상은 `"No description."`) |
| `ms:py-6`, `min-2-0` | (8)편에서 찾은 클래스 오타가 아직 남아 있다 |
| 마감일 표시 | `2026-11-10` 그대로. 보기 좋게 바꾸는 건 나중에 |
| 드래그 앤 드롭 | 카드를 다른 컬럼으로 옮기기는 영상 뒤쪽 |
| `/dashboard` 로그인 보호 | 로그아웃 상태에서도 열린다 |

---

## 10. 결과

보드 상세 페이지에서

- **Add Task** → 제목·설명·담당자·우선순위·마감일을 넣고 **Create Task** → Dialog가 닫히고 **To Do 컬럼 맨 아래에 카드**가 생긴다. 컬럼 배지 숫자와 Total Tasks도 같이 늘어난다.
- 카드에는 제목, 설명(최대 2줄), 사람 아이콘 + 담당자, 달력 아이콘 + 마감일, 오른쪽에 우선순위 색 점(빨강·노랑·초록)이 보인다.
- 새로고침해도 카드가 그대로 있다. (8)편의 `getTasksByBoard` 가 DB에서 다시 불러오기 때문이다.
- 1024px 이상 화면에서는 컬럼이 가로로 늘어서고, 본문 폭보다 넓으면(1440px 모니터에서도) 아래에 얇은 회색 스크롤바가 생긴다.

---

## 태그

**전체:** `Next.js`, `Next.js 15`, `React`, `TypeScript`, `Supabase`, `insert`, `CRUD`, `FormData`, `useState`, `불변성`, `children`, `shadcn/ui`, `Card`, `Radix UI`, `Dialog`, `lucide-react`, `Tailwind CSS`, `Tailwind v4`, `임의 변형`, `스크롤바 꾸미기`, `TS2552`, `TS2749`, `트렐로 클론`, `클론 코딩`, `토이 프로젝트`

**10개 이내:** `Next.js`, `Supabase`, `TypeScript`, `FormData`, `shadcn/ui`, `Tailwind CSS`, `TS2749`, `CRUD`, `트렐로 클론`, `클론 코딩`
