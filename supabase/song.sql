-- 기록에 붙는 "오늘의 노래" (스포티파이 트랙)
-- { id, name, artist, image, url } 형태의 작은 JSON 입니다.
alter table public.entries add column if not exists song jsonb;
