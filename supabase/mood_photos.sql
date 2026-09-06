-- 기분마다 직접 올린 콩이 얼굴.
--
-- 이미지는 Storage 가 아니라 이 테이블에 data URL 문자열로 그대로 넣습니다.
-- 288px webp 한 장이 보통 20~40KB 이고 사람당 최대 다섯 장이라 크지 않고,
-- entries/tags 와 같은 방식으로 동기화되므로 버킷 정책이나 CORS 를
-- 따로 신경 쓸 일이 없습니다. 앱도 이 문자열을 blob URL 로 바꿔 쓰기 때문에
-- 리포트를 이미지로 뽑을 때 캔버스가 오염되지 않습니다.
create table if not exists public.mood_photos (
  user_id uuid not null references auth.users(id) on delete cascade,
  mood text not null check (mood in ('veryhappy','happy','neutral','sad','verysad')),
  -- 앱의 MAX_PHOTO_CHARS 와 같은 값이어야 합니다 (app.js)
  image text not null check (image like 'data:image/%' and char_length(image) <= 700000),
  -- 배경을 지운 사진인지. 원으로 오린 사진에만 앱이 잉크 테두리를 둘러 줍니다
  cutout boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (user_id, mood)
);

alter table public.mood_photos enable row level security;

drop policy if exists "own mood photos select" on public.mood_photos;
drop policy if exists "own mood photos insert" on public.mood_photos;
drop policy if exists "own mood photos update" on public.mood_photos;
drop policy if exists "own mood photos delete" on public.mood_photos;

create policy "own mood photos select" on public.mood_photos
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "own mood photos insert" on public.mood_photos
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "own mood photos update" on public.mood_photos
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "own mood photos delete" on public.mood_photos
  for delete to authenticated using ((select auth.uid()) = user_id);
