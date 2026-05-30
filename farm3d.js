/* =====================================================================
   🌸 내 친구 동물 농장 3D - WASD 이동 추가 버전 (farm3d.js)
   - W, A, S, D 키로 필드 이동 / Camera Follow
   ===================================================================== */
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

/* ---- 동물 설정 (모델이 없으면 proc 설정의 임시 캐릭터가 나옴) ---- */
const FRIENDS = [
  { key: 'fox', kr: '여우', emoji: '🦊',
    local: './models/Fox.glb',
    url: 'https://cdn.jsdelivr.net/gh/KhronosGroup/glTF-Sample-Assets@main/Models/Fox/glTF-Binary/Fox.glb',
    proc: { body: 0xff8a3d, belly: 0xfff1e0 } 
  },
  { key: 'Alpaca', kr: '알파카', emoji: '🦙',
    local: './models/Alpaca.glb', url: null,
    proc: { body: 0xe8b870, belly: 0xf5d9a0 } 
  },
  { key: 'Cow', kr: '소', emoji: '🐮',
    local: './models/Cow.glb', url: null,
    proc: { body: 0xffb3d1, belly: 0xffe0ef } 
  },
  { key: 'Deer', kr: '사슴', emoji: '🦌',
    local: './models/Deer.glb', url: null,
    proc: { body: 0xdce0ff, belly: 0xfff0f8 } 
  },
  { key: 'Shiba', kr: '시바견', emoji: '🐕',
    local: './models/Shiba.glb', url: null,
    proc: { body: 0xffb3d1, belly: 0xffe0ef } 
  },
  { key: 'Donkey', kr: '당나귀', emoji: '🫏',
    local: './models/Donkey.glb', url: null,
    proc: { body: 0xaaaaaa, belly: 0xcccccc } 
  },
  { key: 'Stag', kr: '수사슴', emoji: '🦌',
    local: './models/Stag.glb', url: null,
    proc: { body: 0x8b4513, belly: 0xd2b48c } 
  },
  { key: 'Husky', kr: '허스키', emoji: '🐺',
    local: './models/Husky.glb', url: null,
    proc: { body: 0x555555, belly: 0xffffff } 
  },
  { key: 'WhiteHorse', kr: '백마', emoji: '🐎',
    local: './models/WhiteHorse.glb', url: null,
    proc: { body: 0xffffff, belly: 0xeeeeee } 
  },
  { key: 'Horse', kr: '말', emoji: '🐴',
    local: './models/Horse.glb', url: null,
    proc: { body: 0x654321, belly: 0x8b4513 } 
  },
  { key: 'Wolf', kr: '늑대', emoji: '🐺',
    local: './models/Wolf.glb', url: null,
    proc: { body: 0x333333, belly: 0xeeeeee } 
  }
];

let S = {
  petKey: 'fox', petName: '모찌',
  level: 1, hp: 85, hunger: 60, happy: 75, coins: 120,
  action: null
};

// Three.js 코어 변수
let scene, camera, renderer, controls, clock;
let currentPetGroup = new THREE.Group();
let mixer = null;
let animations = {}; // { idle: action, run: action, ... }
let currentAnimAction = null;

// 키보드 입력 상태
const keys = { w: false, a: false, s: false, d: false, arrowup: false, arrowdown: false, arrowleft: false, arrowright: false };

init3D();
bindUI();
animate();

/* ---- 3D 씬 초기화 ---- */
function init3D() {
  const container = document.createElement('div');
  container.style.position = 'absolute'; container.style.inset = '0'; container.style.zIndex = '-1';
  document.body.appendChild(container);

  scene = new THREE.Scene();
  scene.background = new THREE.Color(0xbdf0ff);
  scene.fog = new THREE.Fog(0xbdf0ff, 10, 50);

  camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 100);
  camera.position.set(0, 4, 8);

  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  container.appendChild(renderer.domElement);

  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.maxPolarAngle = Math.PI / 2 - 0.05; // 땅 아래로 내려가지 않게 제한
  controls.minDistance = 3;
  controls.maxDistance = 15;

 import { Timer } from 'three/addons/utils/Timer.js'; // 1. 상단에 추가 (없다면)
const timer = new THREE.Timer(); // 2. clock 대신 생성

function animate() {
  timer.update(); // 3. 매 프레임마다 업데이트
  const dt = timer.getDelta();
  // ... 나머지 코드
}
  scene.add(currentPetGroup);

  // 조명
  const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444, 0.6);
  scene.add(hemiLight);
  const dirLight = new THREE.DirectionalLight(0xffffff, 1.2);
  dirLight.position.set(5, 10, 5);
  dirLight.castShadow = true;
  scene.add(dirLight);

  // 잔디밭(바닥)
  const planeGeo = new THREE.PlaneGeometry(100, 100);
  const planeMat = new THREE.MeshStandardMaterial({ color: 0x8cd977 });
  const plane = new THREE.Mesh(planeGeo, planeMat);
  plane.rotation.x = -Math.PI / 2;
  plane.receiveShadow = true;
  scene.add(plane);

  // 키보드 이벤트 리스너 추가 (이동용)
  window.addEventListener('keydown', (e) => {
    const key = e.key.toLowerCase();
    if (keys.hasOwnProperty(key)) keys[key] = true;
  });
  window.addEventListener('keyup', (e) => {
    const key = e.key.toLowerCase();
    if (keys.hasOwnProperty(key)) keys[key] = false;
  });
  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  loadPet(S.petKey);
}

