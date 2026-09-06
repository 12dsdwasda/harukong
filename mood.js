/* ============================================================
   기분 정의와 콩이 얼굴 SVG.
   app.js 와 report.js 가 함께 씁니다.
   ============================================================ */

/* ---------------- 기분 정의 & 콩이 SVG ---------------- */
export const MOOD_ORDER = ['veryhappy', 'happy', 'neutral', 'sad', 'verysad'];
export const MOODS = {
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

/* 리포트 카드는 이미지로 저장되기 때문에 CSS 변수를 쓸 수 없습니다.
   그럴 때 쓸 고정 색상입니다. */
export const MOOD_HEX = {
  veryhappy: ['#F6C667', '#E0A63A'],
  happy:     ['#BFE3B0', '#8FC17E'],
  neutral:   ['#EADFC0', '#D2C29A'],
  sad:       ['#B9CBD6', '#93AEBC'],
  verysad:   ['#93A6B4', '#748A99'],
};

export function beanSVG(mood, literal) {
  const m = MOODS[mood] ? mood : 'neutral';
  const c = MOODS[m];
  const [body, dark] = literal ? MOOD_HEX[m] : [c.body, c.dark];
  return '<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" role="img" aria-hidden="true">'
    + leafMarkup(m, c.angle)
    + `<ellipse cx="50" cy="64" rx="35" ry="31" fill="${body}" stroke="${dark}" stroke-width="2"/>`
    + faceMarkup(m)
    + '</svg>';
}
