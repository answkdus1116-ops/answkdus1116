/* ============================================================
   🦋 자연쌤의 여름 나비 꽃밭
   - '곤충 넣기' 로 올린 사진 → 꽃밭을 훨훨 날아다님(누르면 빙글 춤)
   - '꽃·수박 넣기' 로 올린 사진 → 제자리에 가만히, 누르면 살랑살랑 흔들림
   - 어떤 친구든 톡 누르면: 반짝이 + 소리 + 칭찬 목소리
   - 빈 곳을 눌러도 반짝이가 톡톡 (누구나 성공하는 원인-결과 놀이)
   ============================================================ */

const canvas = document.getElementById('gardenCanvas');
const ctx = canvas.getContext('2d', { willReadFrequently: true });
const bgm = document.getElementById('bgm');
const video = document.getElementById('video');
const camModal = document.getElementById('cameraModal');

let creatures = [];       // 화면 위 친구들
let sparkles = [];        // 반짝이 파티클
let voiceOn = true;       // 칭찬 목소리 켜짐 여부
let audioCtx = null;      // 효과음용 Web Audio
let pendingType = 'fly';  // 다음에 올릴 친구 종류: 'fly'(곤충) | 'stay'(꽃·수박)

/* ---------- 화면 크기 ---------- */
function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    initClouds(); initMotes();
}
window.addEventListener('resize', resize);

/* ============================================================
   배경(여름 꽃밭)을 캔버스에 직접 그림 → 별도 배경 이미지 파일 불필요
   ============================================================ */
let clouds = [], flowers = [], motes = [];

function initClouds() {
    clouds = [];
    for (let i = 0; i < 4; i++) {
        clouds.push({
            x: Math.random() * canvas.width,
            y: 50 + Math.random() * canvas.height * 0.32,
            s: 0.7 + Math.random() * 0.8,
            sp: 0.12 + Math.random() * 0.22
        });
    }
}
function initFlowers() {
    flowers = [
        { fx: 0.09, sc: 1.0 }, { fx: 0.27, sc: 0.8 }, { fx: 0.5, sc: 1.05 },
        { fx: 0.72, sc: 0.85 }, { fx: 0.9, sc: 0.95 }
    ];
}
function initMotes() {
    motes = [];
    for (let i = 0; i < 16; i++) {
        motes.push({
            x: Math.random() * canvas.width, y: Math.random() * canvas.height,
            r: 1.5 + Math.random() * 2.5, sp: 0.3 + Math.random() * 0.5, ph: Math.random() * 6
        });
    }
}

