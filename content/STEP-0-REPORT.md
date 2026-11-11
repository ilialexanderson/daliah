# Step 0 report: import from daliah.ba

Crawled 2026-11-11 with `scripts/import-webflow.py` (rerun it to refresh `content/`).

## What was imported

| Project | Slug | Images | Text | Notes |
| --- | --- | --- | --- | --- |
| Cupra (Porsche BH) | `cupra` | 4 | full | 4 Instagram reel links with like counts |
| BASH (A.W.G.) | `bash` | 5 | full | |
| Mirza Mustafagić | `mirza` | 5 | full | 1 YouTube video (embed, not downloaded) |
| KODEKS | `kodeks` | 6 | full | brochure image inside the text |
| OMG | `omg` | 5 | full | |
| Sarajevski polumaraton | `polumaraton` | 1 | **none** | stub, `draft: true` |

Also: intro line (`site/home.md`), background video loop (MP4 3.1 MB, WebM 3.2 MB, poster),
favicons, and the logo as SVG (mark, wordmark, ring, full).

Total about 11 MB, of which 6 MB is the intro video.

## Missing or broken

1. **Polumaraton has no case study.** The tile links to
   `https://daliah-test.webflow.io/projekat/bash-dobar-kejs` (Webflow staging, returns 404;
   the brief says it used to open the Bash case). Only the tile image (`ngo_marathon.webp`)
   exists. Needs client, year, tags, brief, what we did, result, images. It also had no
   filter tags on the grid.
2. **No client on KODEKS and OMG pages.** `client` is a TODO in both.
3. **No video files anywhere on the case studies.** Every project has stills only. The grid
   loops (5–10 s per project) and any reels must come from your own files. Mirza's video is
   a YouTube embed (`MAIhNe21YVg`); Cupra's reels are Instagram links.
4. **Images are small for "the work itself big".** BASH gallery is 667 px square, the
   Mirza and OMG tile images are 640 px. Cupra, OMG gallery, Mirza gallery are 1800–2700 px
   (fine). Originals would help for BASH and KODEKS (Instagram posts at 1000 px).
5. **No alt text** on any image of the old site. Needs writing in step 1.
6. **Tags disagree** between the grid and the case pages. Examples: Cupra is "foto-video"
   only on both, but its text describes strategy and social; OMG's grid tile says
   integrisane + social while its page lists all five services. `tags` uses the union;
   confirm per project.
7. **`/usluga/*` pages** (foto-video, integrated, dizajn, social, web) are linked from every
   case study but return 404. They need redirects to the grid with the filter applied.
8. **No contact details on the old site**: no email, phone, Instagram or LinkedIn link
   anywhere. Needed for step 1.
9. **Old meta description** starts with "marketing agencija sarajevo" (brief: rewrite).
   Case study meta descriptions are the taglines and are fine to keep.
10. **No `result_line`** for grid tiles exists on the old site: TODO in every project.
11. **Typos in source text**, kept as is: Mirza "šta su, ustvar,i granice", Mirza "Note i
    self rimajnder" (probably intended), KODEKS "spooky muzika u pozadini )" (empty emoji?).
12. **Fonts**: the old site loaded six Google Fonts (Plus Jakarta Sans and Cormorant
    Garamond are the ones used). The brief wants self-hosted fonts; which typeface the new
    site uses is not decided.

## Old URLs (for 301s in step 1)

- `/projekat/cupra`, `/projekat/bash`, `/projekat/mirza`, `/projekat/kodeks`,
  `/projekat/omg`: keep as is.
- `/usluga/foto-video`, `/usluga/integrated`, `/usluga/dizajn`, `/usluga/social`,
  `/usluga/web`: 404 today, redirect to the grid.
- The sitemap lists only the home page and the five case studies.

## Logo

The mark, wordmark and ring SVGs are cut from the vector logo the Webflow site already used
(`old-logo-full.svg`), which is the same artwork as `daliah.pdf` (compared side by side) and
uses the brief's exact hex values. The PDF itself renders with slightly shifted colours
(CMYK conversion), so the hex values from the brief were kept. No PDF tools were installed
to pull paths from the PDF directly.

The mark is drawn as filled outlines, with a few overlapping duplicate shapes (stroked
lines expanded twice). Fine for display; for the step 2 logo morph, sample along the
lines rather than the raw path outlines.

## Not done here (needs you)

- **Webflow export**: Site settings → export code, and CMS collections as CSV. Needs your
  Webflow login.
- Everything in "Open questions and assets needed" in BRIEF.md is still open.
