# Trello Clone 클론 코딩 (3) — Supabase 프로젝트 & 테이블 설계

참고 영상: https://www.youtube.com/watch?v=ugxI1o5SyMs
영상 구간: `00:35:00`

(2)편에서 Clerk으로 로그인을 붙였다.
이번 글에서는 **Supabase에 프로젝트를 만들고**, Trello의 보드·리스트·카드를 저장할 **테이블 3개(`boards`, `columns`, `tasks`)를 설계**한다.
코드는 아직 없고, 전부 Supabase 대시보드의 **Table Editor**에서 마우스로 만들었다.

## Supabase?

**Postgres 데이터베이스를 바로 쓸 수 있게 해 주는 서비스**다.
테이블을 만들면 그 테이블을 읽고 쓰는 API가 자동으로 생겨서, 서버 코드를 따로 짜지 않아도 프런트엔드에서 데이터를 다룰 수 있다.

> Supabase에도 로그인 기능(Supabase Auth)이 있지만, 이번에는 **DB로만 쓰고 로그인은 Clerk을 그대로 쓴다.**
> 영상을 끝까지 완성한 다음 Supabase Auth로 바꿔 볼 계획이다.

---

## 1. 프로젝트 만들고 연결하기

1. https://supabase.com/dashboard 에서 가입
2. Organization 만들기 — 이름은 `trello-clone`, 요금제는 Free
3. **Create a new project**
   - **Project name**: 원하는 이름
   - **Database password**: Generate a password로 만들고 따로 저장해 둔다. 나중에 DB에 직접 접속할 때 필요하다.
   - **Region**: `Asia-Pacific`

**Project Settings → API** 에서 Project URL과 anon 키를 복사해 `.env` 에 넣는다.

`.env`

```bash
NEXT_PUBLIC_SUPABASE_URL=https://***.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=ey***
```

> - `NEXT_PUBLIC_` 이 붙은 값은 브라우저에도 전달된다. anon 키는 공개돼도 되는 키다. 대신 누가 무엇을 볼 수 있는지는 RLS 정책으로 막는다.
> - 지금 Supabase는 `ey...` 로 시작하는 anon 키를 **Legacy(예전 방식) 키**로 분류한다. 새 방식인 **publishable 키**(`sb_publishable_...`)를 쓰라고 안내한다. 권한은 anon 키와 같아서 RLS도 똑같이 동작한다. 이번에는 영상대로 anon 키를 쓴다.

---

## 2. 테이블 구조 한눈에 보기

```
보드(board)  ─┬─  리스트(column) "To Do"        ─┬─ 카드(task)
              │                                  └─ 카드(task)
              ├─  리스트(column) "In Progress"
              └─  리스트(column) "Done"
```

| 테이블 | Trello에서 | 관계 |
|---|---|---|
| `boards` | 보드 하나 | 사용자 한 명이 여러 보드를 가진다 |
| `columns` | 보드 안의 리스트(To Do, Done 등) | 보드 하나에 리스트 여러 개 → `board_id` 로 연결 |
| `tasks` | 리스트 안의 카드 | 리스트 하나에 카드 여러 개 → `column_id` 로 연결 |

- **Primary key(기본 키)**: 행(row) 하나를 구별하는 고유 번호. 여기서는 모든 테이블의 `id`.
- **Foreign key(외래 키)**: 다른 테이블의 기본 키를 가리키는 컬럼. `columns.board_id` 가 `boards.id` 를 가리키는 식이다. "이 리스트는 몇 번 보드 소속"이라는 뜻.
- **RLS(Row Level Security)**: 행 단위 보안. "로그인한 사람은 자기 보드만 볼 수 있다" 같은 규칙을 DB에 거는 기능.

---

## 3. 공통 설정

테이블을 만들 때 세 테이블이 모두 똑같이 한 설정이다.

- **Enable Row Level Security (RLS)**: 체크 (기본값, RECOMMENDED)
- **Enable Realtime**: 체크 안 함
- `id`, `created_at` 컬럼은 Supabase가 처음부터 넣어 준다. 그대로 둔다.

| 컬럼 | 타입 | 기본값 | 설명 |
|---|---|---|---|
| `id` | `int8` | 자동 증가 | 행마다 1, 2, 3 ... 순서로 자동으로 매겨지는 고유 번호. 기본 키(Primary)로 체크돼 있다. |
| `created_at` | `timestamptz` | `now()` | 행이 만들어진 시각. 값을 안 넣으면 저장하는 순간의 시각이 자동으로 들어간다. |