function drawSky() {
    const g = ctx.createLinearGradient(0, 0, 0, canvas.height);
    g.addColorStop(0, '#4fc3f7'); g.addColorStop(0.5, '#81d4fa'); g.addColorStop(1, '#e1f5fe');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
}
function drawSun(t) {
    const x = canvas.width - 90, y = 90, r = 52 + Math.sin(t * 1.5) * 3;
    const glow = ctx.createRadialGradient(x, y, 10, x, y, r * 2.4);
    glow.addColorStop(0, 'rgba(255,236,150,0.9)'); glow.addColorStop(1, 'rgba(255,236,150,0)');
    ctx.fillStyle = glow;
    ctx.beginPath(); ctx.arc(x, y, r * 2.4, 0, Math.PI * 2); ctx.fill();
    ctx.save(); ctx.translate(x, y); ctx.rotate(t * 0.2);
    ctx.strokeStyle = 'rgba(255,213,79,0.85)'; ctx.lineWidth = 5;
    for (let i = 0; i < 12; i++) { ctx.rotate(Math.PI / 6); ctx.beginPath(); ctx.moveTo(r + 8, 0); ctx.lineTo(r + 26, 0); ctx.stroke(); }
    ctx.restore();
    ctx.fillStyle = '#ffd54f';
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
}
function drawClouds() {
    ctx.fillStyle = 'rgba(255,255,255,0.92)';
    clouds.forEach(c => {
        c.x += c.sp;
        if (c.x - 120 * c.s > canvas.width) c.x = -120 * c.s;
        const { x, y, s } = c;
        ctx.beginPath();
        ctx.arc(x, y, 26 * s, 0, Math.PI * 2);
        ctx.arc(x + 30 * s, y + 8 * s, 32 * s, 0, Math.PI * 2);
        ctx.arc(x + 66 * s, y, 24 * s, 0, Math.PI * 2);
        ctx.arc(x + 34 * s, y - 14 * s, 26 * s, 0, Math.PI * 2);
        ctx.fill();
    });
}
function drawMotes(t) {
    ctx.fillStyle = 'rgba(255,245,180,0.8)';
    motes.forEach(m => {
        m.y -= m.sp; m.x += Math.sin(t + m.ph) * 0.3;
        if (m.y < -5) { m.y = canvas.height + 5; m.x = Math.random() * canvas.width; }
        ctx.globalAlpha = 0.4 + Math.abs(Math.sin(t * 2 + m.ph)) * 0.4;
        ctx.beginPath(); ctx.arc(m.x, m.y, m.r, 0, Math.PI * 2); ctx.fill();
    });
    ctx.globalAlpha = 1;
}
function grassTop() { return canvas.height - Math.max(90, canvas.height * 0.16); }
function drawGrass(t) {
    const top = grassTop();
    const grad = ctx.createLinearGradient(0, top, 0, canvas.height);
    grad.addColorStop(0, '#9ccc65'); grad.addColorStop(1, '#558b2f');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(0, top + 12);
    for (let x = 0; x <= canvas.width; x += 40) {
        ctx.quadraticCurveTo(x + 20, top + Math.sin((x + t * 30) / 60) * 6, x + 40, top + 12);
    }
    ctx.lineTo(canvas.width, canvas.height); ctx.lineTo(0, canvas.height);
    ctx.closePath(); ctx.fill();
}
function drawFlowers(t) {
    const baseY = grassTop() + 14;
    flowers.forEach((f, i) => {
        const x = f.fx * canvas.width;
        const sway = Math.sin(t * 1.3 + i) * 0.08;
        ctx.save(); ctx.translate(x, baseY); ctx.rotate(sway);
        const H = 72 * f.sc;
        ctx.strokeStyle = '#4c8c2b'; ctx.lineWidth = 6 * f.sc;
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -H); ctx.stroke();
        ctx.fillStyle = '#6aa84f';
        ctx.beginPath(); ctx.ellipse(-11 * f.sc, -H * 0.5, 14 * f.sc, 7 * f.sc, -0.5, 0, Math.PI * 2); ctx.fill();
        ctx.translate(0, -H);
        const R = 22 * f.sc;
        ctx.fillStyle = '#ffca28';
        for (let a = 0; a < 12; a++) {
            ctx.save(); ctx.rotate(a * Math.PI / 6);
            ctx.beginPath(); ctx.ellipse(0, -R - 6 * f.sc, 7 * f.sc, 13 * f.sc, 0, 0, Math.PI * 2); ctx.fill();
            ctx.restore();
        }
        ctx.fillStyle = '#7b4b1e';
        ctx.beginPath(); ctx.arc(0, 0, R * 0.8, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
    });
}

/* ============================================================
   친구 클래스
   - kind 'fly'  : 나비처럼 팔랑팔랑 날아다님, 누르면 빙글 춤
   - kind 'stay' : 꽃밭에 심긴 듯 제자리, 누르면 살랑살랑 흔들림
   ============================================================ */
