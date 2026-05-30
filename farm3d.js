import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// 1. 상태 관리
const FRIENDS = [
  { key: 'fox', kr: '여우', emoji: '🦊', local: './models/Fox.glb', url: 'https://cdn.jsdelivr.net/gh/KhronosGroup/glTF-Sample-Assets@main/Models/Fox/glTF-Binary/Fox.glb', proc: { body: 0xff8a3d } }
];

let S = { petKey: 'fox', action: null, isMoving: false };
let scene, camera, renderer, controls, mixer;
let clock = new THREE.Clock();
let currentPetGroup = new THREE.Group();
let animations = {};
let currentAnimAction = null;

// 조이스틱 및 입력 상태
const keys = { w: false, a: false, s: false, d: false };
let joystickVector = new THREE.Vector2();

init3D();
bindUI();
animate();

function init3D() {
  const container = document.getElementById('stage');
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0xbdf0ff);

  camera = new THREE.PerspectiveCamera(45, container.clientWidth / container.clientHeight, 0.1, 100);
  camera.position.set(0, 5, 10);

  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.shadowMap.enabled = true;
  container.appendChild(renderer.domElement);

  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;

  // --- 입체적 잔디밭 구현 (API/무료 텍스처 활용) ---
  const texLoader = new THREE.TextureLoader();
  // 퀄리티 높은 무료 잔디 텍스처 (Poly Haven 제공 API 경로 활용 가능)
  const grassTex = texLoader.load('https://raw.githubusercontent.com/mrdoob/three.js/master/examples/textures/terrain/grasslight-big.jpg');
  grassTex.wrapS = grassTex.wrapT = THREE.RepeatWrapping;
  grassTex.repeat.set(20, 20);

  const planeGeo = new THREE.PlaneGeometry(100, 100, 10, 10);
  const planeMat = new THREE.MeshStandardMaterial({ 
    map: grassTex,
    normalScale: new THREE.Vector2(0.8, 0.8)
  });
  const plane = new THREE.Mesh(planeGeo, planeMat);
  plane.rotation.x = -Math.PI / 2;
  plane.receiveShadow = true;
  scene.add(plane);

  // 조명 설정
  scene.add(new THREE.HemisphereLight(0xffffff, 0x444444, 0.8));
  const dirLight = new THREE.DirectionalLight(0xffffff, 1.0);
  dirLight.position.set(5, 10, 5);
  dirLight.castShadow = true;
  scene.add(dirLight);

  scene.add(currentPetGroup);
  loadPet(S.petKey);

  // 태블릿용 조이스틱 레이어 추가
  createJoystick();
}

// 2. 태블릿 이동을 위한 가상 조이스틱 (UI 레이어)
function createJoystick() {
  const il = document.getElementById('il');
  const joyStick = document.createElement('div');
  joyStick.style = "position:absolute; bottom:40px; left:40px; width:100px; height:100px; background:rgba(255,255,255,0.3); border-radius:50%; touch-action:none;";
  il.appendChild(joyStick);

  const stick = document.createElement('div');
  stick.style = "position:absolute; top:30px; left:30px; width:40px; height:40px; background:#fff; border-radius:50%; transition: 0.1s;";
  joyStick.appendChild(stick);

  joyStick.addEventListener('touchmove', (e) => {
    const touch = e.touches[0];
    const rect = joyStick.getBoundingClientRect();
    const x = (touch.clientX - rect.left - 50) / 50;
    const y = (touch.clientY - rect.top - 50) / 50;
    joystickVector.set(x, y).clampLength(0, 1);
    stick.style.transform = `translate(${joystickVector.x * 30}px, ${joystickVector.y * 30}px)`;
    S.isMoving = true;
  });

  joyStick.addEventListener('touchend', () => {
    joystickVector.set(0, 0);
    stick.style.transform = `translate(0, 0)`;
    S.isMoving = false;
  });
}

// 3. 아이템 출현 기능 (상점 연동)
window.buyItem = (id, emoji) => {
  const itemGeo = new THREE.SphereGeometry(0.3, 16, 16);
  const itemMat = new THREE.MeshStandardMaterial({ color: id === 'fish' ? 0x3399ff : 0xffcc00 });
  const item = new THREE.Mesh(itemGeo, itemMat);
  
  // 캐릭터 앞에 아이템 소환
  const offset = new THREE.Vector3(0, 0, 1).applyQuaternion(currentPetGroup.quaternion);
  item.position.copy(currentPetGroup.position).add(offset).add(new THREE.Vector3(0, 0.5, 0));
  scene.add(item);

  // 3초 후 삭제
  setTimeout(() => scene.remove(item), 3000);
  showNotif(`${emoji} 아이템이 나타났어요!`);
};

function showNotif(msg) {
  const nl = document.getElementById('notifLayer');
  const div = document.createElement('div');
  div.className = 'notif-popup';
  div.innerText = msg;
  nl.appendChild(div);
  setTimeout(() => div.remove(), 2000);
}

function animate() {
  requestAnimationFrame(animate);
  const dt = clock.getDelta();
  if (mixer) mixer.update(dt);

  let moveDir = new THREE.Vector3(0, 0, 0);
  
  // PC 키보드 입력
  if (keys.w) moveDir.z -= 1;
  if (keys.s) moveDir.z += 1;
  if (keys.a) moveDir.x -= 1;
  if (keys.d) moveDir.x += 1;

  // 태블릿 조이스틱 입력 합산
  if (joystickVector.lengthSq() > 0) {
    moveDir.x = joystickVector.x;
    moveDir.z = joystickVector.y;
  }

  // 움직임 체크 및 애니메이션 전환 (방정맞음 방지)
  if (moveDir.lengthSq() > 0.01) {
    const camAngle = Math.atan2(camera.position.x - currentPetGroup.position.x, camera.position.z - currentPetGroup.position.z);
    moveDir.normalize().applyAxisAngle(new THREE.Vector3(0, 1, 0), camAngle);
    currentPetGroup.rotation.y = THREE.MathUtils.lerp(currentPetGroup.rotation.y, Math.atan2(moveDir.x, moveDir.z), 0.1);
    currentPetGroup.position.addScaledVector(moveDir, 5 * dt);
    playAnim('run');
  } else {
    playAnim('idle'); // 움직임이 없을 때만 대기 애니메이션
  }

  controls.target.lerp(currentPetGroup.position, 0.1);
  controls.update();
  renderer.render(scene, camera);
}

function bindUI() {
  window.doAction = (act) => {
    S.action = act;
    // 특정 동작 수행 시 애니메이션 강제 실행 로직 추가 가능
    showNotif(`${act} 동작을 시작합니다!`);
    setTimeout(() => S.action = null, 2000);
  };
  
  // HTML에서 사용하는 나머지 기능들(에러 방지용 빈 함수)
  window.renamePet = () => { const n = prompt('새 이름을 지어주세요!'); if(n) document.getElementById('petNameDisplay').innerText = n; };
  window.buyItem = (id, emoji) => alert(emoji + '를 구매했습니다!');
  window.toggleSound = (btn) => btn.innerText = btn.innerText === '🔊' ? '🔇' : '🔊';
  window.sendChat = () => { const i = document.getElementById('ci'); if(i.value) { i.value=''; alert('나중에 대화 기능이 업데이트될 예정이에요!'); } };
}