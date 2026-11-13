// Shared test helpers.
const fs = require('fs');
const path = require('path');
const { parseRecipe } = require('../src/lib/recipe-parser.js');

const FIXTURES = path.join(__dirname, 'fixtures');

// The sample recipes in test/fixtures, parsed and sorted A to Z by title (the site's default order).
function loadFixtureRecipes() {
  const tags = JSON.parse(fs.readFileSync(path.join(FIXTURES, 'site.json'), 'utf8')).tags;
  const dir = path.join(FIXTURES, 'recipes');
  return fs.readdirSync(dir).filter((f) => f.endsWith('.md')).sort()
    .map((f) => parseRecipe(fs.readFileSync(path.join(dir, f), 'utf8'), { filename: f, tags }))
    .sort((a, b) => a.title.localeCompare(b.title));
}

module.exports = { FIXTURES, loadFixtureRecipes };
