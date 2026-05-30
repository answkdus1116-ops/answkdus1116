const stone = document.getElementById('stone');
const message = document.getElementById('message');
const p1ScoreDisplay = document.getElementById('p1-score');
const p2ScoreDisplay = document.getElementById('p2-score');
const turnOverlay = document.getElementById('turn-overlay');
const overlayText = document.getElementById('overlay-text');
const startTurnBtn = document.getElementById('start-turn-btn');
const resultOverlay = document.getElementById('result-overlay');
const winnerText = document.getElementById('winner-text');
const finalScoreText = document.getElementById('final-score-text');
const bgmPlayer = document.getElementById('bgm-player');
const sfxPlayer = document.getElementById('sfx-player');

// 게임 상태 변수
let currentPlayer = 1; // 1: 왼쪽, 2: 오른쪽
let p1TotalScore = 0;
let p2TotalScore = 0;
let p1Turns = 0;
let p2Turns = 0;
let isThrown = false;
let isDragging = false;
let startY = 0;

const bgmUrls = {
    // 에릭 사티의 짐노페디 - 아주 잔잔하고 평화로운 피아노 곡입니다.
    'peaceful': 'https://upload.wikimedia.org/wikipedia/commons/e/e0/Gymnop%C3%A9die_No._1.ogg', 
    'bgm_custom.mp3': './bgm_custom.mp3'
};

// 배경음악 설정 부분
document.getElementById('play-btn').addEventListener('click', () => {
    const selectedFile = document.getElementById('bgm-select').value;
    
    // 선택된 파일(healing.mp3 또는 bgm_custom.mp3)을 재생합니다.
    bgmPlayer.src = `./${selectedFile}`; 
    
    // 힐링을 위해 볼륨을 0.5 정도로 부드럽게 설정합니다.
    bgmPlayer.volume = 0.5; 
    
    bgmPlayer.play().catch(e => {
        alert(`음악 파일을 찾을 수 없습니다!\n파일(${selectedFile})이 curling.html과 같은 폴더에 있는지 확인해주세요.`);
    });
    
    document.getElementById('play-btn').innerText = "🌿 힐링 재생 중";
});

// 버튼 클릭 시 짧은 진동이나 효과음을 넣으면 좋지만, 
// 우선 텍스트 피드백을 강화합니다.
startTurnBtn.addEventListener('click', () => {
    // 버튼을 누르는 순간 바로 사라지지 않고 아주 살짝 딜레이를 주어 클릭감을 느끼게 함
    startTurnBtn.style.transform = "scale(0.9)";
    setTimeout(() => {
        turnOverlay.classList.add('hidden');
        resetStonePosition();
        startTurnBtn.style.transform = "scale(1)";
    }, 150)
});

// 드래그 로직
stone.addEventListener('mousedown', startDrag);
stone.addEventListener('touchstart', startDrag, {passive: true});
document.addEventListener('mouseup', endDrag);
document.addEventListener('touchend', endDrag);

function startDrag(e) {
    if (isThrown) return;
    isDragging = true;
    startY = e.type.includes('mouse') ? e.clientY : e.touches[0].clientY;
}

function endDrag(e) {
    if (!isDragging || isThrown) return;
    isDragging = false;
    let endY = e.type.includes('mouse') ? e.clientY : e.changedTouches[0].clientY;
    let distance = startY - endY;
    if (distance > 30) throwStone(distance);
}

function throwStone(dist) {
    isThrown = true;
    let targetBottom = Math.min(Math.max(dist * 1.6, 60), 450);
    stone.style.bottom = targetBottom + 'px';

    setTimeout(() => {
        calculateTurnScore(targetBottom);
    }, 1800);
}

function calculateTurnScore(pos) {
    let score = 0;
    if (pos > 320 && pos < 400) score = 100; // 정중앙
    else if (pos > 250 && pos < 470) score = 50;  // 원 내부
    else if (pos < 470) score = 10;               // 근처

    if (currentPlayer === 1) {
        p1TotalScore += score;
        p1Turns++;
        p1ScoreDisplay.innerText = p1TotalScore;
    } else {
        p2TotalScore += score;
        p2Turns++;
        p2ScoreDisplay.innerText = p2TotalScore;
    }

    checkNextTurn();
}

function checkNextTurn() {
    if (p1Turns === 3 && p2Turns === 3) {
        showFinalResult();
    } else {
        // 턴 교체
        currentPlayer = (currentPlayer === 1) ? 2 : 1;
        setTimeout(() => {
            overlayText.innerText = (currentPlayer === 1 ? "왼쪽 선수" : "오른쪽 선수") + " 차례입니다! (각 3회)";
            stone.className = (currentPlayer === 1 ? "p1-turn" : "p2-turn");
            turnOverlay.classList.remove('hidden');
        }, 1000);
    }
}

function showFinalResult() {
    resultOverlay.classList.remove('hidden');
    let winner = "";
    if (p1TotalScore > p2TotalScore) winner = "왼쪽 선수 승리! 🏆";
    else if (p2TotalScore > p1TotalScore) winner = "오른쪽 선수 승리! 🏆";
    else winner = "무승부입니다! 🤝";

    winnerText.innerText = winner;
    finalScoreText.innerText = `최종 점수 - ${p1TotalScore} : ${p2TotalScore}`;
    
    // 축하 효과음 (브라우저 기본 알림음 등 활용 가능)
    sfxPlayer.src = "https://actions.google.com/sounds/v1/cartoon/conga_drum_hit.ogg"; 
    sfxPlayer.play();
}

function resetStonePosition() {
    isThrown = false;
    stone.style.bottom = '20px';
    message.innerText = (currentPlayer === 1 ? "왼쪽" : "오른쪽") + " 선수, 스톤을 밀어주세요!";
}

document.getElementById('reset-btn').addEventListener('click', () => location.reload());