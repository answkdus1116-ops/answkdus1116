/* =====================================================================
   🌸 내 친구 동물 농장 - animals.js (full)
   - 절차적 2D 캔버스 동물 (고양이/강아지/토끼/곰)
   - 드래그로 빙글 회전 (관성 + 자동 복귀) / 터치 지원
   - 동작별 모션: 밥주기(냠냠)·놀기(웃음+공)·재우기(눈감고 Zzz)·씻기기(샤워+거품)
   - Web Audio 합성 효과음 (외부 파일 불필요, 오프라인 동작)
   - 노트북 + 태블릿 호환 (Pointer Events, devicePixelRatio)
   ===================================================================== */

/* ------------------------------------------------------------------ */
/* 1. 게임 상태                                                         */
/* ------------------------------------------------------------------ */
const S = {
  petType: 'cat', petName: '모찌',
  level: 1, exp: 10, expMax: 100,
  coins: 120, hp: 85, hunger: 60, happy: 75,

  action: null,            // null | 'feed' | 'play' | 'sleep' | 'wash'
  actionUntil: 0,          // 동작 종료 시각(초)
  expr: 'normal',          // 'normal'|'happy'|'sleep'|'eat'|'wash'|'love'|'sad'

  rot: 0,                  // 캔버스 회전각(라디안) - 사용자가 드래그로 조절
  spinVel: 0,              // 회전 관성
  jump: 0,                 // 점프 오프셋(놀기)
  shiver: 0,               // 떨림(씻기기)
  mouthOpen: 0,            // 입 벌림(0~1)
  blink: 0,                // 깜빡임(0=뜸,1=감음)
  nextBlink: 2,            // 다음 깜빡임 시각
  soundOn: true,
};

const PETS = ['cat', 'dog', 'bunny', 'bear'];
const PET_KR = { cat: '고양이', dog: '강아지', bunny: '토끼', bear: '곰' };

/* 동물별 색 팔레트 */
const PAL = {
  cat:   { body:'#ffb3d1', belly:'#ffe6f2', line:'#d96aa0', ear:'#ff8fbe', cheek:'#ff7eb3', nose:'#e05a8f', dark:'#4a2b3a' },
  dog:   { body:'#e8c08a', belly:'#f7e3bf', line:'#bd8a45', ear:'#caa05a', cheek:'#f0a36b', nose:'#3a2a1c', dark:'#3a2a1c' },
  bunny: { body:'#dfe2ff', belly:'#fff2fb', line:'#a9adea', ear:'#ffc9dd', cheek:'#ffa6c9', nose:'#e87bab', dark:'#4a4570' },
  bear:  { body:'#c79a5f', belly:'#e4c690', line:'#8a5f2c', ear:'#a87a3e', cheek:'#e89a6b', nose:'#3a2616', dark:'#3a2616' },
};

/* 동물별 idle 성격 (꼬리/귀 흔드는 속도 등) */
const TRAIT = {
  cat:   { tailSpd:2.0, tailAmp:0.45, earWig:0.10, bobSpd:1.4, bob:7 },
  dog:   { tailSpd:6.0, tailAmp:0.55, earWig:0.18, bobSpd:1.8, bob:9 },
  bunny: { tailSpd:3.5, tailAmp:0.20, earWig:0.30, bobSpd:2.2, bob:6 },
  bear:  { tailSpd:1.2, tailAmp:0.25, earWig:0.06, bobSpd:1.1, bob:5 },
};

/* ------------------------------------------------------------------ */
/* 2. 캔버스 & 루프                                                     */
/* ------------------------------------------------------------------ */
let canvas, ctx, dpr = 1;
let cssW = 0, cssH = 0;
let t = 0, lastTS = 0;
let isDrag = false, dragMoved = 0, dragLastX = 0, dragStartT = 0;

function initCanvas() {
  canvas = document.getElementById('pc');
  if (!canvas) return;
  ctx = canvas.getContext('2d');
  resize();
  window.addEventListener('resize', () => { resize(); positionBubble(); });

  bindPointer();
  positionBubble();
  updateBars();
  updateHeader();
  renderChatChoices();
  setBubble('안녕! 나랑 놀아줘~ 🎀');

  requestAnimationFrame(loop);
}

function resize() {
  const rect = canvas.parentElement.getBoundingClientRect();
  dpr = Math.min(window.devicePixelRatio || 1, 2.5);
  cssW = rect.width; cssH = rect.height;
  canvas.width = Math.round(cssW * dpr);
  canvas.height = Math.round(cssH * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0); // 모든 그리기는 CSS 픽셀 기준
}

function loop(ts) {
  requestAnimationFrame(loop);
  let dt = (ts - lastTS) / 1000;
  lastTS = ts;
  if (!isFinite(dt) || dt <= 0) dt = 0.016;
  dt = Math.min(dt, 0.05);           // 탭 전환 후 점프 방지
  t += dt;
  step(dt);
  draw();
}

