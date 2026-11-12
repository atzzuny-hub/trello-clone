# Trello Clone 클론 코딩 (13) — 태스크 필터와 보드 필터

참고 영상: https://www.youtube.com/watch?v=ugxI1o5SyMs
영상 구간: `05:39:00` ~ `06:16:00` Task filtering UI: priority toggles & due-date picker / Dashboard filtering: board search & date-range inputs

(12)편에서 컬럼을 추가하고 이름을 바꿨다. 이번에는 **필터** 두 가지를 만든다.

1. **보드 상세(`/boards/[id]`)의 태스크 필터** — 우선순위(Low·Medium·High)와 마감일로 카드를 걸러 본다. (8)편에서 모양만 만들어 둔 Filter 팝업을 이번에 동작하게 한다.
2. **대시보드(`/dashboard`)의 보드 필터** — 제목 검색, 만든 날짜 범위, 태스크 수로 보드를 걸러 본다.

> 영상 설명란 챕터 표에는 이 두 챕터가 `06:05:00`·`06:15:00` 으로 적혀 있지만, 챕터 시간은 대충 끊은 대략값이다. 이 글은 실제로 본 시간 기준이다.

각 단계는 **할 일 → 코드 → 호출(누가 언제 부르나) → 동작(화면에서 무슨 일이 일어나나)** 순서로 적었다.

---

## 0. 두 필터의 공통 구조

두 필터는 모양이 같다. **원본은 그대로 두고, 그릴 때마다 걸러낸 목록을 새로 계산한다.**

```
입력칸·버튼 → setFilters(...)        filters 상태만 바꾼다
  → 페이지가 다시 그려짐
  → filteredXxx = 원본.filter(...)    원본 + filters 로 매번 새로 계산
  → filteredXxx.map(...) 으로 그림
```

| | 보드 상세 태스크 필터 | 대시보드 보드 필터 |
|---|---|---|
| 파일 | `app/boards/[id]/page.tsx` | `app/dashboard/page.tsx` |
| 원본 | `columns` (`useBoard`) | `boards` (`useBoards`) |
| 필터 상태 | `priority`, `assignee`, `dueDate` | `search`, `dateRange`, `taskCount` |
| 걸러낸 값 | `filteredColumns` (컬럼은 그대로, 카드만 거름) | `filteredBoards` |
| 조건 | 우선순위, 마감일 | 제목, 만든 날짜, 태스크 수 |

**왜 원본을 바꾸지 않나?** `setBoards(걸러낸 목록)` 처럼 원본을 덮어쓰면 걸러진 보드는 사라진다. 검색어를 지워도 다시 불러오기 전까지 돌아오지 않는다. 원본은 그대로 두고 **매번 계산한 값(파생값)** 만 화면에 쓰면, state나 `useEffect` 를 따로 만들 필요가 없다. 새로 만든 보드도 자동으로 필터를 거쳐 나온다.

---

# 1부. 보드 상세 — 태스크 필터

## 1. 필터 상태와 `handleFilterChange`

**할 일:** 고른 조건을 담을 상태와, 그 상태를 바꾸는 함수를 만든다.

`app/boards/[id]/page.tsx`

```tsx
const [filters, setFilters] = useState({
    priority: [] as string[],
    assignee: [] as string[],
    dueDate: null as string | null
})
```

```tsx
function handleFilterChange(
    type: "priority" | "assignee" | "dueDate", 
    value: string | string[] | null
){
    setFilters((prev) => ({
        ...prev,
        [type]:value
    }))
}
```

| 코드 | 뜻 |
|---|---|
| `priority: [] as string[]` | 우선순위는 **여러 개**를 고를 수 있어서 배열. 비어 있으면 "조건 없음" |
| `dueDate: null as string \| null` | 마감일은 하나. 안 골랐으면 `null` |
| `as string[]` | 빈 배열만 주면 TypeScript가 "아무것도 못 넣는 배열(`never[]`)"로 알아서, 어떤 배열인지 알려 준다 |
| `[type]: value` | 대괄호 안의 **변수 값**을 키 이름으로 쓴다. `type` 이 `"dueDate"` 면 `{ ...prev, dueDate: value }` 와 같다. 함수 하나로 세 칸을 다 바꿀 수 있다 |

- **호출:** 아직 부르는 곳이 없다. 2·3번에서 버튼과 입력칸이 부른다.
- **동작:** 화면은 그대로다.

---

## 2. 우선순위 버튼 — 눌렀다 떼는 토글

**할 일:** (8)편에서 모양만 있던 Low·Medium·High 버튼을 누르면 고르고, 다시 누르면 빠지게 한다. 고른 버튼은 색을 바꾼다.

```tsx
<div className="flex flex-wrap gap-2">
    {["low", "medium", "high"].map((priority, key) => (
        <Button 
        onClick={()=>{
            const newPriorities = filters.priority.includes(priority)
            ? filters.priority.filter((p) => p !== priority)   // 이미 있으면 → 빼기
            : [...filters.priority, priority]                   // 없으면 → 추가

            handleFilterChange("priority", newPriorities)
        }}
            key={key} 
            variant={filters.priority.includes(priority) ? 'default' : 'outline'}
            size="sm"
        >
            {priority.charAt(0).toUpperCase() + priority.slice(1)}
        </Button>
    ))}
</div>
```

