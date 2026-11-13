/*
  Tag page: search within the tag and sort. The build writes the tag's cards (A to Z) into
  the page; this script loads /search-index.json and re-renders on search or sort.
*/
(function () {
  'use strict';
  var S = RecipeSearch, UI = RecipeUI;
  var main = document.querySelector('[data-tag-page]');
  var tag = main.getAttribute('data-tag-page');
  var slug = UI.tagSlug(tag);
  var input = document.getElementById('q');
  var sort = document.getElementById('sort');
  var list = document.getElementById('results');
  var empty = document.getElementById('empty');
  var sub = document.getElementById('tag-sub');
  var index = null;

  input.value = new URLSearchParams(location.search).get('q') || '';

  function render() {
    if (!index) return;
    var sorted = index.slice().sort(function (a, b) {
      if (sort.value === 'quick') {
        // Total time from the recipe's Cook Times; recipes without a readable total go last.
        var am = a.recipe.totalMinutes, bm = b.recipe.totalMinutes;
        if (am !== bm) return am === null ? 1 : bm === null ? -1 : am - bm;
      }
      return a.recipe.title.localeCompare(b.recipe.title);
    });
    // search() keeps input order for ties, so the chosen sort breaks ties after match count.
    var out = S.search(sorted, input.value);
    var n = out.results.length;
    sub.textContent = '/tags/' + slug + ' · ' + n + (n === 1 ? ' recipe' : ' recipes') +
      (out.terms.length > 1 ? ' with any of: ' + out.terms.map(function (t) { return t.label; }).join(', ') : '');
    empty.hidden = n > 0;
    empty.textContent = 'No ' + tag + ' recipes match. Try a shorter word.';
    list.innerHTML = out.results.map(function (r) {
      return UI.card(r.recipe, out.terms.length ? r.hits : null, { showDescription: true, hideTag: tag });
    }).join('');
  }

  input.addEventListener('input', render);
  input.form.addEventListener('submit', function (e) { e.preventDefault(); });
  sort.addEventListener('change', render);

  fetch(UI.url('/search-index.json'))
    .then(function (res) { if (!res.ok) throw new Error(res.status); return res.json(); })
    .then(function (recipes) {
      index = S.buildIndex(recipes.filter(function (r) { return r.tags.indexOf(tag) !== -1; }));
      render();
    })
    .catch(function () { /* keep the built-in list */ });
})();