/* ------------------------------------------------------------------ */
/* 3. 애니메이션 상태 업데이트                                          */
/* ------------------------------------------------------------------ */
function step(dt) {
  const tr = TRAIT[S.petType];

  // 회전: 드래그 중이 아니면 관성 + 부드럽게 똑바로 복귀
  if (!isDrag) {
    S.rot += S.spinVel * dt;
    S.spinVel *= Math.pow(0.12, dt);          // 마찰
    if (Math.abs(S.spinVel) < 0.15) {
      S.rot += (0 - S.rot) * Math.min(1, dt * 4); // 똑바로 복귀
      if (Math.abs(S.rot) < 0.002) S.rot = 0;
    }
  }

  // 동작 종료 처리
  if (S.action && t > S.actionUntil) endAction();

  // 깜빡임 (동작 중엔 표정 우선)
  if (S.expr === 'normal' || S.expr === 'sad') {
    if (t > S.nextBlink) {
      S.blink = Math.min(1, S.blink + dt * 14);
      if (S.blink >= 1) { S.nextBlink = t + 2 + Math.random() * 3; }
    } else if (S.blink > 0) {
      S.blink = Math.max(0, S.blink - dt * 14);
    }
  } else { S.blink = 0; }

  // 동작별 모션
  if (S.action === 'play') {
    S.jump = Math.abs(Math.sin(t * 7)) * 46;
    S.mouthOpen = 0.8 + Math.sin(t * 7) * 0.2;
  } else if (S.action === 'feed') {
    S.jump = 0;
    S.mouthOpen = (Math.sin(t * 10) * 0.5 + 0.5);   // 우물우물
  } else if (S.action === 'wash') {
    S.jump = 0;
    S.shiver = Math.sin(t * 22) * 2.5;
    S.mouthOpen = 0;
  } else if (S.action === 'sleep') {
    S.jump = 0; S.mouthOpen = 0; S.shiver = 0;
  } else {
    S.jump += (0 - S.jump) * Math.min(1, dt * 8);
    S.shiver += (0 - S.shiver) * Math.min(1, dt * 8);
    S.mouthOpen += (0 - S.mouthOpen) * Math.min(1, dt * 8);
  }

  // 기분 표정(동작 없을 때)
  if (!S.action) {
    if (S.hunger < 18 || S.happy < 18) S.expr = 'sad';
    else if (S.expr !== 'love') S.expr = 'normal';
  }
}

