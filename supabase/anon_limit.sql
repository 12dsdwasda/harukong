-- 익명 계정은 일기 5개까지만 새로 만들 수 있습니다.
-- 이미 쓴 기록을 고치는 것(같은 날짜 upsert -> UPDATE)은 제한하지 않습니다.

-- RLS 안에서 같은 테이블을 세면 정책이 다시 걸리므로 security definer 로 우회합니다.
-- 인자를 받지 않고 auth.uid() 만 쓰므로 남의 개수는 셀 수 없습니다.
create or replace function public.my_entry_count()
returns integer
language sql
security definer
stable
set search_path = ''
as $$
  select count(*)::int from public.entries where user_id = (select auth.uid())
$$;

revoke all on function public.my_entry_count() from public;
grant execute on function public.my_entry_count() to authenticated;

drop policy if exists "anonymous entry limit" on public.entries;

-- restrictive 라서 기존 허용 정책들과 AND 로 결합됩니다.
create policy "anonymous entry limit" on public.entries
  as restrictive for insert to authenticated
  with check (
    coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false) is not true
    or public.my_entry_count() < 5
  );
