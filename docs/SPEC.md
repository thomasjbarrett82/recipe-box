# Recipe Box: implementation spec

> This is the design handoff spec the site was built from. Paths such as `reference/` and `scripts/build.js`
> refer to the original prototype package; in this project the equivalents are `src/assets/`, `src/lib/` and
> `scripts/build.js` (see the README). Section 11 lists open product questions that are still undecided.

Status: design approved (Search First layout, Solarized light and dark).
Audience: the developer or coding agent building the production site.

Source of truth, in order:

1. This spec.
2. `reference/`: a working build in plain HTML, CSS and JavaScript. Copy its behaviour and styles.
3. `design/tokens.css` and `design/tokens.json`.
4. `docs/screenshots/` and `design-source/` (the original design canvas files).

---

## 1. Product summary

A static website of recipes that is:

- Searchable from one large search box, with any-word matching and exact phrases in quotes.
- Tagged: every tag has its own page and shareable URL.
- Shareable: every recipe has a permanent URL.
- Printable: print is always plain black text on white, one page for a typical recipe.
- Usable on phones and desktops, in light and dark mode.
- Kitchen-friendly: ingredient checklist and an optional "Keep screen on" switch.

## 2. Technical approach

- **Static site generator.** Any generator works (Eleventy, Astro, Hugo, Jekyll or similar). The choice is open; the requirements are:
  - One plain Markdown file per recipe, no YAML front matter. Format: `content/FORMAT.md`. Example: `content/recipes/wild-rice-soup.md`.
  - A build step parses every file with `reference/assets/recipe-parser.js` (or an equivalent) and **fails the build** on any format error, listing file and line. `scripts/build.js` is a working example of this step.
  - Build-time generation of every recipe page, every tag page, the all-tags page and a search index JSON file.
  - Output is plain static files that can be hosted anywhere.
- **No JavaScript framework required.** The reference uses plain JavaScript. Recipe and tag pages must work without JavaScript (content is in the HTML). JavaScript only adds search, theme toggle, copy/share, the wake lock switch and the tag-page filter.
- **Font:** DM Sans, weights 400, 500, 600 and 700. Self-host it in production rather than calling Google Fonts at runtime.
- **Units:** all ingredient quantities are metric.

## 3. URLs

| Page | URL | Notes |
| --- | --- | --- |
| Home, search | `/` | Search state in query string: `/?q=rice+chicken&tag=Quick`, so searches can be shared. Use `history.replaceState` while typing. |
| Recipe | `/r/<slug>/` | Slug is the file name without `.md`; there is no slug field. It is permanent; if a file is ever renamed, add a redirect or old links reach the 404 page. |
| Tag | `/tags/<tag-slug>/` | Tag slug is the lowercase, hyphenated tag name: `Minnesota` → `minnesota`. |
| All tags | `/tags/` | Not separately designed; reuse the tag page header and chip row (see reference). |
| Search index | `/search-index.json` | Generated at build time. See section 6. |
| Not found | `/404.html` | Served by the host, with HTTP status 404, for any URL that doesn't exist. See section 4.6. |

The reference build uses `recipe.html?r=<slug>` and `tag.html?t=<slug>` only because it runs from plain files; map them to the URLs above.

## 4. Pages

All measurements are CSS px. Desktop container: 960 px (home, tag), 1120 px (recipe), 24 px side padding. Mobile breakpoint: 640 px (16 px side padding). Minimum touch target: 44 px.

### 4.1 Header (all pages)

- Left: wordmark "recipe box" (18 px, 700). Links to `/`.
- Home: right side has an "All tags" link and the theme toggle.
- Tag and recipe pages: a 44 px pill search field (1.5 px border, max 520 px wide), then the theme toggle at the far right.
  - On the recipe page, header search submits to `/?q=…`.
  - On the tag page, header search filters within the tag.
- Recipe page under 640 px: the wordmark is replaced by a 44 px round back button to `/`, and a bottom border is added under the header.
- Theme toggle: 44 px round icon button. Shows a moon in light mode and a sun in dark mode. `aria-label` reads "Switch to dark mode" or "Switch to light mode".

### 4.2 Home and search (`/`)

- Heading "What are we cooking?" (44 px, 700, letter-spacing -0.03em; 34 px on mobile).
- Search field:
  - 64 px tall, 2 px border, pill shape.
  - Placeholder: `Try rice chicken or "wild rice"`.
  - A "Clear" button appears inside the field when any search or tag filter is active. It clears both.
