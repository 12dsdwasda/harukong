/* ============================================================
   하루콩 — 감정 일기장
   로컬 우선(local-first) 저장: 기록은 항상 이 기기에 먼저 저장되고,
   Supabase 로그인이 되면 백그라운드로 클라우드에 동기화됩니다.
   ============================================================ */
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from './config.js';

/* ---------------- 기분 정의 & 콩이 SVG ---------------- */
const MOOD_ORDER = ['veryhappy', 'happy', 'neutral', 'sad', 'verysad'];
const MOODS = {
  veryhappy: {
    label: '매우 기쁨', short: '최고예요',
    body: 'var(--mood-veryhappy)', dark: 'var(--mood-veryhappy-dark)',
    leaf: '#6FAE7C', leafDeep: '#4C8C5A', angle: -8,
    phrases: ['오늘 정말 좋은 하루였네요! 🎉', '콩이도 신나요! 이 기분 오래오래 간직해요'],
  },
  happy: {
    label: '기쁨', short: '좋아요',
    body: 'var(--mood-happy)', dark: 'var(--mood-happy-dark)',
    leaf: '#5FA06E', leafDeep: '#417955', angle: -3,
    phrases: ['기분 좋은 하루네요 :)', '작은 행복도 소중해요, 콩이가 응원할게요'],
  },
  neutral: {
    label: '중간', short: '그냥 그래요',
    body: 'var(--mood-neutral)', dark: 'var(--mood-neutral-dark)',
    leaf: '#9BAA82', leafDeep: '#7C8C62', angle: 0,
    phrases: ['평범한 하루도 괜찮아요', '있는 그대로의 오늘을 기록해봐요'],
  },
  sad: {
    label: '슬픔', short: '속상해요',
    body: 'var(--mood-sad)', dark: 'var(--mood-sad-dark)',
    leaf: '#8CA292', leafDeep: '#6D8375', angle: 9,
    phrases: ['오늘 조금 힘들었군요', '콩이가 옆에 있어요, 천천히 적어봐요'],
  },
  verysad: {
    label: '매우 슬픔', short: '힘들어요',
    body: 'var(--mood-verysad)', dark: 'var(--mood-verysad-dark)',
    leaf: '#77888A', leafDeep: '#5C6C6E', angle: 20,
    phrases: ['많이 지친 하루였겠어요', '괜찮아요, 오늘은 푹 쉬어도 돼요'],
  },
};

function leafMarkup(mood, angle) {
  const m = MOODS[mood];
  return `<g transform="rotate(${angle} 50 22)">`
    + `<path d="M50,27 C37,23 32,7 43,3 C48,11 50,19 50,27 Z" fill="${m.leaf}" stroke="${m.leafDeep}" stroke-width="1.2"/>`
    + `<path d="M50,27 C63,23 68,7 57,3 C52,11 50,19 50,27 Z" fill="${m.leaf}" stroke="${m.leafDeep}" stroke-width="1.2"/>`
    + `<line x1="50" y1="27" x2="50" y2="35" stroke="${m.leafDeep}" stroke-width="3" stroke-linecap="round"/>`
    + `</g>`;
}

