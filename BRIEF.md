# daliah.ba redesign brief

## For Claude Code: how to work from this brief

- This file is the source of truth. Read it fully before writing code. When something here conflicts with your defaults, this file wins.
- Logo: `daliah.pdf` in this folder (vector). Extract the mark and the wordmark as SVG.
- Work in the build order at the end of this file, one step per session. Don't start the hook (step 2) until step 1 is live.
- Open questions are listed near the end. Don't invent answers to them: use clearly marked placeholders and list what's still missing when you finish a step.
- Commit to Git as you go, with clear messages.

**Session prompts**

1. Step 0: "Read BRIEF.md. Do step 0: crawl daliah.ba, download all images, videos and case study text into content/, one folder per project, and convert each case study to Markdown with frontmatter (client, title, tags, year, slug). Report anything missing or broken, including the polumaraton link."
2. Step 1: "Read BRIEF.md. Set up the Astro project and build step 1: case study grid with filters, case study overlay pages with their own URLs, team section, contact, privacy page, 404, and everything in Foundations. No hook yet: a simple static intro with the tagline. Prepare it for Cloudflare Pages."
3. Step 2: "Read BRIEF.md. Build the hook as specified in Page flow and Hook technical spec, on top of the existing site, with all fallbacks. Start with a rough prototype so we can judge the feel before polishing."
4. Step 3: "Read BRIEF.md. Go through the Performance budget, Fallbacks and Pre-launch checklist and fix everything that fails."

## Goal and audience

The site is proof, not a sales funnel. Most visitors already talked to us and are checking whether we're the real deal. New leads are a bonus.

What that means for the build:

- Case studies are the point. Everything before them is a hook, everything after them is short.
- No typical agency layout: no services blocks, no long About us, no stock "our process" section.
- The hook doubles as proof of technical skill, because web is one of the services we sell.
- Keep the current voice. Lines like "komunikacija koja ne smrdi na copy-paste" are an asset.
- Language: Bosnian, same as now. English version is an open question (see the end).

## Stack and hosting

Fully static site, no CMS. We add projects rarely, so a new case study is a short Claude Code session, not a monthly bill.

| Part | Choice | Why |
| --- | --- | --- |
| Framework | Astro | Static output, each case study is a Markdown file, ships almost no JS outside the hook |
| 3D / particles | Three.js | Runs on any phone from the last 5–6 years; particles and point-to-shape morphs are its strength |
| Scroll control | GSAP ScrollTrigger + Lenis | Ties every animation step to scroll position, smooth on touch |
| Hosting | Cloudflare Pages | Free tier, domain DNS already on Cloudflare |
| Video | Cloudflare Stream or self-hosted MP4/WebM | Reel and case study clips; decide by total size |
| Repo | GitHub, auto-deploy to Pages on push | Edit, push, live |

Running cost after launch: domain only. Webflow subscription can be cancelled once the new site is live and old URLs redirect (see Case studies).

## Page flow

One page, four parts, top to bottom. The hook is a creative mess that sorts itself out into the work.

1. **Void intro.** Dark, deep-space feel. The current line floats in the middle: "uživamo u strateškom pozicioniranju brenda, kreativnom problem-solvingu, unikatnim objavama, konceptima koji mirišu ekstra i komunikaciji koja ne smrdi na copy-paste." Particles and haze drift slowly around it and react a little to the mouse. Small purple ring or DALIAH wordmark pinned top-left the whole time (the full mark blurs at that size), contact link top-right.
2. **Particles form the work.** On scroll, the text breaks into particles. Particles swarm and resolve into recognisable fragments from case studies: a Cupra frame, a Kodeks screen, a social post, a logo sketch. Short key lines fade in between them, one per discipline (strategija, dizajn, foto-video, social, web).
3. **Fragments become the grid.** The whole particle cloud collapses inward and morphs into the daliah mark in one move, each particle taking the colour of the line it lands on, purple ring last. Hold for a beat, with the particles still shimmering slightly. Then the mark dissolves: particles stream outward, the fragments land in its cells as case study clips, and the cells grow into the full masonry grid. The logo is the frame of the work. Scroll is released and the page behaves normally from here.
4. **Case studies.** Masonry grid, filters, every tile opens a case study.
5. **Team.** Floating portraits in the void, each opens a bio card. Details below.
6. **Contact.** Email, phone, Instagram, one line. Nothing else.

