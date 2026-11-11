#!/usr/bin/env python3
"""Step 0: copy the old Webflow site (daliah.ba) into content/.

One-off importer, kept for reference. Standard library only.

    python3 -I scripts/import-webflow.py            # writes content/
    python3 -I scripts/import-webflow.py --no-media # text only, no downloads

For each case study it writes content/projects/<slug>/index.md (frontmatter +
Markdown body) and downloads every image into content/projects/<slug>/media/.
Site-wide assets (logo SVGs, intro video) go to content/site/.
"""
from __future__ import annotations

import hashlib
import html
import json
import re
import sys
import urllib.parse
import urllib.request
from html.parser import HTMLParser
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CONTENT = ROOT / "content"
BASE = "https://www.daliah.ba"
UA = "Mozilla/5.0 (daliah.ba content import)"
DOWNLOAD = "--no-media" not in sys.argv

# Webflow grid filter classes and /usluga/ slugs -> the new site's tag names.
TAG_MAP = {
    "fotovideo": "foto-video",
    "foto-video": "foto-video",
    "integrisane": "integrisane",
    "integrated": "integrisane",
    "dizajn": "dizajn",
    "social": "social",
    "web": "web",
}
TAG_ORDER = ["integrisane", "foto-video", "dizajn", "social", "web"]


def fetch(url: str) -> bytes:
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=60) as r:
        return r.read()


def fetch_text(url: str) -> str:
    return fetch(url).decode("utf-8")


def clean_name(url: str) -> str:
    """Webflow asset URL -> readable file name (drops the hash prefixes)."""
    name = urllib.parse.unquote(urllib.parse.urlparse(url).path.split("/")[-1])
    name = name.split("/")[-1]
    # Strip one or more leading 24-hex Webflow ids: "6a85..._6a85..._cupra1-hero.webp"
    name = re.sub(r"^(?:[0-9a-f]{24}_)+", "", name)
    name = name.replace(" ", "-").lower()
    return name


def download(url: str, dest_dir: Path, used: dict[str, str]) -> str:
    """Download url into dest_dir, return the file name.

    The same file is often uploaded twice under different Webflow ids (grid tile
    and gallery), so identical bytes are stored once.
    """
    if url in used:
        return used[url]
    if DOWNLOAD:
        data = fetch(url)
        digest = hashlib.sha256(data).hexdigest()
        for prev_url, prev_name in used.items():
            if _hashes.get((dest_dir, prev_name)) == digest:
                used[url] = prev_name
                return prev_name
    name = clean_name(url)
    stem, dot, ext = name.rpartition(".")
    n = 2
    while name in used.values():
        name = f"{stem}-{n}.{ext}"
        n += 1
    used[url] = name
    if DOWNLOAD:
        dest_dir.mkdir(parents=True, exist_ok=True)
        _hashes[(dest_dir, name)] = digest
        (dest_dir / name).write_bytes(data)
    return name


_hashes: dict[tuple[Path, str], str] = {}


# --------------------------------------------------------------------------
# Rich text (Webflow w-richtext) -> Markdown


