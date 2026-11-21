#!/usr/bin/env python3
"""Build the prototype case study pages from content/projects/<slug>/index.md.

    python3 scripts/build-projects.py

Writes prototypes/void/projekat/<slug>/index.html. The text comes from the Markdown; how the
page is staged (hero type, where images sit, pull quotes, accent) comes from LAYOUT below.
Images are expected in prototypes/void/media/p/<slug>/ (copied from content/projects/<slug>/media/).

Hero types: video, set, design, site, duo, image, none.
Media blocks: full, inset, offset-l, offset-r, pair, trio, site.
This is the prototype's stand-in for the Astro build; the same config maps to frontmatter later.
"""
import html, json, re, pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent
SRC = ROOT / "content" / "projects"
OUT = ROOT / "prototypes" / "void" / "projekat"
SITE = "https://v2.daliah.ba"

ORDER = ["cupra", "bash", "mirza", "kodeks", "omg"]  # the radovi order; the end link picks another project at random (this order without JS)

# Brand palette (BRIEF.md), lifted where needed so it reads on the dark void.
LAYOUT = {
    "cupra": dict(
        accent="#EBA342",
        hero=dict(type="duo", items=[("cupra2-vrbas.webp", "Banjaluka", "Vrbas"), ("cupra3-neretva.webp", "Mostar", "Neretva")]),
        after={1: [("full", "cupra1-hero.webp")], 3: [("offset-r", "cupra4-grad-pokret.webp")]},
        pulls=["voda nije bila pozadina.", "kad ih gledaš zajedno"],
    ),
    "bash": dict(
        accent="#E0714E",
        hero=dict(type="set", items=["bash-kejs.webp", "bash2.webp", "bash3.webp", "bash1.webp", "bash4.webp"]),
        after={},
        pulls=["bash volim sarajevo ovih dana.", "bash case closed."],
        big_lists=[2],
    ),
    "mirza": dict(
        accent="#DF769C",
        hero=dict(type="video", youtube="MAIhNe21YVg", poster="mriza1.webp", label="frame by frame"),
        after={2: [("trio", "mirza1.webp", "mirza3.webp", "mirza4.webp")]},
        pulls=["Mirza nije samo influenser", "Note i self rimajnder"],
        drop=[r"^\[frame by frame"],
    ),
    "kodeks": dict(
        accent="#8FB3CC",
        hero=dict(type="design", items=["kdk_ig_2.jpg", "kdk_ig_1.jpg", "kdk_ig_3.jpg", "kodeks_brochure.webp"]),
        after={3: [("full", "kodeks1.webp")]},
        pulls=["I da, dizajnirali i isprintali"],
    ),
    "omg": dict(
        accent="#C9B95F",
        hero=dict(type="site", url="https://omg.care/", label="omg.care", desktop="site-desktop.jpg", mobile="site-mobile.jpg"),
        after={1: [("full", "omg1-hero-spray.webp")], 3: [("pair", "omg2-range-three.webp", "omg3-ritual-leg.webp")], 4: [("offset-l", "omg4-koverte.webp")]},
        pulls=["nismo dobili brief.", "kad recenzija ne zvuči"],
    ),
}

TAG_BS = {"integrisane": "integrisane kampanje", "foto-video": "foto i video", "dizajn": "dizajn", "social": "društvene mreže", "web": "web"}


# ---- tiny frontmatter + Markdown reader (only what the case studies use) ----

def frontmatter(text):
    m = re.match(r"^---\n(.*?)\n---\n(.*)$", text, re.S)
    meta, body = {}, m.group(2)
    key = None
    for line in m.group(1).splitlines():
        if re.match(r"^\s+-\s", line) and key:
            meta.setdefault(key, [])
            meta[key].append(unquote(line.strip()[2:]))
            continue
        km = re.match(r"^([a-z_]+):\s*(.*)$", line)
        if not km:
            continue
        key, val = km.group(1), strip_comment(km.group(2))
        if val.startswith("[") and val.endswith("]"):
            meta[key] = [unquote(v.strip()) for v in val[1:-1].split(",") if v.strip()]
        elif val == "":
            meta[key] = []
        else:
            meta[key] = unquote(val)
    return meta, body


def strip_comment(v):
    if v.startswith('"'):
        end = v.find('"', 1)
        return v[: end + 1]
    return v.split(" #")[0].strip()


def unquote(v):
    v = v.strip()
    return v[1:-1] if len(v) >= 2 and v[0] == v[-1] == '"' else v


