/* ============================================================
   새싹콩 — 감정 일기장
   로컬 우선(local-first) 저장: 기록은 항상 이 기기에 먼저 저장되고,
   Supabase 로그인이 되면 백그라운드로 클라우드에 동기화됩니다.
   ============================================================ */
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from './config.js';
import { STAGES, CANS_PER_MONTH, stageIndexFor, daysToNextStage, plantSVG } from './growth.js';
import { MOOD_ORDER, MOODS, beanSVG } from './mood.js';
import { buildReport, reportCardHTML } from './report.js';
import * as spotify from './spotify.js';
import * as player from './player.js';

/* ---------------- 태그 ---------------- */
const HOBBIES = [
  { id: 'exercise', emoji: '💪', label: '운동' },
  { id: 'reading', emoji: '📚', label: '독서' },
  { id: 'walk', emoji: '🚶', label: '산책' },
  { id: 'music', emoji: '🎵', label: '음악감상' },
  { id: 'movie', emoji: '🎬', label: '영화' },
  { id: 'game', emoji: '🎮', label: '게임' },
  { id: 'cook', emoji: '🍳', label: '요리' },
  { id: 'draw', emoji: '🎨', label: '그림' },
];
const SELFCARE = [
  { id: 'meditate', emoji: '🧘', label: '명상' },
  { id: 'stretch', emoji: '🤸', label: '스트레칭' },
  { id: 'sleep', emoji: '😴', label: '수면' },
  { id: 'water', emoji: '💧', label: '물 마시기' },
  { id: 'skincare', emoji: '🧴', label: '스킨케어' },
  { id: 'tidy', emoji: '🧹', label: '정리정돈' },
  { id: 'gratitude', emoji: '🙏', label: '감사일기' },
  { id: 'rest', emoji: '🛋️', label: '휴식' },
];
/* 직접 추가한 항목에 붙일 수 있는 아이콘 */
const EMOJI_CHOICES = [
  '🌱','🏃','🚴','🏊','⚽','🧗','🎹','🎸',
  '✍️','📷','🧶','🌷','🐶','🐱','☕','🍰',
  '🛁','🧼','💊','📵','🌙','🕯️','📖','💬',
];

let TAG_BY_ID = new Map();
function rebuildTagIndex() {
  TAG_BY_ID = new Map([...HOBBIES, ...SELFCARE, ...state.customTags].map((t) => [t.id, t]));
}
function hobbyItems() {
  return [...HOBBIES, ...state.customTags.filter((t) => t.kind === 'hobby')];
}
function careItems() {
  return [...SELFCARE, ...state.customTags.filter((t) => t.kind === 'care')];
}

/* ---------------- 유틸 ---------------- */
const $ = (id) => document.getElementById(id);
const WEEK_KR = ['일', '월', '화', '수', '목', '금', '토'];
const pad = (n) => (n < 10 ? '0' + n : '' + n);
const dateKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

