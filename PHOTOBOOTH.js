const video = document.getElementById('cameraView');
const canvas = document.getElementById('mainCanvas');
const ctx = canvas.getContext('2d');
const countdownEl = document.getElementById('countdown');
const bgToggle = document.getElementById('bgRemovalToggle');

const offscreenCanvas = document.createElement('canvas');
const offCtx = offscreenCanvas.getContext('2d');

let objects = [], selectedObj = null, isDragging = false;
let photos = [], currentCut = 0, currentTheme = 'none';
let cutFrames = [[], [], [], []];
let mediaRecorder, recordedChunks = [], isRecordingFinal = false, finalFrameIndex = 0, lastRenderTime = 0;
let segmentationMask = null, selfieSegmentation = null;

// 1. [핵심 수정] 캔버스 및 사진 영역 비율 재설정
canvas.width = 400; 
canvas.height = 720; // 캔버스 전체 높이를 살짝 높임

const targetW = 340;
const targetH = 150; // 사진 한 장의 높이를 높여서 겹침 방지 및 머리 여유 확보

// --- AI 및 카메라 초기화 (기존 동일) ---
async function initApp() {
    selfieSegmentation = new SelfieSegmentation({
        locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/selfie_segmentation/${file}`
    });
    selfieSegmentation.setOptions({ modelSelection: 1 });
    selfieSegmentation.onResults(results => { segmentationMask = results.segmentationMask; });

    try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
        video.srcObject = stream;
        async function aiLoop() {
            if (video.readyState >= 2) await selfieSegmentation.send({image: video});
            requestAnimationFrame(aiLoop);
        }
        aiLoop();
    } catch(e) { alert("카메라 권한을 허용해주세요!"); }
}

// --- 그리기 함수 (기존 동일) ---
function drawUser(tCtx, x, y, width, height) {
    const vW = video.videoWidth, vH = video.videoHeight;
    const targetRatio = width / height, vRatio = vW / vH;
    let sX, sY, sW, sH;
    if (vRatio > targetRatio) { sH = vH; sW = sH * targetRatio; sX = (vW - sW) / 2; sY = 0; }
    else { sW = vW; sH = sW / targetRatio; sX = 0; sY = (vH - sH) / 2; }

    tCtx.save();
    tCtx.translate(x + width, y);
    tCtx.scale(-1, 1);

    if (bgToggle.checked && segmentationMask) {
        offscreenCanvas.width = width; offscreenCanvas.height = height;
        offCtx.clearRect(0, 0, width, height);
        offCtx.drawImage(segmentationMask, 0, 0, width, height);
        offCtx.globalCompositeOperation = 'source-in';
        offCtx.drawImage(video, sX, sY, sW, sH, 0, 0, width, height);
        offCtx.globalCompositeOperation = 'source-over';
        tCtx.drawImage(offscreenCanvas, 0, 0, width, height);
    } else {
        tCtx.drawImage(video, sX, sY, srcH, srcW, 0, 0, width, height);
    }
    tCtx.restore();
}

// --- 2. [핵심 수정] 렌더링 루프 (레이어 및 좌표 수정) ---
function render(time) {
    time = time || performance.now();
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // (1) 배경색 그리기
    const themes = {
        none: { color: '#ffffff', icons: [] },
        spring: { color: '#fff0f5', icons: ['🌸', '🌷'] },
        summer: { color: '#e0f7fa', icons: ['🌻', '🌊'] },
        autumn: { color: '#fff3e0', icons: ['🍂', '🍁'] },
        winter: { color: '#f1f5f9', icons: ['☃️', '❄️'] },
        grad: { color: '#f8fafc', icons: ['🎓', '💐'] },
        love: { color: '#fff1f2', icons: ['❤️', '💖'] },
        celebration: { color: '#fef08a', icons: ['🎉', '🎈'] }
    };
    const config = themes[currentTheme];
    ctx.fillStyle = config.color;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // [수정] 사진 시작 Y좌표를 더 높게(35) 잡고, 간격(160) 조정
    const startY = 35; 
    const stepY = 160; 

    // (2) 사진 4컷 그리기 (이모지보다 먼저 그려서 침범 방지)
    for(let i=0; i<4; i++) {
        const py = startY + (i * stepY);
        let imgToDraw = photos[i];
        if (isRecordingFinal && cutFrames[i]?.length > 0) {
            let fIdx = Math.min(finalFrameIndex, cutFrames[i].length - 1);
            imgToDraw = cutFrames[i][fIdx];
        }
        if(imgToDraw) ctx.drawImage(imgToDraw, 30, py, targetW, targetH);
    }

    // (3) 실시간 미리보기 (기존 동일 비율 적용)
    if (!isRecordingFinal && currentCut < 4 && !photos[currentCut] && video.readyState >= 2) {
        const previewY = startY + (currentCut * stepY);
        drawUser(ctx, 30, previewY, targetW, targetH);
        ctx.strokeStyle = "#6366f1"; ctx.lineWidth = 3; ctx.strokeRect(30, previewY, targetW, targetH);
    }

    // [수정] (4) 테마 이모지 그리기 (사진 좌표 회피 로직)
    if(config.icons.length > 0) {
        ctx.font = "24px Arial"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
        const iconStep = 60;
        
        // 상단/하단 가로줄 (사진 영역 외)
        for(let x = 20; x <= 380; x += iconStep) {
            ctx.fillText(config.icons[x % config.icons.length], x, 20);
            ctx.fillText(config.icons[(x+1) % config.icons.length], x, canvas.height - 20);
        }
        
        // 세로줄 (사진 왼쪽/오른쪽 바깥 영역에만 배치)
        for(let y = 60; y <= canvas.height - 60; y += iconStep) {
            // [추가] Y좌표가 사진 영역(startY ~ startY + stepY*4)에 포함되면 그리지 않음
            let isOverlapping = false;
            for(let i=0; i<4; i++) {
                const photoYStart = startY + (i * stepY);
                const photoYEnd = photoYStart + targetH;
                if (y > photoYStart - 15 && y < photoYEnd + 15) { // 약간의 여유(15) 둠
                    isOverlapping = true;
                    break;
                }
            }
            // 겹치지 않을 때만 그리기
            if(!isOverlapping) {
                ctx.fillText(config.icons[y % config.icons.length], 15, y); // 왼쪽 끝
                ctx.fillText(config.icons[(y+1) % config.icons.length], 385, y); // 오른쪽 끝
            }
        }
    }

    // (5) 꾸미기 요소 (최상단, 기존 동일)
    objects.forEach(obj => {
        ctx.save(); ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.font = `${obj.size}px ${obj.font || 'Arial'}`; ctx.fillStyle = obj.color || '#000000';
        if(!isRecordingFinal && selectedObj === obj) {
            ctx.strokeStyle = "#6366f1"; ctx.lineWidth = 2; ctx.setLineDash([5, 5]);
            ctx.strokeRect(obj.x - obj.size/1.5, obj.y - obj.size/1.5, obj.size*1.3, obj.size*1.3);
        }
        ctx.fillText(obj.content, obj.x, obj.y); ctx.restore();
    });

    // 영상 저장 엔진 (기존 동일)
    if (isRecordingFinal && time - lastRenderTime >= 33) {
        finalFrameIndex++; lastRenderTime = time;
        if (finalFrameIndex >= Math.max(...cutFrames.map(arr => arr?.length || 0))) {
            isRecordingFinal = false; mediaRecorder?.stop();
        }
    } else if (!isRecordingFinal) { lastRenderTime = time; }
    requestAnimationFrame(render);
}

// --- 나머지 유틸리티 함수 (기존 동일) ---
async function handleCapture() { document.getElementById('captureControls').classList.add('hidden'); await startCountdown(3); if (cutFrames[currentCut]?.length > 0) photos[currentCut] = cutFrames[currentCut][cutFrames[currentCut].length - 1]; document.getElementById('confirmControls').classList.remove('hidden'); }
function nextCut() { currentCut++; document.getElementById('confirmControls').classList.add('hidden'); if (currentCut < 4) { document.getElementById('cutText').innerText = (currentCut+1) + "번째 컷"; document.getElementById('captureControls').classList.remove('hidden'); } else { document.getElementById('editActions').classList.remove('hidden'); document.getElementById('downloadVideoBtn').classList.remove('hidden'); } }
function retake() { photos[currentCut] = null; cutFrames[currentCut] = []; document.getElementById('confirmControls').classList.add('hidden'); document.getElementById('captureControls').classList.remove('hidden'); }
function changeTheme(t, b) { currentTheme = t; document.querySelectorAll('.theme-btn').forEach(btn => btn.classList.remove('active')); b.classList.add('active'); }
function addTextObject() { const v = document.getElementById('textInput').value; if(v) objects.push({type:'text', content:v, x:200, y:canvas.height - 60, size:40, font:document.getElementById('fontFamily').value, color:document.getElementById('textColor').value}); document.getElementById('textInput').value = ''; }
function addSticker(s) { objects.push({type:'sticker', content:s, x:200, y:300, size:50, font:'Arial'}); }
function downloadImage() { selectedObj = null; setTimeout(() => { const a = document.createElement('a'); a.download = 'photo.png'; a.href = canvas.toDataURL(); a.click(); }, 50); }
function downloadVideo() { const btn = document.getElementById('downloadVideoBtn'); btn.innerText = "⏳ 생성 중..."; btn.disabled = true; selectedObj = null; const stream = canvas.captureStream(30); mediaRecorder = new MediaRecorder(stream, { mimeType: MediaRecorder.isTypeSupported('video/mp4') ? 'video/mp4' : 'video/webm' }); recordedChunks = []; mediaRecorder.ondataavailable = e => { if (e.data.size > 0) recordedChunks.push(e.data); }; mediaRecorder.onstop = () => { const a = document.createElement('a'); a.download = `video.${mediaRecorder.mimeType.includes('mp4')?'mp4':'webm'}`; a.href = URL.createObjectURL(new Blob(recordedChunks, { type: mediaRecorder.mimeType })); a.click(); btn.innerText = "🎥 영상 저장"; btn.disabled = false; }; isRecordingFinal = true; finalFrameIndex = 0; mediaRecorder.start(); }
function resetStudio() { location.reload(); }

initApp(); render();