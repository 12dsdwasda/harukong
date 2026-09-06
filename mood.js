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

export function moodImageSrc(mood) {
  return `./moods/${MOODS[mood] ? mood : 'neutral'}.png`;
}

/* 이름은 그대로 두었습니다. 부르는 곳이 많고 하는 일도 같습니다. */
export function beanSVG(mood) {
  const m = MOODS[mood] ? mood : 'neutral';
  return `<img class="bean-img" src="${moodImageSrc(m)}" alt="${MOODS[m].label}" `
    + 'loading="lazy" decoding="async" draggable="false">';
}