def inline(t):
    t = html.escape(t, quote=False)
    t = re.sub(r"\[([^\]]+)\]\(([^)]+)\)", lambda m: f'<a href="{m.group(2)}" rel="noopener">{m.group(1)}</a>', t)
    t = re.sub(r"\*\*(.+?)\*\*", r"<strong>\1</strong>", t)
    t = re.sub(r"(?<![\w*])\*(?!\s)(.+?)(?<!\s)\*(?!\w)", r"<em>\1</em>", t)
    return t


def blocks(md):
    """Split a chapter body into ('p', lines) / ('ul', items) / ('img', src) blocks."""
    out, cur = [], None
    for raw in md.splitlines():
        line = raw.rstrip("\n")
        s = line.strip()
        if not s or s.startswith("<!--"):
            cur = None
            continue
        if s.startswith("- "):
            if not cur or cur[0] != "ul":
                cur = ("ul", [])
                out.append(cur)
            cur[1].append(s[2:])
            continue
        im = re.match(r"^!\[[^\]]*\]\(\./media/([^)]+)\)$", s)
        if im:
            out.append(("img", im.group(1)))
            cur = None
            continue
        if not cur or cur[0] != "p":
            cur = ("p", [])
            out.append(cur)
        cur[1].append(line)
    return out


def para_html(lines):
    parts = []
    for i, l in enumerate(lines):
        br = l.endswith("  ") and i < len(lines) - 1
        parts.append(inline(l.strip()) + ("<br>" if br else ""))
    return " ".join(parts).replace("<br> ", "<br>")


STAT_RX = [
    (re.compile(r"^(\d[\d.,]*\+?%?)\s+(.+)$"), lambda m: (m.group(1), m.group(2))),
    (re.compile(r"^(.+?)\s+za\s+(\d[\d.,]*%)$"), lambda m: ("+" + m.group(2), m.group(1))),
    (re.compile(r"^(.+?)\s+(\d[\d.,]*/\d+)$"), lambda m: (m.group(2), m.group(1))),
    (re.compile(r"^(\S+)\s+(\d[\d.,]*\+?)\s+(.+)$"), lambda m: (m.group(2), f"{m.group(1)} {m.group(3)}")),
]


def as_stats(items):
    res = []
    for it in items:
        plain = re.sub(r"\*\*|\*", "", it)
        for rx, f in STAT_RX:
            m = rx.match(plain)
            if m:
                res.append(f(m))
                break
        else:
            return None
    return res


# ---- rendering ----

def img(slug, src, alt="", cls="", eager=False):
    load = 'fetchpriority="high"' if eager else 'loading="lazy"'
    c = f' class="{cls}"' if cls else ""
    return f'<img src="../../media/p/{slug}/{src}" alt="{html.escape(alt)}"{c} {load} decoding="async">'


def figure(slug, kind, srcs, title):
    alt = lambda i: f"{title}: {i + 1}"
    if kind in ("pair", "trio"):
        cells = "".join(f'<div class="m-cell" data-frame data-tilt data-lb><div class="m-img">{img(slug, s, alt(i))}</div></div>' for i, s in enumerate(srcs))
        return f'<figure class="m m--{kind}" data-reveal>{cells}</figure>'
    return (f'<figure class="m m--{kind}" data-reveal><div class="m-cell" data-frame data-tilt data-lb>'
            f'<div class="m-img">{img(slug, srcs[0], alt(0))}</div></div></figure>')