| 코드 | 뜻 |
|---|---|
| `filters.priority.includes(priority)` | 지금 이 우선순위가 골라져 있나 |
| `.filter((p) => p !== priority)` | 골라져 있으면 **그것만 뺀 새 배열** |
| `[...filters.priority, priority]` | 없으면 **끝에 붙인 새 배열** |
| `variant={... ? 'default' : 'outline'}` | 고른 버튼은 꽉 찬 색(`default`), 아니면 테두리만(`outline`) |
| `charAt(0).toUpperCase() + slice(1)` | `"low"` → `"Low"`. 첫 글자만 대문자 |

- 상태 안의 배열은 `push` 로 직접 고치지 않고 **새 배열**을 만들어 넘긴다((9)편 2-2에서 본 원칙). 원본을 고치는 습관은 (11)편 11-1처럼 개발 모드에서 순서가 섞이는 문제를 만들 수 있다.
- **호출:** 버튼 클릭 → `handleFilterChange("priority", newPriorities)` → `setFilters`
- **동작:** 누를 때마다 버튼 색이 바뀐다. 카드는 아직 그대로다(6번에서 거른다).

---

## 3. 마감일 입력칸

**할 일:** 날짜를 고르면 `filters.dueDate` 에 넣는다.

```tsx
<div className="space-y-2">
    <Label>Due Date</Label>
    <Input 
        type="date" 
        value={filters.dueDate || ''}
        onChange={(e) => handleFilterChange("dueDate", e.target.value || null)}
    />
</div>
```

- `type="date"`: 고른 값은 `"2026-11-12"` 처럼 `YYYY-MM-DD` 글자로 온다.
- `e.target.value || null`: 날짜를 지우면 빈 글자(`""`)가 오는데, 그걸 `null`(조건 없음)로 바꾼다.
- `value={filters.dueDate || ''}`: 입력칸이 상태를 그대로 보여 준다(제어 컴포넌트, (7)편 4-2). 그래서 5번 Clear Filters로 상태를 비우면 입력칸도 같이 비워진다. `null` 을 그대로 넣으면 React가 경고하므로 빈 글자로 바꿔 넣는다.
- **호출:** 날짜 선택 → `handleFilterChange("dueDate", "2026-11-12")`
- **동작:** 입력칸에 날짜가 보인다. 카드는 아직 그대로다.

---

## 4. 헤더의 필터 개수 — `filterCount`

**할 일:** (8)편에서 Navbar의 Filter 버튼 옆 숫자를 배지 모양을 보려고 `filterCount={2}` 로 고정해 두었다. 이걸 실제로 고른 조건 수로 바꾼다.

```tsx
<Navbar 
    boardTitle={board?.title}
    onEditBoard={...}
    onFilterClick={()=>setIsFilterOpen(true)}
    // filterCount={2}
    filterCount={
        Object.values(filters).reduce(
            (count, v) =>
                count + (Array.isArray(v) ? v.length : v !== null ? 1 : 0), 0
        )
    }            
/>
```

| 코드 | 뜻 |
|---|---|
| `Object.values(filters)` | `filters` 의 값만 꺼낸 배열. `[priority 배열, assignee 배열, dueDate]` |
| `reduce((count, v) => ..., 0)` | 0부터 시작해서 하나씩 더한다 |
| `Array.isArray(v) ? v.length` | 배열이면 고른 개수만큼 (High·Low 두 개면 2) |
| `: v !== null ? 1 : 0` | 배열이 아니면(마감일) 골랐으면 1, 아니면 0 |

- **호출:** 페이지가 그려질 때마다 계산된다.
- **동작:** High와 Low를 고르고 마감일도 고르면 `3` 이 보인다.
  - 아무것도 안 고르면 0이라 배지가 아예 보이지 않는다. Navbar는 `filterCount > 0` 일 때만 배지를 그린다((8)편 5번). 전에는 임시 값 `2` 가 늘 보였는데, 이제 페이지를 처음 열면 배지가 없다.
  - `components/navbar.tsx` 의 기본값 `filterCount=2` 는 그대로다. 보드 페이지가 늘 값을 넘겨서 지금은 화면에 영향이 없지만, 헷갈리지 않게 `0` 으로 바꿔 두면 좋다.

---

## 5. Clear Filters 버튼

**할 일:** 고른 조건을 한 번에 지운다.

```tsx
function clearFilters(){
    setFilters({
        priority: [] as string[],
        assignee: [] as string[],
        dueDate: null as string | null
    })
}
```

```tsx
<Button 
    onClick={clearFilters}
    type="button" variant="outline"
>
    Clear Filters
</Button>
```

- 처음 값과 똑같은 객체로 덮어쓴다.
- Apply Filters 버튼은 (8)편부터 `onClick={()=>setIsFilterOpen(false)}` 로 **팝업을 닫기만** 했고, 그대로 둔다. 필터는 버튼·입력칸을 바꾸는 순간 이미 적용된다.
- **동작:** 우선순위 버튼이 모두 테두리 모양으로 돌아가고, 마감일 칸이 비고, 헤더 Filter 버튼의 숫자 배지가 사라진다(개수가 0이면 배지를 그리지 않고 버튼의 파란 배경도 빠진다).

---

## 6. 카드 걸러내기 — `filteredColumns`

**할 일:** 컬럼은 그대로 두고, 각 컬럼의 **카드만** 조건에 맞게 거른다.

