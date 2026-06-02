/* 🎈 풍선 팝팝 — 콤보 · 황금/폭탄 풍선 · 최고기록 · 내장 효과음 */
const gameArea = document.getElementById('game-area');
const canvas = document.getElementById('particleCanvas');
const ctx = canvas.getContext('2d');
const comboBanner = document.getElementById('combo-banner');
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

// 선택 배경음악(있으면 재생, 없어도 무방)
const bgm = new Audio('balloon.mp3'); bgm.loop = true; bgm.volume = 0.4;

let score = 0, timeLeft = 60, gameDuration = 60, gameSpeed = 2;
let combo = 0, lastPop = 0, running = false;
let balloons = [], particles = [];
let spawnTimer = null, timerInterval = null;
const BEST_KEY = 'balloon_best';
let best = +(localStorage.getItem(BEST_KEY) || 0);
document.getElementById('best').innerText = best;

function resize(){ canvas.width = innerWidth; canvas.height = innerHeight; }
addEventListener('resize', resize); resize();
makeClouds();

/* 시간 선택 칩 */
document.getElementById('time-chips').addEventListener('click', e => {
  const chip = e.target.closest('.chip'); if (!chip) return;
  document.querySelectorAll('#time-chips .chip').forEach(c => c.classList.remove('active'));
  chip.classList.add('active');
  gameDuration = +chip.dataset.time;
});

/* 시작 */
document.getElementById('start-btn').onclick = () => {
  gameSpeed = +document.getElementById('speed-slider').value;
  document.getElementById('setup-screen').style.display = 'none';
  if (audioCtx.state === 'suspended') audioCtx.resume();
  bgm.currentTime = 0; bgm.play().catch(() => {});
  running = true; score = 0; combo = 0; timeLeft = gameDuration;
  document.getElementById('score').innerText = 0;
  document.getElementById('time-left').innerText = timeLeft;
  startSpawning(); startTimer();
};

function startTimer(){
  timerInterval = setInterval(() => {
    if (!running) return;
    timeLeft--;
    document.getElementById('time-left').innerText = Math.max(0, timeLeft);
    if (timeLeft <= 0) endGame();
  }, 1000);
}

function startSpawning(){
  spawnBalloon();
  const interval = 1100 / (gameSpeed * 0.55);
  spawnTimer = setInterval(() => { if (running) spawnBalloon(); }, interval);
}

const COLORS = ['#FF9AA2','#FFB7B2','#FFDAC1','#E2F0CB','#B5EAD7','#9BD7FF','#C7CEFF','#FFC6FF'];
function spawnBalloon(){
  const el = document.createElement('div');
  el.className = 'balloon';
  const roll = Math.random();
  let type = 'normal', color;
  if (roll < 0.12) { type = 'gold'; el.classList.add('gold'); color = '#ffd23f'; }
  else if (roll < 0.24) { type = 'bomb'; el.classList.add('bomb'); color = '#5b6470'; }
  else { color = COLORS[(Math.random() * COLORS.length) | 0]; }

  const size = (type === 'gold' ? 80 : 100) + Math.random() * 50;
  el.style.width = size + 'px';
  el.style.height = (size * 1.3) + 'px';
  el.style.backgroundColor = color;
  const x = Math.random() * (innerWidth - size);
  el.style.left = x + 'px';
  el.style.top = innerHeight + 'px';
  gameArea.appendChild(el);

  const b = {
    el, x, y: innerHeight, size, color, type,
    vy: gameSpeed * 0.7 + Math.random() * 0.8 + (type === 'gold' ? 1.2 : 0),
    drift: (Math.random() - 0.5) * 1.2, sway: Math.random() * Math.PI * 2,
  };
  el.addEventListener('pointerdown', ev => { ev.preventDefault(); pop(b); }, { passive: false });
  balloons.push(b);
}

function pop(b){
  if (!b.alive && b.popped) return;
  b.popped = true;
  const cx = b.x + b.size / 2, cy = b.y + b.size * 0.65;

  if (b.type === 'bomb') {
    combo = 0;
    document.body.classList.add('shake');
    setTimeout(() => document.body.classList.remove('shake'), 350);
    playBomb();
    burst(cx, cy, '#888', 14);
    floatText(cx, cy, '펑!', '#ff5252');
    removeBalloon(b);
    return;
  }

  // 콤보 계산
  const now = performance.now();
  combo = (now - lastPop < 1500) ? combo + 1 : 1;
  lastPop = now;
  const mult = 1 + Math.floor((combo - 1) / 3);   // 3연속마다 배수 증가
  const base = b.type === 'gold' ? 5 : 1;
  const gained = base * mult;
  score += gained;
  document.getElementById('score').innerText = score;

  playPop(b.type === 'gold');
  burst(cx, cy, b.color, b.type === 'gold' ? 28 : 18);
  floatText(cx, cy, '+' + gained, b.type === 'gold' ? '#e0a800' : b.color);
  if (combo >= 3) showCombo(combo);
  removeBalloon(b);
}