class RichTextToMarkdown(HTMLParser):
    def __init__(self, on_image, on_embed):
        super().__init__(convert_charrefs=True)
        self.out: list[str] = []
        self.buf: list[str] = []
        self.list_stack: list[str] = []
        self.link: str | None = None
        self.link_text: list[str] = []
        self.on_image = on_image
        self.on_embed = on_embed
        self.block: str | None = None

    # helpers
    def emit(self, text: str):
        if self.link is not None:
            self.link_text.append(text)
        else:
            self.buf.append(text)

    def flush(self, prefix: str = ""):
        text = "".join(self.buf)
        text = text.replace("‍", "").replace("\xa0", " ")
        text = re.sub(r"[ \t]+", " ", text)
        # Emphasis markers are placeholders until here (\x01/\x02 bold, \x03/\x04
        # italic) so spaces and line breaks Webflow put inside <strong> can be moved
        # outside it: "Da<strong> zvuči</strong>" -> "Da **zvuči**".
        for _ in range(2):
            text = re.sub(r"([\x01\x03])([ \n]+)", r"\2\1", text)
            text = re.sub(r"([ \n]+)([\x02\x04])", r"\2\1", text)
        text = re.sub(r"\x01\x02|\x03\x04", "", text)
        if prefix.startswith("#"):
            text = re.sub(r"[\x01-\x04]", "", text)
        text = text.replace("\x01", "**").replace("\x02", "**")
        text = text.replace("\x03", "*").replace("\x04", "*")
        text = re.sub(r" *\n *", "\n", text).strip()
        self.buf = []
        if text:
            lines = text.split("\n")
            if prefix.startswith("#"):
                text = prefix + " ".join(lines)
            else:
                text = prefix + ("  \n" + " " * len(prefix)).join(lines)
            self.out.append(text)

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if tag in ("p", "h1", "h2", "h3", "h4", "h5", "h6", "blockquote", "li"):
            self.flush()
            self.block = tag
        elif tag in ("strong", "b"):
            self.emit("\x01")
        elif tag in ("em", "i"):
            self.emit("\x03")
        elif tag == "br":
            self.emit("\n")
        elif tag == "a":
            self.link = a.get("href", "")
            self.link_text = []
        elif tag in ("ul", "ol"):
            self.flush()
            self.list_stack.append(tag)
        elif tag == "img":
            self.flush()
            md = self.on_image(a.get("src", ""), a.get("alt", ""))
            if md:
                self.out.append(md)
        elif tag == "iframe":
            self.flush()
            self.out.append(self.on_embed(a.get("src", ""), a.get("title", "")))

    def handle_endtag(self, tag):
        if tag in ("strong", "b"):
            self.emit("\x02")
        elif tag in ("em", "i"):
            self.emit("\x04")
        elif tag == "a":
            text = "".join(self.link_text).strip()
            href = self.link or ""
            self.link = None
            # A stray link around one letter (mirza page links "đ" to an encyclopedia)
            if len(text) <= 1:
                self.emit(text)
            else:
                self.emit(f"[{text}]({href})")
        elif tag == "h2":
            # Inside sections Webflow uses h2 as a big pull line, not a heading.
            text = "".join(self.buf).strip()
            self.buf = [f"\x01{text}\x02"] if text else []
            self.flush()
        elif tag in ("h1", "h3", "h4", "h5", "h6"):
            # h3 is the section heading on the old site -> ## in the new one.
            level = {"h1": 2, "h3": 2, "h4": 3, "h5": 4, "h6": 4}[tag]
            self.flush("#" * level + " ")
        elif tag in ("p", "blockquote"):
            self.flush("> " if tag == "blockquote" else "")
        elif tag == "li":
            marker = "1. " if self.list_stack and self.list_stack[-1] == "ol" else "- "
            self.flush(marker)
        elif tag in ("ul", "ol"):
            self.flush()
            if self.list_stack:
                self.list_stack.pop()

    def handle_data(self, data):
        if data.strip() or data == " ":
            self.emit(data.replace("\n", " "))
        elif data and self.buf and not self.buf[-1].endswith((" ", "\n")):
            self.emit(" ")

    def markdown(self) -> str:
        self.flush()
        md = "\n\n".join(self.out)
        # Bullets typed as "• " inside a paragraph -> list items on their own line
        md = re.sub(r"  \n• ", "\n- ", md)
        md = re.sub(r"(^|\n)• ", r"\1- ", md)
        md = re.sub(r"  \n— ", "\n- ", md)
        md = re.sub(r"(^|\n)— ", r"\1- ", md)
        # <li><p>..</p></li> leaves blank lines between items: make it one tight list
        while True:
            tight = re.sub(r"(^- [^\n]*)\n\n(?=- )", r"\1\n", md, flags=re.M)
            if tight == md:
                break
            md = tight
        return md.strip()


def richtext_blocks(page: str) -> list[tuple[int, str]]:
    """Return (offset, inner html) of each top-level w-richtext div."""
    blocks = []
    for m in re.finditer(r'<div [^>]*class="[^"]*\bw-richtext\b[^"]*"[^>]*>', page):
        start = m.end()
        depth, i = 1, start
        while depth:
            o = page.find("<div", i)
            c = page.find("</div>", i)
            if o != -1 and o < c:
                depth += 1
                i = o + 4
            else:
                depth -= 1
                i = c + 6
        blocks.append((m.start(), page[start : i - 6]))
    return blocks


def meta(page: str, key: str) -> str:
    m = re.search(rf'<meta content="([^"]*)" (?:name|property)="{re.escape(key)}"', page)
    return html.unescape(m.group(1)) if m else ""


def text_of(fragment: str) -> str:
    return html.unescape(re.sub(r"<[^>]+>", "", fragment)).strip()


def yaml_str(s: str) -> str:
    return json.dumps(s, ensure_ascii=False)


