#!/usr/bin/env node
/* 내 친구 동물 농장 - 초간단 정적 서버 (의존성 없음)
   실행:  node serve.js        →  http://localhost:8080/  (기본: farm3d.html / 3D 버전)
   같은 와이파이의 태블릿에서는  http://<노트북IP>:8080/  으로 접속
   ※ 3D 버전(farm3d.html)은 ES모듈+모델 파일을 쓰므로 반드시 이 서버로 열어야 합니다
     (파일을 더블클릭해 file:// 로 여는 방식은 동작하지 않습니다) */
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
  '.glb': 'model/gltf-binary', '.gltf': 'model/gltf+json', '.bin': 'application/octet-stream',
};

http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p === '/') p = '/farm3d.html';
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
  console.log(`🌸 동물 농장 3D 실행 중 →  http://localhost:${PORT}/`);
  console.log(`   (이전 2D 버전: http://localhost:${PORT}/animals.html )`);
  console.log(`   (태블릿 접속: 노트북과 같은 와이파이에서 http://<노트북IP>:${PORT}/ )`);
});
