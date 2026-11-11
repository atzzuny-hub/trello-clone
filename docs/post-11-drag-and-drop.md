# Trello Clone 클론 코딩 (11) — 드래그 앤 드롭(dnd-kit)으로 카드 옮기기

참고 영상: https://www.youtube.com/watch?v=ugxI1o5SyMs
영상 구간: `04:30:00` ~ `05:13:00` Setting up DnD: DndContext and droppable columns (useDroppable) ~ handleDragOver for live UI reorder; handleDragEnd to persist via moveTask

(10)편에서 컬럼마다 Add Task 버튼을 붙였다. 이번에는 카드를 마우스로 **끌어서 순서를 바꾸고, 다른 컬럼으로 옮기고, DB에 저장**한다. 라이브러리는 (1)편에서 설치해 둔 **dnd-kit** 이다.

> 영상 설명란 챕터 표에는 드래그 챕터 네 개가 `05:05:00` ~ `05:35:00` 으로 적혀 있지만, 챕터 시간은 대충 끊은 대략값이다. 이 글은 실제로 본 시간(`04:30:00` ~ `05:13:00`) 기준이다.

각 단계는 **할 일 → 코드 → 호출(누가 언제 부르나) → 동작(화면에서 무슨 일이 일어나나)** 순서로 적었다.

---

## 0. dnd-kit 용어와 전체 흐름

| 이름 | 역할 | 이 글에서 |
|---|---|---|
| `DndContext` | 드래그 판 전체. 이 안에 있는 것만 끌고 놓을 수 있고, 드래그 이벤트(`onDragStart` / `onDragOver` / `onDragEnd`)를 받는다 | 보드의 컬럼 전체를 감싼다 |
| `useDroppable` | "여기에 놓을 수 있다"는 영역 | 컬럼 (`DroppableColumn`) |
| `useSortable` | 끌 수도 있고, 다른 항목이 위에 놓일 수도 있는 **순서 있는 항목** | 카드 (`SortableTask`) |
| `SortableContext` | 순서 있는 항목들을 묶는 목록 | 컬럼 하나의 카드 목록 |
| `DragOverlay` | 끄는 동안 마우스를 따라다니는 복사본 | `TaskOverlay` |
| 센서(sensor) | 어떤 입력으로 드래그를 시작할지 | `PointerSensor`, 8px 움직이면 시작 |

```
카드를 누르고 8px 이상 끈다 (PointerSensor)
  → onDragStart → handleDragStart   끄는 카드를 activeTask 에 저장 → DragOverlay 에 TaskOverlay 표시
  → onDragOver  → handleDragOver    같은 컬럼 안이면 화면 순서만 바꾼다 (DB 저장 X)
  → 놓는다
  → onDragEnd   → handleDragEnd     놓은 곳이 컬럼인지 카드인지 판단
      → moveTask                     (useBoards.ts) DB 저장이 끝나면 화면 상태(setColumns) 갱신
      → taskService.moveTask         (services.ts) tasks 의 column_id, sort_order 를 PATCH
```

---

## 1. 준비 — import

`app/boards/[id]/page.tsx`

```tsx
import { DndContext, DragEndEvent, DragOverEvent, DragOverlay, DragStartEvent, PointerSensor, rectIntersection, useDroppable, useSensor, useSensors } from "@dnd-kit/core"
import {SortableContext, useSortable, verticalListSortingStrategy} from '@dnd-kit/sortable';
import {CSS} from "@dnd-kit/utilities"
```

- 패키지 세 개(`@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities`)는 (1)편에서 이미 설치했다.
- 한 번에 다 쓰는 게 아니라 아래 단계에서 하나씩 쓴다.

---

## 2. `DndContext` 로 컬럼 감싸기

컬럼 목록 전체를 `DndContext` 로 감싼다. 컬럼 컴포넌트 이름도 "놓을 수 있는 컬럼"이라는 뜻으로 `DroppableColumn` 으로 바꿨다.

```tsx
// column 이름변경
function DroppableColumn({
...

{/* Board Columns  */}
<DndContext>
    <div
        className="flex flex-col lg:flex-row lg:space-x-6 lg:overflow-x-auto lg:pb-6 lg:px-2 lg:[&::-webkit-scrollbar]:h-2 lg:[&::-webkit-scrollbar-track]:bg-gray-100 lg:[&::-webkit-scrollbar-thumb]:bg-gray-300 lg:[&::-webkit-scrollbar-thumb]:rounded-full space-y-4 lg:space-y-0"
    >
        {columns.map((column, key) => (
            // <Column
            <DroppableColumn
                key={key}
                column={column}
                onCreateTask={handleCreateTask}
                onEditColumn={() => { } } // 영상에서 컬럼 수정 함수 만들면 교체
            >
                <div className="space-y-3">
                    {column.tasks.map((task, key) => (
                        <TaskCard task={task} key={key}/>
                    ))}
                </div>
            </DroppableColumn>
        ))}
    </div>
</DndContext>
```

