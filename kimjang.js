/* =========================================================
   맛있는 김장 체험
   ① 재료 고르기 → ② 양념 만들기 → ③ 배추에 바르기 → ④ 장독대에 담기
   - 터치 영역을 넉넉하게 (실제 그림보다 넓게)
   - 끌어다 놓을 때 근처에만 가도 자석처럼 붙습니다
   - 틀려도 실패 화면은 없고, 다시 찾아보라고 다정하게 알려 줍니다
   ========================================================= */
(function () {
"use strict";

const $ = id => document.getElementById(id);
const K = 'kim/';
const cfg = PK.load('kimjang', { sound: true, voice: true, rate: 0.85, bgm: 1 });

/* ---------- 가을 음악 (아주 작게, 천천히) ---------- */
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
const S = { stage: 'intro', need: [], picked: 0, inBowl: 0, paint: 0, sel: null, busy: false };
const PICK_ORDER = [
  { id: 'cab',   name: '배추',     src: K + 'cabbage.svg',       x: 50, y: 40 },
  { id: 'rad',   name: '무',       src: K + 'radish.svg',        x: 22, y: 24 },
  { id: 'onion', name: '파',       src: K + 'onion.svg',         x: 78, y: 24 },
  { id: 'chili', name: '고춧가루', src: K + 'powder.svg',        x: 34, y: 58 },
  { id: 'fish',  name: '멸치액젓', src: K + 'fishsauce.svg',     x: 66, y: 60 },
  { id: 'shr',   name: '새우젓',   src: K + 'saltedshrimp.svg',  x: 50, y: 22 }
];
const DISTRACT = [
  { id: 'apple',  name: '사과', src: K + 'apple.svg',  x: 14, y: 46 },
  { id: 'banana', name: '바나나', src: K + 'banana.svg', x: 86, y: 44 },
  { id: 'milk',   name: '우유', src: K + 'milk.svg',   x: 50, y: 74 }
];
const PRAISE = ['잘했어요!', '참 잘했어요!', '멋져요!', '대단해요!', '최고예요!'];
const TARGET_PAINT = 8;

/* ---------- 말과 소리 ---------- */
function tell(t) { PK.tell(t); }
function say(t) { PK.say(t); }
function praise() { return PRAISE[Math.floor(Math.random() * PRAISE.length)]; }

/* 효과 : 쪼르륵 같은 짧은 소리 */
function swish(n) {
  for (let i = 0; i < n; i++) setTimeout(() => PK.note(300 + i * 90 + Math.random() * 40, .08, 'triangle', .07), i * 70);
}

/* 자리를 옮기며 생기는 흰 빛 */
function puffAt(x, y) {
  const st = $('stage'), r = st.getBoundingClientRect();
  const p = document.createElement('div');
  p.className = 'puff';
  p.style.width = p.style.height = '90px';
  p.style.left = (x - r.left) + 'px'; p.style.top = (y - r.top) + 'px';
  st.appendChild(p);
  setTimeout(() => p.remove(), 700);
}

function center(el) {
  const st = $('stage').getBoundingClientRect(), r = el.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2, st };
}

/* ---------- 단계 전환 ---------- */
function show(id) {
  ['layer-pick', 'layer-mix', 'layer-paint', 'layer-store'].forEach(l => $(l).hidden = true);
  $('basket').hidden = true; $('basketMini').hidden = true;
  $('done').hidden = true;
  if (id === 'pick') { $('layer-pick').hidden = false; $('basket').hidden = false; $('basketMini').hidden = false; }
  if (id === 'mix') { $('layer-mix').hidden = false; $('basket').hidden = true; $('basketMini').hidden = true; }
  if (id === 'paint') $('layer-paint').hidden = false;
  if (id === 'store') $('layer-store').hidden = false;
  if (id === 'done') $('done').hidden = false;
  S.stage = id;
}

/* =========================================================
   ① 재료 고르기
   ========================================================= */
function buildPick() {
  const layer = $('layer-pick');
  layer.innerHTML = '';
  const all = PICK_ORDER.concat(DISTRACT);
  /* 흩어진 자리는 매번 조금씩 다르게 */
  all.forEach(it => {
    const d = document.createElement('div');
    d.className = 'item';
    d.dataset.id = it.id;
    d.style.left = (it.x + (Math.random() * 4 - 2)) + '%';
    d.style.top = (it.y + (Math.random() * 3 - 1.5)) + '%';
    d.innerHTML = '<img src="' + it.src + '" alt="' + it.name + '"><span class="tag">' + it.name + '</span>';
    d.addEventListener('pointerdown', () => pickTap(it, d));
    layer.appendChild(d);
  });
  S.need = PICK_ORDER.map(p => p.id);
  S.picked = 0;
  updateBasket();
}

function updateBasket() {
  $('basketCount').textContent = S.picked + ' / ' + PICK_ORDER.length;
}

function nextNeed() {
  const id = S.need[0];
  return PICK_ORDER.find(p => p.id === id);
}

function pickTap(it, el) {
  if (S.stage !== 'pick' || S.busy || el.classList.contains('gone')) return;
  const target = nextNeed();
  if (!target) return;
  if (it.id === target.id) {
    S.busy = true;
    S.need.shift(); S.picked++;
    PK.beep('good'); PK.buzz([30]);
    /* 장바구니 자리로 쏙 */
    const b = $('basket').getBoundingClientRect(), c = center(el);
    const dx = (b.left + b.width / 2) - c.x, dy = (b.top + b.height / 2) - c.y;
    el.style.transition = 'transform .6s ease-in, opacity .6s';
    el.style.transform = 'translate(calc(-50% + ' + dx + 'px), calc(-50% + ' + dy + 'px)) scale(.25)';
    el.style.opacity = '0';
    el.style.pointerEvents = 'none';
    addMini(it);
    updateBasket();
    say(it.name + '! ' + praise());
    tell(S.picked === PICK_ORDER.length ? '재료를 다 담았어요!' : (nextNeed() ? nextNeed().name + ' 를 찾아 눌러요' : ''));
    setTimeout(() => { S.busy = false; }, 500);
    if (S.picked === PICK_ORDER.length) {
      setTimeout(() => {
        PK.cheer('🥬', '재료를 다 담았어요!', 1300);
        setTimeout(enterMix, 1400);
      }, 700);
    } else {
      markNeed();
    }
  } else {
    /* 틀렸을 땐 살짝 흔들고 힌트만 */
    el.classList.remove('pk-shake'); void el.offsetWidth; el.classList.add('pk-shake');
    PK.beep('hint');
    say('이건 ' + it.name + ' 이에요. ' + target.name + ' 를 찾아봐요');
    tell(target.name + ' 를 찾아 눌러요');
    markNeed();
  }
}

/* 지금 찾을 재료를 점선으로 보여 줍니다 */
function markNeed() {
  document.querySelectorAll('#layer-pick .item').forEach(e => e.classList.remove('on'));
  const t = nextNeed();
  if (!t) return;
  const el = document.querySelector('#layer-pick .item[data-id="' + t.id + '"]');
  if (el && !el.classList.contains('gone')) el.classList.add('on');
  tell(t.name + ' 를 찾아 눌러요');
}

function addMini(it) {
  const m = $('basketMini');
  const im = document.createElement('img');
  im.src = it.src; im.alt = '';
  m.appendChild(im);
  if (m.children.length > 6) m.firstElementChild.remove();
}

function enterPick() {
  buildPick();
  show('pick');
  $('basketMini').innerHTML = '';
  tell('재료를 골라 바구니에 담아요');
  say('먼저 재료를 골라 바구니에 담아요. ' + nextNeed().name + ' 를 찾아 눌러요');
  markNeed();
}

/* =========================================================
   드래그 도우미 (끌기 · 누르기 둘 다 되게)
   ========================================================= */
function makeMovable(el, opts) {
  el.addEventListener('pointerdown', e => {
    if (el.classList.contains('gone')) return;
    e.preventDefault();
    const st = $('stage').getBoundingClientRect();
    const start = { x: e.clientX, y: e.clientY };
    const r0 = el.getBoundingClientRect();
    const ox = e.clientX - r0.left, oy = e.clientY - r0.top;
    const home = { left: el.style.left, top: el.style.top };
    let moved = false;
    try { el.setPointerCapture(e.pointerId); } catch (err) {}
    const move = ev => {
      if (!moved && Math.hypot(ev.clientX - start.x, ev.clientY - start.y) < 10) return;
      if (!moved) { moved = true; el.classList.add('dragging'); }
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
      if (opts.onDrop && opts.onDrop(ev)) return;      /* 놓기에 성공 */
      el.classList.add('back');                        /* 실패하면 제자리로 */
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
   ② 양념 만들기
   ========================================================= */
const SEASON = [
  { id: 'chili', el: 'chili', name: '고춧가루', src: K + 'powder.svg' },
  { id: 'fish',  el: 'fish',  name: '멸치액젓', src: K + 'fishsauce.svg' },
  { id: 'shr',   el: 'shr',   name: '새우젓',   src: K + 'saltedshrimp.svg' }
];

function enterMix() {
  show('mix');
  S.inBowl = 0; S.sel = null;
  const bowl = $('bowlWrap');
  bowl.classList.remove('full', 'swirl');
  $('bowlIn').innerHTML = '';
  $('paste').style.opacity = '';
  SEASON.forEach(s => {
    const el = $('s-' + (s.id === 'chili' ? 'chili' : s.id === 'fish' ? 'fish' : 'shr'));
    el.classList.remove('gone', 'on');
    el.style.display = '';
    el.style.transform = 'translate(-50%,-50%)';
  });
  tell('고춧가루, 멸치액젓, 새우젓을 그릇에 넣어요');
  say('그릇에 고춧가루와 멸치액젓, 새우젓을 넣어요. 끌어다 놓거나 눌러서 넣어요');
}

function bowlAdd(s) {
  const el = $('s-' + s.el);
  if (!el || el.classList.contains('gone')) return;
  el.classList.add('gone');
  S.inBowl++;
  const img = document.createElement('img');
  img.src = s.src; img.alt = '';
  img.style.left = (30 + Math.random() * 40) + '%';
  img.style.top = (36 + Math.random() * 22) + '%';
  $('bowlIn').appendChild(img);
  PK.beep('pick'); PK.buzz([25]);
  swish(2);
  say(s.name + ' 를 넣었어요');
  tell(S.inBowl === 3 ? '쓱싹쓱싹 섞어요!' : '남은 재료를 그릇에 넣어요');
  if (S.inBowl === 3) setTimeout(stir, 700);
}

function stir() {
  if (S.stage !== 'mix') return;
  const bowl = $('bowlWrap');
  bowl.classList.add('swirl');
  swish(6);
  say('쓱싹쓱싹');
  tell('쓱싹쓱싹 섞어요');
  setTimeout(() => {
    bowl.classList.remove('swirl');
    bowl.classList.add('full');
    PK.beep('win');
    tell('빨간 양념장이 만들어졌어요!');
    say('빨간 양념장이 만들어졌어요');
    setTimeout(enterPaint, 2100);
  }, 2300);
}

function setupMix() {
  SEASON.forEach(s => {
    const el = $('s-' + s.el);
    /* 끌어다 놓기 */
    makeMovable(el, {
      onTap() {
        document.querySelectorAll('.seasoning').forEach(e => e.classList.remove('on'));
        el.classList.add('on'); S.sel = s; PK.beep('tap');
        say(s.name + ' 를 골랐어요. 그릇을 눌러요');
        tell('그릇을 눌러 넣어요');
      },
      onDrop(ev) {
        const bowl = $('bowlWrap');
        if (near(ev, bowl, 90)) {
          const b = bowl.getBoundingClientRect();
          puffAt(b.left + b.width / 2, b.top + b.height / 2);
          bowlAdd(s);
          return true;
        }
        return false;
      }
    });
  });
  $('bowlWrap').addEventListener('click', () => {
    if (S.stage !== 'mix' || !S.sel) return;
    const s = S.sel; S.sel = null;
    document.querySelectorAll('.seasoning').forEach(e => e.classList.remove('on'));
    bowlAdd(s);
  });
}

/* =========================================================
   ③ 배추에 양념 바르기
   ========================================================= */
function enterPaint() {
  show('paint');
  S.paint = 0; S.sel = null;
  $('blobs').innerHTML = '';
  const cab = $('cabImg');
  cab.src = K + 'cabbage-salted.svg'; cab.style.opacity = '1';
  $('pasteTool').classList.add('on');
  updatePaint();
  tell('양념을 누르고, 배추를 톡톡 두드려요');
  say('양념을 누르고 배추를 톡톡 두드려요. 빨갛게 물들여요');
}

function updatePaint() {
  $('paintFill').style.width = (S.paint / TARGET_PAINT * 100) + '%';
  $('paintNum').textContent = S.paint + '/' + TARGET_PAINT;
}

function paintAt(clientX, clientY) {
  if (S.stage !== 'paint' || S.busy) return;
  const wrap = $('cabWrap').getBoundingClientRect();
  const x = (clientX - wrap.left) / wrap.width * 100;
  const y = (clientY - wrap.top) / wrap.height * 100;
  /* 배추 안을 두드렸을 때만 */
  if (x < 6 || x > 94 || y < 6 || y > 94) return;

  const b = document.createElement('div');
  b.className = 'blob';
  const size = 56 + Math.random() * 44;
  b.style.left = x + '%'; b.style.top = y + '%';
  b.style.width = size + 'px'; b.style.height = (size * .82) + 'px';
  b.style.transform = 'translate(-50%,-50%) rotate(' + (Math.random() * 180) + 'deg)';
  $('blobs').appendChild(b);

  const ring = document.createElement('div');
  ring.className = 'tap-ring';
  ring.style.left = x + '%'; ring.style.top = y + '%';
  ring.style.width = ring.style.height = '60px';
  $('cabWrap').appendChild(ring);
  setTimeout(() => ring.remove(), 650);

  PK.beep('tap'); PK.buzz([18]);
  S.paint++;
  updatePaint();
  if (S.paint < TARGET_PAINT) {
    say(S.paint === 4 ? '조금만 더 발라요' : '톡톡');
    tell('배추를 톡톡 두드려요 · ' + S.paint + '/' + TARGET_PAINT);
  } else {
    S.busy = true;
    finishPaint();
  }
}

function finishPaint() {
  $('pasteTool').classList.remove('on');
  tell('배추가 빨갛게 물들었어요!');
  say('배추가 빨갛게 물들었어요. 포기김치가 되었어요');
  PK.beep('win');
  setTimeout(() => {
    const cab = $('cabImg');
    cab.style.opacity = '0';
    setTimeout(() => {
      cab.src = K + 'kimchi.svg';
      cab.style.opacity = '1';
      $('blobs').style.transition = 'opacity .8s';
      $('blobs').style.opacity = '0';
    }, 400);
  }, 400);
  setTimeout(() => {
    PK.cheer('🥬', '포기김치 완성!', 1300);
    setTimeout(() => { $('blobs').style.opacity = '1'; $('blobs').innerHTML = ''; S.busy = false; enterStore(); }, 1500);
  }, 1500);
}

function setupPaint() {
  $('cabWrap').addEventListener('pointerdown', e => {
    if (S.sel) { /* 양념을 골랐으면 물들임 소리를 조금 더 */ }
    paintAt(e.clientX, e.clientY);
  });
  $('pasteTool').addEventListener('click', () => {
    $('pasteTool').classList.toggle('on');
    PK.beep('pick');
    say('양념을 골랐어요. 배추를 톡톡 두드려요');
    tell('배추를 톡톡 두드려요');
  });
}

/* =========================================================
   ④ 장독대에 담기
   ========================================================= */
function enterStore() {
  show('store');
  const k = $('kimchi');
  k.classList.remove('gone', 'drag', 'on');
  k.style.left = '28%'; k.style.top = '56%';
  $('jarWrap').classList.remove('closed', 'hit');
  tell('김치를 장독대에 담아요');
  say('완성한 김치를 장독대 안에 담아요. 끌어다 놓거나 눌러서 넣어요');
  S.sel = 'kimchi';
}

function jarIn(ev) {
  const jar = $('jarWrap');
  if (!near(ev, jar, 60)) return false;
  storeKimchi();
  return true;
}

function storeKimchi() {
  if (S.stage !== 'store' || S.busy) return;
  S.busy = true;
  const k = $('kimchi');
  k.classList.add('gone');
  const j = $('jarWrap');
  j.classList.add('hit');
  PK.beep('win'); PK.buzz([40, 30, 80]);
  setTimeout(() => {
    j.classList.add('closed');
    j.classList.remove('hit');
    PK.beep('good');
    say('장독 뚜껑을 닫았어요');
  }, 500);
  setTimeout(() => {
    PK.confetti(70);
    tell('맛있는 김장 완성!');
    say('맛있는 김장 완성!');
    setTimeout(() => show('done'), 1400);
  }, 1100);
}

function setupStore() {
  const k = $('kimchi');
  makeMovable(k, {
    onTap() {
      k.classList.add('on'); S.sel = 'kimchi'; PK.beep('tap');
      say('김치를 골랐어요. 장독대를 눌러요');
      tell('장독대를 눌러 담아요');
    },
    onMove(ev) { k.classList.add('drag'); },
    onDrop(ev) {
      k.classList.remove('drag');
      if (near(ev, $('jarWrap'), 60)) { storeKimchi(); return true; }
      return false;
    }
  });
  $('jarWrap').addEventListener('click', () => {
    if (S.stage !== 'store' || S.sel !== 'kimchi') return;
    S.sel = null; storeKimchi();
  });
}

/* =========================================================
   처음 안내 · 다시 하기
   ========================================================= */
function playIntro() {
  const names = ['st1', 'st2', 'st3', 'st4'];
  const lines = ['재료를 골라요', '양념을 만들어요', '배추에 발라요', '장독대에 담아요'];
  names.forEach(n => $(n).classList.remove('on'));
  let i = 0;
  const step = () => {
    names.forEach(n => $(n).classList.remove('on'));
    if (!$('intro').hidden && i < names.length) {
      $(names[i]).classList.add('on');
      say(lines[i]);
      i++;
      setTimeout(step, 2000);
    }
  };
  step();
  say('오늘은 맛있는 김장을 해요. 재료를 고르고, 양념을 만들고, 배추에 바르고, 장독대에 담아요');
}

function startAll() {
  $('intro').hidden = true;
  musicStart();
  enterPick();
}

function restart() {
  musicStop();
  musicStart();
  S.busy = false;
  $('intro').hidden = false;
  $('done').hidden = true;
  show('none');
  $('layer-pick').hidden = true;
  playIntro();
  setTimeout(() => { /* 안내 뒤에는 바로 시작하기를 누를 수 있게 둡니다 */ }, 10);
}

/* ---------- 설정 ---------- */
$('btnSet').addEventListener('click', () => { $('setSheet').hidden = false; });
$('btnClose').addEventListener('click', () => { $('setSheet').hidden = true; });
$('btnRestart').addEventListener('click', () => { $('setSheet').hidden = true; location.reload(); });
PK.bindOpts([['optSound', 'sound'], ['optVoice', 'voice'], ['optBgm', 'bgm']], cfg, 'kimjang', k => {
  if (k === 'bgm') { cfg.bgm ? musicStart() : musicStop(); }
});

/* ---------- 연결 ---------- */
$('btnStart').addEventListener('click', startAll);
$('btnAgain').addEventListener('click', () => {
  S.busy = false;
  $('done').hidden = true;
  enterPick();
});

setupMix();
setupPaint();
setupStore();
$('intro').hidden = false;
playIntro();

/* 키보드 : 스페이스로 시작하기 (스위치 입력 대비) */
document.addEventListener('keydown', e => {
  if (e.repeat) return;
  if ((e.code === 'Space' || e.code === 'Enter') && !$('intro').hidden) { e.preventDefault(); startAll(); }
});

})();
