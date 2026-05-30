import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

/* ---- 1. 데이터 설정 (4종 전체 복구) ---- */
const FRIENDS = [
  { key: 'fox', kr: '여우', emoji: '🦊', local: './models/Fox.glb', url: 'https://cdn.jsdelivr.net/gh/KhronosGroup/glTF-Sample-Assets@main/Models/Fox/glTF-Binary/Fox.glb', proc: { body: 0xff8a3d } },
  { key: 'Alpaca', kr: '알파카', emoji: '🦙', local: './models/Alpaca.glb', url: null, proc: { body: 0xe8b870 } },
  { key: 'Cow', kr: '소', emoji: '🐮', local: './models/Cow.glb', url: null, proc: { body: 0xffb3d1 } },
  { key: 'Deer', kr: '사슴', emoji: '🦌', local: './models/Deer.glb', url: null, proc: { body: 0xdce0ff } }
];

let S = { petKey: 'fox', action: null, isMoving: false };
let scene, camera, renderer, controls, mixer;
let clock = new THREE.Clock();
let currentPetGroup = new THREE.Group();
let animations = {};
let currentAnimAction = null;

const keys = { w: false, a: false, s: false, d: false, arrowup: false, arrowdown: false, arrowleft: false, arrowright: false };
let joystickVector = new THREE.Vector2(0, 0);

init3D();
buildSelector();
bindUI();
createJoystick();
animate();

function init3D() {
  const container = document.getElementById('stage');
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0xbdf0ff);
  scene.fog = new THREE.Fog(0xbdf0ff, 15, 50);

  camera = new THREE.PerspectiveCamera(45, container.clientWidth / container.clientHeight, 0.1, 100);
  camera.position.set(0, 5, 10);

  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.shadowMap.enabled = true;
  container.appendChild(renderer.domElement);

  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;

  // 🌿 잔디밭 퀄리티 향상
  const loader = new THREE.TextureLoader();
  const grassTex = loader.load('https://raw.githubusercontent.com/mrdoob/three.js/master/examples/textures/terrain/grasslight-big.jpg');
  grassTex.wrapS = grassTex.wrapT = THREE.RepeatWrapping;
  grassTex.repeat.set(20, 20);
  const plane = new THREE.Mesh(new THREE.PlaneGeometry(100, 100), new THREE.MeshStandardMaterial({ map: grassTex }));
  plane.rotation.x = -Math.PI / 2;
  plane.receiveShadow = true;
  scene.add(plane);

  scene.add(new THREE.HemisphereLight(0xffffff, 0x444444, 1.0));
  const dirLight = new THREE.DirectionalLight(0xffffff, 1.2);
  dirLight.position.set(5, 10, 5);
  dirLight.castShadow = true;
  scene.add(dirLight);

  scene.add(currentPetGroup);
  
  window.addEventListener('keydown', (e) => { const k = e.key.toLowerCase(); if (keys.hasOwnProperty(k)) keys[k] = true; });
  window.addEventListener('keyup', (e) => { const k = e.key.toLowerCase(); if (keys.hasOwnProperty(k)) keys[k] = false; });
  
  loadPet(S.petKey);
}