# --------------------------------------------------------------------------


def parse_home():
    page = fetch_text(BASE)
    tiles = []
    for m in re.finditer(
        r'<div class="item([^"]*)"><a [^>]*href="([^"]+)"[^>]*><img src="([^"]+)"[^>]*/>.*?'
        r'<h2 class="image-overlay-heading">(.*?)</h2>',
        page,
        flags=re.S,
    ):
        classes, href, img, title = m.groups()
        tags = [TAG_MAP[c] for c in classes.split() if c in TAG_MAP]
        tiles.append({"href": href, "img": img, "title": text_of(title), "tags": tags})
    video = re.search(r'data-video-urls="([^"]+)"', page).group(1).split(",")
    poster = re.search(r'data-poster-url="([^"]+)"', page).group(1)
    logo_mask = re.search(r'<img[^>]+src="([^"]+daliah%20mask1\.svg)"', page).group(1)
    icons = sorted(set(re.findall(r'href="([^"]+daliah_icon\.png)"', page)))
    intro = text_of(re.search(r'<p class="opis">(.*?)</p>', page, flags=re.S).group(1))
    return {
        "page": page,
        "tiles": tiles,
        "video": video,
        "poster": poster,
        "logo_mask": logo_mask,
        "icons": icons,
        "intro": intro,
        "title": re.search(r"<title>(.*?)</title>", page).group(1),
        "description": meta(page, "description"),
    }


def parse_case(slug: str, tile: dict, order: int) -> dict:
    url = f"{BASE}/projekat/{slug}"
    page = fetch_text(url)
    body = page[page.find("<body") :]
    body = re.sub(r"<script.*?</script>", "", body, flags=re.S)
    cut = body.find("A možda vas zanima")
    main = body[:cut] if cut != -1 else body
    dest = CONTENT / "projects" / slug
    media_dir = dest / "media"
    used: dict[str, str] = {}

    def on_image(src, alt):
        if not src:
            return ""
        name = download(src, media_dir, used)
        return f"![{alt}](./media/{name})"

    embeds = []

    def on_embed(src, title):
        embeds.append(src)
        m = re.search(r"youtube\.com/embed/([\w-]+)", src)
        if m:
            return f"<!-- video: youtube {m.group(1)} -->\n[{title or 'video'}](https://www.youtube.com/watch?v={m.group(1)})"
        return f"<!-- embed: {src} -->"

    # Project facts (klijent / BREND / datum / usluge)
    facts = {}
    for m in re.finditer(
        r'<p class="subhead-main for-footer-title">([^<]+)</p><div>(.*?)</div></div>',
        main,
        flags=re.S,
    ):
        facts[m.group(1).strip().lower()] = m.group(2)
    services = [TAG_MAP.get(s, s) for s in re.findall(r'href="/usluga/([^"]+)"', main)]

    title = text_of(re.search(r'<h1[^>]*class="display-1 second"[^>]*>(.*?)</h1>', main, flags=re.S).group(1))
    tagline_m = re.search(r'<h2[^>]*class="display-1 tagline"[^>]*>(.*?)</h2>', main, flags=re.S)
    tagline = text_of(tagline_m.group(1)) if tagline_m else ""

    gallery_srcs = re.findall(r'<img loading="eager" src="([^"]+)"[^>]*class="project-photo"', main)
    hero_name = download(tile["img"], media_dir, used)
    gallery = [download(s, media_dir, used) for s in gallery_srcs]

    sections = []
    blocks = richtext_blocks(main)
    brief_at = main.find('for-footer-title">Brief</p>')
    photos_at = main.find('class="project-photos"')
    for offset, inner in blocks:
        conv = RichTextToMarkdown(on_image, on_embed)
        conv.feed(inner)
        md = conv.markdown()
        if brief_at != -1 and brief_at < offset < photos_at:
            md = "## Brief\n\n" + md
        sections.append(md)

    instagram = sorted(set(re.findall(r'href="(https://www\.instagram\.com/[^"]+)"', main)))
    year_raw = text_of(facts.get("datum", ""))

    tags = [t for t in TAG_ORDER if t in set(tile["tags"]) | set(services)]

    fm = [
        "---",
        f"slug: {slug}",
        f"title: {yaml_str(title)}",
        f"grid_title: {yaml_str(tile['title'])}",
        f"client: {yaml_str(text_of(facts.get('klijent', '')) or 'TODO: not on the old page')}",
    ]
    if facts.get("brend"):
        fm.append(f"brand: {yaml_str(text_of(facts['brend']))}")
    fm += [
        f"year: {yaml_str(year_raw)}  # as written on the old page",
        f"tags: [{', '.join(tags)}]",
        f"services_on_old_site: [{', '.join(services)}]",
        f"grid_tags_on_old_site: [{', '.join(tile['tags'])}]",
        f"order: {order}  # old grid position; final order by strength is an open question",
        f"tagline: {yaml_str(tagline)}",
        "result_line: \"TODO: one-line result for the grid tile\"",
        f"hero: ./media/{hero_name}",
        "gallery:",
        *[f"  - ./media/{g}" for g in gallery],
        "loop: null  # TODO: 5-10 s muted clip for the grid tile",
        f"seo_title: {yaml_str(text_of(re.search(r'<title>(.*?)</title>', page).group(1)))}",
        f"seo_description: {yaml_str(meta(page, 'description'))}",
        f"legacy_url: /projekat/{slug}",
    ]
    if instagram or embeds:
        fm.append("links:")
        fm += [f"  - {u}" for u in instagram + embeds]
    fm.append("---")

    md = "\n".join(fm) + "\n\n" + f"# {title}\n\n" + (f"{tagline}\n\n" if tagline else "") + "\n\n".join(sections) + "\n"
    dest.mkdir(parents=True, exist_ok=True)
    (dest / "index.md").write_text(md)
    (dest / "source.html").write_text(page)
    return {"slug": slug, "title": title, "images": len(used), "embeds": embeds}


