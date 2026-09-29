/* =========================================================
   놀이 앱 공통 도구 (playkit)
   소리 · 음성 안내 · 진동 · 칭찬 · 설정 저장을 한곳에 모았습니다.
   각 앱은 PK.* 만 부르면 됩니다.
   ========================================================= */
(function () {
  "use strict";

  const PK = {
    sound: true,          // 앱에서 설정으로 바꿉니다
    voice: true,
    rate: 0.85            // 말하기 속도 (느리게가 기본)
  };

  /* ---------- 소리 (파일 없이 만들어 냅니다) ---------- */
  let ac = null;
  function tone(freq, dur, type, vol, when) {
    if (!PK.sound) return;
    try {
      ac = ac || new (window.AudioContext || window.webkitAudioContext)();
      if (ac.state === "suspended") ac.resume();
      const t0 = ac.currentTime + (when || 0);
      const o = ac.createOscillator(), g = ac.createGain();
      o.type = type || "sine";
      o.frequency.value = freq;
      g.gain.setValueAtTime(0, t0);
      g.gain.linearRampToValueAtTime(vol || 0.18, t0 + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + (dur || 0.14));
      o.connect(g); g.connect(ac.destination);
      o.start(t0); o.stop(t0 + (dur || 0.14) + 0.02);
    } catch (e) {}
  }

  /* 상황별 소리 한 줄로 */
  PK.beep = function (kind) {
    switch (kind) {
      case "tap":   tone(620, 0.09, "sine", 0.14); break;
      case "pick":  tone(760, 0.09, "triangle", 0.15); break;
      case "good":  [523, 659, 784].forEach((f, i) => tone(f, 0.22, "triangle", 0.18, i * 0.09)); break;
      case "win":   [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.28, "triangle", 0.2, i * 0.1)); break;
      case "bad":   tone(300, 0.16, "sine", 0.12); tone(240, 0.2, "sine", 0.12, 0.1); break;
      case "hint":  tone(880, 0.07, "sine", 0.09); break;
      case "start": tone(392, 0.16, "sine", 0.14); tone(523, 0.2, "sine", 0.14, 0.12); break;
      default:      tone(600, 0.1, "sine", 0.14);
    }
  };

  PK.buzz = function (p) {
    if (!PK.sound) return;
    try { navigator.vibrate && navigator.vibrate(p); } catch (e) {}
  };

  /* ---------- 음성 안내 ---------- */
  PK.say = function (text, force) {
    if (!PK.voice && !force) return;
    if (!("speechSynthesis" in window)) return;
    try {
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = "ko-KR";
      u.rate = PK.rate;
      window.speechSynthesis.speak(u);
    } catch (e) {}
  };
  PK.hush = function () {
    try { window.speechSynthesis && window.speechSynthesis.cancel(); } catch (e) {}
  };

  /* ---------- 칭찬 ---------- */
  const PRAISE = ["참 잘했어요!", "멋져요!", "정말 잘하는걸요!", "대단해요!", "최고예요!"];
  PK.praise = function () { return PRAISE[Math.floor(Math.random() * PRAISE.length)]; };

  /* 큰 칭찬 화면 : 아이콘 + 글자 + 색종이 */
  PK.cheer = function (icon, text, ms) {
    const box = document.createElement("div");
    box.className = "pk-cheer";
    box.innerHTML = '<div class="ic">' + (icon || "🎉") + '</div>' +
                    '<div class="tx">' + (text || PK.praise()) + '</div>';
    document.body.appendChild(box);
    PK.beep("win"); PK.buzz([60, 40, 120]);
    PK.confetti();
    setTimeout(() => box.remove(), ms || 1600);
  };

  /* 색종이 (가벼운 캔버스 한 장) */
  PK.confetti = function (n) {
    const cv = document.createElement("canvas");
    cv.style.cssText = "position:fixed;inset:0;z-index:7;pointer-events:none";
    cv.width = innerWidth; cv.height = innerHeight;
    document.body.appendChild(cv);
    const cx = cv.getContext("2d");
    const COL = ["#ffd54a", "#ff8a3d", "#ff4f7b", "#7ee0c0", "#5ac8fa", "#b79cff"];
    const bits = [];
    for (let i = 0; i < (n || 46); i++) {
      bits.push({
        x: Math.random() * cv.width, y: -20 - Math.random() * 120,
        w: 8 + Math.random() * 8, h: 6 + Math.random() * 6,
        vy: 2.2 + Math.random() * 3.2, vx: (Math.random() - 0.5) * 2.4,
        a: Math.random() * 6, va: (Math.random() - 0.5) * 0.3,
        c: COL[i % COL.length]
      });
    }
    const t0 = performance.now();
    (function step(now) {
      const p = (now - t0) / 2600;
      cx.clearRect(0, 0, cv.width, cv.height);
      bits.forEach(b => {
        b.x += b.vx; b.y += b.vy; b.a += b.va;
        cx.save(); cx.translate(b.x, b.y); cx.rotate(b.a);
        cx.globalAlpha = Math.max(0, 1 - p);
        cx.fillStyle = b.c; cx.fillRect(-b.w / 2, -b.h / 2, b.w, b.h);
        cx.restore();
      });
      if (p < 1) requestAnimationFrame(step); else cv.remove();
    })(performance.now());
  };

  /* ---------- 알림 줄 ---------- */
  PK.tell = function (msg) {
    const el = document.getElementById("pkSay");
    if (el) el.textContent = msg;
  };

  /* ---------- 설정 저장 ---------- */
  PK.load = function (key, def) {
    let v = {};
    try { v = JSON.parse(localStorage.getItem("pk-" + key) || "{}"); } catch (e) {}
    const out = Object.assign({}, def, v);
    if (out.sound !== undefined) PK.sound = !!out.sound;
    if (out.voice !== undefined) PK.voice = !!out.voice;
    if (out.rate !== undefined) PK.rate = +out.rate;
    return out;
  };
  PK.save = function (key, cfg) {
    try { localStorage.setItem("pk-" + key, JSON.stringify(cfg)); } catch (e) {}
    if (cfg.sound !== undefined) PK.sound = !!cfg.sound;
    if (cfg.voice !== undefined) PK.voice = !!cfg.voice;
    if (cfg.rate !== undefined) PK.rate = +cfg.rate;
  };

  /* 설정 판의 선택 단추들을 한 번에 이어 줍니다.
     map = [[상자id,'키'], ...] / onChange(키) 로 알려 줍니다 */
  PK.bindOpts = function (map, cfg, key, onChange) {
    function paint() {
      map.forEach(([box, k]) => {
        const el = document.getElementById(box);
        if (!el) return;
        [...el.children].forEach(b =>
          b.classList.toggle("on", String(b.dataset.v) === String(cfg[k])));
      });
    }
    map.forEach(([box, k]) => {
      const el = document.getElementById(box);
      if (!el) return;
      el.addEventListener("click", e => {
        const b = e.target.closest(".pk-opt");
        if (!b) return;
        const raw = b.dataset.v;
        cfg[k] = (raw === "true" || raw === "false") ? (raw === "true")
               : (isNaN(+raw) ? raw : +raw);
        PK.save(key, cfg); paint();
        PK.beep("tap");
        if (onChange) onChange(k);
      });
    });
    paint();
    return paint;
  };

  /* 첫 터치 때 소리 장치를 깨웁니다(브라우저 규칙) */
  ["pointerdown", "keydown"].forEach(ev =>
    document.addEventListener(ev, function once() {
      try {
        ac = ac || new (window.AudioContext || window.webkitAudioContext)();
        if (ac.state === "suspended") ac.resume();
      } catch (e) {}
      document.removeEventListener(ev, once);
    }));

  window.PK = PK;
})();
