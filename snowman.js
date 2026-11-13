/* =========================================================
   눈사람 만들기
   ① 눈밭에서 눈덩이를 굴려 몸통을 만들고
   ② 한 번 더 굴려 머리를 만들고
   ③ 두 개를 쌓은 뒤
   ④ 모자·당근·단추·목도리·장갑·나뭇가지로 꾸미고
   ⑤ 눈사람과 함께 사진을 찍습니다.

   중도발달장애 학생을 생각해서,
   - 끌어서 굴려도 되고, 큰 단추를 눌러서 굴려도 됩니다 (스위치로도 됩니다)
   - 틀리는 일이 없습니다. 무엇을 골라도 예쁘게 붙습니다
   - 단계마다 말과 소리로 알려 줍니다
   ========================================================= */
(function () {
"use strict";

const $ = id => document.getElementById(id);
const NS = 'http://www.w3.org/2000/svg';
const DIR = 'snow/';                       // 꾸미기 그림이 있는 곳

/* ---------- 설정 ---------- */
const cfg = PK.load('snowman', { grow: 0.095, snow: 1, sound: true, voice: true, rate: 0.85 });

/* ---------- 무대 좌표 ---------- */
const GROUND = 592;                        // 눈덩이가 놓이는 바닥 줄
const XMIN = 120, XMAX = 880;
const BODY = { x: 500, y: 470, r: 150 };   // 몸통 (쌓은 뒤 자리)
const HEAD = { x: 500, y: 243, r: 95 };    // 머리

const scene = $('scene'), stage = $('stage');
const gTrail = $('trail'), gDone = $('done'), gMan = $('man'),
      gDeco = $('decoG'), gBall = $('ballG2'), gFlakes = $('flakes'), gTrees = $('trees');

/* ---------- 눈덩이 ---------- */
const PLAN = [
  { key: 'body', name: '몸통', from: 30, to: BODY.r, say: '큰 눈덩이를 굴려요' },
  { key: 'head', name: '머리', from: 24, to: HEAD.r, say: '이번엔 작은 눈덩이예요' }
];
let phase = 'roll';                        // roll · stack · deco · photo
let step = 0;                              // 0 몸통 · 1 머리
let ball = null, trail = [], madeR = [];

/* =========================================================
   그림(꾸미기) 목록 — snow/ 폴더의 CC0 그림을 씁니다.
   w  : 눈사람에 붙일 때의 가로 크기(장면 좌표)
   dx,dy : 기준점에서 조금 옮기기 / rot : 기울이기
   ========================================================= */
const DECO = window.SNOW_DECO || {};

/* 고른 것과 손으로 옮긴 양 */
let picked = {}, nudge = {};

/* =========================================================
   눈 내리기 · 나무
   ========================================================= */
function makeTrees() {
  const T = [[70, 486, 1.25], [155, 498, .9], [880, 480, 1.35], [810, 496, .95], [955, 492, 1.05]];
  gTrees.innerHTML = T.map(([x, y, s]) => {
    const h = 120 * s, w = 62 * s;
    return '<g transform="translate(' + x + ',' + y + ')">' +
      '<rect x="' + (-7 * s) + '" y="-14" width="' + (14 * s) + '" height="' + (26 * s) + '" fill="#8a6a4a"/>' +
      '<path d="M0 ' + (-h) + ' L' + w + ' -34 H' + (-w) + 'Z" fill="#3f7d5c"/>' +
      '<path d="M0 ' + (-h * .72) + ' L' + (w * .86) + ' -8 H' + (-w * .86) + 'Z" fill="#4a8f69"/>' +
      '<path d="M0 ' + (-h) + ' L' + (w * .5) + ' ' + (-h * .5) + ' H' + (-w * .5) + 'Z" fill="#eaf6ff" opacity=".85"/>' +
      '</g>';
  }).join('');
}

const flakes = [];
function makeFlakes() {
  gFlakes.innerHTML = '';
  flakes.length = 0;
  if (!cfg.snow) return;
  for (let i = 0; i < 46; i++) {
    const c = document.createElementNS(NS, 'circle');
    const f = { x: Math.random() * 1000, y: Math.random() * 700, r: 2 + Math.random() * 4,
                v: 14 + Math.random() * 26, w: Math.random() * 6.3, el: c };
    c.setAttribute('r', f.r); c.setAttribute('fill', '#fff'); c.setAttribute('opacity', .85);
    gFlakes.appendChild(c); flakes.push(f);
  }
}
let last = performance.now();
function loop(now) {
  const dt = Math.min(60, now - last) / 1000; last = now;
  for (const f of flakes) {
    f.y += f.v * dt; f.w += dt * 1.6;
    if (f.y > 710) { f.y = -10; f.x = Math.random() * 1000; }
    f.el.setAttribute('cx', (f.x + Math.sin(f.w) * 14).toFixed(1));
    f.el.setAttribute('cy', f.y.toFixed(1));
  }
  requestAnimationFrame(loop);
}

/* =========================================================
   눈덩이 굴리기
   ========================================================= */
function ballTexture(r) {
  return '<path d="M' + (-r * .55) + ' ' + (-r * .2) + ' a' + (r * .6) + ' ' + (r * .6) + ' 0 0 1 ' + (r * .9) + ' ' + (-r * .3) + '" ' +
         'stroke="#dcebf7" stroke-width="' + (r * .09) + '" fill="none" stroke-linecap="round"/>' +
         '<path d="M' + (-r * .2) + ' ' + (r * .55) + ' a' + (r * .55) + ' ' + (r * .55) + ' 0 0 0 ' + (r * .75) + ' ' + (-r * .25) + '" ' +
         'stroke="#e6f2fb" stroke-width="' + (r * .08) + '" fill="none" stroke-linecap="round"/>' +
         '<circle cx="' + (-r * .3) + '" cy="' + (-r * .45) + '" r="' + (r * .1) + '" fill="#fff"/>';
}
function drawBall() {
  if (!ball) { gBall.innerHTML = ''; return; }
  const r = ball.r, y = GROUND - r;
  gBall.innerHTML =
    '<ellipse cx="' + ball.x.toFixed(1) + '" cy="' + (GROUND + 8) + '" rx="' + (r * .95).toFixed(1) +
      '" ry="' + (r * .2).toFixed(1) + '" fill="#9fbdd4" opacity=".4"/>' +
    '<g transform="translate(' + ball.x.toFixed(1) + ',' + y.toFixed(1) + ') rotate(' + (ball.rot * 57.3).toFixed(1) + ')">' +
      '<circle r="' + r.toFixed(1) + '" fill="url(#ballG)" stroke="#c6dbec" stroke-width="3"/>' +
      ballTexture(r) +
    '</g>';
}
function drawTrail() {
  gTrail.innerHTML = trail.map(t =>
    '<ellipse cx="' + t.x.toFixed(0) + '" cy="' + (GROUND + 7) + '" rx="' + (t.r * .9).toFixed(0) +
    '" ry="' + (t.r * .19).toFixed(0) + '" fill="#b9d2e6"/>').join('');
}

function newBall() {
  const P = PLAN[step];
  ball = { x: XMIN + 40, r: P.from, rot: 0, dir: 1, mark: 0 };
  trail = [];
  drawBall(); drawTrail(); meter();
  tell(P.say + ' — 끌거나, 아래 단추를 눌러요');
  PK.say(P.say);
}

/* 굴린 거리만큼 커집니다 */
function roll(dx) {
  if (!ball || phase !== 'roll') return;
  const P = PLAN[step];
  const nx = Math.max(XMIN, Math.min(XMAX, ball.x + dx));
  const moved = Math.abs(nx - ball.x);
  ball.x = nx;
  if (!moved) return;
  ball.rot += (dx > 0 ? 1 : -1) * moved / ball.r;
  ball.r = Math.min(P.to, ball.r + moved * cfg.grow);
  ball.mark += moved;
  if (ball.mark > 15) {                      // 지나간 자리에 눈이 눌린 자국
    ball.mark = 0;
    trail.push({ x: ball.x, r: ball.r });
    if (trail.length > 150) trail.shift();
    drawTrail();
  }
  drawBall(); meter();
  if (ball.r >= P.to - .4) finishBall();
}

function meter() {
  const P = PLAN[step];
  const p = ball ? Math.max(0, Math.min(1, (ball.r - P.from) / (P.to - P.from))) : 0;
  $('meterFill').style.width = (p * 100).toFixed(0) + '%';
  $('meterTxt').textContent = P.name + ' ' + (p * 100).toFixed(0) + '%';
}

function finishBall() {
  if (phase !== 'roll') return;
  phase = 'wait';
  madeR[step] = ball.r;
  /* 다 만든 눈덩이는 한쪽에 둡니다 */
  const keep = { x: ball.x, r: ball.r, rot: ball.rot };
  gDone.insertAdjacentHTML('beforeend',
    '<g class="made" data-i="' + step + '">' +
    '<ellipse cx="' + keep.x.toFixed(1) + '" cy="' + (GROUND + 8) + '" rx="' + (keep.r * .95).toFixed(1) +
      '" ry="' + (keep.r * .2).toFixed(1) + '" fill="#9fbdd4" opacity=".4"/>' +
    '<g transform="translate(' + keep.x.toFixed(1) + ',' + (GROUND - keep.r).toFixed(1) + ')">' +
      '<circle r="' + keep.r.toFixed(1) + '" fill="url(#ballG)" stroke="#c6dbec" stroke-width="3"/>' +
      ballTexture(keep.r) + '</g></g>');
  ball = null; drawBall();
  PK.cheer('⛄', PLAN[step].name + ' 완성!', 1500);
  setTimeout(() => {
    step++;
    if (step < PLAN.length) { phase = 'roll'; newBall(); }
    else stack();
  }, 1600);
}

/* =========================================================
   두 눈덩이 쌓기
   ========================================================= */
function stack() {
  phase = 'stack';
  tell('눈덩이를 쌓을게요!'); PK.say('눈덩이를 쌓아요');
  $('meter').hidden = true;
  const made = [...gDone.querySelectorAll('.made')];
  const t0 = performance.now(), DUR = 1100;
  /* 지금 자리에서 눈사람 자리로 스르륵 옮깁니다 */
  const from = made.map(g => {
    const i = +g.dataset.i, r = madeR[i];
    const c = g.querySelector('g');
    const m = /translate\(([-\d.]+),([-\d.]+)\)/.exec(c.getAttribute('transform'));
    return { g, i, r, x: +m[1], y: +m[2] };
  });
  const to = [{ x: BODY.x, y: BODY.y }, { x: HEAD.x, y: HEAD.y }];
  (function anim(now) {
    const p = Math.min(1, (now - t0) / DUR);
    const e = 1 - Math.pow(1 - p, 3);
    from.forEach(f => {
      const tx = to[f.i].x, ty = to[f.i].y;
      const x = f.x + (tx - f.x) * e;
      const y = f.y + (ty - f.y) * e - Math.sin(Math.PI * p) * 70 * (f.i ? 1 : .3);
      f.g.setAttribute('transform', 'translate(' + (x - f.x).toFixed(1) + ',' + (y - f.y).toFixed(1) + ')');
    });
    if (p < 1) requestAnimationFrame(anim);
    else { gDone.innerHTML = ''; gTrail.innerHTML = ''; drawMan(); toDeco(); }
  })(performance.now());
}

function drawMan() {
  gMan.innerHTML =
    '<ellipse cx="' + BODY.x + '" cy="' + (BODY.y + BODY.r + 6) + '" rx="' + (BODY.r * 1.02) +
      '" ry="' + (BODY.r * .2) + '" fill="#9fbdd4" opacity=".4"/>' +
    '<circle cx="' + BODY.x + '" cy="' + BODY.y + '" r="' + BODY.r + '" fill="url(#ballG)" stroke="#c6dbec" stroke-width="3"/>' +
    '<circle cx="' + HEAD.x + '" cy="' + HEAD.y + '" r="' + HEAD.r + '" fill="url(#ballG)" stroke="#c6dbec" stroke-width="3"/>';
}

/* =========================================================
   꾸미기
   ========================================================= */
const CATS = ['hat', 'eye', 'nose', 'mouth', 'scarf', 'button', 'arm', 'glove'];
let curCat = 'hat';

function toDeco() {
  phase = 'deco';
  $('deco').hidden = false;
  $('btnMain').textContent = '📸 눈사람과 사진 찍기';
  $('btnMain').classList.add('ok');
  drawTabs(); drawItems(); paintDeco();
  PK.cheer('⛄', '눈사람 완성!', 1400);
  tell('이제 예쁘게 꾸며 주세요');
  setTimeout(() => PK.say('이제 꾸며 볼까요'), 900);
}

function drawTabs() {
  $('tabs').innerHTML = CATS.filter(c => DECO[c]).map(c =>
    '<button class="tab' + (c === curCat ? ' on' : '') + '" data-c="' + c + '">' + DECO[c].label + '</button>').join('');
}
function drawItems() {
  const d = DECO[curCat]; if (!d) return;
  const now = picked[curCat];
  $('items').innerHTML =
    '<button class="item none" data-f="">🚫<span>없애기</span></button>' +
    d.items.map(it =>
      '<button class="item' + (now === it.f ? ' on' : '') + '" data-f="' + it.f + '">' +
      '<img src="' + DIR + it.f + '" alt=""></button>').join('');
}

/* 꾸미기 조각들의 자리를 한곳에서 정합니다.
   화면(SVG)에 그릴 때도, 사진으로 만들 때도 이 목록을 씁니다. */
function parts() {
  const out = [
    { t: 'circle', x: BODY.x, y: BODY.y, r: BODY.r },
    { t: 'circle', x: HEAD.x, y: HEAD.y, r: HEAD.r }
  ];
  for (const c of CATS) {
    const d = DECO[c], f = picked[c];
    if (!d || !f) continue;
    const it = d.items.find(i => i.f === f); if (!it) continue;
    const n = nudge[c] || { dx: 0, dy: 0 };
    const w = it.w, h = w * (it.ar || 1);
    const spots = d.spots(it);                       // [{x,y,flip?,rot?}, ...]
    for (const s of spots) {
      out.push({
        t: 'img', cat: c, src: DIR + it.f,
        x: s.x + (it.dx || 0) * (s.flip ? -1 : 1) + n.dx,
        y: s.y + (it.dy || 0) + n.dy,
        w: w, h: h,
        rot: (s.rot || 0) + (it.rot || 0) * (s.flip ? -1 : 1),
        flip: !!s.flip
      });
    }
  }
  return out;
}

function paintDeco() {
  const ps = parts().filter(p => p.t === 'img');
  gDeco.innerHTML = ps.map(p => {
    const tf = 'translate(' + p.x.toFixed(1) + ',' + p.y.toFixed(1) + ')' +
               (p.rot ? ' rotate(' + p.rot + ')' : '') +
               (p.flip ? ' scale(-1,1)' : '');
    return '<g class="dc" data-c="' + p.cat + '" transform="' + tf + '" style="cursor:grab">' +
           '<image href="' + p.src + '" x="' + (-p.w / 2) + '" y="' + (-p.h / 2) +
           '" width="' + p.w + '" height="' + p.h + '" preserveAspectRatio="xMidYMid meet"/></g>';
  }).join('');
}

/* =========================================================
   화면 좌표 ↔ 장면 좌표
   ========================================================= */
function toScene(ev) {
  const m = scene.getScreenCTM();
  if (!m) return { x: 0, y: 0 };
  const inv = m.inverse();
  return { x: ev.clientX * inv.a + ev.clientY * inv.c + inv.e,
           y: ev.clientX * inv.b + ev.clientY * inv.d + inv.f };
}

/* =========================================================
   손가락 / 마우스
   ========================================================= */
let grab = null;
stage.addEventListener('pointerdown', e => {
  if (phase === 'roll') {
    grab = { kind: 'roll', x: toScene(e).x };
    stage.setPointerCapture && stage.setPointerCapture(e.pointerId);
  } else if (phase === 'deco') {
    const g = e.target.closest && e.target.closest('.dc');
    if (g) {
      const p = toScene(e);
      grab = { kind: 'move', cat: g.dataset.c, x: p.x, y: p.y };
      PK.beep('pick');
    }
  }
});
stage.addEventListener('pointermove', e => {
  if (!grab) return;
  const p = toScene(e);
  if (grab.kind === 'roll') { roll(p.x - grab.x); grab.x = p.x; }
  else {
    const n = nudge[grab.cat] || (nudge[grab.cat] = { dx: 0, dy: 0 });
    n.dx += p.x - grab.x; n.dy += p.y - grab.y;
    grab.x = p.x; grab.y = p.y;
    paintDeco();
  }
});
['pointerup', 'pointercancel', 'pointerleave'].forEach(ev =>
  stage.addEventListener(ev, () => { grab = null; }));

/* 단추로 굴리기 (스위치로도 쓸 수 있게) */
let sweeping = false;
function sweep() {
  if (phase !== 'roll' || sweeping || !ball) return;
  sweeping = true;
  const dist = 270, t0 = performance.now(), DUR = 900;
  let prev = 0;
  if (ball.x >= XMAX - 2) ball.dir = -1;
  if (ball.x <= XMIN + 2) ball.dir = 1;
  const dir = ball.dir;
  (function anim(now) {
    const p = Math.min(1, (now - t0) / DUR);
    const e = p < .5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
    const cur = e * dist;
    roll((cur - prev) * dir); prev = cur;
    if (p < 1 && phase === 'roll') requestAnimationFrame(anim);
    else { sweeping = false; if (ball && (ball.x >= XMAX - 2 || ball.x <= XMIN + 2)) ball.dir = -dir; }
  })(performance.now());
}

/* =========================================================
   사진 찍기
   ========================================================= */
let stream = null, shotURL = null;
const video = $('cam'), shotCv = $('shotCv');
const imgCache = {};
function getImg(src) {
  if (imgCache[src]) return imgCache[src];
  const im = new Image(); im.src = src; imgCache[src] = im; return im;
}

/* 꾸미개까지 다 들어가는 넓이 (장면 좌표) */
const SPAN_W = 680, SPAN_H = 610;
function fitScale(w, h) { return Math.min(w / SPAN_W, h / SPAN_H); }

/* 눈사람을 캔버스에 그립니다 (장면 좌표 → 캔버스 좌표) */
function paintSnowman(ctx, cx, bottomY, scale) {
  const ps = parts();
  const X = v => cx + (v - BODY.x) * scale;
  const Y = v => bottomY + (v - (BODY.y + BODY.r)) * scale;
  for (const p of ps) {
    if (p.t === 'circle') {
      const g = ctx.createRadialGradient(X(p.x - p.r * .3), Y(p.y - p.r * .35), p.r * scale * .1,
                                         X(p.x), Y(p.y), p.r * scale);
      g.addColorStop(0, '#ffffff'); g.addColorStop(.7, '#f2f8ff'); g.addColorStop(1, '#cfe0ef');
      ctx.fillStyle = g; ctx.strokeStyle = '#c6dbec'; ctx.lineWidth = 3 * scale;
      ctx.beginPath(); ctx.arc(X(p.x), Y(p.y), p.r * scale, 0, 7); ctx.fill(); ctx.stroke();
    } else {
      const im = getImg(p.src);
      if (!im.complete || !im.naturalWidth) continue;
      ctx.save();
      ctx.translate(X(p.x), Y(p.y));
      if (p.rot) ctx.rotate(p.rot * Math.PI / 180);
      if (p.flip) ctx.scale(-1, 1);
      const w = p.w * scale, h = p.h * scale;
      /* 비율을 지켜 네모 안에 넣습니다 */
      const s = Math.min(w / im.naturalWidth, h / im.naturalHeight);
      ctx.drawImage(im, -im.naturalWidth * s / 2, -im.naturalHeight * s / 2,
                    im.naturalWidth * s, im.naturalHeight * s);
      ctx.restore();
    }
  }
}

function winterBack(ctx, W, H) {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#8ec5f0'); g.addColorStop(.55, '#cfe7fa'); g.addColorStop(1, '#eef7ff');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#ffffff';
  ctx.beginPath(); ctx.ellipse(W * .5, H * 1.02, W * .9, H * .33, 0, 0, 7); ctx.fill();
  ctx.globalAlpha = .9;
  for (let i = 0; i < 70; i++) {
    ctx.beginPath();
    ctx.arc(Math.random() * W, Math.random() * H * .8, 1.5 + Math.random() * 3.5, 0, 7);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

async function openPhoto() {
  phase = 'photo';
  $('deco').hidden = true;
  $('photo').hidden = false;
  $('btnBack').hidden = false;
  $('btnMain').hidden = true;
  $('camMsg').textContent = '카메라를 켜는 중…';
  drawShot();                                   // 먼저 눈사람만이라도 보여 줍니다
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'user', width: { ideal: 960 }, height: { ideal: 720 } }, audio: false });
    video.srcObject = stream;
    await video.play();
    $('camMsg').textContent = '눈사람 옆에 서 보세요!';
    PK.say('눈사람 옆에 서 보세요');
    liveLoop();
  } catch (err) {
    $('camMsg').textContent = '카메라를 쓸 수 없어요. 눈사람만 저장할 수 있어요';
    $('btnSnap').disabled = true;
  }
}
let liveOn = false;
function liveLoop() {
  if (liveOn) return;
  liveOn = true;
  (function tick() {
    if (phase !== 'photo' || !stream) { liveOn = false; return; }
    drawShot();
    requestAnimationFrame(tick);
  })();
}

