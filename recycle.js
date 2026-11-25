/* =========================================================
   분리수거 놀이
   - 쓰레기 사진을 하나씩 보고, 맞는 분리수거함에 넣어요
   - 손가락으로 끌어다 놓거나, 쓰레기를 누른 뒤 통을 눌러요
   - 틀려도 실패 화면은 없어요. 다시 골라 보면 돼요
   ========================================================= */
const $ = id => document.getElementById(id);
const cfg = PK.load('recycle', { sound: true, voice: true, rate: 0.85 });

/* 쓰레기 목록 (사진 · 이름 · 맞는 통) */
const ITEMS = [
  { name: '신문지',     cat: '종이',     photo: 'recycle/photo/newspaper.jpg' },
  { name: '골판지 상자', cat: '종이',     photo: 'recycle/photo/cardboard.jpg' },
  { name: '페트병',     cat: '플라스틱', photo: 'recycle/photo/pet.jpg' },
  { name: '샴푸 병',    cat: '플라스틱', photo: 'recycle/photo/shampoo.jpg' },
  { name: '콜라 캔',    cat: '캔',       photo: 'recycle/photo/can.jpg' },
  { name: '음료 캔 묶음', cat: '캔',     photo: 'recycle/photo/can2.jpg' },
];
const BIN_NAMES = ['종이', '플라스틱', '캔'];

let order = [], idx = 0, wrong = 0, busy = false, selected = false, drag = null;

function say(t) { PK.tell(t); PK.say(t); }
function tell(t) { PK.tell(t); }

function shuffle(a) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function clearBins() {
  document.querySelectorAll('.bin').forEach(b => b.classList.remove('over', 'hint', 'flash'));
}

function showItem() {
  clearBins();
  selected = false; wrong = 0; busy = false;
  const item = $('item');
  if (idx >= order.length) { finish(); return; }
  const it = order[idx];
  item.classList.remove('gone', 'on', 'back', 'dragging');
  item.style.transition = '';
  item.style.transform = '';
  item.style.opacity = '';
  $('itemImg').src = it.photo;
  $('itemImg').alt = it.name;
  $('itemName').textContent = it.name;
  $('progress').textContent = idx + ' / ' + order.length;
  say(it.name + ' 이에요. 어느 통에 넣을까요?');
}

function binAt(x, y) {
  const bins = [...document.querySelectorAll('.bin')];
  for (const b of bins) {
    const r = b.getBoundingClientRect();
    if (x >= r.left - 10 && x <= r.right + 10 && y >= r.top - 10 && y <= r.bottom + 10) return b;
  }
  return null;
}

function judge(bin) {
  if (busy || idx >= order.length) return;
  const it = order[idx];
  const cat = bin.dataset.cat;
  busy = true;
  if (cat === it.cat) {
    /* 맞았어요 : 쓰레기가 통 안으로 쏙 들어가요 */
    PK.beep('good'); PK.buzz([25]);
    bin.classList.add('flash');
    const item = $('item');
    const ir = item.getBoundingClientRect(), br = bin.getBoundingClientRect();
    const dx = (br.left + br.width / 2) - (ir.left + ir.width / 2);
    const dy = (br.top + br.height / 2) - (ir.top + ir.height / 2);
    item.classList.remove('dragging', 'back');
    item.style.transition = 'transform .5s ease-in, opacity .5s';
    item.style.transform = 'translate(' + dx + 'px,' + dy + 'px) scale(.25)';
    item.style.opacity = '0';
    say('맞아요! ' + cat + ' 통에 넣었어요');
    setTimeout(() => {
      idx++;
      item.style.transition = '';
      item.style.opacity = '';
      showItem();
    }, 1100);
  } else {
    /* 틀렸어요 : 다시 골라 보게 돌아와요. 벌칙은 없어요 */
    PK.beep('hint'); PK.buzz([15]);
    wrong++;
    const item = $('item');
    item.classList.remove('dragging');
    item.classList.add('back');
    item.style.transform = '';
    busy = false;
    say(cat + ' 통이 아니에요. 다른 통을 골라 볼까요?');
    if (wrong >= 2) {
      const right = document.querySelector('.bin[data-cat="' + it.cat + '"]');
      if (right) right.classList.add('hint');
      say(it.cat + ' 통에 넣어 볼까요? 반짝이는 통을 눌러요');
    }
  }
}

