/* =========================================================
   맛있는 김장 체험
   ① 재료 고르기 (6가지, 사진 카드)
   ② 양념 만들기 (고춧가루 2번 · 멸치액젓 1번 · 새우젓 1번 넣고, 여섯 바퀴 저어요)
   ③ 배추에 바르기 (양념을 묻혀 가며 칠해요, 빨갛게 70% 이상)
   ④ 장독대에 담기 (김치를 넣고, 뚜껑을 덮어요)
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
  stir: 0, stirAng: null, stirAcc: 0, stirring: false,
  load: 0, cover: null, cells: 16, coveredN: 0, painting: false, lastX: 0, lastY: 0,
  busy: false, lidSel: false, kimSel: false
};
const POUR_NEED = { chili: 2, fish: 1, shr: 1 };
const POUR_TOTAL = 4;
const STIR_NEED = 6;
const DIP_LOAD = 6;            /* 양념을 한 번 묻히면 이만큼 칠할 수 있어요 */
const PAINT_DONE = .72;        /* 이 정도 빨갛게 되면 김치 */

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
/* 거품 소리 같은 짧은 소리 */
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
    setTimeout(() => { S.busy = false; }, 600);
    if (S.picked === PICK_ORDER.length) {
      say(it.name + '! 재료를 다 담았어요');
      tell('재료를 다 담았어요! 이제 양념을 만들어요');
      setTimeout(() => { PK.cheer('🥬', '재료를 다 담았어요!', 1300); setTimeout(enterMix, 1500); }, 800);
    } else {
      say(it.name + '! ' + praise());
      const n = nextNeed();
      tell(n.name + ' 를 찾아 눌러요');
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
   - 고춧가루 2번, 멸치액젓 1번, 새우젓 1번 넣기 (숟가락으로 한 번씩)
   - 그다음 그릇 위에서 원을 그리며 여섯 바퀴 저어요
   ========================================================= */
const SEASON = [
  { key: 'chili', el: 's-chili', cnt: 'c-chili', name: '고춧가루', color: '#c8261b', grain: 'chili' },
  { key: 'fish',  el: 's-fish',  cnt: 'c-fish',  name: '멸치액젓', color: '#b9782a', grain: 'fish' },
  { key: 'shr',   el: 's-shr',   cnt: 'c-shr',   name: '새우젓',   color: '#e88a7a', grain: 'shr' }
];
const GRAIN_COLOR = { chili: '#d6351f', fish: '#c27a2a', shr: '#f0a090' };

function enterMix() {
  show('mix');
  S.pours = 0; S.stir = 0; S.stirring = false; S.sel = null;
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
    $(s.cnt).textContent = '0';
    $(s.cnt).parentElement.style.opacity = '1';
  });
  updateMix();
  say('숟가락으로 고춧가루를 두 번, 멸치액젓과 새우젓을 한 번씩 넣어요');
  tell('재료를 누른 뒤 그릇을 눌러 넣어요');
}
function updateMix() {
  const n = S.pours;
  $('mixFill').style.width = (n / POUR_TOTAL * 100) + '%';
  $('mixNum').textContent = n + '/' + POUR_TOTAL;
  $('paste').style.opacity = String(Math.min(.35, n / POUR_TOTAL * .35));   /* 넣을수록 붉어져요 */
  if (n >= POUR_TOTAL) setTimeout(startStir, 700);
}

/* 한 숟가락 넣기 : 알갱이가 떨어져요 */
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

