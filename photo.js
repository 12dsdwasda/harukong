/* ============================================================
   사진을 콩이 얼굴로 만드는 편집기.

   원형 틀 안에서 끌고 확대해 자르고, 원하면 흰 배경을 지웁니다.
   배경 지우기는 scripts/cutout.py 와 같은 생각을 브라우저에서 합니다 —
   다만 파이썬 쪽은 "밝고 무채색이면 배경"이라는 규칙을 사진 전체에 적용해서
   얼굴 한가운데 있는 흰 옷까지 뚫립니다. 여기서는 테두리에서 시작해
   이어진 곳만 지우므로 안쪽의 밝은 부분은 남습니다.
   ============================================================ */

/* 저장 크기. 캘린더 칸에서는 30px 남짓으로 보이지만,
   리포트 카드를 3배로 뽑을 때 얼굴이 뭉개지지 않을 만큼은 필요합니다. */
export const FACE_SIZE = 288;

/* 원본을 이만큼으로 줄여서 다룹니다. 요즘 폰 사진은 4000px 이 넘고,
   그대로 두면 배경 지우기 한 번에 수백만 픽셀을 훑게 됩니다. */
const MAX_SOURCE = 900;

const MIN_ZOOM = 1;
const MAX_ZOOM = 4;

/* ---------------- 파일 읽기 ---------------- */

function drawToCanvas(src, w, h) {
  const k = Math.min(1, MAX_SOURCE / Math.max(w, h));
  const cv = document.createElement('canvas');
  cv.width = Math.max(1, Math.round(w * k));
  cv.height = Math.max(1, Math.round(h * k));
  cv.getContext('2d').drawImage(src, 0, 0, cv.width, cv.height);
  return cv;
}

function loadViaTag(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('decode failed')); };
    img.src = url;
  });
}

/* 고른 사진을 캔버스로 만들어 돌려줍니다.
   createImageBitmap 은 EXIF 회전을 대신 처리해 주므로 먼저 시도합니다. */
