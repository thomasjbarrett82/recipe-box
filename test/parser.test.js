// Run with: npm test
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { parseRecipe, minutesFrom } = require('../src/lib/recipe-parser.js');

// Fixed sample content, so these tests don't change as real recipes are added.
const content = path.join(__dirname, 'fixtures');
const TAGS = JSON.parse(fs.readFileSync(path.join(content, 'site.json'), 'utf8')).tags;
const read = (f) => fs.readFileSync(path.join(content, 'recipes', f), 'utf8');

// Smallest valid recipe; tests add or break one part at a time.
const MIN = `# Toast

## Recipe Data

- Tags: Breakfast

## Description

Bread, toasted.

## Ingredients

- 1 slice bread

## Method

1. Toast it.
`;
const parse = (md, opts) => parseRecipe(md, Object.assign({ filename: 'toast.md', tags: TAGS }, opts));
const throwsLike = (md, re) => assert.throws(() => parse(md), re);

test('every recipe file in content/recipes parses', () => {
  const real = path.join(__dirname, '..', 'content');
  const tags = JSON.parse(fs.readFileSync(path.join(real, 'site.json'), 'utf8')).tags;
  for (const f of fs.readdirSync(path.join(real, 'recipes')).filter((x) => x.endsWith('.md'))) {
    const md = fs.readFileSync(path.join(real, 'recipes', f), 'utf8');
    assert.doesNotThrow(() => parseRecipe(md, { filename: f, tags }), f);
  }
});

