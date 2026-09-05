create table if not exists public.entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  entry_date date not null,
  mood text not null check (mood in ('veryhappy','happy','neutral','sad','verysad')),
  hobbies text[] not null default '{}',
  care text[] not null default '{}',
  kind text not null default 'oneliner' check (kind in ('oneliner','diary')),
  title text not null default '',
  body text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, entry_date)
);

alter table public.entries enable row level security;

drop policy if exists "own entries select" on public.entries;
drop policy if exists "own entries insert" on public.entries;
drop policy if exists "own entries update" on public.entries;
drop policy if exists "own entries delete" on public.entries;

create policy "own entries select" on public.entries
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "own entries insert" on public.entries
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "own entries update" on public.entries
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "own entries delete" on public.entries
  for delete to authenticated using ((select auth.uid()) = user_id);

create index if not exists entries_user_date_idx on public.entries (user_id, entry_date desc);

create or replace function public.touch_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin new.updated_at = now(); return new; end $$;

drop trigger if exists entries_touch_updated_at on public.entries;
create trigger entries_touch_updated_at before update on public.entries
  for each row execute function public.touch_updated_at();