function escapeHTML(s) {
  return String(s).replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

/* 익명 계정으로 새로 만들 수 있는 기록 수. DB 의 restrictive 정책과 같은 값이어야 합니다
   (supabase/anon_limit.sql). 이미 쓴 날짜를 고치는 것은 제한하지 않습니다. */
const ANON_ENTRY_LIMIT = 5;

const LS_ENTRIES = 'harukong.entries.v1';
const LS_DELETED = 'harukong.deleted.v1';
const LS_TAGS = 'harukong.tags.v1';
const LS_TAGS_DELETED = 'harukong.tagsDeleted.v1';
const LS_WATERED = 'harukong.watered.v1';

const MAX_CUSTOM_TAGS = 40;
const LS_REPORT_SEEN = 'harukong.reportSeen.v1';

/* ---------------- 상태 ---------------- */
const today = new Date();
const todayKey = dateKey(today);

const state = {
  selectedMood: null,
  selectedHobbies: [],
  selectedCare: [],
  entries: {},          // { 'YYYY-MM-DD': { mood, hobbies, care, kind, title, body, updatedAt } }
  pendingDeletes: [],   // 오프라인 중에 지운 날짜들
  customTags: [],       // { id, kind:'hobby'|'care', emoji, label }
  pendingTagDeletes: [],
  watered: [],          // 물뿌리개로 메운 날짜들 'YYYY-MM-DD'
};

function normalizeEntry(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const mood = MOODS[raw.mood] ? raw.mood : 'neutral';
  return {
    mood,
    /* 아직 목록에 없는 id 도 그대로 둡니다. 직접 만든 항목은 클라우드에서
       나중에 도착할 수 있어서, 여기서 걸러내면 선택이 통째로 사라집니다.
       화면에 그릴 때 아는 것만 보여주면 됩니다. */
    hobbies: Array.isArray(raw.hobbies) ? raw.hobbies.filter((i) => typeof i === 'string') : [],
    care: Array.isArray(raw.care) ? raw.care.filter((i) => typeof i === 'string') : [],
    kind: raw.kind === 'diary' || raw.type === 'diary' ? 'diary' : 'oneliner',
    title: typeof raw.title === 'string' ? raw.title : '',
    body: typeof raw.body === 'string' ? raw.body : (typeof raw.text === 'string' ? raw.text : ''),
    song: spotify.isValidSong(raw.song) ? raw.song : null,
    updatedAt: raw.updatedAt || raw.savedAt || new Date(0).toISOString(),
  };
}

function loadLocal() {
  /* 직접 만든 항목을 먼저 싣고 색인을 만든 다음 일기를 읽습니다 */
  try {
    const t = JSON.parse(localStorage.getItem(LS_TAGS) || '[]');
    if (Array.isArray(t)) state.customTags = t.filter(isValidTag);
  } catch { /* noop */ }
  rebuildTagIndex();

  try {
    const raw = JSON.parse(localStorage.getItem(LS_ENTRIES) || '{}');
    for (const [k, v] of Object.entries(raw)) {
      const e = normalizeEntry(v);
      if (e) state.entries[k] = e;
    }
  } catch { /* 저장소를 못 읽어도 앱은 그대로 동작합니다 */ }
  try {
    const d = JSON.parse(localStorage.getItem(LS_DELETED) || '[]');
    if (Array.isArray(d)) state.pendingDeletes = d;
  } catch { /* noop */ }
  try {
    const td = JSON.parse(localStorage.getItem(LS_TAGS_DELETED) || '[]');
    if (Array.isArray(td)) state.pendingTagDeletes = td;
  } catch { /* noop */ }
  try {
    const w = JSON.parse(localStorage.getItem(LS_WATERED) || '[]');
    if (Array.isArray(w)) state.watered = w.filter((k) => /^\d{4}-\d{2}-\d{2}$/.test(k));
  } catch { /* noop */ }
  rebuildTagIndex();
}

function isValidTag(t) {
  return !!t && typeof t.id === 'string'
    && (t.kind === 'hobby' || t.kind === 'care')
    && typeof t.emoji === 'string' && t.emoji
    && typeof t.label === 'string' && t.label.length > 0 && t.label.length <= 12;
}

function persist() {
  try {
    localStorage.setItem(LS_ENTRIES, JSON.stringify(state.entries));
    localStorage.setItem(LS_DELETED, JSON.stringify(state.pendingDeletes));
    localStorage.setItem(LS_TAGS, JSON.stringify(state.customTags));
    localStorage.setItem(LS_TAGS_DELETED, JSON.stringify(state.pendingTagDeletes));
    localStorage.setItem(LS_WATERED, JSON.stringify(state.watered));
  } catch { /* 사파리 프라이빗 모드 등에서 실패할 수 있습니다 */ }
}

/* 오늘 이미 기록이 있으면 선택 상태를 채워 이어서 고칠 수 있게 합니다 */
function hydrateTodaySelection() {
  const e = state.entries[todayKey];
  if (!e) return;
  state.selectedMood = e.mood;
  state.selectedHobbies = e.hobbies.slice();
  state.selectedCare = e.care.slice();
}

/* ---------------- 렌더: 마스코트 ---------------- */
const mascotWrap = $('mascot-wrap');
const mascotBubble = $('mascot-bubble');

function renderMascot(bump) {
  const mood = state.selectedMood || 'neutral';
  mascotWrap.innerHTML = beanSVG(mood);
  if (state.selectedMood) {
    const phrases = MOODS[mood].phrases;
    mascotBubble.textContent = phrases[Math.floor(Math.random() * phrases.length)];
  } else {
    mascotBubble.textContent = '기분을 골라주면 콩이가 알려줄게요';
  }
  if (bump) {
    mascotWrap.classList.remove('bump');
    void mascotWrap.offsetWidth;
    mascotWrap.classList.add('bump');
  }
}

/* ---------------- 렌더: 기분 선택 ---------------- */
const moodRow = $('mood-row');
function renderMoodRow() {
  moodRow.innerHTML = '';
  for (const key of MOOD_ORDER) {
    const m = MOODS[key];
    const selected = state.selectedMood === key;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'mood-chip' + (selected ? ' selected' : '');
    btn.setAttribute('role', 'radio');
    btn.setAttribute('aria-checked', selected ? 'true' : 'false');
    btn.setAttribute('aria-label', m.label);
    btn.innerHTML = `<span class="mood-icon">${beanSVG(key)}</span><span class="mood-name">${m.short}</span>`;
    btn.addEventListener('click', () => {
      state.selectedMood = key;
      renderMoodRow();
      renderMascot(true);
    });
    moodRow.appendChild(btn);
  }
}

/* ---------------- 렌더: 태그 ---------------- */
function renderTagGrid(container, items, selectedArr, careStyle) {
  container.innerHTML = '';
  for (const item of items) {
    const on = selectedArr.includes(item.id);
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'tag-chip' + (on ? ' selected' : '') + (careStyle ? ' type-care' : '');
    chip.setAttribute('aria-pressed', on ? 'true' : 'false');
    chip.innerHTML = `<span class="tag-emoji">${item.emoji}</span><span class="tag-name">${item.label}</span>`;
    chip.addEventListener('click', () => {
      const idx = selectedArr.indexOf(item.id);
      if (idx > -1) selectedArr.splice(idx, 1); else selectedArr.push(item.id);
      renderTagGrid(container, items, selectedArr, careStyle);
    });
    container.appendChild(chip);
  }

  const add = document.createElement('button');
  add.type = 'button';
  add.className = 'tag-chip add-chip';
  add.innerHTML = '<span class="tag-emoji">＋</span><span class="tag-name">직접 추가</span>';
  add.addEventListener('click', () => openTagSheet(careStyle ? 'care' : 'hobby'));
  container.appendChild(add);
}

/* ---------------- 렌더: 홈 헤더 ---------------- */
function renderHomeHeader() {
  $('home-date').textContent =
    `${today.getFullYear()}년 ${today.getMonth() + 1}월 ${today.getDate()}일 (${WEEK_KR[today.getDay()]})`;
  const hour = new Date().getHours();
  $('home-greeting').textContent =
    hour < 11 ? '좋은 아침이에요 🌤️' : hour < 18 ? '오늘 하루는 어땠나요?' : '오늘 하루도 고생 많았어요 🌙';
}

/* ---------------- 오늘의 노래 ---------------- */
let songDraft = null;        // 지금 작성 중인 기록에 붙일 곡
let songTarget = 'oneliner'; // 어느 시트에서 열었는지
let songSearchTimer = null;

function songRowHTML(song) {
  if (!song) return '<span class="song-empty">🎵 오늘의 노래 고르기</span>';
  const cover = song.image
    ? `<img class="song-cover" src="${escapeHTML(song.image)}" alt="">`
    : '<span class="song-cover"></span>';
  return cover
    + '<span class="song-meta">'
    + `<span class="song-name">${escapeHTML(song.name)}</span>`
    + `<span class="song-artist">${escapeHTML(song.artist || '')}</span>`
    + '</span>';
}

function renderSongRows() {
  const on = spotify.isConfigured();
  for (const [btn, inner] of [['oneliner-song', 'oneliner-song-inner'], ['diary-song', 'diary-song-inner']]) {
    $(btn).hidden = !on;
    if (on) $(inner).innerHTML = songRowHTML(songDraft);
  }
}

function openSongSheet(target) {
  songTarget = target;
  $('song-q').value = '';
  $('song-results').innerHTML = '';
  $('song-hint').textContent = '검색해서 곡을 고르면 오늘 기록에 함께 남아요';
  $('song-clear').hidden = !songDraft;
  $('song-player-wrap').hidden = !songDraft;
  renderSongConnect();
  openOverlay('overlay-song');
  if (songDraft) playInSheet(songDraft);
}

function renderSongConnect() {
  const slot = $('song-connect-slot');
  const search = $('song-search-slot');
  if (spotify.isConnected()) {
    slot.innerHTML = '';
    search.hidden = false;
    setTimeout(() => $('song-q').focus(), 120);
    return;
  }
  search.hidden = true;
  slot.innerHTML = '<div class="song-connect">'
    + '<p>스포티파이를 연결하면 곡을 검색해서 오늘 기록에 남길 수 있어요.<br>'
    + '재생은 하지 않고 곡 정보만 가져옵니다.</p>'
    + '<button class="btn-spotify" type="button" id="song-connect-btn">'
    + '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">'
    + '<path d="M12 2a10 10 0 100 20 10 10 0 000-20zm4.6 14.4a.62.62 0 01-.86.21c-2.35-1.44-5.3-1.76-8.79-.96a.62.62 0 11-.28-1.21c3.81-.87 7.08-.5 9.72 1.11.29.18.39.57.21.85zm1.23-2.74a.78.78 0 01-1.07.26c-2.69-1.65-6.79-2.13-9.97-1.17a.78.78 0 11-.45-1.49c3.63-1.1 8.15-.57 11.24 1.33.36.22.48.7.25 1.07zm.11-2.86C14.72 8.88 9.4 8.7 6.32 9.63a.93.93 0 11-.54-1.78c3.54-1.08 9.41-.87 13.12 1.33a.93.93 0 11-.95 1.6z"/>'
    + '</svg>스포티파이 연결하기</button></div>';
  $('song-connect-btn').addEventListener('click', async () => {
    try { await spotify.connect(); } catch { toast('스포티파이 연결을 시작하지 못했어요'); }
  });
}

function renderSongResults(items) {
  const ul = $('song-results');
  ul.innerHTML = '';
  for (const song of items) {
    const li = document.createElement('li');
    const btn = document.createElement('button');
    btn.type = 'button';
    if (songDraft && songDraft.id === song.id) btn.className = 'picked';
    btn.innerHTML = songRowHTML(song) + '<span class="song-play" aria-hidden="true">▶</span>';
    btn.addEventListener('click', () => {
      songDraft = song;
      renderSongRows();
      renderSongResults(items);
      $('song-clear').hidden = false;
      playInSheet(song);
    });
    li.appendChild(btn);
    ul.appendChild(li);
  }
  $('song-hint').textContent = items.length ? '' : '검색 결과가 없어요';
}

/* 고른 곡을 노래 시트 안에서 바로 들려줍니다 */
async function playInSheet(song) {
  const wrap = $('song-player-wrap');
  wrap.hidden = false;
  try {
    await player.mount('song-player', song.id, { autoplay: true, height: 80 });
  } catch {
    wrap.hidden = true;
    toast(`🎵 ${song.name}`);
  }
}

async function runSongSearch() {
  const q = $('song-q').value.trim();
  if (!q) { $('song-results').innerHTML = ''; $('song-hint').textContent = ''; return; }
  $('song-hint').textContent = '찾는 중…';
  try {
    renderSongResults(await spotify.searchTracks(q));
  } catch (err) {
    if (String(err.message) === 'not connected') {
      renderSongConnect();
      toast('스포티파이를 다시 연결해주세요');
    } else {
      $('song-hint').textContent = '검색에 실패했어요';
    }
  }
}

async function initSpotify() {
  if (!spotify.isConfigured()) return;
  const result = await spotify.consumeCallback();
  if (result === 'ok') toast('스포티파이를 연결했어요 🎵');
  else if (result === 'error') toast('스포티파이 연결에 실패했어요');
  renderSongRows();
}

/* ---------------- 월간 리포트 ---------------- */
let reportCursor = null; // { year, month }

function prevMonthOf(d) {
  return { year: d.getMonth() === 0 ? d.getFullYear() - 1 : d.getFullYear(),
           month: d.getMonth() === 0 ? 12 : d.getMonth() };
}

function openReport(year, month) {
  reportCursor = { year, month };
  const r = buildReport(year, month, state.entries, state.watered, TAG_BY_ID);
  $('report-sub').textContent = r.empty
    ? '이 달에는 기록이 없어요'
    : `${year}년 ${month}월을 카드 한 장으로`;
  $('report-body').innerHTML = reportCardHTML(r);
  $('report-share').hidden = r.empty;
  openOverlay('overlay-report');
}

/* 달이 바뀌면 지난달 리포트를 한 번 안내합니다 */
function renderReportPrompt() {
  const slot = $('report-prompt-slot');
  const prev = prevMonthOf(today);
  const tag = `${prev.year}-${pad(prev.month)}`;
  if (lsGet(LS_REPORT_SEEN) === tag) { slot.innerHTML = ''; return; }

  const r = buildReport(prev.year, prev.month, state.entries, state.watered, TAG_BY_ID);
  if (r.empty) { slot.innerHTML = ''; return; }

  slot.innerHTML = '<div class="report-prompt">'
    + `<span>📊 ${prev.month}월 콩 리포트가 나왔어요</span>`
    + '<button type="button" id="rp-open">보기</button>'
    + '<button type="button" class="rp-close" id="rp-close" aria-label="닫기">×</button></div>';
  $('rp-open').addEventListener('click', () => {
    lsSet(LS_REPORT_SEEN, tag);
    openReport(prev.year, prev.month);
    renderReportPrompt();
  });
  $('rp-close').addEventListener('click', () => {
    lsSet(LS_REPORT_SEEN, tag);
    renderReportPrompt();
  });
}

/* 카드를 그대로 이미지로 만들어 공유하거나 저장합니다 */
let html2canvasReady = null;
function loadHtml2Canvas() {
  if (html2canvasReady) return html2canvasReady;
  html2canvasReady = new Promise((resolve, reject) => {
    const el = document.createElement('script');
    el.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
    el.onload = () => resolve(window.html2canvas);
    el.onerror = () => reject(new Error('load failed'));
    document.head.appendChild(el);
  });
  return html2canvasReady;
}

async function shareReport() {
  const card = document.getElementById('report-card');
  if (!card || !reportCursor) return;
  const btn = $('report-share');
  const label = btn.textContent;
  btn.disabled = true;
  btn.textContent = '만드는 중…';
  try {
    const h2c = await loadHtml2Canvas();
    const canvas = await h2c(card, {
      scale: 3,
      backgroundColor: '#FFFCF5',
      useCORS: true,
      logging: false,
    });
    const blob = await new Promise((res) => canvas.toBlob(res, 'image/png'));
    if (!blob) throw new Error('no blob');

    const name = `새싹콩_${reportCursor.year}년${reportCursor.month}월.png`;
    const file = new File([blob], name, { type: 'image/png' });

    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file], title: '새싹콩 월간 리포트' });
    } else {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
      toast('이미지를 저장했어요 📷');
    }
  } catch (err) {
    if (!(err && err.name === 'AbortError')) toast('이미지를 만들지 못했어요');
  } finally {
    btn.disabled = false;
    btn.textContent = label;
  }
}