def chapter_html(slug, idx, title, md, cfg, meta):
    pulls = cfg.get("pulls", [])
    drop = [re.compile(d) for d in cfg.get("drop", [])]
    bl = blocks(md)
    out, i = [], 0
    # a big list of variations on one phrase: only the word(s) that change are set in italic,
    # and a pull quote in the same chapter that follows the phrase gets the same treatment
    phrase = None
    if idx in cfg.get("big_lists", []):
        items = next((d for k, d in bl if k == "ul"), None)
        if items and len(items) > 1:
            ws = [it.rstrip(".").split() for it in items]
            pre = 0
            while all(len(w) > pre for w in ws) and len({w[pre] for w in ws}) == 1:
                pre += 1
            suf = 0
            while all(len(w) > pre + suf for w in ws) and len({w[-1 - suf] for w in ws}) == 1:
                suf += 1
            if pre or suf:
                phrase = (pre, suf)
    while i < len(bl):
        kind, data = bl[i]
        if kind == "p":
            text = " ".join(l.strip() for l in data)
            if any(d.search(text) for d in drop):
                i += 1
                continue
            label = re.fullmatch(r"\*\*(.+?):?\*\*:?", text)
            nxt = bl[i + 1] if i + 1 < len(bl) else None
            if label and nxt and nxt[0] == "ul":
                stats = as_stats(nxt[1])
                if stats:
                    out.append(stats_html(label.group(1).rstrip(":"), stats))
                else:
                    out.append(f'<p class="list-label mono">{inline(label.group(1).rstrip(":"))}</p>' + list_html(nxt[1], idx, cfg))
                i += 2
                continue
            if any(text.startswith(p) for p in pulls):
                ph = phrase_html(text, phrase, bl) if phrase else None
                out.append(f'<p class="pull pull--phrase" data-reveal>{ph}</p>' if ph else f'<p class="pull" data-reveal>{para_html(data)}</p>')
            else:
                out.append(f"<p>{para_html(data)}</p>")
        elif kind == "ul":
            stats = as_stats(data)
            out.append(stats_html("", stats) if stats else list_html(data, idx, cfg))
        elif kind == "img":
            out.append(figure(slug, "inset", [data], meta["title"]))
        i += 1
    hid = re.sub(r"[^a-z0-9]+", "-", title.lower().translate(str.maketrans("čćđšž", "ccdsz"))).strip("-") or f"c{idx}"
    return (f'<section class="ch" id="{hid}"><h2 class="ch-title"><span class="ch-n mono">{idx + 1:02d}</span>'
            f'<span>{inline(title.rstrip(":").strip())}</span></h2><div class="ch-body">{"".join(out)}</div></section>')


def split_phrase(text, pre, suf):
    end = "." if text.endswith(".") else ""
    w = text.rstrip(".").split()
    mid = w[pre:len(w) - suf]
    if not mid:
        return None
    head, tail = " ".join(w[:pre]), " ".join(w[len(w) - suf:])
    return (f"{html.escape(head)} " if head else "") + f"<em>{html.escape(' '.join(mid))}</em>" + (f" {html.escape(tail)}" if tail else "") + end


def phrase_html(text, phrase, bl):
    items = next((d for k, d in bl if k == "ul"), [])
    ref = items[0].rstrip(".").split() if items else []
    w = text.rstrip(".").split()
    pre, suf = phrase
    if w[:pre] != ref[:pre] or (suf and w[-suf:] != ref[-suf:]):
        return None
    return split_phrase(text, pre, suf)


def list_html(items, idx, cfg):
    if idx in cfg.get("big_lists", []):
        ws = [it.rstrip(".").split() for it in items]
        pre = 0
        while all(len(w) > pre for w in ws) and len({w[pre] for w in ws}) == 1:
            pre += 1
        suf = 0
        while all(len(w) > pre + suf for w in ws) and len({w[-1 - suf] for w in ws}) == 1:
            suf += 1
        lis = [split_phrase(it, pre, suf) or inline(it) for it in items]
        return '<ul class="list list--big">' + "".join(f"<li>{li}</li>" for li in lis) + "</ul>"
    return '<ul class="list">' + "".join(f"<li>{inline(it)}</li>" for it in items) + "</ul>"


def stats_html(label, stats):
    head = f'<p class="stats-label mono">{inline(label)}</p>' if label else ""
    lis = "".join(f'<li><b class="stat-n" data-count="{html.escape(n)}">{html.escape(n)}</b><span class="stat-l">{inline(l)}</span></li>' for n, l in stats)
    return f'<div class="stats" data-reveal>{head}<ul>{lis}</ul></div>'