/* ------------------------------------------------------------------ */
/* 4. 그리기                                                            */
/* ------------------------------------------------------------------ */
function draw() {
  ctx.clearRect(0, 0, cssW, cssH);
  const cx = cssW / 2;
  const cy = cssH * 0.54;
  const tr = TRAIT[S.petType];

  const bob = S.action === 'sleep'
    ? Math.sin(t * 1.1) * 4
    : Math.sin(t * tr.bobSpd) * tr.bob;
  const floatY = bob - S.jump;

  // 땅 그림자(회전 X)
  const sh = 1 - Math.min(0.5, S.jump / 120);
  ctx.save();
  ctx.fillStyle = 'rgba(60,60,90,0.16)';
  ctx.beginPath();
  ctx.ellipse(cx, cy + 92, 64 * sh, 15 * sh, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // 캐릭터(회전 O)
  ctx.save();
  ctx.translate(cx + S.shiver, cy + floatY);
  ctx.rotate(S.rot);
  const breathe = 1 + Math.sin(t * tr.bobSpd) * 0.03;
  ctx.scale(1, S.action === 'sleep' ? 0.96 : breathe);

  drawAnimal(S.petType, t);
  ctx.restore();
}

/* ---- 공통 도형 헬퍼 ---- */
function blob(x, y, rx, ry, fill, line, lw) {
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (line) { ctx.strokeStyle = line; ctx.lineWidth = lw || 5; ctx.stroke(); }
}

/* ---- 동물 본체 ---- */
function drawAnimal(type, time) {
  const p = PAL[type];
  const tr = TRAIT[type];
  const tail = Math.sin(time * tr.tailSpd) * tr.tailAmp;
  const earW = Math.sin(time * 3) * tr.earWig;

  // --- 꼬리(몸 뒤) ---
  drawTail(type, p, tail);

  // --- 발 ---
  ctx.fillStyle = p.belly; ctx.strokeStyle = p.line; ctx.lineWidth = 4;
  blob(-26, 74, 18, 13, p.belly, p.line, 4);
  blob(26, 74, 18, 13, p.belly, p.line, 4);

  // --- 귀(곰/토끼는 몸 뒤쪽이 자연스러움) ---
  if (type === 'bunny' || type === 'bear') drawEars(type, p, earW);

  // --- 몸통 ---
  ctx.lineWidth = 5;
  blob(0, 8, 72, 80, p.body, p.line, 5);
  // 배 무늬
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(0, 26, 40, 50, 0, 0, Math.PI * 2);
  ctx.fillStyle = p.belly; ctx.globalAlpha = 0.9; ctx.fill();
  ctx.restore();

  // --- 앞다리/팔 ---
  drawArms(type, p, time);

  // --- 귀(고양이/강아지는 머리 위) ---
  if (type === 'cat' || type === 'dog') drawEars(type, p, earW);

  // --- 곰/강아지 주둥이 ---
  if (type === 'bear') blob(0, 6, 34, 26, p.belly, null, 0);

  // --- 볼터치 ---
  ctx.save(); ctx.globalAlpha = 0.55; ctx.fillStyle = p.cheek;
  blob(-40, 4, 13, 9, p.cheek, null, 0);
  blob(40, 4, 13, 9, p.cheek, null, 0);
  ctx.restore();

  // --- 얼굴 ---
  drawFace(type, p);
}

/* ---- 귀 ---- */
function drawEars(type, p, wig) {
  ctx.lineWidth = 4; ctx.strokeStyle = p.line;
  if (type === 'cat') {
    triEar(-40, -54, -16, -98, -58, -86, p, wig);
    triEar(40, -54, 16, -98, 58, -86, p, -wig);
  } else if (type === 'dog') {
    // 늘어진 귀
    earFlop(-58, -34, p, -0.5 + wig);
    earFlop(58, -34, p, 0.5 - wig);
  } else if (type === 'bunny') {
    longEar(-24, -64, p, -0.06 + wig);
    longEar(24, -64, p, 0.06 - wig);
  } else { // bear
    blob(-44, -54, 22, 22, p.body, p.line, 4);
    blob(44, -54, 22, 22, p.body, p.line, 4);
    blob(-44, -52, 11, 11, p.ear, null, 0);
    blob(44, -52, 11, 11, p.ear, null, 0);
  }
}
function triEar(ax, ay, bx, by, cx2, cy2, p, wig) {
  ctx.save(); ctx.translate(ax, ay); ctx.rotate(wig); ctx.translate(-ax, -ay);
  ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.lineTo(cx2, cy2); ctx.closePath();
  ctx.fillStyle = p.body; ctx.fill(); ctx.stroke();
  // 안쪽
  ctx.beginPath();
  ctx.moveTo((ax + bx) / 2, (ay + by) / 2 + 6);
  ctx.lineTo(bx, by + 8);
  ctx.lineTo((cx2 + bx) / 2, (cy2 + by) / 2 + 4);
  ctx.closePath(); ctx.fillStyle = p.ear; ctx.fill();
  ctx.restore();
}
function earFlop(x, y, p, rot) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot);
  blob(0, 22, 20, 36, p.ear, p.line, 4);
  ctx.restore();
}
function longEar(x, y, p, rot) {
  ctx.save(); ctx.translate(x, y - 6); ctx.rotate(rot);
  blob(0, -22, 16, 44, p.body, p.line, 4);
  blob(0, -22, 8, 32, p.ear, null, 0);
  ctx.restore();
}

/* ---- 꼬리 ---- */
function drawTail(type, p, wag) {
  ctx.save();
  if (type === 'cat') {
    ctx.translate(58, 40); ctx.rotate(-0.4 + wag);
    ctx.strokeStyle = p.line; ctx.lineWidth = 16; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(46, -10, 40, -56); ctx.stroke();
    ctx.strokeStyle = p.body; ctx.lineWidth = 9;
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(46, -10, 40, -56); ctx.stroke();
  } else if (type === 'dog') {
    ctx.translate(60, 30); ctx.rotate(-0.7 + wag);
    ctx.strokeStyle = p.line; ctx.lineWidth = 16; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(34, -24, 30, -54); ctx.stroke();
    ctx.strokeStyle = p.body; ctx.lineWidth = 9;
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(34, -24, 30, -54); ctx.stroke();
  } else if (type === 'bunny') {
    blob(54, 52, 18, 18, '#ffffff', p.line, 4);
  } else { // bear
    blob(60, 46, 13, 13, p.body, p.line, 4);
  }
  ctx.restore();
}

/* ---- 팔 ---- */
function drawArms(type, p, time) {
  let la = 0.2, ra = -0.2;
  if (S.action === 'play')  { const s = Math.sin(time * 7); la = -0.9 - s * 0.4; ra = 0.9 + s * 0.4; }
  if (S.action === 'wash')  { const s = Math.sin(time * 16); la = -0.5 + s * 0.4; ra = 0.5 - s * 0.4; }
  if (S.action === 'sleep') { la = 0.5; ra = -0.5; }
  ctx.save(); ctx.translate(-58, 24); ctx.rotate(la); blob(0, 12, 13, 22, p.body, p.line, 4); ctx.restore();
  ctx.save(); ctx.translate(58, 24); ctx.rotate(ra); blob(0, 12, 13, 22, p.body, p.line, 4); ctx.restore();
}