/* ---------------- 콩나무 ---------------- */
function dayKeyBefore(n) {
  const d = new Date(today);
  d.setDate(d.getDate() - n);
  return dateKey(d);
}
function isKept(key) {
  return !!state.entries[key] || state.watered.includes(key);
}

/* 오늘 아직 안 썼더라도 어제까지 이어져 있으면 연속은 살아 있습니다 */
function computeStreak() {
  let n = isKept(todayKey) ? 0 : 1;
  let streak = 0;
  for (let i = 0; i < 3660; i++, n++) {
    if (!isKept(dayKeyBefore(n))) break;
    streak++;
  }
  return streak;
}

/* 마지막으로 이어진 날과 오늘 사이의 빈 날들 (오늘은 제외) */
function missedDays() {
  const gaps = [];
  for (let n = 1; n <= 7; n++) {
    const k = dayKeyBefore(n);
    if (isKept(k)) break;
    gaps.push(k);
  }
  return gaps;
}
function cansUsedThisMonth() {
  const m = todayKey.slice(0, 7);
  return state.watered.filter((k) => k.slice(0, 7) === m).length;
}
function cansLeft() {
  return Math.max(0, CANS_PER_MONTH - cansUsedThisMonth());
}
/* 이어붙일 수 있는 상태인지: 이전 기록이 있고, 남은 물뿌리개로 빈 날을 메울 수 있을 때 */
function rescuePlan() {
  const gaps = missedDays();
  if (!gaps.length) return null;
  const oldest = gaps[gaps.length - 1];
  const hasHistory = Object.keys(state.entries).some((k) => k < oldest);
  if (!hasHistory) return null;
  if (gaps.length > cansLeft()) return null;
  return gaps;
}

function renderGrowth() {
  const streak = computeStreak();
  const idx = stageIndexFor(streak);
  const stage = STAGES[idx];
  const withered = streak === 0 && Object.keys(state.entries).length > 0;

  $('grow-plant').innerHTML = plantSVG(idx, withered, true);
  $('grow-streak').textContent = streak > 0
    ? `${streak}일째 이어가는 중`
    : (withered ? '콩나무가 기다리고 있어요' : '오늘부터 콩을 심어볼까요');

  const left = daysToNextStage(streak);
  const next = STAGES[idx + 1];
  $('grow-stage').textContent = next
    ? `${stage.name} · ${next.name}까지 ${left}일`
    : `${stage.name} · 다 자랐어요!`;

  const base = stage.min;
  const span = next ? next.min - base : 1;
  const pct = next ? Math.min(100, Math.round(((streak - base) / span) * 100)) : 100;
  $('grow-fill').style.width = `${Math.max(4, pct)}%`;

  const plan = rescuePlan();
  const prompt = $('water-prompt');
  if (plan) {
    prompt.hidden = false;
    const days = plan.length === 1 ? '어제' : `최근 ${plan.length}일`;
    $('water-text').textContent =
      `${days} 기록을 놓쳤어요. 물뿌리개 ${plan.length}개로 이어갈 수 있어요 (${cansLeft()}개 남음)`;
  } else {
    prompt.hidden = true;
  }
}

