# content/

Everything the site shows, as plain files. No CMS.

```
content/
  projects/<slug>/index.md   one case study: frontmatter + Markdown body
  projects/<slug>/media/     its images (and later clips)
  projects/<slug>/source.html  the old Webflow page, kept as a backup (not used by the site)
  site/home.md               intro line and homepage SEO
  site/brand/                logo files (see below)
  site/intro-video/          the old site's background video loop
```

## Case study frontmatter

| Field | Meaning |
| --- | --- |
| `slug` | URL: `/projekat/<slug>`. Keep the old ones (cupra, bash, mirza, kodeks, omg). |
| `draft` | `true` hides the project from the site. |
| `title` | Page title and H1. |
| `grid_title` | Short name on the grid tile (the old site's tile text). |
| `client`, `brand` | Legal client and the brand the work was for. |
| `year` | As written, e.g. `"2024 - 2026"`, `"08/2025"`. |
| `tags` | Filters: `integrisane`, `foto-video`, `dizajn`, `social`, `web`. |
| `order` | Grid position, 1 = strongest. |
| `tagline` | One line under the title. |
| `result_line` | One-line result on the grid tile. |
| `hero` | Tile and hero image. |
| `gallery` | Work images, in order. |
| `loop` | 5–10 s muted clip for the tile (none yet). |
| `seo_title`, `seo_description` | `<title>` and meta description. |
| `legacy_url` | Old Webflow URL that must keep working / redirect here. |
| `links` | External links (reels, YouTube). |

`services_on_old_site` and `grid_tags_on_old_site` are only there to show where the old
site's tags disagreed; `tags` is their union. Drop them once the tags are confirmed.

## Adding a case study

Copy a folder in `projects/`, rename it to the new slug, swap the images in `media/` and
edit `index.md`. The body keeps this order: Brief, what we did, the work, result.

## Brand files (`site/brand/`)

- `daliah-mark.svg`: the square mark with the ring, no wordmark.
- `daliah-wordmark.svg`: DALIAH in purple.
- `daliah-ring.svg`: the purple ring alone (corner logo, cursor, favicon).
- `daliah-logo.svg`: mark + wordmark stacked.
- `daliah-source.pdf`: the vector original.
- `old-*`: files the Webflow site used, kept for reference.

Colours are the brief's hex values: purple `#642969`, pink `#DF769C`, orange `#EBA342`,
olive `#A29342`, red-orange `#D75E3A`, slate blue `#5F7E94`.
