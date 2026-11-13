/*
  Markdown rendering for the recipe Method and Notes sections.

  Standard CommonMark (markdown-it). Raw HTML in a recipe file is escaped, not passed through,
  and typography is left exactly as written. The CSS in src/assets/styles.css targets the
  plain HTML this produces inside .method-body and .notes-body:

    ### Prep                    ->  <h3>Prep</h3>
    1. Rinse the rice.          ->  <ol><li>Rinse the rice.</li> ...</ol>
       - Drain well.            ->      nested list (a sub-step, shown a, b, c)
    Any other line              ->  <p>...</p>
*/
'use strict';
const MarkdownIt = require('markdown-it');

const md = new MarkdownIt({ html: false, linkify: false, typographer: false });

// Links in recipe text open normally but don't pass referrer details to other sites.
const defaultLinkOpen = md.renderer.rules.link_open || ((tokens, i, opts, env, self) => self.renderToken(tokens, i, opts));
md.renderer.rules.link_open = (tokens, i, opts, env, self) => {
  const href = tokens[i].attrGet('href') || '';
  if (/^https?:\/\//i.test(href)) tokens[i].attrSet('rel', 'noopener');
  return defaultLinkOpen(tokens, i, opts, env, self);
};

function renderMarkdown(text) {
  return text ? md.render(String(text)).trim() : '';
}

module.exports = { renderMarkdown };