function faceMarkup(mood) {
  switch (mood) {
    case 'veryhappy':
      return '<path d="M20,55 Q27,47 34,55" stroke="#4A4038" stroke-width="3.2" fill="none" stroke-linecap="round"/>'
        + '<path d="M66,55 Q73,47 80,55" stroke="#4A4038" stroke-width="3.2" fill="none" stroke-linecap="round"/>'
        + '<ellipse cx="26" cy="66" rx="6.5" ry="4.2" fill="#F49CAE" opacity=".6"/>'
        + '<ellipse cx="74" cy="66" rx="6.5" ry="4.2" fill="#F49CAE" opacity=".6"/>'
        + '<path d="M33,70 Q50,90 67,70 Q50,80 33,70 Z" fill="#4A4038"/>'
        + '<g stroke="#E0A63A" stroke-width="2.4" stroke-linecap="round">'
        + '<path d="M10,40 l6,6M16,40 l-6,6"/><path d="M84,36 l6,6M90,36 l-6,6"/></g>';
    case 'happy':
      return '<circle cx="29" cy="58" r="3.6" fill="#4A4038"/><circle cx="30" cy="57" r="1" fill="#fff"/>'
        + '<circle cx="71" cy="58" r="3.6" fill="#4A4038"/><circle cx="72" cy="57" r="1" fill="#fff"/>'
        + '<ellipse cx="27" cy="67" rx="5.5" ry="3.6" fill="#F49CAE" opacity=".5"/>'
        + '<ellipse cx="73" cy="67" rx="5.5" ry="3.6" fill="#F49CAE" opacity=".5"/>'
        + '<path d="M36,73 Q50,84 64,73" stroke="#4A4038" stroke-width="3" fill="none" stroke-linecap="round"/>';
    case 'neutral':
      return '<circle cx="30" cy="60" r="3.2" fill="#4A4038"/>'
        + '<circle cx="70" cy="60" r="3.2" fill="#4A4038"/>'
        + '<line x1="39" y1="76" x2="61" y2="76" stroke="#4A4038" stroke-width="3" stroke-linecap="round"/>';
    case 'sad':
      return '<path d="M23,57 Q29,62 35,58" stroke="#4A4038" stroke-width="2.8" fill="none" stroke-linecap="round"/>'
        + '<path d="M65,58 Q71,62 77,57" stroke="#4A4038" stroke-width="2.8" fill="none" stroke-linecap="round"/>'
        + '<path d="M74,64 q4,7 0,12 q-4,-2 -4,-7 q0,-3 4,-5 Z" fill="#89A9BC"/>'
        + '<path d="M37,80 Q50,70 63,80" stroke="#4A4038" stroke-width="3" fill="none" stroke-linecap="round"/>';
    case 'verysad':
      return '<path d="M21,54 L33,61 M33,54 L21,61" stroke="#4A4038" stroke-width="2.6" stroke-linecap="round"/>'
        + '<path d="M67,54 L79,61 M79,54 L67,61" stroke="#4A4038" stroke-width="2.6" stroke-linecap="round"/>'
        + '<path d="M21,63 q5,8 0,13 q-5,-2 -5,-8 q0,-3 5,-5 Z" fill="#89A9BC"/>'
        + '<path d="M79,63 q5,8 0,13 q-5,-2 -5,-8 q0,-3 5,-5 Z" fill="#89A9BC"/>'
        + '<path d="M35,84 Q50,70 65,84" stroke="#4A4038" stroke-width="3.4" fill="none" stroke-linecap="round"/>'
        + '<ellipse cx="50" cy="2" rx="16" ry="6" fill="#B7C6CE"/>'
        + '<g stroke="#93AEBC" stroke-width="2" stroke-linecap="round"><path d="M42,9 l-2,6"/><path d="M50,10 l-2,6"/><path d="M58,9 l-2,6"/></g>';
    default:
      return '';
  }
}

function beanSVG(mood) {
  const m = MOODS[mood] ? mood : 'neutral';
  const c = MOODS[m];
  return '<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" role="img" aria-hidden="true">'
    + leafMarkup(m, c.angle)
    + `<ellipse cx="50" cy="64" rx="35" ry="31" fill="${c.body}" stroke="${c.dark}" stroke-width="2"/>`
    + faceMarkup(m)
    + '</svg>';
}

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
const TAG_BY_ID = new Map([...HOBBIES, ...SELFCARE].map((t) => [t.id, t]));

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

const LS_ENTRIES = 'harukong.entries.v1';
const LS_DELETED = 'harukong.deleted.v1';

/* ---------------- 상태 ---------------- */
const today = new Date();
const todayKey = dateKey(today);

const state = {
  selectedMood: null,
  selectedHobbies: [],
  selectedCare: [],
  entries: {},          // { 'YYYY-MM-DD': { mood, hobbies, care, kind, title, body, updatedAt } }
  pendingDeletes: [],   // 오프라인 중에 지운 날짜들
};

function normalizeEntry(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const mood = MOODS[raw.mood] ? raw.mood : 'neutral';
  return {
    mood,
    hobbies: Array.isArray(raw.hobbies) ? raw.hobbies.filter((i) => TAG_BY_ID.has(i)) : [],
    care: Array.isArray(raw.care) ? raw.care.filter((i) => TAG_BY_ID.has(i)) : [],
    kind: raw.kind === 'diary' || raw.type === 'diary' ? 'diary' : 'oneliner',
    title: typeof raw.title === 'string' ? raw.title : '',
    body: typeof raw.body === 'string' ? raw.body : (typeof raw.text === 'string' ? raw.text : ''),
    updatedAt: raw.updatedAt || raw.savedAt || new Date(0).toISOString(),
  };
}

