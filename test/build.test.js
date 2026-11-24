// The build: output files, URLs, base path handling and error reporting.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { build, BuildError } = require('../scripts/build.js');
const { FIXTURES } = require('./helpers.js');

// A throwaway project folder: content/ from the fixtures (optionally changed) and an empty static/.
function project(edit) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'recipe-box-test-'));
  fs.mkdirSync(path.join(root, 'content', 'recipes'), { recursive: true });
  fs.mkdirSync(path.join(root, 'static'));
  fs.copyFileSync(path.join(FIXTURES, 'site.json'), path.join(root, 'content', 'site.json'));
  for (const f of fs.readdirSync(path.join(FIXTURES, 'recipes'))) {
    fs.copyFileSync(path.join(FIXTURES, 'recipes', f), path.join(root, 'content', 'recipes', f));
  }
  if (edit) edit(root);
  return root;
}
const read = (root, rel) => fs.readFileSync(path.join(root, 'dist', rel), 'utf8');

test('builds every page, the search index and the assets', (t) => {
  const root = project();
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const out = build({ root, siteUrl: 'https://recipes.example.org' });

  assert.equal(out.recipes.length, 8);
  for (const rel of ['index.html', '404.html', 'tags/index.html', 'tags/minnesota/index.html',
    'r/wild-rice-soup/index.html', 'search-index.json', 'assets/styles.css', 'assets/search.js',
    'assets/fonts/dm-sans-latin-wght-normal.woff2', '.nojekyll']) {
    assert.ok(fs.existsSync(path.join(root, 'dist', rel)), rel);
  }
  // Only tags that have recipes get pages and chips.
  assert.ok(!fs.existsSync(path.join(root, 'dist', 'tags', 'vegan')));
  assert.deepEqual(out.tags.map((t) => t.name), ['Breakfast', 'Dinner', 'Dessert', 'Minnesota', 'Quick', 'Soup', 'Vegetarian']);

  const index = JSON.parse(read(root, 'search-index.json'));
  assert.equal(index.length, 8);
  assert.deepEqual(Object.keys(index[0]).sort(),
    ['cardTime', 'description', 'emoji', 'image', 'ingredients', 'slug', 'swatch', 'tags', 'title', 'totalMinutes']);
});

test('recipe pages are complete without JavaScript', (t) => {
  const root = project();
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  build({ root, siteUrl: 'https://recipes.example.org' });
  const html = read(root, 'r/wild-rice-soup/index.html');

  assert.match(html, /<h1>Wild Rice Soup<\/h1>/);
  assert.match(html, /<span>160 g wild rice, rinsed<\/span>/);
  assert.match(html, /<div class="method-body">\s*<h3>Prep<\/h3>\s*<ol>/);
  assert.match(html, /class="notes has-notes"/);
  assert.match(html, /<dt>Calories<\/dt><dd>350 kcal<\/dd>/);
  assert.match(html, /Per serving \(475 ml\)\. Serves 6\./);
  assert.match(html, /<span>recipes\.example\.org\/r\/wild-rice-soup<\/span>/);
  assert.match(html, /<link rel="canonical" href="https:\/\/recipes\.example\.org\/r\/wild-rice-soup\/">/);
  assert.match(html, /<div class="qr-box"><svg [^>]*viewBox/);

  const empty = read(root, 'r/shakshuka/index.html');
  assert.match(empty, /No nutritional info yet\./);
  assert.match(empty, /class="notes"/);
});

test('home and tag pages list the recipes in the HTML', (t) => {
  const root = project();
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  build({ root, siteUrl: 'https://recipes.example.org' });

  const home = read(root, 'index.html');
  assert.match(home, /All 8 recipes/);
  assert.equal((home.match(/class="card"/g) || []).length, 8);

  const tag = read(root, 'tags/minnesota/index.html');
  assert.match(tag, /\/tags\/minnesota · 4 recipes/);
  assert.match(tag, /<a class="chip" href="\/tags\/minnesota\/" aria-current="page">Minnesota <span>4<\/span><\/a>/);
  assert.equal((tag.match(/class="card"/g) || []).length, 4);
});