function useWateringCan() {
  const plan = rescuePlan();
  if (!plan) return;
  for (const k of plan) if (!state.watered.includes(k)) state.watered.push(k);
  state.watered.sort();
  persist();
  renderGrowth();
  cloudPushState();
  toast('물뿌리개로 콩나무를 살렸어요 💧');
}

function renderGrowSheet() {
  const streak = computeStreak();
  const idx = stageIndexFor(streak);
  const stage = STAGES[idx];
  const withered = streak === 0 && Object.keys(state.entries).length > 0;

  $('grow-hero-plant').innerHTML = plantSVG(idx, withered);
  $('grow-hero-stage').textContent = streak > 0 ? `${stage.name} · ${streak}일째` : stage.name;
  $('grow-hero-hint').textContent = stage.hint;

  $('stage-list').innerHTML = STAGES.map((st, i) => {
    const cls = i === idx ? 'current' : (i < idx ? 'done' : '');
    const mark = i < idx ? '✓' : (i === idx ? '🌱' : '·');
    const days = st.min === 0 ? '시작' : `${st.min}일`;
    return `<li class="${cls}"><span class="st-mark">${mark}</span>`
      + `<span class="st-name">${st.name}</span><span class="st-days">${days}</span></li>`;
  }).join('');

  $('can-left').textContent = `${cansLeft()}개 남음`;
  $('can-total').textContent = String(CANS_PER_MONTH);
}

/* ---------------- 직접 추가한 항목 ---------------- */
let tagDraft = { kind: 'hobby', emoji: EMOJI_CHOICES[0] };

function openTagSheet(kind) {
  tagDraft = { kind, emoji: EMOJI_CHOICES[0] };
  $('tag-sub').textContent = kind === 'hobby'
    ? '자주 하는 취미를 직접 만들어 보세요'
    : '나만의 자기관리 항목을 만들어 보세요';
  $('tag-label').value = '';
  renderEmojiGrid();
  renderMyTags();
  openOverlay('overlay-tag');
  setTimeout(() => $('tag-label').focus(), 120);
}

function renderEmojiGrid() {
  const grid = $('emoji-grid');
  grid.innerHTML = '';
  for (const e of EMOJI_CHOICES) {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = e;
    b.className = e === tagDraft.emoji ? 'selected' : '';
    b.setAttribute('aria-label', `아이콘 ${e}`);
    b.addEventListener('click', () => { tagDraft.emoji = e; renderEmojiGrid(); });
    grid.appendChild(b);
  }
}

function renderMyTags() {
  const slot = $('my-tags-slot');
  const mine = state.customTags.filter((t) => t.kind === tagDraft.kind);
  if (!mine.length) { slot.innerHTML = ''; return; }
  slot.innerHTML = '<div class="my-tags"><h3>내가 만든 항목</h3><ul>'
    + mine.map((t) => `<li>${t.emoji} ${escapeHTML(t.label)}`
      + `<button type="button" data-del="${escapeHTML(t.id)}" aria-label="${escapeHTML(t.label)} 삭제">×</button></li>`).join('')
    + '</ul></div>';
  for (const btn of slot.querySelectorAll('[data-del]')) {
    btn.addEventListener('click', () => removeCustomTag(btn.dataset.del));
  }
}

