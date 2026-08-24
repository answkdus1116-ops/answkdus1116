/* 🥌 교실 컬링 — 드래그로 방향·세기 조절, 미끄러짐 물리 + 스톤 충돌 + 거리 점수 */
const rink = document.getElementById('rink');
const aim = document.getElementById('aimCanvas');
const actx = aim.getContext('2d');
const target = document.getElementById('target');
const message = document.getElementById('message');
const turnOverlay = document.getElementById('turn-overlay');
const overlayText = document.getElementById('overlay-text');
const startTurnBtn = document.getElementById('start-turn-btn');
const resultOverlay = document.getElementById('result-overlay');
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

const R = 32;                 // 스톤 반지름
const THROWS_PER_PLAYER = 3;
let W = 0, H = 0, tcx = 0, tcy = 0; // 빙판 크기, 과녁 중심

let current = 1, p1 = 0, p2 = 0, p1n = 0, p2n = 0;
let stones = [];              // {el, x, y, vx, vy, player, moving, placed}
let liveStone = null;
let dragging = false, dragStart = null, dragNow = null, isThrown = false;

function layout(){
  W = rink.clientWidth; H = rink.clientHeight;
  aim.width = W; aim.height = H;
  const tr = target.getBoundingClientRect(), rr = rink.getBoundingClientRect();
  tcx = tr.left - rr.left + tr.width / 2;
  tcy = tr.top - rr.top + tr.height / 2;
  stones.forEach(place);
}
addEventListener('resize', layout);

function setActiveBox(){
  document.getElementById('box-p1').classList.toggle('active', current === 1);
  document.getElementById('box-p2').classList.toggle('active', current === 2);
}

/* 새 스톤 준비 */
function spawnLive(){
  const el = document.createElement('div');
  el.className = `stone live p${current}`;
  rink.appendChild(el);
  liveStone = { el, x: W / 2, y: H - R - 16, vx: 0, vy: 0, player: current, moving: false, placed: false };
  stones.push(liveStone);
  place(liveStone);
  isThrown = false;
}
function place(s){ s.el.style.left = (s.x - R) + 'px'; s.el.style.top = (s.y - R) + 'px'; }

/* 턴 시작 */
startTurnBtn.addEventListener('click', () => {
  if (audioCtx.state === 'suspended') audioCtx.resume();
  turnOverlay.classList.add('hidden');
  setActiveBox();
  message.innerText = (current === 1 ? '🔵 왼쪽' : '🔴 오른쪽') + ' 선수, 끌어당겼다 놓으세요!';
  spawnLive();
});

/* 드래그(포인터 통합) */
rink.addEventListener('pointerdown', e => {
  if (isThrown || !liveStone) return;
  const p = pos(e);
  if (Math.hypot(p.x - liveStone.x, p.y - liveStone.y) > R * 2.4) return; // 스톤 근처에서만
  dragging = true; dragStart = { x: liveStone.x, y: liveStone.y }; dragNow = p;
  liveStone.el.style.cursor = 'grabbing';
});
rink.addEventListener('pointermove', e => { if (dragging) dragNow = pos(e); });
addEventListener('pointerup', () => {
  if (!dragging) return;
  dragging = false;
  actx.clearRect(0, 0, W, H);
  // 당긴 반대 방향으로 발사 (아래로 당기면 위로 감)
  const dx = dragStart.x - dragNow.x, dy = dragStart.y - dragNow.y;
  const dist = Math.hypot(dx, dy);
  if (dist < 24) return;                     // 너무 짧으면 무시
  const power = Math.min(dist, 320) / 320;   // 0~1
  const speed = 6 + power * 20;
  const a = Math.atan2(dy, dx);
  liveStone.vx = Math.cos(a) * speed;
  liveStone.vy = Math.sin(a) * speed;
  liveStone.moving = true; isThrown = true;
  liveStone.el.classList.remove('live');
  playSlide();
});

function pos(e){ const r = rink.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; }

