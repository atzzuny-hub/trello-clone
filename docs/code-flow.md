# 코드 흐름 정리 — 로그인부터 카드 드래그까지

"사용자가 무엇을 누르면 → 어떤 파일의 어떤 함수가 실행되고 → 그다음 무엇을 부르는지"를 순서대로 따라간 기록이다.

- 기준: 2026-11-11, 커밋 `5184d41` (11편 드래그 앤 드롭까지)
- 확인 방법: 코드를 읽고 설치된 라이브러리 소스(`node_modules`)와 대조했다. 브라우저에서 실행해 확인한 것은 아니다.
- 줄 번호는 위 커밋 기준이다. 코드를 고치면 달라질 수 있다. 12편(컬럼 추가·이름 바꾸기) 코드가 들어간 뒤로는 `app/boards/[id]/page.tsx`의 줄 번호가 밀려 있다.

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
2. [dashboard/page.tsx:19](../app/dashboard/page.tsx#L19) `useBoards()`
3. [useBoards.ts:14~15](../lib/hooks/useBoards.ts#L14) `useUser()`, `useSupabase()`로 유저와 클라이언트를 꺼낸다.
4. [useBoards.ts:20](../lib/hooks/useBoards.ts#L20) `useEffect` → `user`가 있으면 [26행](../lib/hooks/useBoards.ts#L26) `loadBoards()`
5. [useBoards.ts:32](../lib/hooks/useBoards.ts#L32) `boardService.getBoards(supabase, user.id)`
6. [services.ts:25](../lib/services.ts#L25) — `boards` 테이블에서 `user_id`가 내 ID인 줄을 최신순으로 가져온다.
7. [useBoards.ts:33](../lib/hooks/useBoards.ts#L33) `setBoards(data)` → [dashboard/page.tsx:38](../app/dashboard/page.tsx#L38) 본 화면(통계, 보드 카드)이 그려진다.

## 5. 보드 만들기

1. 버튼([53행](../app/dashboard/page.tsx#L53) 또는 [164행](../app/dashboard/page.tsx#L164)) → [dashboard/page.tsx:22](../app/dashboard/page.tsx#L22) `handleCreateBoard` → `createBoard({title: "New Board"})`
2. [useBoards.ts:41](../lib/hooks/useBoards.ts#L41) `createBoard` → [49행](../lib/hooks/useBoards.ts#L49) `boardDataService.createBoardWithDefaultColumns`
3. [services.ts:186](../lib/services.ts#L186) `boardService.createBoard` → [42행](../lib/services.ts#L42) `boards`에 한 줄 저장 (`title`, `description: null`, `color: "bg-blue-500"`, `user_id`)
4. [services.ts:203](../lib/services.ts#L203) `Promise.all` → `columnService.createColumn`을 4번 동시에 (To Do, In Progress, Review, Done)
5. [useBoards.ts:56](../lib/hooks/useBoards.ts#L56) `setBoards` — 목록 맨 앞에 새 보드를 끼워 넣는다.

## 6. 보드 상세 불러오기

1. [dashboard/page.tsx:185](../app/dashboard/page.tsx#L185) 카드의 `<Link>` → `/boards/<id>`
2. [boards/page.tsx:255](../app/boards/[id]/page.tsx#L255) `useParams()` → [256행](../app/boards/[id]/page.tsx#L256) `useBoard(id)`
3. [useBoards.ts:72](../lib/hooks/useBoards.ts#L72) `useEffect` → [78행](../lib/hooks/useBoards.ts#L78) `loadBoard()` → [84행](../lib/hooks/useBoards.ts#L84) `boardDataService.getBoardWithColumns`
4. [services.ts:155](../lib/services.ts#L155) `Promise.all` — [getBoard](../lib/services.ts#L8)와 [getColumns](../lib/services.ts#L70)를 동시에 보낸다.
5. 둘 다 끝나면 [services.ts:162](../lib/services.ts#L162) → [getTasksByBoard](../lib/services.ts#L99). `tasks`에는 `board_id`가 없어서 `columns`를 조인해 이 보드 것만 거른다.
6. [services.ts:164](../lib/services.ts#L164) — 태스크를 컬럼별로 나눈다. 이건 브라우저에서 하는 일이다.
7. [useBoards.ts:85~86](../lib/hooks/useBoards.ts#L85) `setBoard`, `setColumns`
8. [boards/page.tsx:417](../app/boards/[id]/page.tsx#L417) `<Navbar>`(제목), [630행](../app/boards/[id]/page.tsx#L630) `<DroppableColumn>`, [643행](../app/boards/[id]/page.tsx#L643) `<SortableTask>`가 그려진다.

## 7. 보드 수정

1. [navbar.tsx:68](../components/navbar.tsx#L68) "..." 버튼 → [boards/page.tsx:419](../app/boards/[id]/page.tsx#L419) `onEditBoard` — 현재 제목·색을 폼용 state에 복사하고 Dialog를 연다.
2. Save Changes → [276행](../app/boards/[id]/page.tsx#L276) `handleUpdateBoard` → [282행](../app/boards/[id]/page.tsx#L282) `updateBoard(board.id, {title, color})`
3. [useBoards.ts:94](../lib/hooks/useBoards.ts#L94) `updateBoard` → [services.ts:51](../lib/services.ts#L51) `boardService.updateBoard` ([58행](../lib/services.ts#L58)에서 `updated_at`을 더해 수정)
4. [useBoards.ts:101](../lib/hooks/useBoards.ts#L101) `setBoard` → [boards/page.tsx:286](../app/boards/[id]/page.tsx#L286) Dialog 닫기 → Navbar 제목이 바뀐다.

## 8. 태스크 추가

1. [boards/page.tsx:550](../app/boards/[id]/page.tsx#L550) Add Task 버튼 — [549행](../app/boards/[id]/page.tsx#L549) `<DialogTrigger>`가 Dialog를 연다. 보드 수정 Dialog와 달리 페이지 state를 쓰지 않는다.
2. [610행](../app/boards/[id]/page.tsx#L610) Create Task → [562행](../app/boards/[id]/page.tsx#L562) `onSubmit` → [307행](../app/boards/[id]/page.tsx#L307) `handleCreateTask`
3. [309행](../app/boards/[id]/page.tsx#L309) `new FormData(...)`로 입력값을 읽어 [310행](../app/boards/[id]/page.tsx#L310) `taskData`를 만든다.
4. 제목이 있으면 [319행](../app/boards/[id]/page.tsx#L319) `createTask(taskData)`
5. [292행](../app/boards/[id]/page.tsx#L292) `createTask` — [299행](../app/boards/[id]/page.tsx#L299) `columns[0]`, 즉 항상 첫 컬럼(To Do)을 고른다. → [304행](../app/boards/[id]/page.tsx#L304) `createRealTask(컬럼 id, taskData)`
6. [useBoards.ts:109](../lib/hooks/useBoards.ts#L109) `createRealTask` — [121~127행](../lib/hooks/useBoards.ts#L121)에서 DB 모양으로 바꾼다(`dueDate` → `due_date`, `sort_order`는 그 컬럼의 현재 태스크 수).
7. [useBoards.ts:120](../lib/hooks/useBoards.ts#L120) → [services.ts:116](../lib/services.ts#L116) `taskService.createTask` — `tasks`에 저장하고 저장된 줄을 돌려받는다.
8. [useBoards.ts:130](../lib/hooks/useBoards.ts#L130) `setColumns` — 그 컬럼의 `tasks` 끝에 새 태스크를 붙인다. 다시 불러오지는 않는다.
9. [boards/page.tsx:321~322](../app/boards/[id]/page.tsx#L321) — 열려 있는 Add Task 버튼을 찾아 한 번 더 클릭해서 Dialog를 닫는다.
10. 다시 그려지면서 [643행](../app/boards/[id]/page.tsx#L643) `<SortableTask>`로 새 카드가 나오고 [543행](../app/boards/[id]/page.tsx#L543) Total Tasks가 1 늘어난다.

컬럼 안에도 Add Task 버튼([boards/page.tsx:61](../app/boards/[id]/page.tsx#L61))과 같은 모양의 Dialog가 있다. 여기서 Create Task([121행](../app/boards/[id]/page.tsx#L121))를 누르면 form의 `onSubmit={onCreateTask}`([73행](../app/boards/[id]/page.tsx#L73))가 실행되는데, 페이지가 `onCreateTask` 자리에 `handleCreateTask`를 넘겨 주기 때문에([634행](../app/boards/[id]/page.tsx#L634)) 3번부터는 위와 똑같다. 그래서 5번의 `columns[0]` 때문에 어느 컬럼의 버튼을 눌러도 새 태스크는 첫 컬럼(To Do)에 들어간다.

## 9. 드래그로 카드 옮기기

드래그는 `@dnd-kit` 라이브러리가 맡는다. 우리 코드는 "무엇을 끌 수 있고 어디에 놓을 수 있는지" 등록하고, 드래그의 세 순간(시작, 끄는 중, 놓기)에 불리는 함수를 넘겨 준다. 단계별 코드 설명과 막혔던 에러는 [11편 글](post-11-drag-and-drop.md)에 있다.

### 준비: 화면이 그려질 때 등록되는 것

| 코드 | 위치 | 역할 |
|---|---|---|
| `useSensors(PointerSensor)` | [boards/page.tsx:267](../app/boards/[id]/page.tsx#L267) | 카드를 누른 채 8px 넘게 움직여야 드래그로 본다([270행](../app/boards/[id]/page.tsx#L270)). 그냥 클릭은 드래그가 아니다. |
| `<DndContext>` | [618행](../app/boards/[id]/page.tsx#L618) | 드래그 판. 우리 함수 3개를 연결한다([621~623행](../app/boards/[id]/page.tsx#L621)). |
| `useDroppable({id: column.id})` | [34행](../app/boards/[id]/page.tsx#L34) | 컬럼을 "놓을 수 있는 곳"으로 등록한다. |
| `useSortable({id: task.id})` | [141행](../app/boards/[id]/page.tsx#L141) | 카드를 "끌 수 있는 것"이면서 "놓을 수 있는 곳"으로 등록한다. |
| `<SortableContext>` | [637행](../app/boards/[id]/page.tsx#L637) | 한 컬럼의 카드 순서를 dnd-kit에 알려 준다. |
| `<DragOverlay>` | [649행](../app/boards/[id]/page.tsx#L649) | 끄는 동안 포인터를 따라다니는 복사본이 그려지는 자리. |

### 끌기 시작

1. 카드를 누르고 8px 넘게 움직이면 dnd-kit이 [326행](../app/boards/[id]/page.tsx#L326) `handleDragStart`를 부른다.
2. [333행](../app/boards/[id]/page.tsx#L333) `setActiveTask(task)` — 끄는 카드를 기억한다.
3. [650행](../app/boards/[id]/page.tsx#L650) `<TaskOverlay>`가 복사본을 그리고, 원래 카드는 반투명해진다([146행](../app/boards/[id]/page.tsx#L146)).

### 끄는 중

dnd-kit은 복사본과 가장 많이 겹친 카드나 컬럼을 `over`로 정한다. 마우스 위치가 아니라 복사본 사각형이 기준이다. `over`가 바뀔 때마다 [337행](../app/boards/[id]/page.tsx#L337) `handleDragOver`가 불린다.

- **같은 컬럼의 다른 카드 위:** [354행](../app/boards/[id]/page.tsx#L354) 분기로 들어가 [359행](../app/boards/[id]/page.tsx#L359) `setColumns`로 화면 순서만 바꾼다. Supabase 요청은 없다.
- **다른 컬럼 위:** 아무것도 바꾸지 않는다. `over`가 컬럼 자체면 [352행](../app/boards/[id]/page.tsx#L352)에서 끝나고, 그 컬럼의 카드면 354행 분기에 들어가지 못하고 끝난다. `over`가 컬럼 자체일 때는 그 컬럼이 파랗게 강조된다([37행](../app/boards/[id]/page.tsx#L37)).

### 놓기

1. [377행](../app/boards/[id]/page.tsx#L377) `handleDragEnd` — `over`가 없으면(컬럼 밖) 바로 끝난다([379행](../app/boards/[id]/page.tsx#L379)).
2. `over`가 컬럼이면([384행](../app/boards/[id]/page.tsx#L384)): 다른 컬럼일 때만([390행](../app/boards/[id]/page.tsx#L390)) [391행](../app/boards/[id]/page.tsx#L391) `moveTask(카드 id, 컬럼 id, 그 컬럼의 카드 수)`를 부른다. 맨 끝으로 보낸다는 뜻이다.
3. `over`가 카드면: 끄는 카드의 순번([403행](../app/boards/[id]/page.tsx#L403))과 그 카드의 순번([404행](../app/boards/[id]/page.tsx#L404))이 다를 때만([406행](../app/boards/[id]/page.tsx#L406)) [407행](../app/boards/[id]/page.tsx#L407) `moveTask(카드 id, 그 카드의 컬럼 id, 그 카드의 순번)`을 부른다.
4. [useBoards.ts:140](../lib/hooks/useBoards.ts#L140) `moveTask` → [146행](../lib/hooks/useBoards.ts#L146)에서 `taskService.moveTask`를 기다린다.
5. [services.ts:131](../lib/services.ts#L131) `taskService.moveTask` — `tasks`에서 그 카드 한 줄의 `column_id`, `sort_order`만 고친다([139행](../lib/services.ts#L139)). 저장된 줄을 돌려받지는 않는다.
6. 저장이 끝나면 [useBoards.ts:148](../lib/hooks/useBoards.ts#L148) `setColumns` — 카드를 원래 컬럼에서 빼서 새 컬럼의 그 순번에 끼운다.
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

- **같은 컬럼 안 순서가 저장되지 않는 이유:** 끄는 중에 화면 순서가 먼저 바뀌어서, 놓는 순간의 `over`는 끄는 카드 자신이 된다. 그러면 406행에서 두 순번이 같다고 판단해 `moveTask`를 부르지 않는다.
- **"순번이 같음"의 예:** 첫 번째 카드를 옆 컬럼의 첫 번째 카드 위에 놓는 경우다. 406행이 서로 다른 컬럼의 순번끼리 비교하기 때문에 옮기지 않는다.
- **새로고침 후 순서가 바뀔 수 있는 이유:** 옮긴 카드 한 줄의 `sort_order`만 바꾸고 다른 카드는 그대로 둔다. 카드 위에 놓으면 그 카드와 `sort_order`가 같아지는데, 불러올 때는 `sort_order`로만 정렬한다([services.ts:109](../lib/services.ts#L109)).
- **개발 서버에서는 같은 컬럼 순서 바꾸기가 다르게 동작한다.** Strict Mode가 359행의 함수를 두 번 실행하고, 그 함수가 이전 state를 직접 고치기 때문이다([366행](../app/boards/[id]/page.tsx#L366)). 한 칸 이동은 state에서 되돌아가고 두 칸 이상은 순서가 섞인다. 코드상으로는 이 상태에서 놓으면 저장 요청이 나가 `sort_order`가 겹칠 수도 있다. 자세한 설명은 11편 글의 11-1에 있다.

## 반복되는 패턴

4~8단계는 모두 같은 4층 구조다.

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

- 끄는 중에는 훅의 함수나 서비스를 거치지 않고, 페이지가 훅이 내준 `setColumns`를 직접 부른다([boards/page.tsx:359](../app/boards/[id]/page.tsx#L359)).
- 놓을 때는 같은 4층을 타지만 저장된 줄을 돌려받지 않는다. 훅이 state 안에서 카드를 직접 옮긴다([useBoards.ts:148](../lib/hooks/useBoards.ts#L148)).

## 따라가다 발견한 것

아직 고치지 않았다.

- **로그아웃 상태로 `/dashboard`를 직접 열면 "Loading your boards..."에서 멈춘다.** `loading`의 처음 값이 true인데([useBoards.ts:17](../lib/hooks/useBoards.ts#L17)), `user`가 없으면 `loadBoards()`가 불리지 않아([21행](../lib/hooks/useBoards.ts#L21)) false로 바뀔 일이 없다. README 할 일의 "/dashboard 보호"와 같은 문제다.
- **태스크 추가나 보드 수정이 실패해도 Dialog가 성공한 것처럼 닫힌다.** 훅이 에러를 잡고 다시 던지지 않으며([useBoards.ts:133](../lib/hooks/useBoards.ts#L133), [104행](../lib/hooks/useBoards.ts#L104)), 보드 페이지는 훅의 `error`를 꺼내지 않는다([boards/page.tsx:256](../app/boards/[id]/page.tsx#L256)).
- **보드 만들기가 실패하면 대시보드 전체가 에러 화면으로 바뀐다.** 목록 불러오기와 같은 `error` state를 쓰기 때문이다([useBoards.ts:58](../lib/hooks/useBoards.ts#L58), [dashboard/page.tsx:30](../app/dashboard/page.tsx#L30)).
- [useBoards.ts:8](../lib/hooks/useBoards.ts#L8)의 `import { describe } from "node:test"`는 쓰이지 않는 줄이다.
- `lib/supabase/client.ts`와 `lib/supabase/server.ts`는 어디서도 import하지 않는다. 실제로 쓰이는 클라이언트는 `SupabaseProvider.tsx`뿐이다.

드래그에서 발견한 것. 앞의 세 가지는 9단계의 표와 설명에 적었다.

- 같은 컬럼 안 순서는 저장되지 않는다.
- 다른 컬럼의 같은 순번 카드 위에 놓으면 옮겨지지 않는다.
- 카드 위에 놓으면 `sort_order`가 겹쳐 새로고침 후 순서가 바뀔 수 있다.
- **카드 옮기기 저장이 실패해도 화면에 아무 표시가 없다.** 훅이 에러를 잡고 다시 던지지 않으며([useBoards.ts:170](../lib/hooks/useBoards.ts#L170)), 페이지는 훅의 `error`를 꺼내지 않는다. 카드는 원래 자리에 남는다.
- **컬럼 id와 카드 id가 같은 숫자면 놓을 곳을 착각할 수 있다.** 컬럼([boards/page.tsx:34](../app/boards/[id]/page.tsx#L34))과 카드([141행](../app/boards/[id]/page.tsx#L141))가 DB의 숫자 id를 그대로 dnd-kit의 id로 쓴다. [3편 글](post-03-supabase-tables.md)의 테이블 정의대로라면 `columns`와 `tasks`는 각각 1부터 번호를 매기므로 같은 숫자가 나올 수 있다. 그러면 dnd-kit에는 둘 중 하나만 "놓을 곳"으로 남고, `handleDragEnd`는 컬럼인지를 id만으로 먼저 확인하기 때문에([384행](../app/boards/[id]/page.tsx#L384)) 카드 위에 놓아도 같은 번호의 컬럼 맨 끝으로 저장할 수 있다. 실제 DB의 id 값은 확인하지 못했다.

아직 모양만 있거나 없는 것: 필터 동작, 같은 컬럼 안 순서 저장, 컬럼의 "..." 버튼, 태스크를 넣을 컬럼 선택(컬럼마다 Add Task 버튼은 생겼지만, 어느 컬럼에서 눌러도 첫 컬럼에 들어간다).

## 확인하지 못한 부분

- Clerk 로그인 페이지 안쪽 동작. 저장소에 코드가 없다.
- Supabase 대시보드 설정(Clerk 토큰을 믿게 한 설정, 접근 규칙 RLS). [4편 글](post-04-supabase-connect.md)의 기록을 기준으로 봤다.
- 드래그 중 `over`가 실제로 무엇이 되는지. 복사본이 겹친 넓이로 정해지기 때문에 9단계의 경우별 결과는 화면에서 끌어 봐야 확정된다.
