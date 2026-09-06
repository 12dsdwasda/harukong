/* Supabase 접속 정보.
   publishable(anon) 키는 공개용으로 설계된 키라 프런트엔드에 그대로 두어도 됩니다.
   실제 데이터 보호는 entries 테이블의 Row Level Security 정책이 담당합니다. */
export const SUPABASE_URL = 'https://qvymdvgscvfbknddrzan.supabase.co';
export const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_m2nif5m_jGBGkv5K4Wr1EA_ZiJZSVhA';

/* 스포티파이 Client ID.
   PKCE 방식이라 시크릿 없이 Client ID 만으로 동작하고, 이 값은 공개돼도 됩니다.
   비워두면 앱에서 "오늘의 노래" 기능이 자동으로 숨겨집니다.

   준비 방법: developer.spotify.com 에서 앱을 만들고
   Redirect URI 에 https://harukong-two.vercel.app/spotify 를 등록한 뒤
   Client ID 를 여기에 붙여넣으세요. */
export const SPOTIFY_CLIENT_ID = '';
