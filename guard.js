/* =========================================================
   자연쌤의 웹 앱 공작소 — 공통 잠금
   - 비밀번호 자체는 이 파일에 없습니다. PBKDF2 해시만 들어 있어서
     소스보기로는 비밀번호를 알 수 없습니다.
   - 한 번 통과하면 그 기기에서는 다시 묻지 않습니다.
   - 정적 사이트라 개발자도구를 쓰면 우회할 수 있습니다.
     자물쇠가 아니라 "관계자 외 출입금지" 표지판입니다.
   - 비밀번호를 바꾸려면 아래 HASH 를 새로 만들어 넣으세요.
       node -e "console.log(require('crypto').pbkdf2Sync('새비번','jayeon-gongjakso-2026-lock',120000,32,'sha256').toString('hex'))"
   ========================================================= */
(function () {
  var KEY  = 'jayeon-lock';
  var SALT = 'jayeon-gongjakso-2026-lock';
  var ITER = 120000;
  var HASH = '1c4a2e9166990fcf4b8210e7dbd2221ff4f37590de889823e3cb0f753fcb7414';

  // 이미 통과한 기기면 그냥 넘어갑니다
  try { if (localStorage.getItem(KEY) === HASH) return; } catch (e) {}

  // 파일을 직접 열었을 때(file://)는 암호 계산 기능을 쓸 수 없어 잠그지 않습니다
  if (!(window.crypto && window.crypto.subtle)) {
    console.warn('[잠금] 이 환경에서는 비밀번호를 확인할 수 없어 그냥 엽니다. (https 로 접속하세요)');
    return;
  }

  // 내용이 먼저 보이지 않도록 가려 둡니다
  var hide = document.createElement('style');
  hide.textContent =
    'html{visibility:hidden!important}' +
    '#jlock,#jlock *{visibility:visible!important}' +
    '#jlock{position:fixed;inset:0;z-index:2147483647;display:flex;flex-direction:column;' +
      'align-items:center;justify-content:center;gap:16px;padding:24px;' +
      'background:linear-gradient(160deg,#fdf3f6,#eef0f6);' +
      "font-family:'Jua','Gaegu',system-ui,sans-serif;color:#2b2438;text-align:center}" +
    '#jlock h2{font-size:22px;margin:0;color:#c8496a}' +
    '#jlock p{margin:0;font-size:15px;color:#7c7490}' +
    '#jlock input{font-family:inherit;font-size:18px;padding:12px 16px;border:2px solid #f0d5de;' +
      'border-radius:14px;outline:none;width:min(280px,80vw);text-align:center;background:#fff}' +
    '#jlock input:focus{border-color:#c8496a}' +
    '#jlock button{font-family:inherit;font-size:17px;padding:12px 28px;border:0;border-radius:15px;' +
      'background:#c8496a;color:#fff;cursor:pointer;box-shadow:0 4px 0 #a83a57}' +
    '#jlock button:active{transform:translateY(3px);box-shadow:0 1px 0 #a83a57}' +
    '#jlock button[disabled]{opacity:.6}' +
    '#jlock .msg{min-height:22px;font-size:15px;color:#c8496a}';
  document.documentElement.appendChild(hide);

  function toHex(buf) {
    var a = new Uint8Array(buf), s = '';
    for (var i = 0; i < a.length; i++) s += ('0' + a[i].toString(16)).slice(-2);
    return s;
  }

  function derive(pw) {
    var enc = new TextEncoder();
    return crypto.subtle
      .importKey('raw', enc.encode(pw), 'PBKDF2', false, ['deriveBits'])
      .then(function (k) {
        return crypto.subtle.deriveBits(
          { name: 'PBKDF2', salt: enc.encode(SALT), iterations: ITER, hash: 'SHA-256' }, k, 256);
      })
      .then(toHex);
  }

  function build() {
    var box = document.createElement('div');
    box.id = 'jlock';
    box.innerHTML =
      '<h2>🔒 비밀번호를 입력하세요</h2>' +
      '<p>자연쌤의 웹 앱 공작소</p>' +
      '<input type="password" id="jlock-in" placeholder="비밀번호" autocomplete="current-password">' +
      '<button id="jlock-go">입장하기</button>' +
      '<div class="msg" id="jlock-msg"></div>';
    document.body.appendChild(box);

    var input = document.getElementById('jlock-in');
    var btn   = document.getElementById('jlock-go');
    var msg   = document.getElementById('jlock-msg');
    input.focus();

    function open() {
      try { localStorage.setItem(KEY, HASH); } catch (e) {}
      box.remove();
      hide.remove();
    }

    function check() {
      var pw = input.value;
      if (!pw) { input.focus(); return; }
      btn.disabled = true;
      msg.textContent = '확인 중…';
      derive(pw).then(function (h) {
        if (h === HASH) { open(); return; }
        msg.textContent = '비밀번호가 틀렸습니다';
        btn.disabled = false;
        input.value = '';
        input.focus();
      }).catch(function () {
        msg.textContent = '확인할 수 없습니다';
        btn.disabled = false;
      });
    }

    btn.addEventListener('click', check);
    input.addEventListener('keydown', function (e) { if (e.key === 'Enter') check(); });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', build);
  } else {
    build();
  }
})();