test('a site URL with a path prefixes every link (GitHub Pages project sites)', (t) => {
  const root = project();
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  build({ root, siteUrl: 'https://someone.github.io/recipe-box/' });

  const notFound = read(root, '404.html');
  assert.match(notFound, /<html lang="en" class="no-js" data-base="\/recipe-box">/);
  assert.match(notFound, /href="\/recipe-box\/assets\/styles\.css\?v=/);
  assert.match(notFound, /<a class="logo" href="\/recipe-box\/">/);
  // Every link and asset on the 404 page is root-absolute, so it works at any depth.
  for (const [, url] of notFound.matchAll(/(?:href|src)="([^"]*)"/g)) assert.match(url, /^\/recipe-box\//, url);

  const home = read(root, 'index.html');
  assert.match(home, /href="\/recipe-box\/r\/wild-rice-soup\/"/);
  assert.match(read(root, 'r/wild-rice-soup/index.html'), /someone\.github\.io\/recipe-box\/r\/wild-rice-soup/);
});

test('format errors stop the build, list every problem, and write nothing', (t) => {
  const root = project((dir) => {
    const f = path.join(dir, 'content', 'recipes', 'shakshuka.md');
    fs.writeFileSync(f, fs.readFileSync(f, 'utf8').replace('Breakfast', 'Breakfest'));
    const g = path.join(dir, 'content', 'recipes', 'blueberry-buckle.md');
    fs.writeFileSync(g, fs.readFileSync(g, 'utf8').replace('## Recipe Data\n', '## Recipe Data\n\n- Image: /images/buckle.jpg'));
  });
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));

  assert.throws(() => build({ root, siteUrl: 'https://recipes.example.org' }), (e) => {
    assert.ok(e instanceof BuildError);
    assert.equal(e.problems.length, 2);
    assert.match(e.message, /blueberry-buckle\.md: Image "\/images\/buckle\.jpg" not found/);
    assert.match(e.message, /shakshuka\.md:5: tag "Breakfest" is not in content\/site\.json/);
    return true;
  });
  assert.ok(!fs.existsSync(path.join(root, 'dist')));
});

test('a recipe photo in static/ is copied and used', (t) => {
  const root = project((dir) => {
    fs.mkdirSync(path.join(dir, 'static', 'images'));
    fs.writeFileSync(path.join(dir, 'static', 'images', 'buckle.jpg'), 'not really a jpeg');
    const g = path.join(dir, 'content', 'recipes', 'blueberry-buckle.md');
    fs.writeFileSync(g, fs.readFileSync(g, 'utf8').replace('## Recipe Data\n', '## Recipe Data\n\n- Image: /images/buckle.jpg'));
  });
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  build({ root, siteUrl: 'https://recipes.example.org' });

  assert.ok(fs.existsSync(path.join(root, 'dist', 'images', 'buckle.jpg')));
  const html = read(root, 'r/blueberry-buckle/index.html');
  assert.match(html, /<div class="hero-thumb swatch-\d" aria-hidden="true"><img src="\/images\/buckle\.jpg" alt=""><\/div>/);
  assert.match(html, /<meta property="og:image" content="https:\/\/recipes\.example\.org\/images\/buckle\.jpg">/);
});

test('ingredient groups render as headed checklists', (t) => {
  const root = project((dir) => {
    const g = path.join(dir, 'content', 'recipes', 'blueberry-buckle.md');
    fs.writeFileSync(g, fs.readFileSync(g, 'utf8').replace('## Ingredients\n', '## Ingredients\n\n### Cake\n'));
  });
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  build({ root, siteUrl: 'https://recipes.example.org' });
  const html = read(root, 'r/blueberry-buckle/index.html');
  assert.match(html, /<h3 class="ingredient-group">Cake<\/h3>\s*<ul class="ingredient-list">/);
  assert.doesNotMatch(read(root, 'r/wild-rice-soup/index.html'), /ingredient-group/);
});

test('a recipe emoji is the tab icon and is in the search index; other pages use the RB icon', (t) => {
  const root = project((dir) => {
    const g = path.join(dir, 'content', 'recipes', 'blueberry-buckle.md');
    fs.writeFileSync(g, fs.readFileSync(g, 'utf8').replace('## Recipe Data\n', '## Recipe Data\n\n- Emoji: 🫐'));
  });
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  build({ root, siteUrl: 'https://recipes.example.org' });

  const icon = (html) => /<link rel="icon" type="image\/svg\+xml" href="([^"]+)">/.exec(html)[1];
  const buckle = icon(read(root, 'r/blueberry-buckle/index.html'));
  assert.match(buckle, /^data:image\/svg\+xml,/);
  assert.match(decodeURIComponent(buckle.slice('data:image/svg+xml,'.length)), /<text [^>]*>🫐<\/text>/);

  for (const rel of ['index.html', '404.html', 'tags/index.html', 'r/wild-rice-soup/index.html']) {
    assert.match(icon(read(root, rel)), /^\/assets\/favicon\.svg\?v=/, rel);
  }
  assert.ok(fs.existsSync(path.join(root, 'dist', 'assets', 'favicon.svg')));

  const index = JSON.parse(read(root, 'search-index.json'));
  assert.equal(index.find((r) => r.slug === 'blueberry-buckle').emoji, '🫐');
  assert.equal(index.find((r) => r.slug === 'wild-rice-soup').emoji, '');
});

test('an invalid site URL is reported', (t) => {
  const root = project();
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  assert.throws(() => build({ root, siteUrl: 'example.com' }), /"url" must be the site's full address/);
});