Scroll length for parts 1–3: about 3 to 4 screen heights. Longer and returning visitors get annoyed. Add a small "preskoči na radove" link visible during the hook.

## Brand and colour

The daliah mark is a square split into cells by coloured lines, with a purple ring as the hub. The whole site borrows that geometry. Logo file: daliah.pdf (vector), export the mark and wordmark as SVG.

| Colour | Hex | Use |
| --- | --- | --- |
| Purple | #642969 | Ring, wordmark, text on light sections |
| Pink | #DF769C | One discipline (lines, tags, particle tint) |
| Orange | #EBA342 | One discipline |
| Olive | #A29342 | One discipline |
| Red-orange | #D75E3A | One discipline |
| Slate blue | #5F7E94 | One discipline |

- **One colour per discipline.** The five line colours map to strategija, dizajn, foto-video, social and web. Filter tags, tile borders and particle tints use them, so the colours carry meaning.
- **The ring is the interaction.** The purple ring is the custom cursor and hover lens over tiles and portraits. On touch devices it appears briefly where you tap.
- **Contrast rules.** Purple on the dark void is near-invisible: use it only for the ring and accents there, never text. Orange and olive on the light team section fail as text (about 2:1 on white): lines and shapes only, text in purple or near-black.
- **Corner logo.** The full mark blurs below about 48 px. Pin the ring or the DALIAH wordmark instead.

## Hook technical spec

Hybrid build: pre-rendered atmosphere underneath, real-time particles and fragments on top. Rich look without a 30 MB download.

**Layers, back to front**

- **Atmosphere:** short looping video of clouds, haze, light, made in After Effects or Blender. 8–10 s loop, dark, low contrast so text stays readable. WebM + MP4 fallback.
- **Particles:** Three.js points, around 20–40k on desktop, 8–15k on phones. Each particle has a random start position and a target position. Scroll progress blends between them.
- **Fragments:** 20–30 textured planes using real case study stills. They fade in where particles converge, then fly to their grid tile positions.
- **Text:** HTML on top of the canvas, not inside WebGL, so it stays sharp and searchable.

**How the particle morphs work**

- Text to particles: sample points from the intro text rendered to an offscreen canvas.
- Particles to fragment: sample points from each fragment image's shape or brightness.
- Logo morph: sample target points densely along the mark's vector paths, tagging each with its line's colour. Every particle gets a target, so the cloud condenses into the mark all at once. Thin strokes need density: weight sampling toward the lines and raise particle size during the hold, or the mark looks patchy on phones with fewer particles. Optional: crossfade to the solid SVG at the peak of the hold for a crisp frame. The mark's cell rectangles become the first grid layout, then animate to the full masonry grid.
- All targets are precomputed on load, so scrolling just interpolates.

**Performance budget**

| Item | Desktop | Phone |
| --- | --- | --- |
| Hook total download | ≤ 6 MB | ≤ 3 MB |
| Atmosphere loop | 720p, ≤ 2.5 MB | 540p, ≤ 1.2 MB |
| Fragment images | WebP/AVIF, ≤ 800 px wide | ≤ 500 px wide |
| Frame rate target | 60 fps | 30 fps minimum |

**Fallbacks**

- Weak device (low GPU tier, detected via detect-gpu) or slow connection: skip particles, show the atmosphere loop with the text, then go straight to the grid.
- `prefers-reduced-motion`: no hook animation at all, static intro, then grid.
- Grid and case studies must work with JavaScript off. The hook is decoration on top of normal HTML, never the only way to reach the work.

Test on a real mid-range Android over mobile data before calling it done.

## Case studies