```tsx
const filteredColumns = columns.map((column) => ({
    ...column,
    tasks:column.tasks.filter((task) => {
        // Filter by proirity
        if(
            filters.priority.length > 0 &&
            !filters.priority.includes(task.priority)
        ){
            return false
        }

        // filter by due date
        if(filters.dueDate && task.due_date){
            const taskDate = new Date(task.due_date).toDateString()
            const filterDate = new Date(filters.dueDate).toDateString()

            if(taskDate !== filterDate){
                return false
            }
        }

        return true
    })
}))
```

그리는 곳에서 `columns` 대신 `filteredColumns` 를 쓴다.

```tsx
{/* {columns.map((column, key) => ( */}
{filteredColumns.map((column, key) => (
    <DroppableColumn
        ...
```

| 코드 | 뜻 |
|---|---|
| `columns.map((column) => ({...column, tasks: ...}))` | 컬럼마다 **새 객체**를 만들고 `tasks` 만 걸러낸 배열로 바꾼다. 원본 `columns` 는 그대로 |
| `filters.priority.length > 0 &&` | 우선순위를 하나도 안 골랐으면 이 검사는 건너뛴다(전부 통과) |
| `!filters.priority.includes(task.priority)` | 골랐는데 이 카드의 우선순위가 목록에 없으면 `return false`(빼기) |
| `return true` | 모든 검사를 통과하면 남긴다 |

- **마감일 비교:** 두 값 모두 `"YYYY-MM-DD"` 글자다. `new Date(...)` 로 바꾼 뒤 `toDateString()`(`"Thu Nov 12 2026"`)끼리 비교한다. 양쪽이 똑같이 바뀌므로 결과는 `task.due_date !== filters.dueDate` 처럼 글자를 바로 비교하는 것과 같다.
- **바꾼 곳은 화면 그리는 한 곳뿐이다.** 위쪽 Total Tasks, 드래그 함수(`handleDragOver`·`handleDragEnd`), `createTask` 는 원본 `columns` 를 그대로 쓴다. 드래그 함수까지 `filteredColumns` 로 바꾸면 숨은 카드가 빠진 순번으로 계산돼서 오히려 틀어진다.
- **호출:** 페이지가 그려질 때마다 계산된다. 2·3번에서 `setFilters` 를 부르면 다시 그려지면서 다시 계산된다.
- **동작:**
  - High를 고르면 각 컬럼에 High 카드만 남고, **컬럼 배지 숫자도 걸러진 개수**로 바뀐다. 위쪽 Total Tasks는 원본 기준이라 그대로다.
  - 마감일을 고르면 그날이 마감인 카드만 남는다. 단, **마감일이 없는 카드는 계속 보인다**(조건이 `filters.dueDate && task.due_date` 라서 마감일이 없으면 검사를 건너뛴다. 영상도 같다).

---

# 2부. 대시보드 — 보드 필터

## 7. Filter 팝업 만들고 버튼에 연결

**할 일:** 대시보드의 Filter 버튼을 누르면 Filter Boards 팝업이 열리게 한다.

`app/dashboard/page.tsx` 맨 위 import에 팝업과 라벨을 추가한다.

```tsx
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
```

```tsx
const [isFilterOpen, setIsFilterOpen] = useState<boolean>(false)
```

```tsx
<Button 
    variant="outline" 
    size="sm"
    onClick={()=>setIsFilterOpen(true)}
>
    <Filter/>
    Filter
</Button>
```

> **영상 최종 코드에 맞춘 것 (필터와 상관없음)**
> (5)편에서 환영 문구 옆에 있던 상단 `create Board` 버튼을 지웠다. 영상 최종 코드에는 없는 버튼이고, 아래 Your Boards 옆 `Create Board` 버튼과 하는 일이 같다(둘 다 `handleCreateBoard`). 버튼 묶음에도 영상처럼 `sm:space-x-4`(넓은 화면에서 버튼 사이 간격)를 넣고, Grid·List 묶음에 `rounded`(모서리 둥글게)를 넣었다.

팝업은 페이지 맨 아래 `</main>` 뒤에 둔다. 처음에는 모양만 만든다(입력칸 연결은 8번).

```tsx
{/* Filter dialog */}
<Dialog open={isFilterOpen} onOpenChange={setIsFilterOpen}>
    <DialogContent className="w-[95vw] max-w-[425px] mx-auto">
        <DialogHeader>
            <DialogTitle>Filter Boards</DialogTitle>
            <p className="text-sm text-gray-600">
                Filter boards by title, date, or task count
            </p>
        </DialogHeader>
        <div className="space-y-4">
            {/* Search · Date Range · Task Count 칸 */}
            ...
            <div className="flex flex-col sm:flex-row justify-between pt-4 space-y-2 sm:space-y-0 sm:space-x-2">
                <Button variant="outline">Clear Filters</Button>
                <Button>Apply Filters</Button>
            </div>
        </div>
    </DialogContent>
</Dialog>
```

- (7)편 보드 수정 팝업, (12)편 컬럼 팝업과 같은 **상태로 여는 팝업**이다.
- **호출:** Filter 클릭 → `setIsFilterOpen(true)` → `<Dialog open={true}>`
- **동작:** Search, Date Range(시작·끝), Task Count(최소·최대) 칸이 있는 팝업이 뜬다. 아직 입력해도 아무 일이 없다.

---

## 8. 필터 상태와 입력칸 연결

