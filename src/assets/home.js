/*
  Home page search. The build writes every recipe card into the page, so the list works
  without JavaScript; this script loads /search-index.json and re-renders the list as the
  visitor types or picks a tag. State lives in the URL so searches can be shared:
  /?q=rice+chicken&tag=Quick
*/
(function () {
  'use strict';
  var S = RecipeSearch, UI = RecipeUI;
  var input = document.getElementById('q');
  var clear = document.getElementById('clear');
  var chips = document.getElementById('chips');
  var meta = document.getElementById('results-meta');
  var list = document.getElementById('results');
  var empty = document.getElementById('empty');
  var tags = Array.prototype.map.call(chips.querySelectorAll('.chip'), function (b) { return b.getAttribute('data-tag'); });

  var params = new URLSearchParams(location.search);
  var state = { q: params.get('q') || '', tag: params.get('tag') || '' };
  if (tags.indexOf(state.tag) === -1) state.tag = '';
  input.value = state.q;
  var index = null;

  function syncUrl() {
    var p = new URLSearchParams();
    if (state.q.trim()) p.set('q', state.q.trim());
    if (state.tag) p.set('tag', state.tag);
    var qs = p.toString();
    history.replaceState(null, '', qs ? '?' + qs : location.pathname);
  }

  function render() {
    // Update in place so keyboard focus stays on the chip that was pressed.
    chips.querySelectorAll('.chip').forEach(function (b) {
      b.setAttribute('aria-pressed', String(b.getAttribute('data-tag') === state.tag));
    });
    if (!index) return; // still loading; the built-in list stays on screen

    var out = S.search(index, state.q, { tag: state.tag });
    var searching = out.terms.length > 0;
    var filtering = searching || !!state.tag;
    var n = out.results.length;
    meta.textContent = filtering
      ? n + (n === 1 ? ' result' : ' results') +
        (out.terms.length > 1 ? ' with any of: ' + out.terms.map(function (t) { return t.label; }).join(', ') + '. Most matches first.' : '')
      : 'All ' + n + ' recipes';
    empty.hidden = n > 0;
    clear.hidden = !filtering;
    list.innerHTML = out.results.map(function (r) { return UI.card(r.recipe, searching ? r.hits : null); }).join('');
  }

  input.addEventListener('input', function () { state.q = input.value; syncUrl(); render(); });
  input.form.addEventListener('submit', function (e) { e.preventDefault(); });
  clear.addEventListener('click', function () { state.q = ''; state.tag = ''; input.value = ''; syncUrl(); render(); input.focus(); });
  chips.addEventListener('click', function (e) {
    var b = e.target.closest('.chip');
    if (!b) return;
    var t = b.getAttribute('data-tag');
    state.tag = state.tag === t ? '' : t;
    syncUrl(); render();
  });

  render();
  fetch(UI.url('/search-index.json'))
    .then(function (res) { if (!res.ok) throw new Error(res.status); return res.json(); })
    .then(function (recipes) { index = S.buildIndex(recipes); render(); })
    .catch(function () { meta.textContent = 'Search is unavailable right now. Showing all recipes.'; });
})();