- **호출:** 아직 아무 함수도 부르지 않는다. 이벤트 함수(`onDragStart` 등)를 하나도 넘기지 않았기 때문이다.
- **동작:** 화면은 그대로다. 이 안에 들어간 것끼리 끌고 놓을 수 있는 **"판"만 깔린** 상태다.

---

## 3. 컬럼을 "놓을 수 있는 곳"으로 — `useDroppable`

`DroppableColumn` 맨 위에서 `useDroppable` 을 부르고, 바깥 `div` 에 연결한다.

```tsx
function DroppableColumn({
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

    const { setNodeRef, isOver} = useDroppable({id:column.id})

    return(
        <div ref={setNodeRef} className={`w-full lg:flex-shrink-0 lg:w-80 ${isOver ? "bg-blue-50 rounded-lg" : ""}`}>
            <div className={`bg-white rounded-lg shadow-sm border ${isOver ? "ring-2 ring-blue-300" : ""}`}>
                {/* Column Header */}
                ...
                {/* Column Content — (10)편의 children + Add Task Dialog */}
                ...
            </div>
        </div>
    )
}
```

- 이름 말고 (10)편에서 바뀐 곳은 세 군데뿐이다. `useDroppable` 한 줄, 바깥 `div` 의 `ref={setNodeRef}` 와 `isOver` 클래스, 안쪽 `div` 의 `isOver` 클래스.
- 원래 고정 문자열이던 `className="..."` 을 `` className={`... ${isOver ? "..." : ""}`} `` 처럼 **백틱으로 감싼 템플릿 문자열**로 바꿨다. `${ }` 안의 조건에 따라 클래스를 붙였다 뗐다 할 수 있다.

| 코드 | 뜻 |
|---|---|
| `useDroppable({id:column.id})` | 이 컬럼을 **컬럼 id로** `DndContext` 에 "놓는 영역"으로 등록한다. 드래그 **이벤트**가 아니라 **등록**이다 |
| `ref={setNodeRef}` | "놓는 영역은 바로 이 `div` 다"라고 알려 준다. dnd-kit이 이 `div` 의 위치·크기를 재서 카드가 위에 있는지 판단한다 |
| `isOver` | 이 컬럼이 지금 **놓을 곳(`over`)으로 뽑혔을 때만** `true`. 끄는 카드가 이 컬럼의 다른 카드 위에 겹쳐 있으면 `over` 는 그 카드라서 `false` 다(5번 `rectIntersection` 참고) |
| `bg-blue-50` / `ring-2 ring-blue-300` | `isOver` 일 때 연한 파란 배경과 파란 테두리 |

- **호출:** `DroppableColumn` 이 그려질 때 `useDroppable` 이 등록한다. React가 `div` 를 만들면서 `setNodeRef` 를 불러 그 `div` 를 넘겨준다.
- **동작:** 끌고 있는 카드가 컬럼의 **빈 곳**(다른 카드와 겹치지 않는 아래쪽 등)이나 **빈 컬럼** 위에 오면 컬럼이 파랗게 바뀐다. 다른 카드 위에 겹쳐 있을 때는 파래지지 않는다. 다만 **아직 끌 수 있는 카드가 없어서** 4번까지 해야 확인할 수 있다.

---

## 4. 카드를 "끌 수 있는 것"으로 — `useSortable` + `SortableContext`

(9)편의 `TaskCard` 이름을 `SortableTask` 로 바꾸고, (9)편부터 카드를 감싸고 있던 바깥 `div` 에 `ref`·`style`·`listeners`·`attributes` 를 붙인다.

```tsx
function SortableTask({task}:{ task: Task}){

    const {
        attributes, 
        listeners, 
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({id: task.id})

    const styles = {
         transform: CSS.Transform.toString(transform),
         transition,
         opacity: isDragging ? 0.5 : 1
    }

    // getPriorityColor 는 (9)편 TaskCard 와 같다

    return (
        <div ref={setNodeRef} style={styles} {...listeners} {...attributes}>
            <Card className="cursor-pointer hover:shadow-md transition-shadow">
                ...  {/* 카드 내용은 (9)편 TaskCard 와 같다 */}
            </Card>
        </div>
    )
}
```

컬럼 안에서는 카드 목록을 `SortableContext` 로 감싼다.

```tsx
<DroppableColumn ...>
    <SortableContext 
        items={column.tasks.map((task) => task.id)}
        strategy={verticalListSortingStrategy}
    >
        <div className="space-y-3">
            {column.tasks.map((task, key) => (
                <SortableTask task={task} key={key}/>
            ))}
        </div>
    </SortableContext>
</DroppableColumn>
```