const CELEB = 45; // 곤충 춤 프레임 수
const SWAYT = 90; // 꽃·수박 흔들림 프레임 수
class Creature {
    constructor(img, kind) {
        this.img = img;
        this.kind = kind || 'fly';
        const iw = img.width || img.naturalWidth || 120;
        const ih = img.height || img.naturalHeight || 120;
        const target = 110 + Math.random() * 70;
        const sc = target / Math.max(iw, ih);
        this.w = iw * sc; this.h = ih * sc;
        this.phase = Math.random() * Math.PI * 2;

        if (this.kind === 'fly') {
            this.x = Math.random() * Math.max(1, canvas.width - this.w);
            this.y = Math.random() * (canvas.height * 0.55);
            this.angle = Math.random() * Math.PI * 2;
            this.baseSpeed = 0.8 + Math.random() * 0.8;
            this.celebrateT = 0;
            this.spinDir = 1;
        } else {
            // 꽃밭 아래쪽(잔디 근처)에 심긴 듯 배치
            const margin = 30;
            this.x = margin + Math.random() * Math.max(1, canvas.width - this.w - margin * 2);
            const gy = grassTop();
            this.y = gy - this.h * (0.55 + Math.random() * 0.3);
            this.swayT = 0;
        }
    }
    react() {
        if (this.kind === 'fly') { this.celebrateT = CELEB; this.spinDir = Math.random() < 0.5 ? 1 : -1; }
        else { this.swayT = SWAYT; }
    }
    update() {
        if (this.kind === 'fly') {
            if (this.celebrateT > 0) this.celebrateT--;
            this.angle += (Math.random() - 0.5) * 0.3;
            const sp = this.baseSpeed * (this.celebrateT > 0 ? 2.4 : 1);
            this.x += Math.cos(this.angle) * sp;
            this.y += Math.sin(this.angle) * sp * 0.6;
            const maxY = grassTop() - this.h * 0.3;
            if (this.x < 0) { this.x = 0; this.angle = Math.PI - this.angle; }
            if (this.x + this.w > canvas.width) { this.x = canvas.width - this.w; this.angle = Math.PI - this.angle; }
            if (this.y < 0) { this.y = 0; this.angle = -this.angle; }
            if (this.y > maxY) { this.y = maxY; this.angle = -this.angle; }
        } else {
            if (this.swayT > 0) this.swayT--;
        }
    }
    draw() {
        const t = performance.now() / 1000;
        if (this.kind === 'fly') {
            const bob = Math.sin(t * 2 + this.phase) * 7;
            const flap = 0.75 + Math.abs(Math.sin(t * 9 + this.phase)) * 0.25;
            const cx = this.x + this.w / 2, cy = this.y + this.h / 2 + bob;
            ctx.save();
            ctx.translate(cx, cy);
            let rot = 0, pop = 1;
            if (this.celebrateT > 0) {
                const p = this.celebrateT / CELEB;
                rot = (1 - p) * Math.PI * 2 * this.spinDir;
                pop = 1 + Math.sin(p * Math.PI) * 0.3;
            }
            ctx.rotate(rot);
            const dir = Math.cos(this.angle) < 0 ? -1 : 1;
            ctx.scale(dir * flap * pop, pop);
            ctx.drawImage(this.img, -this.w / 2, -this.h / 2, this.w, this.h);
            ctx.restore();
        } else {
            // 아래쪽(밑동)을 축으로 살랑살랑 기울어짐
            let ang = 0;
            if (this.swayT > 0) {
                const k = this.swayT / SWAYT;         // 1 → 0 으로 서서히 잦아듦
                ang = Math.sin(t * 12 + this.phase) * 0.26 * k;
            }
            const cx = this.x + this.w / 2, bottom = this.y + this.h;
            ctx.save();
            ctx.translate(cx, bottom);
            ctx.rotate(ang);
            ctx.drawImage(this.img, -this.w / 2, -this.h, this.w, this.h);
            ctx.restore();
        }
    }
}

/* ---------- 샘플 (입장하면 바로 놀 수 있게) ---------- */
function makeSampleButterfly(color) {
    const c = document.createElement('canvas'); c.width = 140; c.height = 120;
    const g = c.getContext('2d');
    g.strokeStyle = 'rgba(0,0,0,0.15)'; g.lineWidth = 2; g.fillStyle = color;
    const wing = (x, y, rx, ry) => { g.beginPath(); g.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); g.fill(); g.stroke(); };
    wing(45, 42, 32, 26); wing(95, 42, 32, 26); wing(50, 82, 26, 22); wing(90, 82, 26, 22);
    g.fillStyle = 'rgba(255,255,255,0.75)';
    [[45, 42], [95, 42]].forEach(([x, y]) => { g.beginPath(); g.arc(x, y, 7, 0, Math.PI * 2); g.fill(); });
    g.fillStyle = '#5b3a29';
    g.beginPath(); g.ellipse(70, 62, 7, 34, 0, 0, Math.PI * 2); g.fill();
    g.strokeStyle = '#5b3a29'; g.lineWidth = 2.5;
    g.beginPath(); g.moveTo(70, 30); g.quadraticCurveTo(60, 14, 52, 12);
    g.moveTo(70, 30); g.quadraticCurveTo(80, 14, 88, 12); g.stroke();
    return c;
}
function makeSampleFlower() {
    const c = document.createElement('canvas'); c.width = 120; c.height = 150;
    const g = c.getContext('2d');
    // 줄기
    g.strokeStyle = '#4c8c2b'; g.lineWidth = 7;
    g.beginPath(); g.moveTo(60, 150); g.lineTo(60, 70); g.stroke();
    g.fillStyle = '#6aa84f';
    g.beginPath(); g.ellipse(44, 108, 16, 8, -0.5, 0, Math.PI * 2); g.fill();
    // 꽃잎(데이지)
    g.fillStyle = '#ff9ac1';
    for (let a = 0; a < 8; a++) {
        g.save(); g.translate(60, 48); g.rotate(a * Math.PI / 4);
        g.beginPath(); g.ellipse(0, -26, 11, 20, 0, 0, Math.PI * 2); g.fill();
        g.restore();
    }
    g.fillStyle = '#ffd54f';
    g.beginPath(); g.arc(60, 48, 15, 0, Math.PI * 2); g.fill();
    return c;
}

