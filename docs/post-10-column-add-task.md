# Trello Clone 클론 코딩 (10) — 컬럼마다 Add Task 버튼 붙이기

참고 영상: https://www.youtube.com/watch?v=ugxI1o5SyMs
영상 구간: `04:27:00` Styling board layout & "Add New Task" dialog trigger

(9)편까지는 태스크를 **위쪽 Add Task 버튼 하나**로만 추가할 수 있었다. 실제 Trello처럼 이번에는 **컬럼마다 맨 아래에 Add Task 버튼**을 붙인다.

> 영상 설명란 챕터 표에는 이 챕터가 `04:26:00` 으로 적혀 있지만, 챕터 시간은 대충 끊은 대략값이다. (9)편이 `04:27:00` 즈음까지를 다뤘으니 이 글은 그 뒤부터다.

작업은 두 가지다.

1. `Column` 의 내용 영역에 태스크 추가 Dialog 넣기
2. `Column` 에 넘기는 함수를 `createTask` 에서 `handleCreateTask` 로 바꾸기

---

## 0. 전체 흐름

컬럼의 Add Task → Create Task를 누르면 이렇게 흘러간다. (9)편에서 만든 함수를 그대로 다시 쓴다.

```
form 제출 (이벤트)
  → handleCreateTask         새로고침 막기, FormData로 name별 값 꺼내기, 제목 빈칸 검사 (저장이 끝나면 Dialog 닫기)
  → createTask               넣을 컬럼 고르기 (columns[0])
  → createRealTask           DB 저장 + 화면 상태(setColumns) 갱신
  → taskService.createTask   Supabase insert
```

---

## 1. `Column` 에 태스크 추가 Dialog 넣기

`app/boards/[id]/page.tsx`

(9)편에서 `Column` 의 내용 영역(`Column Content`)은 `{children}`(태스크 카드들)만 그렸다. 그 아래에 Dialog를 하나 붙인다.

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
                ...

                {/* Column Content */}
                <div className="p-2">
                    {children}

                    <Dialog>
                        <DialogTrigger asChild>
                            <Button variant="ghost" className="w-full mt-3 text-gray-500 hover:text-gray-700">
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

                            <form className="space-y-4" onSubmit={onCreateTask}>
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
                                    <Input type="date" id="dueDate" name="dueDate"/>
                                </div>

                                <div className="flex justify-end space-x-2 pt-4">
                                    <Button type="submit">Create Task</Button>
                                </div>
                            </form>
                        </DialogContent>
                    </Dialog>
                </div>
            </div>
        </div>
    )
}
```

폼 내용은 (8)편에서 만들고 (9)편에서 `name="dueDate"` 와 `onSubmit` 을 붙인 **위쪽 Add Task Dialog의 폼과 똑같다.** 다른 점은 열기 버튼 모양과 `onSubmit` 에 무엇을 넣느냐뿐이다.

| 코드 | 뜻 |
|---|---|
| `<DialogTrigger asChild>` | 안쪽 `<Button>` 을 그대로 열기 버튼으로 쓴다. `asChild` 가 없으면 버튼 안에 버튼이 또 생긴다 |
| `variant="ghost"` + `w-full mt-3 text-gray-500 hover:text-gray-700` | 평소에는 테두리·배경이 안 보이는 회색 글씨 버튼을 컬럼 폭 가득 채운다. 마우스를 올리면 ghost 기본 스타일의 연한 회색 배경(`hover:bg-muted`)이 깔리고 글씨는 `hover:text-gray-700` 로 진해진다. ghost에 원래 있던 `hover:text-foreground` 는 `cn` 이 겹친다고 보고 지운다 |
| `w-[95vw] max-w-[425px] mx-auto` | 폭을 화면의 95%, 최대 425px로 잡는다. 하지만 shadcn `DialogContent` 에 원래 있는 `sm:max-w-sm` 을 `cn` 이 지우지 않고 남겨서, 640px 이상 화면에서는 **384px** 이 된다((7)편에서 본 것과 같다). 넓은 화면에서도 425px로 하려면 `sm:max-w-[425px]` 를 써야 한다 |
| `onSubmit={onCreateTask}` | **부모가 넘겨준 함수**를 제출 처리로 쓴다. 무엇을 넘기느냐는 2번에서 정한다 |
| `name="title"`, `name="dueDate"` … | `handleCreateTask` 의 `formData.get("title")` 처럼 **`name` 으로** 값을 꺼낸다. 글자가 하나라도 다르면 값이 비어 버린다((9)편 에러 ③) |
| `<Select name="priority" defaultValue="medium">` | Radix Select가 숨은 `<select name="priority">` 를 같이 그려서 `FormData` 에 들어간다. 아무것도 안 고르면 `medium` |

> **영상과 다른 점**
> (8)편의 위쪽 Dialog와 같다. 설명 문구와 placeholder를 한국어로 바꿨고(영상은 `Add a task to the board`, `Enter task title` …), 설명 문단은 영상의 `<p className="text-sm text-gray-600">` 대신 클래스 없이 `<p>` 만 썼다.

---

## 2. `Column` 에 `handleCreateTask` 넘기기

보드 컬럼을 그리는 곳(`Board Columns`)에서 `onCreateTask` 에 넘기는 함수를 바꾼다.

```tsx
{/* Board Columns  */}
<div
    className="flex flex-col lg:flex-row lg:space-x-6 lg:overflow-x-auto lg:pb-6 lg:px-2 lg:[&::-webkit-scrollbar]:h-2 lg:[&::-webkit-scrollbar-track]:bg-gray-100 lg:[&::-webkit-scrollbar-thumb]:bg-gray-300 lg:[&::-webkit-scrollbar-thumb]:rounded-full space-y-4 lg:space-y-0"