**할 일:** 입력값을 담을 상태를 만들고, 칸마다 `value` 와 `onChange` 를 단다.

```tsx
const [filters, setFilters] = useState({
    search:"",
    dateRange: {
        start: null as string | null,
        end: null as string | null
    },
    taskCount:{
        min: null as number | null,
        max: null as number | null
    }
})
```

팝업에는 `<form>` 이 없다. **칸마다** `onChange` 를 달아서, 입력할 때마다 바로 상태를 바꾼다.

```tsx
<div className="space-y-2">
    <Label htmlFor="filter-search">Search</Label>
    <Input 
        id="filter-search" 
        placeholder="Search board title...."
        value={filters.search}
        onChange={(e) => setFilters((prev) => ({...prev, search: e.target.value}))}
    />
</div>
<div className="space-y-2">
    <Label>Date Range</Label>
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <div className="text-xs">
            <Label>Start Date</Label>
            <Input 
                type="date" 
                value={filters.dateRange.start ?? ''}
                onChange={(e) => 
                    setFilters((prev) => ({
                        ...prev,
                        dateRange:{
                            ...prev.dateRange,
                            start:e.target.value || null
                        }
                    }))
                }
            />
        </div>
        {/* End Date 도 같은 모양, start 대신 end */}
    </div>
</div>
<div className="space-y-2">
    <Label>Task Count</Label>
    <div className="space-y-2">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div className="text-xs">
                <Label>Minimum</Label>
                <Input 
                    type="number" 
                    min="0" 
                    placeholder="Min tasks"
                    value={filters.taskCount.min ?? ''}
                    onChange={(e) => 
                    setFilters((prev) => ({
                        ...prev,
                        taskCount:{
                            ...prev.taskCount,
                            min: e.target.value ? Number(e.target.value) : null
                        }
                    }))
                }
                />
            </div>
            {/* Maximum 도 같은 모양, min 대신 max */}
        </div>
    </div>
</div>
```

| 코드 | 뜻 |
|---|---|
| `{...prev, search: e.target.value}` | 나머지는 그대로, `search` 만 바꾼다. 검색어는 빈 글자도 그대로 둔다(`""` 은 "모두 통과") |
| `dateRange: {...prev.dateRange, start: ...}` | 안쪽 객체도 펼쳐야 한다. `{start: ...}` 만 넣으면 `end` 가 사라진다 |
| `e.target.value \|\| null` | 날짜를 지우면 `""` → `null` |
| `e.target.value ? Number(e.target.value) : null` | 숫자 칸 값도 **글자**로 온다(`"3"`). 비었으면 `null`, 아니면 숫자로 바꾼다. `"0"` 은 빈 글자가 아니라서 `0` 이 저장된다 |
| `?? ''` | 값이 `null` 이면 빈칸으로 보여 준다 |

> **영상과 다른 점 — 입력칸에 `value` 를 달았다**
> 영상 코드는 `onChange` 만 있고 `value` 가 없다. 그러면 입력칸이 상태를 보여 주지 않아서 이런 일이 생긴다.
> - Clear Filters를 눌러도 칸에 예전 글자가 그대로 보인다(실제 필터는 풀린 상태).
> - shadcn(Radix) 팝업은 닫힐 때 안의 내용을 통째로 지운다. 그래서 다시 열면 칸은 비어 있는데 필터는 걸려 있다.
> - 메인 검색창과 팝업 검색칸이 같은 `search` 를 바꾸는데 서로의 글자를 보여 주지 않는다.
>
> (3)번의 마감일 칸처럼 `value` 를 달면 입력칸이 늘 상태를 그대로 보여 준다.

> **영상과 다른 점 — 검색칸 id**
> 메인 검색창도 `id="search"` 라서, 팝업이 열리면 같은 id가 두 개가 된다. 팝업 쪽을 `id="filter-search"` 로 바꾸고 `<Label htmlFor="filter-search">` 로 연결했다. 라벨을 눌러도 칸에 커서가 간다.

- **호출:** 칸에 입력 → `onChange` → `setFilters`
- **동작:** 입력한 값이 칸에 보인다. 보드 목록은 아직 그대로다(9번에서 거른다).

---

## 9. 제목 검색 — `filteredBoards`

**할 일:** 보드 목록을 원본 `boards` 대신 걸러낸 `filteredBoards` 로 그린다.

```tsx
const filteredBoards = boards.filter((board) => {
    // 전체 보드리스트 타이틀에서 filter로 검색한 문자가 있는지 검색해 
    const matchesSearch = board.title.toLowerCase().includes(filters.search.toLowerCase())
    return matchesSearch
})
```

```tsx
{/* {boards.map((board, key) => ( */}
{filteredBoards.map((board, key) => (
```

- `toLowerCase()` 를 양쪽에 붙여서 대소문자를 가리지 않는다. `"new"` 로 검색해도 `"New Board"` 가 나온다.
- 검색어가 빈 글자(`""`)면 `includes("")` 는 항상 `true` 라서 전부 나온다.
- **그리드 보기와 리스트 보기 두 군데 모두** `filteredBoards.map` 으로 바꾼다.

> **영상과 다른 점 — 리스트 보기도 바꿨다**
> 영상 코드는 그리드 보기만 `filteredBoards` 로 바꾸고 리스트 보기는 `boards.map` 그대로다. 그러면 List로 바꿨을 때 필터가 전혀 적용되지 않는다.

