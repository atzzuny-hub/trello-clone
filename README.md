# Trello Clone

유튜브 영상을 보며 따라 만드는 Trello 클론 코딩 프로젝트.

- 참고 영상: [Build a Fullstack Trello App with NextJS 15, Supabase, TailwindCSS, Drag & Drop](https://www.youtube.com/watch?v=ugxI1o5SyMs)
- 스택: Next.js 15 (App Router, Turbopack) · React 19 · TypeScript · Tailwind CSS v4 · shadcn/ui · Clerk · Supabase · dnd-kit

## 진행 상황

| 영상 구간 | 내용 | 상태 | 정리 글 |
|---|---|---|---|
| `00:06:00` Next.js App Bootstrapping & Dev Server | create-next-app, Navbar, 메인 페이지 | 완료 | [docs/post-01-setup.md](docs/post-01-setup.md) |
| `00:20:00` Installing Core Dependencies & UI Libraries | 패키지·shadcn 설치, Clerk 로그인, `/dashboard` | 완료 | [docs/post-02-clerk.md](docs/post-02-clerk.md) |
| `00:35:00` | Supabase 프로젝트 생성, `boards`·`columns`·`tasks` 테이블 설계 | 완료 | [docs/post-03-supabase-tables.md](docs/post-03-supabase-tables.md) |
| `??:??:??` | Supabase 클라이언트·Provider·services, Clerk 연동, RLS 정책 수정 → Create Board 저장·내 보드 불러오기(`loadBoards`) | 완료 | [docs/post-04-supabase-connect.md](docs/post-04-supabase-connect.md) |
| `01:57:35` | 대시보드 메인 화면 — 통계 카드, 그리드/리스트 전환, 검색창(모양만) | 완료 | [docs/post-05-dashboard.md](docs/post-05-dashboard.md) |
| `02:32:00` | 보드 상세 페이지(`/boards/[id]`) — 보드·컬럼 불러오기(`useBoard`), 보드용 Navbar 헤더 | 완료 | [docs/post-06-board-page.md](docs/post-06-board-page.md) |
| `03:50:00` | 보드 수정 Dialog — 제목·색상 변경(`updateBoard`), 새 컴퓨터 설정 에러 정리 | 완료 | [docs/post-07-edit-board-dialog.md](docs/post-07-edit-board-dialog.md) |
| `03:59:55` | 보드 상세 — 태스크 불러오기(`getTasksByBoard`, `ColumnWithTasks`), 컬럼 그리기, Filter·Add Task Dialog(모양만) | 완료 | [docs/post-08-columns-tasks.md](docs/post-08-columns-tasks.md) |
| `04:00:03` | 태스크 만들기(`createTask` → `createRealTask` → `taskService.createTask`), TaskCard(담당자·마감일·우선순위 색), 컬럼 가로 스크롤 | 완료 | [docs/post-09-create-task.md](docs/post-09-create-task.md) |
| `04:27:00` | 컬럼마다 Add Task 버튼 — 컬럼 안 태스크 추가 Dialog, `onCreateTask` 를 `handleCreateTask` 로 교체 | 완료 | [docs/post-10-column-add-task.md](docs/post-10-column-add-task.md) |
| `04:30:00` | 드래그 앤 드롭(dnd-kit) — `DndContext`·`useDroppable`·`useSortable`·`DragOverlay`, 카드 옮기기 저장(`moveTask`), tasks UPDATE RLS 정책 수정 | 완료 | [docs/post-11-drag-and-drop.md](docs/post-11-drag-and-drop.md) |
| 다음 | 컬럼 추가·이름 바꾸기, 필터 동작, `/dashboard` 로그인 보호 | 예정 | |

### 다음에 할 일

- [ ] `middleware.ts` 에서 `createRouteMatcher` + `auth.protect()` 로 `/dashboard` 보호하기 (지금은 로그아웃 상태에서도 열림)
- [x] Supabase 프로젝트 만들고 연결하기
- [ ] 보드·리스트·카드 CRUD
- [x] dnd-kit 드래그 앤 드롭
- [ ] 완성 후: Clerk → Supabase Auth 로 바꾸기, Next.js 16 업그레이드

## 다른 컴퓨터에서 시작하기

필요한 것: Node.js 20 이상 (작성한 환경은 Node 24, npm 11)

```bash
git clone https://github.com/atzzuny-hub/trello-clone.git
cd trello-clone
npm ci
cp .env.example .env
```

`.env` 에 Clerk 키를 넣는다. 키는 [Clerk 대시보드](https://dashboard.clerk.com) → `trelloClone` 애플리케이션 → API Keys 에서 복사한다.

```bash
npm run dev
```

http://localhost:3000 에서 Sign in / Sign Up 버튼이 보이면 성공.

> - `npm install` 대신 `npm ci` 를 쓰면 `package-lock.json` 에 적힌 버전 그대로 설치된다.
> - `.env` 는 git에 올라가지 않는다(`.gitignore` 의 `.env*`). 컴퓨터마다 새로 만들어야 한다.

## 환경 변수

| 이름 | 설명 |
|---|---|
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk 공개 키 (`pk_test_...`) — 브라우저에 노출돼도 됨 |
| `CLERK_SECRET_KEY` | Clerk 비밀 키 (`sk_test_...`) — 절대 공개 금지 |

## 영상과 다른 점 (버전 차이)

영상 이후 패키지가 업데이트돼서 그대로 따라 하면 에러가 나는 부분들. 자세한 설명은 `docs/` 의 정리 글 참고.

- **Next.js는 15로 고정** — `create-next-app@15`. 16으로 올리면 미들웨어 이름 등 구조가 영상과 달라진다.
- **React는 `~19.1.4` 이상** — 최신 `@clerk/nextjs` 가 보안 패치된 React만 허용한다.
- **`proxy.ts` 가 아니라 `middleware.ts`** — Clerk 문서는 Next.js 16 기준이라 `proxy.ts` 로 안내하지만, Next.js 15는 `middleware.ts` 만 실행한다.
- **lucide-react 1.x에는 `Trello` 아이콘이 없다** — 대신 `SquareKanban` 사용.
- **최신 shadcn은 `cn` 패키지와 통합 `radix-ui` 패키지를 쓴다** — `@radix-ui/react-*`, `clsx`, `tailwind-merge` 를 직접 import 하지 않는다.
- **Tailwind v4** — `tailwind.config.js` 없이 `app/globals.css` 에서 설정한다.

## 폴더 구조

```
app/
  layout.tsx          ClerkProvider 로 감싼 루트 레이아웃
  page.tsx            메인 페이지
  dashboard/page.tsx  대시보드 (작업 중)
components/
  navbar.tsx          로고 + 로그인 버튼 / Welcome + 대시보드 이동
  ui/                 shadcn 컴포넌트 (npx shadcn add 로 생성)
lib/utils.ts          cn 유틸
middleware.ts         clerkMiddleware
docs/                 블로그 정리 글과 썸네일
```

## 명령어

| 명령 | 설명 |
|---|---|
| `npm run dev` | 개발 서버 (Turbopack) |
| `npm run build` | 프로덕션 빌드 |
| `npm run lint` | ESLint |
| `npx tsc --noEmit` | 타입 검사 |
| `npx shadcn add <컴포넌트>` | shadcn 컴포넌트 추가 |