- Help line under the field: "Finds recipes with any of your words. Put a phrase in quotes to match it exactly."
- Tag chips, centred:
  - Single-select filter, combined with the search as AND.
  - Pressing the active chip turns it off.
  - Use `aria-pressed`. Selected style: accent background, on-accent text.
- Results line:
  - No filter: "All 8 recipes".
  - Filtering: "3 results", plus " with any of: rice, chicken. Most matches first." when there are 2 or more terms.
  - Use `aria-live="polite"`.
- Results grid: `repeat(auto-fill, minmax(min(380px, 100%), 1fr))`, 12 px gap.
- Result card (whole card is a link; 1 px border, 16 px radius, 14 px padding):
  - Title (18 px, 700).
  - Path `/r/<slug>` (13 px, muted).
  - "Matches: rice, chicken" (13 px, 600, accent), only while searching.
  - Pills: the card time (strong pill; the value of the recipe's `Total` cook time, else its first cook time, else none), then tags.
  - 88 px square thumbnail on the right (photo, or colour swatch placeholder).
- Empty state: "Nothing yet. Try a shorter word."

### 4.3 Tag page (`/tags/<tag>/`)

- Breadcrumb: Home / Tags / {Tag}.
- Heading: tag name (44 px). Sub line: `/tags/<slug> · N recipes` (plus "with any of: …" while searching).
- Sort select, right aligned: "A to Z" (default) or "Quickest first". Quickest uses minutes read from the `Total` cook time ("60 min", "1 h 20 min"); recipes without a readable total go last.
- Tag chip row with counts. These chips are links to other tag pages, and the current one has `aria-current="page"`. A divider line sits under the row.
- Cards: same as home, but show the description instead of the path, and leave out the current tag's pill.
- Header search filters within this tag using the same search rules. With a search active, recipes matching more terms come first, and the chosen sort breaks ties.

### 4.4 Recipe page (`/r/<slug>/`)

- Breadcrumb: Home / {first-tag} / {title}.
- Title: `clamp(30px, 5vw, 52px)`, 700.
- Under 640 px, the path `/r/<slug>` shows under the title.
- Description (lede): 18 px muted (16 px mobile). Plain text.
- Byline under the description (14 px muted): "By {Author} · Source: {source}".
  - Each part is optional; with neither, there is no byline.
  - Source is a link (accent colour) when the file gives a URL, otherwise plain text.
- Meta pills:
  - One strong pill per `## Cook Times` line, exactly as written ("Prep: 15 min", "Rise: 2 h"), in file order.
  - Then "Serves N" if Serves is set.
  - Tag pills link to their tag pages.
- Actions:
  - Desktop:
    - URL pill: `example.com/r/<slug>` plus a "Copy link" button. Neutral styling, not accent.
    - Print button: outlined.
    - "Keep screen on" switch.
  - Mobile (under 640 px):
    - Two equal buttons: "Share" (neutral) and "Print" (outlined).
    - The switch below them becomes a full-width row with a hint line.
- Square photo on the right, at most 320 px, 24 px radius. Hidden on mobile.
- Body, two columns that stack on mobile:
  - Ingredients panel (outlined, 20 px radius, max 380 px):
    - Heading "Ingredients" plus "Check off as you go".
    - Each ingredient is a real checkbox with a label showing the ingredient line exactly as written (plain text, never split into amount and name).
    - Checked items are struck through.
    - The checkbox state is not saved.
  - Method:
    - "Method" heading (h2), then the recipe's `## Method` section rendered to plain HTML (see 4.4.1).
    - Sections (h3, for example "Prep", "Cook"): 18 px, 700, with a 1 px rule under them.
    - Each step is an outlined card (18 px radius) with "Step N" (14 px, 700, accent) above the text (17 px).
    - Step numbers come from a CSS counter and restart at 1 in each section.
    - Sub-steps (an indented list under a step) show inside that step's card as a lettered list (a, b, c), 16 px.
    - No time badges. Any timing is written in the step text ("about 45 min").
- Notes (full width, after the two columns; see 4.4.3).
- Nutrition (full width, last; see 4.4.2).

#### 4.4.1 Method format

The method is the `## Method` section of the recipe file, written as plain Markdown.

```markdown
### Prep

1. Rinse the wild rice in a sieve under cold water.
2. Dice the onion, carrot and celery. Slice the mushrooms.

### Cook

1. Simmer the rice in 700 ml of the stock, covered, about 45 min.
2. Make the roux:
   - Melt the butter over medium heat.
   - Stir in the flour and cook 2 min.
3. Add the rice, chicken and cream. Season to taste.
```

- `### Heading`: a section. Sections are optional; a method that is only a numbered list is one list.
- `1.` lines: steps. The numbers typed don't matter; display numbering is automatic and restarts per section.
- Indented `-` or `1.` lines under a step: sub-steps.
- Any other line: a paragraph (for example a tip between sections), shown in muted text.
- Render with the site generator's standard Markdown renderer into a wrapper with class `method-body`. All styling targets plain `h3`, `ol`, `li` and `p` inside it (`reference/assets/styles.css`). No custom HTML is needed.
- `reference/assets/method.js` is a small renderer for this subset, used only by the reference build, with tests in `reference/tests/method.test.js`. It shows the exact HTML shape the CSS expects.

#### 4.4.2 Nutrition

- Sits at the bottom of the recipe page, full width, below a 1 px rule.
- Always shown. Source: the optional `## Nutrition` section, `- Label: value` lines.
- Heading "Nutrition" on the left. On the right (stacked under it on mobile): "Per serving ({Serving size}). Serves N." Each part appears only if given.
- Every line except `Serving size` becomes a tile, label and value exactly as written, in file order. Any label is allowed (Calories, Iron, Vitamin C...).
- Grid of tiles, `repeat(auto-fill, minmax(150px, 1fr))` on desktop and 2 columns on mobile:
  - Each tile has a 1 px border and 14 px radius.
  - Label 13 px muted; value 20 px, 700.
- No nutrition lines (section missing or empty): the section shows only the heading and "No nutritional info yet." (16 px muted).
- Values come from the author. The site does not calculate them.

#### 4.4.3 Notes

- Optional free-form text from the `## Notes` section, written in Markdown: paragraphs, bullet or numbered lists, one level of indented sub-items, **bold** and *italic*.
- Position: full width, below the Ingredients and Method columns and above Nutrition, separated by a 1 px rule. Order on the page: Ingredients and Method, then Notes, then Nutrition.
- Heading "Notes" (22 px, 700; 20 px on mobile). Body text 17 px with 1.6 line height (16 px on mobile), max width 760 px for readability.
- Hidden on screen when the recipe has no notes.
- Not searched.
- Render with the site generator's Markdown renderer into a wrapper with class `notes-body` (styles in `reference/assets/styles.css`). The reference build uses `notesToHtml` in `method.js`, with tests.

Example:

```markdown
## Notes

Cooking time varies by brand of wild rice. Start checking at 30 min.

- The soup thickens as it sits. Thin it with a little stock when reheating.
- To freeze, leave out the cream and stir it in after thawing.
```

### 4.5 Print (any recipe page)

- Triggered by the Print button (`window.print()`) or the browser's own print command.
- Always plain: black `#18181b` text on white, no theme colours, no backgrounds. This holds even when dark mode is on.
- Hidden: header, breadcrumb, action buttons, photo, hint text.
- Layout on one US Letter page with 0.75 in margins (A4 also fine):
  - Small "recipe box" label, then the title (30 pt), lede, byline (a linked source prints its URL in brackets), and the cook-time and servings pills (outlined; tag pills move to the footer).
  - Top right: QR code linking to the recipe URL, with "Scan for the online version" under it.
  - Two columns:
    - Left (2.5 in): ingredients with empty tick-boxes, then nutrition as compact label/value rows, or "No nutritional info yet.".
    - Right: method. Section names in small capitals with a rule, then steps numbered "1." with a hanging indent and no cards.
    - Under the method: a "Notes" box with the recipe's notes (10 pt), then one blank line to write on. The box prints even when the recipe has no notes, so there is always room to write.
  - Footer: recipe URL on the left, tags on the right.
- Copy `reference/assets/print.css` (linked with `media="print"`).
- QR code: generate an SVG per recipe at build time with any QR library and inline it where the reference has the "QR code" placeholder box. If skipped, remove the box.

### 4.6 Page not found (404)

- Reference: `reference/404.html`. Canvas: "Page not found" boards (light and dark).
- Same header as home (wordmark, "All tags", theme toggle). No search box.
- Centred, max 600 px, 96 px top and bottom padding (64 px on mobile):
  - "404" label (14 px, 700, accent, letter-spacing 0.08em).
  - Heading "Page not found" (44 px, 700; 34 px on mobile).
  - Text (18 px muted; 16 px on mobile): "That page doesn't exist. It may have moved, or the link may have a typo."
  - Outlined button linking to `/`: back-arrow icon plus "Back to the homepage".
- Follows the light/dark theme like every other page. Add `<meta name="robots" content="noindex">`.
- Hosting:
  - Configure the host to serve `/404.html` with status 404 for missing URLs. Most static hosts support this; the setting name varies by host.
  - The page can appear at any path (an old recipe link, a mistyped tag), so every link and asset URL in it must be root-absolute (`/assets/styles.css`, not `assets/styles.css`).

## 5. Theme: light and dark

- **First visit:** follow the OS setting (`prefers-color-scheme`).
- **Toggle:** sets `<html data-theme="light|dark">` and saves it to `localStorage` key `theme`. The saved value wins over the OS setting from then on.
- **No flash:** apply the saved value before first paint with the one-line inline script in each page's `<head>` (see reference).
- **Print** ignores the theme entirely.
- All colours come from CSS custom properties in `design/tokens.css`. Do not hard-code colours in components.

### Palette (Solarized-based, contrast-adjusted)

| Token | Light | Dark | Used for |
| --- | --- | --- | --- |
| `--bg` | `#fdf6e3` | `#001e26` | Page background |
| `--surface` | `#fdf6e3` | `#001e26` | Cards, panels (outlined, not filled) |
| `--surface2` | `#eee8d5` | `#073642` | Buttons, chips, badges, URL pill |
| `--text` | `#073642` | `#eee8d5` | Main text |
| `--muted` | `#586e75` | `#93a1a1` | Secondary text |
| `--border` | `#93a1a1` | `#657b83` | Card outlines, dividers |
| `--accent` | `#b64314` | `#eb7747` | Links, selected chips, step labels, match lines, switch on |
| `--on-accent` | `#fdf6e3` | `#001e26` | Text on accent |
| `--strong` / `--on-strong` | `#073642` / `#fdf6e3` | `#eee8d5` / `#001e26` | Time and servings pills |
| `--field-border` | `#586e75` | `#93a1a1` | Search fields, outlined Print button |

Contrast rules that the palette depends on:

- Every text colour above passes WCAG AA (4.5:1) on `--bg`.
- Never put `--muted` text on `--surface2`. In light mode it measures 4.4:1, which fails; use `--text` there instead.
- The accent is Solarized orange (`#cb4b16`), shaded per mode to pass 4.5:1. Do not swap it back to the canonical value.
- The dark background `#001e26` is a deepened Solarized base03, chosen for higher contrast.

Photo placeholders: until a recipe has a photo, use swatch `--swatch-N`, where N (0 to 7) is derived from the slug (`swatchFor()` in `recipe-parser.js`), so each recipe always gets the same colour. Each swatch is one Solarized accent mixed into the background.

## 6. Search

Search runs client-side over `/search-index.json`. Implementation: `reference/assets/search.js`. Its behaviour is pinned by `reference/tests/search.test.js`, 14 tests. Run every test (40: search, recipe parser, method and notes rendering) with `node --test reference/tests/*.test.js`.

**Index** (built at build time; example output `reference/search-index.json`): one entry per recipe with `slug`, `title`, `description`, `tags`, `ingredients` (the plain text lines), `cardTime`, `totalMinutes`, `swatch` and `image`. The method, notes, cook times and nutrition are not searched.

**Rules:**

1. **Any word matches (OR).** `rice chicken` returns recipes containing "rice" or "chicken".
2. **Ranking:** recipes matching more distinct terms come first. Ties keep the default order (home) or the chosen sort (tag page).
3. **Exact phrases:** text in double or single quotes is one phrase, for example `"wild rice"` or `'green beans'`.
   - Curly quotes from phone keyboards (“ ” ‘ ’) count as quotes.
   - A quote only opens at the start or after a space, and only closes before a space or at the end. So an apostrophe inside a word, like `grandma's`, is not a quote.
4. **Whole words only.** "rice" does not match "licorice", and "ric" matches nothing.
5. **Plurals:** a word matches its singular or plural (egg/eggs, berry/berries, tomato/tomatoes, dish/dishes). The same folding is applied to the text and the query. Irregular plurals (leaf/leaves) are not handled.
6. **Case, accents and apostrophes** are ignored: `JALAPENO` matches "Jalapeño", and `grandma` matches "Grandma's".
7. **Hyphenated words** match as a unit: `all-purpose` matches "all-purpose flour".
8. **Phrases stay inside one field:** the title, the description, one tag, or one ingredient line. `"rice chicken"` does not match a recipe that lists "wild rice" and then "chicken stock".
9. **Repeated terms** count once.
10. **Tag filter** (home chips, or the tag page itself) is applied as AND before search.
11. Each result reports which terms it matched, shown as "Matches: rice, chicken".

**Performance:** a linear scan is fine for hundreds of recipes. If the collection passes a few thousand, pre-tokenise fields into the index at build time.

## 7. Sharing

- Desktop shows the recipe URL plus "Copy link", which calls `navigator.clipboard.writeText(location.href)`.
  - On success: the label changes to "Link copied" and a polite status message is announced.
  - On failure: the status line says so.
- Mobile shows "Share", which calls `navigator.share({ title, url })` where available and falls back to copy.
- References:
  - [Navigator](https://developer.mozilla.org/en-US/docs/Web/API/Navigator/share)
  - [Clipboard](https://developer.mozilla.org/en-US/docs/Web/API/Clipboard/writeText)
- Add Open Graph tags per recipe (title, description, image if any) so shared links preview well. This is not designed, but it is standard.

## 8. Keep screen on (wake lock)

Implementation: `reference/assets/wake-lock.js`.

- A switch button (`role="switch"`, `aria-checked`) labelled "Keep screen on". Off by default on every page load.
- On: calls `navigator.wakeLock.request('screen')` and shows "Your screen will stay on while this page is open."
- Hide the switch entirely when `'wakeLock' in navigator` is false.
- The browser releases the lock when the tab is hidden. If the switch is still on, request it again on `visibilitychange` when the page is visible.
- If the device revokes the lock while the page is visible, set the switch back to off.
- References:
  - [Screen_Wake_Lock_API](https://developer.mozilla.org/docs/Web/API/Screen_Wake_Lock_API)
  - [wake-lock](https://developer.chrome.com/articles/wake-lock/)

## 9. Accessibility checklist

- Real elements throughout: `<a href>` for navigation, `<button>` for actions, `<input type="checkbox">` with `<label>`, and `<select>`.
- Every input has a label; visually hidden labels use the `.sr-only` class.
- Icon-only buttons have `aria-label`. Decorative SVGs have `aria-hidden="true"`.
- Visible focus ring: 2 px accent outline, 2 px offset.
- Tag filter chips use `aria-pressed`; tag navigation chips use `aria-current="page"`; the wake lock switch uses `role="switch"`.
- The results count and copy status are announced politely.
- Touch targets are at least 44 px.
- Respect `prefers-reduced-motion` (the only motion is the switch transition).
- Pages must remain usable with JavaScript off. Search needs JavaScript; the recipe content does not.

## 10. Content

- Format guide for authors: `content/FORMAT.md`. One plain Markdown file per recipe in `content/recipes/`; sections `## Recipe Data`, `## Description`, `## Cook Times`, `## Ingredients`, `## Method`, `## Notes`, `## Nutrition`.
- Parser: `reference/assets/recipe-parser.js` turns a file into the recipe data object documented at the top of that file. Tests: `reference/tests/parser.test.js` (every content file must parse; typos produce file:line errors).
- Build example: `node scripts/build.js` checks every file, then writes `reference/assets/data.js` and `reference/search-index.json`. Production does the same inside the site generator.
- Tags must be listed in `content/site.json`, which also sets the chip order. An unknown tag fails the build, which catches typos like "Breakfest".
- Sample content: 8 recipes. Only Wild Rice Soup is complete; the other 7 have a placeholder method and no nutrition, to exercise search, tags and the "No nutritional info yet." state. Replace them with real content.

## 11. Open questions (decide before or during build)

1. Should the wake lock switch remember its setting across recipes?
2. Should the ingredient checkboxes keep their state when the page is reloaded (per recipe, in `localStorage`)?
3. Should a title match rank higher than an ingredient match? Today every field counts equally.
4. Should more than one tag be selectable at a time? The design allows one. Multiple tags would need a URL format such as `/?tag=Quick&tag=Minnesota`.
5. Photos: source, size and crop. The design assumes square crops, 88 px in lists and up to 320 px on the recipe page. Generate responsive sizes.
6. Should the "Quick" tag be applied by hand, or derived from the `Total` cook time (for example 30 minutes or less)?
7. Ingredient lines are plain text, so the site cannot scale amounts or calculate nutrition. Adding a servings adjuster later would need structured amounts.
8. Should notes be searchable? They are not today. Including them would match tips such as "freeze" or "make ahead".
