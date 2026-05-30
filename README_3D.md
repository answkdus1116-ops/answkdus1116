# 🌸 내 친구 동물 농장 3D — 사용 설명서

2D 손그림 대신 **진짜 3D 캐릭터 + 3D 잔디밭**으로 바꾼 버전입니다.
모두 무료(설치 불필요)로 동작하고, 원하면 더 예쁜 무료 CC0 모델로 업그레이드할 수 있어요.

---

## 1. 바로 실행하기 (다운로드 없이도 동작)

3D 버전은 ES 모듈과 모델 파일을 쓰기 때문에 **반드시 작은 서버로 열어야** 합니다.
(파일을 더블클릭해서 여는 방식은 브라우저 보안 때문에 동작하지 않습니다.)

```bash
node serve.js
```

그다음 브라우저에서 **http://localhost:8080/** 접속.
태블릿은 노트북과 같은 와이파이에서 **http://<노트북IP>:8080/** 로 접속하세요.

- 끌기 = 빙글빙글 3D 회전 / 두 손가락 = 확대·축소 / 톡 = 쓰다듬기
- 다운로드 없이도 **귀여운 toon 3D 동물 + 흔들리는 잔디밭**이 바로 나옵니다.
- 인터넷이 연결돼 있으면 **여우(🦊)**는 진짜 애니메이션 모델(Khronos Fox)이 즉시 표시됩니다.

> Three.js 라이브러리는 CDN에서 불러옵니다. 첫 실행 때 인터넷이 필요해요.
> 완전 오프라인으로 쓰려면 아래 4번을 참고하세요.

---

## 2. 더 예쁜 무료 모델로 업그레이드 (선택)

캐릭터를 고퀄 CC0 모델로 바꾸려면 아래에서 받아 `models/` 폴더에 넣기만 하면 됩니다.

### 다운로드 링크 (모두 무료·상업적 사용 가능 CC0)

- **Quaternius — Animated Animal Pack** (12종, 글TF, 한 번에 받기)
  https://poly.pizza/bundle/Animated-Animal-Pack-ILAPXeUYiS  → **Download GLTF** 버튼
- 또는 제작자 사이트:
  https://quaternius.com/packs/ultimateanimatedanimals.html

이 팩에 들어있는 동물: Cow, Donkey, Deer, Alpaca, Bull, Fox, Shiba Inu, Stag, Husky, Wolf, White Horse, Horse
(고양이·토끼·곰은 없어서, 이 앱은 귀여운 **여우·강아지(Shiba)·알파카·사슴**으로 맞춰 두었어요.)

### 파일 넣는 방법

프로젝트 폴더 안에 `models/` 폴더를 만들고, 받은 파일을 **아래 이름으로** 넣으세요(`.glb` 권장):

```
animal-farm/
├─ farm3d.html
├─ farm3d.js
├─ farm3d.css
├─ serve.js
└─ models/
   ├─ Fox.glb       ← 여우
   ├─ Shiba.glb     ← 강아지
   ├─ Alpaca.glb    ← 알파카
   └─ Deer.glb      ← 사슴
```

- 파일이 있으면 자동으로 그 모델을 우선 사용하고, 없으면 toon 폴백이 나옵니다.
- 받은 파일이 `.gltf` + `.bin` + 텍스처 형태라면, poly.pizza의 각 동물 페이지에서 **GLB**로 받는 게 가장 간단합니다.
- 다른 동물로 바꾸고 싶으면 `farm3d.js` 맨 위 `FRIENDS` 배열의 `local`/`kr`/`emoji`만 수정하면 됩니다.
  (어떤 `.glb`든 넣고 경로만 맞추면 됩니다.)
- 동물마다 들어있는 애니메이션 이름은 실행 후 브라우저 콘솔(F12)에 자동으로 찍힙니다.
  앱은 이름을 보고 idle/run/eat 등을 알아서 골라 동작에 연결합니다.

---

## 3. 동작 / 효과 안내

| 버튼 | 하는 일 | 효과 |
|------|---------|------|
| 🍖 밥주기 | 배고픔 회복 | 밥그릇 + 냠냠 소리, 머리 끄덕 |
| ⚽ 놀기 | 행복 상승 | **진짜 3D 공**이 통통, 캐릭터 점프 |
| 💤 재우기 | 건강 회복 | Zzz, 눈 감고 숨쉬기 |
| 🛁 씻기기 | 건강·청결 | 샤워기 + 물방울 + 비눗방울 |

- 효과음은 코드로 합성해서 냅니다(음원 파일 불필요, 오프라인 OK).
- 우측 대화창에서 버튼을 누르거나 직접 입력해 친구와 이야기할 수 있어요.

---

## 4. 완전 오프라인으로 쓰고 싶다면 (선택)

학교 와이파이가 불안정하면 Three.js를 내려받아 로컬에 둘 수 있습니다.

1. 아래 두 파일을 받아 프로젝트 안 `vendor/` 같은 폴더에 저장
   - https://cdn.jsdelivr.net/npm/three@0.184.0/build/three.module.js
   - 그리고 `examples/jsm/controls/OrbitControls.js`, `examples/jsm/loaders/GLTFLoader.js`
2. `farm3d.html`의 `<script type="importmap">` 경로를 로컬 경로로 바꿔주세요.

여우 데모(원격 Fox.glb)도 오프라인에선 안 나오므로, 위 2번처럼 `models/Fox.glb`를 직접 넣어주세요.

---

## 5. 저작권 / 출처 (CC0 — 자유 사용)

- **Three.js** r0.184 — MIT License — https://threejs.org
- **동물 모델** — Quaternius, *Animated Animal Pack* — CC0 (Public Domain) — https://quaternius.com
- **여우 데모 모델** — Khronos *Fox* — 모델: PixelMannen (CC0) / 리깅·애니메이션: tomkranis (CC BY 4.0)
  https://github.com/KhronosGroup/glTF-Sample-Assets/tree/main/Models/Fox

모두 학교·교육용으로 자유롭게 사용 가능합니다. (Quaternius/Khronos 출처만 표기해두면 안전해요.)

---

## 6. 파일 목록

- `farm3d.html` / `farm3d.js` / `farm3d.css` — 3D 버전 (메인)
- `serve.js` — 실행용 작은 서버 (기본이 3D 버전)
- `animals.html` / `animals.js` / `animals.css` — 이전 2D 버전 (그대로 보존, `/animals.html` 로 접속 가능)
