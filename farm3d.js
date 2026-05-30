import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

/* ---- 1. 데이터 및 설정 ---- */
const FRIENDS = [
  { key: 'fox', kr: '여우', emoji: '🦊', local: './models/Fox.glb', url: 'https://cdn.jsdelivr.net/gh/KhronosGroup/glTF-Sample-Assets@main/Models/Fox/glTF-Binary/Fox.glb', proc: { body: 0xff8a3d } },
  { key: 'Alpaca', kr: '알파카', emoji: '🦙', local: './models/Alpaca.glb', url: null, proc: { body: 0xe8b870 } }
];

let S = { petKey: 'fox', action: null, isMoving: false };
let scene, camera, renderer, controls, mixer;
let clock = new THREE.Clock();
let currentPetGroup = new THREE.Group();
let animations = {};
let currentAnimAction = null;

// 입력 관리
const keys = { w: false, a: false, s: false, d: false, arrowup: false, arrowdown: false, arrowleft: false, arrowright: false };
let joystickVector = new THREE.Vector2(0, 0);

/* ---- 2. 초기화 실행 ---- */
init3D();
buildSelector();
bindUI();
createJoystick(); // 태블릿 조이스틱 생성
animate();

function init3D() {
  const container = document.getElementById('stage');
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0xbdf0ff);
  scene.fog = new THREE.Fog(0xbdf0ff, 15, 45);

  camera = new THREE.PerspectiveCamera(45, container.clientWidth / container.clientHeight, 0.1, 100);
  camera.position.set(0, 5, 10);

  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.shadowMap.enabled = true;
  container.appendChild(renderer.domElement);

  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.maxDistance = 20;

  // --- 🌿 입체적 잔디밭 (고퀄리티 텍스처 적용) ---
  const loader = new THREE.TextureLoader();
  // Three.js 공식 예제 텍스처 활용 (입체감 있는 잔디)
  const grassTex = loader.load('https://raw.githubusercontent.com/mrdoob/three.js/master/examples/textures/terrain/grasslight-big.jpg');
  grassTex.wrapS = grassTex.wrapT = THREE.RepeatWrapping;
  grassTex.repeat.set(25, 25); // 텍스처 반복으로 디테일 증가

  const planeGeo = new THREE.PlaneGeometry(100, 100);
  const planeMat = new THREE.MeshStandardMaterial({ map: grassTex, roughness: 0.8 });
  const plane = new THREE.Mesh(planeGeo, planeMat);
  plane.rotation.x = -Math.PI / 2;
  plane.receiveShadow = true;
  scene.add(plane);

  // 조명
  scene.add(new THREE.HemisphereLight(0xffffff, 0x444444, 1.0));
  const dirLight = new THREE.DirectionalLight(0xffffff, 1.2);
  dirLight.position.set(5, 10, 5);
  dirLight.castShadow = true;
  scene.add(dirLight);

  scene.add(currentPetGroup);
  
  // 키보드 이벤트
  window.addEventListener('keydown', (e) => { const k = e.key.toLowerCase(); if (keys.hasOwnProperty(k)) keys[k] = true; });
  window.addEventListener('keyup', (e) => { const k = e.key.toLowerCase(); if (keys.hasOwnProperty(k)) keys[k] = false; });
  
  loadPet(S.petKey);
}

/* ---- 3. 태블릿 조이스틱 시스템 ---- */
function createJoystick() {
  const joyZone = document.createElement('div');
  joyZone.id = 'joystick-zone';
  joyZone.style = "position:absolute; bottom:40px; left:40px; width:120px; height:120px; background:rgba(255,255,255,0.2); border-radius:50%; z-index:1000; touch-action:none; display:flex; align-items:center; justify-content:center; border:2px solid rgba(255,255,255,0.3);";
  document.body.appendChild(joyZone);

  const stick = document.createElement('div');
  stick.style = "width:50px; height:50px; background:#fff; border-radius:50%; box-shadow:0 4px 10px rgba(0,0,0,0.2); transition: transform 0.1s;";
  joyZone.appendChild(stick);

  const handleMove = (e) => {
    e.preventDefault();
    const touch = e.touches ? e.touches[0] : e;
    const rect = joyZone.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const x = (touch.clientX - centerX) / (rect.width / 2);
    const y = (touch.clientY - centerY) / (rect.height / 2);
    
    joystickVector.set(x, y).clampLength(0, 1);
    stick.style.transform = `translate(${joystickVector.x * 35}px, ${joystickVector.y * 35}px)`;
  };

  const handleEnd = () => {
    joystickVector.set(0, 0);
    stick.style.transform = `translate(0, 0)`;
  };

  joyZone.addEventListener('touchstart', handleMove);
  joyZone.addEventListener('touchmove', handleMove);
  joyZone.addEventListener('touchend', handleEnd);
}

/* ---- 4. 아이템 소환 시스템 (물고기, 케이크 등) ---- */
function spawnItem(type) {
  const colors = { fish: 0x3399ff, cake: 0xff66cc, toy: 0xffff00, vitamin: 0x00ff99 };
  const geo = new THREE.IcosahedronGeometry(0.3, 0);
  const mat = new THREE.MeshStandardMaterial({ color: colors[type] || 0xffffff, emissive: colors[type], emissiveIntensity: 0.5 });
  const item = new THREE.Mesh(geo, mat);

  // 캐릭터 앞 위치 계산
  const angle = currentPetGroup.rotation.y;
  item.position.set(
    currentPetGroup.position.x + Math.sin(angle) * 1.5,
    0.3,
    currentPetGroup.position.z + Math.cos(angle) * 1.5
  );
  
  scene.add(item);
  
  // 3초 뒤 사라지는 효과
  setTimeout(() => {
    const fadeOut = setInterval(() => {
      item.scale.multiplyScalar(0.9);
      if(item.scale.x < 0.1) {
        scene.remove(item);
        clearInterval(fadeOut);
      }
    }, 50);
  }, 2500);
}