function addCustomTag() {
  const label = $('tag-label').value.trim();
  if (!label) { toast('이름을 적어주세요'); return; }
  if (state.customTags.length >= MAX_CUSTOM_TAGS) {
    toast(`직접 만든 항목은 ${MAX_CUSTOM_TAGS}개까지예요`);
    return;
  }
  if ([...hobbyItems(), ...careItems()].some((t) => t.label === label)) {
    toast('이미 같은 이름이 있어요');
    return;
  }

  const tag = {
    id: `c_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
    kind: tagDraft.kind,
    emoji: tagDraft.emoji,
    label,
  };
  state.customTags.push(tag);
  state.pendingTagDeletes = state.pendingTagDeletes.filter((id) => id !== tag.id);
  rebuildTagIndex();
  persist();
  renderAll();
  renderMyTags();
  $('tag-label').value = '';
  cloudPushTag(tag);
  toast(`${tag.emoji} ${tag.label} 추가했어요`);
}

function removeCustomTag(id) {
  state.customTags = state.customTags.filter((t) => t.id !== id);
  state.selectedHobbies = state.selectedHobbies.filter((t) => t !== id);
  state.selectedCare = state.selectedCare.filter((t) => t !== id);
  if (!state.pendingTagDeletes.includes(id)) state.pendingTagDeletes.push(id);
  rebuildTagIndex();
  persist();
  renderAll();
  renderMyTags();
  cloudDeleteTag(id);
}

/* 구글로 로그인하기 전까지는 익명 계정으로 취급합니다 */
function isLimitedAccount() {
  return !(account && account.signedIn && !account.anonymous);
}
function entryCount() {
  return Object.keys(state.entries).length;
}
function limitReached() {
  return isLimitedAccount() && entryCount() >= ANON_ENTRY_LIMIT;
}
/* 오늘 기록이 이미 있으면 수정이므로 개수가 늘지 않습니다 */
function blockedByLimit() {
  return limitReached() && !state.entries[todayKey];
}

function renderLimitBar() {
  const bar = $('limit-bar');
  const used = entryCount();
  if (!isLimitedAccount() || used < ANON_ENTRY_LIMIT - 2) {
    bar.hidden = true;
    return;
  }
  const full = used >= ANON_ENTRY_LIMIT;
  bar.hidden = false;
  bar.classList.toggle('full', full);
  $('limit-text').textContent = full
    ? `로그인 없이 쓸 수 있는 ${ANON_ENTRY_LIMIT}개를 모두 채웠어요`
    : `로그인 없이 ${used}/${ANON_ENTRY_LIMIT}개 사용했어요`;
}

function renderDoneBanner() {
  const slot = $('done-banner-slot');
  const e = state.entries[todayKey];
  if (!e) { slot.innerHTML = ''; return; }
  slot.innerHTML =
    '<div class="done-banner">🌱 <b class="grow">오늘의 기록을 완료했어요!</b>'
    + '<button type="button" id="view-today">보기</button>'
    + '<button type="button" id="clear-today">다시 쓰기</button></div>';
  $('view-today').addEventListener('click', () => openDetail(todayKey));
  $('clear-today').addEventListener('click', () => {
    if (!confirm('오늘의 기록을 지우고 새로 쓸까요?')) return;
    delete state.entries[todayKey];
    queueDelete(todayKey);
    persist();
    renderDoneBanner();
    renderGrowth();
    renderLimitBar();
    cloudDelete(todayKey);
  });
}

/* ---------------- 토스트 / 시트 ---------------- */
let toastTimer = null;
function toast(msg) {
  const t = $('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2000);
}

let lastFocused = null;
function anyOverlayOpen() {
  return !!document.querySelector('.overlay.show');
}
function syncSheetState() {
  document.documentElement.classList.toggle('sheet-open', anyOverlayOpen());
}
function openOverlay(id) {
  lastFocused = document.activeElement;
  $(id).classList.add('show');
  syncSheetState();
}
function closeOverlay(id) {
  if (id === 'overlay-song') player.pause('song-player');
  if (id === 'overlay-detail') player.pause('detail-player');
  $(id).classList.remove('show');
  document.documentElement.style.setProperty('--kb', '0px');
  syncSheetState();
  if (lastFocused && lastFocused.focus) lastFocused.focus();
}

/* ---------------- 저장 ---------------- */
function saveEntry(kind, payload) {
  if (!state.selectedMood) {
    toast('먼저 오늘 기분을 골라주세요 🌱');
    return false;
  }
  if (blockedByLimit()) {
    promptSignIn();
    return false;
  }
  state.entries[todayKey] = {
    mood: state.selectedMood,
    hobbies: state.selectedHobbies.slice(),
    care: state.selectedCare.slice(),
    kind,
    title: payload.title || '',
    body: payload.body,
    song: songDraft,
    updatedAt: new Date().toISOString(),
  };
  state.pendingDeletes = state.pendingDeletes.filter((k) => k !== todayKey);
  persist();
  cloudPush(todayKey);
  return true;
}

function queueDelete(key) {
  if (!state.pendingDeletes.includes(key)) state.pendingDeletes.push(key);
}

/* ---------------- 캘린더 ---------------- */
const calCursor = new Date(today.getFullYear(), today.getMonth(), 1);

function renderCalendar() {
  const y = calCursor.getFullYear();
  const mo = calCursor.getMonth();
  $('cal-title').textContent = `${y}년 ${mo + 1}월`;

  const grid = $('cal-grid');
  grid.innerHTML = '';
  const startDow = new Date(y, mo, 1).getDay();
  const daysInMonth = new Date(y, mo + 1, 0).getDate();
  let monthHasEntry = false;

  for (let i = 0; i < startDow; i++) {
    const blank = document.createElement('div');
    blank.className = 'cal-cell empty';
    grid.appendChild(blank);
  }

  for (let d = 1; d <= daysInMonth; d++) {
    const key = `${y}-${pad(mo + 1)}-${pad(d)}`;
    const entry = state.entries[key];
    const cell = document.createElement(entry || key === todayKey ? 'button' : 'div');
    if (cell.tagName === 'BUTTON') cell.type = 'button';
    cell.className = 'cal-cell' + (key === todayKey ? ' today' : '') + (entry ? ' has-entry' : '');
    if (entry) {
      monthHasEntry = true;
      cell.innerHTML = `<span class="cal-num">${d}</span><span class="cal-icon">${beanSVG(entry.mood)}</span>`;
      cell.setAttribute('aria-label', `${mo + 1}월 ${d}일 ${MOODS[entry.mood].label}`);
      cell.addEventListener('click', () => openDetail(key));
    } else {
      cell.innerHTML = `<span class="cal-plain-num">${d}</span>`;
      if (key === todayKey) cell.addEventListener('click', () => switchTab('home'));
    }
    grid.appendChild(cell);
  }

  $('cal-empty').hidden = monthHasEntry;
}

function renderLegend() {
  const el = $('cal-legend');
  if (el.childElementCount) return;
  el.innerHTML = MOOD_ORDER
    .map((key) => `<div class="lg-item">${beanSVG(key)}<span>${MOODS[key].label}</span></div>`)
    .join('');
}

function openDetail(key) {
  const e = state.entries[key];
  const body = $('detail-body');
  if (!e) {
    body.innerHTML = '<p class="dd-empty">이 날의 기록이 없어요</p>';
  } else {
    const [yy, mm, dd] = key.split('-').map(Number);
    const d = new Date(yy, mm - 1, dd);
    const dateStr = `${mm}월 ${dd}일 (${WEEK_KR[d.getDay()]})`;
    const tags = [...e.hobbies, ...e.care]
      .map((id) => TAG_BY_ID.get(id))
      .filter(Boolean)
      .map((t) => `<span>${t.emoji} ${escapeHTML(t.label)}</span>`)
      .join('');
    body.innerHTML =
      `<div class="dd-mood">${beanSVG(e.mood)}<div>`
      + `<div class="dd-date">${dateStr}</div>`
      + `<div class="dd-mood-label">${MOODS[e.mood].label}</div></div></div>`
      + (tags ? `<div class="dd-tags">${tags}</div>` : '')

      + (e.title ? `<p class="dd-title">${escapeHTML(e.title)}</p>` : '')
      + `<p class="dd-text">${escapeHTML(e.body)}</p>`;
  }
  const wrap = $('detail-player-wrap');
  const song = e && e.song;
  wrap.hidden = !song;
  openOverlay('overlay-detail');
  if (song) {
    /* 캘린더를 누른 탭 제스처가 살아 있는 동안 재생을 걸어야
       브라우저 자동재생 차단에 걸리지 않습니다 */
    player.mount('detail-player', song.id, { autoplay: true, height: 80 })
      .catch(() => { wrap.hidden = true; });
  }
}

/* ---------------- 탭 ---------------- */
function switchTab(name) {
  for (const p of document.querySelectorAll('.page')) p.classList.remove('active');
  $('page-' + name).classList.add('active');
  for (const t of document.querySelectorAll('.tab')) {
    const on = t.dataset.tab === name;
    t.classList.toggle('active', on);
    t.setAttribute('aria-current', on ? 'page' : 'false');
  }
  if (name === 'calendar') { renderLegend(); renderCalendar(); }
}

/* ---------------- 전체 렌더 ---------------- */
function renderAll() {
  renderHomeHeader();
  renderDoneBanner();
  renderMascot(false);
  renderMoodRow();
  renderTagGrid($('hobby-grid'), hobbyItems(), state.selectedHobbies, false);
  renderTagGrid($('care-grid'), careItems(), state.selectedCare, true);
  renderLimitBar();
  renderGrowth();
  renderReportPrompt();
  if ($('page-calendar').classList.contains('active')) renderCalendar();
}

/* ---------------- 이벤트 연결 ---------------- */
for (const t of document.querySelectorAll('.tab')) {
  t.addEventListener('click', () => switchTab(t.dataset.tab));
}
for (const btn of document.querySelectorAll('[data-close]')) {
  btn.addEventListener('click', () => closeOverlay(btn.dataset.close));
}
for (const ov of document.querySelectorAll('.overlay')) {
  ov.addEventListener('click', (e) => { if (e.target === ov) closeOverlay(ov.id); });
}
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  const open = document.querySelector('.overlay.show');
  if (open) closeOverlay(open.id);
});

$('btn-oneliner').addEventListener('click', () => {
  if (!state.selectedMood) { toast('먼저 오늘 기분을 골라주세요 🌱'); return; }
  if (blockedByLimit()) { promptSignIn(); return; }
  const cur = state.entries[todayKey];
  const val = cur && cur.kind === 'oneliner' ? cur.body : '';
  songDraft = (cur && cur.song) || null;
  renderSongRows();
  $('oneliner-input').value = val;
  $('oneliner-count').textContent = String(val.length);
  openOverlay('overlay-oneliner');
  setTimeout(() => $('oneliner-input').focus(), 120);
});
$('oneliner-input').addEventListener('input', (e) => {
  $('oneliner-count').textContent = String(e.target.value.length);
});
$('oneliner-input').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') { e.preventDefault(); $('oneliner-save').click(); }
});
$('oneliner-save').addEventListener('click', () => {
  const val = $('oneliner-input').value.trim();
  if (!val) { toast('한 줄을 적어주세요'); return; }
  if (saveEntry('oneliner', { body: val })) {
    closeOverlay('overlay-oneliner');
    toast('오늘의 한 줄이 저장됐어요 🌱');
    renderDoneBanner();
    renderGrowth();
    renderLimitBar();
  }
});

$('btn-diary').addEventListener('click', () => {
  if (!state.selectedMood) { toast('먼저 오늘 기분을 골라주세요 🌱'); return; }
  if (blockedByLimit()) { promptSignIn(); return; }
  const cur = state.entries[todayKey];
  const isDiary = cur && cur.kind === 'diary';
  songDraft = (cur && cur.song) || null;
  renderSongRows();
  $('diary-title').value = isDiary ? cur.title : '';
  $('diary-text').value = isDiary ? cur.body : '';
  $('diary-count').textContent = String(isDiary ? cur.body.length : 0);
  openOverlay('overlay-diary');
  setTimeout(() => $('diary-text').focus(), 120);
});
$('diary-text').addEventListener('input', (e) => {
  $('diary-count').textContent = String(e.target.value.length);
});
$('diary-save').addEventListener('click', () => {
  const val = $('diary-text').value.trim();
  const title = $('diary-title').value.trim();
  if (!val) { toast('일기 내용을 적어주세요'); return; }
  if (saveEntry('diary', { title, body: val })) {
    closeOverlay('overlay-diary');
    toast('오늘의 일기가 저장됐어요 📔');
    renderDoneBanner();
    renderGrowth();
    renderLimitBar();
  }
});

$('oneliner-song').addEventListener('click', () => openSongSheet('oneliner'));
$('diary-song').addEventListener('click', () => openSongSheet('diary'));
$('song-q').addEventListener('input', () => {
  clearTimeout(songSearchTimer);
  songSearchTimer = setTimeout(runSongSearch, 350);
});
$('song-q').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') { e.preventDefault(); clearTimeout(songSearchTimer); runSongSearch(); }
});
$('song-clear').addEventListener('click', () => {
  songDraft = null;
  renderSongRows();
  player.pause('song-player');
  $('song-player-wrap').hidden = true;
  $('song-clear').hidden = true;
  $('song-results').innerHTML = '';
  $('song-q').value = '';
  toast('노래 선택을 지웠어요');
});

$('cal-report').addEventListener('click', () => {
  openReport(calCursor.getFullYear(), calCursor.getMonth() + 1);
});
$('report-share').addEventListener('click', shareReport);

$('grow-card').addEventListener('click', () => {
  renderGrowSheet();
  openOverlay('overlay-grow');
});
$('water-btn').addEventListener('click', useWateringCan);
$('tag-save').addEventListener('click', addCustomTag);
$('tag-label').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') { e.preventDefault(); addCustomTag(); }
});

$('cal-prev').addEventListener('click', () => {
  calCursor.setMonth(calCursor.getMonth() - 1);
  renderCalendar();
});
$('cal-next').addEventListener('click', () => {
  calCursor.setMonth(calCursor.getMonth() + 1);
  renderCalendar();
});
$('cal-today').addEventListener('click', () => {
  calCursor.setFullYear(today.getFullYear(), today.getMonth(), 1);
  renderCalendar();
});

/* 모바일 키보드가 올라오면 바텀 시트를 그만큼 밀어 올립니다 */
if (window.visualViewport) {
  const vv = window.visualViewport;
  const onViewport = () => {
    if (!anyOverlayOpen()) return;
    const kb = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
    document.documentElement.style.setProperty('--kb', `${Math.round(kb)}px`);
  };
  vv.addEventListener('resize', onViewport);
  vv.addEventListener('scroll', onViewport);
}

/* ---------------- Supabase 동기화 ---------------- */
const syncPill = $('sync-pill');
const syncText = $('sync-text');

const LS_LAST_USER = 'harukong.lastUser.v1';
const LS_MERGE_FLAG = 'harukong.mergeOnSignIn.v1';
const LS_LAST_ANON = 'harukong.lastAnon.v1';

let sb = null;
let userId = null;
let account = { signedIn: false, anonymous: true, email: '' };
let googleEnabled = null; // null = 아직 모름, false 면 버튼을 숨깁니다

const lsGet = (k) => { try { return localStorage.getItem(k); } catch { return null; } };
const lsSet = (k, v) => { try { localStorage.setItem(k, v); } catch { /* noop */ } };
const lsDel = (k) => { try { localStorage.removeItem(k); } catch { /* noop */ } };

/* 구글 로그인 전에는 배지 옆에 로그인 버튼을 띄우고,
   좁은 화면에서 둘이 부딪히지 않게 배지 문구를 줄입니다. */
const SHORT_SYNC = {
  ok: '저장됨',
  syncing: '동기화 중',
  off: '오프라인',
  error: '동기화 실패',
};

function needsLogin() {
  return !(account && account.signedIn && !account.anonymous);
}

function setSync(stateName, text) {
  syncPill.dataset.state = stateName;
  const login = needsLogin();
  syncText.textContent = login ? (SHORT_SYNC[stateName] || text) : text;
  $('login-btn').hidden = !login;
}

function syncedLabel() {
  if (!sb || !userId) return '이 기기에만 저장';
  return account.anonymous ? '클라우드 저장됨' : '구글 계정 동기화';
}

function toRow(key, e) {
  return {
    user_id: userId,
    entry_date: key,
    mood: e.mood,
    hobbies: e.hobbies,
    care: e.care,
    kind: e.kind,
    title: e.title,
    body: e.body,
    song: e.song,
    updated_at: e.updatedAt,
  };
}

async function cloudPush(key) {
  if (!sb || !userId) return;
  const e = state.entries[key];
  if (!e) return;
  try {
    setSync('syncing', '저장 중…');
    const { error } = await sb.from('entries').upsert(toRow(key, e), { onConflict: 'user_id,entry_date' });
    if (error) throw error;
    setSync('ok', syncedLabel());
  } catch {
    setSync('error', '나중에 다시 동기화');
  }
}

async function cloudDelete(key) {
  if (!sb || !userId) return;
  try {
    const { error } = await sb.from('entries').delete().eq('user_id', userId).eq('entry_date', key);
    if (error) throw error;
    state.pendingDeletes = state.pendingDeletes.filter((k) => k !== key);
    persist();
    setSync('ok', syncedLabel());
  } catch {
    setSync('error', '나중에 다시 동기화');
  }
}

async function syncAll() {
  if (!sb || !userId) return;
  setSync('syncing', '동기화 중…');
  try {
    // 오프라인 중에 지운 날짜부터 정리합니다
    for (const key of [...state.pendingDeletes]) {
      const { error } = await sb.from('entries').delete().eq('user_id', userId).eq('entry_date', key);
      if (!error) state.pendingDeletes = state.pendingDeletes.filter((k) => k !== key);
    }

    const { data, error } = await sb.from('entries').select('*');
    if (error) throw error;

    const remote = new Map((data || []).map((r) => [r.entry_date, r]));
    const toPush = [];
    let changed = false;

    // 이 기기에만 있거나 더 최신인 기록은 올립니다
    for (const [key, local] of Object.entries(state.entries)) {
      const r = remote.get(key);
      if (!r || new Date(local.updatedAt) > new Date(r.updated_at)) toPush.push(toRow(key, local));
    }
    // 클라우드에만 있거나 더 최신인 기록은 내려받습니다
    for (const [key, r] of remote) {
      if (state.pendingDeletes.includes(key)) continue;
      const local = state.entries[key];
      if (!local || new Date(r.updated_at) > new Date(local.updatedAt)) {
        state.entries[key] = normalizeEntry({
          mood: r.mood, hobbies: r.hobbies, care: r.care,
          kind: r.kind, title: r.title, body: r.body, song: r.song, updatedAt: r.updated_at,
        });
        changed = true;
      }
    }

    if (toPush.length) {
      const { error: upErr } = await sb.from('entries').upsert(toPush, { onConflict: 'user_id,entry_date' });
      if (upErr) throw upErr;
    }

    let extraChanged = false;
    try {
      extraChanged = (await syncTags()) || extraChanged;
      extraChanged = (await syncWatered()) || extraChanged;
    } catch { /* 항목·콩나무 동기화 실패는 일기 저장을 막지 않습니다 */ }

    if (changed || extraChanged) {
      hydrateTodaySelection();
      renderAll();
    } else {
      renderGrowth();
    }
    persist();
    setSync('ok', syncedLabel());
  } catch {
    setSync('error', '동기화 실패 · 눌러서 재시도');
  }
}

/* ---------------- 항목 / 콩나무 상태 동기화 ---------------- */
async function cloudPushTag(tag) {
  if (!sb || !userId) return;
  try {
    const { error } = await sb.from('tags').upsert({
      user_id: userId, id: tag.id, kind: tag.kind, emoji: tag.emoji, label: tag.label,
    }, { onConflict: 'user_id,id' });
    if (error) throw error;
  } catch { /* 다음 동기화 때 다시 올라갑니다 */ }
}

async function cloudDeleteTag(id) {
  if (!sb || !userId) return;
  try {
    const { error } = await sb.from('tags').delete().eq('user_id', userId).eq('id', id);
    if (error) throw error;
    state.pendingTagDeletes = state.pendingTagDeletes.filter((t) => t !== id);
    persist();
  } catch { /* 다음 동기화 때 다시 시도합니다 */ }
}

async function cloudPushState() {
  if (!sb || !userId) return;
  try {
    const { error } = await sb.from('user_state').upsert({
      user_id: userId, watered_dates: state.watered, updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' });
    if (error) throw error;
  } catch { /* 다음 동기화 때 다시 올라갑니다 */ }
}

async function syncTags() {
  if (!sb || !userId) return;
  for (const id of [...state.pendingTagDeletes]) {
    const { error } = await sb.from('tags').delete().eq('user_id', userId).eq('id', id);
    if (!error) state.pendingTagDeletes = state.pendingTagDeletes.filter((t) => t !== id);
  }

  const { data, error } = await sb.from('tags').select('*');
  if (error) throw error;

  const remote = new Map((data || []).map((r) => [r.id, r]));
  const localIds = new Set(state.customTags.map((t) => t.id));
  let changed = false;

  for (const [id, r] of remote) {
    if (state.pendingTagDeletes.includes(id) || localIds.has(id)) continue;
    const t = { id: r.id, kind: r.kind, emoji: r.emoji, label: r.label };
    if (isValidTag(t)) { state.customTags.push(t); changed = true; }
  }

  const toPush = state.customTags
    .filter((t) => !remote.has(t.id))
    .map((t) => ({ user_id: userId, id: t.id, kind: t.kind, emoji: t.emoji, label: t.label }));
  if (toPush.length) {
    const { error: upErr } = await sb.from('tags').upsert(toPush, { onConflict: 'user_id,id' });
    if (upErr) throw upErr;
  }

  if (changed) rebuildTagIndex();
  return changed;
}

/* 물뿌리개 기록은 더해지기만 하므로 양쪽을 합집합으로 맞춥니다 */
async function syncWatered() {
  if (!sb || !userId) return false;
  const { data, error } = await sb.from('user_state').select('watered_dates').eq('user_id', userId).maybeSingle();
  if (error) throw error;

  const remote = (data && data.watered_dates) || [];
  const merged = [...new Set([...state.watered, ...remote])].sort();
  const changed = merged.length !== state.watered.length;
  state.watered = merged;

  if (!data || merged.length !== remote.length) await cloudPushState();
  return changed;
}

/* 다른 계정으로 바뀌었을 때 이전 사용자의 기록을 이 기기에 남기지 않습니다 */
function wipeLocalEntries() {
  state.entries = {};
  state.pendingDeletes = [];
  state.customTags = [];
  state.pendingTagDeletes = [];
  state.watered = [];
  state.selectedMood = null;
  state.selectedHobbies = [];
  state.selectedCare = [];
  rebuildTagIndex();
  persist();
  renderAll();
}

/* ---------------- 계정 ---------------- */
/* 구글 프로바이더가 꺼져 있으면 로그인 버튼을 눌러도 오류 페이지로 빠지므로,
   프로젝트 설정을 읽어 준비됐을 때만 버튼을 보여줍니다. */
async function refreshProviders() {
  try {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/settings`, {
      headers: { apikey: SUPABASE_PUBLISHABLE_KEY },
    });
    if (!res.ok) return;
    const cfg = await res.json();
    googleEnabled = !!(cfg.external && cfg.external.google);
  } catch { /* 못 읽으면 판단을 보류하고 버튼은 그대로 둡니다 */ }
}

