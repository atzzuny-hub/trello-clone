# 코드 흐름 정리 — 로그인부터 태스크 추가까지

"사용자가 무엇을 누르면 → 어떤 파일의 어떤 함수가 실행되고 → 그다음 무엇을 부르는지"를 순서대로 따라간 기록이다.

- 기준: 2026-11-10, 커밋 `f6ae23e` (9편 태스크 만들기까지)
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
3. [services.ts:167](../lib/services.ts#L167) `boardService.createBoard` → [42행](../lib/services.ts#L42) `boards`에 한 줄 저장 (`title`, `description: null`, `color: "bg-blue-500"`, `user_id`)
4. [services.ts:184](../lib/services.ts#L184) `Promise.all` → `columnService.createColumn`을 4번 동시에 (To Do, In Progress, Review, Done)
5. [useBoards.ts:56](../lib/hooks/useBoards.ts#L56) `setBoards` — 목록 맨 앞에 새 보드를 끼워 넣는다.

## 6. 보드 상세 불러오기

1. [dashboard/page.tsx:185](../app/dashboard/page.tsx#L185) 카드의 `<Link>` → `/boards/<id>`
2. [boards/page.tsx:115](../app/boards/[id]/page.tsx#L115) `useParams()` → [116행](../app/boards/[id]/page.tsx#L116) `useBoard(id)`
3. [useBoards.ts:72](../lib/hooks/useBoards.ts#L72) `useEffect` → [78행](../lib/hooks/useBoards.ts#L78) `loadBoard()` → [84행](../lib/hooks/useBoards.ts#L84) `boardDataService.getBoardWithColumns`
4. [services.ts:136](../lib/services.ts#L136) `Promise.all` — [getBoard](../lib/services.ts#L8)와 [getColumns](../lib/services.ts#L70)를 동시에 보낸다.
5. 둘 다 끝나면 [services.ts:143](../lib/services.ts#L143) → [getTasksByBoard](../lib/services.ts#L99). `tasks`에는 `board_id`가 없어서 `columns`를 조인해 이 보드 것만 거른다.
6. [services.ts:145](../lib/services.ts#L145) — 태스크를 컬럼별로 나눈다. 이건 브라우저에서 하는 일이다.
7. [useBoards.ts:85~86](../lib/hooks/useBoards.ts#L85) `setBoard`, `setColumns`
8. [boards/page.tsx:176](../app/boards/[id]/page.tsx#L176) `<Navbar>`(제목), [381행](../app/boards/[id]/page.tsx#L381) `<Column>`, [389행](../app/boards/[id]/page.tsx#L389) `<TaskCard>`가 그려진다.

## 7. 보드 수정

1. [navbar.tsx:68](../components/navbar.tsx#L68) "..." 버튼 → [boards/page.tsx:178](../app/boards/[id]/page.tsx#L178) `onEditBoard` — 현재 제목·색을 폼용 state에 복사하고 Dialog를 연다.
2. Save Changes → [124행](../app/boards/[id]/page.tsx#L124) `handleUpdateBoard` → [130행](../app/boards/[id]/page.tsx#L130) `updateBoard(board.id, {title, color})`
3. [useBoards.ts:94](../lib/hooks/useBoards.ts#L94) `updateBoard` → [services.ts:51](../lib/services.ts#L51) `boardService.updateBoard` ([58행](../lib/services.ts#L58)에서 `updated_at`을 더해 수정)
4. [useBoards.ts:101](../lib/hooks/useBoards.ts#L101) `setBoard` → [boards/page.tsx:134](../app/boards/[id]/page.tsx#L134) Dialog 닫기 → Navbar 제목이 바뀐다.

## 8. 태스크 추가

1. [boards/page.tsx:309](../app/boards/[id]/page.tsx#L309) Add Task 버튼 — [308행](../app/boards/[id]/page.tsx#L308) `<DialogTrigger>`가 Dialog를 연다. 보드 수정 Dialog와 달리 페이지 state를 쓰지 않는다.
2. [369행](../app/boards/[id]/page.tsx#L369) Create Task → [321행](../app/boards/[id]/page.tsx#L321) `onSubmit` → [155행](../app/boards/[id]/page.tsx#L155) `handleCreateTask`
3. [157행](../app/boards/[id]/page.tsx#L157) `new FormData(...)`로 입력값을 읽어 [158행](../app/boards/[id]/page.tsx#L158) `taskData`를 만든다.
4. 제목이 있으면 [167행](../app/boards/[id]/page.tsx#L167) `createTask(taskData)`
5. [140행](../app/boards/[id]/page.tsx#L140) `createTask` — [147행](../app/boards/[id]/page.tsx#L147) `columns[0]`, 즉 항상 첫 컬럼(To Do)을 고른다. → [152행](../app/boards/[id]/page.tsx#L152) `createRealTask(컬럼 id, taskData)`
6. [useBoards.ts:109](../lib/hooks/useBoards.ts#L109) `createRealTask` — [121~127행](../lib/hooks/useBoards.ts#L121)에서 DB 모양으로 바꾼다(`dueDate` → `due_date`, `sort_order`는 그 컬럼의 현재 태스크 수).
7. [useBoards.ts:120](../lib/hooks/useBoards.ts#L120) → [services.ts:116](../lib/services.ts#L116) `taskService.createTask` — `tasks`에 저장하고 저장된 줄을 돌려받는다.
8. [useBoards.ts:130](../lib/hooks/useBoards.ts#L130) `setColumns` — 그 컬럼의 `tasks` 끝에 새 태스크를 붙인다. 다시 불러오지는 않는다.
9. [boards/page.tsx:169~170](../app/boards/[id]/page.tsx#L169) — 열려 있는 Add Task 버튼을 찾아 한 번 더 클릭해서 Dialog를 닫는다.
10. 다시 그려지면서 [389행](../app/boards/[id]/page.tsx#L389) `<TaskCard>`로 새 카드가 나오고 [302행](../app/boards/[id]/page.tsx#L302) Total Tasks가 1 늘어난다.

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

## 따라가다 발견한 것

아직 고치지 않았다.

- **로그아웃 상태로 `/dashboard`를 직접 열면 "Loading your boards..."에서 멈춘다.** `loading`의 처음 값이 true인데([useBoards.ts:17](../lib/hooks/useBoards.ts#L17)), `user`가 없으면 `loadBoards()`가 불리지 않아([21행](../lib/hooks/useBoards.ts#L21)) false로 바뀔 일이 없다. README 할 일의 "/dashboard 보호"와 같은 문제다.
- **태스크 추가나 보드 수정이 실패해도 Dialog가 성공한 것처럼 닫힌다.** 훅이 에러를 잡고 다시 던지지 않으며([useBoards.ts:133](../lib/hooks/useBoards.ts#L133), [104행](../lib/hooks/useBoards.ts#L104)), 보드 페이지는 훅의 `error`를 꺼내지 않는다([boards/page.tsx:116](../app/boards/[id]/page.tsx#L116)).
- **보드 만들기가 실패하면 대시보드 전체가 에러 화면으로 바뀐다.** 목록 불러오기와 같은 `error` state를 쓰기 때문이다([useBoards.ts:58](../lib/hooks/useBoards.ts#L58), [dashboard/page.tsx:30](../app/dashboard/page.tsx#L30)).
- [useBoards.ts:8](../lib/hooks/useBoards.ts#L8)의 `import { describe } from "node:test"`는 쓰이지 않는 줄이다.
- `lib/supabase/client.ts`와 `lib/supabase/server.ts`는 어디서도 import하지 않는다. 실제로 쓰이는 클라이언트는 `SupabaseProvider.tsx`뿐이다.

아직 모양만 있거나 없는 것: 필터 동작, 컬럼별 추가 버튼, 태스크를 넣을 컬럼 선택.

## 확인하지 못한 부분

- Clerk 로그인 페이지 안쪽 동작. 저장소에 코드가 없다.
- Supabase 대시보드 설정(Clerk 토큰을 믿게 한 설정, 접근 규칙 RLS). [4편 글](post-04-supabase-connect.md)의 기록을 기준으로 봤다.