메인 화면 검색창도 같은 `search` 에 연결한다.

```tsx
{/* Search Bar */}
<div className="relative mb-4 sm:mb-6">
    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400"/>
    <Input 
        id="search" 
        placeholder="Search boards..." 
        className="pl-10"
        value={filters.search}
        onChange={(e) => 
            setFilters((prev) => ({...prev, search: e.target.value}))
        }
    />
</div>
```

걸러낸 결과가 0개일 때 안내 문구도 넣었다(영상에는 없다).

```tsx
{boards.length === 0 ? (
    <div> No boards yet</div>
) : filteredBoards.length === 0 ? (
    <div>No boards match your filters</div>
) : viewMode === "grid" ? (
```

- **호출:** 검색창에 입력 → `setFilters` → 다시 그림 → `filteredBoards` 다시 계산
- **동작:** 글자를 칠 때마다 제목에 그 글자가 든 보드만 남는다. 팝업 검색칸과 메인 검색창에 같은 글자가 보인다.

---

## 10. 만든 날짜로 거르기

**할 일:** 보드를 만든 시각(`created_at`)이 시작일~종료일 안에 있는 것만 남긴다.

```tsx
const matchesDateRange = 
    // ( 시작일이 없다  ||  만든 시각 >= 시작일 0시 )
    (!filters.dateRange.start || 
    new Date(board.created_at) >= new Date(filters.dateRange.start + "T00:00:00")) &&
    // ( 종료일이 없다  ||  만든 시각 <= 종료일 23:59:59 )
    (!filters.dateRange.end || 
    new Date(board.created_at) <= new Date(filters.dateRange.end + "T23:59:59.999"))

return matchesSearch && matchesDateRange
```

구조를 풀면 이렇다.

```
( 시작일이 없다  ||  만든 시각 >= 시작일 )   ← 시작일 검사 통과?
&&
( 종료일이 없다  ||  만든 시각 <= 종료일 )   ← 종료일 검사 통과?
```

- **괄호 하나 = 검사 하나.** "조건을 안 정했으면 그냥 통과, 정했으면 비교"다.
- `||` 는 앞이 참이면 뒤를 아예 실행하지 않는다. 시작일이 `null` 이면 `!null` 이 `true` 라서 뒤의 비교는 실행되지 않는다.
- `&&` 는 두 검사를 모두 통과해야 `true` 다.

> **영상과 다른 점 — 날짜 뒤에 시간을 붙였다**
> 영상 코드는 `new Date(filters.dateRange.start)` 처럼 날짜만 넣는다. JavaScript는 `"2026-11-12"` 처럼 **날짜만 있는 글자를 UTC(세계 표준시) 자정**으로 읽는다. 한국 시간은 UTC보다 9시간 빠르므로 **그날 오전 9시**다. 그런데 카드에 보이는 날짜(`toLocaleDateString()`)는 한국 시간이라 둘이 어긋난다.
>
> | 고른 날짜 | 11/12 오전 8시에 만든 보드 | 11/12 오후 3시에 만든 보드 |
> |---|---|---|
> | 시작일 = 11/12 | 빠짐 ✗ | 남음 |
> | 종료일 = 11/12 | 남음 | 빠짐 ✗ |
> | 시작일 = 종료일 = 11/12 | 빠짐 ✗ | 빠짐 ✗ (아무것도 안 나옴) |
>
> `"2026-11-12T00:00:00"` 처럼 **시간까지 붙이면 내 컴퓨터 시간**으로 읽는다. 그래서 시작일은 그날 0시, 종료일은 그날 23:59:59.999로 비교하게 바꿨다. 이제 시작일과 종료일을 같은 날로 고르면 그날 만든 보드가 모두 나온다.

- **호출:** 날짜 선택 → `setFilters` → 다시 그림 → `filteredBoards` 다시 계산
- **동작:** 고른 기간에 만든 보드만 남는다.

---

## 11. Clear Filters와 Apply Filters

```tsx
function clearFilters(){
    setFilters({
        search:"",
        dateRange: {
            start: null as string | null,
            end: null as string | null
        },
        taskCount:{
            min: null as number | null,
            max: null as number | null
        }
    })
}
```

```tsx
<Button variant="outline" onClick={clearFilters}>Clear Filters</Button>
<Button onClick={()=>setIsFilterOpen(false)}>Apply Filters</Button>
```

- **Apply Filters는 적용 버튼이 아니라 닫기 버튼이다.** 필터는 칸에 입력하는 순간 이미 적용된다. X·ESC·바깥 클릭으로 닫아도 필터는 그대로 남는다.
- 8번에서 `value` 를 달았기 때문에 Clear Filters를 누르면 칸도 같이 비워진다.

---

## 12. 태스크 수로 거르기 — 영상에 없어서 직접 만들었다

팝업에 Task Count(최소·최대) 칸은 있지만, 영상 코드는 이렇게 끝난다.

```tsx
const boardsWithTaskCount = boards.map((board: Board) => ({
    ...board,
    taskCount: 0, // This would need to be calculated from actual data
}))
```

영상은 이 `boardsWithTaskCount` 를 `boardsWithTaskCount.filter((board: Board) => { ... })` 로 거르고, 그래서 맨 위에 `import { Board } from "@/lib/supabase/models";` 도 넣는다. 나도 처음에는 영상대로 썼다가 12-4에서 바꿨다. 9번 코드는 바꾼 뒤의 모양이다.

