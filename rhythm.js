/* 🌟 별 잡기 — 콤보 · 난이도 · 놓침 판정 · 최고기록 · 음악 없이도 동작 */
const noteZone = document.getElementById('note-zone');
const scoreEl = document.getElementById('score');
const comboEl = document.getElementById('combo');
const bestEl = document.getElementById('best');
const feedback = document.getElementById('feedback');
const startBtn = document.getElementById('start-btn');
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

// 선택 배경음악(있으면 재생)
const bgm = new Audio('bgm_custom.mp3'); bgm.loop = false;

const DIFF = {
  slow:   { fall: 4200, spawn: 1100 },
  normal: { fall: 3400, spawn: 800 },
  fast:   { fall: 2600, spawn: 560 },
};
let diff = 'normal';
const EMOJIS = [['⭐',''],['💖','heart'],['🌙','moon'],['✨','']];

let score = 0, combo = 0, playing = false;
let notes = [], spawnAcc = 0, lastTime = 0;
const BEST_KEY = 'rhythm_best';
let best = +(localStorage.getItem(BEST_KEY) || 0);
bestEl.innerText = best;

const lineY = () => innerHeight - 130;     // 판정선 y

document.getElementById('diff-row').addEventListener('click', e => {
  const b = e.target.closest('.diff'); if (!b) return;
  document.querySelectorAll('.diff').forEach(d => d.classList.remove('active'));
  b.classList.add('active'); diff = b.dataset.d;
});

startBtn.addEventListener('click', () => {
  if (audioCtx.state === 'suspended') audioCtx.resume();
  document.getElementById('setup').style.display = 'none';
  score = 0; combo = 0; updateHud();
  notes.forEach(n => n.el.remove()); notes = [];
  spawnAcc = 0; lastTime = performance.now(); playing = true;
  bgm.currentTime = 0; bgm.play().catch(() => {});  // 없어도 무방
  requestAnimationFrame(update);
});

function update(now){
  if (!playing) return;
  const dt = Math.min(now - lastTime, 50); lastTime = now;

  // 별 생성 (음악 유무와 무관하게 타이머로 동작)
  spawnAcc += dt;
  if (spawnAcc >= DIFF[diff].spawn){ spawnAcc = 0; spawnNote(); }

  // 별 이동
  const total = innerHeight + 160;            // 위(-100)에서 아래까지
  for (let i = notes.length - 1; i >= 0; i--){
    const n = notes[i];
    n.t += dt;
    n.y = -100 + (n.t / DIFF[diff].fall) * total;
    n.el.style.transform = `translateY(${n.y}px) rotate(${n.spin}deg)`;
    n.spin += 0.6;
    if (n.y > innerHeight + 60){              // 놓침
      n.el.remove(); notes.splice(i, 1);
      if (combo > 0){ combo = 0; updateHud(); showFeedback('놓쳤다!', '#ff9aa2'); }
    }
  }
  requestAnimationFrame(update);
}

function spawnNote(){
  const [emo, cls] = EMOJIS[(Math.random() * EMOJIS.length) | 0];
  const el = document.createElement('div');
  el.className = 'note' + (cls ? ' ' + cls : '');
  el.textContent = emo;
  const x = Math.random() * (innerWidth - 110) + 20;
  el.style.left = x + 'px'; el.style.top = '0px';
  noteZone.appendChild(el);
  const n = { el, x, y: -100, t: 0, spin: 0 };
  el.addEventListener('pointerdown', ev => { ev.stopPropagation(); catchNote(n); }, { passive: true });
  notes.push(n);
}

function catchNote(n){
  if (!n.parentRemoved) {
    const dist = Math.abs((n.y + 40) - lineY());
    let pts, msg, col;
    if (dist < 70){ pts = 'perfect'; }
    else if (dist < 150){ pts = 'good'; }
    else { pts = 'early'; }

    combo++;
    let gain;
    if (pts === 'perfect'){ gain = 20 + comboBonus(); msg = ['최고!','반짝!','완벽!'][rand(3)]; col = '#fff'; }
    else if (pts === 'good'){ gain = 10 + comboBonus(); msg = ['좋아!','성공!','굿!'][rand(3)]; col = '#7CFFCB'; }
    else { gain = 5; msg = '캐치!'; col = '#9bd1ff'; }
    score += gain; updateHud(); showFeedback(msg + (combo >= 3 ? ` ${combo}콤보` : ''), col);

    playHit(pts === 'perfect');
    const r = n.el.getBoundingClientRect();
    confetti({ particleCount: pts === 'perfect' ? 70 : 40, spread: 75,
      origin: { x: (r.left + 40) / innerWidth, y: (r.top + 40) / innerHeight },
      colors: ['#ffffff','#ffeb3b','#00ffcc','#ff79c6'] });

    n.parentRemoved = true; n.el.remove();
    notes = notes.filter(x => x !== n);
  }
}
function comboBonus(){ return Math.floor(combo / 3) * 5; }
function rand(n){ return (Math.random() * n) | 0; }

// 빈 곳을 눌러도 판정선 근처의 가장 가까운 별을 잡아줌(태블릿 친화)
addEventListener('pointerdown', e => {
  if (!playing) return;
  if (e.target.closest('.note') || e.target.closest('#setup') || e.target.closest('.home-btn')) return;
  let bestN = null, bestD = 1e9;
  for (const n of notes){
    const d = Math.abs((n.y + 40) - lineY());
    if (d < 160 && d < bestD){ bestD = d; bestN = n; }
  }
  if (bestN) catchNote(bestN);
});

function updateHud(){
  scoreEl.innerText = score; comboEl.innerText = combo;
  if (score > best){ best = score; localStorage.setItem(BEST_KEY, best); bestEl.innerText = best; }
}
function showFeedback(txt, color){
  feedback.textContent = txt; feedback.style.color = color;
  feedback.classList.remove('show'); void feedback.offsetWidth; feedback.classList.add('show');
}

/* 효과음 */
function playHit(perfect){
  const osc = audioCtx.createOscillator(), g = audioCtx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(perfect ? 1046 : 784, audioCtx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(perfect ? 1568 : 440, audioCtx.currentTime + 0.12);
  g.gain.setValueAtTime(0.3, audioCtx.currentTime);
  g.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.2);
  osc.connect(g); g.connect(audioCtx.destination); osc.start(); osc.stop(audioCtx.currentTime + 0.2);
}

addEventListener('resize', () => {}); // 위치는 매 프레임 계산되므로 별도 처리 불필요
