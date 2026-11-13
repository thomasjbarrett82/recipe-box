// Run with: npm test
const test = require('node:test');
const assert = require('node:assert/strict');
const S = require('../src/assets/search.js');
const { loadFixtureRecipes } = require('./helpers.js');

// Fixed sample content (test/fixtures), A to Z by title like the site's default order.
const RECIPES = loadFixtureRecipes();

const index = S.buildIndex(RECIPES);
const slugs = (q, opts) => S.search(index, q, opts).results.map((r) => r.recipe.slug);

test('empty query returns every recipe in input order', () => {
  assert.deepEqual(slugs(''), RECIPES.map((r) => r.slug));
  assert.deepEqual(slugs('   '), RECIPES.map((r) => r.slug));
});

test('words are OR\'d and more matches rank first', () => {
  const r = slugs('rice chicken');
  assert.equal(r[0], 'wild-rice-soup');
  assert.deepEqual([...r].sort(), ['lemon-garlic-roast-chicken', 'red-lentil-dal', 'wild-rice-soup']);
});

test('double-quoted phrase is exact', () => {
  assert.deepEqual(slugs('"wild rice"'), ['wild-rice-soup']);
});

test('single-quoted phrase works too', () => {
  assert.deepEqual(slugs("'green beans' lemon").sort(), ['lemon-garlic-roast-chicken', 'tater-tot-hotdish']);
});

test('curly quotes from phone keyboards count as quotes', () => {
  assert.deepEqual(slugs('“wild rice”'), ['wild-rice-soup']);
  assert.deepEqual(slugs('‘wild rice’'), ['wild-rice-soup']);
});

test('a phrase never spans two fields', () => {
  // Wild rice soup has ingredients "wild rice" and "chicken stock" next to each other.
  assert.deepEqual(slugs('"rice chicken"'), []);
});

test('singular matches plural and plural matches singular', () => {
  assert.deepEqual(slugs('egg').sort(), ['blueberry-buckle', 'shakshuka', 'sourdough-pancakes', 'swedish-meatballs']);
  assert.deepEqual(slugs('eggs').sort(), slugs('egg').sort());
  assert.deepEqual(slugs('tomatoes').sort(), ['red-lentil-dal', 'shakshuka']);
  assert.deepEqual(slugs('blueberry'), ['blueberry-buckle']);
  assert.deepEqual(slugs('"tater tot"'), ['tater-tot-hotdish']);
});

test('whole words only', () => {
  const extra = S.buildIndex([{ slug: 'x', title: 'Licorice twists', tags: [], ingredients: [] }]);
  assert.equal(S.search(extra, 'rice').results.length, 0);
  assert.equal(S.search(index, 'ric').results.length, 0);
});

test('case and accents are ignored', () => {
  const extra = S.buildIndex([{ slug: 'x', title: 'Jalapeño Cornbread', tags: [], ingredients: [] }]);
  assert.equal(S.search(extra, 'JALAPENO').results.length, 1);
});

test('apostrophes inside words are not quotes, and possessives match the base word', () => {
  const t = S.parseQuery("grandma's soup");
  assert.deepEqual(t.map((x) => x.label), ["grandma's", 'soup']);
  const extra = S.buildIndex([{ slug: 'g', title: "Grandma's Bars", tags: [], ingredients: [] }]);
  assert.equal(S.search(extra, 'grandma').results.length, 1);
  assert.equal(S.search(extra, "grandma's").results.length, 1);
});

test('hyphenated words match as a unit', () => {
  assert.deepEqual(slugs('all-purpose'), ['wild-rice-soup']);
});

test('duplicate terms count once', () => {
  const r = S.search(index, 'rice rice Rice');
  assert.equal(r.terms.length, 1);
});

test('tag filter is applied as AND', () => {
  assert.deepEqual(slugs('beef', { tag: 'Minnesota' }).sort(), ['swedish-meatballs', 'tater-tot-hotdish']);
  assert.deepEqual(slugs('', { tag: 'Quick' }).sort(), ['red-lentil-dal', 'shakshuka', 'sourdough-pancakes']);
});

test('hits report which terms matched', () => {
  const top = S.search(index, 'rice chicken').results[0];
  assert.deepEqual(top.hits, ['rice', 'chicken']);
});
