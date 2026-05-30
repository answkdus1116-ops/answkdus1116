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

// 4. 이벤트 핸들러 수정
function handleInteraction(e) {
    // 마우스나 터치 위치 계산
    const x = e.touches ? e.touches[0].clientX : e.clientX;
    const y = e.touches ? e.touches[0].clientY : e.clientY;
    
    // 입자 생성 개수를 살짝 늘려(6개) 더 풍성하게 만듭니다.
    for (let i = 0; i < 6; i++) {
        particles.push(new Particle(x, y));
    }
    
    // 소리는 너무 자주 나면 시끄러울 수 있으니 적절히 조절됩니다.
    if (Math.random() > 0.8) playSoftTone(); 
}

// [중요] 마우스 드래그 지원
canvas.addEventListener('mousedown', (e) => {
    handleInteraction(e);
    // 마우스를 누른 상태에서 움직일 때만 handleInteraction 실행
    const onMouseMove = (moveEvent) => handleInteraction(moveEvent);
    
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', () => {
        window.removeEventListener('mousemove', onMouseMove);
    }, { once: true });
});

// [중요] 터치 드래그(문지르기) 지원
canvas.addEventListener('touchstart', (e) => {
    e.preventDefault(); // 스크롤 방지
    handleInteraction(e);
}, { passive: false });

canvas.addEventListener('touchmove', (e) => {
    e.preventDefault(); // 스크롤 및 화면 흔들림 방지
    handleInteraction(e);
}, { passive: false });

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