/* ---- 2. 고퀄리티 아이템 소환 (레이어드 모델링) ---- */
function spawnItem(type) {
  const group = new THREE.Group();
  
  if (type === 'fish') {
    // 🐟 물고기: 몸통 + 꼬리 + 눈
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.15, 0.4, 4, 12), new THREE.MeshStandardMaterial({ color: 0x44aaff, metalness: 0.5 }));
    body.rotation.z = Math.PI/2;
    const tail = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.25, 3), new THREE.MeshStandardMaterial({ color: 0x0066ff }));
    tail.position.x = -0.3; tail.rotation.z = Math.PI/2;
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.04, 8, 8), new THREE.MeshStandardMaterial({ color: 0x000000 }));
    eye.position.set(0.2, 0.05, 0.1);
    group.add(body, tail, eye);
  } else if (type === 'cake') {
    // 🍰 케이크: 빵층 + 크림 + 체리
    const cakeBase = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.35, 0.25, 20), new THREE.MeshStandardMaterial({ color: 0xfff0d0 }));
    const cream = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.05, 20), new THREE.MeshStandardMaterial({ color: 0xffffff }));
    cream.position.y = 0.12;
    const cherry = new THREE.Mesh(new THREE.SphereGeometry(0.08, 12, 12), new THREE.MeshStandardMaterial({ color: 0xff0000 }));
    cherry.position.y = 0.2;
    group.add(cakeBase, cream, cherry);
  } else if (type === 'toy') {
    // ⚽ 공: 디테일 와이어프레임 결합
    const ball = new THREE.Mesh(new THREE.IcosahedronGeometry(0.3, 1), new THREE.MeshStandardMaterial({ color: 0xffffff }));
    const outline = new THREE.Mesh(new THREE.IcosahedronGeometry(0.305, 1), new THREE.MeshStandardMaterial({ color: 0x000000, wireframe: true }));
    group.add(ball, outline);
  }

  group.position.copy(currentPetGroup.position).add(new THREE.Vector3(Math.sin(currentPetGroup.rotation.y)*1.5, 0.5, Math.cos(currentPetGroup.rotation.y)*1.5));
  scene.add(group);

  // 애니메이션 (회전하며 통통 튀기)
  const start = Date.now();
  const iid = setInterval(() => {
    const elapsed = (Date.now() - start) / 1000;
    group.position.y = 0.5 + Math.abs(Math.sin(elapsed * 4)) * 0.4;
    group.rotation.y += 0.05;
    if (elapsed > 3) { clearInterval(iid); scene.remove(group); }
  }, 16);
}

/* ---- 3. 상호작용 및 애니메이션 컨트롤 (잠자기 수정) ---- */
function playAnim(n) {
  if (!mixer || !animations[n]) return;
  if (currentAnimAction === animations[n]) return;
  
  if (currentAnimAction) currentAnimAction.fadeOut(0.3);
  const action = animations[n];
  action.reset().setEffectiveTimeScale(n === 'idle' ? 0.6 : 1.0).fadeIn(0.3).play();
  currentAnimAction = action;
}

function bindUI() {
  window.doAction = (act) => {
    S.action = act;
    if (act === 'feed') { spawnItem('fish'); playAnim('run'); }
    else if (act === 'play') { spawnItem('toy'); playAnim('run'); }
    else if (act === 'sleep') { 
      // 잠자기: 애니메이션 중단(정지) 혹은 idle의 아주 느린 속도로 구현
      if (animations.idle) animations.idle.timeScale = 0.1; 
      showNotif("💤 쿨쿨 자고 있어요...");
    }
    else if (act === 'wash') { createBubbles(); }

    setTimeout(() => { 
      if (act === 'sleep' && animations.idle) animations.idle.timeScale = 0.6;
      S.action = null; 
    }, 4000);
  };
  
  window.buyItem = (id, emoji) => { spawnItem(id); showNotif(`${emoji} 구매 완료!`); };
  window.chPet = (key) => loadPet(key);
}

function createBubbles() {
  for(let i=0; i<15; i++) {
    const b = new THREE.Mesh(new THREE.SphereGeometry(Math.random()*0.1+0.05, 8, 8), new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0.5 }));
    b.position.copy(currentPetGroup.position).add(new THREE.Vector3((Math.random()-0.5)*2, 1, (Math.random()-0.5)*2));
    scene.add(b);
    setTimeout(() => scene.remove(b), 1000 + Math.random()*1000);
  }
}