Masonry grid, mixed tile sizes, so no single client dominates. This is the heart of the site and gets the most polish.

**Grid**

- Each tile: looping muted clip or still, client name, one-line result, discipline tags.
- On hover (desktop): clip plays, tile lifts slightly. On phones: clips autoplay when in view, max 2 at once.
- Filters stay: sve, integrisane, foto-video, dizajn, social, web. Filtering animates tiles into new positions.
- Order by strength, not date. Weakest project out. Six great tiles beat twelve average ones.

**Case study pages**

- Open as an overlay on top of the grid with its own URL (/projekat/cupra), so links can be shared and the back button closes it.
- Structure: hero visual, one paragraph on the brief, what we did (tags), the work itself big, result in numbers where we have them, next project link.
- Each case study = one Markdown file plus a media folder. Adding a project = copy a file, swap content.

**Fix from the current site**

- Sarajevski polumaraton tile links to daliah-test.webflow.io and opens the Bash case study. Give it its own page.
- Keep the existing /projekat/ URLs (cupra, bash, mirza, kodeks, omg) so old links still work.
- Meta description currently starts with "marketing agencija sarajevo", which contradicts the tagline. Rewrite it in the site's own voice.

## Team and contact

The team section is the biggest risk of sliding back into a generic agency site. It has to feel like the rest of the page, not a block of headshots and job titles.

**Team**

- The page lightens as you scroll into the team: the void fades from near-black to an off-white, same particles turning dark on light. It marks the switch from the work to the people, and avoids repeating the hook.
- 5–7 people to start. Layout must handle up to about 10 without redesign.
- Portraits are circles and squares in a loose, scattered layout, slowly floating. Order is shuffled on each visit, but positions come from a few hand-tuned layouts, not pure random, so nothing overlaps or clumps.
- All portraits graded the same (e.g. black and white, same crop and lighting) so mixed shapes still read as one set.
- Hover (desktop): portrait scales up about 1.3x, others ease back slightly, name appears under it.
- Click or tap: a card opens with first name, what they actually do in plain words, one human detail, and 2–3 projects they worked on, linking back to those case studies. Escape, a close button and tapping outside all close it.
- One sentence above it, in the current voice, e.g. "kreativci i preduzetnici koji rade zajedno, bježeći od termina marketing agencija".
- No mission statement, no values list, no client logo wall.
- Phones: no hover, so names show under each portrait by default; tap opens the card as a bottom sheet.
- Fallback (reduced motion, JS off): static scattered layout, each portrait still opens the card.

**Contact**

- Full-width, fades back to dark at the very end, so the page closes in the void where it started. One big line, email and phone underneath, Instagram and LinkedIn as small links.
- No contact form. Our visitors already know us, a form is just friction.
- A few particles drift in the background. Open question: end dark (bookends the hook) or stay light (calmer, more readable).

## Foundations

The unglamorous basics. None of this is visible, all of it is expected. Build it in from step 1, not after launch.

**Security and SSL**

- HTTPS only, HSTS on, Cloudflare SSL mode Full (Strict) with a valid origin certificate.
- Security headers via Cloudflare Pages `_headers`: Content-Security-Policy, X-Content-Type-Options, Referrer-Policy, Permissions-Policy.
- No secrets in the repo. Dependencies kept updated (Dependabot or Renovate on GitHub).

**Privacy and GDPR**

- Privacy policy page (Bosnian, and English if the site is bilingual): what is collected, why, who processes it, contact for requests.
- Cookie-free analytics (Cloudflare Web Analytics or Plausible), so no cookie banner is needed.
- No third-party embeds that set cookies: self-host video, or use YouTube privacy-enhanced mode / Vimeo with `dnt=1`.
- Fonts self-hosted, not loaded from Google Fonts (sends visitor IPs to Google).
- Company details in the footer: legal name, registered address, registration/tax number as required locally.

**SEO**

