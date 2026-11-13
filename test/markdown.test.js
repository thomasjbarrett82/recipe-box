// Method and Notes rendering: the HTML shape src/assets/styles.css expects (SPEC.md 4.4.1, 4.4.3).
const test = require('node:test');
const assert = require('node:assert/strict');
const { renderMarkdown } = require('../src/lib/markdown.js');

const squash = (html) => html.replace(/\n/g, '');

test('method sections become h3 and each gets its own numbered list', () => {
  assert.equal(squash(renderMarkdown('### Prep\n\n1. Rinse.\n2. Dice.\n\n### Cook\n\n1. Simmer.\n')),
    '<h3>Prep</h3><ol><li>Rinse.</li><li>Dice.</li></ol><h3>Cook</h3><ol><li>Simmer.</li></ol>');
});

test('a method with no sections is one list', () => {
  assert.equal(squash(renderMarkdown('1. One.\n2. Two.')), '<ol><li>One.</li><li>Two.</li></ol>');
});

test('indented items are sub-steps nested inside the step above', () => {
  const html = squash(renderMarkdown('1. Prepare the veg:\n   - Dice the onion.\n   - Slice the mushrooms.\n2. Cook.'));
  assert.equal(html, '<ol><li>Prepare the veg:<ul><li>Dice the onion.</li><li>Slice the mushrooms.</li></ul></li><li>Cook.</li></ol>');
});

test('indented continuation lines stay in the step', () => {
  assert.equal(squash(renderMarkdown('1. Simmer the rice\n   until the grains split.')), '<ol><li>Simmer the rice\nuntil the grains split.</li></ol>'.replace(/\n/g, ''));
});

test('plain lines become paragraphs', () => {
  assert.equal(squash(renderMarkdown('Tip: make it a day ahead.\n\n1. Go.')), '<p>Tip: make it a day ahead.</p><ol><li>Go.</li></ol>');
});

test('raw HTML is escaped; emphasis works; text is not "smartened"', () => {
  assert.equal(squash(renderMarkdown('1. Heat to **180 C** <b>now</b> & *stir* -- "gently".')),
    '<ol><li>Heat to <strong>180 C</strong> &lt;b&gt;now&lt;/b&gt; &amp; <em>stir</em> -- &quot;gently&quot;.</li></ol>');
});

test('notes: paragraphs, lists and one level of sub-items', () => {
  assert.equal(squash(renderMarkdown('First line\nsame paragraph.\n\n- Swaps:\n  - **Turkey** for chicken\n- Freezes well.')),
    '<p>First line\nsame paragraph.</p><ul><li>Swaps:<ul><li><strong>Turkey</strong> for chicken</li></ul></li><li>Freezes well.</li></ul>'.replace(/\n/g, ''));
});

test('notes: a paragraph followed directly by a list', () => {
  assert.equal(squash(renderMarkdown('Make ahead:\n- Keeps well.\n- Freezes well.')),
    '<p>Make ahead:</p><ul><li>Keeps well.</li><li>Freezes well.</li></ul>');
});

test('links to other sites get rel="noopener"', () => {
  assert.equal(squash(renderMarkdown('See [the video](https://example.com/v).')),
    '<p>See <a href="https://example.com/v" rel="noopener">the video</a>.</p>');
});

test('empty input renders nothing', () => {
  assert.equal(renderMarkdown(''), '');
  assert.equal(renderMarkdown(undefined), '');
});