| 코드 | 뜻 |
|---|---|
| `useSortable({id: task.id})` | 카드를 **끌 수 있는 것**이자 **다른 카드가 놓일 수 있는 곳**으로 등록한다 |
| `listeners` | 마우스·터치를 누르는 이벤트 처리기. `div` 에 펼쳐(`{...listeners}`) 붙여서 **카드 어디를 눌러도** 끌 수 있다 |
| `attributes` | `role="button"`, `tabIndex`, `aria-*` 같은 접근성 속성 |
| `transform` | 원래 자리에서 얼마나 밀려났는지(x, y). `CSS.Transform.toString()` 이 `translate3d(...)` 같은 CSS 글자로 바꿔 준다 |
| `transition` | 다른 카드가 비켜 줄 때 부드럽게 움직이는 애니메이션 |
| `isDragging` | 이 카드가 지금 끌리는 중이면 `true` → 끄는 카드를 반투명(`0.5`)하게. 4번에서는 이 반투명한 카드 자체가 마우스를 따라 움직이고, 6번에서 `DragOverlay` 를 붙이면 원래 자리에 반투명하게 남고 복사본이 따라다닌다 |
| `items` | 이 목록에 있는 카드 id들(순서대로) |
| `verticalListSortingStrategy` | 세로 목록에 맞게 다른 카드들을 위아래로 비켜 준다 |

- **호출:** 카드가 그려질 때 `useSortable` 이 등록한다. 카드를 누르면 `listeners` 가 그 입력을 `DndContext` 에 알린다.
- **동작:** 이제 카드를 끌 수 있다. 같은 컬럼 안에서는 다른 카드가 비켜 준다. 하지만 놓으면 **제자리로 돌아온다.** 놓았을 때 할 일(8번)이 아직 없다. 또 센서를 따로 정하지 않아서(기본 센서) **누르기만 해도** 바로 드래그가 시작된다.

---

## 5. 드래그 시작 조건 — 센서 `useSensors`

컴포넌트(`BoardPage`) 안에서 센서를 만들고, `DndContext` 에 센서와 충돌 판정 방법을 넘긴다.

```tsx
const sensors = useSensors(
    useSensor(PointerSensor, {
        activationConstraint:{
            distance: 8,
        },
    })
)
```

```tsx
<DndContext
    sensors={sensors}
    collisionDetection={rectIntersection}  
    ...
>
```

| 코드 | 뜻 |
|---|---|
| `useSensor(PointerSensor, 옵션)` | 마우스·터치·펜(포인터)으로 끄는 센서 **하나**를 만든다 |
| `useSensors(센서, …)` | 센서 **여러 개를 묶어** `DndContext` 에 넘길 목록으로 만든다 |
| `distance: 8` | 누른 채 **8px보다 많이 움직여야** 드래그로 본다. 그냥 클릭과 구분하려는 것 |
| `rectIntersection` | 끄는 카드와 각 놓을 곳이 **겹친 넓이 ÷ 두 사각형을 합친 넓이** 가 가장 큰 것을 "놓을 곳(`over`)"으로 고른다. 그래서 크기가 비슷한 카드와 겹치면 카드가 뽑히고, 큰 컬럼은 카드와 겹치지 않는 빈 곳에 있을 때 뽑힌다. `DndContext` 의 기본값이라 생략해도 동작은 같다 |

- **호출:** 카드를 누르면 `PointerSensor` 가 움직인 거리를 재다가 8px을 넘는 순간 드래그를 시작한다.
- **동작:** 카드를 살짝 클릭만 해서는 드래그가 시작되지 않는다.

> `useSensor` 와 `useSensors` 는 한 글자 차이라 헷갈리기 쉽다. 바깥까지 `useSensor` 로 쓰면 에러가 난다(아래 에러 ①).

---

## 6. 끄는 카드 따라다니게 — `handleDragStart` + `DragOverlay`

```tsx
const [activeTask, setActiveTask] = useState<Task | null>(null)

function handleDragStart(event: DragStartEvent){
    const taskId = event.active.id as string;
    const task = columns   
        .flatMap((col) => col.tasks)
        .find((task) => task.id === taskId)

    if(task){
        setActiveTask(task)
    }
}
```

```tsx
<DndContext
    ...
    onDragStart={handleDragStart}
>
    <div className="flex flex-col lg:flex-row ...">
        {columns.map(...)}
        <DragOverlay>
            {activeTask ? <TaskOverlay task={activeTask} /> : null}
        </DragOverlay>
    </div>
</DndContext>
```

`TaskOverlay` 는 `SortableTask` 에서 `useSortable` 과 바깥 `div` 를 뺀 **카드 모양만** 있는 컴포넌트다.