- `int8` 은 8바이트 정수(Postgres의 `bigint`)다. 아주 큰 숫자까지 담을 수 있어서 id에 쓴다.
- `timestamptz` 는 **시간대(time zone)까지 포함한 날짜+시각**이다. 서버와 사용자의 시간대가 달라도 헷갈리지 않는다.

---

## 4. `boards` 테이블 — 보드

| 컬럼 | 타입 | 기본값 | 설명 |
|---|---|---|---|
| `id` | `int8` | 자동 증가 | 보드 번호 (기본 키) |
| `created_at` | `timestamptz` | `now()` | 보드를 만든 시각 |
| `title` | `text` | - | 보드 이름. 예: '개인 프로젝트' |
| `description` | `text` | - | 보드 설명 |
| `color` | `text` | - | 보드 색상. 대시보드에서 보드를 구별하는 데 쓴다. |
| `user_id` | `text` | - | 이 보드를 만든 사람의 **Clerk 사용자 ID** |

**`user_id` 가 `text` 인 이유**
- Clerk 사용자 ID는 `user_2abc...` 처럼 **문자열**이다. 숫자(`int8`)나 `uuid` 타입으로 만들면 저장할 수 없다.
- 로그인은 Clerk이 하고 데이터는 Supabase에 있으니, 이 컬럼이 **"이 보드는 누구 것인가"를 이어 주는 연결 고리**다.
- 나중에 "내 보드만 보여 주기"를 할 때 `user_id = 로그인한 사람의 ID` 조건으로 걸러 낸다.

---

## 5. `columns` 테이블 — 리스트

| 컬럼 | 타입 | 기본값 | 설명 |
|---|---|---|---|
| `id` | `int8` | 자동 증가 | 리스트 번호 (기본 키) |
| `created_at` | `timestamptz` | `now()` | 리스트를 만든 시각 |
| `board_id` | `int8` | - | 이 리스트가 속한 **보드의 `id`** (외래 키) |
| `title` | `text` | - | 리스트 이름. 예: "To Do", "In Progress" |
| `sort_order` | `int4` | - | 보드 안에서 리스트가 놓이는 **순서** |

**`sort_order` 가 필요한 이유**
- DB는 행을 꺼낼 때 **순서를 보장하지 않는다.** 만든 순서대로 나온다는 보장이 없다.
- 그래서 "To Do → In Progress → Done" 순서를 숫자로 따로 저장해 두고, 불러올 때 `sort_order` 로 정렬한다.
- `int4` 는 4바이트 정수(`integer`)다. 순서 번호는 그렇게 큰 숫자가 필요 없어서 `int8` 보다 작은 타입을 쓴다.

### 외래 키 설정 — `board_id` → `boards.id`

**Foreign keys → Add foreign key relation** 에서 아래처럼 설정했다.

| 항목 | 값 |
|---|---|
| Select a schema | `public` |
| Select a table to reference to | `boards` |
| 연결할 컬럼 | `board_id` → `id` |
| Action if referenced row is updated | `No action` |
| Action if referenced row is removed | **`Cascade`** |

- **"Column types will be updated"** 라는 안내가 뜬다.
  외래 키는 가리키는 컬럼과 타입이 같아야 해서, `board_id` 의 타입이 `boards.id` 와 같은 `int8` 로 **자동으로 맞춰진다.** 그래서 `board_id` 의 타입은 직접 고르지 않아도 된다.
- **Action if referenced row is removed → `Cascade`**
  - 보드를 지우면 **그 보드에 속한 리스트도 같이 지워진다.**
  - 이걸 안 하면 보드는 없는데 리스트만 남는, 주인 없는 데이터가 생긴다.
- **Action if referenced row is updated → `No action`**
  - 보드의 `id` 가 바뀌려고 할 때, 그 보드를 가리키는 리스트가 있으면 **에러를 낸다.**
  - `id` 는 자동으로 매겨지고 바꿀 일이 없으니 기본값 그대로 둔다.

---

## 6. `tasks` 테이블 — 카드

