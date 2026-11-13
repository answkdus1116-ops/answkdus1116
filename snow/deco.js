/* =========================================================
   눈사람 꾸미기 조각 목록
   - oc- 로 시작하는 것은 openclipart 에서 받아온 CC0 그림입니다
   - 나머지는 이 앱을 위해 새로 그린 그림입니다 (마음껏 쓰셔도 됩니다)
   w  : 눈사람에 붙일 때의 가로 크기 (장면 좌표)
   ar : 세로/가로 비율
   dx,dy : 기준점에서 조금 옮기기 / rot : 기울이기
   ========================================================= */
(function () {
"use strict";

/* 눈사람 자리 (snowman.js 와 같은 값) */
const BODY = { x: 500, y: 470, r: 150 };
const HEAD = { x: 500, y: 243, r: 95 };

const HAT_Y = HEAD.y - HEAD.r + 16;       // 모자가 머리에 얹히는 자리
const NECK_Y = HEAD.y + HEAD.r - 4;       // 목도리 자리
const ARM_Y = BODY.y - BODY.r * .42;      // 팔이 붙는 높이

window.SNOW_DECO = {

  hat: {
    label: '🎩 모자',
    spots: () => [{ x: HEAD.x, y: HAT_Y }],
    items: [
      { f: 'hat-santa.svg',    w: 230, ar: 180 / 220, dy: -52, rot: -6 },
      { f: 'oc-santa-hat.svg', w: 250, ar: 299 / 372, dy: -56, dx: 16, rot: -6 },
      { f: 'hat-beanie.svg',   w: 215, ar: 180 / 220, dy: -56 },
      { f: 'hat-top.svg',      w: 225, ar: 170 / 220, dy: -50 },
      { f: 'hat-earmuff.svg',  w: 235, ar: 150 / 240, dy: -14 }
    ]
  },

  eye: {
    label: '👀 눈',
    /* 좌우 한 쌍 */
    spots: () => [{ x: HEAD.x - 34, y: HEAD.y - 22 }, { x: HEAD.x + 34, y: HEAD.y - 22 }],
    items: [
      { f: 'coal.svg',        w: 30, ar: 1 },
      { f: 'stone.svg',       w: 32, ar: 1 },
      { f: 'eyes-googly.svg', w: 36, ar: 1 }
    ]
  },

  nose: {
    label: '🥕 코',
    spots: () => [{ x: HEAD.x + 16, y: HEAD.y + 8 }],
    items: [
      { f: 'carrot-1.svg', w: 104, ar: 72 / 170, dx: 26, rot: 6 },
      { f: 'carrot-2.svg', w: 110, ar: 80 / 170, dx: 28, rot: 8 },
      { f: 'carrot-3.svg', w: 88,  ar: 78 / 130, dx: 20, rot: 5 }
    ]
  },

  mouth: {
    label: '😀 입',
    spots: () => [{ x: HEAD.x, y: HEAD.y + 48 }],
    items: [
      { f: 'smile-coal.svg',  w: 92, ar: 70 / 160 },
      { f: 'smile-happy.svg', w: 96, ar: 80 / 160 }
    ]
  },

  scarf: {
    label: '🧣 목도리',
    spots: () => [{ x: BODY.x, y: NECK_Y }],
    items: [
      { f: 'scarf-red.svg',   w: 250, ar: 230 / 260, dy: 42 },
      { f: 'scarf-blue.svg',  w: 250, ar: 230 / 260, dy: 42 },
      { f: 'scarf-green.svg', w: 250, ar: 230 / 260, dy: 42 },
      { f: 'scarf-cream.svg', w: 250, ar: 230 / 260, dy: 42 }
    ]
  },

  button: {
    label: '🔘 단추',
    /* 배에 셋 */
    spots: () => [{ x: BODY.x, y: BODY.y - 36 }, { x: BODY.x, y: BODY.y + 16 }, { x: BODY.x, y: BODY.y + 68 }],
    items: [
      { f: 'coal.svg',           w: 34, ar: 1 },
      { f: 'button-red.svg',     w: 38, ar: 1 },
      { f: 'button-wood.svg',    w: 38, ar: 1 },
      { f: 'oc-button-red.svg',  w: 40, ar: 1 },
      { f: 'oc-button-line.svg', w: 40, ar: 1 }
    ]
  },

  arm: {
    label: '🌿 나뭇가지 팔',
    spots: () => [{ x: BODY.x - BODY.r - 58, y: ARM_Y, flip: true, rot: 0 },
                  { x: BODY.x + BODY.r + 58, y: ARM_Y }],
    items: [
      { f: 'branch.svg',      w: 190, ar: 110 / 200, rot: -8 },
      { f: 'branch-dark.svg', w: 200, ar: 110 / 200, rot: -12 }
    ]
  },

  glove: {
    label: '🧤 장갑',
    spots: () => [{ x: BODY.x - BODY.r - 110, y: ARM_Y - 20, flip: true },
                  { x: BODY.x + BODY.r + 110, y: ARM_Y - 20 }],
    items: [
      { f: 'mitten-red.svg',  w: 74, ar: 160 / 130, rot: 62 },
      { f: 'mitten-blue.svg', w: 74, ar: 160 / 130, rot: 62 },
      { f: 'oc-mitt.svg',     w: 80, ar: 1, rot: 62 }
    ]
  }
};
})();
