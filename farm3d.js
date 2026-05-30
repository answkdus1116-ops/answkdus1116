import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

/* ---- 1. 데이터 설정 (모든 친구들 복구) ---- */
const FRIENDS = [
  { key: 'fox', kr: '여우', emoji: '🦊', local: './models/Fox.glb', url: 'https://cdn.jsdelivr.net/gh/KhronosGroup/glTF-Sample-Assets@main/Models/Fox/glTF-Binary/Fox.glb', proc: { body: 0xff8a3d } },
  { key: 'Alpaca', kr: '알파카', emoji: '🦙', local: './models/Alpaca.glb', url: null, proc: { body: 0xe8b870 } },
  { key: 'Cow', kr: '소', emoji: '🐮', local: './models/Cow.glb', url: null, proc: { body: 0xffb3d1 } },
  { key: 'Deer', kr: '사슴', emoji: '🦌', local: './models/Deer.glb', url: null, proc: { body: 0xdce0ff } }
];

let S = { petKey: 'fox', action: null };
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

  // 🌿 고해상도 잔디 텍스처 (무료 API 소스)
  const texLoader = new THREE.TextureLoader();
  const grassTex = texLoader.load('https://raw.githubusercontent.com/mrdoob/three.js/master/examples/textures/terrain/grasslight-big.jpg');
  grassTex.wrapS = grassTex.wrapT = THREE.RepeatWrapping;
  grassTex.repeat.set(20, 20);

  const plane = new THREE.Mesh(
    new THREE.PlaneGeometry(100, 100),
    new THREE.MeshStandardMaterial({ map: grassTex, roughness: 0.9 })
  );
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

/* ---- 2. 아이템 생성 시스템 (단색 도형 탈피) ---- */
function spawnItem(type) {
  let item;
  const group = new THREE.Group();

  switch(type) {
    case 'fish': // 🐟 물고기 형태 조합
      const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.2, 0.4, 4, 8), new THREE.MeshStandardMaterial({ color: 0x33ccff, metalness: 0.6 }));
      body.rotation.z = Math.PI/2;
      const tail = new THREE.Mesh(new THREE.ConeGeometry(0.15, 0.3, 3), new THREE.MeshStandardMaterial({ color: 0x0099ff }));
      tail.position.x = -0.3; tail.rotation.z = Math.PI/2;
      group.add(body, tail);
      break;

    case 'cake': // 🍰 케이크 (층 레이어)
      const base = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.2, 20), new THREE.MeshStandardMaterial({ color: 0xffffff }));
      const topping = new THREE.Mesh(new THREE.SphereGeometry(0.1, 16, 16), new THREE.MeshStandardMaterial({ color: 0xff3366 }));
      topping.position.y = 0.15;
      group.add(base, topping);
      break;

    case 'toy': // ⚽ 축구공 (와이어프레임 혼합)
      item = new THREE.Mesh(new THREE.SphereGeometry(0.3, 12, 12), new THREE.MeshStandardMaterial({ color: 0xffffff, wireframe: false }));
      const patches = new THREE.Mesh(new THREE.SphereGeometry(0.31, 8, 8), new THREE.MeshStandardMaterial({ color: 0x333333, wireframe: true }));
      group.add(item, patches);
      break;

    case 'vitamin': // 💊 비타민 (두 가지 색 캡슐)
      const v1 = new THREE.Mesh(new THREE.SphereGeometry(0.15, 16, 16), new THREE.MeshStandardMaterial({ color: 0xffcc00 }));
      const v2 = new THREE.Mesh(new THREE.SphereGeometry(0.15, 16, 16), new THREE.MeshStandardMaterial({ color: 0xffffff }));
      v1.position.x = -0.12; v2.position.x = 0.12;
      group.add(v1, v2);
      break;
  }

  // 캐릭터 앞 위치 계산
  const angle = currentPetGroup.rotation.y;
  group.position.set(
    currentPetGroup.position.x + Math.sin(angle) * 1.5,
    0.5,
    currentPetGroup.position.z + Math.cos(angle) * 1.5
  );
  
  scene.add(group);

  // 애니메이션 효과 (통통 튀기 + 회전)
  const startTime = Date.now();
  const anim = setInterval(() => {
    const elapsed = (Date.now() - startTime) / 1000;
    group.position.y = 0.5 + Math.abs(Math.sin(elapsed * 5) * 0.3);
    group.rotation.y += 0.05;
    
    if(elapsed > 3) {
      clearInterval(anim);
      scene.remove(group);
    }
  }, 16);
}

