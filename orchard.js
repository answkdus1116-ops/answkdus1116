const canvas = document.getElementById('orchardCanvas');
const ctx = canvas.getContext('2d', { willReadFrequently: true });
const bgm = document.getElementById('bgm');
const video = document.getElementById('video');
const modal = document.getElementById('cameraModal');

let fruits = [];

// 1. 기본 설정
function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    fruits.forEach(f => f.updatePixelPosition());
}

window.addEventListener('resize', resize);
resize();

function startOrchard() {
    document.getElementById('entryOverlay').style.display = 'none';
    // 오디오 재생 (사용자 상호작용 후)
    bgm.play().catch(() => console.log("재생 권한 필요"));
    document.getElementById('audioBtn').innerText = "🔊 소리 켬";
}

// 🍎 열매 클래스
class Fruit {
    constructor(img) {
        this.img = img;
        const treeZones = [
            { xRange: [0.18, 0.35], yRange: [0.35, 0.60] }, 
            { xRange: [0.42, 0.58], yRange: [0.30, 0.65] }, 
            { xRange: [0.65, 0.82], yRange: [0.35, 0.60] }  
        ];
        
        const zone = treeZones[Math.floor(Math.random() * treeZones.length)];
        this.relX = zone.xRange[0] + Math.random() * (zone.xRange[1] - zone.xRange[0]);
        this.relY = zone.yRange[0] + Math.random() * (zone.yRange[1] - zone.yRange[0]);
        this.relSize = 0.08 + Math.random() * 0.04; 

        this.updatePixelPosition();

        this.angle = Math.random() * Math.PI * 2;
        this.swingSpeed = 0.015 + Math.random() * 0.015;
        this.range = 0.08 + Math.random() * 0.1;
        this.isFalling = false;
        this.vy = 0;
        this.gravity = 0.6;
        this.bounce = 0.3;
    }

    updatePixelPosition() {
        this.x = this.relX * canvas.width;
        this.y = this.relY * canvas.height;
        this.size = this.relSize * canvas.width;
        this.ground = canvas.height * 0.82; 
    }

    update() {
        if (this.isFalling) {
            this.vy += this.gravity;
            this.y += this.vy;

            if (this.y + this.size > this.ground) {
                this.y = this.ground - this.size;
                this.vy *= -this.bounce;
                if (Math.abs(this.vy) < 1) {
                    this.vy = 0;
                    this.isFalling = false;
                }
            }
            this.relY = this.y / canvas.height;
        } else if (this.y < this.ground - this.size - 10) {
            this.angle += this.swingSpeed;
        }
    }

    draw() {
        ctx.save();
        if (this.y + this.size < this.ground - 5) {
            ctx.translate(this.x + this.size / 2, this.y);
            ctx.rotate(Math.sin(this.angle) * this.range);
            ctx.drawImage(this.img, -this.size / 2, 0, this.size, this.size);
        } else {
            ctx.drawImage(this.img, this.x, this.y, this.size, this.size);
        }
        ctx.restore();
    }
}

// --- [공통 이미지 처리 로직] ---
// --- [공통 이미지 처리 로직 - AI 버전] ---
async function processImage(dataUrl) {
    showLoading(true, "AI가 열매를 예쁘게 깎고 있어요! (약 5~10초)");
    
    try {
        // AI 모델 설정
        const config = {
            publicPath: "https://cdn.jsdelivr.net/npm/@imgly/background-removal@1.4.5/dist/",
            device: 'cpu', // 모바일 안정성을 위해 CPU 모드 사용
        };
        
        // ⭐ AI로 배경 제거 실행
        const imageBlob = await imglyRemoveBackground(dataUrl, config);
        
        // 메모리 관리를 위해 이전 URL 해제
        if (window.lastFruitUrl) URL.revokeObjectURL(window.lastFruitUrl);
        const objectUrl = URL.createObjectURL(imageBlob);
        window.lastFruitUrl = objectUrl;
        
        const fruitImg = new Image();
        fruitImg.src = objectUrl;
        fruitImg.onload = () => {
            fruits.push(new Fruit(fruitImg));
            showLoading(false);
        };
    } catch (err) {
        console.error("AI 배경 제거 실패:", err);
        showLoading(false);
        // AI가 실패하면 예전 방식(밝은색 지우기)으로 자동 전환
        alert("AI가 바빠서 기본 방식으로 열매를 만들게요!");
        addFallbackFruit(dataUrl);
    }
}

