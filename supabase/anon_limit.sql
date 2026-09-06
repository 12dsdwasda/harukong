-- 익명 계정은 일기 5개까지만 새로 만들 수 있습니다.
-- 이미 쓴 날짜를 고치는 것(upsert -> ON CONFLICT DO UPDATE)은 제한하지 않습니다.
--
-- 함정 1) INSERT ... ON CONFLICT DO UPDATE 는 충돌해서 UPDATE 로 처리되는 경우에도
--   INSERT 정책의 WITH CHECK 를 평가합니다. 개수 조건만 걸어두면 한도에 도달한 뒤로
--   기존 기록 수정까지 막혀 동기화가 통째로 실패합니다.
--   -> 해당 날짜의 행이 이미 있으면 통과시킵니다.
--
-- 함정 2) RLS 정책은 행마다 평가되는데, 한 문장으로 여러 행을 넣으면
--   아직 서로가 보이지 않아 전부 "현재 0개"로 통과합니다.
--   -> 문장이 끝난 뒤 총계를 확인하는 트리거를 함께 둡니다.

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
create policy "anonymous entry limit" on public.entries
  as restrictive for insert to authenticated
  with check (
    coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false) is not true
    or public.my_entry_exists(entry_date)
    or public.my_entry_count() < 5
  );

-- 문장 단위 최종 확인. 전이 테이블(inserted)이 비어 있으면 순수 UPDATE 이므로
-- 기존 기록 수정은 그대로 통과합니다.
create or replace function public.enforce_anon_entry_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  added integer;
  total integer;
begin
  select count(*) into added from inserted;
  if added = 0 then
    return null;
  end if;
  if coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false) is not true then
    return null;
  end if;
  select count(*) into total from public.entries where user_id = (select auth.uid());
  if total > 5 then
    raise exception '익명 계정은 기록을 5개까지만 만들 수 있어요'
      using errcode = 'P0001';
  end if;
  return null;
end
$$;

drop trigger if exists entries_anon_limit on public.entries;
create trigger entries_anon_limit
  after insert on public.entries
  referencing new table as inserted
  for each statement
  execute function public.enforce_anon_entry_limit();
