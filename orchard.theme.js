/* 과수원 테마 — 열매가 나무 영역에 매달려 흔들리다가, 누르면 떨어져 통통 튐 */
(function () {
  // 화면 비율과 무관하게 위치를 유지하기 위해 상대좌표(0~1) 사용
  const TREE_ZONES = [
    { x: [0.16, 0.36], y: [0.30, 0.58] },
    { x: [0.40, 0.60], y: [0.26, 0.62] },
    { x: [0.64, 0.84], y: [0.30, 0.58] },
  ];

  class Fruit extends Playground.Sprite {
    constructor(img, st) {
      super(img, st);
      const z = TREE_ZONES[(Math.random() * TREE_ZONES.length) | 0];
      this.relX = z.x[0] + Math.random() * (z.x[1] - z.x[0]);
      this.relY = z.y[0] + Math.random() * (z.y[1] - z.y[0]);
      this.angle = Math.random() * Math.PI * 2;
      this.swing = 0.012 + Math.random() * 0.016;
      this.range = 0.06 + Math.random() * 0.08;
      this.falling = false; this.vy = 0;
      this.sync();
    }
    sync() {
      this.x = this.relX * this.stage.width;
      this.y = this.relY * this.stage.height;
      this.ground = this.stage.height * 0.84 - this.h;
    }
    onResize() { this.sync(); }
    onTap() { if (!this.falling) { this.falling = true; this.vy = 2; } }
    update() {
      if (this.falling) {
        this.vy += 0.6; this.y += this.vy;
        if (this.y > this.ground) {
          this.y = this.ground; this.vy *= -0.32;
          if (Math.abs(this.vy) < 1.2) { this.vy = 0; this.falling = false; }
        }
        this.relY = this.y / this.stage.height;
      } else if (this.y < this.ground - 8) {
        this.angle += this.swing;
      }
    }
    draw(ctx) {
      ctx.save();
      ctx.shadowColor = 'rgba(60,20,0,0.28)'; ctx.shadowBlur = 12; ctx.shadowOffsetY = 6;
      if (!this.falling && this.y < this.ground - 4) {
        // 가지에 매달려 흔들림 (윗부분을 축으로 회전)
        ctx.translate(this.x + this.w / 2, this.y);
        ctx.rotate(Math.sin(this.angle) * this.range);
        ctx.drawImage(this.img, -this.w / 2, 0, this.w, this.h);
      } else {
        ctx.drawImage(this.img, this.x, this.y, this.w, this.h);
      }
      ctx.restore();
    }
    hitTest(px, py) {
      // 흔들릴 때 회전 중심 보정
      return px > this.x && px < this.x + this.w && py > this.y && py < this.y + this.h;
    }
  }

  Playground.init({
    key: 'orchard',
    entryIcon: '🍎🌿🧺',
    entryTitle: '자연쌤의 과수원',
    entryButton: '과수원 입장하기',
    headerTitle: '🍎 열매 놀이터',
    emptyHint: '사진을 올리면 나무에 열매가 열려요! 🍎',
    bgm: 'orchard.mp3',
    bgImage: 'orchard_background.png',
    bgFallback: '#bfe39a',
    aiMsg: 'AI가 열매를 오려내는 중...',
    particle: 'petal', particleCount: 16,
    createSprite: (img, st) => new Fruit(img, st),
    onResize: (s) => s.onResize && s.onResize(),
  });
})();
