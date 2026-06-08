/* =========================================================================
   휘날려라! 태극기 놀이터  (flag.js)
   - 색칠한 태극기 도안을 촬영/업로드
   - 네 꼭짓점을 잡아 원근 보정(perspective unwarp) → 3:2 사각 깃발로 펴기
   - 깃대에 달아 사인파 천 시뮬레이션으로 휘날리기
   - 흰색을 "제거"하지 않으므로 흰 바탕/태극/4괘가 모두 보존됨
   ========================================================================= */
const Flag = (() => {
  'use strict';

  // ---- 상태 ----
  let canvas, ctx, W = 0, H = 0;
  let flags = [];          // 무대 위 깃발들
  let clouds = [];         // 배경 구름
  let time = 0;            // 애니메이션 시간
  let gust = 0;            // 전역 바람 돌풍 세기(클릭 시 증가, 서서히 감소)
  let started = false;

  // 자르기용
  let srcCanvas = null;             // 원본 사진(자연 해상도)
  let corners = [];                 // 네 꼭짓점(표시 이미지 0~1 비율)
  let dragIdx = -1;
  const FLAG_RATIO = 1.5;           // 태극기 가로:세로 = 3:2
  const DST_W = 360, DST_H = 240;   // 펴낸 깃발 해상도

  // 바람소리(Web Audio 합성 — 별도 mp3 불필요)
  let audioCtx = null, windGain = null, windOn = false;

  /* =====================================================================
     초기화
     ===================================================================== */
  function start() {
    canvas = document.getElementById('mainCanvas');
    ctx = canvas.getContext('2d');
    resize();
    window.addEventListener('resize', resize);
    initClouds();
    bindCrop();
    canvas.addEventListener('pointerdown', onStagePointer);
    requestAnimationFrame(loop);
  }

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth; H = window.innerHeight;
    canvas.width = W * dpr; canvas.height = H * dpr;
    canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    layoutPoles();
  }

  function initClouds() {
    clouds = [];
    for (let i = 0; i < 5; i++) {
      clouds.push({
        x: Math.random() * W,
        y: 40 + Math.random() * (H * 0.35),
        s: 0.6 + Math.random() * 0.9,
        v: 0.15 + Math.random() * 0.25
      });
    }
  }

  function startApp() {
    document.getElementById('entryOverlay').style.display = 'none';
    document.getElementById('uiPanel').classList.add('show');
    started = true;
  }

  /* =====================================================================
     배경 그리기 (하늘 + 해 + 구름 + 잔디)
     ===================================================================== */
  function drawBackground() {
    const groundY = H * 0.82;
    // 하늘
    const sky = ctx.createLinearGradient(0, 0, 0, groundY);
    sky.addColorStop(0, '#bfeaff');
    sky.addColorStop(1, '#8fd2f2');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, groundY);

    // 해
    ctx.save();
    ctx.globalAlpha = 0.9;
    const sun = ctx.createRadialGradient(W * 0.84, H * 0.16, 6, W * 0.84, H * 0.16, 80);
    sun.addColorStop(0, '#fff6c9'); sun.addColorStop(1, 'rgba(255,224,120,0)');
    ctx.fillStyle = sun;
    ctx.beginPath(); ctx.arc(W * 0.84, H * 0.16, 80, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ffe27a';
    ctx.beginPath(); ctx.arc(W * 0.84, H * 0.16, 34, 0, Math.PI * 2); ctx.fill();
    ctx.restore();

    // 구름
    ctx.fillStyle = 'rgba(255,255,255,0.92)';
    clouds.forEach(c => {
      c.x += c.v + gust * 0.04;
      if (c.x - 120 * c.s > W) c.x = -120 * c.s;
      puff(c.x, c.y, c.s);
    });

    // 잔디
    const g = ctx.createLinearGradient(0, groundY, 0, H);
    g.addColorStop(0, '#7ccb46'); g.addColorStop(1, '#4f9e2d');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(0, groundY);
    for (let x = 0; x <= W; x += 40) {
      ctx.quadraticCurveTo(x + 20, groundY - 10, x + 40, groundY);
    }
    ctx.lineTo(W, H); ctx.lineTo(0, H); ctx.closePath(); ctx.fill();
  }

  function puff(x, y, s) {
    ctx.beginPath();
    ctx.arc(x, y, 26 * s, 0, Math.PI * 2);
    ctx.arc(x + 30 * s, y + 6 * s, 32 * s, 0, Math.PI * 2);
    ctx.arc(x + 64 * s, y, 24 * s, 0, Math.PI * 2);
    ctx.arc(x + 32 * s, y - 14 * s, 24 * s, 0, Math.PI * 2);
    ctx.fill();
  }

  /* =====================================================================
     깃대 배치 (깃발 개수에 따라 화면에 고르게)
     ===================================================================== */
  function layoutPoles() {
    const n = flags.length;
    if (!n) return;
    const groundY = H * 0.82;
    const slot = W / n;
    // 칸에 맞춰 깃발 크기 결정
    let dispH = Math.min(H * 0.22, (slot * 0.74) / FLAG_RATIO);
    dispH = Math.max(dispH, 70);
    const poleTop = Math.max(H * 0.13, groundY - dispH * 2.1);

    flags.forEach((f, i) => {
      const poleX = slot * i + Math.max(slot * 0.16, 18);
      f.poleX = poleX;
      f.poleTop = poleTop;
      f.poleBottom = groundY + 6;
      f.dispH = dispH;
      f.scale = dispH / f.canvas.height;   // 펴낸 깃발 → 화면 크기
    });
  }

  /* =====================================================================
     깃대 + 휘날리는 깃발 그리기
     ===================================================================== */
  function drawFlag(f) {
    const poleW = Math.max(6, f.dispH * 0.05);
    // --- 깃대 ---
    const pg = ctx.createLinearGradient(f.poleX, 0, f.poleX + poleW, 0);
    pg.addColorStop(0, '#d8dee4'); pg.addColorStop(0.5, '#a7b0b8'); pg.addColorStop(1, '#7e878f');
    ctx.fillStyle = pg;
    ctx.fillRect(f.poleX, f.poleTop, poleW, f.poleBottom - f.poleTop);
    // 깃대 그림자(잔디 위)
    ctx.save();
    ctx.globalAlpha = 0.18; ctx.fillStyle = '#1d3a00';
    ctx.beginPath();
    ctx.ellipse(f.poleX + poleW / 2 + 22, f.poleBottom, 46, 9, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    // 깃대 꼭대기 금구슬
    const fr = ctx.createRadialGradient(f.poleX + poleW / 2 - 2, f.poleTop - poleW * 1.2, 1, f.poleX + poleW / 2, f.poleTop - poleW, poleW * 1.5);
    fr.addColorStop(0, '#fff1b8'); fr.addColorStop(1, '#e0a82f');
    ctx.fillStyle = fr;
    ctx.beginPath(); ctx.arc(f.poleX + poleW / 2, f.poleTop - poleW, poleW * 1.1, 0, Math.PI * 2); ctx.fill();

    // --- 휘날리는 깃발 (세로 strip 누적 방식) ---
    const off = f.canvas;
    const sw = off.width, sh = off.height;
    const strips = 64;
    const stripSrc = sw / strips;
    const amp = f.dispH * 0.11;                 // 펄럭임 진폭(차분하게)
    const speed = (0.9 + f.windSpeed * 0.8) * (1 + gust * 0.4);
    const baseX = f.poleX + poleW;
    const baseY = f.poleTop + f.dispH * 0.18;
    let x = baseX;

    for (let i = 0; i < strips; i++) {
      const sx = i * stripSrc;
      const t = i / (strips - 1);                       // 0=깃대, 1=자유단
      const phase = i * 0.26 - time * 0.04 * speed + f.phase;  // 물결 개수↓ 속도↓
      const depth = Math.cos(phase) * 0.42 * t;         // 천이 접히는 깊이감
      const stripW = stripSrc * f.scale * (1 - depth * 0.45);
      const yOff = Math.sin(phase) * (amp + gust * amp * 0.5) * t;
      const vScale = 1 - Math.abs(depth) * 0.16;        // 깊이에 따른 세로 눌림
      const h = f.dispH * vScale;
      const y = baseY + yOff + (f.dispH - h) / 2;

      // 그림자(깃발 아래 살짝)
      ctx.save();
      ctx.shadowColor = 'rgba(20,40,60,0.25)';
      ctx.shadowBlur = 10; ctx.shadowOffsetY = 6;
      ctx.drawImage(off, sx, 0, stripSrc + 0.7, sh, x, y, stripW + 0.7, h);
      ctx.restore();

      // 빛/그늘 음영으로 입체감
      if (depth > 0) ctx.fillStyle = `rgba(0,0,0,${depth * 0.45})`;
      else ctx.fillStyle = `rgba(255,255,255,${-depth * 0.32})`;
      ctx.fillRect(x, y, stripW + 0.7, h);

      x += stripW;
    }
  }

  /* =====================================================================
     메인 루프
     ===================================================================== */
  function loop() {
    time += 1;
    if (gust > 0) gust = Math.max(0, gust - 0.012);
    drawBackground();
    flags.forEach(drawFlag);
    requestAnimationFrame(loop);
  }

  // 화면 톡 → 돌풍 + 바람소리 살짝
  function onStagePointer() {
    gust = Math.min(1.0, gust + 0.5);
    if (windOn && windGain) {
      const now = audioCtx.currentTime;
      windGain.gain.cancelScheduledValues(now);
      windGain.gain.setValueAtTime(windGain.gain.value, now);
      windGain.gain.linearRampToValueAtTime(0.5, now + 0.15);
      windGain.gain.linearRampToValueAtTime(0.22, now + 1.4);
    }
  }

  /* =====================================================================
     사진 입력 (카메라 / 파일)
     ===================================================================== */
  async function openCamera() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      document.getElementById('video').srcObject = stream;
      document.getElementById('cameraModal').classList.add('show');
    } catch (e) {
      alert('카메라를 켤 수 없어요. 대신 "사진" 버튼으로 올려 주세요!');
    }
  }
  function closeCamera() {
    const v = document.getElementById('video');
    if (v.srcObject) v.srcObject.getTracks().forEach(t => t.stop());
    document.getElementById('cameraModal').classList.remove('show');
  }
  function takeSnapshot() {
    const v = document.getElementById('video');
    const c = document.getElementById('captureCanvas');
    c.width = v.videoWidth; c.height = v.videoHeight;
    c.getContext('2d').drawImage(v, 0, 0);
    closeCamera();
    openCrop(c.toDataURL('image/jpeg', 0.92));
  }
  function handleFileUpload(ev) {
    const file = ev.target.files[0];
    if (!file) return;
    const r = new FileReader();
    r.onload = e => openCrop(e.target.result);
    r.readAsDataURL(file);
    ev.target.value = '';
  }

  /* =====================================================================
     자르기(원근 보정) UI
     ===================================================================== */
  function openCrop(dataUrl) {
    const img = document.getElementById('cropImg');
    img.onload = () => {
      // 원본을 자연 해상도 캔버스에 보관
      srcCanvas = document.createElement('canvas');
      srcCanvas.width = img.naturalWidth;
      srcCanvas.height = img.naturalHeight;
      srcCanvas.getContext('2d').drawImage(img, 0, 0);
      // 기본 꼭짓점(살짝 안쪽)
      corners = [[0.15, 0.22], [0.85, 0.22], [0.85, 0.78], [0.15, 0.78]];
      document.getElementById('cropModal').classList.add('show');
      // 모달이 보인 뒤 핸들 위치 계산
      requestAnimationFrame(updateHandles);
    };
    img.src = dataUrl;
  }

  function imgRect() {
    return document.getElementById('cropImg').getBoundingClientRect();
  }

  function updateHandles() {
    const stage = document.getElementById('cropStage');
    const sr = stage.getBoundingClientRect();
    const r = imgRect();
    const offX = r.left - sr.left, offY = r.top - sr.top;
    const hs = document.querySelectorAll('.handle');
    corners.forEach((c, i) => {
      hs[i].style.left = (offX + c[0] * r.width) + 'px';
      hs[i].style.top = (offY + c[1] * r.height) + 'px';
    });
    // 가이드 폴리곤
    const svg = document.getElementById('cropSvg');
    const pts = corners.map(c => `${offX + c[0] * r.width},${offY + c[1] * r.height}`).join(' ');
    svg.setAttribute('viewBox', `0 0 ${sr.width} ${sr.height}`);
    svg.innerHTML =
      `<polygon points="${pts}" fill="rgba(0,71,160,0.12)" stroke="#0047a0" stroke-width="2.5" stroke-dasharray="8 6"/>`;
  }

  function bindCrop() {
    const stage = document.getElementById('cropStage');
    stage.addEventListener('pointerdown', e => {
      if (!e.target.classList.contains('handle')) return;
      dragIdx = +e.target.dataset.i;
      e.target.setPointerCapture(e.pointerId);
    });
    stage.addEventListener('pointermove', e => {
      if (dragIdx < 0) return;
      const r = imgRect();
      let nx = (e.clientX - r.left) / r.width;
      let ny = (e.clientY - r.top) / r.height;
      corners[dragIdx] = [Math.max(0, Math.min(1, nx)), Math.max(0, Math.min(1, ny))];
      updateHandles();
    });
    const end = () => { dragIdx = -1; };
    stage.addEventListener('pointerup', end);
    stage.addEventListener('pointercancel', end);
    window.addEventListener('resize', () => {
      if (document.getElementById('cropModal').classList.contains('show')) updateHandles();
    });
  }

  function cancelCrop() {
    document.getElementById('cropModal').classList.remove('show');
    srcCanvas = null;
  }

  function confirmCrop() {
    if (!srcCanvas) return;
    showToast(true, '국기를 깃발로 펴는 중...');
    document.getElementById('cropModal').classList.remove('show');
    // 약간의 텀을 줘서 토스트가 보이게
    setTimeout(() => {
      try {
        const flat = unwarp(srcCanvas, corners.map(c => [c[0] * srcCanvas.width, c[1] * srcCanvas.height]), DST_W, DST_H);
        addFlag(flat);
      } catch (e) {
        console.error(e);
        alert('펴내는 데 실패했어요. 모서리를 다시 맞춰 주세요!');
      }
      showToast(false);
      srcCanvas = null;
    }, 60);
  }

  /* =====================================================================
     원근 보정(perspective unwarp)
     dst 사각형 → src 사변형 매핑(호모그래피)으로 픽셀을 샘플링
     ===================================================================== */
  function solveLinear(A, b) {           // 가우스 소거법
    const n = b.length;
    for (let i = 0; i < n; i++) A[i].push(b[i]);
    for (let col = 0; col < n; col++) {
      let piv = col;
      for (let r = col + 1; r < n; r++)
        if (Math.abs(A[r][col]) > Math.abs(A[piv][col])) piv = r;
      [A[col], A[piv]] = [A[piv], A[col]];
      const pv = A[col][col] || 1e-9;
      for (let c = col; c <= n; c++) A[col][c] /= pv;
      for (let r = 0; r < n; r++) {
        if (r === col) continue;
        const fct = A[r][col];
        for (let c = col; c <= n; c++) A[r][c] -= fct * A[col][c];
      }
    }
    return A.map(row => row[n]);
  }

  // dst(u,v) → src(x,y) 호모그래피 계수 [a,b,c,d,e,f,g,h]
  function homography(src, dst) {
    const A = [], B = [];
    for (let i = 0; i < 4; i++) {
      const [u, v] = dst[i], [x, y] = src[i];
      A.push([u, v, 1, 0, 0, 0, -u * x, -v * x]); B.push(x);
      A.push([0, 0, 0, u, v, 1, -u * y, -v * y]); B.push(y);
    }
    return solveLinear(A, B);
  }

  function unwarp(src, srcCorners, dw, dh) {
    const sctx = src.getContext('2d');
    const sImg = sctx.getImageData(0, 0, src.width, src.height);
    const sd = sImg.data, sW = src.width, sH = src.height;
    const dst = [[0, 0], [dw, 0], [dw, dh], [0, dh]];
    const [a, b, c, d, e, f, g, h] = homography(srcCorners, dst);

    const out = document.createElement('canvas');
    out.width = dw; out.height = dh;
    const octx = out.getContext('2d');
    const oImg = octx.createImageData(dw, dh);
    const od = oImg.data;

    for (let v = 0; v < dh; v++) {
      for (let u = 0; u < dw; u++) {
        const den = g * u + h * v + 1;
        const x = (a * u + b * v + c) / den;
        const y = (d * u + e * v + f) / den;
        const oi = (v * dw + u) * 4;
        const xi = Math.floor(x), yi = Math.floor(y);
        if (xi < 0 || yi < 0 || xi >= sW - 1 || yi >= sH - 1) { od[oi + 3] = 0; continue; }
        const fx = x - xi, fy = y - yi;
        const i00 = (yi * sW + xi) * 4, i10 = i00 + 4, i01 = i00 + sW * 4, i11 = i01 + 4;
        for (let ch = 0; ch < 3; ch++) {
          const top = sd[i00 + ch] * (1 - fx) + sd[i10 + ch] * fx;
          const bot = sd[i01 + ch] * (1 - fx) + sd[i11 + ch] * fx;
          od[oi + ch] = top * (1 - fy) + bot * fy;
        }
        od[oi + 3] = 255;
      }
    }
    octx.putImageData(oImg, 0, 0);
    return out;
  }

  /* =====================================================================
     깃발 추가 / 청소
     ===================================================================== */
  function addFlag(flatCanvas) {
    flags.push({
      canvas: flatCanvas,
      windSpeed: 0.2 + Math.random() * 0.3,
      phase: Math.random() * Math.PI * 2
    });
    layoutPoles();
    gust = Math.min(1.0, gust + 0.35);   // 새 깃발 등장 시 바람 한 번(살짝)
  }
  function clearStage() { flags = []; }

  /* =====================================================================
     바람소리 (Web Audio로 합성 — 외부 음원 불필요)
     ===================================================================== */
  function toggleWind() {
    const btn = document.getElementById('audioBtn');
    if (!audioCtx) buildWind();
    if (windOn) {
      windGain.gain.cancelScheduledValues(audioCtx.currentTime);
      windGain.gain.linearRampToValueAtTime(0.0001, audioCtx.currentTime + 0.4);
      windOn = false;
      btn.innerHTML = '<span class="ico">🔇</span><span>바람소리</span>';
    } else {
      if (audioCtx.state === 'suspended') audioCtx.resume();
      windGain.gain.cancelScheduledValues(audioCtx.currentTime);
      windGain.gain.linearRampToValueAtTime(0.22, audioCtx.currentTime + 1.2);
      windOn = true;
      btn.innerHTML = '<span class="ico">🔊</span><span>바람켬</span>';
    }
  }

  function buildWind() {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    // 브라운 노이즈 버퍼
    const len = audioCtx.sampleRate * 2;
    const buf = audioCtx.createBuffer(1, len, audioCtx.sampleRate);
    const dch = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) {
      const wn = Math.random() * 2 - 1;
      last = (last + 0.02 * wn) / 1.02;
      dch[i] = last * 3.2;
    }
    const src = audioCtx.createBufferSource();
    src.buffer = buf; src.loop = true;
    const lp = audioCtx.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = 480;
    windGain = audioCtx.createGain(); windGain.gain.value = 0.0001;
    src.connect(lp); lp.connect(windGain); windGain.connect(audioCtx.destination);
    src.start();
    // 돌풍 느낌의 LFO
    const lfo = audioCtx.createOscillator(); lfo.frequency.value = 0.13;
    const lfoG = audioCtx.createGain(); lfoG.gain.value = 230;
    lfo.connect(lfoG); lfoG.connect(lp.frequency); lfo.start();
  }

  /* =====================================================================
     저장 / 전체화면 / 토스트
     ===================================================================== */
  function saveScene() {
    const a = document.createElement('a');
    a.download = '태극기_놀이터.png';
    a.href = canvas.toDataURL('image/png');
    a.click();
  }
  function toggleFullScreen() {
    if (!document.fullscreenElement) document.documentElement.requestFullscreen?.();
    else document.exitFullscreen?.();
  }
  function showToast(show, msg) {
    const t = document.getElementById('toast');
    if (msg) document.getElementById('toastMsg').innerText = msg;
    t.classList.toggle('show', show);
  }

  // 외부(onclick)에서 쓰는 공개 API
  return {
    startApp,
    openCamera, closeCamera, takeSnapshot, handleFileUpload,
    cancelCrop, confirmCrop,
    toggleWind, saveScene, clearStage, toggleFullScreen,
    _start: start
  };
})();

window.addEventListener('DOMContentLoaded', Flag._start);
