const canvas = document.getElementById('birdCanvas');
const ctx = canvas.getContext('2d', { willReadFrequently: true });
const bgm = document.getElementById('bgm');
const video = document.getElementById('video');
const modal = document.getElementById('cameraModal');

let birds = [];

// 1. 화면 크기 설정
function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}
window.addEventListener('resize', resize);
resize();

function startAviary() {
    document.getElementById('entryOverlay').style.display = 'none';
    bgm.volume = 0.5;
    bgm.play().catch(error => {
        console.error("자동 재생 차단됨:", error);
    });
}

// 2. 새 클래스 (Bird)
class Bird {
    constructor(img) {
        this.img = img;
        this.size = 120 + Math.random() * 80; // 새 크기
        this.x = Math.random() * (canvas.width - this.size);
        this.y = Math.random() * (canvas.height - this.size);
        
        this.vx = (Math.random() - 0.5) * 3;
        this.vy = (Math.random() - 0.5) * 1.5; // 위아래 이동은 조금 더 천천히

        this.angle = Math.random() * Math.PI * 2; // 날갯짓 느낌을 위한 각도
        this.isScared = false;
        this.scaredTimer = 0;
    }

    scare() {
        this.isScared = true;
        this.scaredTimer = 60;
        this.vx *= -6; 
        this.vy *= -6;
    }

    update() {
        // 날아가는 움직임에 약간의 사인파(Sine wave)를 섞어 일렁이게 함
        this.angle += 0.05;
        let flap = Math.sin(this.angle) * 2; 

        this.x += this.vx;
        this.y += this.vy + flap;

        // 벽 충돌 처리
        if (this.x < 0 || this.x + this.size > canvas.width) this.vx *= -1;
        if (this.y < 0 || this.y + this.size > canvas.height) this.vy *= -1;

        if (this.isScared) {
            this.scaredTimer--;
            if (this.scaredTimer <= 0) {
                this.isScared = false;
                this.vx *= 0.3;
                this.vy *= 0.3;
            }
        }
    }

    draw() {
        ctx.save();
        if (this.vx < 0) {
            ctx.translate(this.x + this.size, this.y);
            ctx.scale(-1, 1);
            ctx.drawImage(this.img, 0, 0, this.size, this.size);
        } else {
            ctx.drawImage(this.img, this.x, this.y, this.size, this.size);
        }
        ctx.restore();

        if (this.isScared) {
            ctx.font = "bold 40px Arial";
            ctx.fillStyle = "red";
            ctx.fillText("!!", this.x + this.size/2 - 10, this.y - 10);
        }
    }
}

// ⭐ 3. 사진 처리 (배경 제거 AI)
async function processImage(dataUrl) {
    showLoading(true, "AI가 새를 예쁘게 오려내고 있어요! (5~10초)");
    
    try {
        const config = {
            publicPath: "https://cdn.jsdelivr.net/npm/@imgly/background-removal@1.4.5/dist/",
            device: 'cpu',
        };
        
        const imageBlob = await imglyRemoveBackground(dataUrl, config);
        const objectUrl = URL.createObjectURL(imageBlob);
        
        const birdImg = new Image();
        birdImg.src = objectUrl;
        birdImg.onload = () => {
            birds.push(new Bird(birdImg));
            showLoading(false);
        };
    } catch (err) {
        console.error("배경 제거 에러:", err);
        showLoading(false);
        alert("AI가 바빠서 기본 방식으로 새를 만들게요!");
        addFallbackBird(dataUrl);
    }
}

function addFallbackBird(src) {
    const tempImg = new Image();
    tempImg.src = src;
    tempImg.onload = () => {
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = tempImg.width; 
        tempCanvas.height = tempImg.height;
        const tCtx = tempCanvas.getContext('2d');
        tCtx.drawImage(tempImg, 0, 0);
        const imgData = tCtx.getImageData(0,0, tempCanvas.width, tempCanvas.height);
        for(let i=0; i<imgData.data.length; i+=4) {
            if(imgData.data[i]>200 && imgData.data[i+1]>200 && imgData.data[i+2]>200) imgData.data[i+3]=0;
        }
        tCtx.putImageData(imgData, 0, 0);
        const birdImg = new Image();
        birdImg.src = tempCanvas.toDataURL();
        birdImg.onload = () => { birds.push(new Bird(birdImg)); };
    };
}

// 4. 카메라 및 UI 기능
async function openCamera() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
        video.srcObject = stream;
        modal.style.display = 'flex';
    } catch (err) {
        alert("카메라를 켤 수 없어요!");
    }
}

function takeSnapshot() {
    const captureCanvas = document.getElementById('captureCanvas');
    captureCanvas.width = video.videoWidth;
    captureCanvas.height = video.videoHeight;
    captureCanvas.getContext('2d').drawImage(video, 0, 0);
    processImage(captureCanvas.toDataURL('image/jpeg'));
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

function showLoading(show, msg) {
    const el = document.getElementById('customAlert');
    document.getElementById('alertMessage').innerText = msg;
    el.classList.toggle('show', show);
}

function toggleAudio() {
    const btn = document.getElementById('audioBtn');
    if (bgm.paused) { bgm.play(); btn.innerText = "🔊 소리 켬"; }
    else { bgm.pause(); btn.innerText = "🔇 소리 끔"; }
}

function clearAviary() { birds = []; }

function toggleFullScreen() {
    if (!document.fullscreenElement) document.documentElement.requestFullscreen();
    else document.exitFullscreen();
}

// 5. 애니메이션 루프
function animate() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    birds.forEach(b => { b.update(); b.draw(); });
    requestAnimationFrame(animate);
}
animate();

// 클릭 이벤트
canvas.addEventListener('mousedown', (e) => {
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    for (let i = birds.length - 1; i >= 0; i--) {
        const b = birds[i];
        if (mx > b.x && mx < b.x + b.size && my > b.y && my < b.y + b.size) {
            b.scare();
            break;
        }
    }
});