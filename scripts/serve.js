#!/usr/bin/env node
/*
  Local preview of the built site, behaving like a static host (for example GitHub Pages):
  /r/<slug>/ serves r/<slug>/index.html, /r/<slug> redirects to /r/<slug>/, and any
  missing URL gets 404.html with HTTP status 404.

    npm run serve            build, then serve dist/ at http://localhost:8080
    npm run dev              the same, and rebuild whenever content/, src/ or static/ changes
    PORT=3000 npm run serve  use another port

  If the site URL in content/site.json has a path (https://you.github.io/recipe-box), the
  preview serves the site under that same path, so links behave exactly as they will online.
*/
'use strict';
const fs = require('fs');
const path = require('path');
const http = require('http');
const { build, BuildError } = require('./build.js');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'dist');
const PORT = Number(process.env.PORT) || 8080;
const WATCH = process.argv.includes('--watch');

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.avif': 'image/avif', '.gif': 'image/gif', '.ico': 'image/x-icon',
  '.woff2': 'font/woff2', '.txt': 'text/plain; charset=utf-8', '.xml': 'application/xml'
};

let base = '';
let lastError = null;

function rebuild() {
  const started = Date.now();
  try {
    const out = build();
    base = out.site.base;
    lastError = null;
    console.log(`[${new Date().toLocaleTimeString()}] Built ${out.recipes.length} recipes in ${Date.now() - started} ms.`);
  } catch (e) {
    lastError = e instanceof BuildError ? e.message : String(e && e.stack || e);
    console.error(`[${new Date().toLocaleTimeString()}] ${lastError}`);
  }
}

function send(res, status, file) {
  res.writeHead(status, { 'Content-Type': TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'no-store' });
  fs.createReadStream(file).pipe(res);
}

function isFile(p) { try { return fs.statSync(p).isFile(); } catch (e) { return false; } }
function isDir(p) { try { return fs.statSync(p).isDirectory(); } catch (e) { return false; } }

function handle(req, res) {
  if (lastError) {
    // Show build problems in the browser instead of a stale site.
    res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' });
    return res.end(lastError + '\n\nFix the problem and save; the page rebuilds automatically with "npm run dev".\n');
  }
  const url = new URL(req.url, 'http://localhost');
  let pathname;
  try { pathname = decodeURIComponent(url.pathname); } catch (e) { pathname = '/'; }

  const notFound = () => send(res, 404, path.join(OUT, '404.html'));
  if (base && pathname === '/') { res.writeHead(302, { Location: base + '/' }); return res.end(); }
  if (base && pathname !== base && !pathname.startsWith(base + '/')) return notFound();
  const rel = pathname.slice(base.length) || '/';

  const target = path.normalize(path.join(OUT, rel));
  if (target !== OUT && !target.startsWith(OUT + path.sep)) return notFound();

  if (isFile(target)) return send(res, 200, target);
  if (isDir(target)) {
    if (!rel.endsWith('/')) { res.writeHead(301, { Location: base + rel + '/' + url.search }); return res.end(); }
    if (isFile(path.join(target, 'index.html'))) return send(res, 200, path.join(target, 'index.html'));
  }
  return notFound();
}

function watch() {
  let timer = null;
  const queue = () => { clearTimeout(timer); timer = setTimeout(rebuild, 150); };
  for (const dir of ['content', 'src', 'static']) {
    const full = path.join(ROOT, dir);
    if (fs.existsSync(full)) fs.watch(full, { recursive: true }, queue);
  }
  console.log('Watching content/, src/ and static/ for changes. Reload the browser after saving.');
}

rebuild();
if (WATCH) watch();
else if (lastError) process.exit(1);

http.createServer(handle).listen(PORT, () => {
  console.log(`Preview: http://localhost:${PORT}${base}/  (Ctrl+C to stop)`);
});