function renderAccountSheet(highlightLimit) {
  const body = $('account-body');
  if (!sb || !userId) {
    body.innerHTML =
      '<p class="acct-state">지금은 <b>이 기기에만</b> 저장되고 있어요.</p>'
      + '<p class="acct-note">기록은 그대로 남아 있어요. 연결이 돌아오면 자동으로 다시 백업합니다.</p>'
      + (limitReached()
        ? `<p class="acct-note warn">로그인 없이 쓸 수 있는 ${ANON_ENTRY_LIMIT}개를 모두 채웠어요.</p>`
        : '');
  } else if (account.anonymous) {
    const used = entryCount();
    const left = Math.max(0, ANON_ENTRY_LIMIT - used);
    body.innerHTML = limitReached()
      ? `<p class="acct-state">로그인 없이 쓸 수 있는 <b>${ANON_ENTRY_LIMIT}개를 모두 채웠어요.</b></p>`
        + '<p class="acct-note">구글로 로그인하면 이어서 계속 쓸 수 있어요. '
        + `지금까지 쓴 ${used}개도 그대로 따라가고, 다른 기기에서도 같은 일기를 볼 수 있습니다.</p>`
      : '<p class="acct-state">기록이 <b>클라우드에 백업</b>되고 있어요.</p>'
        + '<p class="acct-note">지금은 이 브라우저에만 연결된 임시 계정이라 '
        + `<b>${left}개</b>를 더 쓸 수 있어요. 구글로 로그인하면 개수 제한 없이, `
        + '다른 기기에서도 같은 일기를 볼 수 있습니다. 지금까지 쓴 기록도 그대로 따라갑니다.</p>';
  } else {
    body.innerHTML =
      `<p class="acct-state"><b>${escapeHTML(account.email || '구글 계정')}</b><br>으로 로그인되어 있어요.</p>`
      + '<p class="acct-note">어느 기기에서든 이 계정으로 로그인하면 같은 일기를 볼 수 있어요.</p>';
  }
  if (highlightLimit && limitReached()) {
    body.insertAdjacentHTML('afterbegin',
      '<p class="acct-badge">🌱 계속 쓰려면 로그인이 필요해요</p>');
  }
  const signedInWithGoogle = account.signedIn && !account.anonymous;
  const googleReady = googleEnabled !== false;
  if (!signedInWithGoogle && !googleReady) {
    body.insertAdjacentHTML('beforeend',
      '<p class="acct-note warn">구글 로그인은 아직 준비 중이에요. 그동안에도 기록은 안전하게 백업됩니다.</p>');
  }
  $('acct-google').hidden = signedInWithGoogle || !googleReady;
  $('acct-signout').hidden = !signedInWithGoogle;
}