/* ---- 4. 메인 루프 (이동/정지 판정) ---- */
function animate() {
  requestAnimationFrame(animate);
  const dt = clock.getDelta();
  if (mixer) mixer.update(dt);

  let moveDir = new THREE.Vector3(0, 0, 0);
  if (keys.w || keys.arrowup) moveDir.z -= 1;
  if (keys.s || keys.arrowdown) moveDir.z += 1;
  if (keys.a || keys.arrowleft) moveDir.x -= 1;
  if (keys.d || keys.arrowright) moveDir.x += 1;
  if (joystickVector.lengthSq() > 0.1) { moveDir.x = joystickVector.x; moveDir.z = joystickVector.y; }

  if (moveDir.lengthSq() > 0.1 && S.action !== 'sleep') {
    const camAngle = Math.atan2(camera.position.x - currentPetGroup.position.x, camera.position.z - currentPetGroup.position.z);
    moveDir.normalize().applyAxisAngle(new THREE.Vector3(0, 1, 0), camAngle);
    currentPetGroup.rotation.y = THREE.MathUtils.lerp(currentPetGroup.rotation.y, Math.atan2(moveDir.x, moveDir.z), 0.15);
    currentPetGroup.position.addScaledVector(moveDir, 4.5 * dt);
    playAnim('run');
  } else {
    if (!S.action || S.action === 'sleep') playAnim('idle');
  }

  controls.target.lerp(currentPetGroup.position, 0.1);
  controls.update();
  renderer.render(scene, camera);
}

/* ---- 5. 유틸리티 (로드/선택기/조이스틱) ---- */
function loadPet(key) {
  const l = document.getElementById('loading'); if(l) l.style.display='flex';
  currentPetGroup.clear(); mixer = null; animations = {};
  const info = FRIENDS.find(f => f.key === key);
  const loader = new GLTFLoader();
  loader.load(info.local, (gltf) => { 
    setupModel(gltf); if(l) l.style.display='none'; 
  }, undefined, () => {
    if(info.url) loader.load(info.url, (g) => { setupModel(g); if(l) l.style.display='none'; }, undefined, () => { createFallback(info.proc); if(l) l.style.display='none'; });
    else { createFallback(info.proc); if(l) l.style.display='none'; }
  });
}

function setupModel(gltf) {
  const model = gltf.scene;
  model.traverse(c => { if (c.isMesh) { c.castShadow = true; c.receiveShadow = true; } });
  const box = new THREE.Box3().setFromObject(model);
  const scale = 2.5 / box.getSize(new THREE.Vector3()).length();
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

function buildSelector() {
  const sel = document.getElementById('petSelector');
  if(!sel) return; sel.innerHTML = '';
  FRIENDS.forEach(f => {
    const btn = document.createElement('button');
    btn.className = 'pet-btn';
    btn.innerHTML = `<span>${f.emoji}</span>`;
    btn.onclick = () => { loadPet(f.key); S.petKey = f.key; };
    sel.appendChild(btn);
  });
}

function createJoystick() {
  const zone = document.createElement('div');
  zone.style = "position:absolute; bottom:40px; left:40px; width:120px; height:120px; background:rgba(255,255,255,0.2); border-radius:50%; z-index:1000; touch-action:none; display:flex; align-items:center; justify-content:center; border:2px solid rgba(255,255,255,0.3);";
  document.body.appendChild(zone);
  const stick = document.createElement('div');
  stick.style = "width:50px; height:50px; background:#fff; border-radius:50%;";
  zone.appendChild(stick);
  const move = (e) => {
    e.preventDefault(); const t = e.touches ? e.touches[0] : e;
    const r = zone.getBoundingClientRect();
    joystickVector.set((t.clientX - (r.left+60))/60, (t.clientY - (r.top+60))/60).clampLength(0, 1);
    stick.style.transform = `translate(${joystickVector.x*35}px, ${joystickVector.y*35}px)`;
  };
  const end = () => { joystickVector.set(0,0); stick.style.transform = `translate(0,0)`; };
  zone.addEventListener('touchstart', move); zone.addEventListener('touchmove', move); zone.addEventListener('touchend', end);
}

function createFallback(c) {
  const mesh = new THREE.Mesh(new THREE.CapsuleGeometry(0.5, 0.5, 4, 8), new THREE.MeshStandardMaterial({ color: c.body }));
  mesh.position.y = 0.75; currentPetGroup.add(mesh);
}

function showNotif(msg) {
  const n = document.createElement('div'); n.className = 'notif-popup'; n.innerText = msg;
  document.getElementById('notifLayer').appendChild(n); setTimeout(() => n.remove(), 2500);
}