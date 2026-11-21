// radovi: all case studies. Positions are computed (masonry), so filtering can animate tiles to their new places.
const I18N = {
  bs: {
    title: "svi <em>radovi</em>", foot: "imate projekat? <em>pričajmo</em>.", contact: "kontakt", other: "EN",
    all: "sve", count: (n) => `${n} ${n === 1 ? "projekat" : "projekata"}`, doc: "radovi: daliah",
    tags: { integrisane: "integrisane", "foto-video": "foto-video", dizajn: "dizajn", social: "social", web: "web" },
  },
  en: {
    title: "all <em>work</em>", foot: "got a project? <em>let's talk</em>.", contact: "contact", other: "BS",
    all: "all", count: (n) => `${n} ${n === 1 ? "project" : "projects"}`, doc: "work: daliah",
    tags: { integrisane: "integrated", "foto-video": "photo-video", dizajn: "design", social: "social", web: "web" },
  },
};
let LANG = "bs";
try { LANG = localStorage.getItem("lang") === "en" ? "en" : "bs"; const q = new URLSearchParams(location.search).get("lang"); if (q === "en" || q === "bs") { LANG = q; localStorage.setItem("lang", q); } } catch {}
const T = I18N[LANG];
document.documentElement.lang = LANG; document.title = T.doc;
const $ = (id) => document.getElementById(id);
$("title").innerHTML = T.title; $("foot-line").innerHTML = T.foot; $("nav-contact").textContent = T.contact; $("lang").textContent = T.other;
$("lang").addEventListener("click", () => { try { localStorage.setItem("lang", LANG === "en" ? "bs" : "en"); sessionStorage.setItem("toTop", "1"); } catch {} const u = new URL(location.href); u.hash = ""; u.searchParams.delete("lang"); location.href = u.toString(); });
try { if (sessionStorage.getItem("toTop")) { sessionStorage.removeItem("toTop"); history.scrollRestoration = "manual"; scrollTo(0, 0); addEventListener("load", () => scrollTo(0, 0)); } } catch {}

// Published case studies (polumaraton is a draft until it has text). `ar` is the tile shape.
const WORK = [
  { slug: "cupra", title: "Cupra", client: "Porsche BH", year: "2025 – 2026", ar: 0.8, img: "../media/cupra1-hero.jpg", tags: ["foto-video"] },
  { slug: "bash", title: "Bash", client: "A.W.G.", year: "08/2025", ar: 0.8, img: "../media/bash-kejs.jpg", tags: ["integrisane", "foto-video", "dizajn", "social"] },
  { slug: "mirza", title: "Mirza Mustafagić", client: "Mirza Mustafagić", year: "2024 – 2026", ar: 0.8, img: "../media/mirza_mustafagic.jpg", tags: ["foto-video"] },
  { slug: "kodeks", title: "Kodeks", client: "", year: "2024 – 2026", ar: 1.5, img: "../media/kodeks-kejs.jpg", tags: ["integrisane", "foto-video", "dizajn", "social"] },
  { slug: "omg", title: "OMG", client: "", year: LANG === "en" ? "2024 – now" : "2024 – danas", ar: 1.5, img: "../media/omg.jpg", tags: ["integrisane", "foto-video", "dizajn", "social", "web"] },
];
const FILTERS = ["all", "integrisane", "foto-video", "dizajn", "social", "web"];
let active = "all";
try { const h = decodeURIComponent(location.hash.slice(1)); if (FILTERS.includes(h)) active = h; } catch {}

const grid = $("grid"), filters = $("filters");
const tiles = WORK.map((w) => {
  const a = document.createElement("a");
  a.className = "tile"; a.href = "#" + w.slug; a.dataset.slug = w.slug;
  a.innerHTML = `<span class="thumb" style="aspect-ratio:${w.ar}"><img src="${w.img}" alt="${w.title}" loading="lazy" decoding="async"></span>` +
    `<span class="meta"><span class="name">${w.title}</span><span class="sub mono">${[w.client, w.year].filter(Boolean).join(" · ")}</span><span class="tags mono">${w.tags.map((t) => T.tags[t]).join(" · ")}</span></span>`;
  grid.appendChild(a);
  return { w, el: a, pos: null };
});

const chips = FILTERS.map((f) => {
  const n = f === "all" ? WORK.length : WORK.filter((w) => w.tags.includes(f)).length;
  const b = document.createElement("button");
  b.type = "button"; b.className = "chip"; b.dataset.f = f;
  b.innerHTML = `${f === "all" ? T.all : T.tags[f]}<sup>${n}</sup>`;
  if (n === 0) b.disabled = true, b.style.opacity = ".35";
  b.addEventListener("click", () => { active = f; history.replaceState(null, "", f === "all" ? location.pathname + location.search : "#" + f); render(); });
  filters.appendChild(b);
  return b;
});

const META = 78;
function layout() {
  const W = grid.clientWidth, cols = W >= 980 ? 3 : W >= 620 ? 2 : 1, gap = W >= 620 ? 26 : 18;
  const cw = (W - (cols - 1) * gap) / cols, y = new Array(cols).fill(0);
  for (const t of tiles) {
    const show = active === "all" || t.w.tags.includes(active);
    t.el.classList.toggle("is-hidden", !show);
    t.el.tabIndex = show ? 0 : -1; t.el.setAttribute("aria-hidden", show ? "false" : "true");
    t.el.style.width = cw + "px";
    if (!show) continue;
    const c = y.indexOf(Math.min(...y)), h = cw / t.w.ar + META;
    t.el.style.height = h + "px";
    t.el.style.transform = `translate(${(c * (cw + gap)).toFixed(1)}px, ${y[c].toFixed(1)}px)`;
    y[c] += h + gap;
  }
  grid.style.height = Math.max(0, Math.max(...y) - gap) + "px";
}
function render() {
  chips.forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.f === active)));
  $("count").textContent = T.count(tiles.filter((t) => active === "all" || t.w.tags.includes(active)).length);
  layout();
}
addEventListener("resize", () => { grid.classList.add("init"); layout(); requestAnimationFrame(() => grid.classList.remove("init")); });
grid.classList.add("init"); // first paint and resizes place tiles without sliding in from the corner
render();
requestAnimationFrame(() => requestAnimationFrame(() => grid.classList.remove("init")));
