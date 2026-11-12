# 코드 흐름 정리 — 로그인부터 필터까지

"사용자가 무엇을 누르면 → 어떤 파일의 어떤 함수가 실행되고 → 그다음 무엇을 부르는지"를 순서대로 따라간 기록이다.

- 기준: 2026-11-12, 커밋 `72206c7` (13편 필터까지)
- 확인 방법: 코드를 읽고 설치된 라이브러리 소스(`node_modules`)와 대조했다. 브라우저에서 실행해 확인한 것은 아니다.
- 줄 번호는 위 커밋 기준이다. 코드를 고치면 달라질 수 있다.

## 전체 지도

| 단계 | 사용자가 하는 일 | Supabase 요청 |
|---|---|---|
| 1 | 사이트 열기 | 없음 |
| 2 | Sign in 클릭 | 없음 |
| 3 | 로그인하고 돌아옴 | 없음 (클라이언트만 만듦) |
| 4 | Go to Dashboard | 조회 1번 |
| 5 | Create Board | 저장 5번 (보드 1 + 컬럼 4) |
| 6 | 보드 카드 클릭 | 조회 3번 |
| 7 | 보드 제목·색 수정 | 수정 1번 |
| 8 | Add Task | 저장 1번 |
| 9 | 카드를 끌어 옮기기 | 다른 컬럼에 놓을 때 수정 1번 |
| 10 | 컬럼 추가 | 저장 1번 |
| 11 | 컬럼 이름 바꾸기 | 수정 1번 |
| 12 | 태스크 필터 (보드 상세) | 없음 |
| 13 | 보드 필터 (대시보드) | 없음 |