- Unique title and meta description per page, written in the site's voice.
- Open Graph and Twitter card image per case study, so shared links look good in WhatsApp, Viber, LinkedIn.
- `sitemap.xml`, `robots.txt`, canonical URLs.
- 301 redirects from every old Webflow URL to its new one.
- Every case study page has real text (brief, what we did, result) in HTML. Particles and video are invisible to search engines.
- Proper heading structure: one H1 per page.
- `lang` attribute set; if bilingual, `hreflang` tags between language versions.
- Google Business Profile for daliah (Sarajevo), linked to the site.

**LLMO (findability in ChatGPT, Claude, Perplexity)**

- Schema.org structured data: Organization (name, logo, location, services, social links), CreativeWork per case study, Person per team member.
- A plain-text summary on each case study: client, industry, what we did, result. Language models quote clear facts, not taglines.
- `llms.txt` at the root: short description of daliah, services, and links to each case study.
- Don't block AI crawlers in `robots.txt` unless that's a deliberate choice.

**Performance**

- Core Web Vitals targets: LCP under 2.5 s, CLS under 0.1, INP under 200 ms, measured on mobile.
- Lighthouse mobile score 90+ for the grid and case study pages (the hook is measured separately).
- Lazy-load everything below the fold, responsive images (AVIF/WebP), videos with poster frames.

**Accessibility**

- Alt text on every image, captions or a text description for videos with speech.
- Full keyboard navigation: tiles, filters, overlays and bio cards open, close and trap focus correctly.
- Visible focus states, text contrast at least 4.5:1, nothing conveyed by colour alone (discipline tags also have words).
- Target: WCAG 2.2 AA.

**Content and legal**

- Written permission from each client to show their work publicly; check NDAs before publishing.
- Licences for any music in reels and any stock footage or fonts.
- Team members' consent for photos and bios.

**Operations**

- Favicon set and app icons (generated from the purple ring).
- Custom 404 page in the site's style.
- Domain email (e.g. hello@daliah.ba) set up with SPF, DKIM and DMARC so mail doesn't land in spam.
- Uptime monitoring (UptimeRobot or Cloudflare health checks) with alerts.
- Analytics goals: track contact clicks (email, phone, Instagram) and case study opens, so we know what clients actually look at.
- Domain renewal on auto-renew, registrar and Cloudflare logins in a shared password manager.
- Repo on GitHub is the backup; `README.md` explains how to add a case study, for whoever does it next.

**Pre-launch checklist**

- [ ] Tested on iPhone Safari, mid-range Android Chrome, desktop Chrome, Firefox, Safari
- [ ] All old URLs redirect
- [ ] Lighthouse and Core Web Vitals pass on mobile
- [ ] Shared links show the right preview image
- [ ] Privacy policy and company details live
- [ ] Analytics and uptime monitoring running
- [ ] Webflow cancelled only after the new site has been live and stable for a week

## Open questions and assets needed

**Decide before building**

- [ ] Final list of 6–9 case studies, ranked by strength
- [ ] Which fragment represents each case study in the hook (one strong still each)
- [ ] Exact key lines for each discipline in the hook
- [ ] Team: who's on it, and whether everyone is OK with clips/photos
- [ ] Bosnian only, or Bosnian + English
- [ ] Which discipline gets which line colour

**Assets to collect**

- [ ] Atmosphere loop (AE or Blender), dark, 8–10 s, seamless
- [ ] Per case study: hero still, 5–10 s muted loop, 6–15 work images, one-paragraph brief, results if any
- [ ] daliah mask SVG and wordmark (already exist)
- [ ] Team clips or photos
- [ ] Contact details and social links

**Suggested build order**

**Step 0, before building:** export the Webflow site code and CMS collections (CSV) as a backup. Then have Claude Code crawl daliah.ba, download every image, video and case study text into a `content/` folder sorted by project, and convert each case study into the Markdown format the new site uses.

1. Static site with grid, case study pages and contact. Ship this first, cancel Webflow.
2. Add the hook on top.
3. Polish, fallbacks, device testing.

Doing it in this order means the site is live and paid for by step 1, even if the hook takes a few extra weeks.