function removeBalloon(b){ b.el.remove(); balloons = balloons.filter(x => x !== b); }

function showCombo(c){
  comboBanner.textContent = c + ' 콤보! 🔥';
  comboBanner.classList.remove('show'); void comboBanner.offsetWidth;
  comboBanner.classList.add('show');
}

function floatText(x, y, txt, color){
  const t = document.createElement('div');
  t.className = 'pop-text'; t.textContent = txt; t.style.color = color;
  t.style.left = x + 'px'; t.style.top = y + 'px';
  gameArea.appendChild(t);
  t.addEventListener('animationend', () => t.remove());
}

/* 끝 */
function endGame(){
  running = false;
  clearInterval(timerInterval); clearInterval(spawnTimer);
  bgm.pause();
  balloons.forEach(b => b.el.remove()); balloons = [];
  if (score > best) { best = score; localStorage.setItem(BEST_KEY, best); }
  document.getElementById('best').innerText = best;
  document.getElementById('final-score-val').innerText = score;
  document.getElementById('final-best-val').innerText = best;
  document.getElementById('result-overlay').classList.remove('hidden');
  playWin();
  const fx = setInterval(() => {
    if (document.getElementById('result-overlay').classList.contains('hidden')) return clearInterval(fx);
    burst(Math.random() * innerWidth, Math.random() * innerHeight * 0.6, `hsl(${Math.random()*360},85%,62%)`, 16);
  }, 280);
}

/* ===== 내장 효과음 (파일 없이 동작) ===== */
function tone(freq, dur, type = 'sine', vol = 0.25, slideTo){
  const osc = audioCtx.createOscillator(), g = audioCtx.createGain();
  osc.type = type; osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, audioCtx.currentTime + dur);
  g.gain.setValueAtTime(vol, audioCtx.currentTime);
  g.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + dur);
  osc.connect(g); g.connect(audioCtx.destination);
  osc.start(); osc.stop(audioCtx.currentTime + dur);
}
function playPop(gold){ tone(gold ? 880 : 660, 0.12, 'triangle', 0.3, gold ? 1500 : 320); }
function playBomb(){ tone(140, 0.25, 'sawtooth', 0.3, 50); }
function playWin(){ [523,659,784,1046].forEach((f,i) => setTimeout(() => tone(f,0.5,'sine',0.2), i*140)); }

/* ===== 파티클 ===== */
function burst(x, y, color, n){
  for (let i = 0; i < n; i++) particles.push({
    x, y, size: Math.random()*8+4, color,
    vx:(Math.random()-0.5)*14, vy:(Math.random()-0.5)*14, op:1, rot:Math.random()*6,
  });
}
function loop(){
  ctx.clearRect(0,0,canvas.width,canvas.height);
  // 풍선 이동
  for (const b of balloons){
    b.sway += 0.03;
    b.y -= b.vy; b.x += b.drift + Math.sin(b.sway)*0.6;
    b.el.style.top = b.y + 'px'; b.el.style.left = b.x + 'px';
    if (b.y < -260) removeBalloon(b);
  }
  // 파티클
  for (let i = particles.length-1; i>=0; i--){
    const p = particles[i];
    p.x += p.vx; p.y += p.vy; p.vy += 0.25; p.op -= 0.016; p.rot += 0.2;
    if (p.op <= 0){ particles.splice(i,1); continue; }
    ctx.globalAlpha = p.op; ctx.fillStyle = p.color;
    ctx.save(); ctx.translate(p.x,p.y); ctx.rotate(p.rot);
    ctx.fillRect(-p.size/2,-p.size/2,p.size,p.size); ctx.restore();
  }
  ctx.globalAlpha = 1;
  requestAnimationFrame(loop);
}
loop();

function makeClouds(){
  for (let i=0;i<5;i++){
    const c = document.createElement('div'); c.className='cloud';
    const s = 80+Math.random()*120;
    c.style.width=s+'px'; c.style.height=s*0.6+'px';
    c.style.top=(Math.random()*60)+'%';
    c.style.animationDuration=(24+Math.random()*26)+'s';
    c.style.animationDelay=(-Math.random()*30)+'s';
    document.body.appendChild(c);
  }
}
