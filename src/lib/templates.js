/*
  Page templates. Each function returns a complete HTML document as a string.
  Markup and copy follow the approved design (docs/SPEC.md section 4).

  ctx (built by scripts/build.js):
    base       ''  or '/recipe-box', the URL path the site lives under
    siteUrl    'https://example.com' (no trailing slash), used for absolute URLs
    asset(f)   URL of a file in /assets/, with a cache-busting version
    ui         URL and card helpers from src/assets/cards.js
    tags       [{ name, slug, count }] tags that have recipes, in site.json order
    recipes    every recipe, A to Z by title
*/
'use strict';
const { esc } = require('../assets/cards.js');
const { renderMarkdown } = require('./markdown.js');

const SITE_NAME = 'Recipe Box';

// ---------- Icons ----------
const ICON = {
  search: '<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>',
  moon: '<svg class="icon-moon" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>',
  sun: '<svg class="icon-sun" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>',
  back: '<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>',
  arrowLeft: '<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>',
  print: '<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9V3h12v6"/><rect x="3" y="9" width="18" height="8" rx="2"/><path d="M6 14h12v7H6z"/></svg>'
};

// ---------- Shared pieces ----------

/*
  The inline head script runs before first paint: it marks JavaScript as available
  (hiding JS-only controls otherwise) and applies the saved theme so there is no flash.
*/
const HEAD_SCRIPT = "<script>document.documentElement.classList.remove('no-js');try{var t=localStorage.getItem('theme');if(t==='light'||t==='dark')document.documentElement.dataset.theme=t}catch(e){}</script>";

function layout(ctx, p) {
  const title = p.title ? `${p.title} · ${SITE_NAME}` : SITE_NAME;
  const meta = [];
  if (p.description) meta.push(`<meta name="description" content="${esc(p.description)}">`);
  if (p.noindex) meta.push('<meta name="robots" content="noindex">');
  if (p.canonical) {
    meta.push(`<link rel="canonical" href="${esc(p.canonical)}">`);
    meta.push(`<meta property="og:site_name" content="${SITE_NAME}">`);
    meta.push(`<meta property="og:type" content="${p.ogType || 'website'}">`);
    meta.push(`<meta property="og:title" content="${esc(p.title || SITE_NAME)}">`);
    if (p.description) meta.push(`<meta property="og:description" content="${esc(p.description)}">`);
    meta.push(`<meta property="og:url" content="${esc(p.canonical)}">`);
    if (p.ogImage) meta.push(`<meta property="og:image" content="${esc(p.ogImage)}">`);
    meta.push(`<meta name="twitter:card" content="${p.ogImage ? 'summary_large_image' : 'summary'}">`);
  }
  const scripts = (p.scripts || []).map((s) => `<script src="${ctx.asset(s)}"></script>`).join('\n');
  return `<!doctype html>
<html lang="en" class="no-js" data-base="${esc(ctx.base)}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
${meta.join('\n')}
${HEAD_SCRIPT}
<link rel="preload" href="${ctx.asset('fonts/dm-sans-latin-wght-normal.woff2')}" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="${ctx.asset('tokens.css')}">
<link rel="stylesheet" href="${ctx.asset('styles.css')}">
${p.print ? `<link rel="stylesheet" href="${ctx.asset('print.css')}" media="print">\n` : ''}</head>
<body class="${p.bodyClass}">
${p.body}
${scripts}
</body>
</html>
`;
}

const themeToggle = `<button type="button" class="icon-btn theme-toggle" aria-label="Switch to dark mode" data-js-only>
    ${ICON.moon}
    ${ICON.sun}
  </button>`;

// Home and 404: wordmark, "All tags", theme toggle.
function plainHeader(ctx) {
  return `<header class="container site-header">
  <a class="logo" href="${ctx.ui.url('/')}">recipe box</a>
  <span class="header-spacer"></span>
  <a class="nav-link" href="${ctx.ui.url('/tags/')}">All tags</a>
  ${themeToggle}
</header>`;
}

