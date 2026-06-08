/* =========================================================================
   자연쌤 놀이터 — 공통 화면 녹화 모듈 (recorder.js)
   ---------------------------------------------------------------------------
   • 사용법: 각 HTML의 </body> 직전, 다른 <script> 뒤에 아래 한 줄만 추가
        <script src="recorder.js"></script>
   • '🎬 영상' 버튼이 상단 버튼들 옆에 자동으로 생깁니다.
   • 버튼 → 녹화 시간 선택(10초/30초/1분/3분 또는 '멈출 때까지') → 녹화 →
     ⏹ 멈춤 버튼이나 지정 시간이 되면 자동 종료 → 미리보기 후 저장.

   ▷ 두 가지 화면 구조를 모두 지원합니다.
     1) 태극기 앱: 하늘·잔디·깃발을 캔버스에 직접 그림 → 캔버스를 그대로 녹화
     2) 수족관/숲속/과수원: 배경은 CSS 배경이미지(#bgLayer), 캔버스엔 사물만
        → 배경이미지 + 캔버스를 매 프레임 합성해서 녹화 (배경이 빠지지 않게)
   ========================================================================= */
(function () {
  'use strict';

  // ---- 내부 상태 ----
  var srcCanvas = null;   // 앱이 그리는 원본 캔버스
  var bgEl = null;        // CSS 배경을 가진 요소(#bgLayer 등). 없으면 null
  var bgImg = null;       // 배경 이미지(있을 때 미리 로드)
  var bgColor = '';       // 배경색(이미지 로드 실패 시 사용)

  var recCanvas = null;   // 합성 결과를 그리는 캔버스(이게 녹화됨)
  var recCtx = null;
  var rafId = 0;

  var recorder = null;    // MediaRecorder
  var chunks = [];
  var mime = '';
  var ext = 'webm';

  var startTs = 0;
  var tickTimer = 0;
  var autoStopTimer = 0;
  var lastBlobUrl = '';

  /* ---------------------------------------------------------------------
     1. 캔버스 / 배경 찾기
     --------------------------------------------------------------------- */
  function findSourceCanvas() {
    var ids = ['mainCanvas', 'aquariumCanvas', 'birdCanvas', 'orchardCanvas'];
    for (var i = 0; i < ids.length; i++) {
      var c = document.getElementById(ids[i]);
      if (c) return c;
    }
    // 보조: 녹화/촬영용이 아닌 첫 캔버스
    var all = document.querySelectorAll('canvas');
    for (var j = 0; j < all.length; j++) {
      var el = all[j];
      if (el.id === 'captureCanvas' || el.dataset.pgrec === '1') continue;
      return el;
    }
    return null;
  }

  function findBgEl() {
    var ids = ['bgLayer', 'bgImage', 'aquarium-container', 'orchard-container', 'aviary-container'];
    for (var i = 0; i < ids.length; i++) {
      var el = document.getElementById(ids[i]);
      if (el) return el;
    }
    return null;
  }

  // computed style에서 background-image의 url(...)을 뽑아 이미지를 미리 로드
  function preloadBg() {
    bgImg = null; bgColor = '';
    var el = bgEl || document.body;
    if (!el) return;
    var cs = getComputedStyle(el);
    bgColor = cs.backgroundColor && cs.backgroundColor !== 'rgba(0, 0, 0, 0)'
      ? cs.backgroundColor : '';
    var bi = cs.backgroundImage || 'none';
    var m = bi.match(/url\(["']?(.*?)["']?\)/i);
    if (m && m[1]) {
      var img = new Image();
      // 같은 폴더의 로컬 이미지이므로 캔버스 오염 없음
      img.onload = function () { bgImg = img; };
      img.onerror = function () { bgImg = null; };
      img.src = m[1];
    }
  }

  // 이미지를 영역에 꽉 차게(cover) 그리기
  function drawCover(ctx, img, w, h) {
    var iw = img.naturalWidth || img.width;
    var ih = img.naturalHeight || img.height;
    if (!iw || !ih) return;
    var scale = Math.max(w / iw, h / ih);
    var dw = iw * scale, dh = ih * scale;
    ctx.drawImage(img, (w - dw) / 2, (h - dh) / 2, dw, dh);
  }

  /* ---------------------------------------------------------------------
     2. 합성 루프 (배경 + 캔버스를 recCanvas에 매 프레임 그림)
     --------------------------------------------------------------------- */
  function drawFrame() {
    var w = recCanvas.width, h = recCanvas.height;
    recCtx.clearRect(0, 0, w, h);
    if (bgColor) { recCtx.fillStyle = bgColor; recCtx.fillRect(0, 0, w, h); }
    if (bgImg) drawCover(recCtx, bgImg, w, h);
    if (srcCanvas) {
      try { recCtx.drawImage(srcCanvas, 0, 0, w, h); } catch (e) { /* 무시 */ }
    }
    rafId = requestAnimationFrame(drawFrame);
  }

  /* ---------------------------------------------------------------------
     3. 오디오 트랙 붙이기 (가능할 때만, 실패해도 녹화는 계속)
     --------------------------------------------------------------------- */
  function attachAudio(stream) {
    try {
      var bgm = document.getElementById('bgm');
      if (!bgm) return; // 태극기 앱 등은 오디오 요소가 없음 → 영상만 저장
      var cap = bgm.captureStream || bgm.mozCaptureStream;
      if (typeof cap === 'function') {
        var cs = cap.call(bgm);
        var t = cs.getAudioTracks()[0];
        if (t) { stream.addTrack(t); return; }
      }
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      var ctx = bgm.__pgrecCtx || new AC();
      bgm.__pgrecCtx = ctx;
      if (ctx.state === 'suspended') ctx.resume();
      var node = bgm.__pgrecSrc;
      if (!node) {
        node = ctx.createMediaElementSource(bgm);
        bgm.__pgrecSrc = node;
        node.connect(ctx.destination); // 사용자도 계속 들을 수 있게
      }
      var dest = ctx.createMediaStreamDestination();
      node.connect(dest);
      var at = dest.stream.getAudioTracks()[0];
      if (at) stream.addTrack(at);
    } catch (e) {
      console.warn('[recorder] 오디오 녹음은 생략됩니다:', e && e.message);
    }
  }

  /* ---------------------------------------------------------------------
     4. 녹화 형식(코덱) 선택
     --------------------------------------------------------------------- */
  function pickMime() {
    var cand = [
      'video/mp4;codecs=avc1.42E01E,mp4a.40.2',
      'video/mp4',
      'video/webm;codecs=vp9,opus',
      'video/webm;codecs=vp8,opus',
      'video/webm;codecs=vp9',
      'video/webm;codecs=vp8',
      'video/webm'
    ];
    if (!window.MediaRecorder) return '';
    for (var i = 0; i < cand.length; i++) {
      try { if (MediaRecorder.isTypeSupported(cand[i])) return cand[i]; } catch (e) {}
    }
    return '';
  }

  /* ---------------------------------------------------------------------
     5. 녹화 시작 / 정지 / 마무리
     --------------------------------------------------------------------- */
  function startRecording(durationSec) {
    srcCanvas = findSourceCanvas();
    if (!srcCanvas) { toast('화면을 찾지 못했어요 😢'); return; }
    if (!window.MediaRecorder) {
      toast('이 브라우저는 영상 저장을 지원하지 않아요. Chrome을 써 보세요!');
      return;
    }

    bgEl = findBgEl();
    preloadBg();

    // 합성 캔버스 준비 (선명도 위해 dpr 반영, 최대 2배)
    var scale = Math.min(window.devicePixelRatio || 1, 2);
    recCanvas = document.createElement('canvas');
    recCanvas.dataset.pgrec = '1';
    recCanvas.width = Math.max(2, Math.round(window.innerWidth * scale));
    recCanvas.height = Math.max(2, Math.round(window.innerHeight * scale));
    recCtx = recCanvas.getContext('2d');

    cancelAnimationFrame(rafId);
    drawFrame(); // 합성 루프 시작

    var stream = recCanvas.captureStream(30);
    attachAudio(stream);

    mime = pickMime();
    ext = mime.indexOf('mp4') !== -1 ? 'mp4' : 'webm';
    chunks = [];
    try {
      recorder = mime ? new MediaRecorder(stream, { mimeType: mime })
                      : new MediaRecorder(stream);
    } catch (e) {
      toast('녹화를 시작할 수 없어요 😢');
      stopLoops();
      return;
    }

    recorder.ondataavailable = function (ev) {
      if (ev.data && ev.data.size > 0) chunks.push(ev.data);
    };
    recorder.onstop = finalize;
    recorder.start();

    startTs = Date.now();
    showBadge(durationSec);
    tickTimer = setInterval(function () { updateBadge(durationSec); }, 200);

    if (durationSec && durationSec > 0) {
      autoStopTimer = setTimeout(stopRecording, durationSec * 1000);
    }
  }

  function stopLoops() {
    cancelAnimationFrame(rafId); rafId = 0;
    clearInterval(tickTimer); tickTimer = 0;
    clearTimeout(autoStopTimer); autoStopTimer = 0;
  }

  function stopRecording() {
    if (!recorder || recorder.state === 'inactive') { stopLoops(); hideBadge(); return; }
    try { recorder.stop(); } catch (e) {}
    stopLoops();
    hideBadge();
  }

  function finalize() {
    var blob = new Blob(chunks, { type: mime || 'video/webm' });
    chunks = [];
    if (lastBlobUrl) { try { URL.revokeObjectURL(lastBlobUrl); } catch (e) {} }
    lastBlobUrl = URL.createObjectURL(blob);
    showResult(lastBlobUrl, blob.size);
    // 합성 캔버스 정리
    recCanvas = null; recCtx = null;
  }

  function buildFileName() {
    var base = '놀이터';
    var h = document.getElementById('headerTitle') || document.querySelector('.ui-header');
    if (h && h.textContent) base = h.textContent.replace(/[^\p{L}\p{N} ]/gu, '').trim() || base;
    var d = new Date();
    function p(n) { return ('0' + n).slice(-2); }
    var stamp = d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate()) +
                '_' + p(d.getHours()) + p(d.getMinutes());
    return base + '_영상_' + stamp + '.' + ext;
  }

  function downloadCurrent() {
    if (!lastBlobUrl) return;
    var a = document.createElement('a');
    a.href = lastBlobUrl;
    a.download = buildFileName();
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  /* ---------------------------------------------------------------------
     6. UI — 버튼 / 시간선택 모달 / 녹화중 배지 / 결과 미리보기
        (engine.css 등에 의존하지 않도록 자체 스타일 주입)
     --------------------------------------------------------------------- */
  function fmt(sec) {
    sec = Math.max(0, Math.round(sec));
    var m = Math.floor(sec / 60), s = sec % 60;
    return ('0' + m).slice(-2) + ':' + ('0' + s).slice(-2);
  }

  function showBadge(durationSec) {
    var b = document.getElementById('pgrecBadge');
    b.classList.add('show');
    b.querySelector('.pgrec-time').textContent = durationSec ? fmt(durationSec) : '00:00';
  }
  function updateBadge(durationSec) {
    var b = document.getElementById('pgrecBadge');
    var el = b.querySelector('.pgrec-time');
    var elapsed = (Date.now() - startTs) / 1000;
    if (durationSec && durationSec > 0) el.textContent = fmt(durationSec - elapsed); // 남은 시간
    else el.textContent = fmt(elapsed); // 경과 시간
  }
  function hideBadge() {
    var b = document.getElementById('pgrecBadge');
    if (b) b.classList.remove('show');
  }

  function openSetup() {
    if (recorder && recorder.state === 'recording') return;
    document.getElementById('pgrecSetup').classList.add('show');
  }
  function closeSetup() {
    document.getElementById('pgrecSetup').classList.remove('show');
  }

  function showResult(url, size) {
    var m = document.getElementById('pgrecResult');
    var v = m.querySelector('video');
    v.src = url;
    var mb = (size / (1024 * 1024)).toFixed(1);
    m.querySelector('.pgrec-size').textContent = mb + ' MB · ' + ext.toUpperCase();
    m.classList.add('show');
  }
  function closeResult() {
    var m = document.getElementById('pgrecResult');
    var v = m.querySelector('video');
    try { v.pause(); } catch (e) {}
    v.src = '';
    m.classList.remove('show');
  }

  function toast(msg) {
    var t = document.getElementById('pgrecToast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(t.__h);
    t.__h = setTimeout(function () { t.classList.remove('show'); }, 2600);
  }

  function injectStyle() {
    if (document.getElementById('pgrecStyle')) return;
    var css = ''
      + '.pgrec-modal{position:fixed;inset:0;z-index:5000;display:none;justify-content:center;align-items:center;'
      +   'background:rgba(10,25,45,.6);backdrop-filter:blur(3px);padding:16px;font-family:"Gaegu","Jua",cursive,sans-serif;}'
      + '.pgrec-modal.show{display:flex;}'
      + '.pgrec-card{background:#fff;border-radius:30px;border:6px solid var(--accent,#ff6f91);'
      +   'box-shadow:0 18px 40px rgba(0,30,60,.3);padding:26px 26px 22px;max-width:440px;width:100%;text-align:center;'
      +   'animation:pgrecPop .35s ease-out;}'
      + '.pgrec-card h2{margin:4px 0 6px;font-size:1.8rem;color:var(--accent,#ff6f91);}'
      + '.pgrec-card p{margin:0 0 16px;color:#566;font-size:1.15rem;}'
      + '.pgrec-chips{display:flex;flex-wrap:wrap;gap:10px;justify-content:center;margin-bottom:8px;}'
      + '.pgrec-chip{padding:12px 18px;font:inherit;font-size:1.25rem;font-weight:700;cursor:pointer;'
      +   'border:3px solid var(--accent,#ff6f91);background:#fff;color:var(--accent,#ff6f91);border-radius:18px;transition:.12s;}'
      + '.pgrec-chip:active{transform:translateY(3px);}'
      + '.pgrec-chip.go{background:var(--accent,#ff6f91);color:#fff;border-color:var(--accent,#ff6f91);box-shadow:0 5px 0 var(--accent-dark,#d6336c);}'
      + '.pgrec-chip.ghost{border-color:#dde6ee;color:#5a6b7a;}'
      + '.pgrec-actions{display:flex;gap:10px;justify-content:center;margin-top:18px;}'
      // 녹화중 배지
      + '#pgrecBadge{position:fixed;top:14px;left:50%;transform:translateX(-50%) translateY(-150%);z-index:5200;'
      +   'display:flex;align-items:center;gap:12px;background:rgba(20,30,45,.86);color:#fff;'
      +   'padding:10px 14px 10px 16px;border-radius:40px;box-shadow:0 8px 22px rgba(0,0,0,.35);'
      +   'font-family:"Gaegu","Jua",cursive,sans-serif;font-size:1.3rem;transition:transform .35s;}'
      + '#pgrecBadge.show{transform:translateX(-50%) translateY(0);}'
      + '#pgrecBadge .pgrec-dot{width:14px;height:14px;border-radius:50%;background:#ff3b3b;animation:pgrecBlink 1s infinite;}'
      + '#pgrecBadge .pgrec-time{font-variant-numeric:tabular-nums;min-width:54px;text-align:center;}'
      + '#pgrecBadge .pgrec-stop{display:flex;align-items:center;gap:5px;background:#ff3b3b;color:#fff;border:none;'
      +   'font:inherit;font-size:1.15rem;padding:7px 14px;border-radius:30px;cursor:pointer;box-shadow:0 4px 0 #b71c1c;}'
      + '#pgrecBadge .pgrec-stop:active{transform:translateY(3px);box-shadow:0 1px 0 #b71c1c;}'
      // 결과 미리보기
      + '#pgrecResult video{width:100%;border-radius:18px;background:#000;max-height:55vh;}'
      + '.pgrec-size{color:#8a98a6;font-size:1rem;margin:8px 0 2px;}'
      // 토스트
      + '#pgrecToast{position:fixed;bottom:26px;left:50%;transform:translateX(-50%) translateY(20px);z-index:5300;'
      +   'background:#222;color:#fff;padding:12px 20px;border-radius:18px;font-family:"Gaegu",cursive,sans-serif;'
      +   'font-size:1.2rem;opacity:0;pointer-events:none;transition:.25s;max-width:90vw;text-align:center;}'
      + '#pgrecToast.show{opacity:1;transform:translateX(-50%) translateY(0);}'
      + '@keyframes pgrecPop{from{opacity:0;transform:scale(.85) translateY(16px);}to{opacity:1;transform:scale(1);}}'
      + '@keyframes pgrecBlink{0%,100%{opacity:1;}50%{opacity:.25;}}';
    var s = document.createElement('style');
    s.id = 'pgrecStyle';
    s.textContent = css;
    document.head.appendChild(s);
  }

  function injectUI() {
    injectStyle();

    // (1) 상단 버튼 클러스터에 '영상' 버튼 추가 — 기존 버튼과 같은 모양
    var cluster = document.querySelector('.btn-cluster') || document.querySelector('.btn-group-horizontal');
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.id = 'pgrecBtn';
    if (cluster) {
      btn.className = 'btn btn-ghost';
      btn.innerHTML = '<span class="ico">🎬</span><span>영상</span>';
      cluster.appendChild(btn);
    } else {
      // 클러스터가 없으면 화면에 떠 있는 버튼
      btn.textContent = '🎬 영상 저장';
      btn.style.cssText = 'position:fixed;right:14px;bottom:14px;z-index:4000;padding:12px 18px;'
        + 'font-family:"Gaegu",cursive;font-size:1.2rem;font-weight:700;border:none;border-radius:18px;'
        + 'background:#ff3b3b;color:#fff;box-shadow:0 5px 0 #b71c1c;cursor:pointer;';
      document.body.appendChild(btn);
    }
    btn.addEventListener('click', openSetup);

    // (2) 시간 선택 모달
    var setup = document.createElement('div');
    setup.id = 'pgrecSetup';
    setup.className = 'pgrec-modal';
    setup.innerHTML =
      '<div class="pgrec-card">'
      + '<h2>🎬 영상으로 저장하기</h2>'
      + '<p>얼마나 녹화할까요?</p>'
      + '<div class="pgrec-chips">'
      +   '<button class="pgrec-chip" data-sec="10">10초</button>'
      +   '<button class="pgrec-chip" data-sec="30">30초</button>'
      +   '<button class="pgrec-chip" data-sec="60">1분</button>'
      +   '<button class="pgrec-chip" data-sec="180">3분</button>'
      +   '<button class="pgrec-chip go" data-sec="0">⏺ 멈출 때까지</button>'
      + '</div>'
      + '<div class="pgrec-actions">'
      +   '<button class="pgrec-chip ghost" id="pgrecCancel">취소</button>'
      + '</div>'
      + '</div>';
    document.body.appendChild(setup);
    setup.addEventListener('click', function (e) {
      if (e.target === setup) closeSetup();
      var chip = e.target.closest('.pgrec-chip[data-sec]');
      if (chip) { closeSetup(); startRecording(parseInt(chip.dataset.sec, 10)); }
    });
    setup.querySelector('#pgrecCancel').addEventListener('click', closeSetup);

    // (3) 녹화중 배지
    var badge = document.createElement('div');
    badge.id = 'pgrecBadge';
    badge.innerHTML =
      '<span class="pgrec-dot"></span>'
      + '<span class="pgrec-time">00:00</span>'
      + '<button class="pgrec-stop">⏹ 멈춤</button>';
    document.body.appendChild(badge);
    badge.querySelector('.pgrec-stop').addEventListener('click', stopRecording);

    // (4) 결과 미리보기 모달
    var result = document.createElement('div');
    result.id = 'pgrecResult';
    result.className = 'pgrec-modal';
    result.innerHTML =
      '<div class="pgrec-card">'
      + '<h2>영상이 완성됐어요! 🎉</h2>'
      + '<video controls playsinline></video>'
      + '<div class="pgrec-size"></div>'
      + '<div class="pgrec-actions">'
      +   '<button class="pgrec-chip ghost" id="pgrecClose">닫기</button>'
      +   '<button class="pgrec-chip go" id="pgrecSave">💾 저장하기</button>'
      + '</div>'
      + '</div>';
    document.body.appendChild(result);
    result.addEventListener('click', function (e) { if (e.target === result) closeResult(); });
    result.querySelector('#pgrecClose').addEventListener('click', closeResult);
    result.querySelector('#pgrecSave').addEventListener('click', downloadCurrent);

    // (5) 토스트
    var t = document.createElement('div');
    t.id = 'pgrecToast';
    document.body.appendChild(t);
  }

  // 전역으로도 노출 (원하면 onclick="PGRecorder.open()" 으로 직접 호출 가능)
  window.PGRecorder = { open: openSetup, start: startRecording, stop: stopRecording };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', injectUI);
  } else {
    injectUI();
  }
})();
