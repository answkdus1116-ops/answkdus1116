/* 숲속 테마 — 새처럼 날갯짓하며 날아다니고, 누르면 화들짝 날아감 */
(function () {
  class Bird extends Playground.Sprite {
    constructor(img, st) {
      super(img, st);
      this.vx = (Math.random() - 0.5) * 3.2;
      this.vy = (Math.random() - 0.5) * 1.4;
      this.flap = Math.random() * Math.PI * 2;
      this.scared = 0;
    }
    onTap() {
      this.scared = 60;
      this.vx *= -5; this.vy = -Math.abs(this.vy) * 5 - 2; // 위로 화들짝
      const max = 13;
      this.vx = Math.max(-max, Math.min(max, this.vx || (Math.random() - .5) * 9));
      this.vy = Math.max(-max, Math.min(max, this.vy));
    }
    update() {
      this.flap += 0.18;
      this.x += this.vx;
      this.y += this.vy + Math.sin(this.flap) * 1.6;
      if (this.x < 0 || this.x + this.w > this.stage.width) this.vx *= -1;
      if (this.y < 0 || this.y + this.h > this.stage.height) this.vy *= -1;
      this.x = Math.max(0, Math.min(this.stage.width - this.w, this.x));
      this.y = Math.max(0, Math.min(this.stage.height - this.h, this.y));
      if (this.scared > 0 && --this.scared === 0) { this.vx *= 0.3; this.vy *= 0.3; }
    }
    draw(ctx) {
      ctx.save();
      ctx.shadowColor = 'rgba(20,40,0,0.28)'; ctx.shadowBlur = 14; ctx.shadowOffsetY = 7;
      // 날갯짓 느낌으로 세로 살짝 눌림
      const squash = 1 + Math.sin(this.flap) * 0.06;
      if (this.vx < 0) {
        ctx.translate(this.x + this.w, this.y); ctx.scale(-1, squash);
        ctx.drawImage(this.img, 0, 0, this.w, this.h);
      } else {
        ctx.translate(this.x, this.y); ctx.scale(1, squash);
        ctx.drawImage(this.img, 0, 0, this.w, this.h);
      }
      ctx.restore();
      if (this.scared > 0) {
        ctx.font = 'bold 36px Jua, Arial'; ctx.fillStyle = '#fff';
        ctx.strokeStyle = '#c0392b'; ctx.lineWidth = 3; ctx.textAlign = 'center';
        const cx = this.x + this.w / 2, cy = this.y - 6;
        ctx.strokeText('!', cx, cy); ctx.fillText('!', cx, cy);
      }
    }
  }

  Playground.init({
    key: 'bird',
    entryIcon: '🌳🐦✨🍃',
    entryTitle: '자연쌤의 숲속 놀이터',
    entryButton: '숲속 입장하기',
    headerTitle: '🐦 숲속 놀이터',
    emptyHint: '사진을 올리면 새가 날아올라요! 🐦',
    bgm: 'bird.mp3',
    bgImage: 'bird.png',
    bgFallback: '#87ceeb',
    aiMsg: 'AI가 새를 오려내는 중...',
    particle: 'leaf', particleCount: 18,
    createSprite: (img, st) => new Bird(img, st),
  });
})();
