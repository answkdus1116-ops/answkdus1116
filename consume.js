/* =========================================================
   소비 놀이
   버스 타기(교통카드를 리더기에 끌어다 대기) → 상점 매대에서 고르기 → 계산대에서 현금 또는 카드
   - 실패 화면은 없어요. 물건을 빼고 다시 담을 수 있어요
   ========================================================= */
const $ = id => document.getElementById(id);
const cfg = PK.load('consume', { sound: true, voice: true, rate: 0.85 });

/* 상점 상품 (사진 · 이름 · 사진이 없을 때 쓸 이모티콘) */
const PRODUCTS = [
  { id: 'milk',   name: '우유',   img: 'consume/photo/milk.jpg',   emo: '🥛' },
  { id: 'bread',  name: '빵',     img: 'consume/photo/bread.jpg',  emo: '🍞' },
  { id: 'banana', name: '바나나', img: 'consume/photo/banana.jpg', emo: '🍌' },
  { id: 'apple',  name: '사과',   img: 'consume/photo/apple.jpg',  emo: '🍎' },
  { id: 'chips',  name: '과자',   img: 'consume/photo/chips.jpg',  emo: '🍟' },
  { id: 'juice',  name: '주스',   img: 'consume/photo/juice.jpg',  emo: '🧃' },
];
const byId = id => PRODUCTS.find(p => p.id === id);

let cart = [];          /* 담긴 상품 id 목록 */
let busy = false;
let busArrived = false;
let timers = [];
let tDrag = null;       /* 교통카드 끌기 상태 */

function say(t) { PK.tell(t); PK.say(t); }
function tell(t) { PK.tell(t); }
function later(fn, ms) { timers.push(setTimeout(fn, ms)); }
function clearTimers() { timers.forEach(clearTimeout); timers = []; }

/* 받침에 맞춰 '을/를' 을 붙여요 */
function withObj(name) {
  const c = name.charCodeAt(name.length - 1);
  const jong = (c - 0xAC00) % 28 !== 0;
  return name + (jong ? '을' : '를');
}

/* 사진이 없으면 이모티콘으로 보여 줘요 */
function thumb(p) {
  const wrap = document.createElement('div');
  const img = document.createElement('img');
  img.src = p.img; img.alt = p.name;
  img.onerror = () => { wrap.innerHTML = '<span class="emo">' + p.emo + '</span>'; };
  wrap.appendChild(img);
  return wrap;
}

function show(id) {
  ['sBus', 'sBoard', 'sRide', 'sShop', 'sCheck'].forEach(s => { $(s).hidden = (s !== id); });
}

/* ---------- 1. 버스 정류장 : 교통카드를 리더기에 끌어다 대요 ---------- */
function resetCard() {
  const t = $('tcard');
  t.classList.remove('drag', 'back', 'in-reader');
  t.style.transform = '';
  t.style.opacity = '';
  $('readerPhoto').classList.remove('hot', 'ok');
}

function startGame() {
  clearTimers();
  cart = []; busy = false; busArrived = false; tDrag = null;
  $('done').hidden = true;
  $('bus').classList.remove('in', 'leave');
  resetCard();
  resetPayItems();
  $('cardSlot').classList.remove('beep');
  $('cashier').classList.remove('got');
  renderCart();
  show('sBus');
  $('busHint').hidden = true;
  say('버스가 왔어요. 버스를 눌러서 타요');
  later(() => { $('bus').classList.add('in'); }, 300);
  later(() => { busArrived = true; $('busHint').hidden = false; }, 1800);
  $('bus').onclick = boardBus;
}

/* 버스를 눌러 타요 : 버스가 옆으로 가고, 버스 안 장면이 나와요 */
function boardBus() {
  if (busy || !busArrived) return;
  busy = true;
  PK.beep('tap'); PK.buzz([20]);
  say('버스에 타요');
  $('bus').classList.add('leave');
  later(() => {
    show('sBoard');
    resetCard();
    busy = false;
    say('교통카드를 리더기에 끌어다 대요');
  }, 900);
}

