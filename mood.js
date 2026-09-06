/* ============================================================
   기분 정의와 콩이 이미지.

   콩이는 그리지 않고 원본 사진에서 누끼를 딴 PNG 를 씁니다.
   (moods/*.png — scripts/cutout.py 로 만들었습니다)
   왼쪽 매우 기쁨의 밝은 하늘색에서 오른쪽 매우 슬픔의 청회색으로 이어집니다.
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

/* 사진에서 뽑은 몸통 색. 리포트 카드는 이미지로 저장돼 CSS 변수를 못 씁니다. */
export const MOOD_HEX = {
  veryhappy: ['#B4F0FC', '#7FDCEE'],
  happy:     ['#8AD8FC', '#5CB8E8'],
  neutral:   ['#8AB4F0', '#6B93DC'],
  sad:       ['#789CEA', '#5578D4'],
  verysad:   ['#7290C0', '#566F9E'],
};

/* ---------------- 직접 올린 얼굴 ----------------
   사진은 data URL 로 저장되지만 그대로 <img src> 에 쓰지는 않습니다.
   캘린더 한 달이면 같은 문자열이 서른 번 넘게 markup 에 박혀
   HTML 만 수 MB 가 됩니다. blob URL 로 바꿔 짧은 주소로 씁니다.
   같은 출처라 리포트를 이미지로 뽑을 때 캔버스도 오염되지 않습니다. */
const customFaces = new Map();
/* 배경을 지우지 않고 원으로 오려낸 사진들. 테두리를 이미지에 굽지 않고
   CSS 로 그려야 라이트/다크에서 잉크색이 같이 뒤집힙니다. */
const roundFaces = new Set();

function dataUrlToBlob(dataUrl) {
  const [head, b64] = String(dataUrl).split(',');
  const type = (head.match(/data:([^;]+)/) || [])[1] || 'image/png';
  const bin = atob(b64);
  const buf = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) buf[i] = bin.charCodeAt(i);
  return new Blob([buf], { type });
}

/* { mood: { image: dataURL } } 를 통째로 받아 갈아끼웁니다 */
export function setCustomFaces(photos) {
  for (const url of customFaces.values()) URL.revokeObjectURL(url);
  customFaces.clear();
  roundFaces.clear();
  for (const m of MOOD_ORDER) {
    const p = photos && photos[m];
    if (!p || typeof p.image !== 'string' || !p.image.startsWith('data:image/')) continue;
    try {
      customFaces.set(m, URL.createObjectURL(dataUrlToBlob(p.image)));
      if (!p.cutout) roundFaces.add(m);
    } catch { /* 못 읽으면 기본 얼굴 */ }
  }
}

export function hasCustomFace(mood) {
  return customFaces.has(mood);
}

export function defaultImageSrc(mood) {
  return `./moods/${MOODS[mood] ? mood : 'neutral'}.png`;
}

export function moodImageSrc(mood) {
  const m = MOODS[mood] ? mood : 'neutral';
  return customFaces.get(m) || defaultImageSrc(m);
}

/* 이름은 그대로 두었습니다. 부르는 곳이 많고 하는 일도 같습니다. */
export function beanSVG(mood) {
  const m = MOODS[mood] ? mood : 'neutral';
  const round = roundFaces.has(m) ? ' bean-round' : '';
  return `<img class="bean-img${round}" src="${moodImageSrc(m)}" alt="${MOODS[m].label}" `
    + 'loading="lazy" decoding="async" draggable="false">';
}