/*
  Tag and recipe pages: wordmark, pill search field, theme toggle.
  The form submits to the home page search, so it still works without JavaScript.
*/
function searchHeader(ctx, o) {
  return `<header class="${o.wide ? 'container-wide' : 'container'} site-header">
  ${o.back ? `<a class="icon-btn back-btn" href="${ctx.ui.url('/')}" aria-label="Back to all recipes">
    ${ICON.back}
  </a>
  ` : ''}<a class="logo" href="${ctx.ui.url('/')}">recipe box</a>
  <form class="search-field header-search" role="search" action="${ctx.ui.url('/')}" method="get">
    ${ICON.search}
    <label for="q" class="sr-only">${esc(o.label)}</label>
    <input id="q" name="q" type="search" autocomplete="off" placeholder="${esc(o.placeholder)}">${o.tag ? `
    <input type="hidden" name="tag" value="${esc(o.tag)}">` : ''}
  </form>
  <span class="header-spacer"></span>
  ${themeToggle}
</header>`;
}

function plural(n, word) { return `${n} ${word}${n === 1 ? '' : 's'}`; }

// ---------- Home ----------

function homePage(ctx) {
  const n = ctx.recipes.length;
  const body = `${plainHeader(ctx)}

<main>
  <section class="hero">
    <h1>What are we cooking?</h1>
    <form class="search-field search-hero" role="search" action="${ctx.ui.url('/')}" method="get">
      ${ICON.search}
      <label for="q" class="sr-only">Search recipes</label>
      <input id="q" name="q" type="search" autocomplete="off" placeholder="Try rice chicken or &quot;wild rice&quot;" aria-describedby="search-help">
      <button type="button" class="clear-btn" id="clear" hidden>Clear</button>
    </form>
    <p class="search-help" id="search-help">Finds recipes with any of your words. Put a phrase in quotes to match it exactly.</p>
    <div class="chip-row center" id="chips" role="group" aria-label="Filter by tag" data-js-only>
      ${ctx.tags.map((t) => `<button type="button" class="chip" data-tag="${esc(t.name)}" aria-pressed="false">${esc(t.name)}</button>`).join('\n      ')}
    </div>
  </section>

  <section class="container results-section" aria-labelledby="results-meta">
    <p class="results-meta" id="results-meta" aria-live="polite">All ${plural(n, 'recipe')}</p>
    <p class="empty" id="empty"${n ? ' hidden' : ''}>Nothing yet. Try a shorter word.</p>
    <ul class="results" id="results">
      ${ctx.recipes.map((r) => ctx.ui.card(r)).join('\n      ')}
    </ul>
  </section>
</main>`;
  return layout(ctx, {
    description: 'Search and browse recipes.',
    canonical: ctx.siteUrl + '/',
    bodyClass: 'home-page',
    body,
    scripts: ['search.js', 'cards.js', 'theme.js', 'home.js']
  });
}

// ---------- Tag pages ----------

function tagChips(ctx, current) {
  return ctx.tags.map((t) =>
    `<a class="chip" href="${ctx.ui.tagUrl(t.name)}"${t.name === current ? ' aria-current="page"' : ''}>${esc(t.name)} <span>${t.count}</span></a>`
  ).join('\n    ');
}

function tagPage(ctx, tag) {
  const recipes = ctx.recipes.filter((r) => r.tags.includes(tag.name));
  const body = `${searchHeader(ctx, {
    label: 'Search within this tag',
    placeholder: `Search ${tag.name} recipes (any word, or "a phrase")`,
    tag: tag.name
  })}

<main class="container page-main" data-tag-page="${esc(tag.name)}">
  <nav class="breadcrumb" aria-label="Breadcrumb"><a href="${ctx.ui.url('/')}">Home</a> / <a href="${ctx.ui.url('/tags/')}">Tags</a> / <span>${esc(tag.name)}</span></nav>
  <div class="tag-head">
    <div>
      <h1>${esc(tag.name)}</h1>
      <p class="tag-sub" id="tag-sub" aria-live="polite">/tags/${tag.slug} · ${plural(recipes.length, 'recipe')}</p>
    </div>
    <div class="sort" data-js-only>
      <label for="sort">Sort</label>
      <select id="sort">
        <option value="az">A to Z</option>
        <option value="quick">Quickest first</option>
      </select>
    </div>
  </div>
  <nav class="chip-row tag-switch" aria-label="Other tags">
    ${tagChips(ctx, tag.name)}
  </nav>
  <p class="empty" id="empty" hidden></p>
  <ul class="results" id="results">
    ${recipes.map((r) => ctx.ui.card(r, null, { showDescription: true, hideTag: tag.name })).join('\n    ')}
  </ul>
</main>`;
  return layout(ctx, {
    title: tag.name,
    description: `${tag.name} recipes.`,
    canonical: ctx.siteUrl + `/tags/${tag.slug}/`,
    bodyClass: 'tag-page',
    body,
    scripts: ['search.js', 'cards.js', 'theme.js', 'tag.js']
  });
}

