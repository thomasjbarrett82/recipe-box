#!/usr/bin/env node
/*
  Builds the site: content/recipes/*.md -> dist/

    npm run build                   build into dist/
    npm run check                   check every recipe file, write nothing
    SITE_URL=https://... npm run build   override the "url" in content/site.json

  Every recipe file is parsed and checked first. If any has a problem, every problem is
  listed with its file and line, nothing is written, and the command exits with status 1.

  Output (all plain static files):
    index.html                  home and search
    r/<slug>/index.html         one page per recipe
    tags/index.html             all tags
    tags/<tag-slug>/index.html  one page per tag that has recipes
    404.html                    page not found (configure the host to serve it with status 404)
    search-index.json           the client-side search index
    assets/                     CSS, JavaScript and fonts
    ...                         everything in static/ (for example static/images/)
*/
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const qrcode = require('qrcode-generator');
const { parseRecipe } = require('../src/lib/recipe-parser.js');
const cards = require('../src/assets/cards.js');
const templates = require('../src/lib/templates.js');

const ROOT = path.join(__dirname, '..');
const FONT_DIR = path.dirname(require.resolve('@fontsource-variable/dm-sans/package.json'));
const FONTS = ['dm-sans-latin-wght-normal.woff2', 'dm-sans-latin-ext-wght-normal.woff2'];

class BuildError extends Error {
  constructor(problems) {
    super(`Build failed: ${problems.length} problem(s)\n` + problems.map((p) => '  - ' + p).join('\n'));
    this.problems = problems;
  }
}

// ---------- Content ----------

function readSite(contentDir, siteUrlOverride) {
  const file = path.join(contentDir, 'site.json');
  let site;
  try {
    site = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (e) {
    throw new BuildError([`content/site.json: ${e.message}`]);
  }
  if (!Array.isArray(site.tags) || !site.tags.length) throw new BuildError(['content/site.json: "tags" must be a list of tag names']);

  const raw = siteUrlOverride || site.url;
  let url;
  try {
    url = new URL(raw);
    if (!/^https?:$/.test(url.protocol)) throw new Error();
  } catch (e) {
    throw new BuildError([`content/site.json: "url" must be the site's full address, e.g. "https://example.com" (got ${JSON.stringify(raw)})`]);
  }
  const base = url.pathname.replace(/\/+$/, '');
  return { tags: site.tags, siteUrl: url.origin + base, base };
}

/* Parses every recipe. Returns { recipes, problems } with recipes sorted A to Z by title. */
function loadRecipes(contentDir, staticDir, tags) {
  const dir = path.join(contentDir, 'recipes');
  const problems = [];
  const recipes = [];
  const files = fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => f.endsWith('.md')).sort() : [];
  for (const name of files) {
    try {
      const r = parseRecipe(fs.readFileSync(path.join(dir, name), 'utf8'), { filename: name, tags });
      // A photo path on this site must point at a file in static/, or the page shows a broken image.
      if (r.image && /^\/(?!\/)/.test(r.image) && !fs.existsSync(path.join(staticDir, decodeURI(r.image)))) {
        problems.push(`${name}: Image "${r.image}" not found. Put the file at static${r.image}`);
      } else if (r.image && !/^(\/|https?:\/\/)/i.test(r.image)) {
        problems.push(`${name}: Image must start with "/" (a file in static/, e.g. /images/${r.slug}.jpg) or be a full https:// URL`);
      }
      recipes.push(r);
    } catch (e) {
      problems.push(e.message);
    }
  }
  if (!files.length) problems.push('content/recipes: no recipe files found');
  recipes.sort((a, b) => a.title.localeCompare(b.title));
  return { recipes, problems };
}

// ---------- Output helpers ----------

function write(outDir, rel, content) {
  const file = path.join(outDir, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
}

function copyDir(from, to) {
  if (!fs.existsSync(from)) return;
  for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
    if (entry.name === '.gitkeep') continue;
    const src = path.join(from, entry.name);
    const dest = path.join(to, entry.name);
    if (entry.isDirectory()) copyDir(src, dest);
    else {
      fs.mkdirSync(to, { recursive: true });
      fs.copyFileSync(src, dest);
    }
  }
}