// AI 실패 시 실행될 기본 배경 제거 함수
function addFallbackFruit(src) {
    const tempImg = new Image();
    tempImg.src = src;
    tempImg.onload = () => {
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = tempImg.width; 
        tempCanvas.height = tempImg.height;
        const tCtx = tempCanvas.getContext('2d');
        tCtx.drawImage(tempImg, 0, 0);
        
        const imgData = tCtx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);
        for(let i=0; i<imgData.data.length; i+=4) {
            // 밝은 회색(185 이상)까지 투명하게 처리
            const r = imgData.data[i];
            const g = imgData.data[i+1];
            const b = imgData.data[i+2];
            if(r > 185 && g > 185 && b > 185) imgData.data[i+3] = 0;
        }
        tCtx.putImageData(imgData, 0, 0);
        
        const fruitImg = new Image();
        fruitImg.src = tempCanvas.toDataURL();
        fruitImg.onload = () => { fruits.push(new Fruit(fruitImg)); };
    };
}

// 기존에 있던 extractFruit, addPlainFruit, removeBackground 함수는 이제 필요 없으므로 지우셔도 됩니다!

// --- [카메라/파일/UI 로직] ---
async function openCamera() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
        video.srcObject = stream; modal.style.display = 'flex';
    } catch (err) { alert("카메라를 켤 수 없어요!"); }
}

function takeSnapshot() {
    const cap = document.getElementById('captureCanvas');
    cap.width = video.videoWidth; cap.height = video.videoHeight;
    cap.getContext('2d').drawImage(video, 0, 0);
    processImage(cap.toDataURL('image/jpeg'));
    closeCamera();
}

function closeCamera() {
    if (video.srcObject) video.srcObject.getTracks().forEach(t => t.stop());
    modal.style.display = 'none';
}

function handleFileUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => processImage(e.target.result);
    reader.readAsDataURL(file);
}

function toggleAudio() {
    if (bgm.paused) { bgm.play(); document.getElementById('audioBtn').innerText = "🔊 소리 켬"; }
    else { bgm.pause(); document.getElementById('audioBtn').innerText = "🔇 소리 끔"; }
}

function clearOrchard() { fruits = []; }

function showLoading(show, msg) {
    const el = document.getElementById('customAlert');
    if(el) {
        document.getElementById('alertMessage').innerText = msg;
        el.classList.toggle('show', show);
    }
}

function toggleFullScreen() {
    if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(err => console.log(err));
    } else {
        document.exitFullscreen();
    }
}

document.addEventListener('fullscreenchange', () => {
    const ui = document.getElementById('uiPanel');
    if (document.fullscreenElement) {
        ui.style.opacity = "0";
        ui.style.pointerEvents = "none";
    } else {
        ui.style.opacity = "1";
        ui.style.pointerEvents = "auto";
    }
});

window.addEventListener('mousemove', (e) => {
    if (document.fullscreenElement) {
        const ui = document.getElementById('uiPanel');
        ui.style.opacity = "1";
        ui.style.pointerEvents = "auto";
        clearTimeout(window.uiTimeout);
        const rect = ui.getBoundingClientRect();
        const isOverPanel = (
            e.clientX >= rect.left && e.clientX <= rect.right &&
            e.clientY >= rect.top && e.clientY <= rect.bottom
        );
        if (!isOverPanel) {
            window.uiTimeout = setTimeout(() => {
                if (document.fullscreenElement) {
                    ui.style.opacity = "0";
                    ui.style.pointerEvents = "none";
                }
            }, 3000); 
        }
    }
});

function animate() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    fruits.forEach(f => { f.update(); f.draw(); });
    requestAnimationFrame(animate);
}
animate();

canvas.addEventListener('mousedown', (e) => {
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    for (let i = fruits.length - 1; i >= 0; i--) {
        const f = fruits[i];
        if (mouseX > f.x && mouseX < f.x + f.size &&
            mouseY > f.y && mouseY < f.y + f.size) {
            if (!f.isFalling) {
                f.isFalling = true;
                f.vy = 2; 
                break; 
            }
        }
    }
});