| 컬럼 | 타입 | 기본값 | 설명 |
|---|---|---|---|
| `id` | `int8` | 자동 증가 | 카드 번호 (기본 키) |
| `created_at` | `timestamptz` | `now()` | 카드를 만든 시각 |
| `column_id` | `int8` | - | 이 카드가 속한 **리스트의 `id`** (외래 키) |
| `title` | `text` | - | 카드 제목. 예: '로그인 페이지 만들기' |
| `description` | `text` | - | 카드 상세 설명 |
| `assignee` | `text` | - | 담당자 이름 |
| `due_date` | `date` | - | 마감일 |
| `priority` | `text` | `'medium'` | 우선순위 |
| `sort_order` | `int4` | `0` | 리스트 안에서 카드가 놓이는 순서 |

- **`due_date` 가 `date` 인 이유**
  `timestamptz` 와 달리 `date` 는 **시각 없이 날짜만** 저장한다(`2026-11-03`). 마감일은 "몇 시 몇 분"까지 필요 없어서 날짜만 쓴다.
- **`priority` 기본값 `'medium'`**
  - 카드를 만들 때 우선순위를 안 고르면 자동으로 `medium` 이 들어간다.
  - 화면에는 `'medium'::text` 로 보이는데, `::text` 는 "이 값을 text 타입으로 쓴다"는 Postgres 표기다. 실제 저장되는 값은 그냥 `medium` 이다.
- **`sort_order` 기본값 `0`**
  새 카드는 일단 순서 `0` 으로 들어가고, 나중에 드래그 앤 드롭으로 옮길 때 이 값을 바꿔서 순서를 정한다.

**`column_id` — 처음엔 없었는데 나중에 추가했다**
- 처음 테이블을 만들 때는 영상을 따라 이 컬럼 없이 만들었다.
- 그런데 RLS 정책을 만들다 보니 "이 카드가 내 보드의 카드인가"를 확인하려면 **카드 → 리스트 → 보드 → 주인** 순서로 따라가야 했다. 카드가 어느 리스트 소속인지 모르면 확인할 방법이 없어서 추가했다.
- `columns.board_id` 처럼 **Add foreign key relation** 으로 `public.columns.id` 에 연결하고, **Action if referenced row is removed → `Cascade`** 로 설정했다. 리스트를 지우면 그 안의 카드도 같이 지워진다.

---

## 7. 같은 내용을 SQL로 보면?

Table Editor에서 마우스로 만든 것은 결국 아래 SQL을 실행한 것과 같다.
나중에 프로젝트를 새로 만들 때는 **SQL Editor**에 붙여 넣으면 한 번에 만들 수 있다.

```sql
create table public.boards (
  id bigint generated by default as identity primary key,
  created_at timestamptz not null default now(),
  title text,
  description text,
  color text,
  user_id text
);

create table public.columns (
  id bigint generated by default as identity primary key,
  created_at timestamptz not null default now(),
  board_id bigint references public.boards (id) on delete cascade,
  title text,
  sort_order integer
);

create table public.tasks (
  id bigint generated by default as identity primary key,
  created_at timestamptz not null default now(),
  title text,
  description text,
  assignee text,
  due_date date,
  priority text default 'medium',
  sort_order integer default 0,
  column_id bigint references public.columns (id) on delete cascade
);

alter table public.boards  enable row level security;
alter table public.columns enable row level security;
alter table public.tasks   enable row level security;
```

- `bigint` = `int8`, `integer` = `int4`. 대시보드는 짧은 이름, SQL은 긴 이름으로 보여 줄 뿐 같은 타입이다.
- `generated by default as identity` 가 **"id를 1, 2, 3… 자동으로 매겨라"** 라는 뜻이다.
- `references public.boards (id) on delete cascade` 가 5번에서 설정한 외래 키 + Cascade다. `tasks.column_id` 도 같은 방식이다.

---

## 8. RLS는 켜 두었다 — 그래서 지금은 데이터가 안 보인다

테이블을 만들 때 이런 안내가 뜬다.

> Policies are required to query data — 정책이 없으면 조회 결과가 빈 배열로 나온다.

- RLS를 켜면 **"누가 어떤 행을 볼 수 있는지" 규칙(policy)을 만들기 전까지는 아무도 데이터를 못 본다.**
- 그래서 앱에서 조회했는데 데이터가 있는데도 `[]` 가 나오면, 코드 버그가 아니라 **정책이 없어서**다.
- 로그인이 Clerk이라서, Supabase가 Clerk 로그인 정보를 알아볼 수 있게 연결해야 "내 보드만 보기" 같은 정책을 쓸 수 있다. 다음 단계에서 다룬다.