/* 저어 주기 */
function startStir() {
  if (S.stage !== 'mix') return;
  S.stirring = true;
  $('bowlWrap').classList.add('stirring');
  $('stirMeter').hidden = false;
  say('이제 그릇 위에서 원을 그리며 저어요. 빙글빙글 여섯 바퀴');
  tell('그릇 위에서 빙글빙글 저어요');
}
function stirAngle(ev) {
  const r = $('bowlWrap').getBoundingClientRect();
  const cx = r.left + r.width / 2, cy = r.top + r.height * .5;
  return Math.atan2(ev.clientY - cy, ev.clientX - cx);
}
function stirMove(ev) {
  if (!S.stirring || S.stage !== 'mix' || S.stirAng === null) return;
  const a = stirAngle(ev);
  let d = a - S.stirAng;
  if (d > Math.PI) d -= 2 * Math.PI;
  if (d < -Math.PI) d += 2 * Math.PI;
  S.stirAng = a;
  S.stirAcc += d;
  /* 숟가락 방향 맞추기 */
  $('spoonArm').style.transform = 'rotate(' + (a * 180 / Math.PI + 90) + 'deg)';
  if (Math.abs(S.stirAcc) >= 2 * Math.PI * .5 && !S.halfDone) {
    S.halfDone = true;
  }
  if (Math.abs(S.stirAcc) >= 2 * Math.PI * .92) {
    S.stirAcc = 0;
    S.stir++;
    S.halfDone = false;
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
function finishMix() {
  S.stirring = false; S.stirAng = null;
  $('bowlWrap').classList.remove('stirring');
  $('stirMeter').hidden = true;
  PK.beep('win');
  bubbles(3, 360);
  $('paste').style.opacity = '1';
  tell('빨간 양념장이 만들어졌어요!');
  say('빨간 양념장이 만들어졌어요');
  setTimeout(enterPaint, 2400);
}

function setupMix() {
  SEASON.forEach(s => {
    const el = $(s.el);
    el.dataset.x = el.style.left;
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
    if (S.stirring) { S.stirAng = stirAngle(e); S.stirAcc = 0; try { $('bowlWrap').setPointerCapture(e.pointerId); } catch (err) {} return; }
    if (S.sel) {
      const s = S.sel; S.sel = null;
      document.querySelectorAll('.seasoning').forEach(x => x.classList.remove('on'));
      pourOne(s);
    } else {
      say('먼저 재료를 눌러요');
    }
  });
  $('bowlWrap').addEventListener('pointermove', stirMove);
  $('bowlWrap').addEventListener('pointerup', () => { S.stirAng = null; });
  $('bowlWrap').addEventListener('pointercancel', () => { S.stirAng = null; });
}

/* =========================================================
   ③ 배추에 양념 바르기
   - 양념 그릇을 누르면 붓에 묻어요 (한 번에 조금씩만 칠할 수 있어요)
   - 배추 위에서 쓱쓱 문질러 칠해요. 칠한 곳은 빨갛게 남아요
   ========================================================= */
let cvCtx = null, cvW = 0, cvH = 0;
function paintInit() {
  const cv = $('paintCv');
  const r = $('cabWrap').getBoundingClientRect();
  cvW = Math.round(r.width); cvH = Math.round(r.height);
  cv.width = cvW; cv.height = cvH;
  cvCtx = cv.getContext('2d');
  cvCtx.clearRect(0, 0, cvW, cvH);
  S.cover = new Uint8Array(S.cells * S.cells);
  S.coveredN = 0;
}
function enterPaint() {
  show('paint');
  S.load = 0; S.painting = false; S.busy = false;
  $('cabImg').src = K + 'photo/cabbage-salted.jpg';
  $('cabImg').style.opacity = '1';
  $('finImg').style.opacity = '0';
  $('pasteTool').classList.add('on');
  requestAnimationFrame(() => { paintInit(); updatePaint(); });
  say('양념 그릇을 눌러 붓에 묻히고, 배추 위에서 쓱쓱 칠해요');
  tell('양념을 묻히고 배추에 쓱쓱 칠해요');
}
function updatePaint() {
  const p = S.coveredN / (S.cells * S.cells);
  $('paintFill').style.width = Math.min(100, p / PAINT_DONE * 100) + '%';
  $('paintNum').textContent = Math.round(p * 100) + '%';
  $('loadFill').style.width = (S.load / DIP_LOAD * 100) + '%';
}
function dip() {
  if (S.stage !== 'paint') return;
  S.load = DIP_LOAD;
  PK.beep('pick'); PK.buzz([20]);
  $('pasteTool').classList.remove('shake');
  $('pasteTool').classList.add('on');
  say('양념을 묻혔어요. 배추에 칠해요');
  tell('배추에 쓱쓱 칠해요');
  updatePaint();
}
function markCells(x, y, rad) {
  const n = S.cells;
  const cw = cvW / n, ch = cvH / n;
  const i0 = Math.max(0, Math.floor((x - rad) / cw)), i1 = Math.min(n - 1, Math.floor((x + rad) / cw));
  const j0 = Math.max(0, Math.floor((y - rad) / ch)), j1 = Math.min(n - 1, Math.floor((y + rad) / ch));
  for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
    const cx = (i + .5) * cw, cy = (j + .5) * ch;
    if (Math.hypot(cx - x, cy - y) <= rad + Math.max(cw, ch) * .35) {
      const k = j * n + i;
      if (!S.cover[k]) { S.cover[k] = 1; S.coveredN++; }
    }
  }
}
function brushTo(x, y, px, py) {
  const rad = 34;
  const dist = Math.hypot(x - px, y - py);
  if (dist < 2) return;
  /* 붓 자국 : 진한 선 두 겹으로 자연스럽게 */
  cvCtx.lineCap = 'round'; cvCtx.lineJoin = 'round';
  cvCtx.strokeStyle = 'rgba(200,38,27,.55)'; cvCtx.lineWidth = rad * 2;
  cvCtx.beginPath(); cvCtx.moveTo(px, py); cvCtx.lineTo(x, y); cvCtx.stroke();
  cvCtx.strokeStyle = 'rgba(232,70,40,.35)'; cvCtx.lineWidth = rad * 1.1;
  cvCtx.beginPath(); cvCtx.moveTo(px + 4, py - 3); cvCtx.lineTo(x + 4, y - 3); cvCtx.stroke();
  /* 칠한 칸 기록 (선을 따라 여러 점을 찍어요) */
  const steps = Math.max(1, Math.ceil(dist / 14));
  for (let s = 0; s <= steps; s++) markCells(px + (x - px) * s / steps, py + (y - py) * s / steps, rad * .6);
  /* 양념은 칠할수록 줄어요 */
  S.load = Math.max(0, S.load - dist / 120);
}
function dab(x, y) {
  const rad = 34;
  cvCtx.fillStyle = 'rgba(200,38,27,.5)';
  cvCtx.beginPath(); cvCtx.arc(x, y, rad, 0, 7); cvCtx.fill();
  cvCtx.fillStyle = 'rgba(232,70,40,.3)';
  cvCtx.beginPath(); cvCtx.arc(x + 4, y - 3, rad * .6, 0, 7); cvCtx.fill();
  markCells(x, y, rad * .6);
  S.load = Math.max(0, S.load - .25);
  PK.beep('tap');
}
function paintDone() {
  if (S.stage !== 'paint' || S.busy) return;
  if (S.coveredN / (S.cells * S.cells) < PAINT_DONE) return;
  S.busy = true;
  S.painting = false;
  $('pasteTool').classList.remove('on');
  tell('배추가 빨갛게 물들었어요!');
  say('배추가 빨갛게 물들었어요. 포기김치가 되었어요');
  PK.beep('win');
  setTimeout(() => {
    $('finImg').style.opacity = '1';
    $('cabImg').style.opacity = '0';
    $('paintCv').style.transition = 'opacity .9s';
    $('paintCv').style.opacity = '0';
  }, 500);
  setTimeout(() => {
    PK.cheer('🥬', '포기김치 완성!', 1300);
    setTimeout(enterStore, 1500);
  }, 1500);
}
function setupPaint() {
  const wrap = $('cabWrap');
  const pos = e => {
    const r = wrap.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };
  wrap.addEventListener('pointerdown', e => {
    if (S.stage !== 'paint' || S.busy) return;
    if (S.load <= 0) {
      $('pasteTool').classList.remove('shake'); void $('pasteTool').offsetWidth;
      $('pasteTool').classList.add('shake');
      PK.beep('hint');
      say('양념을 다시 묻혀요. 양념 그릇을 눌러요');
      tell('양념 그릇을 눌러 다시 묻혀요');
      return;
    }
    S.painting = true;
    const p = pos(e);
    S.lastX = p.x; S.lastY = p.y;
    try { wrap.setPointerCapture(e.pointerId); } catch (err) {}
    dab(p.x, p.y);
    updatePaint();
    paintDone();
  });
  wrap.addEventListener('pointermove', e => {
    if (!S.painting || S.stage !== 'paint') return;
    if (S.load <= 0) {
      S.painting = false;
      say('양념을 다시 묻혀요');
      tell('양념 그릇을 눌러 다시 묻혀요');
      PK.beep('hint');
      return;
    }
    const p = pos(e);
    brushTo(p.x, p.y, S.lastX, S.lastY);
    S.lastX = p.x; S.lastY = p.y;
    if (Math.random() < .2) PK.beep('tap');
    updatePaint();
    paintDone();
  });
  const end = () => { S.painting = false; };
  wrap.addEventListener('pointerup', end);
  wrap.addEventListener('pointercancel', end);
  $('pasteTool').addEventListener('click', dip);
}

/* =========================================================
   ④ 장독대에 담기
   1) 김치를 장독 안에 넣어요
   2) 뚜껑을 덮어요
   ========================================================= */
function enterStore() {
  show('store');
  S.busy = false; S.kimSel = false; S.lidSel = false;
  const k = $('kimchi');
  k.classList.remove('gone', 'drag', 'on');
  k.style.left = '26%'; k.style.top = '60%';
  $('jarWrap').classList.remove('closed', 'hit', 'hasKim');
  const L = $('lid');
  L.classList.remove('show', 'on', 'snap', 'drag');
  L.style.left = '86%'; L.style.top = '18%';
  L.style.opacity = '0';
  say('완성한 김치를 장독대 안에 넣어요. 끌어다 놓거나 눌러서 넣어요');
  tell('김치를 장독대에 넣어요');
}
function kimchiIn() {
  if (S.stage !== 'store' || S.busy) return;
  S.busy = true;
  const k = $('kimchi');
  k.style.transition = 'left .35s ease-in, top .35s ease-in';
  k.style.left = '70%'; k.style.top = '62%';
  setTimeout(() => k.classList.add('gone'), 300);
  const j = $('jarWrap');
  j.classList.add('hit', 'hasKim');
  PK.beep('win'); PK.buzz([40, 30, 80]);
  bubbles(2, 260);
  setTimeout(() => { j.classList.remove('hit'); S.busy = false; }, 500);
  setTimeout(() => {
    say('김치를 장독에 담았어요. 이제 뚜껑을 덮어요');
    tell('뚜껑을 장독 위로 끌어다 놓아요');
    const L = $('lid');
    L.style.opacity = '1';
    L.classList.add('show');
  }, 900);
}
function lidOn() {
  if (S.stage !== 'store' || S.busy) return;
  S.busy = true;
  const L = $('lid');
  L.classList.add('snap');
  L.style.opacity = '0';
  $('jarWrap').classList.add('closed');
  PK.beep('good'); PK.buzz([30, 30, 60]);
  setTimeout(() => {
    PK.confetti(70);
    PK.cheer('🏺', '맛있는 김장 완성!', 1800);
    say('뚜껑을 덮었어요. 맛있는 김장 완성!');
    tell('맛있는 김장 완성!');
  }, 600);
  setTimeout(() => show('done'), 2600);
}
function setupStore() {
  const k = $('kimchi');
  makeMovable(k, {
    onTap() {
      if (S.stage !== 'store' || S.busy) return;
      k.classList.add('on'); S.kimSel = true; PK.beep('tap');
      say('김치를 골랐어요. 장독을 눌러요');
      tell('장독을 눌러 담아요');
    },
    onDrop(ev) {
      if (S.stage !== 'store' || S.busy) return false;
      if (near(ev, $('jarWrap'), 40)) { kimchiIn(); return true; }
      return false;
    }
  });
  const L = $('lid');
  makeMovable(L, {
    onTap() {
      if (S.stage !== 'store' || S.busy || !$('jarWrap').classList.contains('hasKim')) return;
      L.classList.add('on'); S.lidSel = true; PK.beep('tap');
      say('뚜껑을 골랐어요. 장독을 눌러요');
      tell('장독을 눌러 뚜껑을 덮어요');
    },
    onDrop(ev) {
      if (S.stage !== 'store' || S.busy || !$('jarWrap').classList.contains('hasKim')) return false;
      if (near(ev, $('jarWrap'), 50)) { lidOn(); return true; }
      return false;
    }
  });
  $('jarWrap').addEventListener('click', () => {
    if (S.stage !== 'store' || S.busy) return;
    if (S.kimSel && !$('jarWrap').classList.contains('hasKim')) { S.kimSel = false; k.classList.remove('on'); kimchiIn(); return; }
    if (S.lidSel) { S.lidSel = false; L.classList.remove('on'); lidOn(); }
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
  S.busy = false;
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