/* ---- 3. 상호작용 로직 ---- */
function bindUI() {
  window.doAction = (act) => {
    if (S.action) return;
    S.action = act;
    
    if (act === 'feed') { playAnim('run'); spawnItem('fish'); }
    else if (act === 'play') { playAnim('run'); spawnItem('toy'); }
    else if (act === 'sleep') { playAnim('idle'); }
    else if (act === 'wash') { playAnim('idle'); createBubbles(); }

    setTimeout(() => { S.action = null; }, 2500);
  };

  window.buyItem = (id, emoji) => {
    spawnItem(id);
    showNotif(`${emoji} 아이템을 사용했습니다!`);
  };
}

function createBubbles() { // 🛁 씻기기 전용 비눗방울 효과
  for(let i=0; i<10; i++) {
    const b = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 8), new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0.6 }));
    b.position.copy(currentPetGroup.position).add(new THREE.Vector3((Math.random()-0.5)*2, 1.5, (Math.random()-0.5)*2));
    scene.add(b);
    setTimeout(() => scene.remove(b), 1500);
  }
}

function showNotif(msg) {
  const n = document.createElement('div');
  n.className = 'notif-popup';
  n.innerText = msg;
  document.getElementById('notifLayer').appendChild(n);
  setTimeout(() => n.remove(), 2000);
}

/* ---- 4. 나머지 핵심 함수들 (이동 및 로드) ---- */
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

  if (moveDir.lengthSq() > 0.05 && S.action !== 'sleep') {
    const camAngle = Math.atan2(camera.position.x - currentPetGroup.position.x, camera.position.z - currentPetGroup.position.z);
    moveDir.normalize().applyAxisAngle(new THREE.Vector3(0, 1, 0), camAngle);
    currentPetGroup.rotation.y = THREE.MathUtils.lerp(currentPetGroup.rotation.y, Math.atan2(moveDir.x, moveDir.z), 0.15);
    currentPetGroup.position.addScaledVector(moveDir, 4.5 * dt);
    playAnim('run');
  } else {
    if (!S.action) playAnim('idle');
  }

  controls.target.lerp(currentPetGroup.position, 0.1);
  controls.update();
  renderer.render(scene, camera);
}

function loadPet(key) {
  const loaderUI = document.getElementById('loading');
  if(loaderUI) loaderUI.style.display = 'flex';
  currentPetGroup.clear();
  const info = FRIENDS.find(f => f.key === key);
  const loader = new GLTFLoader();
  loader.load(info.local, (gltf) => { 
    setupModel(gltf); 
    if(loaderUI) loaderUI.style.display = 'none';
  }, undefined, () => {
     if(info.url) loader.load(info.url, (g) => { setupModel(g); if(loaderUI) loaderUI.style.display='none'; }, undefined, () => { createFallback(info.proc); if(loaderUI) loaderUI.style.display='none'; });
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
  sel.innerHTML = '';
  FRIENDS.forEach(f => {
    const btn = document.createElement('button');
    btn.className = 'pet-btn';
    btn.innerHTML = `<span>${f.emoji}</span>`;
    btn.onclick = () => loadPet(f.key);
    sel.appendChild(btn);
  });
}

function createJoystick() {
  const joyZone = document.createElement('div');
  joyZone.style = "position:absolute; bottom:40px; left:40px; width:120px; height:120px; background:rgba(255,255,255,0.2); border-radius:50%; z-index:1000; touch-action:none; display:flex; align-items:center; justify-content:center; border:2px solid rgba(255,255,255,0.3);";
  document.body.appendChild(joyZone);
  const stick = document.createElement('div');
  stick.style = "width:50px; height:50px; background:#fff; border-radius:50%; box-shadow:0 4px 10px rgba(0,0,0,0.2); transition: transform 0.1s;";
  joyZone.appendChild(stick);

  const move = (e) => {
    e.preventDefault();
    const t = e.touches ? e.touches[0] : e;
    const r = joyZone.getBoundingClientRect();
    const x = (t.clientX - (r.left + r.width/2)) / (r.width/2);
    const y = (t.clientY - (r.top + r.height/2)) / (r.height/2);
    joystickVector.set(x, y).clampLength(0, 1);
    stick.style.transform = `translate(${joystickVector.x * 35}px, ${joystickVector.y * 35}px)`;
  };
  const end = () => { joystickVector.set(0, 0); stick.style.transform = `translate(0,0)`; };
  joyZone.addEventListener('touchstart', move); joyZone.addEventListener('touchmove', move); joyZone.addEventListener('touchend', end);
}

function createFallback(c) {
  const mesh = new THREE.Mesh(new THREE.CapsuleGeometry(0.5, 0.5, 4, 8), new THREE.MeshStandardMaterial({ color: c.body }));
  mesh.position.y = 0.75;
  currentPetGroup.add(mesh);
}