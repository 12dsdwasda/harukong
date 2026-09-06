/* ============================================================
   월간 콩 리포트
   한 달치 기록을 카드 한 장으로 요약합니다.
   이미지로 저장되기 때문에 카드 안에서는 CSS 변수를 쓰지 않고
   고정 색상만 씁니다(라이트 톤 고정).
   ============================================================ */
import { MOOD_ORDER, MOODS, MOOD_HEX, beanSVG } from './mood.js';
import { STAGES, stageIndexFor, plantSVG } from './growth.js';

const pad = (n) => (n < 10 ? '0' + n : '' + n);

function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

/* ---------------- 집계 ---------------- */
export function buildReport(year, month, entries, watered, tagById) {
  const prefix = `${year}-${pad(month)}`;
  const daysInMonth = new Date(year, month, 0).getDate();

  const keys = Object.keys(entries).filter((k) => k.startsWith(prefix)).sort();
  const moodCounts = {};
  for (const m of MOOD_ORDER) moodCounts[m] = 0;
  const hobbyCounts = new Map();
  const careCounts = new Map();

  for (const k of keys) {
    const e = entries[k];
    if (moodCounts[e.mood] !== undefined) moodCounts[e.mood]++;
    for (const id of e.hobbies) hobbyCounts.set(id, (hobbyCounts.get(id) || 0) + 1);
    for (const id of e.care) careCounts.set(id, (careCounts.get(id) || 0) + 1);
  }

  /* 그 달 안에서 가장 길게 이어진 구간. 물뿌리개로 메운 날도 이어진 것으로 봅니다. */
  const wateredSet = new Set(watered);
  let longest = 0;
  let run = 0;
  for (let d = 1; d <= daysInMonth; d++) {
    const k = `${prefix}-${pad(d)}`;
    if (entries[k] || wateredSet.has(k)) { run++; longest = Math.max(longest, run); }
    else run = 0;
  }

  const topOf = (map, n) => [...map.entries()]
    .sort((a, b) => b[1] - a[1] || String(a[0]).localeCompare(String(b[0])))
    .slice(0, n)
    .map(([id, count]) => ({ tag: tagById.get(id), count }))
    .filter((x) => x.tag);

  let dominant = null;
  let best = 0;
  for (const m of MOOD_ORDER) if (moodCounts[m] > best) { best = moodCounts[m]; dominant = m; }

  const wateredInMonth = watered.filter((k) => k.startsWith(prefix)).length;

  /* 그 달에 고른 곡들. 같은 곡을 여러 번 골랐으면 횟수로 묶습니다. */
  const songMap = new Map();
  for (const k of keys) {
    const song = entries[k].song;
    if (!song || !song.id) continue;
    const hit = songMap.get(song.id);
    if (hit) hit.count++;
    else songMap.set(song.id, { song, count: 1 });
  }
  const songs = [...songMap.values()].sort((a, b) => b.count - a.count).slice(0, 4);

  return {
    year, month, daysInMonth,
    recorded: keys.length,
    moodCounts,
    dominant,
    longest,
    wateredInMonth,
    topHobbies: topOf(hobbyCounts, 3),
    topCare: topOf(careCounts, 3),
    songs,
    songDays: [...songMap.values()].reduce((n, x) => n + x.count, 0),
    stageIdx: stageIndexFor(longest),
    empty: keys.length === 0,
  };
}

/* "기쁨 12일, 슬픔 3일을 겪었어요" 처럼 많이 나온 순으로 두세 가지만 */
function moodSentence(r) {
  const parts = MOOD_ORDER
    .map((m) => ({ m, n: r.moodCounts[m] }))
    .filter((x) => x.n > 0)
    .sort((a, b) => b.n - a.n)
    .slice(0, 3)
    .map((x) => `${MOODS[x.m].label} ${x.n}일`);
  if (!parts.length) return '아직 기록이 없어요';
  return `${parts.join(', ')}을 겪었어요`;
}