/* 제한에 걸렸을 때 계정 시트를 강조해서 엽니다 */
function promptSignIn() {
  toast(`로그인 없이 쓸 수 있는 ${ANON_ENTRY_LIMIT}개를 모두 채웠어요`);
  openAccountSheet(true);
}

function openAccountSheet(highlightLimit) {
  renderAccountSheet(highlightLimit);
  openOverlay('overlay-account');
  // 대시보드에서 방금 켰더라도 새로고침 없이 반영되도록 다시 확인합니다
  refreshProviders().then(() => renderAccountSheet(highlightLimit));
}

function googleErrorMessage(err) {
  const msg = String((err && (err.message || err.error_description)) || '').toLowerCase();
  if (msg.includes('not enabled') || msg.includes('unsupported provider')) {
    return '구글 로그인이 아직 준비되지 않았어요';
  }
  if (msg.includes('already') && msg.includes('linked')) {
    return '이미 다른 계정에 연결된 구글 계정이에요';
  }
  return '구글 로그인에 실패했어요';
}

async function signInWithGoogle() {
  if (!sb) { toast('연결이 끊겨 있어요. 잠시 후 다시 시도해주세요'); return; }
  const redirectTo = window.location.origin + window.location.pathname;
  try {
    // 익명으로 쓰던 중이면 같은 계정에 구글을 덧붙여 기존 일기를 그대로 유지합니다
    if (account.signedIn && account.anonymous) {
      lsSet(LS_MERGE_FLAG, '1');
      const { error } = await sb.auth.linkIdentity({ provider: 'google', options: { redirectTo } });
      if (!error) return;
      lsDel(LS_MERGE_FLAG);
    }
    const { error } = await sb.auth.signInWithOAuth({ provider: 'google', options: { redirectTo } });
    if (error) throw error;
  } catch (err) {
    lsDel(LS_MERGE_FLAG);
    toast(googleErrorMessage(err));
  }
}