```tsx
function TaskOverlay({task}:{ task: Task}){
    // getPriorityColor 는 같다
    return (
        <Card className="cursor-pointer hover:shadow-md transition-shadow">
            ...  {/* SortableTask 의 카드 내용과 같다 */}
        </Card>
    )
}
```

| 코드 | 뜻 |
|---|---|
| `event.active.id` | 지금 끌기 시작한 것의 id. `useSortable({id: task.id})` 로 등록했으니 카드 id다 |
| `columns.flatMap((col) => col.tasks)` | 모든 컬럼의 카드를 한 줄로 펼친다. 그중에서 id가 같은 카드를 찾는다 |
| `setActiveTask(task)` | 끄는 카드를 기억해 둔다 |
| `<DragOverlay>` | 끄는 동안 마우스를 따라다니는 층. 원래 카드와 별개로 화면 위에 따로 그린다 |

- **호출:** 드래그가 시작되면 `DndContext` 가 `onDragStart` 로 `handleDragStart(event)` 를 부른다.
- **동작:** 원래 자리 카드는 반투명해지고, 마우스를 따라 **`TaskOverlay` 복사본**이 움직인다.

---

## 7. 같은 컬럼 안에서 순서 바꾸기 — `handleDragOver`

```tsx
function handleDragOver(event: DragOverEvent){
    const {active, over} = event;
    if(!over) return;

    const activeId = active.id as string
    const overId = over.id as string
    
    const sourceColumn = columns.find((col) => 
        col.tasks.some((task) => task.id === activeId)
    )

    const targetColumn = columns.find((col) => 
        col.tasks.some((task) => task.id === overId)
    )

    if(!sourceColumn || !targetColumn) return

    if(sourceColumn.id === targetColumn.id){
        const activeIndex = sourceColumn.tasks.findIndex((task) => task.id === activeId )
        const overIndex = targetColumn.tasks.findIndex((task) => task.id === overId )

        if(activeIndex !== overIndex){
            setColumns((prev: ColumnWithTasks[]) => {
                const newColumns = [...prev]
                const column = newColumns.find((col) => col.id === sourceColumn.id)
                if(column){
                    const tasks = [...column.tasks]
                    const [removed] = tasks.splice(activeIndex, 1)
                    tasks.splice(overIndex, 0, removed)
                    column.tasks = tasks
                }

                return newColumns
            })
        }
    }
}
```

```tsx
<DndContext ... onDragOver={handleDragOver}>
```

| 코드 | 뜻 |
|---|---|
| `active` / `over` | 끄는 카드 / 지금 그 아래에 있는 것(카드 또는 컬럼). 아무것도 없으면 `over` 는 `null` |
| `sourceColumn` | 끄는 카드가 들어 있는 컬럼 |
| `targetColumn` | `over` 카드가 들어 있는 컬럼. `over` 가 카드가 아니라 컬럼이면 못 찾고 `return` |
| `splice(activeIndex, 1)` → `splice(overIndex, 0, removed)` | 끄는 카드를 빼서 `over` 카드 자리에 끼워 넣는다 |
| `setColumns` | 화면 상태만 바꾼다. **DB에는 저장하지 않는다** |

`setColumns` 를 페이지에서 쓰려면 `useBoard` 가 돌려줘야 한다. `useBoards.ts` 의 `return` 에 `setColumns` 를 추가하고, 페이지에서 꺼낸다.

- **호출:** 끄는 동안 아래에 있는 대상(`over`)이 바뀔 때마다 `DndContext` 가 `onDragOver` 로 `handleDragOver(event)` 를 부른다.
- **동작:** 같은 컬럼 안에서는 끄는 동안 카드 순서가 바로 바뀐다. 다른 컬럼 위에서는 아무것도 하지 않는다. 단, 이 순서는 DB에 저장되지 않고, 개발 모드에서는 순서가 섞이기도 한다(11-1 참고).

---

## 8. 놓았을 때 — `handleDragEnd`

```tsx
async function handleDragEnd(event: DragEndEvent){
    const {active, over} = event;
    if(!over) return;

    const taskId = active.id as string
    const overId = over.id as string

    const targetColumn = columns.find((col) => col.id === overId);
    if(targetColumn){
        const sourceColumn = columns.find((col) => 
            col.tasks.some((task) => task.id === taskId)
        )

        if(sourceColumn && sourceColumn.id !== targetColumn.id){
            await moveTask(taskId, targetColumn.id, targetColumn.tasks.length)
        }
    }else{
        const sourceColumn = columns.find((col) => 
            col.tasks.some((task) => task.id === taskId)
        )   

        const targetColumn = columns.find((col) => 
            col.tasks.some((task) => task.id === overId)
        )

        if(sourceColumn && targetColumn){
            const oldIndex = sourceColumn.tasks.findIndex((task) => task.id === taskId )
            const newIndex = targetColumn.tasks.findIndex((task) => task.id === overId )

            if(oldIndex !== newIndex){
                await moveTask(taskId, targetColumn.id, newIndex)
            }
        }
    }
}
```