보드마다 태스크 수를 넣을 **자리만** 만들고 값은 항상 0이다(boards 테이블에는 태스크 수가 없다). 게다가 영상의 `filteredBoards` 는 `return matchesSearch && matchesDateRange` 로 끝나서 `taskCount` 를 **아예 비교하지 않는다.** 그래서 Min·Max를 넣어도 아무 일이 없다. (비교 코드만 넣었다면 값이 늘 0이라서 Minimum에 1을 넣는 순간 보드가 전부 사라졌을 것이다.) 이번에 실제 개수를 불러오고(12-1~12-3), 비교하는 코드 `matchesTaskCount` 도 직접 넣었다(12-4).

### 원리

```
boards ─< columns ─< tasks
select("*, columns(tasks(count))")
→ { ...보드, columns: [ {tasks:[{count:2}]}, {tasks:[{count:0}]}, ... ] }
→ 2 + 0 + ... = taskCount
```

보드를 불러올 때 Supabase에 "컬럼별 태스크 **개수**도 같이 달라"고 요청하고, 그 개수를 더한다.

- `tasks(count)` 는 **괄호 없이** 쓴다. `tasks(count())` 처럼 괄호를 붙이면 집계 함수로 읽는데, Supabase는 집계 함수가 기본으로 꺼져 있어서 `PGRST123: Use of aggregate functions is not allowed` 로 막힌다. 괄호 없는 `count` 는 예전부터 있던 방식이라 꺼져 있어도 동작한다.
- 태스크가 없는 컬럼은 `[{count: 0}]`, 컬럼이 없는 보드는 `columns: []` 로 온다.
- RLS가 그대로 적용되어 **내 보드의 태스크만** 세진다. 정책은 (4)편과 (11)편에서 `requesting_user_id()` 로 맞춰 두었다.

### 12-1. 타입 추가 — `lib/supabase/models.ts`

```ts
export type BoardWithTaskCount = Board & {
    taskCount: number
}
```

`ColumnWithTasks` 와 같은 방식이다. "보드 + 태스크 수"라는 뜻이다.

### 12-2. 보드 불러올 때 개수도 받기 — `lib/services.ts`

```ts
import { Board, BoardWithTaskCount, Column, Task } from "./supabase/models";
```

```ts
async getBoards(supabase: SupabaseClient,
    userId: string
) : Promise<BoardWithTaskCount[]>{
    const {data, error} = await supabase
    .from("boards")
    .select("*, columns(tasks(count))")
    .eq("user_id", userId)
    .order("created_at", { ascending: false})

    if(error) throw error
    
    return (data || []).map(({columns, ...board}) => ({
        ...board,
        taskCount: columns.reduce(
            (sum: number, column: {tasks: {count:number}[]}) => 
                sum + (column.tasks[0]?.count ?? 0), 0
        )
    }))
},
```

| 코드 | 뜻 |
|---|---|
| `Promise<BoardWithTaskCount[]>` | 이제 "태스크 수가 있는 보드" 목록을 돌려준다 |
| `({columns, ...board})` | `columns` 는 꺼내서 개수 세는 데만 쓰고, 나머지 보드 값만 `board` 에 남긴다. 그래서 화면 상태에 컬럼 목록이 섞이지 않는다 |
| `columns.reduce(..., 0)` | 0부터 시작해서 컬럼마다 태스크 수를 더한다 |
| `column.tasks[0]?.count ?? 0` | 각 컬럼의 `[{count: n}]` 에서 `n` 을 꺼낸다. 혹시 없으면 0 |

- `(sum: number, column: {...})` 타입 표시는 **꼭 써야 한다.** 빼면 `TS7006: Parameter 'sum' implicitly has an 'any' type` 에러가 난다.
- 반대로 이 프로젝트는 DB 타입 없이 `SupabaseClient` 를 써서, `data` 가 `any[]`(각 줄이 `any`)로 온다. 그래서 `columns` 도 `any` 라 이 함수 안의 오타(`rreduce` 같은)는 TypeScript가 못 잡는다(아래 13-2).

### 12-3. 훅의 상태 타입 — `lib/hooks/useBoards.ts`

```ts
import { Board, BoardWithTaskCount, Column, ColumnWithTasks, Task } from "../supabase/models";
```

```ts
// const [boards, setBoards] = useState<Board[]>([])
const [boards, setBoards] = useState<BoardWithTaskCount[]>([])
```

새 보드를 만들 때도 `taskCount` 를 붙인다. 새 보드는 빈 컬럼 4개만 있으니 0이다.

```ts
// setBoards((prev) => [newBoard, ...prev])
setBoards((prev) => [{...newBoard, taskCount: 0}, ...prev])
```

이번에 `useBoards.ts` 맨 위에 남아 있던, 쓰지 않는 `import { describe } from "node:test";` 도 지웠다((9)편부터 '남은 것'에 적어 둔 줄).

### 12-4. 대시보드에서 거르기 — `app/dashboard/page.tsx`

영상대로 만든 `boardsWithTaskCount` 는 **지우거나 주석으로 막고**, 9번처럼 `boards` 를 바로 거른다.

```tsx
// const filteredBoards = boardsWithTaskCount.filter((board: Board) => {
const filteredBoards = boards.filter((board) => {
```