def stub_case(slug: str, tile: dict, order: int) -> dict:
    dest = CONTENT / "projects" / slug
    used: dict[str, str] = {}
    hero = download(tile["img"], dest / "media", used)
    md = f"""---
slug: {slug}
draft: true  # no case study text exists yet; hidden until written
title: {yaml_str(tile['title'])}
grid_title: {yaml_str(tile['title'])}
client: "TODO"
year: "TODO"
tags: []  # TODO: the old tile had no filter tags
order: {order}  # old grid position; final order by strength is an open question
tagline: "TODO"
result_line: "TODO: one-line result for the grid tile"
hero: ./media/{hero}
gallery: []  # TODO: 6-15 work images
loop: null  # TODO: 5-10 s muted clip for the grid tile
seo_title: "TODO"
seo_description: "TODO"
legacy_url: null  # the old tile linked to {tile['href']} (404)
---

# {tile['title']}

## Brief

TODO: one paragraph on the brief.

## Šta smo radili

TODO

## Rezultat

TODO
"""
    dest.mkdir(parents=True, exist_ok=True)
    (dest / "index.md").write_text(md)
    return {"slug": slug, "title": tile["title"], "images": len(used), "stub": True}


def main():
    home = parse_home()
    site = CONTENT / "site"
    site.mkdir(parents=True, exist_ok=True)
    (site / "home.source.html").write_text(home["page"])
    used: dict[str, str] = {}
    brand = site / "brand"
    for u in [home["logo_mask"]] + home["icons"]:
        download(u, brand, used)
    # Wordmark on the case study pages
    download(
        "https://cdn.prod.website-files.com/6984cf14048719c612fe7dc1/6985a5b463f0f2154bf31044_daliah.svg",
        brand,
        used,
    )
    vused: dict[str, str] = {}
    for u in home["video"] + [home["poster"]]:
        download(u.replace("%2F", "/"), site / "intro-video", vused)

    report = {"tiles": [], "cases": []}
    order = 0
    for tile in home["tiles"]:
        order += 1
        m = re.match(r"https://www\.daliah\.ba/projekat/([\w-]+)$", tile["href"])
        report["tiles"].append(tile)
        if not m:
            # The "sarajevski polumaraton" tile links to the Webflow staging URL of
            # the Bash case (404 there). It has no page of its own: write a stub.
            report["cases"].append(stub_case("polumaraton", tile, order))
            continue
        report["cases"].append(parse_case(m.group(1), tile, order))

    (site / "home.md").write_text(
        "---\n"
        f"seo_title: {yaml_str(home['title'])}\n"
        f"seo_description_old: {yaml_str(home['description'])}  # contradicts the tagline, rewrite (brief)\n"
        "filters: [sve, integrisane, foto-video, dizajn, social, web]\n"
        "---\n\n"
        f"{home['intro']}\n"
    )
    print(json.dumps(report, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