```tsx
<DndContext ... onDragEnd={handleDragEnd}>
```

놓은 곳(`over`)이 무엇이냐에 따라 두 갈래로 나뉜다.

| 놓은 곳 | 찾는 방법 | 하는 일 |
|---|---|---|
| **컬럼**(카드 없는 빈 곳) | `over.id` 와 같은 id의 컬럼이 있다 | 다른 컬럼이면 그 컬럼 **맨 아래**(`tasks.length` 번째)로 옮긴다 |
| **다른 카드** 위 | 컬럼은 없고, `over.id` 카드가 든 컬럼이 있다 | 그 카드 **자리**(`newIndex`)로 옮긴다. 순번이 같으면 하지 않는다 |

- `as string` 은 TypeScript에게 "글자라고 치자"고 알려 주는 것일 뿐, 값을 글자로 **바꾸지는 않는다.** DB의 id는 숫자라서 `col.id === overId` 는 숫자끼리 비교된다.
- **호출:** 카드를 놓으면 `DndContext` 가 `onDragEnd` 로 `handleDragEnd(event)` 를 부르고, 옮겨야 하면 `moveTask` 를 부른다.
- **동작:** 9번까지 하면 놓은 자리에 카드가 남는다.

---

## 9. DB에 저장하기 — `moveTask`

### 9-1. `taskService.moveTask` — tasks 한 줄 수정

`lib/services.ts` 의 `taskService` 에 추가한다.

```ts
async moveTask(
    supabase: SupabaseClient,
    taskId: string, 
    newColumnId: string, 
    newOrder:number
){
    const {data, error} = await supabase
        .from("tasks")
        .update({
            column_id:newColumnId, 
            sort_order: newOrder, 
        })
        .eq("id", taskId)

    if(error) throw error
    
    return data
}
```

- `.update({...}).eq("id", taskId)`: id가 `taskId` 인 줄의 **컬럼(`column_id`)과 순서(`sort_order`)** 를 바꾼다. 브라우저 Network 탭에서는 `PATCH /rest/v1/tasks?id=eq.10` 같은 요청으로 보인다.
- `tasks` 테이블에는 `updated_at` 칸이 없어서 보내면 안 된다(아래 에러 ④).

### 9-2. `useBoard` 의 `moveTask` — 저장 후 화면 상태 갱신

`lib/hooks/useBoards.ts` 의 `useBoard` 안에 추가한다. 안에서 `Task` 타입을 쓰니까 파일 맨 위 import에 `Task` 도 추가한다.

```ts
import { Board, Column, ColumnWithTasks, Task } from "../supabase/models";
```

```ts
async function moveTask(
    taskId: string, 
    newColumnId: string, 
    newOrder:number
){
    try{
        await taskService.moveTask(supabase!, taskId, newColumnId, newOrder)
        
        setColumns((prev) => {
            const newColumns = [...prev]

            let taskToMove : Task | null = null;
            for(const col of newColumns) {
                const taskIndex = col.tasks.findIndex((task) => task.id === taskId)
                if(taskIndex !== -1){
                    taskToMove = col.tasks[taskIndex]
                    col.tasks.splice(taskIndex, 1)
                    break
                }
            }

            if(taskToMove){
                const targetColumn = newColumns.find((col) => col.id === newColumnId);

                if(targetColumn){
                    targetColumn.tasks.splice(newOrder, 0, taskToMove)
                }
            }
            return newColumns
        })
    }catch(err){
        setError(err instanceof Error ? err.message : "태스크 이동에 실패했습니다.")
    } 
}

return{
    board,
    columns,
    loading,
    error,
    updateBoard,
    createRealTask,
    setColumns,
    moveTask
}
```

페이지에서 꺼낸다.

```tsx
const {board, updateBoard, columns, createRealTask, setColumns, moveTask} = useBoard(id)
```

| 코드 | 뜻 |
|---|---|
| `await taskService.moveTask(...)` | **DB 저장을 먼저** 한다. 실패하면 `catch` 로 가서 화면은 그대로 둔다 |
| `for ... of` + `splice(taskIndex, 1)` | 모든 컬럼에서 옮길 카드를 찾아 원래 컬럼에서 뺀다 |
| `splice(newOrder, 0, taskToMove)` | 새 컬럼의 `newOrder` 번째 자리에 끼워 넣는다 |
| `return newColumns` | `setColumns` 에 넘긴 함수는 **새 배열을 돌려줘야** 한다. 이 줄은 반드시 `setColumns((prev) => { ... })` **괄호 안**에 있어야 한다(아래 에러 ②) |
| `return { ..., moveTask }` | 훅 안에서 만든 함수는 `return` 에 넣어야 페이지에서 꺼내 쓸 수 있다(아래 에러 ③) |