/* ---- 캐릭터 불러오기 ---- */
function loadPet(key) {
  currentPetGroup.clear(); // 기존 모델 제거
  currentPetGroup.position.set(0, 0, 0); // 위치 초기화
  mixer = null;
  animations = {};

  const info = FRIENDS.find(f => f.key === key);
  const loader = new GLTFLoader();

  // 1. 로컬 파일 먼저 시도 -> 2. URL 시도 -> 3. 실패 시 Toon 모델
  loader.load(info.local, 
    setupModel, 
    undefined, 
    (err) => {
      console.warn(`로컬 모델(${info.local}) 로드 실패. 대체 URL 확인 중...`);
      if (info.url) {
        loader.load(info.url, setupModel, undefined, () => createFallbackToon(info.proc));
      } else {
        createFallbackToon(info.proc);
      }
    }
  );
}

function setupModel(gltf) {
  const model = gltf.scene;
  model.traverse(child => { if (child.isMesh) child.castShadow = true; });
  
  // 크기 정규화 (모델마다 크기가 다름을 방지)
  const box = new THREE.Box3().setFromObject(model);
  const size = box.getSize(new THREE.Vector3()).length();
  const scale = 2.5 / size; 
  model.scale.set(scale, scale, scale);
  model.position.y = (model.position.y - box.min.y) * scale;
  
  currentPetGroup.add(model);

  // 애니메이션 매핑
  if (gltf.animations && gltf.animations.length > 0) {
    mixer = new THREE.AnimationMixer(model);
    gltf.animations.forEach(clip => {
      const name = clip.name.toLowerCase();
      // Quaternius 모델 등의 이름 규칙 대응
      if (name.includes('idle')) animations.idle = mixer.clipAction(clip);
      if (name.includes('run') || name.includes('walk')) animations.run = mixer.clipAction(clip);
      if (name.includes('eat') || name.includes('bite')) animations.eat = mixer.clipAction(clip);
    });
    // 기본 애니메이션은 첫 번째 것으로 할당
    if(!animations.idle) animations.idle = mixer.clipAction(gltf.animations[0]);
    if(!animations.run) animations.run = animations.idle;
    playAnim('idle');
  }
}

// 모델이 없을 때 임시로 그려지는 캐릭터
function createFallbackToon(colors) {
  const geo = new THREE.CapsuleGeometry(0.5, 0.5, 4, 8);
  const mat = new THREE.MeshStandardMaterial({ color: colors.body });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.y = 0.75;
  mesh.castShadow = true;
  currentPetGroup.add(mesh);
}

/* ---- 애니메이션 플레이어 ---- */
function playAnim(name) {
  if (!mixer || !animations[name]) return;
  const nextAction = animations[name];
  if (currentAnimAction === nextAction) return;
  
  if (currentAnimAction) currentAnimAction.fadeOut(0.2);
  nextAction.reset().fadeIn(0.2).play();
  currentAnimAction = nextAction;
}

/* ---- 메인 루프 & 캐릭터 이동 ---- */
function animate() {
  requestAnimationFrame(animate);
  const dt = clock.getDelta();

  if (mixer) mixer.update(dt);

  // 캐릭터 키보드 이동 로직
  let moveDir = new THREE.Vector3(0, 0, 0);
  if (keys.w || keys.arrowup) moveDir.z -= 1;
  if (keys.s || keys.arrowdown) moveDir.z += 1;
  if (keys.a || keys.arrowleft) moveDir.x -= 1;
  if (keys.d || keys.arrowright) moveDir.x += 1;

  if (moveDir.lengthSq() > 0 && S.action !== 'sleep') {
    // 카메라가 바라보는 방향을 기준으로 이동 방향 계산
    const cameraAngle = Math.atan2(camera.position.x - currentPetGroup.position.x, camera.position.z - currentPetGroup.position.z);
    
    // 로컬 방향 벡터를 카메라 시점으로 변환
    moveDir.normalize();
    moveDir.applyAxisAngle(new THREE.Vector3(0, 1, 0), cameraAngle);

    // 모델 회전 (이동하는 방향을 바라보게)
    const targetRotation = Math.atan2(moveDir.x, moveDir.z);
    currentPetGroup.rotation.y = targetRotation;

    // 모델 이동
    const speed = 4.0;
    currentPetGroup.position.addScaledVector(moveDir, speed * dt);
    
    playAnim('run'); // 뛰는 애니메이션
  } else {
    // 액션 중이 아닐 때만 idle
    if (!S.action) playAnim('idle'); 
  }

  // 카메라가 부드럽게 캐릭터를 따라가도록 설정
  controls.target.lerp(currentPetGroup.position, 0.1);
  controls.update();

  renderer.render(scene, camera);
}

/* ---- UI 및 동작 연동 ---- */
function doAction(act) {
  S.action = act;
  if (act === 'feed') { playAnim('eat'); S.hunger = Math.min(100, S.hunger + 20); }
  if (act === 'play') { playAnim('run'); S.happy = Math.min(100, S.happy + 20); }
  
  updateBars();
  setTimeout(() => { S.action = null; }, 2500);
}

function chPet(key, btn) {
  S.petKey = key;
  document.querySelectorAll('.pet-btn').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  loadPet(key);
}

function updateBars() { /* HTML 체력바 연동 (생략가능하나 에러 방지용) */ }
function bindUI() {
  window.doAction = doAction;
  window.chPet = chPet;
}