-- =============================================
-- 1. profiles 테이블
-- =============================================
create table if not exists profiles (
  id uuid references auth.users on delete cascade primary key,
  display_name text not null,
  handle text unique not null, -- @handle로 검색
  avatar_url text,
  created_at timestamptz default now()
);

-- 2. groups 테이블 (가족/모임)
create table if not exists groups (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz default now()
);

-- 3. group_members 테이블
create table if not exists group_members (
  id uuid default gen_random_uuid() primary key,
  group_id uuid references groups(id) on delete cascade,
  user_id uuid references profiles(id) on delete cascade,
  role text default 'member' check (role in ('owner', 'member')),
  status text default 'pending' check (status in ('pending', 'accepted')),
  invited_by uuid references profiles(id),
  created_at timestamptz default now(),
  unique(group_id, user_id)
);

-- =============================================
-- RLS 활성화
-- =============================================
alter table profiles enable row level security;
alter table groups enable row level security;
alter table group_members enable row level security;

-- =============================================
-- profiles RLS
-- =============================================
create policy "누구나 프로필 조회 가능" on profiles
  for select using (auth.role() = 'authenticated');

create policy "본인 프로필만 수정" on profiles
  for all using (auth.uid() = id);

-- =============================================
-- groups RLS
-- =============================================
create policy "내 그룹 조회" on groups
  for select using (
    id in (
      select group_id from group_members
      where user_id = auth.uid() and status = 'accepted'
    )
  );

create policy "그룹 생성" on groups
  for insert with check (auth.role() = 'authenticated');

create policy "그룹 오너만 수정" on groups
  for update using (
    id in (
      select group_id from group_members
      where user_id = auth.uid() and role = 'owner'
    )
  );

-- =============================================
-- group_members RLS
-- =============================================
create policy "같은 그룹 멤버 조회" on group_members
  for select using (
    group_id in (
      select group_id from group_members
      where user_id = auth.uid()
    )
  );

create policy "초대 생성" on group_members
  for insert with check (auth.role() = 'authenticated');

create policy "본인 초대 수락/거절" on group_members
  for update using (user_id = auth.uid() or invited_by = auth.uid());

create policy "멤버 삭제" on group_members
  for delete using (
    user_id = auth.uid() or
    group_id in (
      select group_id from group_members
      where user_id = auth.uid() and role = 'owner'
    )
  );

-- =============================================
-- books RLS 업데이트
-- =============================================
-- 기존 books RLS가 있다면 삭제 후 재생성
drop policy if exists "books_select" on books;
drop policy if exists "books_insert" on books;
drop policy if exists "books_update" on books;
drop policy if exists "books_delete" on books;

alter table books enable row level security;

-- 같은 그룹 멤버의 책 볼 수 있음
create policy "books_select" on books
  for select using (
    user_id = auth.uid()::text or
    user_id in (
      select p.id::text from profiles p
      join group_members gm1 on gm1.user_id = p.id
      join group_members gm2 on gm2.group_id = gm1.group_id
      where gm2.user_id = auth.uid()
        and gm1.status = 'accepted'
        and gm2.status = 'accepted'
    )
    -- 레거시 데이터 (mom/dad/suyeon) 는 임시로 허용
    or user_id in ('mom', 'dad', 'suyeon')
  );

create policy "books_insert" on books
  for insert with check (user_id = auth.uid()::text);

create policy "books_update" on books
  for update using (user_id = auth.uid()::text);

create policy "books_delete" on books
  for delete using (user_id = auth.uid()::text);

-- =============================================
-- handle 검색 함수
-- =============================================
create or replace function search_profiles_by_handle(search_handle text)
returns table(id uuid, display_name text, handle text, avatar_url text)
language sql security definer
as $$
  select id, display_name, handle, avatar_url
  from profiles
  where lower(handle) like lower('%' || search_handle || '%')
    and id != auth.uid()
  limit 10;
$$;
