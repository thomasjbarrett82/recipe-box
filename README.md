# Recipe Box

A static recipe website generated from plain Markdown files. It is search first, with tags, shareable recipe URLs, a print-friendly layout, and Solarized light and dark modes.

## Quick start

Needs [Node.js](https://nodejs.org) 22 or newer.

```text
npm install      # once
npm run dev      # build, serve at http://localhost:8080, rebuild when files change
```

Open http://localhost:8080 and review the site. With `npm run dev` running, any saved change to a recipe, the templates or the styles rebuilds the site; reload the browser to see it. If a recipe has a mistake, the browser shows the problem (file and line) until you fix it.

## Commands

| Command | What it does |
| --- | --- |
| `npm run dev` | Build, preview at http://localhost:8080, and rebuild on every change |
| `npm run serve` | Build once and preview (no rebuilding) |
| `npm run build` | Build the site into `dist/` |
| `npm run check` | Check every recipe file without building |
| `npm test` | Run the tests |

The preview server behaves like the real host: `/r/<slug>/` URLs work, and unknown URLs show the 404 page with status 404. Use `PORT=3000 npm run dev` (or `$env:PORT=3000` in PowerShell) for another port.

## Adding a recipe

1. Create `content/recipes/<name>.md`. The file name is the permanent URL (`/r/<name>/`); use lowercase letters, numbers and hyphens. `content/recipes/wild-rice-soup.md` is a complete example, and `content/FORMAT.md` documents the format.
2. Tags must be listed in `content/site.json`, which also sets the order of the tag chips. Tags that no recipe uses are left off the site.
3. Photos go in `static/images/` and are referenced as `- Image: /images/<file>.jpg`.
4. Run `npm run dev` and check the page.

The build checks every file, and any problem stops it with the file and line number, so a broken recipe is never published.

## Configuration

`content/site.json`:

- `url` is the site's public address. It is used for the copy-link pill, the printed QR codes, the footer of printed pages and Open Graph link previews. **Set it before publishing** (it is `https://example.com` for now).
  - If the site lives under a path, such as a GitHub Pages project site (`https://<user>.github.io/recipe-box`), include the path. Every link on the site then includes it, and the local preview serves the site under the same path.
  - A `SITE_URL` environment variable overrides it for one build.
- `tags` is the allowed tag list, in chip order.

## Publishing

Every push to `main` builds the site and deploys it to GitHub Pages (`.github/workflows/deploy.yml`). The workflow runs the tests and the build first; if either fails (for example a recipe format error), nothing is deployed and the live site stays as it was. You can also start a deploy by hand from the repository's **Actions** tab.

One-time GitHub setup:

1. **Settings > Pages > Build and deployment > Source:** choose **GitHub Actions**.
2. **Settings > Pages > Custom domain:** enter `recipes.tbarrett.org`, then turn on **Enforce HTTPS** once the certificate is issued.
3. At your DNS provider, add a `CNAME` record for `recipes` pointing to `<your-github-username>.github.io`.

To publish somewhere else, `npm run build` writes plain static files to `dist/` (not committed to git) for any static host. Configure the host to serve `404.html` with status 404 for missing URLs; GitHub Pages, Netlify and Cloudflare Pages do this automatically.

## Project layout

| Path | What it is |
| --- | --- |
| `content/recipes/` | One Markdown file per recipe |
| `content/site.json` | Site URL and the allowed tags |
| `content/FORMAT.md` | How to write a recipe file |
| `static/` | Copied into the site as is (photos in `static/images/`) |
| `scripts/build.js` | The site generator: parses and checks recipes, writes every page, the search index and assets |
| `scripts/serve.js` | Local preview server (`npm run serve` / `npm run dev`) |
| `src/lib/recipe-parser.js` | Recipe file format parser, with file:line errors |
| `src/lib/templates.js` | HTML for every page |
| `src/lib/markdown.js` | Renders the Method and Notes sections (markdown-it, raw HTML escaped) |
| `src/assets/` | CSS and browser JavaScript, copied to `/assets/`: search, theme toggle, wake lock, page scripts, `tokens.css`, `styles.css`, `print.css` |
| `test/` | Tests for the parser, search, Markdown rendering and the build, run against the sample recipes in `test/fixtures/` |
| `docs/SPEC.md` | The design specification the site was built from, including open product questions |
| `docs/design-tokens.json` | Design tokens with notes and contrast ratios |

## How it works

- **No framework.** Pages are generated at build time as complete HTML, so recipes and tags work without JavaScript. JavaScript only adds search, the theme toggle, copy/share, print, the "Keep screen on" switch and filtering on tag pages. Controls that need JavaScript are hidden when it is off.
- **Search** runs in the browser over `/search-index.json`: any-word matching, exact phrases in quotes, plurals, accents (rules in `docs/SPEC.md` section 6). `src/assets/search.js` is shared with the tests.
- **Cards** come from `src/assets/cards.js`, which the build and the browser both use, so cards from search results match the built ones.
- **Print** uses `print.css`: plain black on white whatever the theme, with a QR code generated per recipe at build time.
- **Fonts:** DM Sans is self-hosted from the `@fontsource-variable/dm-sans` package.
- CSS and JS URLs carry a content hash (`styles.css?v=…`), so browsers pick up changes after each deploy.