// All tags (/tags/): not separately designed; reuses the tag page header and chip row.
function allTagsPage(ctx) {
  const body = `${searchHeader(ctx, { label: 'Search recipes', placeholder: 'Search all recipes' })}

<main class="container page-main">
  <nav class="breadcrumb" aria-label="Breadcrumb"><a href="${ctx.ui.url('/')}">Home</a> / <span>Tags</span></nav>
  <div class="tag-head">
    <div>
      <h1>All tags</h1>
      <p class="tag-sub">/tags · ${plural(ctx.tags.length, 'tag')}</p>
    </div>
  </div>
  <nav class="chip-row tag-switch" aria-label="Tags">
    ${tagChips(ctx, null)}
  </nav>
</main>`;
  return layout(ctx, {
    title: 'All tags',
    description: 'Every recipe tag.',
    canonical: ctx.siteUrl + '/tags/',
    bodyClass: 'tag-page',
    body,
    scripts: ['theme.js']
  });
}

// ---------- Recipe page ----------

function byline(r) {
  const parts = [];
  if (r.author) parts.push('By ' + esc(r.author));
  if (r.source) {
    parts.push('Source: ' + (r.source.url
      ? `<a href="${esc(r.source.url)}" rel="noopener">${esc(r.source.text)}</a>`
      : esc(r.source.text)));
  }
  return parts.length ? `<p class="byline">${parts.join(' · ')}</p>` : '';
}

function nutrition(r) {
  if (!r.nutrition.length) {
    return `<div class="nutrition-head">
      <h2 id="nutrition-h">Nutrition</h2>
    </div>
    <p class="nutrition-empty">No nutritional info yet.</p>`;
  }
  const note = 'Per serving' + (r.servingSize ? ` (${r.servingSize})` : '') + (r.serves ? `. Serves ${r.serves}.` : '.');
  return `<div class="nutrition-head">
      <h2 id="nutrition-h">Nutrition</h2>
      <span>${esc(note)}</span>
    </div>
    <dl class="nutrition-grid">
      ${r.nutrition.map((n) => `<div><dt>${esc(n.label)}</dt><dd>${esc(n.value)}</dd></div>`).join('\n      ')}
    </dl>`;
}

