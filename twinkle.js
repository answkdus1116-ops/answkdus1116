const canvas = document.getElementById('twinkleCanvas');
const ctx = canvas.getContext('2d');
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

let particles = [];
let currentTheme = 'rainbow';

function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}
window.addEventListener('resize', resize);
resize();

// 테마 변경 함수
function changeTheme(theme, el) {
    currentTheme = theme;
    document.querySelectorAll('.color-btn').forEach(btn => btn.classList.remove('active'));
    el.classList.add('active');
}

class Particle {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.size = Math.random() * 15 + 5;
        this.speedX = (Math.random() - 0.5) * 5;
        this.speedY = (Math.random() - 0.5) * 5;
        this.opacity = 1;
        this.color = this.getColor();
    }

    // 테마별 색상 반환 로직
    getColor() {
        let h;
        if (currentTheme === 'rainbow') h = Math.random() * 360;
        else if (currentTheme === 'blue') h = 180 + Math.random() * 60;  // 파랑~하늘
        else if (currentTheme === 'pink') h = 300 + Math.random() * 60;  // 핑크~보라
        else if (currentTheme === 'green') h = 80 + Math.random() * 60;  // 연두~초록
        return `hsl(${h}, 80%, 70%)`;
    }

    update() {
        this.x += this.speedX;
        this.y += this.speedY;
        this.opacity -= 0.015;
    }

    draw() {
        ctx.save();
        ctx.globalAlpha = this.opacity;
        ctx.fillStyle = this.color;
        ctx.shadowBlur = 15;
        ctx.shadowColor = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }
}

// (playSoftTone, handleInteraction, animate 함수는 이전과 동일)
function playSoftTone() {
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const osc = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    const scale = [261.63, 293.66, 329.63, 392.00, 440.00];
    osc.frequency.value = scale[Math.floor(Math.random() * scale.length)];
    osc.type = 'sine';
    g.gain.setValueAtTime(0.1, audioCtx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 1.5);
    osc.connect(g); g.connect(audioCtx.destination);
    osc.start(); osc.stop(audioCtx.currentTime + 1.5);
}

// ... (기존 Particle 클래스 및 playSoftTone 함수는 동일) ...

// 4. 이벤트 핸들러 — 멀티터치(여러 명 동시) + 드래그 지원
//    Pointer Events는 손가락/마우스마다 고유 pointerId로 들어오므로
//    여러 접점을 동시에 추적하면 2인 이상이 함께 그릴 수 있습니다.
const activePointers = new Set();

function spawnAt(x, y) {
    // 접점 하나당 입자 6개로 풍성하게
    for (let i = 0; i < 6; i++) {
        particles.push(new Particle(x, y));
    }
    // 소리는 너무 자주 나면 시끄러우니 가끔만
    if (Math.random() > 0.8) playSoftTone();
}

canvas.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    activePointers.add(e.pointerId);
    spawnAt(e.clientX, e.clientY);
}, { passive: false });

canvas.addEventListener('pointermove', (e) => {
    if (!activePointers.has(e.pointerId)) return;  // 누르고 있는 접점만 그림
    e.preventDefault();
    // 빠르게 문질러도 끊기지 않도록 중간 좌표까지 보간 처리
    const evs = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
    for (const ev of evs) spawnAt(ev.clientX, ev.clientY);
}, { passive: false });

function releasePointer(e) { activePointers.delete(e.pointerId); }
canvas.addEventListener('pointerup', releasePointer);
canvas.addEventListener('pointercancel', releasePointer);
// 캔버스 밖에서 손을 떼도 정리되도록 window에도 등록
window.addEventListener('pointerup', releasePointer);
window.addEventListener('pointercancel', releasePointer);

// 5. 애니메이션 루프 (이전과 동일)
function animate() {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.15)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    for (let i = 0; i < particles.length; i++) {
        particles[i].update();
        particles[i].draw();
        if (particles[i].opacity <= 0) { particles.splice(i, 1); i--; }
    }
    requestAnimationFrame(animate);
}
animate();