- `boardsWithTaskCount` 를 남겨 두면 서비스에서 받아 온 진짜 숫자를 `taskCount: 0` 이 다시 덮어쓴다.
- `(board: Board)` 의 `: Board` 도 빼야 한다. 그대로 두면 `board.taskCount` 에서 `TS2339: Property 'taskCount' does not exist on type 'Board'` 에러가 난다. 빼면 `boards` 의 타입(`BoardWithTaskCount`)을 그대로 따라간다.

```tsx
const matchesTaskCount = 
    // ( 최소가 없다  ||  태스크 수 >= 최소 )
    (filters.taskCount.min === null || 
    board.taskCount >= filters.taskCount.min) &&
    // ( 최대가 없다  ||  태스크 수 <= 최대 )
    (filters.taskCount.max === null || 
    board.taskCount <= filters.taskCount.max)

return matchesSearch && matchesDateRange && matchesTaskCount
```

**날짜와 달리 `!` 가 아니라 `=== null` 로 비교한다.** 숫자 칸에 `0` 을 넣으면 `0` 이 저장되는데, `!0` 은 `true` 다. `!filters.taskCount.max` 로 쓰면 Maximum에 0을 넣었을 때 "조건 없음"으로 처리돼서, "태스크 0개인 보드만" 대신 전체가 나온다.

- **호출:** 대시보드가 열릴 때 `useBoards` → `loadBoards` → `boardService.getBoards` → Supabase에 `GET /rest/v1/boards?select=*,columns(tasks(count))...` → 개수를 더해 `setBoards`
- **동작:** Minimum에 1을 넣으면 빈 보드가 사라지고, Maximum에 0을 넣으면 빈 보드만 남는다. 보드에 들어가 태스크를 추가하고 대시보드로 돌아오면 대시보드가 보드를 새로 불러오므로, Min·Max 필터도 바로 새 태스크 수로 거른다. 태스크 수가 화면에 숫자로 보이지는 않는다(필터 안에서만 쓴다).

---

## 13. 막혔던 것

### 13-1. 날짜를 골랐는데 보드 목록이 그대로다

날짜를 골라도 화면이 그대로라서 `filteredBoards` 바로 아래에 잠깐 로그를 찍었다.

```tsx
console.log(filters.dateRange, filteredBoards.length, '/', boards.length)
```

```
{start: '2026-11-01', end: null}  9 '/' 9
```

- 시작일은 잘 들어갔고, **보드 9개가 모두 11월 1일 이후에 만들어져서** 하나도 걸러지지 않은 것이었다. 필터는 정상이었다.
- 일부만 걸러지는 날짜(가장 최근 카드의 날짜 등)를 골라야 변화가 보인다.
- 이걸 확인하다가 10번의 오전 9시 문제를 찾았다.
- 화면이 안 바뀌어 보이는 다른 이유도 있었다. 팝업 배경이 흐리게 가려서(`backdrop-blur`) 뒤가 잘 안 보였고, 리스트 보기는 아직 `boards.map` 이었다(9번).

### 13-2. 태스크 수를 넣었더니 보드를 아예 못 불러온다 — 고친 것 세 개

`getBoards` 를 고친 뒤 대시보드에 에러 화면이 떴다. 에러 화면을 만든 것은 앞의 두 개(테이블 이름 오타, `rreduce`)다. 세 번째(반환 타입)는 실행에는 영향이 없고 `npx tsc --noEmit` 에서만 잡힌 타입 에러다. 개발 서버(`npm run dev`)는 타입을 검사하지 않고, 타입을 지운 뒤 실행하기 때문이다.

| 잘못 쓴 것 | 결과 | 고친 것 |
|---|---|---|
| `.select("*, column(task(count))")` | `PGRST200: Searched for a foreign key relationship between 'boards' and 'column' ... no matches were found.` (hint: `Perhaps you meant 'columns' instead of 'column'.`) | 테이블 이름은 복수형 `columns(tasks(count))` |
| `columns.rreduce(...)` | `data` 의 각 줄이 `any` 라서(`columns` 도 `any`) tsc가 못 잡는다. 위 오타를 고치면 `columns.rreduce is not a function` 으로 멈춘다 | `reduce` |
| 반환 타입 `Promise<Board[]>` 그대로 | `useBoards.ts: error TS2345: Argument of type 'Board[]' is not assignable to parameter of type 'SetStateAction<BoardWithTaskCount[]>'` | `Promise<BoardWithTaskCount[]>` |

- 이 프로젝트는 `SupabaseClient` 에 DB 타입을 알려 주지 않아서((12)편 6-4) `select` 안의 글자도 TypeScript가 검사하지 못한다. 그래서 테이블 이름이 틀리면 **실행해서 Supabase가 돌려주는 에러**로만 알 수 있다. 다행히 hint가 맞는 이름을 알려 준다. (DB 타입을 만들어 `SupabaseClient<Database>` 로 쓰면 supabase-js가 select 글자를 읽어서, `column` 처럼 없는 관계를 타입 에러로 알려 준다.)
- `loadBoards` 의 `catch` 가 에러를 받아 `setError` 로 넘기니, 대시보드에는 에러 문구만 보인다. 자세한 원인은 Network 탭이나 콘솔에서 본다.

### 13-3. 작은 오타

- 팝업의 `space-t-y-2` (세 곳): 없는 클래스라 CSS가 하나도 안 만들어져서 라벨과 칸이 붙어 있었다. `space-y-2` 로 고쳤다.
- 변수 이름 `matchesDataRange` → `matchesDateRange` (Data가 아니라 Date).

