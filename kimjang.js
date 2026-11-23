/* =========================================================
   맛있는 김장 체험
   ① 재료 고르기 (6가지, 사진 카드)
   ② 양념 만들기 : 고춧가루 2번 · 멸치액젓 1번 · 새우젓 1번 넣고,
      숟가락을 그릇 안에서 끌며 여섯 바퀴 저어요 (숟가락은 손을 따라가고, 양념이 같이 끌려 돌아요)
   ③ 배추에 바르기 : 배춧잎 한 장씩 양념을 묻혀 칠해요 (2장)
   ④ 장독대에 담기 : 김치를 장독에 넣고, 뚜껑을 따로 집어 덮어요
   - 실패 화면은 없습니다. 틀리면 다정하게 힌트를 줍니다.
   ========================================================= */
(function () {
"use strict";

const $ = id => document.getElementById(id);
const K = 'kim/';
const cfg = PK.load('kimjang', { sound: true, voice: true, rate: 0.85, bgm: 1 });

/* ---------- 가을 음악 (아주 작게) ---------- */
const SCALE = [392, 440, 523, 587, 659, 784];
const TUNE = [0, 2, 4, 2, 1, 3, 5, 3, 2, 0, 4, 2];
let musicTimer = null, musicI = 0;
function musicStart() {
  if (musicTimer || !cfg.bgm) return;
  musicTimer = setInterval(() => {
    if (!cfg.bgm) return;
    PK.note(SCALE[TUNE[musicI % TUNE.length]] / 2, 1.4, 'sine', .03);
    if (musicI % 3 === 0) PK.note(SCALE[(musicI + 2) % SCALE.length] / 4, 2.2, 'sine', .025);
    musicI++;
  }, 760);
}
function musicStop() { clearInterval(musicTimer); musicTimer = null; }

/* ---------- 떨어지는 가을 잎 ---------- */
(function leaves() {
  const box = $('leaves');
  const cols = ['#e96f3a', '#f2a14b', '#d94a2b', '#f6c35a'];
  for (let i = 0; i < 14; i++) {
    const l = document.createElement('div');
    l.className = 'leaf';
    l.style.left = (Math.random() * 100) + '%';
    l.style.background = cols[i % cols.length];
    l.style.animationDuration = (9 + Math.random() * 8) + 's';
    l.style.animationDelay = (-Math.random() * 14) + 's';
    box.appendChild(l);
  }
})();

/* ---------- 상태 ---------- */
const S = {
  stage: 'intro', need: [], picked: 0,
  poured: { chili: 0, fish: 0, shr: 0 }, pours: 0, sel: null,
  stir: 0, stirAng: null, stirAcc: 0, stirring: false, stirLast: null,
  load: 0, painting: false, lastX: 0, lastY: 0, leaf: -1,
  busy: false, lidSel: false, kimSel: false, finalSrc: ''
};
const POUR_NEED = { chili: 2, fish: 1, shr: 1 };
const POUR_TOTAL = 4;
const STIR_NEED = 6;
const DIP_LOAD = 10;           /* 양념을 한 번 묻히면 이만큼 칠할 수 있어요 */
const LEAF_DONE = .7;          /* 잎 한 장이 이 정도 빨갛게 되면 완성 */

const PICK_ORDER = [
  { id: 'rad',   name: '무',       src: K + 'photo/radish.jpg',    photo: true,  x: 20, y: 22 },
  { id: 'shr',   name: '새우젓',   src: K + 'saltedshrimp.svg',    photo: false, x: 50, y: 20 },
  { id: 'onion', name: '파',       src: K + 'photo/onion.jpg',     photo: true,  x: 80, y: 22 },
  { id: 'cab',   name: '배추',     src: K + 'photo/cabbage.jpg',   photo: true,  x: 50, y: 46 },
  { id: 'chili', name: '고춧가루', src: K + 'powder.svg',          photo: false, x: 26, y: 70 },
  { id: 'fish',  name: '멸치액젓', src: K + 'fishsauce.svg',       photo: false, x: 64, y: 70 }
];
const DISTRACT = [
  { id: 'apple',  name: '사과',   src: K + 'apple.svg',  photo: false, x: 18, y: 46 },
  { id: 'banana', name: '바나나', src: K + 'banana.svg', photo: false, x: 82, y: 46 },
  { id: 'milk',   name: '우유',   src: K + 'milk.svg',   photo: false, x: 86, y: 88 }
];
const PRAISE = ['잘했어요!', '참 잘했어요!', '멋져요!', '대단해요!', '최고예요!'];
const praise = () => PRAISE[Math.floor(Math.random() * PRAISE.length)];
const tell = t => PK.tell(t);
const say = t => PK.say(t);

/* ---------- 작은 효과 ---------- */
function stageRect() { return $('stage').getBoundingClientRect(); }
function puffAt(x, y, size) {
  const st = $('stage'), r = stageRect();
  const p = document.createElement('div');
  p.className = 'puff';
  p.style.width = p.style.height = (size || 90) + 'px';
  p.style.left = (x - r.left) + 'px'; p.style.top = (y - r.top) + 'px';
  st.appendChild(p);
  setTimeout(() => p.remove(), 700);
}
function bubbles(n, base) {
  for (let i = 0; i < n; i++)
    setTimeout(() => PK.note((base || 340) + Math.random() * 180, .1, 'sine', .05), i * 90);
}
function swish(n) {
  for (let i = 0; i < n; i++)
    setTimeout(() => PK.note(260 + i * 60 + Math.random() * 40, .12, 'triangle', .06), i * 110);
}

/* ---------- 단계 전환 ---------- */
function show(id) {
  ['layer-pick', 'layer-mix', 'layer-paint', 'layer-store'].forEach(l => $(l).hidden = true);
  $('basket').hidden = true; $('basketMini').hidden = true;
  $('done').hidden = true;
  if (id === 'pick') { $('layer-pick').hidden = false; $('basket').hidden = false; $('basketMini').hidden = false; }
  if (id === 'mix') $('layer-mix').hidden = false;
  if (id === 'paint') $('layer-paint').hidden = false;
  if (id === 'store') $('layer-store').hidden = false;
  if (id === 'done') $('done').hidden = false;
  S.stage = id;
}

/* =========================================================
   드래그 도우미 (끌기 · 누르기 둘 다)
   ========================================================= */
function makeMovable(el, opts) {
  el.addEventListener('pointerdown', e => {
    if (el.classList.contains('gone')) return;
    e.preventDefault();
    const st = stageRect();
    const start = { x: e.clientX, y: e.clientY };
    const r0 = el.getBoundingClientRect();
    const ox = e.clientX - r0.left, oy = e.clientY - r0.top;
    const home = { left: el.style.left, top: el.style.top };
    let moved = false;
    try { el.setPointerCapture(e.pointerId); } catch (err) {}
    const move = ev => {
      if (!moved && Math.hypot(ev.clientX - start.x, ev.clientY - start.y) < 10) return;
      if (!moved) { moved = true; el.classList.add('dragging'); if (opts.onStart) opts.onStart(); }
      el.style.left = (ev.clientX - ox - st.left + r0.width / 2) + 'px';
      el.style.top = (ev.clientY - oy - st.top + r0.height / 2) + 'px';
      if (opts.onMove) opts.onMove(ev);
    };
    const up = ev => {
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerup', up);
      el.removeEventListener('pointercancel', up);
      el.classList.remove('dragging');
      if (!moved) { opts.onTap && opts.onTap(); return; }
      if (opts.onDrop && opts.onDrop(ev)) {
        if (!opts.returnHome) return;
      }
      el.classList.add('back');
      el.style.left = home.left; el.style.top = home.top;
      setTimeout(() => el.classList.remove('back'), 380);
    };
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
  });
}
function near(ev, el, extra) {
  const r = el.getBoundingClientRect();
  const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
  const reach = Math.max(r.width, r.height) * .5 + (extra || 70);
  return Math.hypot(ev.clientX - cx, ev.clientY - cy) < reach;
}

/* =========================================================
   ① 재료 고르기
   ========================================================= */
function buildPick() {
  const layer = $('layer-pick');
  layer.innerHTML = '';
  PICK_ORDER.concat(DISTRACT).forEach(it => {
    const d = document.createElement('div');
    d.className = 'item';
    d.dataset.id = it.id;
    d.style.left = (it.x + (Math.random() * 3 - 1.5)) + '%';
    d.style.top = (it.y + (Math.random() * 2 - 1)) + '%';
    d.innerHTML = '<div class="pc' + (it.photo ? '' : ' svg') + '"><img src="' + it.src + '" alt="' + it.name + '"></div>' +
                  '<span class="tag">' + it.name + '</span>';
    d.addEventListener('pointerdown', () => pickTap(it, d));
    layer.appendChild(d);
  });
  S.need = PICK_ORDER.map(p => p.id);
  S.picked = 0;
  $('basketMini').innerHTML = '';
  $('basketCount').textContent = '0 / ' + PICK_ORDER.length;
}
function nextNeed() { const id = S.need[0]; return PICK_ORDER.find(p => p.id === id); }
function markNeed() {
  document.querySelectorAll('#layer-pick .item').forEach(e => e.classList.remove('on'));
  const t = nextNeed();
  if (!t) return;
  const el = document.querySelector('#layer-pick .item[data-id="' + t.id + '"]');
  if (el && !el.classList.contains('gone')) el.classList.add('on');
}
function pickTap(it, el) {
  if (S.stage !== 'pick' || S.busy || el.classList.contains('gone')) return;
  const target = nextNeed();
  if (!target) return;
  if (it.id === target.id) {
    S.busy = true;
    S.need.shift(); S.picked++;
    PK.beep('good'); PK.buzz([30]);
    const b = $('basket').getBoundingClientRect();
    const c = el.getBoundingClientRect();
    const dx = (b.left + b.width / 2) - (c.left + c.width / 2), dy = (b.top + b.height / 2) - (c.top + c.height / 2);
    el.style.transition = 'transform .7s ease-in, opacity .7s';
    el.style.transform = 'translate(calc(-50% + ' + dx + 'px), calc(-50% + ' + dy + 'px)) scale(.25)';
    el.style.opacity = '0';
    el.style.pointerEvents = 'none';
    const m = document.createElement('img');
    m.src = it.src; m.alt = '';
    $('basketMini').appendChild(m);
    if ($('basketMini').children.length > 6) $('basketMini').firstElementChild.remove();
    $('basketCount').textContent = S.picked + ' / ' + PICK_ORDER.length;
    setTimeout(() => { S.busy = false; }, 350);
    if (S.picked === PICK_ORDER.length) {
      say(it.name + '! 재료를 다 담았어요');
      tell('재료를 다 담았어요! 이제 양념을 만들어요');
      setTimeout(() => { PK.cheer('🥬', '재료를 다 담았어요!', 1300); setTimeout(enterMix, 1500); }, 800);
    } else {
      say(it.name + '! ' + praise());
      tell(nextNeed().name + ' 를 찾아 눌러요');
      markNeed();
    }
  } else {
    el.classList.remove('pk-shake'); void el.offsetWidth; el.classList.add('pk-shake');
    PK.beep('hint');
    say('이건 ' + it.name + ' 이에요. ' + target.name + ' 를 찾아봐요');
    tell(target.name + ' 를 찾아 눌러요');
    markNeed();
  }
}
function enterPick() {
  buildPick();
  show('pick');
  say('먼저 재료를 골라 바구니에 담아요. ' + nextNeed().name + ' 를 찾아 눌러요');
  tell(nextNeed().name + ' 를 찾아 눌러요');
  markNeed();
}

/* =========================================================
   ② 양념 만들기
   - 숟가락으로 고춧가루 2번, 멸치액젓·새우젓 1번씩 넣어요
   - 숟가락을 손으로 잡고 그릇 안에서 저어요. 숟가락은 손을 따라 움직이고,
     양념은 숟가락이 지나간 쪽으로 같이 끌려 돌아요 (시계 바늘처럼 돌지 않아요)
   ========================================================= */
const SEASON = [
  { key: 'chili', el: 's-chili', cnt: 'c-chili', name: '고춧가루', grain: 'chili' },
  { key: 'fish',  el: 's-fish',  cnt: 'c-fish',  name: '멸치액젓', grain: 'fish' },
  { key: 'shr',   el: 's-shr',   cnt: 'c-shr',   name: '새우젓',   grain: 'shr' }
];
const GRAIN_COLOR = { chili: '#d6351f', fish: '#c27a2a', shr: '#f0a090' };

function enterMix() {
  show('mix');
  S.pours = 0; S.stir = 0; S.stirring = false; S.sel = null; S.stirAng = null;
  Object.keys(S.poured).forEach(k => S.poured[k] = 0);
  $('bowlIn').innerHTML = '';
  $('paste').style.opacity = '0';
  $('bowlWrap').classList.remove('stirring');
  $('stirMeter').hidden = true;
  $('stirFill').style.width = '0%'; $('stirNum').textContent = '0/' + STIR_NEED;
  SEASON.forEach(s => {
    const el = $(s.el);
    el.classList.remove('on', 'empty');
    el.style.left = el.dataset.x || el.style.left;
    el.style.top = el.dataset.y || el.style.top;
    $(s.cnt).textContent = '0';
  });
  updateMix();
  say('숟가락으로 고춧가루를 두 번, 멸치액젓과 새우젓을 한 번씩 넣어요');
  tell('재료를 누른 뒤 그릇을 눌러 넣어요');
}
function updateMix() {
  const n = S.pours;
  $('mixFill').style.width = (n / POUR_TOTAL * 100) + '%';
  $('mixNum').textContent = n + '/' + POUR_TOTAL;
  $('paste').style.opacity = String(Math.min(.35, n / POUR_TOTAL * .35));
  if (n >= POUR_TOTAL) setTimeout(startStir, 700);
}
function pourOne(s) {
  if (S.stage !== 'mix' || S.stirring) return false;
  if (S.poured[s.key] >= POUR_NEED[s.key]) {
    say(s.name + ' 는 충분해요. 다른 재료를 넣어요');
    tell(s.name + ' 는 이미 넣었어요');
    PK.beep('hint');
    return false;
  }
  S.poured[s.key]++; S.pours++;
  $(s.cnt).textContent = S.poured[s.key];
  if (S.poured[s.key] >= POUR_NEED[s.key]) $(s.el).classList.add('empty');
  const bi = $('bowlIn');
  for (let i = 0; i < 9; i++) {
    const g = document.createElement('div');
    g.className = 'pour';
    g.style.background = GRAIN_COLOR[s.grain];
    g.style.left = (30 + Math.random() * 40) + '%';
    g.style.top = (18 + Math.random() * 20) + '%';
    g.style.animationDelay = (i * 35) + 'ms';
    bi.appendChild(g);
    setTimeout(() => g.remove(), 1100);
  }
  PK.beep('pick'); PK.buzz([20]);
  bubbles(2, 300);
  say(s.name + ' 를 넣었어요');
  updateMix();
  tell(S.pours >= POUR_TOTAL ? '양념 재료를 다 넣었어요' : '조금 더 넣어요 · ' + S.pours + '/' + POUR_TOTAL);
  return true;
}

/* ---------- 저어 주기 ---------- */
function bowlGeom() {
  const bw = $('bowlWrap'), r = bw.getBoundingClientRect();
  return { r, cx: r.left + r.width / 2, cy: r.top + r.height * .5, w: r.width, h: r.height };
}
/* 손가락으로 저을 수 있는 영역 (넓게 잡아요). 숟가락은 항상 양념 타원 안에서만 움직여요 */
function stirArea() {
  const g = bowlGeom();
  return { cx: g.cx, cy: g.r.top + g.h * .264, rx: g.w * .42, ry: g.h * .2, px: g.w * .34, py: g.h * .075 };
}
function startStir() {
  if (S.stage !== 'mix') return;
  S.stirring = true;
  $('bowlWrap').classList.add('stirring');
  $('stirMeter').hidden = false;
  say('숟가락을 잡고 양념 안에서 천천히 저어요. 여섯 바퀴 빙글빙글');
  tell('양념 안에서 천천히 저어요');
}
/* 손가락 위치를 저을 영역 안의 비율로 바꿔서, 숟가락을 양념 타원 안에 그대로 옮겨요 */
function placeSpoon(ev) {
  const A = stirArea(), g = bowlGeom();
  let dx = ev.clientX - A.cx, dy = ev.clientY - A.cy;
  let nx = dx / A.rx, ny = dy / A.ry;
  const n = Math.hypot(nx, ny);
  const inside = n <= 1;
  if (!inside) { nx /= n; ny /= n; }            /* 영역 밖이면 가장자리에 붙여요 (세지 않아요) */
  const sx = A.cx + nx * A.px, sy = A.cy + ny * A.py;
  const sp = $('spoonHead');
  sp.style.left = (sx - g.r.left - 14) + 'px';
  sp.style.top = (sy - g.r.top - 130) + 'px';
  return { inside, nx, ny };
}
function stirDown(ev) {
  if (S.stage !== 'mix' || !S.stirring) return;
  const p = placeSpoon(ev);
  S.stirAng = p.inside ? Math.atan2(p.ny, p.nx) : null;
  S.stirAcc = 0;
  try { $('bowlWrap').setPointerCapture(ev.pointerId); } catch (err) {}
}
function stirMove(ev) {
  if (!S.stirring || S.stage !== 'mix') return;
  const p = placeSpoon(ev);
  if (!p.inside) { S.stirAng = null; return; }        /* 양념 밖 : 세지 않아요 */
  const a = Math.atan2(p.ny, p.nx);
  if (S.stirAng === null) { S.stirAng = a; return; }   /* 다시 들어온 순간 */
  let d = a - S.stirAng;
  if (d > Math.PI) d -= 2 * Math.PI;
  if (d < -Math.PI) d += 2 * Math.PI;
  S.stirAng = a;
  S.stirAcc += d;
  /* 숟가락은 움직이는 쪽으로 살짝 기울어요 */
  const lean = Math.max(-14, Math.min(14, d * 220));
  $('spoonHead').style.transform = 'rotate(' + lean.toFixed(1) + 'deg)';
  /* 양념은 숟가락이 민 쪽으로 같이 끌려 돌아요 */
  if (Math.abs(S.stirAcc) >= 2 * Math.PI * .85) {
    S.stirAcc = 0;
    S.stir++;
    PK.beep('tap'); PK.buzz([14]);
    swish(2);
    $('stirFill').style.width = (S.stir / STIR_NEED * 100) + '%';
    $('stirNum').textContent = S.stir + '/' + STIR_NEED;
    $('paste').style.opacity = String(.35 + .65 * (S.stir / STIR_NEED));
    say(S.stir === STIR_NEED - 1 ? '거의 다 됐어요' : '쓱싹쓱싹');
    tell('쓱싹쓱싹 · ' + S.stir + '/' + STIR_NEED + ' 바퀴');
    if (S.stir >= STIR_NEED) finishMix();
  }
}
function stirUp() { S.stirAng = null; }
function finishMix() {
  S.stirring = false; S.stirAng = null;
  $('bowlWrap').classList.remove('stirring');
  $('stirMeter').hidden = true;
  PK.beep('win');
  bubbles(3, 360);
  $('paste').style.opacity = '1';
  tell('빨간 양념장이 만들어졌어요!');
  say('양념장이 만들어졌어요');
  setTimeout(enterPaint, 2400);
}

function setupMix() {
  SEASON.forEach(s => {
    const el = $(s.el);
    el.dataset.x = el.style.left;
    el.dataset.y = el.style.top;
    makeMovable(el, {
      onTap() {
        if (S.stirring) return;
        document.querySelectorAll('.seasoning').forEach(e => e.classList.remove('on'));
        el.classList.add('on'); S.sel = s; PK.beep('tap');
        say(s.name + ' 를 골랐어요. 그릇을 눌러요');
        tell(s.name + ' 를 그릇에 넣어요');
      },
      onDrop(ev) {
        if (S.stirring) return false;
        if (near(ev, $('bowlWrap'), 90)) {
          const b = $('bowlWrap').getBoundingClientRect();
          puffAt(b.left + b.width / 2, b.top + b.height / 2, 120);
          pourOne(s);
          return true;
        }
        return false;
      },
      returnHome: true
    });
  });
  $('bowlWrap').addEventListener('pointerdown', e => {
    if (S.stage !== 'mix') return;
    if (S.stirring) { stirDown(e); return; }
    if (S.sel) {
      const s = S.sel; S.sel = null;
      document.querySelectorAll('.seasoning').forEach(x => x.classList.remove('on'));
      pourOne(s);
    } else {
      say('먼저 재료를 눌러요');
    }
  });
  $('bowlWrap').addEventListener('pointermove', stirMove);
  $('bowlWrap').addEventListener('pointerup', stirUp);
  $('bowlWrap').addEventListener('pointercancel', stirUp);
}

/* =========================================================
   ③ 배추에 양념 바르기 — 잎을 한 장씩 꺼내 칠해요
   - 배추 한 포기는 잎 12장으로 되어 있어요 (바깥잎 7 · 안쪽잎 4 · 속잎 1)
   - 바깥잎부터 한 장을 꺼내 펼쳐 놓고 양념을 묻혀 칠해요
   - 칠하기가 끝나면 잎을 더미에 내려놓고, 다음 잎을 꺼내요
   ========================================================= */
const BRUSH = 26;
const CELL = 14;
let cvBase = null, cvPaint = null, ctxBase = null, ctxPaint = null, pileCv = null, ctxPile = null;
let CW = 0, CH = 0, SPECS = [], queue = [], curLeaf = null, pileDone = [], doneN = 0;
/* 칠하는 잎 : 바깥쪽 잎 두 장만 직접 칠해요 (배추 그림은 잎 12장 그대로) */
const PAINT_IDX = [0, 4];
let cellsIn = null, painted = null, cellW = 0, cellH = 0, cellCount = 0, paintedCount = 0;

/* 잎 배치 : 가운데에서 바깥쪽으로 방사형 */
function leafSpecs(W, H) {
  const cx = W / 2, cy = H * .52, R = Math.min(W, H) * .44;
  const sp = [];
  for (let i = 0; i < 7; i++) {
    const a = i * 2 * Math.PI / 7 - Math.PI / 2 + .09 * Math.sin(i * 2.7);
    sp.push({ ring: 0, a: a, r0: .06 * R, L: 1.02 * R, wr: .42, seed: i * 1.7 + .3, cx: cx, cy: cy });
  }
  for (let i = 0; i < 4; i++) {
    const a = i * Math.PI / 2 - Math.PI / 2 + Math.PI / 4 + .22;
    sp.push({ ring: 1, a: a, r0: .06 * R, L: .8 * R, wr: .40, seed: i * 2.3 + 1.1, cx: cx, cy: cy });
  }
  sp.push({ ring: 2, a: -Math.PI / 2 + .35, r0: .03 * R, L: .46 * R, wr: .44, seed: 4.2, cx: cx, cy: cy });
  return sp;
}
/* 잎 윤곽 (기준 길이 1, 위쪽을 향함). 가장자리는 살짝 물결치게 */
function outlineLocal(wr, seed) {
  const N = 30, left = [], right = [];
  for (let i = 0; i <= N; i++) {
    const t = i / N, y = -t;
    let w = wr * Math.pow(Math.sin(Math.PI * Math.pow(t, .75)), .9);
    w *= 1 + .045 * Math.sin(t * 19 + seed) + .02 * Math.sin(t * 41 + seed * 2);
    w *= 1 - .12 * t;
    left.push([-w, y]); right.push([w, y]);
  }
  return left.concat(right.reverse());
}
function toCanvas(pts, ox, oy, s, rot) {
  const c = Math.cos(rot), sn = Math.sin(rot);
  return pts.map(function (q) { return [ox + (q[0] * c - q[1] * sn) * s, oy + (q[0] * sn + q[1] * c) * s]; });
}
function pathOf(pts) {
  const p = new Path2D();
  pts.forEach(function (q, i) { if (i) p.lineTo(q[0], q[1]); else p.moveTo(q[0], q[1]); });
  p.closePath();
  return p;
}
/* 잎 한 장 그리기. mode : 'pile'(배추 포기 안) · 'single'(펼쳐 놓은 잎) */
function drawLeaf(ctx, sp, mode, W, H, red) {
  let ox, oy, s, rot, tipX, tipY;
  if (mode === 'pile') {
    ox = sp.cx + Math.cos(sp.a) * sp.r0; oy = sp.cy + Math.sin(sp.a) * sp.r0;
    s = sp.L; rot = sp.a + Math.PI / 2;
    tipX = ox + Math.cos(sp.a) * sp.L; tipY = oy + Math.sin(sp.a) * sp.L;
  } else {
    ox = W / 2; oy = H * .93; s = H * .8; rot = 0;
    tipX = ox; tipY = oy - s;
  }
  const pts = toCanvas(outlineLocal(sp.wr, sp.seed), ox, oy, s, rot);
  const path = pathOf(pts);
  /* 색 : 절임배추(노란 잎) 또는 김치(붉은 잎). 너무 쨍하지 않게 */
  const g = ctx.createLinearGradient(ox, oy, tipX, tipY);
  if (red) {
    g.addColorStop(0, '#efc8a0'); g.addColorStop(.5, '#c6714a'); g.addColorStop(1, '#8e4a32');
  } else {
    g.addColorStop(0, '#fffdf2'); g.addColorStop(.45, '#f3eba6'); g.addColorStop(1, '#c4d26e');
  }
  ctx.fillStyle = g;
  ctx.fill(path);
  /* 주름 */
  ctx.save(); ctx.clip(path);
  ctx.strokeStyle = red ? 'rgba(90,40,25,.22)' : 'rgba(110,130,50,.2)';
  ctx.lineWidth = Math.max(1, s * .004);
  for (let k = 0; k < 6; k++) {
    const sk = (k - 2.5) / 3;
    const wl = [];
    for (let i = 0; i <= 20; i++) {
      const t = .12 + .8 * i / 20;
      const w = sp.wr * Math.pow(Math.sin(Math.PI * Math.pow(t, .75)), .9) * .8;
      wl.push([sk * w + .025 * Math.sin(t * 9 + k + sp.seed), -t]);
    }
    const c2 = toCanvas(wl, ox, oy, s, rot);
    ctx.beginPath();
    c2.forEach(function (q, i) { if (i) ctx.lineTo(q[0], q[1]); else ctx.moveTo(q[0], q[1]); });
    ctx.stroke();
  }
  ctx.restore();
  /* 가운데 심(줄기) : 하얀 굵은 줄 */
  const mid = toCanvas([[0, 0], [0, -.9]], ox, oy, s, rot);
  ctx.strokeStyle = red ? 'rgba(255,226,196,.7)' : 'rgba(255,255,250,.92)';
  ctx.lineCap = 'round';
  ctx.lineWidth = Math.max(2, s * .035);
  ctx.beginPath(); ctx.moveTo(mid[0][0], mid[0][1]); ctx.lineTo(mid[1][0], mid[1][1]); ctx.stroke();
  /* 가장자리 선 */
  ctx.strokeStyle = red ? 'rgba(80,30,18,.5)' : 'rgba(120,150,60,.4)';
  ctx.lineWidth = Math.max(1, s * .005);
  ctx.stroke(path);
  return path;
}
/* 배추 한 포기 (더미 · 완성 그림) */
function drawCabbage(ctx, W, H, doneArr) {
  ctx.clearRect(0, 0, W, H);
  const sps = leafSpecs(W, H);
  sps.forEach(function (sp, i) { drawLeaf(ctx, sp, 'pile', W, H, !!(doneArr && doneArr[i])); });
}
function drawPile() {
  ctxPile.clearRect(0, 0, pileCv.width, pileCv.height);
  drawCabbage(ctxPile, pileCv.width, pileCv.height, pileDone);
}

function paintInit() {
  const r = $('cabWrap').getBoundingClientRect();
  CW = Math.round(r.width); CH = Math.round(r.height);
  cvBase = $('cabBase'); cvPaint = $('paintCv'); pileCv = $('pileCv');
  cvBase.width = CW; cvBase.height = CH;
  cvPaint.width = CW; cvPaint.height = CH;
  ctxBase = cvBase.getContext('2d');
  ctxPaint = cvPaint.getContext('2d');
  ctxPile = pileCv.getContext('2d');
  SPECS = leafSpecs(CW, CH);
  pileDone = new Array(SPECS.length).fill(false);
  queue = PAINT_IDX.slice();
  doneN = 0; curLeaf = null;
  cellW = Math.ceil(CW / CELL); cellH = Math.ceil(CH / CELL);
  ctxPaint.clearRect(0, 0, CW, CH);
  ctxBase.clearRect(0, 0, CW, CH);
  drawPile();
}
/* 잎 한 장을 꺼내 펼쳐 놓아요 */
function pullLeaf() {
  if (queue.length === 0) { finishCabbage(); return; }
  const idx = queue.shift();
  S.load = 0; $('pasteTool').classList.remove('on');   /* 배추 한 포기마다 양념을 새로 묻혀요 */
  const sp = SPECS[idx];
  ctxBase.clearRect(0, 0, CW, CH);
  const path = drawLeaf(ctxBase, sp, 'single', CW, CH, false);
  /* 이 잎 안에 있는 칸만 셉니다 */
  cellsIn = new Uint8Array(cellW * cellH);
  painted = new Uint8Array(cellW * cellH);
  cellCount = 0; paintedCount = 0;
  for (let j = 0; j < cellH; j++) for (let i = 0; i < cellW; i++) {
    const x = (i + .5) * CELL, y = (j + .5) * CELL;
    if (ctxBase.isPointInPath(path, x, y)) { cellsIn[j * cellW + i] = 1; cellCount++; }
  }
  curLeaf = { idx: idx, path: path, sp: sp };
  ctxPaint.clearRect(0, 0, CW, CH);
  S.painting = false;
  updatePaint();
  say('배추 한 포기를 꺼냈어요. 양념을 묻혀서 배추를 칠해요');
  tell('배추 위에 쓱쓱 칠해요');
}
function enterPaint() {
  show('paint');
  S.load = 0; S.painting = false; S.busy = false;
  $('pasteTool').classList.add('on');
  requestAnimationFrame(function () { paintInit(); pullLeaf(); });
  say('양념 그릇을 눌러 양념을 묻히고, 배추 한 포기를 한 번에 칠해요');
  tell('양념을 묻히고 잎 한 장씩 칠해요');
}
function updatePaint() {
  const cur = curLeaf && cellCount ? paintedCount / cellCount : 0;
  const total = Math.min(1, (doneN + cur) / PAINT_IDX.length);
  $('paintFill').style.width = (total * 100) + '%';
  $('paintNum').textContent = Math.round(total * 100) + '%';
  $('loadFill').style.width = (S.load / DIP_LOAD * 100) + '%';
  $('leafNum').textContent = '배추 ' + doneN + '/' + PAINT_IDX.length + ' · 남은 배추 ' + (queue.length + (curLeaf ? 1 : 0)) + '포기';
}
function dip() {
  if (S.stage !== 'paint') return;
  S.load = DIP_LOAD;
  PK.beep('pick'); PK.buzz([20]);
  $('pasteTool').classList.add('on');
  say('양념을 묻혔어요. 잎에 칠해요');
  tell('잎 위에서 쓱쓱 칠해요');
  updatePaint();
}
/* 칠한 칸 표시 (이 잎 안의 칸만) */
function markCells(x, y, rad) {
  const i0 = Math.max(0, Math.floor((x - rad) / CELL)), i1 = Math.min(cellW - 1, Math.floor((x + rad) / CELL));
  const j0 = Math.max(0, Math.floor((y - rad) / CELL)), j1 = Math.min(cellH - 1, Math.floor((y + rad) / CELL));
  for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
    const k = j * cellW + i;
    if (!cellsIn[k] || painted[k]) continue;
    const cx = (i + .5) * CELL, cy = (j + .5) * CELL;
    if (Math.hypot(cx - x, cy - y) <= rad) { painted[k] = 1; paintedCount++; }
  }
}
/* 양념 질감 : 얼룩처럼 고르지 않게, 연한 빨강으로 */
function pasteStroke(x, y, px, py) {
  ctxPaint.save();
  ctxPaint.clip(curLeaf.path);
  ctxPaint.lineCap = 'round';
  ctxPaint.strokeStyle = 'rgba(170,70,46,.2)'; ctxPaint.lineWidth = BRUSH * 2;
  ctxPaint.beginPath(); ctxPaint.moveTo(px, py); ctxPaint.lineTo(x, y); ctxPaint.stroke();
  ctxPaint.strokeStyle = 'rgba(120,40,26,.1)'; ctxPaint.lineWidth = BRUSH * .9;
  ctxPaint.beginPath(); ctxPaint.moveTo(px + 3, py - 2); ctxPaint.lineTo(x + 2, y - 3); ctxPaint.stroke();
  for (let k = 0; k < 4; k++) {
    const t = Math.random(), rx = (Math.random() - .5) * BRUSH * 1.6, ry = (Math.random() - .5) * BRUSH * 1.6;
    ctxPaint.fillStyle = Math.random() < .5 ? 'rgba(120,40,26,.12)' : 'rgba(210,110,70,.12)';
    ctxPaint.beginPath();
    ctxPaint.arc(px + (x - px) * t + rx, py + (y - py) * t + ry, 2 + Math.random() * 5, 0, 7);
    ctxPaint.fill();
  }
  ctxPaint.restore();
}
function brushTo(x, y, px, py) {
  if (!curLeaf) return;
  const dist = Math.hypot(x - px, y - py);
  if (dist < 1) return;
  pasteStroke(x, y, px, py);
  const steps = Math.max(1, Math.ceil(dist / 10));
  for (let s = 0; s <= steps; s++) markCells(px + (x - px) * s / steps, py + (y - py) * s / steps, BRUSH * .75);
  S.load = Math.max(0, S.load - dist / 1000);
  checkDone();
}
function dab(x, y) {
  if (!curLeaf) return;
  pasteStroke(x, y, x, y);
  markCells(x, y, BRUSH * .75);
  S.load = Math.max(0, S.load - .05);
  PK.beep('tap');
  checkDone();
}
/* 잎 한 장을 다 칠했는지 */
function checkDone() {
  if (!curLeaf || cellCount === 0) return;
  if (paintedCount / cellCount < .8) { updatePaint(); return; }
  const idx = curLeaf.idx, sp = curLeaf.sp;
  curLeaf = null;
  S.painting = false;
  /* 붉게 물든 잎을 잠깐 보여 준 뒤 더미에 내려놓아요 */
  ctxBase.clearRect(0, 0, CW, CH);
  drawLeaf(ctxBase, sp, 'single', CW, CH, true);
  ctxPaint.clearRect(0, 0, CW, CH);
  doneN++;
  pileDone[idx] = true;
  PK.beep('good'); PK.buzz([25]);
  const left = queue.length;
  say(left === 0 ? '마지막 배추까지 다 칠했어요' : '한 포기 끝! 다음 배추를 꺼내요');
  tell('배추 ' + doneN + '/' + PAINT_IDX.length + ' 포기 완성');
  updatePaint();
  setTimeout(function () { drawPile(); pullLeaf(); }, 1100);
}
function finishCabbage() {
  if (S.stage !== 'paint' || S.busy) return;
  S.busy = true;
  $('pasteTool').classList.remove('on');
  /* 완성된 포기김치 : 배추 한 포기가 양념에 절여진 그림 */
  const fin = document.createElement('canvas');
  fin.width = 480; fin.height = 480;
  const fctx = fin.getContext('2d');
  drawCabbage(fctx, 480, 480, pileDone.map(function () { return true; }));
  S.finalSrc = fin.toDataURL('image/png');
  ctxBase.clearRect(0, 0, CW, CH);
  PK.beep('win');
  tell('포기김치가 완성되었어요!');
  say('배추 한 포기가 양념에 잘 절여졌어요. 포기김치 완성!');
  setTimeout(function () { PK.cheer('🥬', '포기김치 완성!', 1300); }, 400);
  setTimeout(enterStore, 2100);
}

/* 칠하는 손가락 */
function setupPaint() {
  const wrap = $('cabWrap');
  const pos = function (e) { const r = wrap.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
  wrap.addEventListener('pointerdown', function (e) {
    if (S.stage !== 'paint' || S.busy || !curLeaf) return;
    const p = pos(e);
    if (!ctxBase.isPointInPath(curLeaf.path, p.x, p.y)) {
      say('잎 위를 칠해요'); tell('펼쳐 놓은 잎 위를 칠해요'); PK.beep('hint'); return;
    }
    if (S.load <= 0) {
      $('pasteTool').classList.remove('shake'); void $('pasteTool').offsetWidth; $('pasteTool').classList.add('shake');
      PK.beep('hint');
      say('양념이 떨어졌어요. 양념 그릇을 눌러 다시 묻혀요');
      tell('양념 그릇을 눌러 다시 묻혀요');
      return;
    }
    S.painting = true;
    S.lastX = p.x; S.lastY = p.y;
    try { wrap.setPointerCapture(e.pointerId); } catch (err) {}
    dab(p.x, p.y);
    updatePaint();
  });
  wrap.addEventListener('pointermove', function (e) {
    if (!S.painting || S.stage !== 'paint' || !curLeaf) return;
    if (S.load <= 0) {
      S.painting = false;
      say('양념이 떨어졌어요. 양념 그릇을 눌러 다시 묻혀요');
      tell('양념 그릇을 눌러 다시 묻혀요');
      PK.beep('hint');
      return;
    }
    const p = pos(e);
    brushTo(p.x, p.y, S.lastX, S.lastY);
    S.lastX = p.x; S.lastY = p.y;
    if (Math.random() < .15) PK.beep('tap');
    updatePaint();
  });
  const end = function () { S.painting = false; };
  wrap.addEventListener('pointerup', end);
  wrap.addEventListener('pointercancel', end);
  $('pasteTool').addEventListener('click', dip);
}

/* =========================================================
   ④ 장독대에 담기
   1) 포기김치를 장독 안에 넣어요
   2) 뚜껑을 따로 집어 장독 위에 덮어요
   ========================================================= */
function enterStore() {
  show('store');
  S.busy = false; S.kimSel = false;
  $('kimImg').src = S.finalSrc;
  const k = $('kimchi');
  k.classList.remove('gone', 'drag', 'on');
  k.style.transition = '';
  k.style.left = '26%'; k.style.top = '60%';
  $('jarWrap').classList.remove('hit', 'hasKim');
  say('완성한 포기김치를 장독 안에 넣어요. 끌어다 놓거나 눌러서 넣어요');
  tell('포기김치를 장독에 넣어요');
}
/* 배추 한 포기를 장독 안에 넣어요 (잘라서 넣지 않아요) */
function kimchiIn() {
  if (S.stage !== 'store' || S.busy) return;
  S.busy = true;
  const k = $('kimchi');
  k.style.transition = 'left .35s ease-in, top .35s ease-in';
  k.style.left = '70%'; k.style.top = '46%';
  setTimeout(() => k.classList.add('gone'), 300);
  const j = $('jarWrap');
  setTimeout(() => {
    j.classList.add('hit', 'hasKim');
    PK.beep('win'); PK.buzz([40, 30, 80]);
    bubbles(2, 260);
  }, 380);
  setTimeout(() => j.classList.remove('hit'), 900);
  setTimeout(finishStore, 1500);
}
/* 뚜껑은 이미 덮여 있는 장독이라, 넣기만 하면 끝나요 */
function finishStore() {
  S.busy = true;
  PK.confetti(70);
  PK.cheer('🏺', '맛있는 김장 완성!', 1800);
  say('배추 한 포기를 장독에 담았어요. 맛있는 김장 완성!');
  tell('맛있는 김장 완성!');
  setTimeout(() => show('done'), 2200);
}
function setupStore() {
  const k = $('kimchi');
  makeMovable(k, {
    onTap() {
      if (S.stage !== 'store' || S.busy || $('jarWrap').classList.contains('hasKim')) return;
      k.classList.add('on'); S.kimSel = true; PK.beep('tap');
      say('포기김치를 골랐어요. 장독을 눌러요');
      tell('장독을 눌러 담아요');
    },
    onDrop(ev) {
      if (S.stage !== 'store' || S.busy || $('jarWrap').classList.contains('hasKim')) return false;
      if (near(ev, $('jarWrap'), 40)) { kimchiIn(); return true; }
      return false;
    }
  });
  $('jarWrap').addEventListener('click', () => {
    if (S.stage !== 'store' || S.busy) return;
    if (S.kimSel && !$('jarWrap').classList.contains('hasKim')) { S.kimSel = false; k.classList.remove('on'); kimchiIn(); }
  });
}

/* =========================================================
   처음 안내 · 다시 하기 · 설정
   ========================================================= */
function playIntro() {
  const names = ['st1', 'st2', 'st3', 'st4'];
  const lines = ['재료를 골라요', '양념을 만들어요', '배추에 발라요', '장독대에 담아요'];
  let i = 0;
  const step = () => {
    names.forEach(n => $(n).classList.remove('on'));
    if (!$('intro').hidden && i < names.length) {
      $(names[i]).classList.add('on');
      say(lines[i]);
      i++;
      setTimeout(step, 2200);
    }
  };
  step();
}
function startAll() {
  $('intro').hidden = true;
  musicStart();
  enterPick();
}

$('btnStart').addEventListener('click', startAll);
$('btnAgain').addEventListener('click', () => {
  S.busy = false; S.finalSrc = '';
  $('done').hidden = true;
  enterPick();
});
$('btnSet').addEventListener('click', () => { $('setSheet').hidden = false; });
$('btnClose').addEventListener('click', () => { $('setSheet').hidden = true; });
$('btnRestart').addEventListener('click', () => { $('setSheet').hidden = true; location.reload(); });
PK.bindOpts([['optSound', 'sound'], ['optVoice', 'voice'], ['optBgm', 'bgm']], cfg, 'kimjang', k => {
  if (k === 'bgm') { cfg.bgm ? musicStart() : musicStop(); }
});

setupMix();
setupPaint();
setupStore();
$('intro').hidden = false;
playIntro();
document.addEventListener('keydown', e => {
  if (e.repeat) return;
  if ((e.code === 'Space' || e.code === 'Enter') && !$('intro').hidden) { e.preventDefault(); startAll(); }
});

})();
