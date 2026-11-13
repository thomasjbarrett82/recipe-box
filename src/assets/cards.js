/*
  Result cards and URL helpers, shared by the build (Node) and the browser, so the cards
  the build writes into the HTML and the cards search renders are identical.

  URLs: /r/<slug>/ for recipes, /tags/<tag-slug>/ for tags. Every URL is prefixed with the
  site's base path ('' at a domain root, '/recipe-box' for a GitHub Pages project site).
  In the browser the base path comes from <html data-base="...">.
*/
(function (root) {
  'use strict';

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function tagSlug(tag) { return String(tag).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''); }

  function make(base) {
    base = base || '';
    function url(path) { return base + path; }
    function recipeUrl(r) { return url('/r/' + r.slug + '/'); }
    function tagUrl(tag) { return url('/tags/' + tagSlug(tag) + '/'); }
    function prettyPath(r) { return '/r/' + r.slug; }
    // Root-relative image paths ("/images/x.jpg") live under the base path; full URLs are used as is.
    function imageUrl(src) { return /^\//.test(src) && !/^\/\//.test(src) ? url(src) : src; }

    /*
      One result card. opts.showDescription: tag page style. opts.hideTag: omit the current tag's pill.
      hits: matched search terms, shown as "Matches: ..." when a search is active.
    */
    function card(r, hits, opts) {
      opts = opts || {};
      var tags = r.tags.filter(function (t) { return t !== opts.hideTag; });
      return '<li><a class="card" href="' + esc(recipeUrl(r)) + '">' +
        '<div class="card-body">' +
          '<span class="card-title">' + esc(r.title) + '</span>' +
          (opts.showDescription
            ? '<span class="card-desc">' + esc(r.description) + '</span>'
            : '<span class="card-path">' + esc(prettyPath(r)) + '</span>') +
          (hits && hits.length ? '<span class="card-match">Matches: ' + esc(hits.join(', ')) + '</span>' : '') +
          '<span class="pills">' + (r.cardTime ? '<span class="pill pill-strong">' + esc(r.cardTime) + '</span>' : '') +
            tags.map(function (t) { return '<span class="pill">' + esc(t) + '</span>'; }).join('') +
          '</span>' +
        '</div>' +
        '<div class="thumb swatch-' + (r.swatch || 0) + '" aria-hidden="true">' +
          (r.image ? '<img src="' + esc(imageUrl(r.image)) + '" alt="" loading="lazy">' : '') +
        '</div>' +
      '</a></li>';
    }

    return { url: url, recipeUrl: recipeUrl, tagUrl: tagUrl, prettyPath: prettyPath, imageUrl: imageUrl, card: card };
  }

  var api = { esc: esc, tagSlug: tagSlug, make: make };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else {
    root.RecipeCards = api;
    root.RecipeUI = Object.assign({ esc: esc, tagSlug: tagSlug }, make(document.documentElement.getAttribute('data-base') || ''));
  }
})(this);