export async function loadImageFile(file) {
  if (!file || !/^image\//.test(file.type || '')) throw new Error('not an image');
  if (window.createImageBitmap) {
    try {
      const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' });
      const cv = drawToCanvas(bmp, bmp.width, bmp.height);
      bmp.close && bmp.close();
      return cv;
    } catch { /* 사파리 구버전은 옵션을 못 받습니다. 아래로 넘어갑니다 */ }
  }
  const img = await loadViaTag(file);
  return drawToCanvas(img, img.naturalWidth, img.naturalHeight);
}

/* ---------------- 배경 지우기 ---------------- */

/* 테두리에서 시작해 배경색과 비슷한 픽셀을 따라 번져 나갑니다.
   HARD 안쪽은 완전히 지우고 SOFT 까지는 서서히 투명해지게 둡니다.
   경계선의 반투명 픽셀을 그대로 두면 흰 테두리가 남습니다. */
const HARD = 34;
const SOFT = 78;

export function cutoutBackground(src) {
  const w = src.width;
  const h = src.height;
  const ctx = src.getContext('2d', { willReadFrequently: true });
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;

  /* 배경색은 네 변의 평균으로 봅니다 */
  let br = 0; let bg = 0; let bb = 0; let n = 0;
  const sample = (x, y) => {
    const i = (y * w + x) * 4;
    br += d[i]; bg += d[i + 1]; bb += d[i + 2]; n += 1;
  };
  for (let x = 0; x < w; x += 1) { sample(x, 0); sample(x, h - 1); }
  for (let y = 0; y < h; y += 1) { sample(0, y); sample(w - 1, y); }
  br /= n; bg /= n; bb /= n;

  const dist = (i) => {
    const dr = d[i] - br;
    const dg = d[i + 1] - bg;
    const db = d[i + 2] - bb;
    return Math.sqrt(dr * dr + dg * dg + db * db) / Math.sqrt(3);
  };

  const seen = new Uint8Array(w * h);
  const stack = new Int32Array(w * h);
  let top = 0;

  const visit = (p) => {
    if (seen[p]) return;
    const v = dist(p * 4);
    if (v >= SOFT) return;
    seen[p] = 1;
    /* HARD 안쪽은 0, SOFT 근처는 거의 그대로 */
    d[p * 4 + 3] = v <= HARD ? 0 : Math.round(255 * ((v - HARD) / (SOFT - HARD)));
    stack[top] = p;
    top += 1;
  };

  for (let x = 0; x < w; x += 1) { visit(x); visit((h - 1) * w + x); }
  for (let y = 0; y < h; y += 1) { visit(y * w); visit(y * w + w - 1); }

  while (top > 0) {
    top -= 1;
    const p = stack[top];
    const x = p % w;
    const y = (p - x) / w;
    if (x > 0) visit(p - 1);
    if (x < w - 1) visit(p + 1);
    if (y > 0) visit(p - w);
    if (y < h - 1) visit(p + w);
  }

  const out = document.createElement('canvas');
  out.width = w;
  out.height = h;
  out.getContext('2d').putImageData(img, 0, 0);
  return out;
}

/* ---------------- 내보내기 ---------------- */

let webpOK = null;
function supportsWebp() {
  if (webpOK === null) {
    const cv = document.createElement('canvas');
    cv.width = 1; cv.height = 1;
    webpOK = cv.toDataURL('image/webp').startsWith('data:image/webp');
  }
  return webpOK;
}

/* ---------------- 편집기 ---------------- */

export function createCropper(canvas) {
  const ctx = canvas.getContext('2d');

  let plain = null;      // 원본 캔버스
  let cut = null;        // 배경을 지운 캔버스 (누를 때 한 번 만들고 재사용)
  let cutout = false;
  let zoom = 1;
  let tx = 0;
  let ty = 0;
  let view = 1;          // 캔버스 한 변 (기기 픽셀)
  let onZoom = null;

  const pointers = new Map();
  let pinchStart = 0;
  let pinchZoom = 1;
  let lastX = 0;
  let lastY = 0;

  const source = () => (cutout && cut ? cut : plain);

  function baseScale() {
    const s = source();
    return view / Math.min(s.width, s.height);
  }

  function rect() {
    const s = source();
    const k = baseScale() * zoom;
    const dw = s.width * k;
    const dh = s.height * k;
    return { x: (view - dw) / 2 + tx, y: (view - dh) / 2 + ty, w: dw, h: dh };
  }

  /* 틀 밖으로 빈 곳이 보이지 않게 붙잡아 둡니다 */
  function clamp() {
    const r = rect();
    const maxX = Math.max(0, (r.w - view) / 2);
    const maxY = Math.max(0, (r.h - view) / 2);
    tx = Math.min(maxX, Math.max(-maxX, tx));
    ty = Math.min(maxY, Math.max(-maxY, ty));
  }

  function checker(c, size) {
    const s = Math.round(size / 16);
    c.fillStyle = '#FFFCF4';
    c.fillRect(0, 0, size, size);
    c.fillStyle = '#EBE0C8';
    for (let y = 0; y * s < size; y += 1) {
      for (let x = (y % 2); x * s < size; x += 2) c.fillRect(x * s, y * s, s, s);
    }
  }

  function draw() {
    if (!plain) return;
    clamp();
    const r = rect();
    ctx.clearRect(0, 0, view, view);
    if (cutout) checker(ctx, view);
    else { ctx.fillStyle = '#FFFCF4'; ctx.fillRect(0, 0, view, view); }

    ctx.drawImage(source(), r.x, r.y, r.w, r.h);

    if (!cutout) {
      /* 원 밖으로 잘려 나갈 부분을 흐리게 덮어 보여줍니다 */
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, view, view);
      ctx.arc(view / 2, view / 2, view / 2 - view * 0.02, 0, Math.PI * 2, true);
      ctx.fillStyle = 'rgba(34,29,22,.52)';
      ctx.fill('evenodd');
      ctx.restore();
      ctx.beginPath();
      ctx.arc(view / 2, view / 2, view / 2 - view * 0.02, 0, Math.PI * 2);
      ctx.lineWidth = Math.max(2, view * 0.012);
      ctx.strokeStyle = '#221D16';
      ctx.stroke();
    }
  }

  /* 시트가 막 열리는 중이면 크기가 0 으로 잡힐 수 있습니다.
     그때는 자리를 잡은 뒤 한 번 더 잽니다. */
  function resize() {
    const box = canvas.getBoundingClientRect();
    const side = Math.round(Math.min(box.width, box.height) * Math.min(2, window.devicePixelRatio || 1));
    if (side < 2) { setTimeout(resize, 60); return; }
    if (side === view) { draw(); return; }
    view = side;
    canvas.width = side;
    canvas.height = side;
    draw();
  }

  /* ---- 제스처 ---- */
  const toLocal = (e) => {
    const box = canvas.getBoundingClientRect();
    const k = view / box.width;
    return { x: (e.clientX - box.left) * k, y: (e.clientY - box.top) * k };
  };
  const spread = () => {
    const [a, b] = [...pointers.values()];
    return Math.hypot(a.x - b.x, a.y - b.y);
  };

  function onDown(e) {
    if (!plain) return;
    canvas.setPointerCapture(e.pointerId);
    const p = toLocal(e);
    pointers.set(e.pointerId, p);
    if (pointers.size === 1) { lastX = p.x; lastY = p.y; }
    if (pointers.size === 2) { pinchStart = spread(); pinchZoom = zoom; }
  }

  function onMove(e) {
    if (!pointers.has(e.pointerId)) return;
    e.preventDefault();
    const p = toLocal(e);
    pointers.set(e.pointerId, p);

    if (pointers.size >= 2) {
      const now = spread();
      if (pinchStart > 0) setZoom(pinchZoom * (now / pinchStart));
      return;
    }
    tx += p.x - lastX;
    ty += p.y - lastY;
    lastX = p.x;
    lastY = p.y;
    draw();
  }

  function onUp(e) {
    pointers.delete(e.pointerId);
    if (pointers.size < 2) pinchStart = 0;
    if (pointers.size === 1) {
      const [p] = [...pointers.values()];
      lastX = p.x; lastY = p.y;
    }
  }

  function onWheel(e) {
    if (!plain) return;
    e.preventDefault();
    setZoom(zoom * (e.deltaY < 0 ? 1.08 : 1 / 1.08));
  }

  canvas.addEventListener('pointerdown', onDown);
  canvas.addEventListener('pointermove', onMove);
  canvas.addEventListener('pointerup', onUp);
  canvas.addEventListener('pointercancel', onUp);
  canvas.addEventListener('wheel', onWheel, { passive: false });
  window.addEventListener('resize', resize);

  function setZoom(next) {
    const z = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, next));
    if (z === zoom) return;
    /* 화면 한가운데를 기준으로 키웁니다 */
    const k = z / zoom;
    tx *= k;
    ty *= k;
    zoom = z;
    draw();
    if (onZoom) onZoom(zoom);
  }

  return {
    /* 새 사진을 올립니다 */
    setSource(cv) {
      plain = cv;
      cut = null;
      cutout = false;
      zoom = 1;
      tx = 0;
      ty = 0;
      pointers.clear();
      view = 0;
      resize();
      draw();
    },

    /* 배경 지우기를 켜고 끕니다. 처음 켤 때만 실제로 계산합니다.
       (사진 크기에 따라 몇십 ms 걸립니다) */
    setCutout(on) {
      if (!plain) return;
      if (on && !cut) cut = cutoutBackground(plain);
      cutout = !!on;
      draw();
    },

    setZoom,
    zoom: () => zoom,
    onZoom(fn) { onZoom = fn; },
    redraw: resize,

    isCutout: () => cutout,

    /* 지금 보이는 그대로를 저장용 이미지로 만듭니다.
       배경을 지웠으면 투명한 채로, 아니면 원으로 오려서 담습니다.
       테두리는 굽지 않습니다 — 잉크색이 라이트/다크에서 뒤집히기 때문에
       이미지에 넣으면 한쪽 모드에서 사라집니다. 앱이 CSS 로 그립니다. */
    toDataURL() {
      if (!plain) return '';
      const r = rect();
      const k = FACE_SIZE / view;
      const out = document.createElement('canvas');
      out.width = FACE_SIZE;
      out.height = FACE_SIZE;
      const o = out.getContext('2d');

      if (!cutout) {
        o.beginPath();
        o.arc(FACE_SIZE / 2, FACE_SIZE / 2, FACE_SIZE / 2, 0, Math.PI * 2);
        o.clip();
      }
      o.drawImage(source(), r.x * k, r.y * k, r.w * k, r.h * k);
      return supportsWebp() ? out.toDataURL('image/webp', 0.9) : out.toDataURL('image/png');
    },

    dispose() {
      canvas.removeEventListener('pointerdown', onDown);
      canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('pointerup', onUp);
      canvas.removeEventListener('pointercancel', onUp);
      canvas.removeEventListener('wheel', onWheel);
      window.removeEventListener('resize', resize);
      plain = null;
      cut = null;
    },
  };
}