Supabase 요청은 전부 브라우저에서 바로 나간다. 보내기 직전마다 [SupabaseProvider.tsx:41](../lib/supabase/SupabaseProvider.tsx#L41)이 Clerk 토큰(로그인 증명서)을 받아 요청 헤더에 붙인다.

> 개발 서버(`npm run dev`)에서는 React Strict Mode 때문에 화면이 처음 뜰 때 `useEffect`가 두 번 실행된다. 그래서 Network 탭에는 조회 요청이 표의 숫자보다 두 배로 보일 수 있다.

## 1. 사이트 열기 (로그아웃 상태)

1. [middleware.ts:3](../middleware.ts#L3) `clerkMiddleware()` — 쿠키로 로그인 여부만 판별한다. 아무도 막지 않는다.
2. [layout.tsx:28](../app/layout.tsx#L28) `<ClerkProvider>` → [layout.tsx:33](../app/layout.tsx#L33) `<SupabaseProvider>`가 앱을 감싼다.
3. [SupabaseProvider.tsx:51](../lib/supabase/SupabaseProvider.tsx#L51) — Clerk 확인이 끝날 때까지 화면 전체가 "Loading..."이다. 서버가 보내는 첫 HTML에도 이것만 들어 있다.
4. Clerk 로딩이 끝나면 [SupabaseProvider.tsx:20](../lib/supabase/SupabaseProvider.tsx#L20) `useSession()`이 `session: null`을 준다. [31행](../lib/supabase/SupabaseProvider.tsx#L31) 분기에서 `supabase = null`, `isLoaded = true`가 된다.
5. 이제야 [page.tsx](../app/page.tsx) → [navbar.tsx:20](../components/navbar.tsx#L20) `useUser()`가 실행되고, `isSignedIn`이 false라 [126행](../components/navbar.tsx#L126) Sign in 버튼이 보인다.

## 2. Sign in 클릭

우리 코드에는 `onClick`이 없다. [navbar.tsx:126](../components/navbar.tsx#L126)의 `<SignInButton>`이 안쪽 버튼에 클릭 처리를 끼워 넣는다. `mode`를 안 줬기 때문에 팝업이 아니라 Clerk 로그인 페이지로 이동하고, 여기서 우리 앱을 떠난다.

## 3. 로그인하고 돌아옴

페이지를 처음부터 다시 불러온다. 이전 화면이 다시 그려지는 것이 아니라 앱이 새로 시작한다.

1. 미들웨어 통과 → 다시 "Loading..."
2. [SupabaseProvider.tsx:20](../lib/supabase/SupabaseProvider.tsx#L20) `useSession()`에 `session`이 생긴다. 의존성이 `[session]`([47행](../lib/supabase/SupabaseProvider.tsx#L47))이라 [24행](../lib/supabase/SupabaseProvider.tsx#L24) `useEffect`가 다시 돈다.
3. [37행](../lib/supabase/SupabaseProvider.tsx#L37) `createClient(...)` — 여기서 Supabase 클라이언트가 만들어진다. [41행](../lib/supabase/SupabaseProvider.tsx#L41) `accessToken`에 "요청마다 Clerk 토큰 받아오기"를 등록한다.
4. [45~46행](../lib/supabase/SupabaseProvider.tsx#L45) `setSupabase`, `setIsLoaded(true)` → 화면이 열린다.
5. [navbar.tsx:20](../components/navbar.tsx#L20) `useUser()`가 처음부터 로그인 값(`isSignedIn: true`, `user`)을 받는다. [117행](../components/navbar.tsx#L117) "Welcome", [120행](../components/navbar.tsx#L120) "Go to Dashboard"가 보인다.

`useUser()`는 Clerk에서만 값을 읽는다. Supabase와 이어지는 건 두 가지뿐이다.

- 41행의 토큰: Supabase 요청마다 Clerk 토큰을 붙인다.
- `user.id` 글자: 쿼리 조건이나 저장 값으로 그냥 넘긴다.

## 4. 대시보드: 보드 목록

1. [navbar.tsx:120](../components/navbar.tsx#L120) `<Link href="/dashboard">` — 화면만 바뀌고 Supabase 클라이언트는 그대로 남는다.
2. [dashboard/page.tsx:24](../app/dashboard/page.tsx#L24) `useBoards()`
3. [useBoards.ts:14~15](../lib/hooks/useBoards.ts#L14) `useUser()`, `useSupabase()`로 유저와 클라이언트를 꺼낸다.
4. [useBoards.ts:21](../lib/hooks/useBoards.ts#L21) `useEffect` → `user`가 있으면 [27행](../lib/hooks/useBoards.ts#L27) `loadBoards()`
5. [useBoards.ts:33](../lib/hooks/useBoards.ts#L33) `boardService.getBoards(supabase, user.id)`
6. [services.ts:25](../lib/services.ts#L25) — `boards` 테이블에서 `user_id`가 내 ID인 줄을 최신순으로 가져온다. 같은 요청에 `columns(tasks(count))`를 붙여([27행](../lib/services.ts#L27)) 컬럼마다 태스크 수도 함께 받고, 보드별로 더해 `taskCount`를 붙여서 돌려준다([33행](../lib/services.ts#L33)). 요청은 그대로 1번이다.
7. [useBoards.ts:34](../lib/hooks/useBoards.ts#L34) `setBoards(data)` → [dashboard/page.tsx:102](../app/dashboard/page.tsx#L102) 본 화면(통계, 보드 카드)이 그려진다.

## 5. 보드 만들기

1. 버튼([222행](../app/dashboard/page.tsx#L222)) → [dashboard/page.tsx:86](../app/dashboard/page.tsx#L86) `handleCreateBoard` → `createBoard({title: "New Board"})`
2. [useBoards.ts:42](../lib/hooks/useBoards.ts#L42) `createBoard` → [50행](../lib/hooks/useBoards.ts#L50) `boardDataService.createBoardWithDefaultColumns`
3. [services.ts:209](../lib/services.ts#L209) `boardService.createBoard` → [48행](../lib/services.ts#L48) `boards`에 한 줄 저장 (`title`, `description: null`, `color: "bg-blue-500"`, `user_id`)
4. [services.ts:226](../lib/services.ts#L226) `Promise.all` → `columnService.createColumn`을 4번 동시에 (To Do, In Progress, Review, Done)
5. [useBoards.ts:58](../lib/hooks/useBoards.ts#L58) `setBoards` — 새 보드에 `taskCount: 0`을 붙여 목록 맨 앞에 끼워 넣는다.

## 6. 보드 상세 불러오기

1. [dashboard/page.tsx:254](../app/dashboard/page.tsx#L254) 카드의 `<Link>` → `/boards/<id>`
2. [boards/page.tsx:255](../app/boards/[id]/page.tsx#L255) `useParams()` → [256행](../app/boards/[id]/page.tsx#L256) `useBoard(id)`
3. [useBoards.ts:75](../lib/hooks/useBoards.ts#L75) `useEffect` → [81행](../lib/hooks/useBoards.ts#L81) `loadBoard()` → [87행](../lib/hooks/useBoards.ts#L87) `boardDataService.getBoardWithColumns`
4. [services.ts:178](../lib/services.ts#L178) `Promise.all` — [getBoard](../lib/services.ts#L8)와 [getColumns](../lib/services.ts#L76)를 동시에 보낸다.
5. 둘 다 끝나면 [services.ts:185](../lib/services.ts#L185) → [getTasksByBoard](../lib/services.ts#L122). `tasks`에는 `board_id`가 없어서 `columns`를 조인해 이 보드 것만 거른다.
6. [services.ts:187](../lib/services.ts#L187) — 태스크를 컬럼별로 나눈다. 이건 브라우저에서 하는 일이다.
7. [useBoards.ts:88~89](../lib/hooks/useBoards.ts#L88) `setBoard`, `setColumns`
8. [boards/page.tsx:504](../app/boards/[id]/page.tsx#L504) `<Navbar>`(제목), [734행](../app/boards/[id]/page.tsx#L734) `<DroppableColumn>`, [747행](../app/boards/[id]/page.tsx#L747) `<SortableTask>`가 그려진다.

## 7. 보드 수정

1. [navbar.tsx:68](../components/navbar.tsx#L68) "..." 버튼 → [boards/page.tsx:506](../app/boards/[id]/page.tsx#L506) `onEditBoard` — 현재 제목·색을 폼용 state에 복사하고 Dialog를 연다.
2. Save Changes → [307행](../app/boards/[id]/page.tsx#L307) `handleUpdateBoard` → [313행](../app/boards/[id]/page.tsx#L313) `updateBoard(board.id, {title, color})`
3. [useBoards.ts:97](../lib/hooks/useBoards.ts#L97) `updateBoard` → [services.ts:57](../lib/services.ts#L57) `boardService.updateBoard` ([64행](../lib/services.ts#L64)에서 `updated_at`을 더해 수정)
4. [useBoards.ts:104](../lib/hooks/useBoards.ts#L104) `setBoard` → [boards/page.tsx:317](../app/boards/[id]/page.tsx#L317) Dialog 닫기 → Navbar 제목이 바뀐다.

## 8. 태스크 추가

1. [boards/page.tsx:653](../app/boards/[id]/page.tsx#L653) Add Task 버튼 — [652행](../app/boards/[id]/page.tsx#L652) `<DialogTrigger>`가 Dialog를 연다. 보드 수정 Dialog와 달리 페이지 state를 쓰지 않는다.
2. [713행](../app/boards/[id]/page.tsx#L713) Create Task → [665행](../app/boards/[id]/page.tsx#L665) `onSubmit` → [338행](../app/boards/[id]/page.tsx#L338) `handleCreateTask`
3. [340행](../app/boards/[id]/page.tsx#L340) `new FormData(...)`로 입력값을 읽어 [341행](../app/boards/[id]/page.tsx#L341) `taskData`를 만든다.
4. 제목이 있으면 [350행](../app/boards/[id]/page.tsx#L350) `createTask(taskData)`
5. [323행](../app/boards/[id]/page.tsx#L323) `createTask` — [330행](../app/boards/[id]/page.tsx#L330) `columns[0]`, 즉 항상 첫 컬럼(이름을 바꾸지 않았다면 To Do)을 고른다. → [335행](../app/boards/[id]/page.tsx#L335) `createRealTask(컬럼 id, taskData)`
6. [useBoards.ts:112](../lib/hooks/useBoards.ts#L112) `createRealTask` — [124~130행](../lib/hooks/useBoards.ts#L124)에서 DB 모양으로 바꾼다(`dueDate` → `due_date`, `sort_order`는 그 컬럼의 현재 태스크 수).
7. [useBoards.ts:123](../lib/hooks/useBoards.ts#L123) → [services.ts:139](../lib/services.ts#L139) `taskService.createTask` — `tasks`에 저장하고 저장된 줄을 돌려받는다.
8. [useBoards.ts:133](../lib/hooks/useBoards.ts#L133) `setColumns` — 그 컬럼의 `tasks` 끝에 새 태스크를 붙인다. 다시 불러오지는 않는다.
9. [boards/page.tsx:352~353](../app/boards/[id]/page.tsx#L352) — 열려 있는 Add Task 버튼을 찾아 한 번 더 클릭해서 Dialog를 닫는다.
10. 다시 그려지면서 [747행](../app/boards/[id]/page.tsx#L747) `<SortableTask>`로 새 카드가 나오고 [646행](../app/boards/[id]/page.tsx#L646) Total Tasks가 1 늘어난다. 필터가 켜져 있고 새 태스크가 조건에 맞지 않으면 카드는 보이지 않고 Total Tasks만 늘어난다(카드는 `filteredColumns`로, Total Tasks는 `columns`로 그리기 때문이다).

컬럼 안에도 Add Task 버튼([boards/page.tsx:61](../app/boards/[id]/page.tsx#L61))과 같은 모양의 Dialog가 있다. 여기서 Create Task([121행](../app/boards/[id]/page.tsx#L121))를 누르면 form의 `onSubmit={onCreateTask}`([73행](../app/boards/[id]/page.tsx#L73))가 실행되는데, 페이지가 `onCreateTask` 자리에 `handleCreateTask`를 넘겨 주기 때문에([738행](../app/boards/[id]/page.tsx#L738)) 3번부터는 위와 똑같다. 그래서 5번의 `columns[0]` 때문에 어느 컬럼의 버튼을 눌러도 새 태스크는 첫 컬럼(이름을 바꾸지 않았다면 To Do)에 들어간다.

## 9. 드래그로 카드 옮기기

드래그는 `@dnd-kit` 라이브러리가 맡는다. 우리 코드는 "무엇을 끌 수 있고 어디에 놓을 수 있는지" 등록하고, 드래그의 세 순간(시작, 끄는 중, 놓기)에 불리는 함수를 넘겨 준다. 단계별 코드 설명과 막혔던 에러는 [11편 글](post-11-drag-and-drop.md)에 있다.

### 준비: 화면이 그려질 때 등록되는 것

| 코드 | 위치 | 역할 |
|---|---|---|
| `useSensors(PointerSensor)` | [boards/page.tsx:279](../app/boards/[id]/page.tsx#L279) | 카드를 누른 채 8px 넘게 움직여야 드래그로 본다([282행](../app/boards/[id]/page.tsx#L282)). 그냥 클릭은 드래그가 아니다. |
| `<DndContext>` | [721행](../app/boards/[id]/page.tsx#L721) | 드래그 판. 우리 함수 3개를 연결한다([724~726행](../app/boards/[id]/page.tsx#L724)). |
| `useDroppable({id: column.id})` | [34행](../app/boards/[id]/page.tsx#L34) | 컬럼을 "놓을 수 있는 곳"으로 등록한다. |
| `useSortable({id: task.id})` | [141행](../app/boards/[id]/page.tsx#L141) | 카드를 "끌 수 있는 것"이면서 "놓을 수 있는 곳"으로 등록한다. |
| `<SortableContext>` | [741행](../app/boards/[id]/page.tsx#L741) | 한 컬럼의 카드 순서를 dnd-kit에 알려 준다. |
| `<DragOverlay>` | [764행](../app/boards/[id]/page.tsx#L764) | 끄는 동안 포인터를 따라다니는 복사본이 그려지는 자리. |

### 끌기 시작

1. 카드를 누르고 8px 넘게 움직이면 dnd-kit이 [357행](../app/boards/[id]/page.tsx#L357) `handleDragStart`를 부른다.
2. [364행](../app/boards/[id]/page.tsx#L364) `setActiveTask(task)` — 끄는 카드를 기억한다.
3. [765행](../app/boards/[id]/page.tsx#L765) `<TaskOverlay>`가 복사본을 그리고, 원래 카드는 반투명해진다([146행](../app/boards/[id]/page.tsx#L146)).

### 끄는 중

dnd-kit은 복사본과 가장 많이 겹친 카드나 컬럼을 `over`로 정한다. 마우스 위치가 아니라 복사본 사각형이 기준이다. `over`가 바뀔 때마다 [368행](../app/boards/[id]/page.tsx#L368) `handleDragOver`가 불린다.

- **같은 컬럼의 다른 카드 위:** [385행](../app/boards/[id]/page.tsx#L385) 분기로 들어가 [390행](../app/boards/[id]/page.tsx#L390) `setColumns`로 화면 순서만 바꾼다. Supabase 요청은 없다.
- **다른 컬럼 위:** 아무것도 바꾸지 않는다. `over`가 컬럼 자체면 [383행](../app/boards/[id]/page.tsx#L383)에서 끝나고, 그 컬럼의 카드면 385행 분기에 들어가지 못하고 끝난다. `over`가 컬럼 자체일 때는 그 컬럼이 파랗게 강조된다([37행](../app/boards/[id]/page.tsx#L37)).

### 놓기

1. [408행](../app/boards/[id]/page.tsx#L408) `handleDragEnd` — `over`가 없으면(컬럼 밖) 바로 끝난다([410행](../app/boards/[id]/page.tsx#L410)).
2. `over`가 컬럼이면([415행](../app/boards/[id]/page.tsx#L415)): 다른 컬럼일 때만([421행](../app/boards/[id]/page.tsx#L421)) [422행](../app/boards/[id]/page.tsx#L422) `moveTask(카드 id, 컬럼 id, 그 컬럼의 카드 수)`를 부른다. 맨 끝으로 보낸다는 뜻이다.
3. `over`가 카드면: 끄는 카드의 순번([434행](../app/boards/[id]/page.tsx#L434))과 그 카드의 순번([435행](../app/boards/[id]/page.tsx#L435))이 다를 때만([437행](../app/boards/[id]/page.tsx#L437)) [438행](../app/boards/[id]/page.tsx#L438) `moveTask(카드 id, 그 카드의 컬럼 id, 그 카드의 순번)`을 부른다.
4. [useBoards.ts:143](../lib/hooks/useBoards.ts#L143) `moveTask` → [149행](../lib/hooks/useBoards.ts#L149)에서 `taskService.moveTask`를 기다린다.
5. [services.ts:154](../lib/services.ts#L154) `taskService.moveTask` — `tasks`에서 그 카드 한 줄의 `column_id`, `sort_order`만 고친다([162행](../lib/services.ts#L162)). 저장된 줄을 돌려받지는 않는다.
6. 저장이 끝나면 [useBoards.ts:151](../lib/hooks/useBoards.ts#L151) `setColumns` — 카드를 원래 컬럼에서 빼서 새 컬럼의 그 순번에 끼운다.
7. 다시 그려지면서 카드가 새 컬럼에 나타나고 컬럼 배지 숫자가 바뀐다.

화면은 저장이 끝난 뒤에야 바뀐다. 그래서 복사본이 원래 자리로 돌아갔다가, 응답이 온 뒤 카드가 새 자리에 나타나는 순서로 보일 수 있다.

### 어디에 놓느냐에 따른 결과

| 놓는 곳 | Supabase 요청 | 놓은 직후 화면 | 새로고침 후 |
|---|---|---|---|
| 같은 컬럼 안 (순서 바꾸기) | 없음 | 순서가 바뀐다 | 원래 순서로 돌아간다 |
| 다른 컬럼의 빈 곳, 빈 컬럼 | 수정 1번 | 그 컬럼 맨 끝에 들어간다 | 그대로 |
| 다른 컬럼의 카드 위 (순번이 다름) | 수정 1번 | 그 카드 자리에 끼어든다 | 그 카드와 순서가 바뀔 수 있다 |
| 다른 컬럼의 카드 위 (순번이 같음) | 없음 | 옮겨지지 않는다 | 그대로 |
| 컬럼 밖 | 없음 | 옮겨지지 않는다 | 그대로 |

이 표는 코드를 따라가 계산한 결과다. `over`가 카드가 될지 컬럼이 될지는 복사본이 얼마나 겹쳤느냐로 정해져서, 실제로는 놓는 위치와 끌고 간 경로에 따라 달라진다.

- **같은 컬럼 안 순서가 저장되지 않는 이유:** 끄는 중에 화면 순서가 먼저 바뀌어서, 놓는 순간의 `over`는 끄는 카드 자신이 된다. 그러면 437행에서 두 순번이 같다고 판단해 `moveTask`를 부르지 않는다.
- **"순번이 같음"의 예:** 첫 번째 카드를 옆 컬럼의 첫 번째 카드 위에 놓는 경우다. 437행이 서로 다른 컬럼의 순번끼리 비교하기 때문에 옮기지 않는다. 필터가 켜져 있으면 순번은 화면에 보이는 순서가 아니라 숨은 카드까지 센 순서다(드래그 함수들은 `filteredColumns`가 아니라 `columns`에서 순번을 찾는다).
- **새로고침 후 순서가 바뀔 수 있는 이유:** 옮긴 카드 한 줄의 `sort_order`만 바꾸고 다른 카드는 그대로 둔다. 카드 위에 놓으면 그 카드와 `sort_order`가 같아지는데, 불러올 때는 `sort_order`로만 정렬한다([services.ts:132](../lib/services.ts#L132)).
- **개발 서버에서는 같은 컬럼 순서 바꾸기가 다르게 동작한다.** Strict Mode가 390행의 함수를 두 번 실행하고, 그 함수가 이전 state를 직접 고치기 때문이다([397행](../app/boards/[id]/page.tsx#L397)). 한 칸 이동은 state에서 되돌아가고 두 칸 이상은 순서가 섞인다. 코드상으로는 이 상태에서 놓으면 저장 요청이 나가 `sort_order`가 겹칠 수도 있다. 자세한 설명은 11편 글의 11-1에 있다.

## 10. 컬럼 추가

1. [boards/page.tsx:758](../app/boards/[id]/page.tsx#L758) "add another list" 버튼 → `setIsCreatingColumn(true)` → [772행](../app/boards/[id]/page.tsx#L772) Dialog가 열린다.
2. 제목을 치면 [784행](../app/boards/[id]/page.tsx#L784) `setNewColumnTitle`이 입력값을 state에 넣는다.
3. Create Columns → [778행](../app/boards/[id]/page.tsx#L778) `onSubmit` → [445행](../app/boards/[id]/page.tsx#L445) `handleCreateColumn`. 공백뿐이면 여기서 끝난다([448행](../app/boards/[id]/page.tsx#L448)).
4. [450행](../app/boards/[id]/page.tsx#L450) `createColumn(제목)`
5. [useBoards.ts:178](../lib/hooks/useBoards.ts#L178) `createColumn` — 보드나 로그인 정보가 없으면 에러를 던진다([179행](../lib/hooks/useBoards.ts#L179)). 있으면 [182행](../lib/hooks/useBoards.ts#L182)에서 `{title, board_id, sort_order: 지금 컬럼 수, user_id}`를 서비스에 넘긴다.
6. [services.ts:88](../lib/services.ts#L88) `columnService.createColumn` — `columns`에 저장하고 저장된 줄을 돌려받는다. 5단계에서 기본 컬럼 4개를 만들 때 쓰는 것과 같은 함수다.
7. [useBoards.ts:189](../lib/hooks/useBoards.ts#L189) `setColumns` — 돌려받은 줄에 빈 `tasks: []`를 붙여 맨 끝에 추가한다.
8. [452~453행](../app/boards/[id]/page.tsx#L452) 입력칸을 비우고 Dialog를 닫는다. 새 컬럼은 "add another list" 버튼 바로 앞에 나타나고, 곧바로 카드를 끌어다 놓을 수 있다.

## 11. 컬럼 이름 바꾸기

1. 컬럼의 "..." 버튼([boards/page.tsx:50](../app/boards/[id]/page.tsx#L50)) → `onEditColumn(column)`. 페이지가 이 자리에 `handleEditColumn`을 넘겨 주었다([739행](../app/boards/[id]/page.tsx#L739)).
2. [468행](../app/boards/[id]/page.tsx#L468) `handleEditColumn` — Dialog를 열고, 어느 컬럼인지 기억하고, 현재 제목을 입력칸용 state에 복사한다. → [805행](../app/boards/[id]/page.tsx#L805) Dialog
3. 저장 → [811행](../app/boards/[id]/page.tsx#L811) `onSubmit` → [456행](../app/boards/[id]/page.tsx#L456) `handleUpdateColumn` → [461행](../app/boards/[id]/page.tsx#L461) `updateColumn(컬럼 id, 새 제목)`
4. [useBoards.ts:197](../lib/hooks/useBoards.ts#L197) `updateColumn` → [199행](../lib/hooks/useBoards.ts#L199) `columnService.updateColumnTitle`
5. [services.ts:103](../lib/services.ts#L103) `updateColumnTitle` — `columns`에서 그 줄의 `title`만 고치고 고친 줄을 돌려받는다.
6. [useBoards.ts:201](../lib/hooks/useBoards.ts#L201) `setColumns` — 그 컬럼만 새 값으로 덮어쓴다. 카드 목록(`tasks`)은 그대로 남는다.
7. [463~465행](../app/boards/[id]/page.tsx#L463) state 3개를 처음 값으로 돌리고 Dialog를 닫는다. 컬럼 제목([44행](../app/boards/[id]/page.tsx#L44))이 새 이름으로 바뀐다.

## 12. 태스크 필터 (보드 상세)

Supabase 요청이 없다. 페이지의 state만 바꾸고, 이미 받아 둔 `columns`를 그릴 때마다 걸러서 보여 준다. 자세한 설명은 [13편 글](post-13-filters.md)에 있다.

1. [navbar.tsx:85](../components/navbar.tsx#L85) Filter 버튼 → [boards/page.tsx:511](../app/boards/[id]/page.tsx#L511) `onFilterClick` → `setIsFilterOpen(true)` → [585행](../app/boards/[id]/page.tsx#L585) Dialog
2. 우선순위 버튼([599행](../app/boards/[id]/page.tsx#L599)) — 고른 목록에 그 값을 넣거나 뺀 새 배열을 만들어 [604행](../app/boards/[id]/page.tsx#L604) `handleFilterChange("priority", 새 배열)`
3. 날짜 칸([622행](../app/boards/[id]/page.tsx#L622)) — `handleFilterChange("dueDate", 날짜 또는 null)`
4. [288행](../app/boards/[id]/page.tsx#L288) `handleFilterChange` → [292행](../app/boards/[id]/page.tsx#L292) `setFilters` — 그 칸만 바꾼 새 객체를 넣는다.
5. 다시 그려질 때 [474행](../app/boards/[id]/page.tsx#L474) `filteredColumns`를 새로 계산한다. 컬럼마다 카드를 거르는데, 우선순위 검사([479행](../app/boards/[id]/page.tsx#L479))와 마감일 검사([487행](../app/boards/[id]/page.tsx#L487))를 통과한 카드만 남긴다. 원본 `columns`는 바뀌지 않는다.
6. [732행](../app/boards/[id]/page.tsx#L732) — 화면은 `filteredColumns`로 그린다. 컬럼 배지([47행](../app/boards/[id]/page.tsx#L47))도 걸러진 수를 보여 준다.
7. [513행](../app/boards/[id]/page.tsx#L513)에서 `filterCount`를 계산해 Navbar에 넘기고, Navbar가 숫자 배지를 그린다([navbar.tsx:89](../components/navbar.tsx#L89)).
8. Clear Filters([628행](../app/boards/[id]/page.tsx#L628)) → [298행](../app/boards/[id]/page.tsx#L298) `clearFilters`가 처음 값으로 되돌린다. Apply Filters([633행](../app/boards/[id]/page.tsx#L633))는 Dialog를 닫기만 한다. 필터는 버튼이나 날짜를 바꾼 순간 이미 적용돼 있다.

| 경우 | 결과 |
|---|---|
| 우선순위를 여러 개 고름 | 그중 하나에 해당하는 카드가 보인다. 배지 숫자는 고른 값의 개수다. |
| 마감일만 고름 | 그 날짜의 카드와 **마감일이 없는 카드**가 보인다. |
| Total Tasks | 필터와 상관없이 전체 수다([646행](../app/boards/[id]/page.tsx#L646)). 컬럼 배지를 더한 값과 다를 수 있다. |
| 필터를 켠 채 조건에 안 맞는 태스크 추가 | 저장은 되지만 화면에는 보이지 않는다. |
| 필터를 켠 채 카드 드래그 | 순번을 숨은 카드까지 센 원본 `columns`에서 찾는다. 그래서 숨은 카드와의 순서가 틀어지지 않는다. |
| 새로고침, 다른 페이지에 다녀옴 | 필터가 처음 값으로 돌아간다. |
| 담당자(assignee) | state만 있고 고르는 칸과 거르는 코드가 없다. |

## 13. 보드 필터 (대시보드)

여기도 Supabase 요청이 없다. 4단계에서 받아 둔 `boards`와 `taskCount`를 그릴 때마다 걸러서 보여 준다.

1. 검색창에 글자를 치면 [dashboard/page.tsx:238](../app/dashboard/page.tsx#L238) `onChange`가 `setFilters`로 `search`만 바꾼다.
2. Filter 버튼([216행](../app/dashboard/page.tsx#L216)) → `setIsFilterOpen(true)` → [330행](../app/dashboard/page.tsx#L330) Dialog. 칸마다 `setFilters`를 부른다.

   | 칸 | 위치 | 저장하는 값 |
   |---|---|---|
   | Search | [345행](../app/dashboard/page.tsx#L345) | 글자 그대로. 검색창과 같은 state다. |
   | 시작일, 종료일 | [361행](../app/dashboard/page.tsx#L361), [377행](../app/dashboard/page.tsx#L377) | `"YYYY-MM-DD"` 글자, 비우면 `null` |
   | 최소, 최대 태스크 수 | [401행](../app/dashboard/page.tsx#L401), [419행](../app/dashboard/page.tsx#L419) | 숫자, 비우면 `null` |

3. 다시 그려질 때 [47행](../app/dashboard/page.tsx#L47) `filteredBoards`를 새로 계산한다. 제목 검색([49행](../app/dashboard/page.tsx#L49)), 날짜 범위([54행](../app/dashboard/page.tsx#L54), [57행](../app/dashboard/page.tsx#L57)), 태스크 수([62행](../app/dashboard/page.tsx#L62), [65행](../app/dashboard/page.tsx#L65)) 세 조건을 모두 통과한 보드만 남긴다([67행](../app/dashboard/page.tsx#L67)).
4. 그리드([253행](../app/dashboard/page.tsx#L253))나 리스트([289행](../app/dashboard/page.tsx#L289))를 `filteredBoards`로 그린다. 맞는 보드가 없으면 "No boards match your filters"가 나온다([249행](../app/dashboard/page.tsx#L249)).
5. Clear Filters([430행](../app/dashboard/page.tsx#L430)) → [70행](../app/dashboard/page.tsx#L70) `clearFilters`. Apply Filters([431행](../app/dashboard/page.tsx#L431))는 Dialog를 닫기만 한다.

| 경우 | 결과 |
|---|---|
| 검색 | 제목만 본다. 대소문자는 가리지 않고, 앞뒤 빈칸도 검색어에 포함된다. |
| 날짜 범위 | 내 컴퓨터 시간 기준이고, 시작일과 종료일 당일을 포함한다. |
| 최소 0 | 모든 보드가 통과한다. 최대 0이면 태스크가 없는 보드만 남는다. |
| 통계 카드 | 원본 `boards`로 센다([124행](../app/dashboard/page.tsx#L124)). 필터를 걸어도 숫자가 바뀌지 않는다. |
| 필터를 켠 채 Create Board | 새 보드(제목 "New Board", 태스크 0개)가 조건에 안 맞으면 저장은 되지만 목록에 보이지 않는다. |
| 보드 페이지에 다녀옴 | 필터가 처음 값으로 돌아가고, 태스크 수는 새로 받아 온다. |

## 반복되는 패턴

4~8단계와 10~11단계는 모두 같은 4층 구조다.

```
페이지의 핸들러  →  훅 (useBoards.ts)  →  서비스 (services.ts)  →  Supabase
                     ↑ 결과를 setState 로 넣으면 화면이 다시 그려짐
```

| 층 | 파일 | 하는 일 |
|---|---|---|
| 페이지 | `app/dashboard/page.tsx`, `app/boards/[id]/page.tsx` | 버튼·폼 이벤트를 받아 훅의 함수를 부른다 |
| 훅 | `lib/hooks/useBoards.ts` | state(`boards`, `board`, `columns`)를 들고, 서비스를 부르고, 결과를 state에 넣는다 |
| 서비스 | `lib/services.ts` | Supabase 쿼리를 조립해 보낸다 |
| 연결 | `lib/supabase/SupabaseProvider.tsx` | Clerk 토큰이 붙는 Supabase 클라이언트를 만들어 나눠 준다 |

저장한 뒤에는 목록을 다시 불러오지 않고, 돌려받은 줄을 state에 직접 넣는다.

9단계는 두 군데가 다르다.

- 끄는 중에는 훅의 함수나 서비스를 거치지 않고, 페이지가 훅이 내준 `setColumns`를 직접 부른다([boards/page.tsx:390](../app/boards/[id]/page.tsx#L390)).
- 놓을 때는 같은 4층을 타지만 저장된 줄을 돌려받지 않는다. 훅이 state 안에서 카드를 직접 옮긴다([useBoards.ts:151](../lib/hooks/useBoards.ts#L151)).

12~13단계(필터)는 훅과 서비스를 거치지 않는다. 페이지가 `filters` state만 바꾸고, 이미 받아 둔 데이터를 그릴 때마다 걸러서 보여 준다.

## 따라가다 발견한 것

아직 고치지 않았다.

- **로그아웃 상태로 `/dashboard`를 직접 열면 "Loading your boards..."에서 멈춘다.** `loading`의 처음 값이 true인데([useBoards.ts:18](../lib/hooks/useBoards.ts#L18)), `user`가 없으면 `loadBoards()`가 불리지 않아([22행](../lib/hooks/useBoards.ts#L22)) false로 바뀔 일이 없다. README 할 일의 "/dashboard 보호"와 같은 문제다.
- **태스크 추가나 보드 수정이 실패해도 Dialog가 성공한 것처럼 닫힌다.** 훅이 에러를 잡고 다시 던지지 않으며([useBoards.ts:136](../lib/hooks/useBoards.ts#L136), [107행](../lib/hooks/useBoards.ts#L107)), 보드 페이지는 훅의 `error`를 꺼내지 않는다([boards/page.tsx:256](../app/boards/[id]/page.tsx#L256)). 컬럼 추가와 컬럼 이름 바꾸기도 같다([192행](../lib/hooks/useBoards.ts#L192), [204행](../lib/hooks/useBoards.ts#L204)).
- **보드를 불러오는 중이거나 로그아웃 상태에서 컬럼 추가를 제출하면 처리되지 않은 에러가 난다.** 훅의 에러가 `try` 밖에서 던져지고([useBoards.ts:179](../lib/hooks/useBoards.ts#L179)), `handleCreateColumn`에는 `try/catch`가 없다. Dialog는 열린 채 남는다.
- **보드 만들기가 실패하면 대시보드 전체가 에러 화면으로 바뀐다.** 목록 불러오기와 같은 `error` state를 쓰기 때문이다([useBoards.ts:60](../lib/hooks/useBoards.ts#L60), [dashboard/page.tsx:94](../app/dashboard/page.tsx#L94)).
- [dashboard/page.tsx:15](../app/dashboard/page.tsx#L15)의 `import { Board }`는 쓰이지 않는 줄이다. 쓰는 곳이 전부 주석이다.
- `lib/supabase/client.ts`와 `lib/supabase/server.ts`는 어디서도 import하지 않는다. 실제로 쓰이는 클라이언트는 `SupabaseProvider.tsx`뿐이다.

드래그에서 발견한 것. 앞의 세 가지는 9단계의 표와 설명에 적었다.

- 같은 컬럼 안 순서는 저장되지 않는다.
- 다른 컬럼의 같은 순번 카드 위에 놓으면 옮겨지지 않는다.
- 카드 위에 놓으면 `sort_order`가 겹쳐 새로고침 후 순서가 바뀔 수 있다.
- **카드 옮기기 저장이 실패해도 화면에 아무 표시가 없다.** 훅이 에러를 잡고 다시 던지지 않으며([useBoards.ts:173](../lib/hooks/useBoards.ts#L173)), 페이지는 훅의 `error`를 꺼내지 않는다. 카드는 원래 자리에 남는다.
- **컬럼 id와 카드 id가 같은 숫자면 놓을 곳을 착각할 수 있다.** 컬럼([boards/page.tsx:34](../app/boards/[id]/page.tsx#L34))과 카드([141행](../app/boards/[id]/page.tsx#L141))가 DB의 숫자 id를 그대로 dnd-kit의 id로 쓴다. [3편 글](post-03-supabase-tables.md)의 테이블 정의대로라면 `columns`와 `tasks`는 각각 1부터 번호를 매기므로 같은 숫자가 나올 수 있다. 그러면 dnd-kit에는 둘 중 하나만 "놓을 곳"으로 남고, `handleDragEnd`는 컬럼인지를 id만으로 먼저 확인하기 때문에([415행](../app/boards/[id]/page.tsx#L415)) 카드 위에 놓아도 같은 번호의 컬럼 맨 끝으로 저장할 수 있다. 실제 DB의 id 값은 확인하지 못했다.

필터에서 발견한 것. 앞의 두 가지는 README의 "태스크 필터 메모"와 13편 글에도 적혀 있다.

- 마감일 필터를 걸어도 마감일이 없는 카드는 계속 보인다([boards/page.tsx:487](../app/boards/[id]/page.tsx#L487)).
- 담당자(assignee) 필터는 state만 있다([273행](../app/boards/[id]/page.tsx#L273)).
- **대시보드의 Filter 버튼에는 필터가 켜져 있다는 표시가 없다**([dashboard/page.tsx:213](../app/dashboard/page.tsx#L213)). 날짜나 태스크 수 조건을 넣고 Dialog를 닫으면 줄어든 목록만 보인다.
- **필터를 켠 채 새로 만든 태스크나 보드가 조건에 안 맞으면 화면에 보이지 않는다.** 저장은 된 상태다.
- 태스크 수 칸의 `min="0"`은 표시용이라 음수나 소수도 그대로 저장된다([dashboard/page.tsx:401](../app/dashboard/page.tsx#L401)). 최대가 최소보다 작거나 시작일이 종료일보다 늦어도 안내 없이 "맞는 보드 없음"이 된다.

아직 모양만 있거나 없는 것: 담당자(assignee) 필터, 같은 컬럼 안 순서 저장, 태스크를 넣을 컬럼 선택(컬럼마다 Add Task 버튼은 있지만 어느 컬럼에서 눌러도 첫 컬럼에 들어간다), 대시보드의 점선 "Create new board" 카드([dashboard/page.tsx:280](../app/dashboard/page.tsx#L280), `onClick`이 없다).

## 다음에 고친다면

발견한 것 중 사용자가 바로 겪는 순서대로 골랐다. 영상 코드와 달라지는 수정이다.

1. **`/dashboard`와 `/boards/[id]` 보호.** `middleware.ts`에 보호 규칙을 넣으면 로그아웃 상태에서 멈추는 화면과 컬럼 추가 에러가 함께 사라진다. README 할 일에 이미 있다.
2. **실패를 화면에 알리기.** 보드 페이지가 훅의 `error`를 꺼내 보여 주고, 실패했을 때는 Dialog를 닫지 않는다.
3. **컬럼의 Add Task가 그 컬럼에 넣기.** `handleCreateTask`가 컬럼 id를 받도록 바꾼다.
4. **같은 컬럼 안 순서 저장.** 놓을 때 그 컬럼 카드들의 `sort_order`를 다시 매겨 저장한다. 카드 위에 놓았을 때 번호가 겹치는 문제도 같이 풀린다.
5. **dnd-kit id 구분.** 컬럼은 `column-3`, 카드는 `task-3`처럼 앞에 글자를 붙이면 같은 숫자여도 섞이지 않는다.

## 확인하지 못한 부분

- Clerk 로그인 페이지 안쪽 동작. 저장소에 코드가 없다.
- Supabase 대시보드 설정(Clerk 토큰을 믿게 한 설정, 접근 규칙 RLS). [4편 글](post-04-supabase-connect.md)의 기록을 기준으로 봤다.
- 드래그 중 `over`가 실제로 무엇이 되는지. 복사본이 겹친 넓이로 정해지기 때문에 9단계의 경우별 결과는 화면에서 끌어 봐야 확정된다.
- 12~13단계 표의 경우별 결과. 조건식에 값을 넣어 계산한 것이고 화면에서 눌러 본 것은 아니다.