>
    {columns.map((column, key) => (
        <Column
            key={key}
            column={column}
            // onCreateTask={createTask}
            onCreateTask={handleCreateTask}
            onEditColumn={() => { } } // 영상에서 컬럼 수정 함수 만들면 교체
        >
            <div className="space-y-3">
                {column.tasks.map((task, key) => (
                    <TaskCard task={task} key={key}/>
                ))}
            </div>
        </Column>
    ))}
</div>
```

(9)편까지는 `onCreateTask={createTask}` 였다. 이제 Column 안의 form이 이 함수를 `onSubmit` 으로 쓰기 때문에, **form 제출을 처리할 줄 아는 `handleCreateTask`** 를 넘겨야 한다. 이유는 바로 아래 3번에 정리했다.

---

## 3. 헷갈렸던 점 — `createTask` 를 그대로 넘기면 아무 일도 안 하나?

### (9)편 상태에서는 정말 아무 일도 안 했다

그때 `Column` 은 `onCreateTask` 를 **받기만 하고 쓰지 않았다.** 헤더(제목·개수 배지·`...` 버튼)와 내용 영역의 `{children}` 만 그렸고 form은 없었다. 그러니 넘겨준 `createTask` 를 부르는 곳이 없었다. 태스크는 위쪽 Add Task Dialog의 `<form onSubmit={handleCreateTask}>` 가 만들었다.

### 지금 구조에서 `createTask` 를 넘기면 "잘못된 일"을 한다

Column 안 form이 `onSubmit={onCreateTask}` 라서, 제출하면 `createTask(제출 이벤트)` 가 불린다.

**① 데이터 대신 이벤트 객체가 들어간다**
`createTask` 는 `{ title, description, … }` 같은 **입력값 객체**를 기다린다. 그런데 form은 **제출 이벤트 객체**를 넘긴다. 이벤트에는 `title` 이 없으니 `taskData.title` 은 `undefined`. 입력칸에 쓴 글자는 하나도 전달되지 않는다.

**② 페이지가 새로고침된다**
`e.preventDefault()` 를 부르는 곳이 없어서 브라우저가 form을 원래 방식대로 제출한다. 주소가 `/boards/1?title=…&description=…&assignee=…&priority=medium&dueDate=` 처럼 바뀌면서 페이지가 통째로 다시 로드된다. 입력한 값이 DB가 아니라 **주소창**으로 간 것이다.

그래서 겉으로는 "눌렀는데 새로고침만 되고 아무 일도 없는" 것처럼 보인다.

게다가 새로고침 직전에 `createTask` 도 이미 출발했다. 실제 insert 요청은 Clerk 토큰(`getToken`)을 받은 **뒤에** 나간다. 토큰을 금방 받아서 페이지가 바뀌기 전에 요청이 브라우저를 떠나면, `title` 키가 빠진 채로 전송된다(`undefined` 는 JSON으로 바꿀 때 사라진다). (3)편의 테이블 정의에서 `tasks.title` 에는 `not null` 이 없으니 **제목 없는 빈 태스크**가 첫 번째 컬럼에 생긴다. 토큰 받는 게 늦어지면 요청이 아예 안 나가고 끝난다. 타이밍에 따라 생길 수도, 안 생길 수도 있다.

### TypeScript는 왜 안 잡아 줬나

`Column` 의 타입이 `onCreateTask: (taskData:any) => Promise<void>` 이기 때문이다. `any` 는 "아무거나 받음"이라 `createTask` 를 넣어도 `handleCreateTask` 를 넣어도 통과한다. 타입을 `(e: React.SubmitEvent<HTMLFormElement>) => void` 처럼 정확히 적었다면 `createTask` 를 넣는 순간 빨간 줄이 떴을 것이다. 영상도 `any` 라서 그대로 두었다.

### `handleCreateTask` 는 "이벤트 → 데이터" 통역사

| 함수 | 받는 것 | 하는 일 |
|---|---|---|
| `handleCreateTask(e)` | form 제출 **이벤트** | 새로고침 막기 → `FormData` 로 `name` 별 값 꺼내기 → 제목 빈칸 검사 → `createTask` 호출 → Dialog 닫기 |
| `createTask(taskData)` | 입력값 **객체** | 넣을 컬럼 고르기(`columns[0]`) → `createRealTask` 호출 |

form에는 이벤트를 받는 쪽(`handleCreateTask`)을, 코드에서 직접 부를 때는 데이터를 받는 쪽(`createTask`)을 쓴다.

---

## 4. 어느 컬럼에 들어가나

`createTask` 가 항상 `columns[0]` 을 고르기 때문에, **두 번째·세 번째 컬럼의 Add Task를 눌러도 첫 번째 컬럼(To Do)에 들어간다.** 영상 작성자의 최종 코드도 똑같이 `handleCreateTask` → `columns[0]` 이라서, 지금은 영상대로 두었다.

저장 후 Dialog가 닫히는 원리는 (9)편과 같다. `document.querySelector('[data-state="open"]')` 는 문서에서 가장 먼저 나오는 "열린" 요소를 찾는다.

- Dialog 창(어두운 배경·내용)은 `<body>` 맨 끝에 따로 그려진다.
- 페이지 안에서 `data-state` 를 가진 건 열기 버튼(DialogTrigger)들뿐이다. 위쪽 Add Task 버튼과 **다른 컬럼들의 Add Task 버튼은 모두 `data-state="closed"`** 다.
- Edit Board·Filter Dialog는 열기 버튼 없이 상태로 여닫고, 닫혀 있을 때는 아무것도 그리지 않는다.

그래서 앞쪽 컬럼의 버튼은 건너뛰고, 지금 열려 있는 **그 컬럼의 Add Task 버튼**이 찾아져 `.click()` 으로 닫힌다.

---

## 5. 아직 남은 것

| 항목 | 지금 상태 |
|---|---|
| 컬럼별 추가 위치 | 어느 컬럼에서 눌러도 첫 번째 컬럼에 들어간다(영상 최종 코드도 같다) |
| `onCreateTask` 타입 | `any` 라서 잘못된 함수를 넘겨도 TypeScript가 못 잡는다 |
| `Label` 과 입력칸 연결 | `htmlFor` 가 없어서 라벨 글자를 눌러도 입력칸에 커서가 가지 않는다(영상도 같다) |
| 컬럼 `...` 버튼 | 버튼에 `onClick` 이 없어서 `onEditColumn` 을 부르지 않고, 넘기는 `onEditColumn` 도 빈 함수다. 컬럼 수정은 영상 뒤쪽 |
| (9)편에서 남긴 것 | `min-2-0`·`ms:py-6` 오타, `"No descriptiom"`, `node:test` import, 저장 실패 시 에러가 안 보이는 문제, `/dashboard` 로그인 보호 |

---

## 6. 결과

보드 상세 페이지에서

- 컬럼마다 맨 아래에 회색 **+ Add Task** 버튼이 생긴다.
- 누르면 위쪽 Add Task와 같은 **Create New Task** 창이 뜨고, 입력 후 **Create Task** 를 누르면 창이 닫히고 카드가 생긴다.
- 다만 카드는 누른 컬럼이 아니라 **항상 첫 번째 컬럼(To Do)** 맨 아래에 생긴다.

---

## 태그

**전체:** `Next.js`, `Next.js 15`, `React`, `TypeScript`, `Supabase`, `shadcn/ui`, `Radix UI`, `Dialog`, `Select`, `Tailwind CSS`, `Tailwind v4`, `form`, `onSubmit`, `preventDefault`, `FormData`, `props`, `이벤트 핸들러`, `SubmitEvent`, `any 타입`, `트렐로 클론`, `클론 코딩`, `토이 프로젝트`

**10개 이내:** `Next.js`, `React`, `TypeScript`, `shadcn/ui`, `Dialog`, `onSubmit`, `preventDefault`, `이벤트 핸들러`, `트렐로 클론`, `클론 코딩`