/* 리더기 위에 있는지 (조금 넓게 봐요) */
function overReader(x, y) {
  const r = $('readerPhoto').getBoundingClientRect();
  const m = 30;
  return x >= r.left - m && x <= r.right + m && y >= r.top - m && y <= r.bottom + m;
}

function setupCard() {
  const t = $('tcard');
  t.addEventListener('pointerdown', e => {
    if (busy || $('sBoard').hidden) return;
    e.preventDefault();
    tDrag = { x0: e.clientX, y0: e.clientY, moved: false, dx: 0, dy: 0 };
    try { t.setPointerCapture(e.pointerId); } catch (err) {}
  });
  t.addEventListener('pointermove', e => {
    if (!tDrag) return;
    tDrag.dx = e.clientX - tDrag.x0;
    tDrag.dy = e.clientY - tDrag.y0;
    if (!tDrag.moved && Math.hypot(tDrag.dx, tDrag.dy) > 10) {
      tDrag.moved = true;
      t.classList.add('drag');
      t.classList.remove('back');
    }
    if (tDrag.moved) {
      t.style.transform = 'translate(' + tDrag.dx + 'px,' + tDrag.dy + 'px) rotate(' + (tDrag.dx / 30) + 'deg)';
      $('readerPhoto').classList.toggle('hot', overReader(e.clientX, e.clientY));
    }
  });
  const end = (e, cancel) => {
    if (!tDrag) return;
    const d = tDrag;
    tDrag = null;
    t.classList.remove('drag');
    $('readerPhoto').classList.remove('hot');
    if (!d.moved) {
      /* 누르기만 했어요 : 안내 */
      PK.beep('hint');
      say('교통카드를 끌어서 리더기에 대요');
      return;
    }
    if (!cancel && overReader(e.clientX, e.clientY)) { tapReader(); return; }
    /* 리더기 밖 : 제자리로 돌아가요 */
    t.classList.add('back');
    t.style.transform = '';
    say('리더기 위에 대 봐요');
  };
  t.addEventListener('pointerup', e => end(e, false));
  t.addEventListener('pointercancel', e => end(e, true));
  /* 리더기를 직접 눌러도 찍혀요 (카드를 먼저 누른 뒤) */
  $('readerPhoto').addEventListener('click', () => {
    if (busy || $('sBoard').hidden) return;
    say('교통카드를 끌어서 여기에 대요');
  });
}

/* 카드가 리더기에 닿았을 때 */
function tapReader() {
  if (busy) return;
  busy = true;
  const t = $('tcard'), r = $('readerPhoto');
  const tr = t.getBoundingClientRect(), rr = r.getBoundingClientRect();
  const dx = (rr.left + rr.width / 2) - (tr.left + tr.width / 2);
  const dy = (rr.top + rr.height / 2) - (tr.top + tr.height / 2);
  t.classList.add('in-reader');
  t.style.transform = 'translate(' + dx + 'px,' + dy + 'px) scale(.4)';
  r.classList.add('ok');
  PK.beep('good'); PK.buzz([25]);
  say('삐! 교통카드를 찍었어요');
  later(() => { goRide(); }, 1100);
}

/* ---------- 2. 버스가 달려요 ---------- */
function goRide() {
  show('sRide');
  say('부릉부릉! 상점으로 가요');
  later(() => { arriveShop(); }, 3200);
}

/* ---------- 3. 상점 : 매대 ---------- */
function arriveShop() {
  show('sShop');
  say('상점에 도착했어요. 갖고 싶은 물건을 골라요');
  busy = false;
}

function buildShop() {
  const box = $('products');
  box.innerHTML = '';
  PRODUCTS.forEach(p => {
    const el = document.createElement('div');
    el.className = 'product';
    el.dataset.id = p.id;
    const pimg = document.createElement('div');
    pimg.className = 'pimg';
    const img = document.createElement('img');
    img.src = p.img; img.alt = p.name;
    img.onerror = () => { pimg.innerHTML = '<span class="emo">' + p.emo + '</span>'; };
    pimg.appendChild(img);
    const name = document.createElement('div');
    name.className = 'pname';
    name.textContent = p.name;
    el.appendChild(pimg);
    el.appendChild(name);
    el.addEventListener('click', () => pick(p, el));
    box.appendChild(el);
  });
}