- **호출:** `handleDragEnd` → `moveTask` → `taskService.moveTask` → Supabase에 `PATCH` → 에러가 없으면 `204`(본문 없음) → `setColumns`
  - `204` 는 "에러가 없었다"는 뜻일 뿐이다. RLS `using` 조건에 걸려 **0줄이 바뀌어도** 에러가 아니라서 똑같이 `204` 가 온다. 정말 저장됐는지는 Table Editor에서 확인한다.
- **동작:** 놓은 컬럼에 카드가 남고, 컬럼 배지 숫자도 바뀐다. 새로고침해도 카드는 옮긴 컬럼에 있다.

---

## 10. 막혔던 에러

### ① `useSensor` 를 겹쳐 썼다 — `TS2345`

```tsx
const sensors = useSensor(          // ← 바깥도 useSensor
    useSensor(PointerSensor, { ... })
)
```

```
error TS2345: Argument of type 'SensorDescriptor<…>' is not assignable to parameter of type 'Sensor<SensorOptions>'.
```

- `useSensor` 는 **센서 종류**(`PointerSensor`)를 받아 **센서 하나**를 돌려준다. 바깥에서 그 결과를 다시 `useSensor` 에 넣으니 "센서 종류 자리에 센서가 왔다"는 에러가 났다.
- **해결:** 바깥을 `useSensors`(s)로 바꾸고 import에도 `useSensors` 를 추가했다.

### ② `moveTask` 의 오타 세 개 — `TS2552`, `TS2345`

| 잘못 쓴 것 | 에러 | 고친 것 |
|---|---|---|
| `for(const col of newColumn)` | `TS2552: Cannot find name 'newColumn'. Did you mean 'newColumns'?` (덩달아 `task` 가 `any` 라는 `TS7006` 도 남) | `newColumns` |
| `col.tasks(taskIndex)` | 처음엔 에러가 안 남. 위 오타 때문에 `col` 이 `any` 라 TypeScript가 검사를 못 했다 | `col.tasks[taskIndex]` (배열은 `[]` 로 꺼낸다) |
| `setColumns((prev) => { ... })` **밖**에 `return newColumns` | `TS2345: '(prev) => void' is not assignable to ... SetStateAction` + `TS2552: Cannot find name 'newColumns'` | `return newColumns` 를 괄호 **안**으로 |

- `newColumns` 는 `setColumns` 에 넘긴 함수 **안에서** 만든 `const` 라 밖에서는 보이지 않는다.
- `catch{}` 도 비워 두지 않고 `setError` 를 부르게 했다.

### ③ `ReferenceError: moveTask is not defined` — 놓는 순간 터짐

```
page.tsx:391 Uncaught (in promise) ReferenceError: moveTask is not defined
    at handleDragEnd (page.tsx:391:17)
```

- `useBoard` 안에 `moveTask` 를 **만들기만** 하고 `return` 에 넣지 않았고, 페이지에서도 꺼내지 않았다.
- `npm run dev` 는 **타입 검사를 하지 않고** 실행해서 화면은 멀쩡히 떴다. 카드를 놓는 순간 `handleDragEnd` 가 `moveTask` 를 부르면서 터졌다. `npx tsc --noEmit` 으로는 미리 `TS2304: Cannot find name 'moveTask'` 로 잡힌다.
- **해결:** `useBoard` 의 `return` 과 페이지의 `const { ... } = useBoard(id)` 에 `moveTask` 를 추가했다.

### ④ `PATCH 400` — `PGRST204` `updated_at`

```json
{ "code": "PGRST204", "message": "Could not find the 'updated_at' column of 'tasks' in the schema cache" }
```

- `taskService.moveTask` 에서 `updated_at: new Date().toISOString()` 도 같이 보냈는데, **`tasks` 테이블에는 `updated_at` 칸이 없다.** (9)편에서 "나중에 태스크를 수정할 때 `updated_at` 을 보내면 에러가 날 수 있다"고 적어 둔 바로 그 경우다.
- **해결:** `update` 에서 `updated_at` 을 지웠다. `models.ts` 의 `Task` 타입에서도 `updated_at` 을 주석 처리했다.

### ⑤ `PATCH 400` — `22P02` `invalid input syntax for type uuid`

```json
{ "code": "22P02", "message": "invalid input syntax for type uuid: \"user_3LXz…\"" }
```

