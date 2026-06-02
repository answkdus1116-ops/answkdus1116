/* 수족관 테마 — 물고기처럼 헤엄치고, 누르면 놀라서 달아남 */
(function () {
  class Fish extends Playground.Sprite {
    constructor(img, st) {
      super(img, st);
      this.vx = (Math.random() - 0.5) * 2.4;
      this.vy = (Math.random() - 0.5) * 1.6;
      this.wave = Math.random() * Math.PI * 2;
      this.scared = 0;
    }
    onTap() {
      this.scared = 60;
      this.vx *= -4.5; this.vy *= -4.5;
      const max = 11;
      this.vx = Math.max(-max, Math.min(max, this.vx || (Math.random() - .5) * 8));
      this.vy = Math.max(-max, Math.min(max, this.vy || (Math.random() - .5) * 8));
    }
    update() {
      this.wave += 0.06;
      this.x += this.vx;
      this.y += this.vy + Math.sin(this.wave) * 0.6;
      if (this.x < 0 || this.x + this.w > this.stage.width) this.vx *= -1;
      if (this.y < 0 || this.y + this.h > this.stage.height) this.vy *= -1;
      this.x = Math.max(0, Math.min(this.stage.width - this.w, this.x));
      this.y = Math.max(0, Math.min(this.stage.height - this.h, this.y));
      if (this.scared > 0 && --this.scared === 0) { this.vx *= 0.35; this.vy *= 0.35; }
    }
    draw(ctx) {
      ctx.save();
      ctx.shadowColor = 'rgba(0,40,60,0.3)'; ctx.shadowBlur = 14; ctx.shadowOffsetY = 6;
      if (this.vx < 0) {
        ctx.translate(this.x + this.w, this.y); ctx.scale(-1, 1);
        ctx.drawImage(this.img, 0, 0, this.w, this.h);
      } else {
        ctx.drawImage(this.img, this.x, this.y, this.w, this.h);
      }
      ctx.restore();
      if (this.scared > 0) {
        ctx.font = 'bold 38px Jua, Arial'; ctx.fillStyle = '#ffe066';
        ctx.strokeStyle = '#0d3b4a'; ctx.lineWidth = 3; ctx.textAlign = 'center';
        const cx = this.x + this.w / 2, cy = this.y - 8;
        ctx.strokeText('!', cx, cy); ctx.fillText('!', cx, cy);
      }
    }
  }

  Playground.init({
    key: 'aquarium',
    entryIcon: '🫧⭐🌿🐚',
    entryTitle: '자연쌤의 수족관',
    entryButton: '수족관 입장하기',
    headerTitle: '🐠 바닷속 놀이터',
    emptyHint: '사진을 올리면 물고기가 헤엄쳐요! 🐟',
    bgm: 'aquarium.mp3',
    bgImage: 'aquarium_background.png',
    bgFallback: '#1e5799',
    aiMsg: 'AI가 물고기를 오려내는 중...',
    particle: 'bubble', particleCount: 26,
    createSprite: (img, st) => new Fish(img, st),
  });
})();