/* 카메라 그림 + 눈사람을 한 장으로 */
function drawShot(forSave) {
  const W = 960, H = 720;
  const cv = forSave ? document.createElement('canvas') : shotCv;
  cv.width = W; cv.height = H;
  const ctx = cv.getContext('2d');
  if (stream && video.videoWidth) {
    const vw = video.videoWidth, vh = video.videoHeight;
    const s = Math.max(W / vw, H / vh);
    ctx.save(); ctx.translate(W, 0); ctx.scale(-1, 1);       /* 거울처럼 */
    ctx.drawImage(video, (W - vw * s) / 2, (H - vh * s) / 2, vw * s, vh * s);
    ctx.restore();
  } else {
    winterBack(ctx, W, H);
  }
  /* 아래쪽 눈밭 */
  ctx.fillStyle = 'rgba(255,255,255,.92)';
  ctx.beginPath(); ctx.ellipse(W * .5, H * 1.06, W * .75, H * .22, 0, 0, 7); ctx.fill();
  /* 카메라가 있으면 오른쪽에, 없으면 가운데에 크게 */
  if (stream && video.videoWidth) paintSnowman(ctx, W * .73, H * .95, fitScale(W * .52, H * .86));
  else paintSnowman(ctx, W * .5, H * .94, fitScale(W * .9, H * .84));
  return cv;
}

