/* ============================================================
   콩나무 — 연속 기록 단계와 그림
   외부 보상 없이 "내 콩이 자라는 걸 보는" 것만으로 동기가 되도록,
   단계는 오직 연속 기록 일수로만 올라갑니다.
   ============================================================ */

/* 한 달에 주어지는 물뿌리개 수. 못 쓴 날을 메워 연속을 이어줍니다. */
export const CANS_PER_MONTH = 2;

export const STAGES = [
  { key: 'seed',   name: '씨앗',   min: 0,  hint: '오늘 기록하면 싹이 나요' },
  { key: 'sprout', name: '새싹',   min: 1,  hint: '이제 막 고개를 내밀었어요' },
  { key: 'leaf',   name: '떡잎',   min: 3,  hint: '떡잎 두 장이 펼쳐졌어요' },
  { key: 'stem',   name: '잎사귀', min: 7,  hint: '줄기가 제법 단단해졌어요' },
  { key: 'flower', name: '꽃',     min: 14, hint: '드디어 꽃이 피었어요' },
  { key: 'fruit',  name: '열매',   min: 30, hint: '콩이 알알이 열렸어요' },
];

export function stageIndexFor(streak) {
  let idx = 0;
  for (let i = 0; i < STAGES.length; i++) if (streak >= STAGES[i].min) idx = i;
  return idx;
}

/* 다음 단계까지 남은 일수 (마지막 단계면 null) */
export function daysToNextStage(streak) {
  const next = STAGES[stageIndexFor(streak) + 1];
  return next ? Math.max(0, next.min - streak) : null;
}

/* ---------------- 그림 ---------------- */
const SOIL =
  '<ellipse cx="50" cy="87" rx="33" ry="8.5" fill="#7E6244"/>'
  + '<ellipse cx="50" cy="84.5" rx="33" ry="8" fill="#9C7C56"/>';

const stem = (topY) =>
  `<path d="M50,84 C50,${84 - (84 - topY) * 0.45} 50,${topY + (84 - topY) * 0.25} 50,${topY}" `
  + 'stroke="#5FA06E" stroke-width="3.4" fill="none" stroke-linecap="round"/>';

/* dir: -1 왼쪽, 1 오른쪽 */
const leaf = (y, dir, size) => {
  const w = 17 * size;
  const h = 9 * size;
  const x = 50 + dir * 2;
  return `<path d="M${x},${y} C${x + dir * w * 0.35},${y - h} ${x + dir * w},${y - h * 0.75} ${x + dir * w},${y + h * 0.15}`
    + ` C${x + dir * w * 0.6},${y + h * 0.9} ${x + dir * w * 0.15},${y + h * 0.6} ${x},${y} Z"`
    + ' fill="#7CBB8A" stroke="#4C8C5A" stroke-width="1.3" stroke-linejoin="round"/>';
};

const bud = (y) =>
  `<path d="M50,${y + 8} C43,${y + 3} 43,${y - 4} 50,${y - 6} C57,${y - 4} 57,${y + 3} 50,${y + 8} Z"`
  + ' fill="#8CC79A" stroke="#4C8C5A" stroke-width="1.4" stroke-linejoin="round"/>';

const flower = (y) => {
  let petals = '';
  for (let i = 0; i < 5; i++) {
    const a = (i * 72 - 90) * Math.PI / 180;
    const px = 50 + Math.cos(a) * 8.5;
    const py = y + Math.sin(a) * 8.5;
    petals += `<ellipse cx="${px.toFixed(1)}" cy="${py.toFixed(1)}" rx="6" ry="5.4" fill="#F1A9B8" stroke="#D97C90" stroke-width="1.2"/>`;
  }
  return petals + `<circle cx="50" cy="${y}" r="4.2" fill="#F6C667" stroke="#E0A63A" stroke-width="1.2"/>`;
};

const pod = (x, y, dir) =>
  `<g transform="rotate(${dir * 18} ${x} ${y})">`
  + `<rect x="${x - 3.6}" y="${y}" width="7.2" height="15" rx="3.6" fill="#BFE3B0" stroke="#6FAE7C" stroke-width="1.3"/>`
  + `<circle cx="${x}" cy="${y + 4.5}" r="1.5" fill="#8FC17E"/>`
  + `<circle cx="${x}" cy="${y + 9}" r="1.5" fill="#8FC17E"/>`
  + '</g>';

const SPARKLE =
  '<g stroke="#E0A63A" stroke-width="2" stroke-linecap="round" opacity=".85">'
  + '<path d="M16,26 l0,7 M12.5,29.5 l7,0"/><path d="M84,20 l0,6 M81,23 l6,0"/></g>';

const PLANTS = {
  seed: SOIL
    + '<ellipse cx="50" cy="79" rx="9.5" ry="7.6" fill="#EBD9AC" stroke="#C9B183" stroke-width="1.7" transform="rotate(-14 50 79)"/>'
    + '<path d="M46,78 q4,-3 8,0" stroke="#C9B183" stroke-width="1.2" fill="none" stroke-linecap="round"/>',

  sprout: SOIL + stem(66) + bud(62),

  leaf: SOIL + stem(58) + leaf(60, -1, 0.85) + leaf(60, 1, 0.85) + bud(55),

  stem: SOIL + stem(44)
    + leaf(66, -1, 0.9) + leaf(66, 1, 0.9)
    + leaf(52, -1, 0.75) + leaf(52, 1, 0.75)
    + bud(41),

  flower: SOIL + stem(38)
    + leaf(68, -1, 0.9) + leaf(68, 1, 0.9)
    + leaf(54, -1, 0.78) + leaf(54, 1, 0.78)
    + flower(31),

  fruit: SOIL + stem(36)
    + leaf(70, -1, 0.9) + leaf(70, 1, 0.9)
    + leaf(56, -1, 0.8) + leaf(56, 1, 0.8)
    + flower(29)
    + pod(31, 50, -1) + pod(69, 50, 1) + pod(50, 60, 0)
    + SPARKLE,
};

/* 작게 보여줄 때는 빈 하늘을 잘라내야 알아볼 수 있습니다.
   크게 보여줄 때는 자르지 않아야 "아직 자랄 자리가 남았다"는 게 보입니다. */
const COMPACT_VIEW = {
  seed:   '14 56 72 44',
  sprout: '14 46 72 54',
  leaf:   '8 42 84 58',
  stem:   '6 30 88 70',
  flower: '4 14 92 86',
  fruit:  '2 10 96 90',
};

/* 시든 상태: 색이 빠집니다 (연속이 끊겼을 때) */
export function plantSVG(stageIdx, withered, compact) {
  const key = STAGES[Math.max(0, Math.min(STAGES.length - 1, stageIdx))].key;
  const view = compact ? COMPACT_VIEW[key] : '0 0 100 100';
  const style = withered ? ' style="filter:grayscale(.65);opacity:.62"' : '';
  return `<svg viewBox="${view}" xmlns="http://www.w3.org/2000/svg" `
    + `preserveAspectRatio="xMidYMax meet" aria-hidden="true"${style}>${PLANTS[key]}</svg>`;
}