test('the example recipe parses into the expected data', () => {
  const r = parseRecipe(read('wild-rice-soup.md'), { filename: 'wild-rice-soup.md', tags: TAGS });
  assert.equal(r.slug, 'wild-rice-soup');
  assert.equal(r.title, 'Wild Rice Soup');
  assert.deepEqual(r.tags, ['Soup', 'Dinner', 'Minnesota']);
  assert.equal(r.author, 'Claude');
  assert.deepEqual(r.source, { text: 'claude.ai', url: 'https://claude.ai' });
  assert.equal(r.serves, '6');
  assert.deepEqual(r.cookTimes.map((c) => c.text), ['Prep: 15 min', 'Cook: 45 min', 'Total: 60 min']);
  assert.equal(r.totalMinutes, 60);
  assert.equal(r.cardTime, '60 min');
  assert.equal(r.ingredients.length, 10);
  assert.equal(r.ingredients[0], '160 g wild rice, rinsed');
  assert.match(r.method, /^### Prep/);
  assert.match(r.notes, /^Cooking time varies/);
  assert.equal(r.servingSize, '475 ml');
  assert.deepEqual(r.nutrition[0], { label: 'Calories', value: '350 kcal' });
  assert.equal(r.nutrition.length, 7);
});

test('optional sections and keys can be left out', () => {
  const r = parse(MIN);
  assert.equal(r.slug, 'toast');
  assert.equal(r.author, '');
  assert.equal(r.source, null);
  assert.deepEqual(r.cookTimes, []);
  assert.equal(r.totalMinutes, null);
  assert.equal(r.cardTime, '');
  assert.equal(r.notes, '');
  assert.deepEqual(r.nutrition, []);
  assert.equal(r.servingSize, '');
  assert.equal(r.emoji, '');
});

test('emoji: exactly one emoji, including multi-part ones', () => {
  const withEmoji = (e) => MIN.replace('- Tags: Breakfast', '- Tags: Breakfast\n- Emoji: ' + e);
  for (const e of ['🍞', '🇸🇪', '👨‍🍳', '👍🏽', '❤️']) assert.equal(parse(withEmoji(e)).emoji, e);
  throwsLike(withEmoji('🍞🧈'), /toast\.md:6: Emoji must be a single emoji/);
  throwsLike(withEmoji('bread'), /toast\.md:6: Emoji must be a single emoji/);
  throwsLike(withEmoji('🍞 toast'), /Emoji must be a single emoji/);
});

test('section names ignore case and order', () => {
  const md = `# Toast\n\n## method\n\n1. Toast it.\n\n## INGREDIENTS\n\n- bread\n\n## Description\n\nToast.\n\n## recipe data\n\n- tags: Breakfast\n`;
  assert.equal(parse(md).ingredients[0], 'bread');
});

test('cook times are kept as written, with or without list markers', () => {
  const r = parse(MIN + '\n## Cook Times\n\n- Rise: 2 h\nBake: 35 min\nTotal: 2 h 50 min\n');
  assert.deepEqual(r.cookTimes.map((c) => c.text), ['Rise: 2 h', 'Bake: 35 min', 'Total: 2 h 50 min']);
  assert.equal(r.totalMinutes, 170);
  assert.equal(r.cardTime, '2 h 50 min');
});

test('without a Total line, a single cook time is the card time; several use the first', () => {
  assert.equal(parse(MIN + '\n## Cook Times\n\nReady in 10 min\n').cardTime, 'Ready in 10 min');
  const r = parse(MIN + '\n## Cook Times\n\nPrep: 5 min\nCook: 10 min\n');
  assert.equal(r.cardTime, '5 min');
  assert.equal(r.totalMinutes, null);
});

test('minutesFrom reads common time formats', () => {
  assert.equal(minutesFrom('15 min'), 15);
  assert.equal(minutesFrom('15 mins'), 15);
  assert.equal(minutesFrom('1 h 20 min'), 80);
  assert.equal(minutesFrom('1.5 hours'), 90);
  assert.equal(minutesFrom('2 hrs'), 120);
  assert.equal(minutesFrom('overnight'), null);
});

test('source can be a Markdown link, a bare URL, or plain text', () => {
  const src = (v) => parse(MIN.replace('- Tags: Breakfast', '- Tags: Breakfast\n- Source: ' + v)).source;
  assert.deepEqual(src('[Grandma](https://example.com/g)'), { text: 'Grandma', url: 'https://example.com/g' });
  assert.deepEqual(src('https://www.example.com/toast'), { text: 'example.com', url: 'https://www.example.com/toast' });
  assert.deepEqual(src("Grandma's recipe box"), { text: "Grandma's recipe box", url: null });
});

test('ingredients are plain text lines, never split', () => {
  const r = parse(MIN.replace('- 1 slice bread', '- 2 large eggs, beaten\n- Salt to taste\n- 1 can (400 g) tomatoes\n  or fresh'));
  assert.deepEqual(r.ingredients, ['2 large eggs, beaten', 'Salt to taste', '1 can (400 g) tomatoes or fresh']);
});

test('nutrition: any fields, as written; serving size is separate', () => {
  const r = parse(MIN + '\n## Nutrition\n\n- Serving size: 1 slice\n- Calories: 80 kcal\n- Iron: 1 mg\n');
  assert.equal(r.servingSize, '1 slice');
  assert.deepEqual(r.nutrition, [{ label: 'Calories', value: '80 kcal' }, { label: 'Iron', value: '1 mg' }]);
  assert.deepEqual(parse(MIN + '\n## Nutrition\n\n').nutrition, []);
});

test('the slug is the file name; there is no Slug field', () => {
  assert.equal(parse(MIN, { filename: 'content/recipes/french-toast.md' }).slug, 'french-toast');
  assert.equal(parseRecipe(MIN, {}).slug, 'toast'); // no file name: from the title
  throwsLike(MIN.replace('- Tags: Breakfast', '- Tags: Breakfast\n- Slug: toast'), /toast\.md:6: unknown Recipe Data key "Slug".*URL comes from the file name/);
  assert.throws(() => parse(MIN, { filename: 'French Toast.md' }), /file name "French Toast\.md" must use only lowercase.*"french-toast\.md"/);
});

test('typos stop the build with the file and line', () => {
  throwsLike(MIN.replace('## Ingredients', '## Ingredent'), /toast\.md:11: unknown section "## Ingredent"/);
  throwsLike(MIN.replace('- Tags: Breakfast', '- Tags: Breakfast\n- Autor: Me'), /toast\.md:6: unknown Recipe Data key "Autor"/);
  throwsLike(MIN.replace('Breakfast', 'Breakfest'), /tag "Breakfest" is not in content\/site\.json/);
  throwsLike(MIN.replace('- 1 slice bread', '1 slice bread'), /Ingredients must be a bullet list/);
  throwsLike(MIN + '\n## Nutrition\n\n- Calories\n', /Nutrition lines must look like/);
});

test('structure problems are reported', () => {
  throwsLike('Toast\n' + MIN, /:1: the first line must be the title/);
  throwsLike(MIN.replace(/## Method[\s\S]*/, ''), /missing required section "## Method"/);
  throwsLike(MIN + '\n## Description\n\nAgain.\n', /section "## Description" appears twice/);
  throwsLike(MIN.replace('- Tags: Breakfast', '- Author: Me'), /needs "- Tags: \.\.\."/);
  throwsLike(MIN.replace('Bread, toasted.', ''), /"## Description" is empty/);
});

test('ingredients can be grouped with ### headings; the flat list keeps every line in order', () => {
  const r = parse(MIN.replace('- 1 slice bread', '- Salt\n\n### Crust\n\n- 1 cup flour\n- 1 stick butter\n\n### Filling\n\n- 2 eggs'));
  assert.deepEqual(r.ingredients, ['Salt', '1 cup flour', '1 stick butter', '2 eggs']);
  assert.deepEqual(r.ingredientGroups, [
    { name: '', items: ['Salt'] },
    { name: 'Crust', items: ['1 cup flour', '1 stick butter'] },
    { name: 'Filling', items: ['2 eggs'] }
  ]);
  assert.deepEqual(parse(MIN).ingredientGroups, [{ name: '', items: ['1 slice bread'] }]);
});

test('an empty ingredient group is an error', () => {
  throwsLike(MIN.replace('- 1 slice bread', '### Crust\n\n### Filling\n\n- 2 eggs'), /toast\.md:13: ingredient group "### Crust" has no ingredients/);
  throwsLike(MIN.replace('- 1 slice bread', '- 2 eggs\n\n### Topping\n'), /ingredient group "### Topping" has no ingredients/);
});
