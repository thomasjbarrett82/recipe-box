# Recipe file format

One recipe per file in `content/recipes/`, plain Markdown only. The file name is the recipe's
permanent URL: `wild-rice-soup.md` becomes `/r/wild-rice-soup/`. There is no separate slug field.
Use only lowercase letters, numbers and hyphens, and don't rename a file after publishing:
old links would land on the "Page not found" page unless a redirect is added.

Check your files with `npm run check` (or preview the site with `npm run dev`). If anything is
wrong, it lists every problem with the file name and line number, and nothing is built.

## Template

```markdown
# Recipe Title

## Recipe Data

- Tags: Soup, Dinner
- Author: Your Name
- Source: [Where it came from](https://example.com)
- Image: /images/recipe-title.jpg
- Serves: 4

## Description

One or two sentences about the dish.

## Cook Times

Prep: 15 min
Cook: 45 min
Total: 60 min

## Ingredients

- 240 ml (1 cup) wild rice, rinsed
- Salt to taste

### Topping

- 30 ml (2 tbsp) melted butter

## Method

### Prep

1. First prep step.

### Cook

1. First cooking step.
   - An indented line is a sub-step.

## Notes

Free-form tips. Paragraphs and lists are fine.

## Nutrition

- Serving size: 475 ml
- Calories: 350 kcal
- Protein: 20 g
```

## Rules

| Part | Required | Rules |
|---|---|---|
| `# Title` | Yes | The first line. Only one `#` heading per file. |
| `## Recipe Data` | Yes | `- Key: value` lines (the `- ` is optional). Keys: **Tags** (required, comma-separated, each must be in `content/site.json`), **Author**, **Source**, **Image**, **Serves**. Any other key is an error. |
| `## Description` | Yes | Plain text. Shown under the title, on tag pages and in print. Searchable. |
| `## Cook Times` | No | One line per time, any labels you like (`Rise: 2 h`, `Bake: 35 min`). Each line is shown as a pill exactly as written. A line labelled `Total` is used for the time on result cards and for "Quickest first" sorting, so write it as minutes and/or hours (`60 min`, `1 h 20 min`). |
| `## Ingredients` | Yes | A bullet list, one ingredient per line, plain text exactly as you want it shown. Lines are never split up. Searchable. Optional `### Group` headings (Crust, Filling, Sauce...) split the list into groups; lines before the first heading form an unnamed group. |
| `## Method` | Yes | Optional `### Section` headings (Prep, Cook...), each followed by a numbered list. Numbers you type don't matter; the site numbers steps and restarts at 1 in each section. Indented lines are sub-steps. |
| `## Notes` | No | Free-form Markdown: paragraphs, lists, **bold**, *italic*. Shown after Ingredients and Method, above Nutrition. |
| `## Nutrition` | No | `- Label: value` lines, all optional, shown as written in the order written. `Serving size` is shown in the subheading instead of as a tile. If the section is missing or empty, the page says "No nutritional info yet." |

- Section headings are not case-sensitive and can be in any order.
- Write the metric amount first, with SI unit symbols and no periods, and the US amount in brackets: `240 ml (1 cup) milk`, `450 g (1 lb) ground beef`. Amounts with no US equivalent stay as they are: `2 eggs`, `1 can cream of mushroom soup`. Oven temperatures in the method follow the same pattern: `175 °C (350 °F)`. Times use `min` and `h`: `15 min`, `1 h 20 min`.
- **Source** can be a Markdown link `[Grandma](https://...)`, a bare URL, or plain text (`Grandma's recipe box`).
- **Image** is optional. Put the photo in `static/images/` and write its path from there: `static/images/wild-rice-soup.jpg` is `- Image: /images/wild-rice-soup.jpg`. A full `https://` URL also works. Square photos work best. A path that doesn't match a file fails the build. Without an image, the site shows a coloured placeholder chosen automatically from the file name.