function recipePage(ctx, r, qrSvg) {
  const ui = ctx.ui;
  const canonical = ctx.siteUrl + `/r/${r.slug}/`;
  const displayUrl = canonical.replace(/^https?:\/\//, '').replace(/\/$/, '');
  const image = r.image ? ui.imageUrl(r.image) : '';
  const ogImage = image && image.startsWith('/') ? new URL(image, ctx.siteUrl + '/').href : image;

  const pills = r.cookTimes.map((c) => `<span class="pill pill-strong">${esc(c.text)}</span>`);
  if (r.serves) pills.push(`<span class="pill pill-strong">Serves ${esc(r.serves)}</span>`);
  r.tags.forEach((t) => pills.push(`<a class="pill" href="${ui.tagUrl(t)}">${esc(t)}</a>`));

  const notesHtml = renderMarkdown(r.notes);

  const body = `${searchHeader(ctx, { wide: true, back: true, label: 'Search recipes', placeholder: 'Search recipes' })}

<main class="container-wide page-main" id="main">
  <nav class="breadcrumb" aria-label="Breadcrumb"><a href="${ui.url('/')}">Home</a> / <a href="${ui.tagUrl(r.tags[0])}">${esc(r.tags[0])}</a> / <span>${esc(r.title)}</span></nav>

  <div class="recipe-top">
    <div class="recipe-intro">
      <span class="print-only print-brand">recipe box</span>
      <h1>${esc(r.title)}</h1>
      <p class="recipe-path">${esc(ui.prettyPath(r))}</p>
      <p class="lede">${esc(r.description)}</p>
      ${byline(r)}
      <div class="pills large">${pills.join('')}</div>
      <div class="actions">
        <div class="url-pill">
          <span>${esc(displayUrl)}</span>
          <button type="button" class="btn btn-small" id="copy" data-js-only>Copy link</button>
        </div>
        <button type="button" class="btn share-btn" id="share" data-js-only>Share</button>
        <button type="button" class="btn btn-outline" id="print" data-js-only>
          ${ICON.print}
          Print
        </button>
        <button type="button" class="switch-btn" role="switch" aria-checked="false" data-wake-lock data-js-only>
          <span class="switch-track" aria-hidden="true"><span class="switch-knob"></span></span>
          <span class="switch-text">Keep screen on<span class="switch-hint">Stops your screen sleeping while you cook</span></span>
        </button>
      </div>
      <p class="status-note" id="wake-note" hidden>Your screen will stay on while this page is open.</p>
      <p class="status-note" id="copy-note" role="status"></p>
    </div>
    <div class="hero-thumb swatch-${r.swatch}" aria-hidden="true">${image ? `<img src="${esc(image)}" alt="">` : ''}</div>
    <div class="print-only print-qr">
      <div class="qr-box">${qrSvg}</div>
      Scan for the online version
    </div>
  </div>

  <div class="recipe-body">
    <section class="ingredients" aria-labelledby="ing-h">
      <div class="section-head"><h2 id="ing-h">Ingredients</h2><span>Check off as you go</span></div>
      <ul class="ingredient-list">
        ${r.ingredients.map((line) => `<li><label><input type="checkbox"><span>${esc(line)}</span></label></li>`).join('\n        ')}
      </ul>
    </section>
    <section class="method" aria-labelledby="method-h">
      <h2 id="method-h">Method</h2>
      <div class="method-body">
${renderMarkdown(r.method)}
      </div>
    </section>
  </div>

  <!-- Hidden on screen when the recipe has no notes; always printed, with a line to write on. -->
  <section class="notes${notesHtml ? ' has-notes' : ''}" aria-labelledby="notes-h">
    <h2 id="notes-h">Notes</h2>
    <div class="notes-body">
${notesHtml}
    </div>
    <div class="print-only notes-lines"><div></div></div>
  </section>

  <section class="nutrition" aria-labelledby="nutrition-h">
    ${nutrition(r)}
  </section>

  <footer class="print-only print-footer"><span>${esc(displayUrl)}</span><span>${esc(r.tags.join(' · '))}</span></footer>
</main>`;

  return layout(ctx, {
    title: r.title,
    description: r.description,
    canonical,
    ogType: 'article',
    ogImage,
    bodyClass: 'recipe-page',
    print: true,
    body,
    scripts: ['theme.js', 'recipe.js', 'wake-lock.js']
  });
}

// ---------- 404 ----------
// Served by the host at any missing URL, so every link and asset URL is root-absolute.

function notFoundPage(ctx) {
  const body = `${plainHeader(ctx)}

<main class="not-found">
  <span class="not-found-code">404</span>
  <h1>Page not found</h1>
  <p>That page doesn't exist. It may have moved, or the link may have a typo.</p>
  <a class="btn btn-outline" href="${ctx.ui.url('/')}">
    ${ICON.arrowLeft}
    Back to the homepage
  </a>
</main>`;
  return layout(ctx, {
    title: 'Page not found',
    noindex: true,
    bodyClass: 'not-found-page',
    body,
    scripts: ['theme.js']
  });
}

module.exports = { homePage, tagPage, allTagsPage, recipePage, notFoundPage };
