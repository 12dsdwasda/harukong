-- 사용자가 직접 만든 취미/자기관리 항목
create table if not exists public.tags (
  user_id uuid not null references auth.users(id) on delete cascade,
  id text not null,
  kind text not null check (kind in ('hobby','care')),
  emoji text not null default '🌱',
  label text not null check (char_length(label) between 1 and 12),
  created_at timestamptz not null default now(),
  primary key (user_id, id)
);

alter table public.tags enable row level security;

drop policy if exists "own tags select" on public.tags;
drop policy if exists "own tags insert" on public.tags;
drop policy if exists "own tags update" on public.tags;
drop policy if exists "own tags delete" on public.tags;

create policy "own tags select" on public.tags
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "own tags insert" on public.tags
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "own tags update" on public.tags
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "own tags delete" on public.tags
  for delete to authenticated using ((select auth.uid()) = user_id);

-- 항목이 무한정 늘어나지 않게 상한을 둡니다 (entries 와 같은 방식)
create or replace function public.my_tag_count()
returns integer language sql security definer stable set search_path = '' as $$
  select count(*)::int from public.tags where user_id = (select auth.uid())
$$;
revoke all on function public.my_tag_count() from public;
grant execute on function public.my_tag_count() to authenticated;

drop policy if exists "tag count limit" on public.tags;
create policy "tag count limit" on public.tags
  as restrictive for insert to authenticated
  with check (public.my_tag_count() < 40);


-- 콩나무 상태: 물뿌리개로 살린 날짜들
create table if not exists public.user_state (
  user_id uuid primary key references auth.users(id) on delete cascade,
  watered_dates date[] not null default '{}',
  updated_at timestamptz not null default now()
);

alter table public.user_state enable row level security;

drop policy if exists "own state select" on public.user_state;
drop policy if exists "own state insert" on public.user_state;
drop policy if exists "own state update" on public.user_state;

create policy "own state select" on public.user_state
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "own state insert" on public.user_state
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "own state update" on public.user_state
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