/* ============================================================
   반짝이 파티클
   ============================================================ */
const SPARK_SET = ['✨', '⭐', '🌸', '💛', '🌟', '🦋'];
function spawnSparkles(x, y, n) {
    for (let i = 0; i < n; i++) {
        sparkles.push({
            x, y,
            vx: (Math.random() - 0.5) * 7,
            vy: (Math.random() - 0.5) * 5 - 3,
            life: 1, rot: Math.random() * 6, vr: (Math.random() - 0.5) * 0.3,
            size: 16 + Math.random() * 16, emoji: SPARK_SET[Math.floor(Math.random() * SPARK_SET.length)]
        });
    }
    if (sparkles.length > 240) sparkles.splice(0, sparkles.length - 240);
}
function updateSparkles() {
    for (let i = sparkles.length - 1; i >= 0; i--) {
        const s = sparkles[i];
        s.x += s.vx; s.y += s.vy; s.vy += 0.15; s.vx *= 0.98; s.rot += s.vr; s.life -= 0.02;
        if (s.life <= 0) { sparkles.splice(i, 1); continue; }
        ctx.save();
        ctx.globalAlpha = Math.max(0, s.life);
        ctx.translate(s.x, s.y); ctx.rotate(s.rot);
        ctx.font = s.size + 'px serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(s.emoji, 0, 0);
        ctx.restore();
    }
    ctx.globalAlpha = 1;
}

/* ============================================================
   소리 (효과음: 코드로 생성 → 파일 불필요)
   ============================================================ */
