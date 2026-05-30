const canvas = document.getElementById('aquariumCanvas');
const ctx = canvas.getContext('2d', { willReadFrequently: true });
const bgm = document.getElementById('bgm');
const video = document.getElementById('video');
const modal = document.getElementById('cameraModal');

let fishes = [];

// 1. 기본 설정
function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}
window.addEventListener('resize', resize);
resize();

// AQUARIUM.js 수정 부분

function startAquarium() {
    const bgm = document.getElementById('bgm');
    const audioBtn = document.getElementById('audioBtn');
    
    // 1. 입장 화면 숨기기
    document.getElementById('entryOverlay').style.display = 'none';
    
    // 2. 노래 재생 (에러 방지 로직 포함)
    bgm.volume = 0.6; // 너무 클 수 있으니 60% 볼륨
    bgm.play()
        .then(() => {
            console.log("Suno AI 노래 재생 시작!");
            audioBtn.innerText = "🔊 소리 켬";
        })
        .catch(error => {
            console.error("자동 재생 차단됨:", error);
            alert("소리를 재생하려면 브라우저 상단 권한을 허용하거나 다시 클릭해 주세요.");
            audioBtn.innerText = "🔇 소리 끔";
        });
}

// 소리 끄고 켜는 버튼 기능
function toggleAudio() {
    const bgm = document.getElementById('bgm');
    const btn = document.getElementById('audioBtn');
    if (bgm.paused) {
        bgm.play();
        btn.innerText = "🔊 소리 켬";
    } else {
        bgm.pause();
        btn.innerText = "🔇 소리 끔";
    }
}

// 2. 물고기 클래스
class Fish {
    constructor(img) {
        this.img = img;
        this.size = 100 + Math.random() * 100;
        this.x = Math.random() * (canvas.width - this.size);
        this.y = Math.random() * (canvas.height - this.size);
        
        // 기본 속도
        this.vx = (Math.random() - 0.5) * 2;
        this.vy = (Math.random() - 0.5) * 2;

        // 😲 놀람 상태 속성 추가
        this.isScared = false;
        this.scaredTimer = 0; // 놀람 효과 지속 시간
    }

    // ⚡ 도망가기 메소드
    scare() {
        this.isScared = true;
        this.scaredTimer = 60; // 약 1초 동안 (60프레임) 효과 유지
        
        // 클릭된 반대 방향으로 속도 대폭 증가
        this.vx *= -5; 
        this.vy *= -5;

        // 속도가 너무 빠르지 않게 제한 (최대 10)
        const maxSpeed = 10;
        if (Math.abs(this.vx) > maxSpeed) this.vx = (this.vx > 0 ? 1 : -1) * maxSpeed;
        if (Math.abs(this.vy) > maxSpeed) this.vy = (this.vy > 0 ? 1 : -1) * maxSpeed;
    }

    update() {
        this.x += this.vx;
        this.y += this.vy;

        // 벽 충돌 처리
        if (this.x < 0 || this.x + this.size > canvas.width) this.vx *= -1;
        if (this.y < 0 || this.y + this.size > canvas.height) this.vy *= -1;

        // 놀람 상태 회복 로직
        if (this.isScared) {
            this.scaredTimer--;
            if (this.scaredTimer <= 0) {
                this.isScared = false;
                // 다시 천천히 헤엄치도록 감속
                this.vx *= 0.4;
                this.vy *= 0.4;
            }
        }
    }

    draw() {
        ctx.save();
        
        // 이동 방향에 따라 좌우 반전
        if (this.vx < 0) {
            ctx.translate(this.x + this.size, this.y);
            ctx.scale(-1, 1);
            ctx.drawImage(this.img, 0, 0, this.size, this.size);
        } else {
            ctx.drawImage(this.img, this.x, this.y, this.size, this.size);
        }
        
        ctx.restore();

        // ❗ 놀람 이모지 표시
        if (this.isScared) {
            ctx.font = "bold 40px Arial";
            ctx.fillStyle = "yellow";
            ctx.strokeStyle = "black";
            ctx.lineWidth = 2;
            ctx.fillText("!!", this.x + this.size / 2 - 10, this.y - 10);
            ctx.strokeText("!!", this.x + this.size / 2 - 10, this.y - 10);
        }
    }
}