function pick(p, el) {
  if ($('sShop').hidden) return;
  cart.push(p.id);
  PK.beep('tap');
  el.classList.remove('added'); void el.offsetWidth; el.classList.add('added');
  say(withObj(p.name) + ' 장바구니에 담았어요');
  renderCart();
}

function renderCart() {
  $('cartCount').textContent = cart.length;
  const list = $('cartList');
  list.innerHTML = '';
  cart.forEach((id, i) => {
    const p = byId(id);
    const chip = document.createElement('div');
    chip.className = 'chip';
    chip.title = p.name + ' 빼기';
    chip.appendChild(thumb(p));
    /* 잘못 담았으면 누르면 빠져요 */
    chip.addEventListener('click', () => {
      if ($('sShop').hidden) return;
      cart.splice(i, 1);
      PK.beep('hint');
      say(withObj(p.name) + ' 빼요');
      renderCart();
    });
    list.appendChild(chip);
  });
  $('toCheckout').hidden = cart.length === 0;
}

/* ---------- 4. 계산대 ---------- */
function goCheckout() {
  if (cart.length === 0) return;
  show('sCheck');
  const picked = $('picked');
  picked.innerHTML = '';
  cart.forEach(id => {
    const p = byId(id);
    const d = document.createElement('div');
    d.className = 'pick';
    d.appendChild(thumb(p));
    picked.appendChild(d);
  });
  busy = false;
  say('계산대예요. 현금이나 카드로 계산해요');
}

/* ---------- 4-2. 계산 : 현금 · 카드 사진을 끌어다 주거나, 누르면 알아서 가요 ---------- */
const PAY = {
  cash: { item: 'cashItem', target: 'cashier', say: '현금을 계산원에게 줘요', ok: '계산원이 받았어요. 현금으로 계산했어요', wrong: '현금은 계산원에게 끌어다 줘요' },
  card: { item: 'cardItem', target: 'cardSlot', say: '카드를 카드 단말기에 꽂아요', ok: '카드로 결제했어요', wrong: '카드는 카드 단말기에 끌어다 줘요' }
};

/* 목표 위치 : 카드는 단말기 위쪽 카드 삽입구로 들어가요 (그림에서 위에서 약 13% 내려온 곳) */
function payTargetRect(kind) {
  const r = $(PAY[kind].target).getBoundingClientRect();
  if (kind === 'card') return { left: r.left + r.width / 2 - 2, top: r.top + r.height * 0.133 - 2, width: 4, height: 4 };
  return r;
}

/* 끌고 있는 물건이 어느 목표 위에 있는지 (조금 넓게 봐요) */
function payHit(x, y) {
  for (const kind of ["cash", "card"]) {
    const r = $(PAY[kind].target).getBoundingClientRect(), m = 24;
    if (x >= r.left - m && x <= r.right + m && y >= r.top - m && y <= r.bottom + m) return kind;
  }
  return null;
}

function setHot(kind) {
  $('cashier').classList.toggle('hot', kind === 'cash');
  $('cardSlot').classList.toggle('hot', kind === 'card');
}

function resetPayItems() {
  ['cashItem', 'cardItem'].forEach(id => {
    const el = $(id);
    el.classList.remove('dragging', 'back', 'gone');
    el.style.transform = ''; el.style.transition = '';
  });
  setHot(null);
  $('cashier').classList.remove('got');
}

function setupPay() {
  ['cash', 'card'].forEach(bindPayItem);
}

