import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

/* ---- 1. 데이터 설정 ---- */
const FRIENDS = [
  { key: 'fox', kr: '여우', emoji: '🦊', local: './models/Fox.glb', url: 'https://cdn.jsdelivr.net/gh/KhronosGroup/glTF-Sample-Assets@main/Models/Fox/glTF-Binary/Fox.glb', proc: { body: 0xff8a3d } },
  { key: 'Alpaca', kr: '알파카', emoji: '🦙', local: './models/Alpaca.glb', url: null, proc: { body: 0xe8b870 } },
  { key: 'Cow', kr: '소', emoji: '🐮', local: './models/Cow.glb', url: null, proc: { body: 0xffb3d1 } },
  { key: 'Deer', kr: '사슴', emoji: '🦌', local: './models/Deer.glb', url: null, proc: { body: 0xdce0ff } }
];

let S = { petKey: 'fox', action: null };
let scene, camera, renderer, controls, mixer;
let clock = new THREE.Clock(); // Timer 대신 안정적인 Clock 사용
let currentPetGroup = new THREE.Group();
let animations = {};
let currentAnimAction = null;
const keys = { w: false, a: false, s: false, d: false, arrowup: false, arrowdown: false, arrowleft: false, arrowright: false };

/* ---- 2. 실행 루틴 ---- */
init3D();
bindUI();
animate();

function init3D() {
  const container = document.createElement('div');
  container.style.position = 'absolute'; container.style.inset = '0'; container.style.zIndex = '-1';
  document.body.appendChild(container);

  scene = new THREE.Scene();
  scene.background = new THREE.Color(0xbdf0ff);

  camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 100);
  camera.position.set(0, 4, 8);

  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
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

  // 이벤트 리스너 (WASD 이동용)
  window.addEventListener('keydown', (e) => { const k = e.key.toLowerCase(); if (keys.hasOwnProperty(k)) keys[k] = true; });
  window.addEventListener('keyup', (e) => { const k = e.key.toLowerCase(); if (keys.hasOwnProperty(k)) keys[k] = false; });
  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  loadPet(S.petKey);
}

function loadPet(key) {
  currentPetGroup.clear();
  mixer = null;
  animations = {};
  const info = FRIENDS.find(f => f.key === key);
  const loader = new GLTFLoader();

  loader.load(info.local, 
    (gltf) => { setupModel(gltf); },
    undefined,
    () => {
      if (info.url) loader.load(info.url, setupModel, undefined, () => createFallback(info.proc));
      else createFallback(info.proc);
    }
  );
}

function setupModel(gltf) {
  const model = gltf.scene;
  model.traverse(c => { if (c.isMesh) c.castShadow = true; });
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
  const dt = clock.getDelta(); // Clock을 사용하여 일관된 프레임 계산
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

function bindUI() {
  window.doAction = (act) => {
    if (act === 'feed') playAnim('run');
    setTimeout(() => playAnim('idle'), 2000);
  };
  window.chPet = (key) => loadPet(key);
}