async function signOutAccount() {
  if (!sb) return;
  const ok = confirm('로그아웃할까요?\n이 기기에 있는 기록은 지워지고, 다시 로그인하면 클라우드에서 그대로 불러옵니다.');
  if (!ok) return;
  try { await sb.auth.signOut(); } catch { /* 세션이 이미 없어도 진행합니다 */ }
  lsDel(LS_LAST_USER);
  lsDel(LS_LAST_ANON);
  lsDel(LS_MERGE_FLAG);
  wipeLocalEntries();
  userId = null;
  account = { signedIn: false, anonymous: true, email: '' };
  closeOverlay('overlay-account');
  toast('로그아웃했어요');
  await initCloud();
}

async function applySession(session) {
  const prevUser = lsGet(LS_LAST_USER);
  const prevAnon = lsGet(LS_LAST_ANON) === '1';
  const merging = lsGet(LS_MERGE_FLAG) === '1';

  userId = session.user.id;
  account = {
    signedIn: true,
    anonymous: session.user.is_anonymous === true,
    email: session.user.email || '',
  };

  // 진짜 계정끼리 바뀐 경우에만 이 기기를 비웁니다.
  // 직전이 익명이었다면 그 일기는 이 사람 것이므로 새 계정으로 올려 보냅니다
  // (구글 연결이 실패해 일반 로그인으로 넘어간 경우도 여기에 해당합니다).
  if (prevUser && prevUser !== userId && !merging && !prevAnon) wipeLocalEntries();

  lsDel(LS_MERGE_FLAG);
  lsSet(LS_LAST_USER, userId);
  lsSet(LS_LAST_ANON, account.anonymous ? '1' : '0');

  setSync('syncing', '동기화 중…');
  await syncAll();
  renderLimitBar();
  renderDoneBanner();
  if ($('overlay-account').classList.contains('show')) renderAccountSheet();
}

/* 구글에서 돌아왔을 때 URL 에 실린 오류를 읽고 주소창을 정리합니다 */
function consumeAuthRedirect() {
  const q = new URLSearchParams(window.location.search);
  const h = new URLSearchParams(window.location.hash.replace(/^#/, ''));
  const err = q.get('error_description') || q.get('error') || h.get('error_description') || h.get('error');
  const touched = err || q.has('code') || h.has('access_token');
  if (touched) {
    try { history.replaceState({}, '', window.location.pathname); } catch { /* noop */ }
  }
  if (err) toast(googleErrorMessage({ message: err }));
}

async function initCloud() {
  setSync('syncing', '연결 중…');
  try {
    const { createClient } = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.58.0/+esm');
    sb = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        flowType: 'pkce',
        storageKey: 'harukong.auth',
      },
    });

    sb.auth.onAuthStateChange((_event, session) => {
      if (!session) return;
      const isAnon = session.user.is_anonymous === true;
      if (session.user.id !== userId || isAnon !== account.anonymous) applySession(session);
    });

    refreshProviders();

    let { data: { session } } = await sb.auth.getSession();
    consumeAuthRedirect();

    if (!session) {
      const { data, error } = await sb.auth.signInAnonymously();
      if (error) throw error;
      session = data.session;
    }
    if (!session) throw new Error('no session');

    await applySession(session);
  } catch (err) {
    sb = null;
    userId = null;
    account = { signedIn: false, anonymous: true, email: '' };
    const msg = String((err && (err.message || err.error_description)) || '');
    setSync('off', msg.includes('Anonymous') ? '이 기기에만 저장' : '오프라인 · 이 기기에만 저장');
  }
}

syncPill.addEventListener('click', () => openAccountSheet(false));
$('login-btn').addEventListener('click', async () => {
  await refreshProviders();
  if (googleEnabled === false) { openAccountSheet(false); return; }
  signInWithGoogle();
});
$('limit-login').addEventListener('click', () => openAccountSheet(true));
$('acct-google').addEventListener('click', signInWithGoogle);
$('acct-signout').addEventListener('click', signOutAccount);
$('acct-sync').addEventListener('click', () => {
  if (sb && userId) syncAll().then(renderAccountSheet);
  else initCloud().then(renderAccountSheet);
});

window.addEventListener('online', () => { if (sb && userId) syncAll(); });
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && sb && userId) syncAll();
});

/* ---------------- 시작 ---------------- */
loadLocal();
hydrateTodaySelection();
renderAll();
renderSongRows();
initCloud();
initSpotify();