function bindPayItem(kind) {
  const el = $(PAY[kind].item);
  let d = null;
  el.addEventListener('pointerdown', e => {
    if (busy || $("sCheck").hidden) return;
    e.preventDefault();
    d = { x0: e.clientX, y0: e.clientY, moved: false, dx: 0, dy: 0 };
    try { el.setPointerCapture(e.pointerId); } catch (err) {}
  });
  el.addEventListener('pointermove', e => {
    if (!d) return;
    d.dx = e.clientX - d.x0; d.dy = e.clientY - d.y0;
    if (!d.moved && Math.hypot(d.dx, d.dy) > 10) {
      d.moved = true;
      el.classList.add('dragging'); el.classList.remove('back');
    }
    if (d.moved) {
      el.style.transform = 'translate(' + d.dx + 'px,' + d.dy + 'px) rotate(' + (d.dx / 30) + 'deg)';
      setHot(payHit(e.clientX, e.clientY));
    }
  });
  const end = (e, cancel) => {
    if (!d) return;
    const dd = d; d = null;
    el.classList.remove('dragging');
    setHot(null);
    if (!dd.moved) { payWith(kind); return; }          /* 누르기만 했어요 : 알아서 가요 */
    if (!cancel) {
      const hit = payHit(e.clientX, e.clientY);
      if (hit === kind) { payWith(kind); return; }
      PK.beep('hint');
      say(hit ? PAY[kind].wrong : '계산원이나 카드 단말기 위에 끌어다 줘요');
    }
    el.classList.add('back'); el.style.transform = '';
  };
  el.addEventListener('pointerup', e => end(e, false));
  el.addEventListener('pointercancel', e => end(e, true));
  /* 키보드 : 선택한 뒤 엔터 · 스페이스 */
  el.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); payWith(kind); }
  });
}

/* 물건이 목표로 날아가요. 현금은 계산원이 받고, 카드는 단말기에 쏙 들어가요 */
function payWith(kind) {
  if (busy || $("sCheck").hidden) return;
  busy = true;
  const el = $(PAY[kind].item);
  PK.beep('tap');
  say(PAY[kind].say);
  el.classList.remove('dragging', 'back');
  el.style.transition = 'none'; el.style.transform = '';
  const from = el.getBoundingClientRect();
  el.getBoundingClientRect();
  el.style.transition = '';
  const t = payTargetRect(kind);
  const dx = (t.left + t.width / 2) - (from.left + from.width / 2);
  const dy = (t.top + t.height / 2) - (from.top + from.height / 2);
  const scale = kind === 'card' ? .25 : .6;
  later(() => { el.classList.add('gone'); el.style.transform = 'translate(' + dx + 'px,' + dy + 'px) scale(' + scale + ')'; }, 30);
  if (kind === 'cash') {
    later(() => { $('cashier').classList.add('got'); PK.beep('good'); say(PAY.cash.ok); }, 1000);
    later(() => { finish(); }, 1800);
  } else {
    later(() => { $('cardSlot').classList.add('beep'); PK.beep('good'); PK.buzz([30]); }, 900);
    later(() => { PK.beep('win'); say(PAY.card.ok); }, 1100);
    later(() => { finish(); }, 2000);
  }
}

function finish() {
  PK.confetti(70);
  PK.cheer('🛍️', '소비 활동 완료!', 1600);
  say('버스를 타고 가서, 물건을 고르고, 계산까지 했어요. 소비 활동 완료!');
  later(() => { $('done').hidden = false; }, 1800);
}

/* 연결 */
setupCard();
$('toCheckout').addEventListener('click', goCheckout);
setupPay();

/* 설정 */
PK.bindOpts([['optSound', 'sound'], ['optVoice', 'voice']], cfg, 'consume');
$('btnSet').addEventListener('click', () => { $('setSheet').hidden = false; });
$('btnClose').addEventListener('click', () => { $('setSheet').hidden = true; });
$('btnRestart').addEventListener('click', () => { $('setSheet').hidden = true; location.reload(); });

$('btnStart').addEventListener('click', () => {
  $('intro').hidden = true;
  startGame();
});
$('btnAgain').addEventListener('click', () => {
  startGame();
});
document.addEventListener('keydown', e => {
  if (e.repeat) return;
  if ((e.code === 'Space' || e.code === 'Enter') && !$('intro').hidden) { e.preventDefault(); $('btnStart').click(); }
});

buildShop();
show('sBus');
$('intro').hidden = false;
tell('버스를 타고 상점에 가요');