/* 물리 루프 */
function loop(){
  actx.clearRect(0, 0, W, H);

  // 조준 보조선
  if (dragging && liveStone){
    const dx = dragStart.x - dragNow.x, dy = dragStart.y - dragNow.y;
    const dist = Math.min(Math.hypot(dx, dy), 320);
    const a = Math.atan2(dy, dx);
    const ex = liveStone.x + Math.cos(a) * (60 + dist), ey = liveStone.y + Math.sin(a) * (60 + dist);
    actx.strokeStyle = current === 1 ? 'rgba(21,101,216,.7)' : 'rgba(211,47,47,.7)';
    actx.lineWidth = 5; actx.setLineDash([10, 8]); actx.lineCap = 'round';
    actx.beginPath(); actx.moveTo(liveStone.x, liveStone.y); actx.lineTo(ex, ey); actx.stroke();
    actx.setLineDash([]);
    // 화살촉
    actx.beginPath(); actx.fillStyle = actx.strokeStyle;
    actx.moveTo(ex, ey);
    actx.lineTo(ex - Math.cos(a - .4) * 16, ey - Math.sin(a - .4) * 16);
    actx.lineTo(ex - Math.cos(a + .4) * 16, ey - Math.sin(a + .4) * 16);
    actx.fill();
    // 세기 막대
    actx.fillStyle = 'rgba(0,0,0,.12)'; actx.fillRect(14, H - 24, 120, 10);
    actx.fillStyle = '#ffb703'; actx.fillRect(14, H - 24, 120 * (dist / 320), 10);
  }

  let anyMoving = false;
  for (const s of stones){
    if (!s.moving) continue;
    anyMoving = true;
    s.x += s.vx; s.y += s.vy;
    s.vx *= 0.985; s.vy *= 0.985;               // 마찰
    s.vx *= 0.999; s.vy *= 0.999;
    // 벽 충돌
    if (s.x < R){ s.x = R; s.vx = -s.vx * 0.55; }
    if (s.x > W - R){ s.x = W - R; s.vx = -s.vx * 0.55; }
    if (s.y < R){ s.y = R; s.vy = -s.vy * 0.55; }
    if (s.y > H - R){ s.y = H - R; s.vy = -s.vy * 0.55; }
    // 스톤끼리 충돌
    for (const o of stones){
      if (o === s) continue;
      const dx = o.x - s.x, dy = o.y - s.y, d = Math.hypot(dx, dy);
      if (d > 0 && d < R * 2){
        const nx = dx / d, ny = dy / d, overlap = R * 2 - d;
        s.x -= nx * overlap / 2; s.y -= ny * overlap / 2;
        o.x += nx * overlap / 2; o.y += ny * overlap / 2;
        const p = (s.vx - o.vx) * nx + (s.vy - o.vy) * ny;
        if (p > 0){
          s.vx -= p * nx; s.vy -= p * ny;
          o.vx += p * nx; o.vy += p * ny;
          o.moving = true;
          playClack();
        }
      }
    }
    if (Math.hypot(s.vx, s.vy) < 0.35){ s.vx = s.vy = 0; s.moving = false; }
    place(s);
  }

  // 모든 스톤이 멈추면 점수 정산
  if (isThrown && !anyMoving && liveStone && !liveStone.placed){
    liveStone.placed = true; liveStone.el.classList.add('placed');
    scoreTurn();
  }
  requestAnimationFrame(loop);
}
loop();
// 초기 레이아웃 (이미지/폰트 로딩 여유)
setTimeout(layout, 60); addEventListener('load', layout);

/* 점수 = 과녁 중심까지 거리 */
function scoreTurn(){
  const d = Math.hypot(liveStone.x - tcx, liveStone.y - tcy);
  let pts = 0;
  if (d < 26) pts = 100; else if (d < 58) pts = 50; else if (d < 92) pts = 20; else if (d < 118) pts = 10;
  if (current === 1){ p1 += pts; p1n++; document.getElementById('p1-score').innerText = p1; }
  else { p2 += pts; p2n++; document.getElementById('p2-score').innerText = p2; }
  message.innerText = pts > 0 ? `+${pts}점! ${pts === 100 ? '정중앙 명중! 🎯' : '좋아요!'}` : '아깝다! 다음 기회에!';
  if (pts >= 50) playDing();
  liveStone = null;
  setTimeout(nextTurn, 1100);
}

function nextTurn(){
  if (p1n >= THROWS_PER_PLAYER && p2n >= THROWS_PER_PLAYER) return showResult();
  current = current === 1 ? 2 : 1;
  // 더 적게 던진 사람에게 우선권
  if (current === 1 && p1n >= THROWS_PER_PLAYER) current = 2;
  if (current === 2 && p2n >= THROWS_PER_PLAYER) current = 1;
  overlayText.innerText = (current === 1 ? '🔵 왼쪽' : '🔴 오른쪽') + ' 선수 차례!';
  turnOverlay.classList.remove('hidden');
}

function showResult(){
  resultOverlay.classList.remove('hidden');
  let w = p1 > p2 ? '🔵 왼쪽 선수 승리! 🏆' : p2 > p1 ? '🔴 오른쪽 선수 승리! 🏆' : '무승부예요! 🤝';
  document.getElementById('winner-text').innerText = w;
  document.getElementById('final-score-text').innerText = `최종 점수  ${p1} : ${p2}`;
  [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => tone(f, 0.5, 'sine', 0.2), i * 140));
}

/* 컨트롤 */
const bgmPlayer = document.getElementById('bgm-player');
document.getElementById('play-btn').addEventListener('click', () => {
  const file = document.getElementById('bgm-select').value;
  bgmPlayer.src = './' + file; bgmPlayer.volume = 0.5;
  bgmPlayer.play()
    .then(() => document.getElementById('play-btn').innerText = '🌿 재생 중')
    .catch(() => alert(`음악 파일(${file})을 같은 폴더에서 찾을 수 없어요.`));
});
document.getElementById('reset-btn').addEventListener('click', () => location.reload());

/* 효과음 */
function tone(freq, dur, type = 'sine', vol = 0.25, slideTo){
  const osc = audioCtx.createOscillator(), g = audioCtx.createGain();
  osc.type = type; osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, audioCtx.currentTime + dur);
  g.gain.setValueAtTime(vol, audioCtx.currentTime);
  g.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + dur);
  osc.connect(g); g.connect(audioCtx.destination); osc.start(); osc.stop(audioCtx.currentTime + dur);
}
function playSlide(){ tone(200, 0.5, 'sine', 0.12, 120); }
function playClack(){ tone(320, 0.08, 'square', 0.2, 160); }
function playDing(){ tone(1046, 0.25, 'triangle', 0.25); }

setActiveBox();
