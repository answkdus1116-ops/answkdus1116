let p1Name, p2Name, p1Img = "p1_1.png", p2Img = "p2_1.png";
let gameActive = false, bombMode = false, p1Score = 0, p2Score = 0, timeLeft = 60, bgmType = "system";

const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
const bgmAudio = document.getElementById('bgm-audio');

// 캐릭터 선택 로직
document.querySelectorAll('.char-img').forEach(img => {
    img.onclick = function() {
        const parent = this.parentElement;
        parent.querySelectorAll('.char-img').forEach(i => i.classList.remove('selected'));
        this.classList.add('selected');
        if (parent.id === 'p1-chars') p1Img = this.dataset.img;
        else p2Img = this.dataset.img;
    }
});

document.getElementById('game-start-btn').onclick = function() {
    p1Name = document.getElementById('p1-name-input').value || "학생 1";
    p2Name = document.getElementById('p2-name-input').value || "학생 2";
    bombMode = document.getElementById('bomb-toggle').checked;
    bgmType = document.querySelector('input[name="bgm-type"]:checked').value;

    document.getElementById('p1-display-name').innerText = p1Name;
    document.getElementById('p2-display-name').innerText = p2Name;
    
    if (audioCtx.state === 'suspended') audioCtx.resume();
    document.getElementById('setup-overlay').classList.add('hidden');
    startGame();
};

function startGame() {
    gameActive = true;
    p1Score = 0; p2Score = 0; timeLeft = 60;
    if (bgmType === 'mp3') bgmAudio.play().catch(() => {});
    
    // 버튼이 2개씩 생기도록 각각 두 번 호출!
    createTarget(document.getElementById('p1-zone'), 1);
    createTarget(document.getElementById('p1-zone'), 1);
    createTarget(document.getElementById('p2-zone'), 2);
    createTarget(document.getElementById('p2-zone'), 2);
    
    startTimer();
}

function createTarget(zone, player) {
    if (!gameActive) return;

    const target = document.createElement('div');
    target.className = 'target';
    
    const isBomb = bombMode && Math.random() < 0.25; // 폭탄 확률을 살짝 높였어요(25%)
    
    if (isBomb) {
        target.innerText = "💣";
        target.style.backgroundImage = "none";
        target.style.fontSize = "100px";
        target.style.display = "flex";
        target.style.justifyContent = "center";
        target.style.alignItems = "center";
        target.dataset.type = "bomb";
    } else {
        target.style.backgroundImage = `url(${player === 1 ? p1Img : p2Img})`;
        target.innerText = "";
        target.dataset.type = "normal";
    }

    const zoneW = zone.offsetWidth, zoneH = zone.offsetHeight;
    target.style.left = Math.random() * (zoneW - 130) + 'px';
    target.style.top = (160 + Math.random() * (zoneH - 300)) + 'px';

    const handleAction = (e) => {
        e.preventDefault();
        if (target.dataset.type === "bomb") {
            playExplosionSound(); // 폭탄 전용 폭발음!
            if (player === 1) p1Score = Math.max(0, p1Score - 5);
            else p2Score = Math.max(0, p2Score - 5);
        } else {
            playPopSound(player === 1 ? 500 : 700);
            if (player === 1) p1Score++; else p2Score++;
        }
        document.getElementById('p1-score').innerText = p1Score;
        document.getElementById('p2-score').innerText = p2Score;
        target.remove();
        createTarget(zone, player);
    };

    target.addEventListener('touchstart', handleAction);
    target.addEventListener('mousedown', handleAction);
    zone.appendChild(target);

    // 폭탄은 더 빨리 사라지게 해서 난이도를 조절했습니다.
    setTimeout(() => { 
        if (target.parentNode) { target.remove(); createTarget(zone, player); }
    }, isBomb ? 1000 : 1800);
}

// 일반 터치음 (뾱)
function playPopSound(freq) {
    const osc = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    osc.frequency.value = freq;
    g.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.2);
    osc.connect(g); g.connect(audioCtx.destination);
    osc.start(); osc.stop(audioCtx.currentTime + 0.2);
}

// 폭탄 폭발음 (콰광!)
function playExplosionSound() {
    const osc = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    
    osc.type = 'sawtooth'; // 거친 소리를 위해 톱니파 사용
    osc.frequency.setValueAtTime(150, audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(40, audioCtx.currentTime + 0.3); // 주파수 급하락
    
    g.gain.setValueAtTime(0.3, audioCtx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.5);
    
    osc.connect(g);
    g.connect(audioCtx.destination);
    
    osc.start();
    osc.stop(audioCtx.currentTime + 0.5);
}

function startTimer() {
    const timer = setInterval(() => {
        if (!gameActive) { clearInterval(timer); return; }
        timeLeft--;
        document.getElementById('time-text').innerText = `남은 시간: ${timeLeft}`;
        if (timeLeft <= 0) endGame();
    }, 1000);
}

function endGame() {
    gameActive = false;
    bgmAudio.pause();
    document.getElementById('result-overlay').classList.remove('hidden');
    document.getElementById('winner-text').innerText = p1Score > p2Score ? `${p1Name} 승리! 🏆` : (p2Score > p1Score ? `${p2Name} 승리! 🏆` : "무승부! 🤝");
}