// An SVG QR code (one path, scales to any size) linking to the recipe's public URL.
function qrSvg(text) {
  const qr = qrcode(0, 'M');
  qr.addData(text);
  qr.make();
  const n = qr.getModuleCount();
  const quiet = 2;
  let d = '';
  for (let row = 0; row < n; row++) {
    for (let col = 0; col < n; col++) {
      if (!qr.isDark(row, col)) continue;
      // One rectangle per horizontal run of dark modules keeps the path short.
      let run = 1;
      while (col + run < n && qr.isDark(row, col + run)) run++;
      d += `M${col + quiet} ${row + quiet}h${run}v1h-${run}z`;
      col += run - 1;
    }
  }
  const size = n + quiet * 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" role="img" aria-label="QR code for this recipe" shape-rendering="crispEdges"><path fill="#18181b" d="${d}"/></svg>`;
}

// ---------- Build ----------

/*
  build({ root, outDir, siteUrl, check }) -> { recipes, tags, outDir }
  root: project folder holding content/, src/ and static/ (defaults to this project).
  Throws BuildError listing every problem.
*/
function build(opts = {}) {
  const root = opts.root || ROOT;
  const contentDir = path.join(root, 'content');
  const staticDir = path.join(root, 'static');
  const assetsDir = path.join(ROOT, 'src', 'assets');
  const outDir = opts.outDir || path.join(root, 'dist');

  const site = readSite(contentDir, opts.siteUrl || process.env.SITE_URL);
  const { recipes, problems } = loadRecipes(contentDir, staticDir, site.tags);
  if (problems.length) throw new BuildError(problems);

  const tags = site.tags
    .map((name) => ({ name, slug: cards.tagSlug(name), count: recipes.filter((r) => r.tags.includes(name)).length }))
    .filter((t) => t.count > 0);
  if (opts.check) return { recipes, tags, outDir: null };

  // Start from an empty output folder so deleted recipes don't linger.
  fs.rmSync(outDir, { recursive: true, force: true });
  fs.mkdirSync(outDir, { recursive: true });

  // Static files first, so generated files win on a name clash.
  copyDir(staticDir, outDir);

  // Assets, with a content hash on each CSS/JS URL so browsers pick up changes after a deploy.
  const versions = {};
  for (const name of fs.readdirSync(assetsDir)) {
    const buf = fs.readFileSync(path.join(assetsDir, name));
    write(outDir, path.join('assets', name), buf);
    versions[name] = crypto.createHash('sha256').update(buf).digest('hex').slice(0, 10);
  }
  for (const font of FONTS) write(outDir, path.join('assets', 'fonts', font), fs.readFileSync(path.join(FONT_DIR, 'files', font)));

  const ui = cards.make(site.base);
  const ctx = {
    base: site.base,
    siteUrl: site.siteUrl,
    // Root-absolute (works on the 404 page at any depth). Fonts stay unversioned so the
    // <link rel=preload> URL matches the url() in styles.css.
    asset: (name) => ui.url('/assets/' + name) + (versions[name] ? '?v=' + versions[name] : ''),
    ui,
    tags,
    recipes
  };

  write(outDir, 'index.html', templates.homePage(ctx));
  write(outDir, '404.html', templates.notFoundPage(ctx));
  write(outDir, 'tags/index.html', templates.allTagsPage(ctx));
  for (const tag of tags) write(outDir, `tags/${tag.slug}/index.html`, templates.tagPage(ctx, tag));
  for (const r of recipes) {
    write(outDir, `r/${r.slug}/index.html`, templates.recipePage(ctx, r, qrSvg(`${site.siteUrl}/r/${r.slug}/`)));
  }

  const index = recipes.map((r) => ({
    slug: r.slug, title: r.title, description: r.description, tags: r.tags,
    ingredients: r.ingredients, cardTime: r.cardTime, totalMinutes: r.totalMinutes,
    swatch: r.swatch, image: r.image, emoji: r.emoji
  }));
  write(outDir, 'search-index.json', JSON.stringify(index));

  // GitHub Pages: publish the files as they are, without Jekyll processing.
  write(outDir, '.nojekyll', '');

  return { recipes, tags, outDir, site };
}

module.exports = { build, BuildError, qrSvg };

if (require.main === module) {
  const check = process.argv.includes('--check');
  try {
    const started = Date.now();
    const out = build({ check });
    if (check) {
      console.log(`All ${out.recipes.length} recipe files are OK.`);
    } else {
      console.log(`Built ${out.recipes.length} recipes and ${out.tags.length} tags into ${path.relative(process.cwd(), out.outDir) || '.'}/ in ${Date.now() - started} ms.`);
      console.log(`Site URL: ${out.site.siteUrl}/`);
    }
  } catch (e) {
    console.error(e instanceof BuildError ? e.message : e);
    process.exit(1);
  }
}