- 코드가 아니라 **Supabase RLS 정책** 문제였다. (3)편에서 정책을 `auth.uid()` 로 만들었는데, `auth.uid()` 는 사용자 ID를 **uuid로 바꿔서** 돌려준다. Clerk ID(`user_…`)는 uuid가 아니라서 바꾸다가 에러가 난다.
- (4)편에서 `requesting_user_id()` 로 정책을 고쳤지만, tasks의 **UPDATE 정책 하나가 빠져** 있었다. 지금까지는 태스크를 조회·추가만 해서 드러나지 않다가, 드래그로 처음 UPDATE 를 하면서 터졌다. (3)편에 적어 둔 "확인 필요"가 실제로 터진 경우다.
- **확인:** SQL Editor에서 아직 `auth.uid()` 를 쓰는 정책을 찾았다.

  ```sql
  select tablename, policyname, cmd, qual, with_check
  from pg_policies
  where schemaname = 'public'
    and (qual like '%auth.uid%' or with_check like '%auth.uid%');
  ```

  결과는 `tasks` / `Users can update tasks from their own boards` / `UPDATE` 한 줄이었다(`with_check` 는 `NULL`).
- **해결:**

  ```sql
  alter policy "Users can update tasks from their own boards"
  on public.tasks
  using (
    exists (
      select 1 from columns
      join boards on boards.id = columns.board_id
      where columns.id = tasks.column_id
      and boards.user_id = requesting_user_id()
    )
  );
  ```

  `with_check` 가 없는 UPDATE 정책은 `using` 조건을 옮긴 뒤의 행 검사에도 그대로 쓴다. 같은 찾기 쿼리를 다시 돌려 0줄인 것을 확인했다.

> boards 정책에 `ALTER POLICY ... requesting_user_id()` 를 다시 실행할 필요는 없었다. boards 정책은 (4)편에서 전부 지우고 새로 만들었고, 조회·추가·수정이 이미 잘 됐다.

### ⑥ 다른 카드 위에 놓을 때 출발 컬럼을 잘못 찾음 — `task.id === task.id`

```tsx
const sourceColumn = columns.find((col) => 
    col.tasks.some((task) => task.id === task.id)   // ← 자기 자신과 비교
)
```

- `handleDragEnd` 의 `else` 를 채우다가 `taskId` 대신 `task.id` 를 썼다. 자기 자신과 비교하니 **항상 참**이라, `sourceColumn` 이 "끄는 카드가 든 컬럼"이 아니라 **카드가 하나라도 있는 첫 컬럼**이 됐다.
- 문법은 맞아서 `tsc` 도 못 잡는다. 같은 함수 위쪽 `if` 의 같은 코드와 비교해서 찾았다.
- **해결:** `task.id === taskId`

---

## 11. 아직 남은 것

| 항목 | 지금 상태 |
|---|---|
| 다른 컬럼의 **같은 순번** 카드 위에 놓기 | 예: To Do 첫 카드를 In Progress 첫 카드 위에 놓으면 `oldIndex`(0)와 `newIndex`(0)가 같아 **아무 일도 안 일어난다.** 컬럼 빈 곳에 놓으면 옮겨진다. 영상 코드도 같다. 조건을 `sourceColumn.id !== targetColumn.id \|\| oldIndex !== newIndex` 로 바꾸면 해결된다 |
| 컬럼 id와 카드 id가 겹칠 수 있음 | 두 테이블 다 1부터 늘어나는 숫자 id다. dnd-kit은 놓을 곳을 **id 하나로** 구분해서, 화면에 있는 컬럼과 카드의 id가 같은 숫자면 하나가 다른 하나를 덮어쓴다. 영상 코드도 같다. `column-3` 처럼 앞에 글자를 붙이면 피할 수 있다(그러면 `handleDragEnd` 의 `col.id === overId` 비교도 같이 바꿔야 한다) |
| 같은 컬럼 안 순서 | **저장되지 않고, 개발 모드에서는 섞이기도 한다.** 아래 11-1 |
| 휴대폰에서 끌기 | `PointerSensor` 는 터치도 받지만, 카드에 `touch-action: none`(Tailwind `touch-none`)이 없어서 휴대폰에서 끌면 화면이 스크롤되면서 드래그가 취소될 수 있다(dnd-kit 문서 권장 사항. 실제 기기로는 확인 안 함) |
| 에러 표시 | `moveTask` 가 실패하면 `setError` 를 부르지만, 페이지가 `error` 를 꺼내 화면에 보여 주지 않는다. 실패는 Network 탭에서만 보인다 |
| 카드 코드 중복 | `SortableTask` 와 `TaskOverlay` 의 카드 모양, `getPriorityColor` 가 복사돼 있다(영상도 같다) |
| (10)편에서 남긴 것 | 컬럼별 Add Task가 항상 첫 컬럼에 들어감, `onCreateTask` 의 `any` 타입, `Label` 의 `htmlFor` 없음, 컬럼 `...` 버튼, `min-2-0`·`ms:py-6` 오타, `"No descriptiom"`, `node:test` import, `/dashboard` 로그인 보호 |