def hero_html(slug, h, meta):
    t = h["type"]
    title = meta["title"]
    if t == "video":
        return (f'<section class="hero hero--video" data-reveal><div class="hv" data-frame data-yt="{h["youtube"]}">'
                f'<div class="m-img">{img(slug, h["poster"], title, eager=True)}</div>'
                f'<button type="button" class="hv-play mono" aria-label="play"><span class="hv-dot" aria-hidden="true"></span><span data-t="play">pogledaj film</span></button>'
                f'<span class="hv-label mono" aria-hidden="true">{html.escape(h.get("label", ""))}</span></div></section>')
    if t == "set":
        n = len(h["items"])
        figs = "".join(f'<figure class="hs-item" data-frame data-lb><div class="m-img">{img(slug, s, f"{title}: {i + 1}", eager=i < 2)}</div>'
                       f'<figcaption class="mono">{i + 1:02d}</figcaption></figure>' for i, s in enumerate(h["items"]))
        return (f'<section class="hero hero--set" style="--n:{n}"><div class="hs-pin"><div class="hs-track">{figs}</div>'
                f'<p class="hs-count mono"><span class="hs-i">01</span> / {n:02d}</p><span class="hs-bar"><i></i></span></div></section>')
    if t == "design":
        n = len(h["items"])
        figs = "".join(f'<figure class="hd-piece" style="--i:{i};--k:{i - (n - 1) / 2:.2f}" data-lb><div class="m-img">{img(slug, s, f"{title}: {i + 1}", eager=True)}</div></figure>'
                       for i, s in enumerate(h["items"]))
        return f'<section class="hero hero--design" style="--n:{n}"><div class="hd-pin"><div class="hd-stage" data-tilt-area>{figs}</div></div></section>'
    if t == "site":
        return (f'<section class="hero hero--site"><div class="hsite-pin"><div class="hsite">'
                f'<div class="browser" data-frame><div class="browser-bar"><i></i><i></i><i></i><span class="browser-url mono">{html.escape(h["label"])}</span></div>'
                f'<div class="browser-view">{img(slug, h["desktop"], h["label"] + " (desktop)", "shot", eager=True)}</div></div>'
                f'<div class="phone"><div class="phone-view">{img(slug, h["mobile"], h["label"] + " (mobile)", "shot", eager=True)}</div></div>'
                f'</div><a class="hsite-link mono link" href="{h["url"]}" rel="noopener"><span data-t="visit">posjeti</span> {html.escape(h["label"])} ↗</a></div></section>')
    if t == "duo":
        figs = "".join(f'<figure class="duo-item" data-frame><div class="m-img">{img(slug, s, f"{a}, {b}", eager=True)}</div>'
                       f'<figcaption><span class="duo-a">{html.escape(a)}</span><span class="duo-b mono">{html.escape(b)}</span></figcaption></figure>'
                       for s, a, b in h["items"])
        return f'<section class="hero hero--duo" data-reveal><div class="duo">{figs}</div></section>'
    if t == "image":
        return f'<section class="hero hero--image" data-reveal><div class="m-cell" data-frame data-tilt data-lb><div class="m-img">{img(slug, h["src"], title, eager=True)}</div></div></section>'
    return ""


