-- 익명 계정은 일기 5개까지만 새로 만들 수 있습니다.
-- 이미 쓴 날짜를 고치는 것(upsert -> ON CONFLICT DO UPDATE)은 제한하지 않습니다.
--
-- 주의: INSERT ... ON CONFLICT DO UPDATE 는 충돌해서 UPDATE 로 처리되는 경우에도
-- INSERT 정책의 WITH CHECK 를 먼저 평가합니다. 그래서 개수 조건만 걸어두면
-- 한도에 도달한 뒤로는 기존 기록 수정까지 막혀 동기화가 통째로 실패합니다.
-- 해당 날짜의 행이 이미 있으면 통과시키는 조건을 함께 둡니다.

-- RLS 안에서 같은 테이블을 조회하면 정책이 다시 걸리므로 security definer 로 우회합니다.
-- 두 함수 모두 인자로 남의 데이터를 들여다볼 수 없게 auth.uid() 를 내부에서만 씁니다.
create or replace function public.my_entry_count()
returns integer
language sql
security definer
stable
set search_path = ''
as $$
  select count(*)::int from public.entries where user_id = (select auth.uid())
$$;

create or replace function public.my_entry_exists(d date)
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select exists (
    select 1 from public.entries
    where user_id = (select auth.uid()) and entry_date = d
  )
$$;

revoke all on function public.my_entry_count() from public;
revoke all on function public.my_entry_exists(date) from public;
grant execute on function public.my_entry_count() to authenticated;
grant execute on function public.my_entry_exists(date) to authenticated;

drop policy if exists "anonymous entry limit" on public.entries;

-- restrictive 라서 기존 허용 정책들과 AND 로 결합됩니다.
create policy "anonymous entry limit" on public.entries
  as restrictive for insert to authenticated
  with check (
    coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false) is not true
    or public.my_entry_exists(entry_date)
    or public.my_entry_count() < 5
  );