/* ---- 얼굴(눈/코/입) ---- */
function drawFace(type, p) {
  const ex = 26, ey = -14;
  const expr = S.expr;
  const sleeping = (S.action === 'sleep' || expr === 'sleep');
  const happy = (S.action === 'play' || expr === 'happy');
  const washing = (S.action === 'wash' || expr === 'wash');
  const love = (expr === 'love');
  const sad = (expr === 'sad');

  // 눈
  if (love) {
    drawHeartEye(-ex, ey, p); drawHeartEye(ex, ey, p);
  } else if (sleeping || washing) {
    sleepyEye(-ex, ey, p); sleepyEye(ex, ey, p);
  } else if (happy) {
    happyEye(-ex, ey, p); happyEye(ex, ey, p);
  } else {
    const open = 1 - S.blink;
    roundEye(-ex, ey, p, open, sad); roundEye(ex, ey, p, open, sad);
  }

  // 코
  drawNose(type, p);

  // 입
  drawMouth(type, p, { sleeping, happy, washing, love, sad });

  // 수염(고양이/토끼)
  if (type === 'cat' || type === 'bunny') drawWhiskers(p);
}

function roundEye(x, y, p, open, sad) {
  ctx.save();
  ctx.fillStyle = p.dark;
  const h = Math.max(2, 13 * open);
  ctx.beginPath(); ctx.ellipse(x, y, 9, h, 0, 0, Math.PI * 2); ctx.fill();
  if (open > 0.5) { // 반짝
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(x + 3, y - 4, 3.2, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(x - 3, y + 3, 1.6, 0, Math.PI * 2); ctx.fill();
  }
  if (sad) { // 처진 눈썹
    ctx.strokeStyle = p.dark; ctx.lineWidth = 2.5; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(x - 9, y - 16); ctx.lineTo(x + 7, y - 11); ctx.stroke();
  }
  ctx.restore();
}
function happyEye(x, y, p) {
  ctx.strokeStyle = p.dark; ctx.lineWidth = 4; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.arc(x, y + 4, 9, Math.PI * 1.15, Math.PI * 1.85); ctx.stroke();
}
function sleepyEye(x, y, p) {
  ctx.strokeStyle = p.dark; ctx.lineWidth = 4; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.arc(x, y - 2, 9, Math.PI * 0.15, Math.PI * 0.85); ctx.stroke();
}
function drawHeartEye(x, y, p) {
  ctx.save(); ctx.translate(x, y); ctx.fillStyle = '#ff5a8a';
  ctx.beginPath();
  ctx.moveTo(0, 4);
  ctx.bezierCurveTo(-9, -6, -10, 6, 0, 11);
  ctx.bezierCurveTo(10, 6, 9, -6, 0, 4);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,.7)';
  ctx.beginPath(); ctx.arc(-3, 1, 2, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

function drawNose(type, p) {
  ctx.fillStyle = p.nose;
  if (type === 'cat' || type === 'bunny') {
    ctx.beginPath(); ctx.moveTo(-5, 2); ctx.lineTo(5, 2); ctx.lineTo(0, 8); ctx.closePath(); ctx.fill();
  } else {
    ctx.beginPath(); ctx.ellipse(0, 3, 8, 6, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.35)';
    ctx.beginPath(); ctx.arc(-2, 1, 2, 0, Math.PI * 2); ctx.fill();
  }
}

function drawMouth(type, p, st) {
  ctx.strokeStyle = p.dark; ctx.lineWidth = 3; ctx.lineCap = 'round';
  const open = S.mouthOpen;

  if (st.happy || (open > 0.2 && S.action === 'feed')) {
    // 벌린 입(웃음/냠냠)
    const w = 14, h = 6 + open * 16;
    ctx.fillStyle = '#a23';
    ctx.beginPath(); ctx.ellipse(0, 18, w, h, 0, 0, Math.PI * 2); ctx.fill();
    // 혀
    ctx.fillStyle = '#ff7ea0';
    ctx.beginPath(); ctx.ellipse(0, 18 + h * 0.4, w * 0.7, h * 0.5, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = p.dark; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.ellipse(0, 18, w, h, 0, 0, Math.PI * 2); ctx.stroke();
  } else if (st.sleeping) {
    // 새근새근 작은 입
    ctx.beginPath(); ctx.arc(0, 16, 5, 0.1 * Math.PI, 0.9 * Math.PI); ctx.stroke();
  } else if (st.sad) {
    ctx.beginPath(); ctx.arc(0, 24, 8, 1.15 * Math.PI, 1.85 * Math.PI); ctx.stroke();
  } else {
    // 기본 :3 스마일
    ctx.beginPath();
    ctx.moveTo(-9, 14); ctx.quadraticCurveTo(-4, 21, 0, 15);
    ctx.quadraticCurveTo(4, 21, 9, 14); ctx.stroke();
  }
  // 토끼 앞니
  if (type === 'bunny' && !st.happy && !st.sleeping) {
    ctx.fillStyle = '#fff'; ctx.strokeStyle = p.line; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.rect(-5, 15, 4.5, 7); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.rect(0.5, 15, 4.5, 7); ctx.fill(); ctx.stroke();
  }
}

function drawWhiskers(p) {
  ctx.strokeStyle = p.line; ctx.lineWidth = 2; ctx.globalAlpha = 0.7; ctx.lineCap = 'round';
  for (const s of [-1, 1]) {
    ctx.beginPath(); ctx.moveTo(s * 16, 2);  ctx.lineTo(s * 50, -4); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(s * 16, 6);  ctx.lineTo(s * 52, 6);  ctx.stroke();
    ctx.beginPath(); ctx.moveTo(s * 16, 10); ctx.lineTo(s * 50, 16); ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

/* ------------------------------------------------------------------ */
/* 5. 포인터(마우스+터치) : 회전 / 탭                                   */
/* ------------------------------------------------------------------ */
function bindPointer() {
  canvas.style.touchAction = 'none';
  canvas.addEventListener('pointerdown', e => {
    isDrag = true; dragMoved = 0; dragLastX = e.clientX; dragStartT = t;
    S.spinVel = 0;
    canvas.setPointerCapture(e.pointerId);
    resumeAudio();
  });
  canvas.addEventListener('pointermove', e => {
    if (!isDrag) return;
    const dx = e.clientX - dragLastX;
    dragLastX = e.clientX;
    dragMoved += Math.abs(dx);
    S.rot += dx * 0.012;
    S.spinVel = dx * 0.6 / 0.016 * 0.012; // 마지막 속도(라디안/초) 근사
  });
  const up = e => {
    if (!isDrag) return;
    isDrag = false;
    if (dragMoved < 8 && (t - dragStartT) < 0.4) petTap(); // 탭 = 쓰다듬기
  };
  canvas.addEventListener('pointerup', up);
  canvas.addEventListener('pointercancel', up);
}

function petTap() {
  S.expr = 'love';
  S.happy = clamp(S.happy + 4);
  burst(['💕', '💖', '✨'], 8);
  sfx('giggle');
  setBubble(pick(['헤헤 좋아~ 💕', '간지러워! ✨', '더 쓰다듬어줘~', '사랑해 🥰']));
  setTimeout(() => { if (!S.action) S.expr = 'normal'; }, 1600);
}

/* ------------------------------------------------------------------ */
/* 6. 동작 (밥/놀기/재우기/씻기)                                        */
/* ------------------------------------------------------------------ */
const ACT = {
  feed:  { dur: 2.8, expr: 'eat',   bubble: '냠냠 맛있다! 🍖', notif: '냠냠 맛있어! 🍖', hp: 4,  hunger: 22, happy: 6,  sfx: 'munch' },
  play:  { dur: 3.6, expr: 'happy', bubble: '꺄르륵 신난다! ⚽', notif: '와아 재밌다! ⚽', hp: 0,  hunger: -6, happy: 24, sfx: 'boing' },
  sleep: { dur: 4.5, expr: 'sleep', bubble: '쿨쿨... 잘 자 💤',   notif: '쿨쿨... 푹 자요 💤', hp: 28, hunger: -4, happy: 6,  sfx: 'snore' },
  wash:  { dur: 3.6, expr: 'wash',  bubble: '뽀득뽀득 개운해! 🛁', notif: '깨끗해졌어요! 🛁', hp: 14, hunger: 0,  happy: 10, sfx: 'water' },
};

function doAction(act) {
  resumeAudio();
  const a = ACT[act];
  if (!a) return;
  S.action = act; S.expr = a.expr; S.actionUntil = t + a.dur;

  S.hp = clamp(S.hp + a.hp);
  S.hunger = clamp(S.hunger + a.hunger);
  S.happy = clamp(S.happy + a.happy);
  updateBars();
  gainExp(8);

  setBubble(a.bubble);
  showNotif(a.notif);
  sfx(a.sfx);
  clearOverlay();
  if (act === 'feed') startFeed();
  if (act === 'play') startPlay();
  if (act === 'sleep') startSleep();
  if (act === 'wash') startWash();
}

function endAction() {
  S.action = null;
  S.expr = 'normal';
  clearOverlay();
  stopLoops();
}

/* ------------------------------------------------------------------ */
/* 7. 오버레이 효과 (공/샤워/밥그릇/Zzz)                                */
/* ------------------------------------------------------------------ */
let loopTimers = [];
function clearOverlay() {
  const il = document.getElementById('il'); if (il) il.innerHTML = '';
}
function stopLoops() { loopTimers.forEach(clearInterval); loopTimers = []; }

function ilEl(cls, html, x, y) {
  const il = document.getElementById('il');
  const d = document.createElement('div');
  d.className = cls; d.innerHTML = html;
  d.style.left = x + 'px'; d.style.top = y + 'px';
  il.appendChild(d);
  return d;
}
function center() { return { x: cssW / 2, y: cssH * 0.54 }; }

/* 밥주기: 밥그릇 등장 + 음식 파티클 */
function startFeed() {
  const c = center();
  ilEl('interact-obj food-bowl', '🍚', c.x - 22, c.y + 70);
  let n = 0;
  const id = setInterval(() => {
    if (n++ > 5) return clearInterval(id);
    burst(['🍖', '🥕', '✨'], 1, c.x, c.y + 30);
  }, 450);
  loopTimers.push(id);
}

/* 놀기: 통통 튀는 공 + 별 */
function startPlay() {
  const c = center();
  const wrap = ilEl('interact-obj', '<span class="ball-bounce">⚽</span>', c.x + 70, c.y - 6);
  ilEl('ball-shadow', '', c.x + 78, c.y + 78);
  let n = 0;
  const id = setInterval(() => {
    if (n++ > 7) return clearInterval(id);
    burst(['⭐', '✨', '🎉'], 1, c.x + (Math.random() * 80 - 40), c.y - 30);
  }, 380);
  loopTimers.push(id);
}

/* 재우기: 천천히 떠오르는 Zzz */
function startSleep() {
  const c = center();
  let n = 0;
  const id = setInterval(() => {
    if (n++ > 6) return clearInterval(id);
    const z = ilEl('zzz-float', pick(['Z', 'z', '💤']), c.x + 36 + Math.random() * 12, c.y - 56);
    z.style.fontSize = (1.2 + Math.random() * 0.8) + 'rem';
    setTimeout(() => z.remove(), 2200);
  }, 520);
  loopTimers.push(id);
}

/* 씻기기: 샤워기 + 물방울 + 비누거품 */
function startWash() {
  const c = center();
  ilEl('shower-head', '🚿', c.x - 70, c.y - 130);
  const id = setInterval(() => {
    const dropX = c.x - 40 + Math.random() * 80;
    const d = ilEl('water-drop', '💧', dropX, c.y - 96);
    d.style.animationDuration = (0.5 + Math.random() * 0.3) + 's';
    setTimeout(() => d.remove(), 900);
    if (Math.random() < 0.6) {
      const b = ilEl('soap-bubble', '', c.x - 50 + Math.random() * 100, c.y + 40);
      const sz = 8 + Math.random() * 16;
      b.style.width = sz + 'px'; b.style.height = sz + 'px';
      setTimeout(() => b.remove(), 1800);
    }
  }, 140);
  loopTimers.push(id);
  setTimeout(() => burst(['✨', '🫧', '💖'], 6, c.x, c.y), 200);
}

/* 파티클 버스트(하트/별 등) */
function burst(emojis, count, x, y) {
  const fp = document.getElementById('fp');
  const c = center();
  x = x ?? c.x; y = y ?? c.y - 20;
  for (let i = 0; i < count; i++) {
    const e = document.createElement('div');
    e.className = 'particle';
    e.textContent = pick(emojis);
    e.style.left = (x + (Math.random() * 70 - 35)) + 'px';
    e.style.top = (y + (Math.random() * 30 - 15)) + 'px';
    e.style.fontSize = (1.1 + Math.random() * 1.0) + 'rem';
    fp.appendChild(e);
    setTimeout(() => e.remove(), 1300);
  }
}

/* ------------------------------------------------------------------ */
/* 8. Web Audio 효과음 (합성)                                           */
/* ------------------------------------------------------------------ */
let AC = null;
function resumeAudio() {
  if (!S.soundOn) return;
  try {
    if (!AC) AC = new (window.AudioContext || window.webkitAudioContext)();
    if (AC.state === 'suspended') AC.resume();
  } catch (e) { AC = null; }
}
function tone(freq, dur, type, vol, when, glideTo) {
  if (!AC || !S.soundOn) return;
  const o = AC.createOscillator(), g = AC.createGain();
  const tt = AC.currentTime + (when || 0);
  o.type = type || 'sine';
  o.frequency.setValueAtTime(freq, tt);
  if (glideTo) o.frequency.exponentialRampToValueAtTime(glideTo, tt + dur);
  g.gain.setValueAtTime(0.0001, tt);
  g.gain.exponentialRampToValueAtTime(vol || 0.18, tt + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, tt + dur);
  o.connect(g).connect(AC.destination);
  o.start(tt); o.stop(tt + dur + 0.02);
}
function noise(dur, vol, when) {
  if (!AC || !S.soundOn) return;
  const n = Math.floor(AC.sampleRate * dur);
  const buf = AC.createBuffer(1, n, AC.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
  const src = AC.createBufferSource(); src.buffer = buf;
  const bp = AC.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1600; bp.Q.value = 0.8;
  const g = AC.createGain(); g.gain.value = vol || 0.12;
  const tt = AC.currentTime + (when || 0);
  src.connect(bp).connect(g).connect(AC.destination);
  src.start(tt); src.stop(tt + dur);
}
function sfx(kind) {
  if (!S.soundOn) return;
  resumeAudio(); if (!AC) return;
  switch (kind) {
    case 'munch':  tone(180, .09, 'square', .14, 0); tone(150, .09, 'square', .14, .12); tone(190, .09, 'square', .12, .26); break;
    case 'boing':  tone(300, .28, 'sine', .2, 0, 720); tone(720, .18, 'sine', .12, .18, 360); break;
    case 'snore':  tone(220, .5, 'sine', .12, 0, 130); break;
    case 'water':  noise(.5, .1, 0); for (let i = 0; i < 4; i++) tone(900 + i * 120, .12, 'sine', .05, i * .12, 1400); break;
    case 'giggle': [660, 880, 990, 1175].forEach((f, i) => tone(f, .1, 'sine', .12, i * .08)); break;
    case 'coin':   tone(988, .08, 'square', .16, 0); tone(1319, .14, 'square', .16, .08); break;
    case 'level':  [523, 659, 784, 1047].forEach((f, i) => tone(f, .16, 'triangle', .16, i * .1)); break;
    case 'pop':    tone(520, .12, 'sine', .16, 0, 880); break;
    case 'nope':   tone(200, .18, 'sawtooth', .12, 0, 120); break;
  }
}

/* ------------------------------------------------------------------ */
/* 9. 상점 / 코인 / 레벨                                                */
/* ------------------------------------------------------------------ */
function buyItem(id, emoji, cost, hunger, happy, hp) {
  resumeAudio();
  if (S.coins < cost) {
    showNotif('코인이 부족해요 🪙');
    sfx('nope');
    return;
  }
  S.coins -= cost;
  S.hunger = clamp(S.hunger + (hunger || 0));
  S.happy = clamp(S.happy + (happy || 0));
  S.hp = clamp(S.hp + (hp || 0));
  updateBars();
  burst([emoji, '✨', '💕'], 6);
  showNotif(emoji + ' 냠냠!');
  sfx('coin');
  gainExp(5);
}

function gainExp(n) {
  S.exp += n;
  while (S.exp >= S.expMax) {
    S.exp -= S.expMax;
    S.level++;
    S.expMax = Math.round(S.expMax * 1.25);
    S.coins += 30;
    showNotif('🎉 레벨 ' + S.level + ' 달성! +30🪙');
    sfx('level');
    burst(['🎉', '⭐', '🎊', '✨'], 12);
  }
  updateHeader();
}

/* ------------------------------------------------------------------ */
/* 10. UI 갱신                                                          */
/* ------------------------------------------------------------------ */
function clamp(v) { return Math.max(0, Math.min(100, v)); }
function pick(a) { return a[Math.floor(Math.random() * a.length)]; }

function updateBars() {
  setBar('bhp', 'vhp', S.hp);
  setBar('bhu', 'vhu', S.hunger);
  setBar('bhh', 'vhh', S.happy);
  const c = document.getElementById('coins'); if (c) c.textContent = S.coins;
}
function setBar(barId, valId, v) {
  const bar = document.getElementById(barId);
  const val = document.getElementById(valId);
  if (bar) bar.style.width = v + '%';
  if (val) val.textContent = Math.floor(v);
}
function updateHeader() {
  document.getElementById('coins').textContent = S.coins;
  const lvb = document.getElementById('lvb'); if (lvb) lvb.textContent = 'Lv.' + S.level;
  const efb = document.getElementById('efb'); if (efb) efb.style.width = Math.round(S.exp / S.expMax * 100) + '%';
  const ell = document.getElementById('ell'); if (ell) ell.textContent = 'EXP ' + Math.floor(S.exp) + ' / ' + S.expMax;
}

function setBubble(text) {
  const b = document.getElementById('mbd');
  if (!b) return;
  b.textContent = text;
  b.style.animation = 'none'; void b.offsetWidth;
  b.style.animation = 'bubblePop .4s ease';
  positionBubble();
}
function positionBubble() {
  const b = document.getElementById('mbd');
  if (!b || !cssW) return;
  b.style.left = (cssW / 2) + 'px';
  b.style.top = (cssH * 0.54 - 150) + 'px';
  b.style.transform = 'translate(-50%,-100%)';
}

function showNotif(msg) {
  const layer = document.getElementById('notifLayer');
  if (!layer) return;
  const div = document.createElement('div');
  div.className = 'notif-popup';
  div.textContent = msg;
  layer.appendChild(div);
  setTimeout(() => div.remove(), 1900);
}

/* ------------------------------------------------------------------ */
/* 11. 동물 선택 / 이름 / 사운드 토글                                   */
/* ------------------------------------------------------------------ */
function chPet(type, btn) {
  resumeAudio();
  S.petType = type;
  document.querySelectorAll('.pet-btn').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  S.expr = 'love';
  burst(['✨', '💫', '🌟'], 8);
  sfx('pop');
  setBubble(PET_KR[type] + ' 친구로 변신! ✨');
  showNotif(PET_KR[type] + '(으)로 변신!');
  setTimeout(() => { if (!S.action) S.expr = 'normal'; }, 1200);
}

function renamePet() {
  const n = prompt('친구 이름을 지어주세요! 🌸', S.petName);
  if (n && n.trim()) {
    S.petName = n.trim();
    document.getElementById('petNameDisplay').textContent = S.petName;
    setBubble('내 이름은 ' + S.petName + '! 🎀');
    sfx('pop');
  }
}

function toggleSound(btn) {
  S.soundOn = !S.soundOn;
  if (S.soundOn) { resumeAudio(); sfx('pop'); }
  if (btn) btn.textContent = S.soundOn ? '🔊' : '🔇';
}

/* ------------------------------------------------------------------ */
/* 12. 대화                                                             */
/* ------------------------------------------------------------------ */
const REPLIES = {
  '배고파?': ['응! 배고파~ 밥 줘! 🍖', '꼬르륵... 간식 먹고 싶어!'],
  '놀자!':   ['좋아 좋아! 공 던져줘~ ⚽', '꺄르륵 신난다! 🎉'],
  '졸려?':   ['하암~ 조금 졸려 💤', '같이 낮잠 잘까? 😴'],
  '사랑해':  ['나도 사랑해! 💕', '헤헤 부끄러워~ 🥰'],
  '_def':    ['그래? 신난다! 🐾', '우와 정말? 😺', '히히 좋아~ 💕', '같이 놀자! ✨'],
};
function petReply(userMsg) {
  const list = REPLIES[userMsg] || REPLIES['_def'];
  return pick(list);
}

function sendChat() {
  const inp = document.getElementById('ci');
  const msg = inp.value.trim();
  if (!msg) return;
  addMsg(msg, 'user');
  inp.value = '';
  showTyping(true);
  setTimeout(() => {
    showTyping(false);
    const reply = petReply(msg);
    addMsg(reply, 'pet');
    setBubble(reply);
    S.expr = 'love'; sfx('giggle');
    setTimeout(() => { if (!S.action) S.expr = 'normal'; }, 1400);
  }, 900);
}
function addMsg(text, who) {
  const cm = document.getElementById('cm');
  const d = document.createElement('div');
  d.className = 'msg ' + who;
  d.textContent = text;
  cm.appendChild(d);
  cm.scrollTop = cm.scrollHeight;
}
function showTyping(on) {
  const ti = document.getElementById('ti');
  if (ti) ti.classList.toggle('show', on);
}
function renderChatChoices() {
  const grid = document.getElementById('choicesGrid');
  if (!grid) return;
  const list = ['배고파?', '놀자!', '졸려?', '사랑해'];
  grid.innerHTML = '';
  list.forEach(txt => {
    const b = document.createElement('button');
    b.className = 'choice-btn';   // CSS와 일치
    b.textContent = txt;
    b.onclick = () => { document.getElementById('ci').value = txt; sendChat(); };
    grid.appendChild(b);
  });
}

/* ------------------------------------------------------------------ */
/* 13. 시간 경과(스탯 감소)                                             */
/* ------------------------------------------------------------------ */
setInterval(() => {
  if (S.action === 'sleep') return; // 잘 때는 안 줄어듦
  S.hunger = clamp(S.hunger - 2);
  S.happy  = clamp(S.happy - 1);
  if (S.hunger <= 0) S.hp = clamp(S.hp - 1);
  updateBars();
}, 6000);

/* 코인 자동 적립(살아있는 느낌) */
setInterval(() => { S.coins += 2; updateHeader(); }, 15000);

/* ------------------------------------------------------------------ */
window.addEventListener('load', initCanvas);
