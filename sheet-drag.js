/* ============================================================
   바텀 시트를 아래로 끌어 내리면 닫히게 합니다.

   본문이 스크롤되는 시트가 많아서, 본문 안에서 시작한 제스처는
   맨 위까지 올라와 있을 때만 끌기로 봅니다. 그래야 일기를 읽다가
   위로 스크롤하는 동작과 부딪히지 않습니다.
   ============================================================ */

const CLOSE_DISTANCE = 108;   // 이만큼 내리면 닫습니다
const FLICK_DISTANCE = 44;    // 짧게 튕겨도 닫히는 최소 거리
const FLICK_MS = 260;

export function enableSheetDrag(overlay, onClose) {
  const sheet = overlay.querySelector('.sheet');
  if (!sheet) return;
  const body = sheet.querySelector('.sheet-body');

  let dragging = false;
  let startY = 0;
  let dy = 0;
  let startedAt = 0;
  let pointerId = null;

  function canStart(target) {
    /* 입력 중이거나 플레이어를 만지는 중에는 끌지 않습니다 */
    if (target.closest && target.closest('input, textarea, select, iframe, .song-list, .emoji-grid')) {
      return false;
    }
    if (!body || !body.contains(target)) return true;  // 손잡이·제목·버튼 줄
    return body.scrollTop <= 0;                        // 본문은 맨 위일 때만
  }

  function reset(animate) {
    sheet.style.transition = animate ? '' : 'none';
    sheet.style.transform = '';
    sheet.style.willChange = '';
  }

  sheet.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    if (dragging || !canStart(e.target)) return;
    dragging = true;
    pointerId = e.pointerId;
    startY = e.clientY;
    dy = 0;
    startedAt = Date.now();
    sheet.style.transition = 'none';
    sheet.style.willChange = 'transform';
  });

  sheet.addEventListener('pointermove', (e) => {
    if (!dragging || e.pointerId !== pointerId) return;
    const next = e.clientY - startY;
    if (next <= 0) {
      /* 위로 끌면 따라가지 않되, 끌기 자체는 유지합니다 */
      dy = 0;
      sheet.style.transform = '';
      return;
    }
    if (dy === 0 && next > 6) {
      /* 아래로 가는 게 확실해진 순간에 포인터를 붙잡습니다 */
      try { sheet.setPointerCapture(pointerId); } catch { /* noop */ }
    }
    dy = next;
    sheet.style.transform = `translateY(${dy}px)`;
  });

  function finish() {
    if (!dragging) return;
    dragging = false;
    try { sheet.releasePointerCapture(pointerId); } catch { /* noop */ }
    pointerId = null;

    const flick = dy > FLICK_DISTANCE && Date.now() - startedAt < FLICK_MS;
    if (dy > CLOSE_DISTANCE || flick) {
      reset(true);
      onClose();
    } else {
      reset(true);
    }
    dy = 0;
  }

  sheet.addEventListener('pointerup', finish);
  sheet.addEventListener('pointercancel', finish);

  /* 끌고 있는 동안에는 화면이 같이 움직이지 않게 합니다.
     passive:false 여야 preventDefault 가 먹습니다. */
  sheet.addEventListener('touchmove', (e) => {
    if (dragging && dy > 0 && e.cancelable) e.preventDefault();
  }, { passive: false });
}