### 11-1. 같은 컬럼 안 순서가 저장되지 않고, 섞이기도 하는 이유

영상 코드도 같은 문제다. 원인이 두 가지다.

**① 놓는 순간에는 이미 순서가 바뀌어 있다 → 저장이 안 된다**
`handleDragOver` 가 끄는 동안 화면 순서를 먼저 바꾼다. 그러면 끄는 카드가 새 자리로 옮겨져 마우스 바로 아래에 오므로, 놓는 순간의 `over` 는 보통 **끄는 카드 자기 자신**이다. `handleDragEnd` 의 `else` 에서 `oldIndex === newIndex` 가 되어 `moveTask` 가 불리지 않는다. 그래서 DB에는 아무것도 저장되지 않고, 새로고침하면 원래 순서(`sort_order` 순)로 돌아간다.

**② 개발 모드에서는 순서가 섞인다 — StrictMode + 원본 수정**

```tsx
setColumns((prev) => {
    const newColumns = [...prev]                                    // 바깥 배열만 새로 만듦
    const column = newColumns.find((col) => col.id === sourceColumn.id)  // prev 안의 그 컬럼 객체
    ...
    column.tasks = tasks                                            // ← prev 의 컬럼을 직접 고침
    return newColumns
})
```

- `[...prev]` 는 바깥 배열만 복사한다. `find` 로 꺼낸 `column` 은 `prev` 안에 있는 **같은 객체**라서, `column.tasks = tasks` 는 이전 상태를 직접 고친다.
- Next.js App Router는 개발 모드(`npm run dev`)에서 React **StrictMode**가 켜져 있다. StrictMode는 실수를 찾으려고 `setColumns` 에 넘긴 함수를 **같은 `prev` 로 두 번** 실행한다.
- 첫 번째 실행이 `prev` 를 이미 고쳐 놓았기 때문에, 두 번째 실행은 **바뀐 순서에서 한 번 더** 바꾼다.
  - 바로 옆 카드와 바꾸면(A, B, C에서 A를 B 자리로) → B, A, C → 다시 A, B, C로 **되돌아간다.**
  - 두 칸 옮기면(A를 C 자리로) → B, C, A → **C, A, B** 로 섞인다.
- 배포(production) 빌드에서는 한 번만 실행돼서 섞이지는 않는다. 하지만 ① 때문에 저장은 여전히 안 된다.

> 고치려면 `prev.map((col) => col.id === sourceColumn.id ? { ...col, tasks } : col)` 처럼 **고친 컬럼을 새 객체로** 만들어 돌려주고, 같은 컬럼 안 순서도 `handleDragEnd` 에서 저장해야 한다. 영상과 크게 달라지는 부분이라 지금은 그대로 두었다. (9)편 `createRealTask` 에서 본 "원본을 고치지 않고 새로 만들기"가 왜 중요한지 보여 주는 예다.
>
> `moveTask` 의 `setColumns` 도 안쪽 배열을 `splice` 로 직접 고치지만, 두 번 실행해도 카드를 뺐다가 같은 자리에 다시 넣는 것이라 결과가 같다.

---

## 12. 결과

보드 상세 페이지에서

- 카드를 누르고 살짝 끌면 원래 자리 카드는 반투명해지고, **복사본이 마우스를 따라온다.**
- 끄는 카드가 컬럼의 빈 곳이나 빈 컬럼 위에 오면 그 컬럼에 **연한 파란 배경과 파란 테두리**가 생긴다(다른 카드 위에 겹쳐 있을 때는 생기지 않는다).
- 같은 컬럼 안에서 끌면 다른 카드들이 비켜 주며 **순서가 바뀐다.** 단, 저장되지 않아서 새로고침하면 원래대로 돌아오고, 개발 모드에서 두 칸 이상 옮기면 순서가 섞인다(11-1).
- 다른 컬럼의 빈 곳에 놓으면 그 컬럼 **맨 아래로** 옮겨지고, 컬럼 배지 숫자가 바뀐다. 새로고침해도 옮긴 컬럼에 그대로 있다.

---

## 태그

**전체:** `Next.js`, `Next.js 15`, `React`, `TypeScript`, `dnd-kit`, `드래그 앤 드롭`, `DndContext`, `useDroppable`, `useSortable`, `SortableContext`, `DragOverlay`, `PointerSensor`, `Supabase`, `RLS`, `auth.uid`, `Clerk`, `PATCH`, `PGRST204`, `22P02`, `TS2345`, `TS2552`, `useState`, `트렐로 클론`, `클론 코딩`, `토이 프로젝트`

**10개 이내:** `Next.js`, `React`, `TypeScript`, `dnd-kit`, `드래그 앤 드롭`, `Supabase`, `RLS`, `Clerk`, `트렐로 클론`, `클론 코딩`