/* 쓰레기 카드 : 누르면 골라지고, 끌면 따라와요 */
function setupItem() {
  const item = $('item');
  item.addEventListener('pointerdown', e => {
    if (busy || idx >= order.length) return;
    e.preventDefault();
    drag = { x0: e.clientX, y0: e.clientY, moved: false };
    try { item.setPointerCapture(e.pointerId); } catch (err) {}
  });
  item.addEventListener('pointermove', e => {
    if (!drag) return;
    const dx = e.clientX - drag.x0, dy = e.clientY - drag.y0;
    if (!drag.moved && Math.hypot(dx, dy) > 12) {
      drag.moved = true;
      item.classList.add('dragging');
      item.classList.remove('back');
    }
    if (drag.moved) {
      item.style.transform = 'translate(' + dx + 'px,' + dy + 'px) rotate(' + (dx / 25) + 'deg)';
      clearBins();
      const b = binAt(e.clientX, e.clientY);
      if (b) b.classList.add('over');
    }
  });
  const end = (e, dropped) => {
    if (!drag) return;
    const moved = drag.moved;
    drag = null;
    if (!moved) {
      /* 누르기 : 골라진 상태 */
      if (busy) return;
      selected = !selected;
      item.classList.toggle('on', selected);
      PK.beep('tap');
      say(selected ? '골랐어요. 맞는 통을 눌러요' : '');
      if (!selected) say(order[idx].name + ' 이에요. 어느 통에 넣을까요?');
      return;
    }
    clearBins();
    const b = dropped ? binAt(e.clientX, e.clientY) : null;
    if (b) { judge(b); }
    else {
      /* 통 밖에 놓았어요 : 제자리로 돌아가요 */
      item.classList.remove('dragging');
      item.classList.add('back');
      item.style.transform = '';
    }
  };
  item.addEventListener('pointerup', e => end(e, true));
  item.addEventListener('pointercancel', e => end(e, false));
}

/* 분리수거함을 누르는 방법 (쓰레기를 먼저 골랐을 때) */
function setupBins() {
  document.querySelectorAll('.bin').forEach(b => {
    b.addEventListener('click', () => {
      if (busy || idx >= order.length) return;
      if (!selected) { say('먼저 쓰레기를 눌러 골라요'); PK.beep('hint'); return; }
      judge(b);
    });
  });
}

function startGame() {
  order = shuffle(ITEMS.slice());
  idx = 0;
  showItem();
}

function finish() {
  busy = true;
  clearBins();
  $('item').classList.add('gone');
  $('progress').textContent = order.length + ' / ' + order.length;
  PK.beep('win');
  PK.confetti(70);
  PK.cheer('♻️', '분리수거 완료!', 1800);
  say('모든 쓰레기를 알맞은 통에 넣었어요. 잘했어요!');
  setTimeout(() => { $('done').hidden = false; }, 1600);
}

/* 설정 */
PK.bindOpts([['optSound', 'sound'], ['optVoice', 'voice']], cfg, 'recycle');
$('btnSet').addEventListener('click', () => { $('setSheet').hidden = false; });
$('btnClose').addEventListener('click', () => { $('setSheet').hidden = true; });
$('btnRestart').addEventListener('click', () => { $('setSheet').hidden = true; location.reload(); });

$('btnStart').addEventListener('click', () => {
  $('intro').hidden = true;
  startGame();
});
$('btnAgain').addEventListener('click', () => {
  $('done').hidden = true;
  startGame();
});
document.addEventListener('keydown', e => {
  if (e.repeat) return;
  if ((e.code === 'Space' || e.code === 'Enter') && !$('intro').hidden) { e.preventDefault(); $('btnStart').click(); }
});

setupItem();
setupBins();
$('progress').textContent = '0 / ' + ITEMS.length;
PK.tell('쓰레기를 보고 맞는 통에 넣어요');