function ensureAudio() {
    if (!audioCtx) {
        try { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) {}
    }
    if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
}
function tone(freq, start, dur, type, gain) {
    if (!audioCtx) return;
    const o = audioCtx.createOscillator(), g = audioCtx.createGain();
    o.type = type; o.frequency.value = freq;
    o.connect(g); g.connect(audioCtx.destination);
    const t0 = audioCtx.currentTime + start;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(gain, t0 + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.start(t0); o.stop(t0 + dur + 0.05);
}
function playChime() { ensureAudio(); [523.25, 659.25, 783.99].forEach((f, i) => tone(f, i * 0.08, 0.5, 'triangle', 0.18)); }
function playPop() { ensureAudio(); tone(880, 0, 0.18, 'sine', 0.12); }

/* ---------- 칭찬 목소리 (브라우저 내장 TTS · 무료) ---------- */
const PRAISE_FLY = ['우와, 예뻐요!', '나비가 춤을 춰요!', '반짝반짝!', '훨훨 날아요!', '우리 친구 멋져요!', '와, 신난다!'];
const PRAISE_STAY = ['예쁘게 폈어요!', '살랑살랑~', '향기가 나요!', '반짝반짝!', '와, 예뻐요!', '흔들흔들!'];
function speak(text) {
    if (!voiceOn || !('speechSynthesis' in window)) return;
    try {
        speechSynthesis.cancel();
        const u = new SpeechSynthesisUtterance(text);
        u.lang = 'ko-KR'; u.rate = 1; u.pitch = 1.2;
        speechSynthesis.speak(u);
    } catch (e) {}
}
function praiseFor(kind) {
    const arr = kind === 'fly' ? PRAISE_FLY : PRAISE_STAY;
    return arr[Math.floor(Math.random() * arr.length)];
}

/* ============================================================
   사진 처리 (AI 배경 제거 + 실패 시 기본 방식 + 하얀 스티커 테두리)
   ============================================================ */
async function processImage(dataUrl, kind) {
    showLoading(true, 'AI가 그림을 오려내고 있어요! (약 5~10초)');
    try {
        const config = {
            publicPath: 'https://cdn.jsdelivr.net/npm/@imgly/background-removal@1.4.5/dist/',
            debug: false,
            device: 'cpu'
        };
        const blob = await imglyRemoveBackground(dataUrl, config);
        if (window.lastUrl) URL.revokeObjectURL(window.lastUrl);
        const url = URL.createObjectURL(blob);
        window.lastUrl = url;
        const img = new Image();
        img.onload = () => {
            addCreature(makeSticker(img), kind);
            showLoading(false);
            playChime();
            speak(kind === 'fly' ? '곤충 친구가 왔어요!' : '꽃이 피었어요!');
        };
        img.src = url;
    } catch (err) {
        console.error('배경 제거 에러:', err);
        showLoading(false);
        alert('AI가 바빠서 일단 기본 방식으로 친구를 만들게요!');
        addFallbackCreature(dataUrl, kind);
    }
}

function addFallbackCreature(src, kind) {
    const tmp = new Image();
    tmp.onload = () => {
        const c = document.createElement('canvas');
        c.width = tmp.width; c.height = tmp.height;
        const t = c.getContext('2d', { willReadFrequently: true });
        t.drawImage(tmp, 0, 0);
        const d = t.getImageData(0, 0, c.width, c.height);
        for (let i = 0; i < d.data.length; i += 4) {
            if (d.data[i] > 180 && d.data[i + 1] > 180 && d.data[i + 2] > 180) d.data[i + 3] = 0;
        }
        t.putImageData(d, 0, 0);
        const finished = new Image();
        finished.onload = () => addCreature(makeSticker(finished), kind);
        finished.src = c.toDataURL();
    };
    tmp.src = src;
}

function makeSticker(src) {
    const w = src.width || src.naturalWidth, h = src.height || src.naturalHeight;
    if (!w || !h) return src;
    const pad = Math.max(4, Math.round(Math.min(w, h) * 0.03));
    const sil = document.createElement('canvas'); sil.width = w; sil.height = h;
    const s = sil.getContext('2d');
    s.drawImage(src, 0, 0, w, h);
    s.globalCompositeOperation = 'source-in';
    s.fillStyle = '#ffffff'; s.fillRect(0, 0, w, h);
    const out = document.createElement('canvas'); out.width = w + pad * 2; out.height = h + pad * 2;
    const o = out.getContext('2d');
    for (let a = 0; a < Math.PI * 2; a += Math.PI / 10) {
        o.drawImage(sil, pad + Math.cos(a) * pad, pad + Math.sin(a) * pad, w, h);
    }
    o.drawImage(src, pad, pad, w, h);
    return out;
}

function addCreature(imgOrCanvas, kind) {
    creatures.push(new Creature(imgOrCanvas, kind));
    if (creatures.length > 40) creatures.shift();
}

/* ============================================================
   올리기: 종류 선택 → 촬영/앨범
   ============================================================ */
function chooseAdd(type) {
    pendingType = type;
    document.getElementById('addChoiceTitle').innerText = (type === 'fly') ? '🦋 곤충 넣기' : '🌻 꽃·수박 넣기';
    document.getElementById('addChoice').classList.add('show');
}
function closeAddChoice() { document.getElementById('addChoice').classList.remove('show'); }
function addByCamera() { closeAddChoice(); openCamera(); }
function addByFile() { closeAddChoice(); document.getElementById('fileInput').click(); }

/* ============================================================
   카메라 / 파일
   ============================================================ */
async function openCamera() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
        video.srcObject = stream;
        camModal.style.display = 'flex';
    } catch (err) {
        alert('카메라를 켤 수 없어요! 브라우저 설정에서 카메라 권한을 확인해 주세요.');
    }
}
function takeSnapshot() {
    const cc = document.getElementById('captureCanvas');
    cc.width = video.videoWidth; cc.height = video.videoHeight;
    cc.getContext('2d').drawImage(video, 0, 0);
    const type = pendingType;
    closeCamera();
    processImage(cc.toDataURL('image/jpeg'), type);
}
function closeCamera() {
    if (video.srcObject) video.srcObject.getTracks().forEach(t => t.stop());
    camModal.style.display = 'none';
}
function handleFileUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    const type = pendingType;
    const reader = new FileReader();
    reader.onload = (e) => processImage(e.target.result, type);
    reader.readAsDataURL(file);
    event.target.value = '';
}

/* ============================================================
   UI 기능
   ============================================================ */