/* ---- 5. 메인 루프 (방정맞은 이동 수정) ---- */
function animate() {
  requestAnimationFrame(animate);
  const dt = clock.getDelta();
  if (mixer) mixer.update(dt);

  let moveDir = new THREE.Vector3(0, 0, 0);
  if (keys.w || keys.arrowup) moveDir.z -= 1;
  if (keys.s || keys.arrowdown) moveDir.z += 1;
  if (keys.a || keys.arrowleft) moveDir.x -= 1;
  if (keys.d || keys.arrowright) moveDir.x += 1;

  // 조이스틱 입력 합산
  if (joystickVector.lengthSq() > 0.1) {
    moveDir.x = joystickVector.x;
    moveDir.z = joystickVector.y;
  }

  // 방정맞음 방지: 일정 강도 이상의 입력이 있을 때만 이동
  if (moveDir.lengthSq() > 0.05 && S.action !== 'sleep') {
    const camAngle = Math.atan2(camera.position.x - currentPetGroup.position.x, camera.position.z - currentPetGroup.position.z);
    moveDir.normalize().applyAxisAngle(new THREE.Vector3(0, 1, 0), camAngle);
    
    // 부드러운 회전
    const targetAngle = Math.atan2(moveDir.x, moveDir.z);
    currentPetGroup.rotation.y = THREE.MathUtils.lerp(currentPetGroup.rotation.y, targetAngle, 0.15);
    
    currentPetGroup.position.addScaledVector(moveDir, 4.0 * dt);
    playAnim('run');
  } else {
    // 멈춰있을 때만 idle 실행
    if (!S.action) playAnim('idle');
  }

  controls.target.lerp(currentPetGroup.position, 0.1);
  controls.update();
  renderer.render(scene, camera);
}

/* ---- 6. UI 및 상호작용 ---- */
function bindUI() {
  window.doAction = (act) => {
    if (S.action === act) return;
    S.action = act;
    
    // 동작별 애니메이션 및 아이템 연결
    if (act === 'feed') { playAnim('run'); spawnItem('fish'); }
    else if (act === 'play') { playAnim('run'); spawnItem('toy'); }
    else if (act === 'sleep') { playAnim('idle'); }
    else if (act === 'wash') { playAnim('idle'); }

    // 2초 후 기본 상태로 복구
    setTimeout(() => { S.action = null; }, 2000);
  };

  window.buyItem = (id, emoji) => {
    spawnItem(id);
    const notif = document.createElement('div');
    notif.className = 'notif-popup';
    notif.innerText = `${emoji} 아이템을 사용했습니다!`;
    document.getElementById('notifLayer').appendChild(notif);
    setTimeout(() => notif.remove(), 2000);
  };
}

// loadPet, setupModel, buildSelector 등 기존 보조 함수 유지...
function loadPet(key) {
  const loaderUI = document.getElementById('loading');
  if(loaderUI) loaderUI.style.display = 'flex';
  currentPetGroup.clear();
  mixer = null;
  animations = {};
  const info = FRIENDS.find(f => f.key === key);
  const loader = new GLTFLoader();
  loader.load(info.local, (gltf) => { 
    setupModel(gltf); 
    if(loaderUI) loaderUI.style.display = 'none';
  }, undefined, () => {
     if(info.url) loader.load(info.url, (g) => { setupModel(g); loaderUI.style.display='none'; });
  });
}

function setupModel(gltf) {
  const model = gltf.scene;
  model.traverse(c => { if (c.isMesh) { c.castShadow = true; c.receiveShadow = true; } });
  const box = new THREE.Box3().setFromObject(model);
  const size = box.getSize(new THREE.Vector3()).length();
  const scale = 2.5 / size;
  model.scale.set(scale, scale, scale);
  model.position.y = -box.min.y * scale;
  currentPetGroup.add(model);
  if (gltf.animations.length > 0) {
    mixer = new THREE.AnimationMixer(model);
    gltf.animations.forEach(clip => {
      const n = clip.name.toLowerCase();
      if (n.includes('idle')) animations.idle = mixer.clipAction(clip);
      if (n.includes('run') || n.includes('walk')) animations.run = mixer.clipAction(clip);
    });
    playAnim('idle');
  }
}

function playAnim(n) {
  if (!mixer || !animations[n]) return;
  if (currentAnimAction === animations[n]) return;
  if (currentAnimAction) currentAnimAction.fadeOut(0.2);
  animations[n].reset().fadeIn(0.2).play();
  currentAnimAction = animations[n];
}

function buildSelector() {
  const sel = document.getElementById('petSelector');
  if(!sel) return;
  FRIENDS.forEach(f => {
    const btn = document.createElement('button');
    btn.className = 'pet-btn';
    btn.innerHTML = `<span>${f.emoji}</span>`;
    btn.onclick = () => loadPet(f.key);
    sel.appendChild(btn);
  });
}