// ⭐ 3. 사진 처리 핵심 로직 (완벽한 AI 배경 제거)
async function processImage(dataUrl) {
    showLoading(true, "AI가 그림을 꼼꼼히 오려내고 있어요! (약 5~10초)");
    
    try {
        // ⭐ 실패를 방지하기 위해 설정을 더 명확하게 잡아줍니다.
        const config = {
            publicPath: "https://cdn.jsdelivr.net/npm/@imgly/background-removal@1.4.5/dist/",
            debug: true, // 에러가 나면 개발자 도구에 상세히 기록합니다.
            device: 'cpu', // 모바일에서 튕기는 현상을 막기 위해 안전하게 CPU 모드로 설정
        };
        
        // AI 실행
        const imageBlob = await imglyRemoveBackground(dataUrl, config);
        
        // 기존의 메모리 찌꺼기를 지워주기 위해 URL 관리를 철저히 합니다.
        if (window.lastFishUrl) URL.revokeObjectURL(window.lastFishUrl);
        const objectUrl = URL.createObjectURL(imageBlob);
        window.lastFishUrl = objectUrl;
        
        const fishImg = new Image();
        fishImg.src = objectUrl;
        fishImg.onload = () => {
            fishes.push(new Fish(fishImg));
            showLoading(false);
        };
    } catch (err) {
        console.error("배경 제거 에러 상세:", err);
        showLoading(false);
        
        // 💡 만약 AI가 실패하면, 차선책으로 "밝은색 지우기"라도 실행되게 합니다.
        alert("AI가 너무 바빠서 일단 기본 방식으로 물고기를 만들게요!");
        addFallbackFish(dataUrl);
    }
}

// AI가 실패했을 때를 대비한 '구급차' 함수
function addFallbackFish(src) {
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
            // 밝은 회색(180 이상)까지 투명하게 만듦
            if(imgData.data[i]>180 && imgData.data[i+1]>180 && imgData.data[i+2]>180) imgData.data[i+3]=0;
        }
        tCtx.putImageData(imgData, 0, 0);
        
        const fishImg = new Image();
        fishImg.src = tempCanvas.toDataURL();
        fishImg.onload = () => { fishes.push(new Fish(fishImg)); };
    };
}

// 4. 카메라 제어
async function openCamera() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
            video: { facingMode: "environment" }, audio: false 
        });
        video.srcObject = stream;
        modal.style.display = 'flex';
    } catch (err) {
        alert("카메라를 켤 수 없어요! 브라우저 설정에서 카메라 권한을 확인해주세요.");
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

// 5. UI 기능
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

function clearAquarium() { fishes = []; }

// 전체 화면 토글 및 UI 숨기기 기능
// 🖥️ 전체화면 토글 함수
// 🖥️ 전체화면 토글
function toggleFullScreen() {
    if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(err => {
            console.error(`전체화면 오류: ${err.message}`);
        });
    } else {
        document.exitFullscreen();
    }
}

// 🌓 전체화면 상태 변화 감지
document.addEventListener('fullscreenchange', () => {
    const ui = document.getElementById('uiPanel');
    if (document.fullscreenElement) {
        // 전체화면 진입 시 2초 뒤에 자동으로 처음 한 번 숨기기
        window.uiTimeout = setTimeout(() => {
            ui.style.opacity = "0";
            ui.style.pointerEvents = "none";
        }, 2000);
    } else {
        // 해제 시 즉시 나타남
        clearTimeout(window.uiTimeout);
        ui.style.opacity = "1";
        ui.style.pointerEvents = "auto";
    }
});

// 🖱️ 마우스 움직임 감지 로직 강화
window.addEventListener('mousemove', (e) => {
    if (document.fullscreenElement) {
        const ui = document.getElementById('uiPanel');
        
        // 마우스가 움직이면 일단 보여줌
        ui.style.opacity = "1";
        ui.style.pointerEvents = "auto";
        
        clearTimeout(window.uiTimeout);
        
        // 🛑 마우스가 UI 패널(버튼 박스) 위에 있을 때는 숨기지 않음
        // 마우스가 패널 밖에 있을 때만 3초 뒤에 숨김
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
    fishes.forEach(f => { f.update(); f.draw(); });
    requestAnimationFrame(animate);
}
animate();

// 물고기 클릭(터치) 감지
canvas.addEventListener('mousedown', (e) => {
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    // 모든 물고기를 검사하여 클릭된 위치에 있는지 확인
    for (let i = fishes.length - 1; i >= 0; i--) {
        const fish = fishes[i];
        if (mouseX > fish.x && mouseX < fish.x + fish.size &&
            mouseY > fish.y && mouseY < fish.y + fish.size) {
            
            fish.scare(); // 물고기 놀람 함수 실행
            break; // 한 번 클릭에 물고기 한 마리만 반응하게
        }
    }
});