function showLoading(show, msg) {
    const el = document.getElementById('customAlert');
    if (msg) document.getElementById('alertMessage').innerText = msg;
    el.classList.toggle('show', show);
}
function startApp() {
    document.getElementById('entryOverlay').style.display = 'none';
    ensureAudio();
    // 샘플: 곤충 3 + 꽃 1 → 두 가지 동작을 바로 확인
    creatures.push(new Creature(makeSampleButterfly('#ff9aa2'), 'fly'));
    creatures.push(new Creature(makeSampleButterfly('#ffd97d'), 'fly'));
    creatures.push(new Creature(makeSampleButterfly('#a0e7c4'), 'fly'));
    creatures.push(new Creature(makeSampleFlower(), 'stay'));
    bgm.volume = 0.5;
    bgm.play().then(() => setAudioBtn(true)).catch(() => setAudioBtn(false));
}
function setAudioBtn(on) {
    const btn = document.getElementById('audioBtn');
    btn.querySelector('.ico').innerText = on ? '🔊' : '🔇';
    btn.querySelector('span:last-child').innerText = on ? '소리 켬' : '소리 끔';
}
function toggleAudio() {
    if (bgm.paused) { bgm.play().then(() => setAudioBtn(true)).catch(() => setAudioBtn(false)); }
    else { bgm.pause(); setAudioBtn(false); }
}
function toggleVoice() {
    voiceOn = !voiceOn;
    const btn = document.getElementById('voiceBtn');
    btn.querySelector('span:last-child').innerText = voiceOn ? '말 켬' : '말 끔';
    if (voiceOn) speak('칭찬을 켰어요!'); else speechSynthesis.cancel();
}
function clearStage() { creatures = []; sparkles = []; }
function saveScene() {
    try {
        const link = document.createElement('a');
        link.download = '여름꽃밭.png';
        link.href = canvas.toDataURL('image/png');
        link.click();
    } catch (e) { alert('저장에 실패했어요. 다시 시도해 주세요!'); }
}
function toggleFullScreen() {
    if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(err => console.error('전체화면 오류:', err.message));
    } else {
        document.exitFullscreen();
    }
}

/* 전체화면일 때 UI 자동 숨김 */
document.addEventListener('fullscreenchange', () => {
    const ui = document.getElementById('uiPanel');
    if (document.fullscreenElement) {
        window.uiTimeout = setTimeout(() => { ui.style.opacity = '0'; ui.style.pointerEvents = 'none'; }, 2000);
    } else {
        clearTimeout(window.uiTimeout);
        ui.style.opacity = '1'; ui.style.pointerEvents = 'auto';
    }
});
window.addEventListener('mousemove', (e) => {
    if (!document.fullscreenElement) return;
    const ui = document.getElementById('uiPanel');
    ui.style.opacity = '1'; ui.style.pointerEvents = 'auto';
    clearTimeout(window.uiTimeout);
    const rect = ui.getBoundingClientRect();
    const over = e.clientX >= rect.left && e.clientX <= rect.right && e.clientY >= rect.top && e.clientY <= rect.bottom;
    if (!over) {
        window.uiTimeout = setTimeout(() => {
            if (document.fullscreenElement) { ui.style.opacity = '0'; ui.style.pointerEvents = 'none'; }
        }, 3000);
    }
});

/* ============================================================
   메인 루프 + 톡 누르기
   ============================================================ */
function animate() {
    const t = performance.now() / 1000;
    drawSky(); drawSun(t); drawClouds(); drawMotes(t); drawGrass(t); drawFlowers(t);
    creatures.forEach(c => { c.update(); c.draw(); });
    updateSparkles();
    requestAnimationFrame(animate);
}

canvas.addEventListener('pointerdown', (e) => {
    ensureAudio();
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left, my = e.clientY - rect.top;
    let hit = false;
    for (let i = creatures.length - 1; i >= 0; i--) {
        const c = creatures[i];
        if (mx > c.x && mx < c.x + c.w && my > c.y && my < c.y + c.h) {
            c.react();
            spawnSparkles(c.x + c.w / 2, c.y + c.h / 2, 16);
            playChime(); speak(praiseFor(c.kind));
            hit = true; break;
        }
    }
    if (!hit) { spawnSparkles(mx, my, 7); playPop(); }
});

/* ---------- 시작 ---------- */
const Garden = {
    startApp, chooseAdd, closeAddChoice, addByCamera, addByFile,
    openCamera, takeSnapshot, closeCamera, handleFileUpload,
    saveScene, toggleAudio, toggleVoice, clearStage, toggleFullScreen
};
window.Garden = Garden;

resize();
initFlowers();
animate();
