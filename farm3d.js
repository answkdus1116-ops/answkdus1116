import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

/* ---- 1. 데이터 및 상태 설정 ---- */
const FRIENDS = [
  { key: 'fox', kr: '여우', emoji: '🦊', local: './models/Fox.glb', url: 'https://cdn.jsdelivr.net/gh/KhronosGroup/glTF-Sample-Assets@main/Models/Fox/glTF-Binary/Fox.glb', proc: { body: 0xff8a3d } },
  { key: 'Alpaca', kr: '알파카', emoji: '🦙', local: './models/Alpaca.glb', url: null, proc: { body: 0xe8b870 } },
  { key: 'Cow', kr: '소', emoji: '🐮', local: './models/Cow.glb', url: null, proc: { body: 0xffb3d1 } },
  { key: 'Deer', kr: '사슴', emoji: '🦌', local: './models/Deer.glb', url: null, proc: { body: 0xdce0ff } }
];

let S = { petKey: 'fox', action: null, name: '모찌' };
let scene, camera, renderer, controls, mixer;
let clock = new THREE.Clock();
let currentPetGroup = new THREE.Group();
let animations = {};
let currentAnimAction = null;
const keys = { w: false, a: false, s: false, d: false, arrowup: false, arrowdown: false, arrowleft: false, arrowright: false };

/* ---- 2. 초기화 실행 ---- */
init3D();
buildSelector(); // 동물 선택 버튼 생성
bindUI();
animate();

function init3D() {
  const container = document.getElementById('stage'); // HTML의 stage 안에 렌더링
  
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0xbdf0ff);

  camera = new THREE.PerspectiveCamera(45, container.clientWidth / container.clientHeight, 0.1, 100);
  camera.position.set(0, 4, 8);

  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.shadowMap.enabled = true;
  container.appendChild(renderer.domElement);

  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;

  scene.add(currentPetGroup);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x444444, 0.6));
  const dirLight = new THREE.DirectionalLight(0xffffff, 1.2);
  dirLight.position.set(5, 10, 5);
  dirLight.castShadow = true;
  scene.add(dirLight);

  const plane = new THREE.Mesh(new THREE.PlaneGeometry(100, 100), new THREE.MeshStandardMaterial({ color: 0x8cd977 }));
  plane.rotation.x = -Math.PI / 2;
  plane.receiveShadow = true;
  scene.add(plane);

  // 이벤트 리스너
  window.addEventListener('keydown', (e) => { const k = e.key.toLowerCase(); if (keys.hasOwnProperty(k)) keys[k] = true; });
  window.addEventListener('keyup', (e) => { const k = e.key.toLowerCase(); if (keys.hasOwnProperty(k)) keys[k] = false; });
  window.addEventListener('resize', () => {
    camera.aspect = container.clientWidth / container.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(container.clientWidth, container.clientHeight);
  });
  
  loadPet(S.petKey);
}

function loadPet(key) {
  const loaderUI = document.getElementById('loading');
  if(loaderUI) loaderUI.style.display = 'flex'; // 로딩창 표시

  currentPetGroup.clear();
  mixer = null;
  animations = {};
  const info = FRIENDS.find(f => f.key === key);
  const loader = new GLTFLoader();

  loader.load(info.local, 
    (gltf) => { setupModel(gltf); hideLoading(); },
    undefined,
    () => {
      if (info.url) loader.load(info.url, (gltf) => { setupModel(gltf); hideLoading(); }, undefined, () => { createFallback(info.proc); hideLoading(); });
      else { createFallback(info.proc); hideLoading(); }
    }
  );
}

function hideLoading() {
  const loaderUI = document.getElementById('loading');
  if(loaderUI) loaderUI.style.display = 'none'; // 로딩창 숨기기
}

function setupModel(gltf) {
  const model = gltf.scene;
  model.traverse(c => { if (c.isMesh) c.castShadow = true; });
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

function createFallback(c) {
  const mesh = new THREE.Mesh(new THREE.CapsuleGeometry(0.5, 0.5, 4, 8), new THREE.MeshStandardMaterial({ color: c.body }));
  mesh.position.y = 0.75;
  currentPetGroup.add(mesh);
}

function playAnim(n) {
  if (!mixer || !animations[n]) return;
  if (currentAnimAction === animations[n]) return;
  if (currentAnimAction) currentAnimAction.fadeOut(0.2);
  animations[n].reset().fadeIn(0.2).play();
  currentAnimAction = animations[n];
}

function animate() {
  requestAnimationFrame(animate);
  const dt = clock.getDelta();
  if (mixer) mixer.update(dt);

  let moveDir = new THREE.Vector3(0, 0, 0);
  if (keys.w || keys.arrowup) moveDir.z -= 1;
  if (keys.s || keys.arrowdown) moveDir.z += 1;
  if (keys.a || keys.arrowleft) moveDir.x -= 1;
  if (keys.d || keys.arrowright) moveDir.x += 1;

  if (moveDir.lengthSq() > 0) {
    const camAngle = Math.atan2(camera.position.x - currentPetGroup.position.x, camera.position.z - currentPetGroup.position.z);
    moveDir.normalize().applyAxisAngle(new THREE.Vector3(0, 1, 0), camAngle);
    currentPetGroup.rotation.y = Math.atan2(moveDir.x, moveDir.z);
    currentPetGroup.position.addScaledVector(moveDir, 4.0 * dt);
    playAnim('run');
  } else {
    playAnim('idle');
  }

  controls.target.lerp(currentPetGroup.position, 0.1);
  controls.update();
  renderer.render(scene, camera);
}

function buildSelector() {
  const sel = document.getElementById('petSelector');
  if(!sel) return;
  sel.innerHTML = '';
  FRIENDS.forEach(f => {
    const btn = document.createElement('button');
    btn.className = 'pet-btn' + (f.key === S.petKey ? ' active' : '');
    btn.innerHTML = `<span class="pet-emoji">${f.emoji}</span><span>${f.kr}</span>`;
    btn.onclick = () => { 
      S.petKey = f.key; 
      document.querySelectorAll('.pet-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      loadPet(f.key); 
    };
    sel.appendChild(btn);
  });
}

function bindUI() {
  window.doAction = (act) => {
    if (act === 'feed') playAnim('run');
    setTimeout(() => playAnim('idle'), 2000);
  };
  // HTML에서 사용하는 나머지 기능들(에러 방지용 빈 함수)
  window.renamePet = () => { const n = prompt('새 이름을 지어주세요!'); if(n) document.getElementById('petNameDisplay').innerText = n; };
  window.buyItem = (id, emoji) => alert(emoji + '를 구매했습니다!');
  window.toggleSound = (btn) => btn.innerText = btn.innerText === '🔊' ? '🔇' : '🔊';
  window.sendChat = () => { const i = document.getElementById('ci'); if(i.value) { i.value=''; alert('나중에 대화 기능이 업데이트될 예정이에요!'); } };
}