function closeCam() {
  if (stream) { stream.getTracks().forEach(t => t.stop()); stream = null; }
  video.srcObject = null; liveOn = false;
}

function snap() {
  const cv = drawShot(true);
  cv.toBlob(b => {
    if (!b) { tell('사진을 만들 수 없어요'); return; }
    if (shotURL) URL.revokeObjectURL(shotURL);
    shotURL = URL.createObjectURL(b);
    $('viewImg').src = shotURL;
    $('viewer').hidden = false;
    PK.beep('win'); PK.buzz([40, 30, 80]);
    tell('참 잘 나왔어요!');
  }, 'image/png');
}

function saveShot() {
  if (!shotURL) return;
  const d = new Date(), p = n => String(n).padStart(2, '0');
  const a = document.createElement('a');
  a.href = shotURL;
  a.download = '눈사람_' + d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate()) + '_' +
               p(d.getHours()) + p(d.getMinutes()) + p(d.getSeconds()) + '.png';
  a.click();
  PK.beep('good'); tell('저장했어요 💾'); PK.say('저장했어요');
}

/* =========================================================
   단추들
   ========================================================= */
function tell(t) { PK.tell(t); }

$('btnMain').addEventListener('click', () => {
  if (phase === 'roll') { sweep(); PK.beep('tap'); }
  else if (phase === 'deco') openPhoto();
});
document.addEventListener('keydown', e => {
  if (e.repeat) return;
  if (e.code === 'Space' || e.code === 'Enter' || e.code === 'NumpadEnter') {
    if (!$('setSheet').hidden || !$('viewer').hidden) return;
    e.preventDefault();
    $('btnMain').hidden ? null : $('btnMain').click();
  }
});