def page(slug, meta, body, cfg, nxt, others):
    chunks = re.split(r"^## (.+)$", body, flags=re.M)
    chapters = [(chunks[i].strip(), chunks[i + 1]) for i in range(1, len(chunks), 2)]
    parts = []
    for idx, (t, md) in enumerate(chapters):
        parts.append(chapter_html(slug, idx, t, md, cfg, meta))
        for blk in cfg.get("after", {}).get(idx, []):
            parts.append(figure(slug, blk[0], list(blk[1:]), meta["title"]))
    words = len(re.findall(r"\w+", body))
    minutes = max(1, round(words / 200))
    tags = meta.get("tags", [])
    client = meta.get("client", "")
    client = "" if client.startswith("TODO") else client
    brand = meta.get("brand") or ""
    year = meta.get("year", "").replace(" - ", " – ")
    title = meta["title"]
    desc = meta.get("seo_description") or meta.get("tagline", "")
    url = f"{SITE}/projekat/{slug}/"
    hero_src = pathlib.Path(meta.get("hero", "")).name
    ld = {"@context": "https://schema.org", "@type": "CreativeWork", "name": title, "description": desc, "url": url,
          "inLanguage": "bs", "creator": {"@type": "Organization", "name": "daliah", "url": "https://daliah.ba/"},
          "image": f"{SITE}/media/p/{slug}/{hero_src}", "keywords": ", ".join(TAG_BS.get(t, t) for t in tags)}
    if client:
        ld["sourceOrganization"] = {"@type": "Organization", "name": client}
    facts = []
    if client or brand:
        facts.append(f'<div><dt data-t="client">klijent</dt><dd>{html.escape(client or brand)}</dd></div>')
    if year:
        facts.append(f'<div><dt data-t="year">godina</dt><dd>{html.escape(year)}</dd></div>')
    if tags:
        facts.append(f'<div><dt data-t="services">usluge</dt><dd>' + "".join(f'<span data-tag="{t}">{TAG_BS.get(t, t)}</span>' for t in tags) + "</dd></div>")
    facts.append(f'<div><dt data-t="read">čitanje</dt><dd><span data-min="{minutes}">{minutes} min</span></dd></div>')
    nmeta, ncfg = nxt
    nhero = pathlib.Path(nmeta.get("hero", "")).name
    e = html.escape
    return f"""<!doctype html>
<html lang="bs">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{e(meta.get("seo_title") or title)}: daliah</title>
<meta name="description" content="{e(desc)}">
<meta name="robots" content="noindex, nofollow"><!-- prototype on v2: switch to index,follow at launch -->
<meta name="theme-color" content="#150b17">
<meta name="color-scheme" content="dark">
<link rel="icon" href="/media/daliah-logo.svg" type="image/svg+xml">
<link rel="canonical" href="{url}">
<meta property="og:type" content="article">
<meta property="og:site_name" content="daliah">
<meta property="og:locale" content="bs_BA">
<meta property="og:title" content="{e(title)}">
<meta property="og:description" content="{e(desc)}">
<meta property="og:url" content="{url}">
<meta property="og:image" content="{SITE}/media/p/{slug}/{hero_src}">
<meta name="twitter:card" content="summary_large_image">
<link rel="preload" href="/fonts/plus-jakarta-sans-latin.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="../../fonts.css?v=7">
<link rel="stylesheet" href="../projekat.css?v=6">
<script type="application/ld+json">{json.dumps(ld, ensure_ascii=False)}</script>
</head>
<body class="p p--{slug} has-{cfg["hero"]["type"]}" style="--accent:{cfg["accent"]}">
<span class="readbar" aria-hidden="true"><i></i></span>
<header class="bar">
  <a class="brand" href="../../" aria-label="daliah">{WORDMARK}</a>
  <nav class="bar-right mono">
    <a href="../../radovi/" class="link back"><span aria-hidden="true">←</span> <span data-t="all">svi radovi</span></a>
    <button type="button" id="lang" class="lang" aria-label="Language">EN</button>
    <a href="../../#kontakt" class="link" data-t="contact">kontakt</a>
  </nav>
</header>

<main>
  <header class="intro">
    <p class="eyebrow mono">{e(brand or client or "daliah")}<span aria-hidden="true"> · </span>{e(year)}</p>
    <h1 class="p-title" data-split>{e(title)}</h1>
    <p class="p-tagline" data-split>{e(meta.get("tagline", ""))}</p>
    <dl class="facts mono">{"".join(facts)}</dl>
  </header>

  {hero_html(slug, cfg["hero"], meta)}

  <article class="story">
    {"".join(parts)}
  </article>

  <a class="next" href="../{nmeta["slug"]}/" style="--accent:{ncfg["accent"]}" data-others='{e(json.dumps(others, ensure_ascii=False))}'>
    <span class="next-k mono" data-t="next">još jedan projekat</span>
    <span class="next-title">{e(nmeta.get("grid_title") or nmeta["title"])}</span>
    <span class="next-img" aria-hidden="true"><img src="../../media/p/{nmeta["slug"]}/{nhero}" alt="" loading="lazy" decoding="async"></span>
    <span class="next-arrow" aria-hidden="true">→</span>
  </a>
</main>

<footer class="foot">
  <p class="foot-line" data-t-html="foot">imate projekat? <em>pričajmo</em>.</p>
  <div class="foot-links mono">
    <a class="link" href="mailto:hello@daliah.ba">hello@daliah.ba</a>
    <a class="link" href="tel:+38761919909">+387 61 919 909</a>
    <a class="link" href="https://www.instagram.com/daliah.agency/" rel="noopener">instagram ↗</a>
    <a class="link" href="https://www.linkedin.com/company/100072371/" rel="noopener">linkedin ↗</a>
  </div>
</footer>
<script src="../projekat.js?v=4" data-slug="{slug}"></script>
</body>
</html>
"""


WORDMARK = (ROOT / "prototypes" / "void" / "radovi" / "index.html").read_text().split('<a class="brand" href="../" aria-label="daliah">')[1].split("</a>")[0]


def main():
    metas = {}
    for slug in ORDER:
        meta, body = frontmatter((SRC / slug / "index.md").read_text())
        body = re.sub(r"^# .+\n+(.+\n)?", "", body.lstrip(), count=1)  # H1 + tagline repeat the frontmatter
        metas[slug] = (meta, body)
    for i, slug in enumerate(ORDER):
        meta, body = metas[slug]
        nslug = ORDER[(i + 1) % len(ORDER)]
        d = OUT / slug
        d.mkdir(parents=True, exist_ok=True)
        others = [{"slug": o, "title": metas[o][0].get("grid_title") or metas[o][0]["title"], "accent": LAYOUT[o]["accent"],
                   "img": pathlib.Path(metas[o][0].get("hero", "")).name} for o in ORDER if o != slug]
        (d / "index.html").write_text(page(slug, meta, body, LAYOUT[slug], (metas[nslug][0], LAYOUT[nslug]), others))
        print("wrote", d.relative_to(ROOT) / "index.html")


if __name__ == "__main__":
    main()
