import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';

const host = '127.0.0.1';
const port = Number(process.env.PEAK_PLANNER_PORT || 47831);
const snapshot = process.argv[2];
if (!snapshot) throw new Error('Pass the path to the BepInEx snapshot file.');

const types = { html: 'text/html', js: 'text/javascript', css: 'text/css', svg: 'image/svg+xml', png: 'image/png', webp: 'image/webp', ico: 'image/x-icon' };
createServer(async (request, response) => {
  const send = (status, body, type = 'text/plain') => {
    response.writeHead(status, {'Content-Type': type, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff'});
    response.end(body);
  };
  if (request.headers.host !== host + ':' + port) return send(403, 'Forbidden');
  const path = request.url.split('?')[0];
  if (path === '/snapshot' && request.headers.origin === 'https://hi5ilay.github.io') {
    response.setHeader('Access-Control-Allow-Origin', 'https://hi5ilay.github.io');
    response.setHeader('Vary', 'Origin');
    if (request.method === 'OPTIONS') {
      response.setHeader('Access-Control-Allow-Methods', 'GET');
      response.setHeader('Access-Control-Allow-Private-Network', 'true');
      return send(204, '');
    }
  }
  if (request.method !== 'GET') return send(403, 'Forbidden');
  if (path === '/snapshot') {
    try {
      return send(200, await readFile(snapshot), 'application/json');
    } catch {
      return send(503, 'Waiting for PEAK');
    }
  }
  const asset = path === '/' ? 'index.html' : path.slice(1);
  if (!/^(?:[\w-]+\/)*[\w.-]+\.(html|js|css|svg|png|webp|ico)$/.test(asset)) return send(404, 'Not found');
  try {
    return send(200, await readFile(new URL('../dist/' + asset, import.meta.url)), types[asset.split('.').at(-1)]);
  } catch {
    return send(404, 'Not found');
  }
}).listen(port, host, () => console.log('PEAK live planner: http://' + host + ':' + port + '/?live'));