---

## 14. 아직 남은 것

| 항목 | 지금 상태 |
|---|---|
| 담당자(assignee) 필터 | 상태와 `clearFilters` 에만 있고, 고르는 칸도 거르는 코드도 없다. (8)편에서 주석으로 막아 둔 Assignee 칸은 이번에 지웠다. `filterCount` 에는 포함되지만 늘 0이다(영상도 같다) |
| 마감일 없는 카드 | 마감일 필터를 걸어도 계속 보인다(6번). 숨기려면 `if(filters.dueDate && task.due_date !== filters.dueDate) return false` |
| 필터를 켠 채 Add Task | 예를 들어 High만 켜 두고 기본값 Medium 카드를 만들면 걸러져서 안 보인다. 배지 숫자도 그대로라 추가가 안 된 것처럼 보인다(Total Tasks만 1 늘어난다) |
| 대시보드 통계 카드 | Total Boards 등은 원본 `boards` 기준이라 필터와 상관없이 그대로다 |
| 쓰지 않는 import | 영상을 따라 넣은 `app/dashboard/page.tsx` 의 `import { Board }` 는 `boardsWithTaskCount` 를 막은 뒤로 쓰이지 않아서 ESLint 경고(`'Board' is defined but never used`)가 난다. 지워도 된다 |
| 괄호 없는 `count` | PostgREST 문서는 예전 방식이라 나중에 없어질 수 있다고 적고 있다. 그때는 Supabase에서 집계 함수를 켜고 `count()` 로 바꿔야 한다 |
| 작은 것 | 주석 오타 `proirity`(보드 상세 6번 주석), 우선순위 버튼 `key={key}`(순서가 바뀌지 않는 고정 배열이라 동작 문제는 없다), 팝업 `Label` 대부분에 `htmlFor` 없음. 대시보드 팝업의 `<div className="text-xs">` 는 효과가 없다(shadcn `Label` 에 `text-sm` 이 직접 붙어 있어서). 영상처럼 `<Label className="text-xs">` 로 주면 작게 보인다 |
| (12)편에서 남긴 것 | 지난 주석 `// 영상에서 컬럼 수정 함수 만들면 교체`, 팝업 너비(shadcn의 `sm:max-w-sm` 때문에 넓은 화면에서 384px. 이번 대시보드 Filter 팝업도 같다), 두 컬럼 팝업의 입력칸 id `columnsTitle` 중복, `createColumn` 의 `throw` 가 `try` 밖에 있음, 실패해도 팝업이 닫힘, 컬럼 지우기·순서 바꾸기 |
| (11)편에서 남긴 것 | 다른 컬럼의 같은 순번 카드 위에 놓기, 컬럼·카드 id 겹침, 같은 컬럼 안 순서 저장, 휴대폰에서 끌기, 카드 코드 중복 |
| (10)편 이전에 남긴 것 | 컬럼별 Add Task가 항상 첫 컬럼에 들어감, Add Task 팝업 `Label` 의 `htmlFor` 없음, `min-2-0`·`ms:py-6` 오타, `"No descriptiom"`, `/dashboard` 로그인 보호. (`node:test` import는 이번에 지웠고, `onCreateTask`·`handleCreateTask` 의 `any` 는 배포 빌드 에러 때문에 `React.SubmitEvent<HTMLFormElement>` 로 바꿨다) |

---

## 15. 결과

**보드 상세 페이지**

- 헤더의 Filter를 누르면 Filter Tasks 팝업이 뜬다.
- Low·Medium·High를 누르면 버튼 색이 바뀌고, 고른 우선순위의 카드만 남는다. 컬럼 배지 숫자도 걸러진 개수로 바뀐다.
- 마감일을 고르면 그날이 마감인 카드(와 마감일이 없는 카드)만 남는다.
- 헤더 Filter 버튼 옆 숫자가 고른 조건 수로 바뀌고, Clear Filters를 누르면 전부 풀린다.

**대시보드**

- 메인 검색창이나 팝업 Search에 글자를 치면 제목에 그 글자가 든 보드만 남는다. 두 칸에 같은 글자가 보인다.
- 시작일·종료일을 고르면 그 기간(한국 시간 기준)에 만든 보드만 남는다.
- Minimum·Maximum에 숫자를 넣으면 태스크 수가 그 범위인 보드만 남는다.
- 조건에 맞는 보드가 없으면 "No boards match your filters" 가 보인다. 그리드와 리스트 보기 모두 같다.
- Clear Filters를 누르면 칸이 모두 비워지고 전체 보드가 다시 나온다.

---

## 태그

**전체:** `Next.js`, `Next.js 15`, `React`, `TypeScript`, `Supabase`, `PostgREST`, `shadcn/ui`, `Dialog`, `useState`, `제어 컴포넌트`, `필터`, `filter`, `map`, `reduce`, `파생값`, `불변성`, `Date`, `시간대`, `UTC`, `count`, `RLS`, `PGRST200`, `PGRST123`, `TS2339`, `트렐로 클론`, `클론 코딩`, `토이 프로젝트`

**10개 이내:** `Next.js`, `React`, `TypeScript`, `Supabase`, `필터`, `useState`, `제어 컴포넌트`, `PostgREST`, `트렐로 클론`, `클론 코딩`
