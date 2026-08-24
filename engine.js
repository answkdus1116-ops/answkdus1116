/* =========================================================================
   자연쌤 놀이터 공통 엔진 (engine.js)
   - 스마트 배경 제거 (종이/사진 배경에 강함)
   - 미리보기 + 민감도 조절 + 스티커 테두리
   - 카메라 / 파일 업로드 / 화면 저장 / 전체화면 / 배경음악
   - 테마(수족관/숲속/과수원)는 각 *.theme.js 에서 주입
   ========================================================================= */

const Playground = (() => {
  'use strict';

  let THEME = null;          // 테마 설정 객체
  let stage = null;          // { canvas, ctx, width, height, sprites }
  let bgmEl = null;
  let videoEl = null;
  let pendingSource = null;  // 미리보기 중인 원본 이미지(Image)
  let pendingCanvas = null;  // 미리보기 결과 캔버스
  let aiLib = null;          // @imgly 라이브러리 핸들(있을 때만)

  /* ---------------------------------------------------------------------
     1) 스마트 배경 제거 (테두리에서 시작하는 색상 기반 채우기)
        - 네 모서리 색을 종이(배경)색으로 추정
        - 테두리에서 연결된 '배경색과 비슷한' 영역만 투명 처리
          → 그림 안쪽의 흰색(물고기 배, 흰 구름 등)은 지워지지 않음
        - 가장자리 부드럽게(페더링) + 자동 여백 잘라내기
     --------------------------------------------------------------------- */
  function smartCutout(img, opts = {}) {
    const maxDim = opts.maxDim || 1400;
    const tolerance = opts.tolerance != null ? opts.tolerance : 40; // 0~120
    const feather = opts.feather !== false;

    // 처리용 캔버스(너무 크면 축소해 속도 확보)
    let w = img.naturalWidth || img.width;
    let h = img.naturalHeight || img.height;
    const scale = Math.min(1, maxDim / Math.max(w, h));
    w = Math.max(1, Math.round(w * scale));
    h = Math.max(1, Math.round(h * scale));

    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const cx = c.getContext('2d', { willReadFrequently: true });
    cx.drawImage(img, 0, 0, w, h);
    const id = cx.getImageData(0, 0, w, h);
    const d = id.data;

    // (a) 배경색 추정: 테두리 픽셀들의 중앙값
    const rs = [], gs = [], bs = [];
    const stepX = Math.max(1, Math.floor(w / 60));
    const stepY = Math.max(1, Math.floor(h / 60));
    const pushPx = (x, y) => {
      const i = (y * w + x) * 4;
      rs.push(d[i]); gs.push(d[i + 1]); bs.push(d[i + 2]);
    };
    for (let x = 0; x < w; x += stepX) { pushPx(x, 0); pushPx(x, h - 1); }
    for (let y = 0; y < h; y += stepY) { pushPx(0, y); pushPx(w - 1, y); }
    const median = (arr) => { arr.sort((a, b) => a - b); return arr[arr.length >> 1]; };
    const bg = [median(rs), median(gs), median(bs)];

    // (b) 테두리에서 시작하는 색 거리 기반 flood fill
    const tol2 = tolerance * tolerance;
    const visited = new Uint8Array(w * h);
    const stack = new Int32Array(w * h);   // 스택(반복 DFS)
    let sp = 0;
    const pushSeed = (p) => { if (!visited[p]) { visited[p] = 1; stack[sp++] = p; } };
    for (let x = 0; x < w; x++) { pushSeed(x); pushSeed((h - 1) * w + x); }
    for (let y = 0; y < h; y++) { pushSeed(y * w); pushSeed(y * w + (w - 1)); }

    while (sp > 0) {
      const p = stack[--sp];
      const i = p * 4;
      const dr = d[i] - bg[0], dg = d[i + 1] - bg[1], db = d[i + 2] - bg[2];
      if (dr * dr + dg * dg + db * db > tol2) continue; // 배경색과 다르면 멈춤(=그림)
      d[i + 3] = 0; // 투명 처리
      const x = p % w, y = (p / w) | 0;
      if (x > 0) { const q = p - 1; if (!visited[q]) { visited[q] = 1; stack[sp++] = q; } }
      if (x < w - 1) { const q = p + 1; if (!visited[q]) { visited[q] = 1; stack[sp++] = q; } }
      if (y > 0) { const q = p - w; if (!visited[q]) { visited[q] = 1; stack[sp++] = q; } }
      if (y < h - 1) { const q = p + w; if (!visited[q]) { visited[q] = 1; stack[sp++] = q; } }
    }

    // (c) 가장자리 페더링 (알파 채널만 3x3 평균 1회)
    if (feather) {
      const src = new Uint8ClampedArray(d.length);
      src.set(d);
      for (let y = 1; y < h - 1; y++) {
        for (let x = 1; x < w - 1; x++) {
          const i = (y * w + x) * 4 + 3;
          let sum = 0;
          sum += src[i - 4] + src[i + 4];
          sum += src[i - w * 4] + src[i + w * 4];
          sum += src[i];
          d[i] = (sum / 5) | 0;
        }
      }
    }

    cx.putImageData(id, 0, 0);
    return autoCrop(c);
  }

  // 투명 여백을 잘라내 그림만 남김
  function autoCrop(srcCanvas, pad = 6) {
    const w = srcCanvas.width, h = srcCanvas.height;
    const ctx = srcCanvas.getContext('2d', { willReadFrequently: true });
    const d = ctx.getImageData(0, 0, w, h).data;
    let minX = w, minY = h, maxX = 0, maxY = 0, found = false;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (d[(y * w + x) * 4 + 3] > 24) {
          found = true;
          if (x < minX) minX = x; if (x > maxX) maxX = x;
          if (y < minY) minY = y; if (y > maxY) maxY = y;
        }
      }
    }
    if (!found) return srcCanvas;
    minX = Math.max(0, minX - pad); minY = Math.max(0, minY - pad);
    maxX = Math.min(w - 1, maxX + pad); maxY = Math.min(h - 1, maxY + pad);
    const cw = maxX - minX + 1, ch = maxY - minY + 1;
    const out = document.createElement('canvas');
    out.width = cw; out.height = ch;
    out.getContext('2d').drawImage(srcCanvas, minX, minY, cw, ch, 0, 0, cw, ch);
    return out;
  }

  // 흰색 스티커 테두리(그림처럼 오린 느낌 + 거친 가장자리 가림)
  function addStickerOutline(cutout, border = 0) {
    if (!border) return cutout;
    const pad = border + 2;
    const out = document.createElement('canvas');
    out.width = cutout.width + pad * 2;
    out.height = cutout.height + pad * 2;
    const o = out.getContext('2d');

    // 흰색 실루엣 만들기
    const sil = document.createElement('canvas');
    sil.width = cutout.width; sil.height = cutout.height;
    const sc = sil.getContext('2d');
    sc.drawImage(cutout, 0, 0);
    sc.globalCompositeOperation = 'source-in';
    sc.fillStyle = '#ffffff';
    sc.fillRect(0, 0, sil.width, sil.height);

    // 원을 그리듯 여러 방향으로 흰 실루엣을 찍어 테두리 생성
    const steps = 24;
    for (let a = 0; a < steps; a++) {
      const ang = (a / steps) * Math.PI * 2;
      o.drawImage(sil, pad + Math.cos(ang) * border, pad + Math.sin(ang) * border);
    }
    // 원본 그림을 위에 얹기
    o.drawImage(cutout, pad, pad);
    return out;
  }

  /* ---------------------------------------------------------------------
     2) AI 정밀 배경 제거 (@imgly, 페이지에 로드돼 있을 때만 사용)
     --------------------------------------------------------------------- */
  function getAiLib() {
    if (aiLib) return aiLib;
    const cand = window.imglyRemoveBackground
      || (window.imgly && window.imgly.removeBackground)
      || (typeof imglyRemoveBackground !== 'undefined' ? imglyRemoveBackground : null);
    aiLib = cand || null;
    return aiLib;
  }

  async function aiCutout(dataUrl) {
    const lib = getAiLib();
    if (!lib) throw new Error('AI 라이브러리가 없습니다');
    const blob = await lib(dataUrl, {
      publicPath: 'https://cdn.jsdelivr.net/npm/@imgly/background-removal@1.4.5/dist/',
      device: 'cpu',
    });
    const url = URL.createObjectURL(blob);
    const img = await loadImage(url);
    URL.revokeObjectURL(url);
    const c = document.createElement('canvas');
    c.width = img.naturalWidth; c.height = img.naturalHeight;
    c.getContext('2d').drawImage(img, 0, 0);
    return autoCrop(c);
  }

  function loadImage(src) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = src;
    });
  }

  /* ---------------------------------------------------------------------
     3) 미리보기 모달 — 학생이 결과를 보고 다듬은 뒤 추가
     --------------------------------------------------------------------- */
  let previewState = { tolerance: 40, border: 10, ai: false };

  async function openPreview(dataUrl) {
    pendingSource = await loadImage(dataUrl);
    const ov = document.getElementById('previewModal');
    ov.classList.add('show');
    await renderPreview();
  }

  async function renderPreview() {
    const wrap = document.getElementById('previewCanvasWrap');
    const spinner = document.getElementById('previewSpinner');
    spinner.style.display = 'flex';
    // UI가 그려질 시간을 줌
    await new Promise(r => setTimeout(r, 16));

    try {
      let cut;
      if (previewState.ai && getAiLib()) {
        spinner.querySelector('.pv-spin-msg').textContent = THEME.aiMsg || 'AI가 정밀하게 오려내는 중...';
        cut = await aiCutout(pendingSource.src);
      } else {
        cut = smartCutout(pendingSource, { tolerance: previewState.tolerance });
      }
      cut = addStickerOutline(cut, previewState.border);
      pendingCanvas = cut;

      // 미리보기 표시
      wrap.querySelectorAll('canvas').forEach(n => n.remove());
      const view = cut.cloneNode();
      view.getContext('2d').drawImage(cut, 0, 0);
      view.className = 'pv-result';
      wrap.appendChild(view);
    } catch (err) {
      console.error('미리보기 처리 실패:', err);
      // AI 실패 시 자동으로 스마트 모드로
      previewState.ai = false;
      document.getElementById('pvAiToggle').checked = false;
      const cut = addStickerOutline(
        smartCutout(pendingSource, { tolerance: previewState.tolerance }),
        previewState.border
      );
      pendingCanvas = cut;
      const wrap2 = document.getElementById('previewCanvasWrap');
      wrap2.querySelectorAll('canvas').forEach(n => n.remove());
      const view = cut.cloneNode();
      view.getContext('2d').drawImage(cut, 0, 0);
      view.className = 'pv-result';
      wrap2.appendChild(view);
    } finally {
      spinner.style.display = 'none';
    }
  }

  // 슬라이더 조작 시 너무 자주 재계산하지 않도록 디바운스
  let reRenderTimer = null;
  function schedulePreview() {
    clearTimeout(reRenderTimer);
    reRenderTimer = setTimeout(renderPreview, 120);
  }

  function confirmPreview() {
    if (pendingCanvas) {
      const img = new Image();
      img.onload = () => stage.sprites.push(THEME.createSprite(img, stage));
      img.src = pendingCanvas.toDataURL();
    }
    closePreview();
  }

  function closePreview() {
    document.getElementById('previewModal').classList.remove('show');
    pendingSource = null;
    pendingCanvas = null;
  }

  /* ---------------------------------------------------------------------
     4) 카메라 / 파일 업로드
     --------------------------------------------------------------------- */
  async function openCamera() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1920 } }, audio: false,
      });
      videoEl.srcObject = stream;
      document.getElementById('cameraModal').classList.add('show');
    } catch (err) {
      alert('카메라를 켤 수 없어요! 브라우저 설정에서 카메라 권한을 확인해 주세요.');
    }
  }

  function takeSnapshotFromCamera() {
    const cap = document.getElementById('captureCanvas');
    cap.width = videoEl.videoWidth;
    cap.height = videoEl.videoHeight;
    cap.getContext('2d').drawImage(videoEl, 0, 0);
    const dataUrl = cap.toDataURL('image/jpeg', 0.92);
    closeCamera();
    openPreview(dataUrl);
  }

  function closeCamera() {
    if (videoEl.srcObject) videoEl.srcObject.getTracks().forEach(t => t.stop());
    document.getElementById('cameraModal').classList.remove('show');
  }

  function handleFileUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => openPreview(e.target.result);
    reader.readAsDataURL(file);
    event.target.value = ''; // 같은 파일 다시 선택 가능하도록
  }

  /* ---------------------------------------------------------------------
     5) 화면 저장(스냅샷) — 배경 + 작품을 한 장의 PNG로
     --------------------------------------------------------------------- */
  let bgImageCache = null;
  async function saveScene() {
    const out = document.createElement('canvas');
    out.width = stage.canvas.width;
    out.height = stage.canvas.height;
    const o = out.getContext('2d');

    // 배경 채우기
    try {
      if (THEME.bgImage) {
        if (!bgImageCache) bgImageCache = await loadImage(THEME.bgImage);
        drawCover(o, bgImageCache, out.width, out.height);
      } else {
        o.fillStyle = THEME.bgFallback || '#1e5799';
        o.fillRect(0, 0, out.width, out.height);
      }
    } catch (e) {
      o.fillStyle = THEME.bgFallback || '#1e5799';
      o.fillRect(0, 0, out.width, out.height);
    }
    // 작품 얹기
    o.drawImage(stage.canvas, 0, 0);

    const link = document.createElement('a');
    link.download = `${THEME.key || 'playground'}_${Date.now()}.png`;
    link.href = out.toDataURL('image/png');
    link.click();
  }

  function drawCover(ctx, img, w, h) {
    const ir = img.width / img.height, cr = w / h;
    let dw, dh, dx, dy;
    if (ir > cr) { dh = h; dw = h * ir; dx = (w - dw) / 2; dy = 0; }
    else { dw = w; dh = w / ir; dx = 0; dy = (h - dh) / 2; }
    ctx.drawImage(img, dx, dy, dw, dh);
  }

  /* ---------------------------------------------------------------------
     6) 음악 / 전체화면 / UI 자동 숨김
     --------------------------------------------------------------------- */
  function startApp() {
    document.getElementById('entryOverlay').style.display = 'none';
    if (bgmEl && THEME.bgm) {
      bgmEl.volume = 0.55;
      bgmEl.play()
        .then(() => setAudioBtn(true))
        .catch(() => setAudioBtn(false));
    }
  }

  function toggleAudio() {
    if (!bgmEl) return;
    if (bgmEl.paused) { bgmEl.play().then(() => setAudioBtn(true)).catch(() => {}); }
    else { bgmEl.pause(); setAudioBtn(false); }
  }
  function setAudioBtn(on) {
    const btn = document.getElementById('audioBtn');
    if (btn) btn.innerHTML = on ? '🔊 <span>소리 켬</span>' : '🔇 <span>소리 끔</span>';
  }

  function toggleFullScreen() {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else { document.exitFullscreen(); }
  }

  function clearStage() { stage.sprites = []; }

  function bindUiAutoHide() {
    const ui = document.getElementById('uiPanel');
    const show = () => { ui.style.opacity = '1'; ui.style.pointerEvents = 'auto'; };
    const hideLater = (delay) => {
      clearTimeout(window.__uiTimer);
      window.__uiTimer = setTimeout(() => {
        if (document.fullscreenElement) { ui.style.opacity = '0'; ui.style.pointerEvents = 'none'; }
      }, delay);
    };
    document.addEventListener('fullscreenchange', () => {
      if (document.fullscreenElement) { show(); hideLater(2500); }
      else { clearTimeout(window.__uiTimer); show(); }
    });
    const onMove = (e) => {
      if (!document.fullscreenElement) return;
      show();
      clearTimeout(window.__uiTimer);
      const r = ui.getBoundingClientRect();
      const px = e.touches ? e.touches[0].clientX : e.clientX;
      const py = e.touches ? e.touches[0].clientY : e.clientY;
      const over = px >= r.left && px <= r.right && py >= r.top && py <= r.bottom;
      if (!over) hideLater(3000);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('touchstart', onMove, { passive: true });
  }

  /* ---------------------------------------------------------------------
     7) 무대(캔버스) + 배경 떠다니는 입자 + 메인 루프
     --------------------------------------------------------------------- */
  let particles = [];
  function initParticles() {
    particles = [];
    if (!THEME.particle) return;
    const n = THEME.particleCount || 22;
    for (let i = 0; i < n; i++) particles.push(makeParticle(true));
  }
  function makeParticle(randomY) {
    const w = stage.width, h = stage.height;
    return {
      x: Math.random() * w,
      y: randomY ? Math.random() * h : h + 20,
      r: 3 + Math.random() * 8,
      sp: 0.3 + Math.random() * 0.9,
      drift: (Math.random() - 0.5) * 0.6,
      a: 0.15 + Math.random() * 0.35,
      sway: Math.random() * Math.PI * 2,
    };
  }
  function drawParticles(ctx) {
    if (!THEME.particle) return;
    const kind = THEME.particle;
    for (const p of particles) {
      p.sway += 0.02;
      if (kind === 'bubble') { p.y -= p.sp; p.x += Math.sin(p.sway) * 0.5; if (p.y < -20) Object.assign(p, makeParticle(false)); }
      else { p.y += p.sp * 0.6; p.x += Math.sin(p.sway) * 0.8 + p.drift; if (p.y > stage.height + 20) Object.assign(p, makeParticle(false), { y: -20 }); }

      ctx.save();
      ctx.globalAlpha = p.a;
      if (kind === 'bubble') {
        ctx.strokeStyle = 'rgba(255,255,255,0.9)';
        ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.stroke();
        ctx.fillStyle = 'rgba(255,255,255,0.25)';
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
      } else if (kind === 'leaf') {
        ctx.fillStyle = '#8bc34a';
        ctx.translate(p.x, p.y); ctx.rotate(p.sway);
        ctx.beginPath(); ctx.ellipse(0, 0, p.r, p.r * 0.5, 0, 0, Math.PI * 2); ctx.fill();
      } else if (kind === 'petal') {
        ctx.fillStyle = '#fff3b0';
        ctx.translate(p.x, p.y); ctx.rotate(p.sway);
        ctx.beginPath(); ctx.ellipse(0, 0, p.r, p.r * 0.6, 0, 0, Math.PI * 2); ctx.fill();
      }
      ctx.restore();
    }
  }

  function loop() {
    const { ctx, canvas } = stage;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawParticles(ctx);
    for (const s of stage.sprites) { s.update(); s.draw(ctx); }
    // 빈 화면 안내
    if (stage.sprites.length === 0 && THEME.emptyHint) {
      ctx.save();
      ctx.globalAlpha = 0.5 + Math.sin(Date.now() / 600) * 0.2;
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      ctx.font = "bold 28px Gaegu, sans-serif";
      ctx.textAlign = 'center';
      ctx.fillText(THEME.emptyHint, canvas.width / 2, canvas.height / 2);
      ctx.restore();
    }
    requestAnimationFrame(loop);
  }

  function resize() {
    stage.canvas.width = window.innerWidth;
    stage.canvas.height = window.innerHeight;
    stage.width = window.innerWidth;
    stage.height = window.innerHeight;
    if (THEME.onResize) stage.sprites.forEach(s => THEME.onResize(s, stage));
  }

  function bindPointer() {
    const onTap = (clientX, clientY) => {
      const rect = stage.canvas.getBoundingClientRect();
      const x = clientX - rect.left, y = clientY - rect.top;
      for (let i = stage.sprites.length - 1; i >= 0; i--) {
        const s = stage.sprites[i];
        if (s.hitTest(x, y)) { s.onTap(); break; }
      }
    };
    // pointerdown 으로 마우스+터치 통합 처리
    stage.canvas.addEventListener('pointerdown', (e) => onTap(e.clientX, e.clientY));
  }

  /* ---------------------------------------------------------------------
     8) 베이스 스프라이트 (테마에서 상속)
        - 가로세로 비율 유지(기존 정사각형 왜곡 문제 해결)
     --------------------------------------------------------------------- */
  class Sprite {
    constructor(img, st) {
      this.img = img;
      this.stage = st;
      const base = (st.width < 600 ? 90 : 120) + Math.random() * 60;
      const ratio = (img.naturalWidth || img.width) / (img.naturalHeight || img.height) || 1;
      if (ratio >= 1) { this.w = base; this.h = base / ratio; }
      else { this.h = base; this.w = base * ratio; }
      this.x = Math.random() * Math.max(1, st.width - this.w);
      this.y = Math.random() * Math.max(1, st.height - this.h);
    }
    update() {}
    draw(ctx) {
      ctx.save();
      ctx.shadowColor = 'rgba(0,0,0,0.25)';
      ctx.shadowBlur = 12; ctx.shadowOffsetY = 6;
      ctx.drawImage(this.img, this.x, this.y, this.w, this.h);
      ctx.restore();
    }
    onTap() {}
    hitTest(px, py) {
      return px > this.x && px < this.x + this.w && py > this.y && py < this.y + this.h;
    }
  }

  /* ---------------------------------------------------------------------
     9) 초기화
     --------------------------------------------------------------------- */
  function init(theme) {
    THEME = theme;
    const canvas = document.getElementById('mainCanvas');
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    stage = { canvas, ctx, width: window.innerWidth, height: window.innerHeight, sprites: [] };
    bgmEl = document.getElementById('bgm');
    videoEl = document.getElementById('video');

    // 테마 텍스트 주입
    setText('entryIcon', theme.entryIcon);
    setText('entryTitle', theme.entryTitle);
    setText('entryButton', theme.entryButton);
    setText('headerTitle', theme.headerTitle);

    // AI 라이브러리가 없으면 정밀 모드 체크박스 비활성화
    const aiToggle = document.getElementById('pvAiToggle');
    if (aiToggle && !getAiLib()) {
      aiToggle.disabled = true;
      const lbl = aiToggle.closest('.pv-ai');
      if (lbl) { lbl.style.opacity = '0.45'; lbl.title = 'AI 모듈을 불러오지 못했어요 (인터넷 연결 확인)'; }
    }

    window.addEventListener('resize', resize);
    resize();
    initParticles();
    bindPointer();
    bindUiAutoHide();
    loop();
  }
  function setText(id, txt) { const el = document.getElementById(id); if (el && txt != null) el.textContent = txt; }

  // 외부(HTML onclick / theme)에서 쓰는 API
  return {
    init, Sprite, get stage() { return stage; },
    startApp, toggleAudio, toggleFullScreen, clearStage, saveScene,
    openCamera, takeSnapshotFromCamera, closeCamera, handleFileUpload,
    confirmPreview, closePreview,
    setTolerance(v) { previewState.tolerance = +v; schedulePreview(); },
    setBorder(v) { previewState.border = +v; schedulePreview(); },
    setAi(v) { previewState.ai = !!v; renderPreview(); },
    hasAi: () => !!getAiLib(),
  };
})();
