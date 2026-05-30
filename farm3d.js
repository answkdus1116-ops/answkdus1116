/* =====================================================================
   🌸 내 친구 동물 농장 3D - farm3d.js (최종 수정본)
   ===================================================================== */
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

/* ---- 동물 설정 ---- */
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
let scene, camera, renderer, controls;
let clock = new THREE.Clock(); 
let currentPetGroup = new THREE.Group();
let mixer = null;
let animations = {}; 
let currentAnimAction = null;

const keys = { w: false, a: false, s: false, d: false, arrowup: false, arrowdown: false, arrowleft: false, arrowright: false };

// 실행 순서
init3D();
buildSelector(); 
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
  controls.maxPolarAngle = Math.PI / 2 - 0.05;
  controls.minDistance = 3;
  controls.maxDistance = 15;

  scene.add(currentPetGroup);

  const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444, 0.6);
  scene.add(hemiLight);
  const dirLight = new THREE.DirectionalLight(0xffffff, 1.2);
  dirLight.position.set(5, 10, 5);
  dirLight.castShadow = true;
  scene.add(dirLight);

  const planeGeo = new THREE.PlaneGeometry(100, 100);
  const planeMat = new THREE.MeshStandardMaterial({ color: 0x8cd977 });
  const plane = new THREE.Mesh(planeGeo, planeMat);
  plane.rotation.x = -Math.PI / 2;
  plane.receiveShadow = true;
  scene.add(plane);

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
  currentPetGroup.clear();
  currentPetGroup.position.set(0, 0, 0);
  mixer = null;
  animations = {};

  const info = FRIENDS.find(f => f.key === key);
  const loader = new GLTFLoader();

  const loaderUI = document.getElementById('loading');
  if(loaderUI) loaderUI.style.display = 'flex';

  loader.load(info.local, 
    (gltf) => { setupModel(gltf); if(loaderUI) loaderUI.style.display = 'none'; }, 
    undefined, 
    (err) => {
      console.warn(`로컬 모델(${info.local}) 로드 실패. 대체 URL 확인 중...`);
      if (info.url) {
        loader.load(info.url, (gltf) => { setupModel(gltf); if(loaderUI) loaderUI.style.display = 'none'; }, undefined, () => {
          createFallbackToon(info.proc);
          if(loaderUI) loaderUI.style.display = 'none';
        });
      } else {
        createFallbackToon(info.proc);
        if(loaderUI) loaderUI.style.display = 'none';
      }
    }
  );
}

function setupModel(gltf) {
  const model = gltf.scene;
  model.traverse(child => { if (child.isMesh) child.castShadow = true; });
  
  const box = new THREE.Box3().setFromObject(model);
  const size = box.getSize(new THREE.Vector3()).length();
  const scale = 2.5 / size; 
  model.scale.set(scale, scale, scale);
  model.position.y = (model.position.y - box.min.y) * scale;
  
  currentPetGroup.add(model);

  if (gltf.animations && gltf.animations.length > 0) {
    mixer = new THREE.AnimationMixer(model);
    gltf.animations.forEach(clip => {
      const name = clip.name.toLowerCase();
      if (name.includes('idle')) animations.idle = mixer.clipAction(clip);
      if (name.includes('run') || name.includes('walk')) animations.run = mixer.clipAction(clip);
      if (name.includes('eat') || name.includes('bite')) animations.eat = mixer.clipAction(clip);
    });
    if(!animations.idle) animations.idle = mixer.clipAction(gltf.animations[0]);
    if(!animations.run) animations.run = animations.idle;
    playAnim('idle');
  }
}

function createFallbackToon(colors) {
  const geo = new THREE.CapsuleGeometry(0.5, 0.5, 4, 8);
  const mat = new THREE.MeshStandardMaterial({ color: colors.body });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.y = 0.75;
  mesh.castShadow = true;
  currentPetGroup.add(mesh);
}

function playAnim(name) {
  if (!mixer || !animations[name]) return;
  const nextAction = animations[name];
  if (currentAnimAction === nextAction) return;
  if (currentAnimAction) currentAnimAction.fadeOut(0.2);
  nextAction.reset().fadeIn(0.2).play();
  currentAnimAction = nextAction;
}

/* ---- 메인 루프 ---- */
function animate() {
  requestAnimationFrame(animate);
  const dt = clock.getDelta();

  if (mixer) mixer.update(dt);

  let moveDir = new THREE.Vector3(0, 0, 0);
  if (keys.w || keys.arrowup) moveDir.z -= 1;
  if (keys.s || keys.arrowdown) moveDir.z += 1;
  if (keys.a || keys.arrowleft) moveDir.x -= 1;
  if (keys.d || keys.arrowright) moveDir.x += 1;

  if (moveDir.lengthSq() > 0 && S.action !== 'sleep') {
    const cameraAngle = Math.atan2(camera.position.x - currentPetGroup.position.x, camera.position.z - currentPetGroup.position.z);
    moveDir.normalize();
    moveDir.applyAxisAngle(new THREE.Vector3(0, 1, 0), cameraAngle);
    const targetRotation = Math.atan2(moveDir.x, moveDir.z);
    currentPetGroup.rotation.y = targetRotation;
    const speed = 4.0;
    currentPetGroup.position.addScaledVector(moveDir, speed * dt);
    playAnim('run');
  } else {
    if (!S.action) playAnim('idle'); 
  }

  controls.target.lerp(currentPetGroup.position, 0.1);
  controls.update();
  renderer.render(scene, camera);
}

/* ---- UI 연동 ---- */
function buildSelector() {
  const grid = document.getElementById('petGrid');
  if(!grid) return;
  grid.innerHTML = '';
  FRIENDS.forEach(f => {
    const btn = document.createElement('button');
    btn.className = 'pet-btn' + (f.key === S.petKey ? ' active' : '');
    btn.innerHTML = `<span class="pet-emoji">${f.emoji}</span><span class="pet-label">${f.kr}</span>`;
    btn.onclick = (e) => chPet(f.key, e.currentTarget);
    grid.appendChild(btn);
  });
}

function doAction(act) {
  S.action = act;
  if (act === 'feed') { playAnim('eat'); S.hunger = Math.min(100, S.hunger + 20); }
  if (act === 'play') { playAnim('run'); S.happy = Math.min(100, S.happy + 20); }
  setTimeout(() => { S.action = null; }, 2500);
}

function chPet(key, btn) {
  S.petKey = key;
  document.querySelectorAll('.pet-btn').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  loadPet(key);
}

function bindUI() {
  window.doAction = doAction;
  window.chPet = chPet;
}