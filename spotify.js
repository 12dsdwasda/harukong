/* ============================================================
   스포티파이 — PKCE 방식이라 클라이언트 시크릿 없이 동작합니다.
   콜백은 /spotify 페이지가 받아 localStorage 에 넘겨줍니다.
   (Supabase 구글 로그인도 ?code= 로 돌아오기 때문에 경로를 나눠야
    서로의 코드를 가로채지 않습니다.)
   ============================================================ */
import { SPOTIFY_CLIENT_ID } from './config.js';

const AUTH_URL = 'https://accounts.spotify.com/authorize';
const TOKEN_URL = 'https://accounts.spotify.com/api/token';
const API = 'https://api.spotify.com/v1';

const LS_TOKEN = 'harukong.spotify.token.v1';
const LS_VERIFIER = 'harukong.spotify.verifier.v1';
const LS_CALLBACK = 'harukong.spotify.callback.v1';

export const isConfigured = () => !!SPOTIFY_CLIENT_ID;
export const redirectUri = () => `${window.location.origin}/spotify`;

const lsGet = (k) => { try { return localStorage.getItem(k); } catch { return null; } };
const lsSet = (k, v) => { try { localStorage.setItem(k, v); } catch { /* noop */ } };
const lsDel = (k) => { try { localStorage.removeItem(k); } catch { /* noop */ } };

function randomString(len) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
  const bytes = new Uint8Array(len);
  crypto.getRandomValues(bytes);
  return [...bytes].map((b) => chars[b % chars.length]).join('');
}

function base64url(buf) {
  return btoa(String.fromCharCode(...new Uint8Array(buf)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function challengeFor(verifier) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
  return base64url(digest);
}

/* ---------------- 토큰 ---------------- */
function readToken() {
  try {
    const t = JSON.parse(lsGet(LS_TOKEN) || 'null');
    return t && t.access_token ? t : null;
  } catch { return null; }
}

function writeToken(t) {
  lsSet(LS_TOKEN, JSON.stringify({
    access_token: t.access_token,
    refresh_token: t.refresh_token || (readToken() || {}).refresh_token || '',
    expires_at: Date.now() + (t.expires_in || 3600) * 1000 - 60000,
  }));
}

export function isConnected() {
  return !!readToken();
}

export function disconnect() {
  lsDel(LS_TOKEN);
  lsDel(LS_VERIFIER);
}

export async function connect() {
  if (!isConfigured()) throw new Error('not configured');
  const verifier = randomString(64);
  lsSet(LS_VERIFIER, verifier);
  const params = new URLSearchParams({
    client_id: SPOTIFY_CLIENT_ID,
    response_type: 'code',
    redirect_uri: redirectUri(),
    code_challenge_method: 'S256',
    code_challenge: await challengeFor(verifier),
    scope: '',
  });
  window.location.assign(`${AUTH_URL}?${params}`);
}

/* /spotify 페이지가 남긴 결과를 처리합니다. 반환값: 'ok' | 'error' | null */
export async function consumeCallback() {
  const raw = lsGet(LS_CALLBACK);
  if (!raw) return null;
  lsDel(LS_CALLBACK);

  let data;
  try { data = JSON.parse(raw); } catch { return 'error'; }
  if (!data || !data.code) return 'error';

  const verifier = lsGet(LS_VERIFIER);
  if (!verifier) return 'error';

  try {
    const res = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code: data.code,
        redirect_uri: redirectUri(),
        client_id: SPOTIFY_CLIENT_ID,
        code_verifier: verifier,
      }),
    });
    if (!res.ok) return 'error';
    writeToken(await res.json());
    lsDel(LS_VERIFIER);
    return 'ok';
  } catch {
    return 'error';
  }
}

async function accessToken() {
  const t = readToken();
  if (!t) return null;
  if (Date.now() < t.expires_at) return t.access_token;
  if (!t.refresh_token) { disconnect(); return null; }
  try {
    const res = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: t.refresh_token,
        client_id: SPOTIFY_CLIENT_ID,
      }),
    });
    if (!res.ok) { disconnect(); return null; }
    writeToken(await res.json());
    return readToken().access_token;
  } catch {
    return null;
  }
}

/* ---------------- 검색 ---------------- */
export async function searchTracks(query) {
  const token = await accessToken();
  if (!token) throw new Error('not connected');
  const params = new URLSearchParams({ q: query, type: 'track', limit: '8' });
  const res = await fetch(`${API}/search?${params}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (res.status === 401) { disconnect(); throw new Error('not connected'); }
  if (!res.ok) throw new Error('search failed');
  const json = await res.json();
  return (json.tracks && json.tracks.items ? json.tracks.items : []).map(toSong);
}

function toSong(t) {
  const images = (t.album && t.album.images) || [];
  const small = images[images.length - 1] || images[0];
  return {
    id: t.id,
    name: t.name,
    artist: (t.artists || []).map((a) => a.name).join(', '),
    image: small ? small.url : '',
    url: (t.external_urls && t.external_urls.spotify) || '',
  };
}

export function isValidSong(s) {
  return !!s && typeof s === 'object'
    && typeof s.id === 'string' && s.id
    && typeof s.name === 'string' && s.name;
}
