/* ============================================================
   스포티파이 임베드 플레이어
   검색 API 의 preview_url 은 새로 만든 앱에서는 null 로 오는 경우가 많아
   임베드 iframe 을 씁니다. 무료 계정은 30초 미리듣기, 프리미엄으로
   로그인해 있으면 전곡이 재생됩니다.
   ============================================================ */

const API_SRC = 'https://open.spotify.com/embed/iframe-api/v1';

let apiPromise = null;
const controllers = new Map(); // host id -> controller

function loadApi() {
  if (apiPromise) return apiPromise;
  apiPromise = new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timeout')), 12000);
    window.onSpotifyIframeApiReady = (api) => { clearTimeout(timer); resolve(api); };
    const el = document.createElement('script');
    el.src = API_SRC;
    el.async = true;
    el.onerror = () => { clearTimeout(timer); reject(new Error('load failed')); };
    document.head.appendChild(el);
  });
  return apiPromise;
}

/* host 는 화면에 계속 남아 있는 빈 div 입니다.
   createController 가 그 자리를 iframe 으로 바꾸고, 이후에는 같은
   컨트롤러에 loadUri 로 곡만 갈아끼웁니다. */
export async function mount(hostId, trackId, { autoplay = false, height = 80 } = {}) {
  const api = await loadApi();

  const existing = controllers.get(hostId);
  if (existing) {
    existing.loadUri(`spotify:track:${trackId}`);
    /* loadUri 직후에는 아직 준비 전이라 조금 기다렸다 재생합니다 */
    if (autoplay) setTimeout(() => { try { existing.play(); } catch { /* noop */ } }, 350);
    return existing;
  }

  const host = document.getElementById(hostId);
  if (!host) throw new Error('no host');

  return new Promise((resolve) => {
    api.createController(
      host,
      { uri: `spotify:track:${trackId}`, width: '100%', height },
      (controller) => {
        controllers.set(hostId, controller);
        if (autoplay) setTimeout(() => { try { controller.play(); } catch { /* noop */ } }, 350);
        resolve(controller);
      },
    );
  });
}

export function pause(hostId) {
  const c = controllers.get(hostId);
  if (c) { try { c.pause(); } catch { /* noop */ } }
}

export function pauseAll() {
  for (const c of controllers.values()) { try { c.pause(); } catch { /* noop */ } }
}
