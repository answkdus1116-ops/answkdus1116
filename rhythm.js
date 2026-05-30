const noteZone = document.getElementById('note-zone');
const scoreElement = document.getElementById('score');
const startBtn = document.getElementById('start-btn');
const feedback = document.getElementById('feedback');
const container = document.getElementById('game-container');

// 🎵 오디오 객체
const bgm = new Audio('bgm_custom.mp3');
let score = 0;
let isPlaying = false;
let lastSpawnTime = 0;

// ⚙️ 설정값 (여기서 난이도를 조절하세요)
const FALL_DURATION = 3500; // 별이 내려오는 시간 (3.5초)
const SPAWN_INTERVAL = 0.8;  // 별이 나오는 간격 (0.8초마다 하나씩)

// 🔊 효과음 생성 (Web Audio API)
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
function playHitSound() {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(440, audioCtx.currentTime + 0.1);
    gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.2);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.2);
}

startBtn.addEventListener('click', () => {
    if (audioCtx.state === 'suspended') audioCtx.resume();
    
    startBtn.style.display = 'none';
    isPlaying = true;
    score = 0;
    scoreElement.innerText = score;
    lastSpawnTime = 0; // 초기화
    
    bgm.currentTime = 0;
    bgm.play();
    update();
});

function update() {
    if (!isPlaying) return;

    const currentTime = bgm.currentTime;

    // 💡 [핵심] 음악 재생 시간에 맞춰 일정 간격으로 별 생성 (2분 12초 내내 작동)
    if (currentTime - lastSpawnTime >= SPAWN_INTERVAL) {
        createNote();
        lastSpawnTime = currentTime;
    }

    // 음악이 끝나면 (2분 12초 후)
    if (bgm.ended) {
        isPlaying = false;
        startBtn.innerText = "대단해요! 다시 할까요? 👏";
        startBtn.style.display = 'block';
    } else {
        requestAnimationFrame(update);
    }
}

function createNote() {
    const note = document.createElement('div');
    note.className = 'note';
    note.innerHTML = '⭐';
    // 별이 겹치지 않게 가로 위치 랜덤 조절
    note.style.left = `${Math.random() * (window.innerWidth - 120) + 60}px`;
    note.style.top = '-100px';
    noteZone.appendChild(note);

    const ani = note.animate([
        { transform: 'translateY(0px)', opacity: 1 },
        { transform: `translateY(${window.innerHeight + 100}px)`, opacity: 0.8 }
    ], { duration: FALL_DURATION, easing: 'linear' });

    ani.onfinish = () => note.remove();
}

// 판정 로직
const handleInput = () => {
    if (!isPlaying) return;
    const notes = document.querySelectorAll('.note');
    notes.forEach(note => {
        const rect = note.getBoundingClientRect();
        // 판정선 근처에 별이 있을 때
        if (rect.top > window.innerHeight - 350 && rect.top < window.innerHeight - 50) {
            playHitSound();
            score += 10;
            scoreElement.innerText = score;
            
            confetti({
                particleCount: 60, spread: 80,
                origin: { x: rect.left / window.innerWidth, y: rect.top / window.innerHeight },
                colors: ['#ffffff', '#ffeb3b', '#00ffcc']
            });

            feedback.style.display = 'block';
            feedback.innerText = ["최고!", "성공!", "우와!", "반짝!"][Math.floor(Math.random() * 4)];
            setTimeout(() => { feedback.style.display = 'none'; }, 600);

            note.remove();
        }
    });
};

window.addEventListener('pointerdown', handleInput);
window.addEventListener('keydown', (e) => { if(e.code === 'Space') handleInput(); });