function songRows(songs) {
  return '<div class="rc-songs">' + songs.map((x) => {
    const cover = x.song.image
      ? `<img src="${esc(x.song.image)}" alt="" crossorigin="anonymous">`
      : '<span class="rc-song-blank"></span>';
    return '<div class="rc-song">' + cover
      + '<div class="rc-song-meta">'
      + `<div class="rc-song-name">${esc(x.song.name)}</div>`
      + `<div class="rc-song-artist">${esc(x.song.artist || '')}</div></div>`
      + (x.count > 1 ? `<span class="rc-song-count">${x.count}회</span>` : '')
      + '</div>';
  }).join('') + '</div>';
}

function closingLine(r) {
  if (r.recorded >= r.daysInMonth * 0.8) return '거의 매일을 남겼네요. 대단해요 🌟';
  if (r.longest >= 7) return `${r.longest}일이나 이어간 달이었어요 🌱`;
  if (r.wateredInMonth > 0) return '물뿌리개까지 써가며 이어온 한 달이었어요 💧';
  if (r.songs.length) return `${r.songDays}일을 노래와 함께 남겼어요 🎵`;
  if (r.recorded >= 10) return '꾸준히 쌓인 한 달이에요';
  return '한 줄이라도 남긴 날들이 모였어요';
}

/* ---------------- 카드 ---------------- */
export function reportCardHTML(r) {
  const monthLabel = `${r.year}년 ${r.month}월`;

  if (r.empty) {
    return `<div class="rc" id="report-card"><div class="rc-head">`
      + `<p class="rc-month">${monthLabel}</p><p class="rc-title">새싹콩 리포트</p></div>`
      + `<div class="rc-empty">이 달에는 심은 콩이 없어요 🌱</div>`
      + `<p class="rc-foot">🌱 새싹콩</p></div>`;
  }

  const total = r.recorded || 1;
  const bar = MOOD_ORDER
    .filter((m) => r.moodCounts[m] > 0)
    .map((m) => `<span style="width:${(r.moodCounts[m] / total * 100).toFixed(2)}%;background:${MOOD_HEX[m][0]}"></span>`)
    .join('');

  const legend = MOOD_ORDER
    .filter((m) => r.moodCounts[m] > 0)
    .map((m) => `<li><i style="background:${MOOD_HEX[m][0]};border-color:${MOOD_HEX[m][1]}"></i>`
      + `${MOODS[m].label} <b>${r.moodCounts[m]}</b></li>`)
    .join('');

  const tagRow = (items) => items.length
    ? `<ul class="rc-tags">${items.map((x) =>
      `<li><span class="rc-tag-emoji">${x.tag.emoji}</span>${esc(x.tag.label)} <b>${x.count}</b></li>`).join('')}</ul>`
    : '<p class="rc-none">고른 항목이 없어요</p>';

  return `<div class="rc" id="report-card">
  <div class="rc-head">
    <p class="rc-month">${monthLabel}</p>
    <p class="rc-title">새싹콩 리포트</p>
  </div>

  <div class="rc-plant">${plantSVG(r.stageIdx, false, true)}</div>
  <p class="rc-stage">${STAGES[r.stageIdx].name}까지 자란 달</p>

  <div class="rc-big">
    <b>${r.daysInMonth}일</b> 중 <b>${r.recorded}일</b>을 기록했어요
  </div>

  <div class="rc-mood">
    <div class="rc-mood-face">${beanSVG(r.dominant, true)}</div>
    <p class="rc-mood-text">이번 달 콩이는<br>${moodSentence(r)}</p>
  </div>

  <div class="rc-bar">${bar}</div>
  <ul class="rc-legend">${legend}</ul>

  <div class="rc-stats">
    <div><span>가장 긴 연속</span><b>${r.longest}일</b></div>
    <div><span>물뿌리개</span><b>${r.wateredInMonth}개</b></div>
  </div>

  <p class="rc-label">많이 한 활동</p>
  ${tagRow(r.topHobbies)}

  <p class="rc-label">자기관리</p>
  ${tagRow(r.topCare)}

  ${r.songs.length ? `<p class="rc-label">이 달의 플레이리스트</p>${songRows(r.songs)}` : ''}

  <p class="rc-closing">${closingLine(r)}</p>
  <p class="rc-foot">🌱 새싹콩</p>
</div>`;
}
