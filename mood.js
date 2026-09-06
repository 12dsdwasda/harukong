/* ============================================================
   기분 정의와 콩이 얼굴 SVG.
   app.js 와 report.js 가 함께 씁니다.

   왼쪽(매우 기쁨)의 밝은 하늘색에서 오른쪽(매우 슬픔)의 흐린 청회색으로
   이어지는 파란 계열 한 벌입니다. 새싹은 다섯 모두 같은 초록입니다.
   ============================================================ */

export const MOOD_ORDER = ['veryhappy', 'happy', 'neutral', 'sad', 'verysad'];

export const MOODS = {
  veryhappy: {
    label: '매우 기쁨', short: '최고예요',
    body: 'var(--mood-veryhappy)', dark: 'var(--mood-veryhappy-dark)',
    phrases: ['오늘 정말 좋은 하루였네요! 🎉', '콩이도 신나요! 이 기분 오래오래 간직해요'],
  },
  happy: {
    label: '기쁨', short: '좋아요',
    body: 'var(--mood-happy)', dark: 'var(--mood-happy-dark)',
    phrases: ['기분 좋은 하루네요 :)', '작은 행복도 소중해요, 콩이가 응원할게요'],
  },
  neutral: {
    label: '중간', short: '그냥 그래요',
    body: 'var(--mood-neutral)', dark: 'var(--mood-neutral-dark)',
    phrases: ['평범한 하루도 괜찮아요', '있는 그대로의 오늘을 기록해봐요'],
  },
  sad: {
    label: '슬픔', short: '속상해요',
    body: 'var(--mood-sad)', dark: 'var(--mood-sad-dark)',
    phrases: ['오늘 조금 힘들었군요', '콩이가 옆에 있어요, 천천히 적어봐요'],
  },
  verysad: {
    label: '매우 슬픔', short: '힘들어요',
    body: 'var(--mood-verysad)', dark: 'var(--mood-verysad-dark)',
    phrases: ['많이 지친 하루였겠어요', '괜찮아요, 오늘은 푹 쉬어도 돼요'],
  },
};

/* 리포트 카드는 이미지로 저장되기 때문에 CSS 변수를 쓸 수 없습니다.
   그럴 때 쓸 고정 색상입니다. */
export const MOOD_HEX = {
  veryhappy: ['#ADE5F7', '#7FCFEA'],
  happy:     ['#7BC6F0', '#4FA8DE'],
  neutral:   ['#92A8E8', '#6C82D6'],
  sad:       ['#6B86DC', '#4E68C4'],
  verysad:   ['#7C89A9', '#5E6B8C'],
};

const INK = '#1E2430';

/* 다섯 모두 같은 새싹을 답니다 */
const SPROUT =
  '<path d="M50,31 L50,15" stroke="#2F9B49" stroke-width="2.6" stroke-linecap="round" fill="none"/>'
  + '<ellipse cx="42.5" cy="12" rx="6.4" ry="3.7" fill="#47B860" transform="rotate(-32 42.5 12)"/>'
  + '<ellipse cx="57.5" cy="12" rx="6.4" ry="3.7" fill="#47B860" transform="rotate(32 57.5 12)"/>';

const EYES =
  `<circle cx="38" cy="56" r="3.9" fill="${INK}"/>`
  + `<circle cx="62" cy="56" r="3.9" fill="${INK}"/>`;

function heart(x, y, s) {
  return `<path d="M${x},${y + 3.1 * s} C${x - 2.7 * s},${y + 0.5 * s} ${x - 2.7 * s},${y - 2.2 * s} ${x},${y - 0.7 * s}`
    + ` C${x + 2.7 * s},${y - 2.2 * s} ${x + 2.7 * s},${y + 0.5 * s} ${x},${y + 3.1 * s} Z" fill="#F4626B"/>`;
}

function cloud(x, y) {
  return `<g fill="#4A4F58">`
    + `<circle cx="${x - 5.5}" cy="${y + 1.5}" r="5"/>`
    + `<circle cx="${x + 1}" cy="${y - 2.5}" r="6.4"/>`
    + `<circle cx="${x + 7}" cy="${y + 1}" r="5.2"/>`
    + `<rect x="${x - 10}" y="${y + 0.5}" width="21" height="6" rx="3"/>`
    + '</g>';
}

function bolt(x, y) {
  return `<path d="M${x + 1.6},${y} L${x - 2.4},${y + 6} L${x + 0.4},${y + 6} L${x - 1.4},${y + 11.5}`
    + ` L${x + 3.4},${y + 4.6} L${x + 0.4},${y + 4.6} Z" fill="#FFD400"/>`;
}

/* 원 뒤에 깔리는 장식 */
function backdropFor(mood) {
  switch (mood) {
    case 'veryhappy':
      return heart(76, 22, 1.9) + heart(88, 31, 1.5) + heart(83, 12, 1.2);
    case 'happy':
      return '<g stroke="#FFCE3D" stroke-width="3" stroke-linecap="round">'
        + '<path d="M14,36 L22,34 M15,44 L23,43 M17,52 L25,52"/>'
        + '<path d="M86,36 L78,34 M85,44 L77,43 M83,52 L75,52"/>'
        + '</g>';
    case 'sad':
      return '<g stroke="#6C8FE8" stroke-width="3.2" stroke-linecap="round">'
        + '<path d="M26,16 L24,26 M35,12 L33,22 M65,12 L63,22 M74,16 L72,26"/>'
        + '</g>';
    case 'verysad':
      return cloud(17, 17) + cloud(83, 17) + bolt(20, 26) + bolt(80, 26);
    default:
      return '';
  }
}

function faceFor(mood) {
  switch (mood) {
    case 'veryhappy':
      /* 크게 벌린 입 */
      return EYES + `<path d="M36,63 Q50,80 64,63 Z" fill="${INK}"/>`;
    case 'happy':
      return EYES + `<path d="M39,64 Q50,74 61,64" stroke="${INK}" stroke-width="3.4" fill="none" stroke-linecap="round"/>`;
    case 'neutral':
      return EYES + `<path d="M42,67 L58,67" stroke="${INK}" stroke-width="3.4" stroke-linecap="round"/>`;
    case 'sad':
      /* 걱정스러운 눈썹 + 내려간 입 */
      /* 안쪽 끝이 올라가야 걱정스러운 표정입니다.
         반대로 그리면 화난 얼굴로 읽힙니다. */
      return `<g stroke="${INK}" stroke-width="2.6" stroke-linecap="round">`
        + '<path d="M33,50.5 L41,47.5 M67,50.5 L59,47.5"/></g>'
        + EYES
        + `<path d="M39,72 Q50,63 61,72" stroke="${INK}" stroke-width="3.4" fill="none" stroke-linecap="round"/>`;
    case 'verysad':
      return EYES + `<path d="M38,73 Q50,61 62,73" stroke="${INK}" stroke-width="3.6" fill="none" stroke-linecap="round"/>`;
    default:
      return EYES;
  }
}

export function beanSVG(mood, literal) {
  const m = MOODS[mood] ? mood : 'neutral';
  const c = MOODS[m];
  const body = literal ? MOOD_HEX[m][0] : c.body;
  return '<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" role="img" aria-hidden="true">'
    + backdropFor(m)
    + SPROUT
    + `<circle cx="50" cy="60" r="32" fill="${body}"/>`
    + faceFor(m)
    + '</svg>';
}