function loadLocal() {
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
}

function persist() {
  try {
    localStorage.setItem(LS_ENTRIES, JSON.stringify(state.entries));
    localStorage.setItem(LS_DELETED, JSON.stringify(state.pendingDeletes));
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
}

/* ---------------- 렌더: 홈 헤더 ---------------- */
function renderHomeHeader() {
  $('home-date').textContent =
    `${today.getFullYear()}년 ${today.getMonth() + 1}월 ${today.getDate()}일 (${WEEK_KR[today.getDay()]})`;
  const hour = new Date().getHours();
  $('home-greeting').textContent =
    hour < 11 ? '좋은 아침이에요 🌤️' : hour < 18 ? '오늘 하루는 어땠나요?' : '오늘 하루도 고생 많았어요 🌙';
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
function openOverlay(id) {
  lastFocused = document.activeElement;
  $(id).classList.add('show');
}
function closeOverlay(id) {
  $(id).classList.remove('show');
  document.documentElement.style.setProperty('--kb', '0px');
  if (lastFocused && lastFocused.focus) lastFocused.focus();
}
function anyOverlayOpen() {
  return !!document.querySelector('.overlay.show');
}

/* ---------------- 저장 ---------------- */
function saveEntry(kind, payload) {
  if (!state.selectedMood) {
    toast('먼저 오늘 기분을 골라주세요 🌱');
    return false;
  }
  state.entries[todayKey] = {
    mood: state.selectedMood,
    hobbies: state.selectedHobbies.slice(),
    care: state.selectedCare.slice(),
    kind,
    title: payload.title || '',
    body: payload.body,
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
  openOverlay('overlay-detail');
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
  renderTagGrid($('hobby-grid'), HOBBIES, state.selectedHobbies, false);
  renderTagGrid($('care-grid'), SELFCARE, state.selectedCare, true);
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
  const cur = state.entries[todayKey];
  const val = cur && cur.kind === 'oneliner' ? cur.body : '';
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
  }
});

$('btn-diary').addEventListener('click', () => {
  if (!state.selectedMood) { toast('먼저 오늘 기분을 골라주세요 🌱'); return; }
  const cur = state.entries[todayKey];
  const isDiary = cur && cur.kind === 'diary';
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
  }
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
let sb = null;
let userId = null;

function setSync(stateName, text) {
  syncPill.dataset.state = stateName;
  syncText.textContent = text;
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
    setSync('ok', '클라우드 저장됨');
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
    setSync('ok', '클라우드 저장됨');
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
          kind: r.kind, title: r.title, body: r.body, updatedAt: r.updated_at,
        });
        changed = true;
      }
    }

    if (toPush.length) {
      const { error: upErr } = await sb.from('entries').upsert(toPush, { onConflict: 'user_id,entry_date' });
      if (upErr) throw upErr;
    }

    if (changed) {
      hydrateTodaySelection();
      renderAll();
    }
    persist();
    setSync('ok', '클라우드 저장됨');
  } catch {
    setSync('error', '동기화 실패 · 눌러서 재시도');
  }
}

async function initCloud() {
  setSync('syncing', '연결 중…');
  try {
    const { createClient } = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.58.0/+esm');
    sb = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
      auth: { persistSession: true, autoRefreshToken: true, storageKey: 'harukong.auth' },
    });

    let { data: { session } } = await sb.auth.getSession();
    if (!session) {
      const { data, error } = await sb.auth.signInAnonymously();
      if (error) throw error;
      session = data.session;
    }
    if (!session) throw new Error('no session');

    userId = session.user.id;
    await syncAll();
  } catch (err) {
    sb = null;
    userId = null;
    const msg = String(err && (err.message || err.error_description) || '');
    setSync('off', msg.includes('Anonymous') ? '이 기기에만 저장' : '오프라인 · 이 기기에만 저장');
  }
}

syncPill.addEventListener('click', () => {
  if (sb && userId) syncAll();
  else initCloud();
});
window.addEventListener('online', () => { if (sb && userId) syncAll(); });
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && sb && userId) syncAll();
});

/* ---------------- 시작 ---------------- */
loadLocal();
hydrateTodaySelection();
renderAll();
initCloud();
