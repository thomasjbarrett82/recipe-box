/*
  Recipe file parser: Markdown-only recipe format -> recipe data object.
  Format: content/FORMAT.md. Used at build time (scripts/build.js); works in Node and the browser.

  parseRecipe(markdown, { filename, tags }) returns:
  {
    slug,                             // the file name without .md (there is no Slug field)
    title, tags[], author, source: { text, url } | null, image, serves,
    description,                      // plain text
    cookTimes: [{ text, label, value }],   // "Prep: 15 min" -> label "Prep", value "15 min"; text is as written
    totalMinutes,                     // from the "Total" line (or the only line), null if unreadable; for sorting
    cardTime,                         // value shown on result cards: the Total value, else the first line's value
    ingredients: [string],            // plain text lines, as written
    method,                           // Markdown text of the Method section
    notes,                            // Markdown text of the Notes section, or ''
    servingSize,                      // from Nutrition "Serving size", or ''
    nutrition: [{ label, value }],    // every other Nutrition line, as written, in order
    swatch                            // 0-7 placeholder colour, derived from the slug
  }

  Problems throw RecipeFormatError with the file name and line number.
*/
(function (root) {
  'use strict';

  var SECTIONS = ['recipe data', 'description', 'cook times', 'ingredients', 'method', 'notes', 'nutrition'];
  var REQUIRED = ['recipe data', 'description', 'ingredients', 'method'];
  var DATA_KEYS = ['tags', 'author', 'source', 'image', 'serves'];

  function RecipeFormatError(message, file, line) {
    var where = (file || 'recipe') + (line ? ':' + line : '');
    var err = new Error(where + ': ' + message);
    err.name = 'RecipeFormatError';
    err.file = file; err.line = line;
    return err;
  }

  function slugify(s) {
    return String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
      .replace(/['’]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  }

  // "15 min", "1 h 20 min", "1.5 hours", "90 minutes" -> minutes. null if no time found.
  function minutesFrom(text) {
    var s = String(text || '').toLowerCase();
    var total = 0, found = false, m;
    var re = /(\d+(?:\.\d+)?)\s*(hours?|hrs?|h|minutes?|mins?|m)\b/g;
    while ((m = re.exec(s))) {
      found = true;
      total += parseFloat(m[1]) * (m[2].charAt(0) === 'h' ? 60 : 1);
    }
    return found ? Math.round(total) : null;
  }

  function swatchFor(slug) {
    var h = 0;
    for (var i = 0; i < slug.length; i++) h = (h * 31 + slug.charCodeAt(i)) >>> 0;
    return h % 8;
  }

  function stripMarker(line) { return line.replace(/^\s*(?:[-*+]|\d+[.)])\s+/, ''); }

  function keyValue(line) {
    var m = /^([^:]+):\s*(.*)$/.exec(stripMarker(line).trim());
    return m ? { key: m[1].trim(), value: m[2].trim() } : null;
  }

  function parseSource(v) {
    var link = /^\[([^\]]+)\]\(([^)\s]+)\)$/.exec(v);
    if (link) return { text: link[1].trim(), url: link[2] };
    if (/^https?:\/\/\S+$/i.test(v)) {
      var host = v.replace(/^https?:\/\//i, '').replace(/\/.*$/, '').replace(/^www\./, '');
      return { text: host, url: v };
    }
    return { text: v, url: null };
  }

  function parseRecipe(md, opts) {
    opts = opts || {};
    var file = opts.filename || '';
    var lines = String(md || '').replace(/^﻿/, '').replace(/\r\n?/g, '\n').split('\n');

    // Title: the first non-empty line must be "# Title".
    var i = 0;
    while (i < lines.length && !lines[i].trim()) i++;
    var t = /^#\s+(.+?)\s*#*\s*$/.exec(lines[i] || '');
    if (!t) throw RecipeFormatError('the first line must be the title, e.g. "# Wild Rice Soup"', file, i + 1);
    var title = t[1];

    // Split into "## Section" blocks.
    var sections = {};
    var current = null;
    for (i = i + 1; i < lines.length; i++) {
      var line = lines[i];
      var h = /^##\s+(.+?)\s*#*\s*$/.exec(line);
      if (h) {
        var name = h[1].trim().toLowerCase();
        if (SECTIONS.indexOf(name) === -1) {
          throw RecipeFormatError('unknown section "## ' + h[1].trim() + '". Expected one of: ' +
            SECTIONS.map(function (s) { return s.replace(/\b\w/g, function (c) { return c.toUpperCase(); }); }).join(', '), file, i + 1);
        }
        if (sections[name]) throw RecipeFormatError('section "## ' + h[1].trim() + '" appears twice', file, i + 1);
        current = sections[name] = { start: i + 1, lines: [] };
      } else if (/^#\s/.test(line)) {
        throw RecipeFormatError('only one "# Title" is allowed; use "## " for sections', file, i + 1);
      } else if (current) {
        current.lines.push({ text: line, n: i + 1 });
      } else if (line.trim()) {
        throw RecipeFormatError('text before the first "## " section; put it under "## Description"', file, i + 1);
      }
    }
    REQUIRED.forEach(function (s) {
      if (!sections[s]) throw RecipeFormatError('missing required section "## ' + s.replace(/\b\w/g, function (c) { return c.toUpperCase(); }) + '"', file, null);
    });

    function body(name) {
      var sec = sections[name];
      if (!sec) return '';
      return sec.lines.map(function (l) { return l.text; }).join('\n').replace(/^\s*\n|\s+$/g, '').trim();
    }
    function nonEmpty(name) { return sections[name] ? sections[name].lines.filter(function (l) { return l.text.trim(); }) : []; }

    // Recipe Data
    var data = {};
    nonEmpty('recipe data').forEach(function (l) {
      var kv = keyValue(l.text);
      if (!kv) throw RecipeFormatError('Recipe Data lines must look like "- Key: value"', file, l.n);
      var key = kv.key.toLowerCase();
      if (DATA_KEYS.indexOf(key) === -1) {
        throw RecipeFormatError('unknown Recipe Data key "' + kv.key + '". Expected one of: Tags, Author, Source, Image, Serves' +
          (key === 'slug' ? ' (the URL comes from the file name)' : ''), file, l.n);
      }
      if (data[key] !== undefined) throw RecipeFormatError('Recipe Data key "' + kv.key + '" appears twice', file, l.n);
      data[key] = { value: kv.value, n: l.n };
    });

    var tags = data.tags ? data.tags.value.split(',').map(function (s) { return s.trim(); }).filter(Boolean) : [];
    if (!tags.length) throw RecipeFormatError('Recipe Data needs "- Tags: ..." with at least one tag', file, sections['recipe data'].start);
    if (opts.tags) {
      tags.forEach(function (tg) {
        if (opts.tags.indexOf(tg) === -1) {
          throw RecipeFormatError('tag "' + tg + '" is not in content/site.json. Known tags: ' + opts.tags.join(', '), file, data.tags.n);
        }
      });
    }

    // The URL slug is the file name. Without a file name (e.g. in tests), it comes from the title.
    var fileSlug = file ? file.replace(/^.*[\\/]/, '').replace(/\.md$/i, '') : '';
    var slug = fileSlug || slugify(title);
    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) {
      throw RecipeFormatError('file name "' + slug + '.md" must use only lowercase letters, numbers and single hyphens, e.g. "' +
        (slugify(slug) || 'wild-rice-soup') + '.md". It becomes the URL /r/<name>/', file, null);
    }

    // Description: plain text, paragraphs kept.
    var description = body('description').split(/\n\s*\n/).map(function (p) { return p.replace(/\s*\n\s*/g, ' ').trim(); }).filter(Boolean).join('\n\n');
    if (!description) throw RecipeFormatError('"## Description" is empty', file, sections.description.start);

    // Cook Times: one line each, as written.
    var cookTimes = nonEmpty('cook times').map(function (l) {
      var text = stripMarker(l.text).trim();
      var kv = keyValue(text);
      return { text: text, label: kv ? kv.key : '', value: kv ? kv.value : text };
    });
    var totalLine = cookTimes.filter(function (c) { return c.label.toLowerCase() === 'total'; })[0] ||
      (cookTimes.length === 1 ? cookTimes[0] : null);
    var totalMinutes = totalLine ? minutesFrom(totalLine.value) : null;
    var cardTime = totalLine ? totalLine.value : (cookTimes[0] ? cookTimes[0].value : '');

    // Ingredients: a bullet list of plain text lines.
    var ingredients = [];
    nonEmpty('ingredients').forEach(function (l) {
      if (/^[-*+]\s+/.test(l.text)) ingredients.push(stripMarker(l.text).trim());
      else if (/^\s{2,}\S/.test(l.text) && ingredients.length) ingredients[ingredients.length - 1] += ' ' + l.text.trim();
      else throw RecipeFormatError('Ingredients must be a bullet list, one ingredient per "- " line', file, l.n);
    });
    if (!ingredients.length) throw RecipeFormatError('"## Ingredients" is empty', file, sections.ingredients.start);

    var method = body('method');
    if (!method) throw RecipeFormatError('"## Method" is empty', file, sections.method.start);

    // Nutrition: optional "Key: value" lines, shown as written.
    var servingSize = '';
    var nutrition = [];
    nonEmpty('nutrition').forEach(function (l) {
      var kv = keyValue(l.text);
      if (!kv || !kv.value) throw RecipeFormatError('Nutrition lines must look like "- Calories: 350 kcal"', file, l.n);
      if (kv.key.toLowerCase() === 'serving size') servingSize = kv.value;
      else nutrition.push({ label: kv.key, value: kv.value });
    });

    return {
      slug: slug,
      title: title,
      tags: tags,
      author: data.author ? data.author.value : '',
      source: data.source && data.source.value ? parseSource(data.source.value) : null,
      image: data.image ? data.image.value : '',
      serves: data.serves ? data.serves.value : '',
      description: description,
      cookTimes: cookTimes,
      totalMinutes: totalMinutes,
      cardTime: cardTime,
      ingredients: ingredients,
      method: method,
      notes: body('notes'),
      servingSize: servingSize,
      nutrition: nutrition,
      swatch: swatchFor(slug)
    };
  }

  var api = { parseRecipe: parseRecipe, minutesFrom: minutesFrom, slugify: slugify, swatchFor: swatchFor };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.RecipeParser = api;
})(this);
