#!/usr/bin/env node
/* 자연쌤의 웹 앱 공작소 - 초간단 정적 서버 (의존성 없음)
   실행:  node serve.js        →  http://localhost:8080/  (앱 목록)
   같은 와이파이의 태블릿에서는  http://<노트북IP>:8080/  으로 접속
   ※ 카메라를 쓰는 앱은 파일을 더블클릭해 file:// 로 열면 동작하지 않습니다.
     반드시 이 서버로 열어 주세요. */
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 8080;
const ROOT = __dirname;
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.webp': 'image/webp', '.svg': 'image/svg+xml',
  '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.ogg': 'audio/ogg',
  '.woff': 'font/woff', '.woff2': 'font/woff2', '.ttf': 'font/ttf',
};

http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p === '/') p = '/index.html';
  const file = path.join(ROOT, path.normalize(p));
  if (!file.startsWith(ROOT)) { res.writeHead(403); return res.end('Forbidden'); }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); return res.end('Not found'); }
    res.writeHead(200, {
      'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'no-cache',
    });
    res.end(data);
  });
}).listen(PORT, () => {
  console.log(`🌸 자연쌤의 웹 앱 공작소 실행 중 →  http://localhost:${PORT}/`);
  console.log(`   (태블릿 접속: 노트북과 같은 와이파이에서 http://<노트북IP>:${PORT}/ )`);
});
