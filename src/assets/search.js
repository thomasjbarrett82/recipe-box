/*
  Recipe search. Pure functions, no DOM. Works in the browser (window.RecipeSearch)
  and in Node (require) for tests.

  Rules (see SPEC.md, "Search"):
  - Words are OR'd: a recipe matches if it contains ANY term.
  - Single or double quotes make an exact phrase ("wild rice" or 'wild rice').
    Curly quotes from phone keyboards are treated the same.
    An apostrophe inside a word (grandma's) is not a quote.
  - Matching is on whole words only, and a word also matches its plural/singular
    (egg = eggs, berry = berries, tomato = tomatoes, dish = dishes).
  - Case and accents are ignored (jalapeno = jalapeño).
  - A phrase must sit inside ONE field: the title, the description, a single tag,
    or a single ingredient line. It never spans two ingredients.
  - Ranking: recipes matching more distinct terms first; ties keep the input order.
*/
(function (root) {
  'use strict';

  var SPLIT = /[^\p{L}\p{N}]+/u;

  function fold(s) {
    return String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  }

  // Light English plural folding. Applied identically to text and query,
  // so both sides always meet at the same stem.
  function stem(w) {
    if (w.length > 4 && /ies$/.test(w)) return w.slice(0, -3) + 'y';                 // berries -> berry
    if (w.length > 3 && /(ches|shes|xes|zes|sses|oes)$/.test(w)) return w.slice(0, -2); // dishes -> dish, tomatoes -> tomato
    if (w.length > 3 && /s$/.test(w) && !/ss$/.test(w)) return w.slice(0, -1);        // eggs -> egg
    return w;
  }

  // Apostrophes are removed before splitting, so "grandma's" -> "grandmas" -> "grandma".
  function tokenize(s) {
    return fold(s).replace(/['’]/g, '').split(SPLIT).filter(Boolean).map(stem);
  }

  function parseQuery(raw) {
    var terms = [];
    var seen = Object.create(null);
    function add(label, tokens) {
      if (!tokens.length) return;
      var key = tokens.join(' ');
      if (seen[key]) return;
      seen[key] = true;
      terms.push({ label: label, tokens: tokens });
    }
    var text = String(raw || '')
      .replace(/[“”„‟]/g, '"')
      .replace(/[‘’‚‛]/g, "'");
    // A quote only opens at the start or after whitespace and only closes before whitespace or the end.
    var rest = text.replace(/(^|\s)(["'])(.*?)\2(?=\s|$)/g, function (m, pre, q, inner) {
      add('"' + fold(inner).trim().replace(/\s+/g, ' ') + '"', tokenize(inner));
      return pre + ' ';
    });
    // Unquoted text: one term per whitespace/comma-separated chunk. A hyphenated chunk
    // ("all-purpose") becomes a short phrase of its parts.
    rest.split(/[\s,;+]+/).filter(Boolean).forEach(function (chunk) {
      var label = fold(chunk).replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '');
      add(label, tokenize(chunk));
    });
    return terms;
  }

  function fieldsOf(recipe) {
    var fields = [recipe.title, recipe.description || ''];
    (recipe.tags || []).forEach(function (t) { fields.push(t); });
    // Each ingredient line is its own field, so a phrase never spans two ingredients.
    (recipe.ingredients || []).forEach(function (i) { fields.push(typeof i === 'string' ? i : i.name); });
    return fields.map(tokenize);
  }

  function buildIndex(recipes) {
    return recipes.map(function (r) { return { recipe: r, fields: fieldsOf(r) }; });
  }

  function containsSequence(field, tokens) {
    for (var i = 0; i + tokens.length <= field.length; i++) {
      var ok = true;
      for (var j = 0; j < tokens.length; j++) {
        if (field[i + j] !== tokens[j]) { ok = false; break; }
      }
      if (ok) return true;
    }
    return false;
  }

  function hits(entry, terms) {
    return terms.filter(function (t) {
      return entry.fields.some(function (f) { return containsSequence(f, t.tokens); });
    }).map(function (t) { return t.label; });
  }

  /*
    search(index, query, { tag }) -> { terms, results: [{ recipe, hits }] }
    tag (optional) is an AND filter applied before search.
  */
  function search(index, query, opts) {
    var tag = opts && opts.tag;
    var terms = parseQuery(query);
    var results = index
      .filter(function (e) { return !tag || e.recipe.tags.indexOf(tag) !== -1; })
      .map(function (e, i) { return { recipe: e.recipe, hits: hits(e, terms), order: i }; })
      .filter(function (r) { return terms.length === 0 || r.hits.length > 0; })
      .sort(function (a, b) { return (b.hits.length - a.hits.length) || (a.order - b.order); })
      .map(function (r) { return { recipe: r.recipe, hits: r.hits }; });
    return { terms: terms, results: results };
  }

  var api = { fold: fold, stem: stem, tokenize: tokenize, parseQuery: parseQuery, buildIndex: buildIndex, search: search };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.RecipeSearch = api;
})(this);
