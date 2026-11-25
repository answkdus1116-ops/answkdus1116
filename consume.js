/* =========================================================
   소비 놀이
   버스 타기(교통카드) → 상점에서 고르기 → 계산대에서 현금 또는 카드로 계산
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

function say(t) { PK.tell(t); PK.say(t); }
function tell(t) { PK.tell(t); }
/* 받침에 맞춰 '을/를' 을 붙여요 */
function withObj(name) {
  const c = name.charCodeAt(name.length - 1);
  const jong = (c - 0xAC00) % 28 !== 0;
  return name + (jong ? '을' : '를');
}
function later(fn, ms) { timers.push(setTimeout(fn, ms)); }
function clearTimers() { timers.forEach(clearTimeout); timers = []; }

/* 사진이 없으면 이모티콘으로 보여 줘요 */
function thumb(p, cls) {
  const wrap = document.createElement('div');
  wrap.className = cls || '';
  const img = document.createElement('img');
  img.src = p.img; img.alt = p.name;
  img.onerror = () => { wrap.innerHTML = '<span class="emo">' + p.emo + '</span>'; };
  wrap.appendChild(img);
  return wrap;
}

function show(id) {
  ['sBus', 'sRide', 'sShop', 'sCheck'].forEach(s => { $(s).hidden = (s !== id); });
}

/* ---------- 1. 버스 정류장 ---------- */
function startGame() {
  clearTimers();
  cart = []; busy = false; busArrived = false;
  $('done').hidden = true;
  $('bus').classList.remove('in');
  $('card').classList.remove('show');
  $('card').style.transform = '';
  $('card').style.opacity = '';
  $('cardSlot').classList.remove('beep');
  $('cashFlyer').style.opacity = '0';
  renderCart();
  show('sBus');
  say('버스가 왔어요. 교통카드를 찍어요');
  later(() => { $('bus').classList.add('in'); }, 300);
  later(() => { busArrived = true; }, 1800);
}

function tapCard() {
  if (!busArrived || busy) return;
  busy = true;
  PK.beep('good'); PK.buzz([25]);
  say('삐! 교통카드를 찍었어요');
  const c = $('card');
  c.classList.add('show');
  c.style.transform = 'translateY(-70px) rotate(-8deg)';
  later(() => { c.style.opacity = '0'; }, 700);
  later(() => { goRide(); }, 1100);
}

/* ---------- 2. 버스가 달려요 ---------- */
function goRide() {
  show('sRide');
  say('부릉부릉! 상점으로 가요');
  later(() => { arriveShop(); }, 3200);
}

/* ---------- 3. 상점 ---------- */
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
    const t = thumb(p);
    chip.appendChild(t);
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

function payCash() {
  if (busy) return;
  busy = true;
  PK.beep('tap');
  say('현금을 건네요');
  const f = $('cashFlyer');
  const from = f.getBoundingClientRect();
  f.style.left = '8%'; f.style.top = '36%';
  f.style.opacity = '1';
  f.style.transform = 'translate(0,0)';
  const target = $('picked').getBoundingClientRect();
  const dx = (target.left + target.width / 2) - (from.left + from.width / 2);
  const dy = (target.top + target.height / 2) - (from.top + from.height / 2);
  later(() => { f.style.transform = 'translate(' + dx + 'px,' + dy + 'px) scale(.7)'; }, 50);
  later(() => { f.style.opacity = '0'; PK.beep('good'); say('현금으로 계산했어요'); }, 1000);
  later(() => { finish(); }, 1800);
}

function payCard() {
  if (busy) return;
  busy = true;
  PK.beep('good'); PK.buzz([30]);
  say('카드를 넣어요');
  $('cardSlot').classList.add('beep');
  later(() => { PK.beep('win'); say('카드로 결제했어요'); }, 700);
  later(() => { finish(); }, 1600);
}

function finish() {
  PK.confetti(70);
  PK.cheer('🛍️', '소비 활동 완료!', 1600);
  say('버스를 타고 가서, 물건을 고르고, 계산까지 했어요. 소비 활동 완료!');
  later(() => { $('done').hidden = false; }, 1800);
}

/* 연결 */
$('reader').addEventListener('click', tapCard);
$('toCheckout').addEventListener('click', goCheckout);
$('payCash').addEventListener('click', payCash);
$('payCard').addEventListener('click', payCard);

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