$('tabs').addEventListener('click', e => {
  const b = e.target.closest('.tab'); if (!b) return;
  curCat = b.dataset.c; drawTabs(); drawItems(); PK.beep('tap');
});
$('items').addEventListener('click', e => {
  const b = e.target.closest('.item'); if (!b) return;
  const f = b.dataset.f;
  if (!f) { delete picked[curCat]; delete nudge[curCat]; PK.beep('tap'); }
  else if (picked[curCat] === f) { delete picked[curCat]; delete nudge[curCat]; PK.beep('tap'); }
  else { picked[curCat] = f; delete nudge[curCat]; PK.beep('pick'); PK.buzz(20); }
  drawItems(); paintDeco();
});

$('btnSnap').addEventListener('click', snap);
$('btnNoCam').addEventListener('click', () => {
  const W = 760, H = 860, cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  const ctx = cv.getContext('2d');
  winterBack(ctx, W, H);
  paintSnowman(ctx, W / 2, H * .93, fitScale(W * .94, H * .84));
  cv.toBlob(b => {
    if (shotURL) URL.revokeObjectURL(shotURL);
    shotURL = URL.createObjectURL(b);
    $('viewImg').src = shotURL; $('viewer').hidden = false;
    PK.beep('win');
  }, 'image/png');
});
$('btnSave').addEventListener('click', saveShot);
$('btnAgain').addEventListener('click', () => { $('viewer').hidden = true; });
$('btnBack').addEventListener('click', () => {
  $('viewer').hidden = true; $('photo').hidden = true; $('btnBack').hidden = true;
  $('btnMain').hidden = false; $('deco').hidden = false;
  closeCam(); phase = 'deco'; tell('더 꾸며 볼까요?');
});

/* 설정 */
$('btnSet').addEventListener('click', () => { $('setSheet').hidden = false; });
$('btnClose').addEventListener('click', () => { $('setSheet').hidden = true; });
$('btnReset').addEventListener('click', () => { location.reload(); });
PK.bindOpts([['optGrow', 'grow'], ['optSnow', 'snow'], ['optSound', 'sound'], ['optVoice', 'voice']],
  cfg, 'snowman', k => { if (k === 'snow') makeFlakes(); });

/* =========================================================
   시작
   ========================================================= */
makeTrees(); makeFlakes(); newBall();
requestAnimationFrame(loop);

})();
