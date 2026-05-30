const gameArea = document.getElementById('game-area');
const canvas = document.getElementById('particleCanvas');
const ctx = canvas.getContext('2d');
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

// --- 1. 오디오 객체 생성 ---
const popSound = new Audio('pop.mp3'); 
popSound.preload = 'auto';

const bgm = new Audio('balloon.mp3');
bgm.loop = true;      // 무한 반복 설정
bgm.volume = 0.4;    // 배경음악 볼륨 (0.0 ~ 1.0)
// -----------------------

let score = 0;
let timeLeft = 60; 
let gameSpeed = 2;
let particles = [];
let gameRunning = false;
let spawnTimer = null;
let timerInterval = null;

function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}
window.addEventListener('resize', resize);
resize();

// 2. 게임 시작 버튼 클릭
document.getElementById('start-btn').onclick = () => {
    gameSpeed = parseInt(document.getElementById('speed-slider').value);
    document.getElementById('setup-screen').style.display = 'none';
    
    if (audioCtx.state === 'suspended') audioCtx.resume();
    
    // --- 배경음악 재생 시작 ---
    bgm.currentTime = 0; // 처음부터 재생
    bgm.play().catch(e => console.log("BGM 재생 실패:", e));
    // -----------------------

    gameRunning = true;
    score = 0;
    timeLeft = 60;
    document.getElementById('score').innerText = score;
    document.getElementById('time-left').innerText = timeLeft;
    
    startSpawning();
    startTimer();
};

function startTimer() {
    const timerElement = document.getElementById('time-left');
    timerInterval = setInterval(() => {
        if (!gameRunning) return;
        timeLeft--;
        timerElement.innerText = timeLeft;

        if (timeLeft <= 0) {
            endGame();
        }
    }, 1000);
}

function startSpawning() {
    if (!gameRunning) return;
    spawnBalloon();
    setTimeout(spawnBalloon, 500);
    const interval = 1200 / (gameSpeed * 0.5);
    spawnTimer = setInterval(() => {
        if (gameRunning) spawnBalloon();
    }, interval);
}

function spawnBalloon() {
    const balloon = document.createElement('div');
    balloon.className = 'balloon';
    const colors = ['#FFADAD', '#FFD6A5', '#FDFFB6', '#CAFFBF', '#9BF6FF', '#A0C4FF', '#BDB2FF', '#FFC6FF'];
    const color = colors[Math.floor(Math.random() * colors.length)];
    const size = 100 + Math.random() * 60;
    balloon.style.width = size + 'px';
    balloon.style.height = (size * 1.3) + 'px';
    balloon.style.backgroundColor = color;
    balloon.style.left = Math.random() * (window.innerWidth - size) + 'px';
    balloon.style.top = window.innerHeight + 'px';
    balloon.style.zIndex = "10";
    balloon.style.pointerEvents = "auto";
    gameArea.appendChild(balloon);

    let posY = window.innerHeight;
    let drift = (Math.random() - 0.5) * 2;
    const animate = () => {
        if (!balloon.parentElement || !gameRunning) return;
        posY -= (gameSpeed * 0.7 + Math.random());
        const currentLeft = parseFloat(balloon.style.left);
        balloon.style.left = (currentLeft + drift) + 'px';
        balloon.style.top = posY + 'px';
        if (posY < -250) { balloon.remove(); } else { requestAnimationFrame(animate); }
    };
    requestAnimationFrame(animate);

    const handlePop = (e) => {
        e.preventDefault();
        e.stopPropagation();
        playPopSound();
        createParticles(parseFloat(balloon.style.left) + size/2, posY + size/2, color);
        score++;
        document.getElementById('score').innerText = score;
        balloon.remove();
    };
    balloon.addEventListener('mousedown', handlePop);
    balloon.addEventListener('touchstart', handlePop, { passive: false });
}

// 3. 게임 종료 처리
function endGame() {
    gameRunning = false;
    clearInterval(timerInterval);
    clearInterval(spawnTimer);

    // --- 배경음악 정지 ---
    bgm.pause();
    // -----------------------

    const balloons = document.querySelectorAll('.balloon');
    balloons.forEach(b => b.remove());
    document.getElementById('final-score-val').innerText = score;
    document.getElementById('result-overlay').classList.remove('hidden');

    playWinSound();
    const winEffect = setInterval(() => {
        if (document.getElementById('result-overlay').classList.contains('hidden')) {
            clearInterval(winEffect);
            return;
        }
        createParticles(Math.random() * window.innerWidth, Math.random() * window.innerHeight, 
                        `hsl(${Math.random() * 360}, 80%, 60%)`);
    }, 300);
}

function playPopSound() {
    const soundClone = popSound.cloneNode(); 
    soundClone.volume = 0.5;
    soundClone.play().catch(e => console.log("효과음 재생 실패:", e));
}

function playWinSound() {
    const notes = [523.25, 659.25, 783.99, 1046.50];
    notes.forEach((freq, i) => {
        setTimeout(() => {
            const osc = audioCtx.createOscillator();
            const g = audioCtx.createGain();
            osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
            g.gain.setValueAtTime(0.2, audioCtx.currentTime);
            g.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.8);
            osc.connect(g); g.connect(audioCtx.destination);
            osc.start(); osc.stop(audioCtx.currentTime + 0.8);
        }, i * 150);
    });
}

function createParticles(x, y, color) {
    for (let i = 0; i < 20; i++) {
        particles.push({
            x: x, y: y,
            size: Math.random() * 8 + 4,
            color: color,
            speedX: (Math.random() - 0.5) * 15,
            speedY: (Math.random() - 0.5) * 15,
            opacity: 1
        });
    }
}

function updateParticles() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        p.x += p.speedX; p.y += p.speedY;
        p.speedY += 0.2; p.opacity -= 0.015;
        if (p.opacity <= 0) { particles.splice(i, 1); i--; continue; }
        ctx.globalAlpha = p.opacity;
        ctx.fillStyle = p.color;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.opacity * Math.PI);
        ctx.fillRect(-p.size/2, -p.size/2, p.size, p.size);
        ctx.restore();
    }
    requestAnimationFrame(updateParticles);
}
updateParticles();