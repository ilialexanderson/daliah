// projekat: behaviour for one case study page. No dependencies.
// The case study text is Bosnian only; the interface around it follows the EN/BS switch.
(() => {
  const I18N = {
    bs: { all: "svi radovi", contact: "kontakt", client: "klijent", year: "godina", services: "usluge", read: "čitanje", next: "još jedan projekat",
      play: "pogledaj film", visit: "posjeti", foot: "imate projekat? <em>pričajmo</em>.", other: "EN", close: "zatvori",
      tags: { integrisane: "integrisane kampanje", "foto-video": "foto i video", dizajn: "dizajn", social: "društvene mreže", web: "web" } },
    en: { all: "all work", contact: "contact", client: "client", year: "year", services: "services", read: "read", next: "another project",
      play: "watch the film", visit: "visit", foot: "got a project? <em>let's talk</em>.", other: "BS", close: "close",
      tags: { integrisane: "integrated campaigns", "foto-video": "photo and video", dizajn: "design", social: "social media", web: "web" } },
  };
  let LANG = "bs";
  try {
    const q = new URLSearchParams(location.search).get("lang");
    if (q === "en" || q === "bs") localStorage.setItem("lang", q);
    LANG = localStorage.getItem("lang") === "en" ? "en" : "bs";
  } catch {}
  const T = I18N[LANG];
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  $$("[data-t]").forEach((el) => { if (T[el.dataset.t]) el.textContent = T[el.dataset.t]; });
  $$("[data-t-html]").forEach((el) => { if (T[el.dataset.tHtml]) el.innerHTML = T[el.dataset.tHtml]; });
  $$("[data-tag]").forEach((el) => { el.textContent = T.tags[el.dataset.tag] || el.textContent; });
  const lang = document.getElementById("lang");
  lang.textContent = T.other;
  lang.addEventListener("click", () => {
    try { localStorage.setItem("lang", LANG === "en" ? "bs" : "en"); sessionStorage.setItem("toTop", "1"); } catch {}
    const u = new URL(location.href); u.hash = ""; u.searchParams.delete("lang"); location.href = u.toString();
  });
  try { if (sessionStorage.getItem("toTop")) { sessionStorage.removeItem("toTop"); history.scrollRestoration = "manual"; scrollTo(0, 0); } } catch {}

  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const fine = matchMedia("(pointer: fine)").matches && !reduce;
  const wide = () => innerWidth > 860;
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, t) => a + (b - a) * t;

  // ---- split headings into words ----
  $$("[data-split]").forEach((el, k) => {
    const words = el.textContent.trim().split(/\s+/);
    el.innerHTML = words.map((w, i) => `<span class="w" style="--d:${k * 260 + i * 55}">${w.replace(/&/g, "&amp;").replace(/</g, "&lt;")}</span>`).join(" ");
    requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add("in")));
  });

  // ---- ghost frames: a faint outline per image, each side randomly inside or outside ----
  let seed = [...(document.currentScript?.dataset.slug || "x")].reduce((a, c) => a * 31 + c.charCodeAt(0), 7) >>> 0;
  const rnd = () => { seed = (seed + 0x6d2b79f5) >>> 0; let t = seed; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const frames = $$("[data-frame]").map((el) => {
    const fr = document.createElement("span"); fr.className = "fr"; fr.setAttribute("aria-hidden", "true"); el.appendChild(fr);
    const sides = [0, 1, 2, 3].map(() => (rnd() < 0.5 ? -1 : 1) * (0.25 + rnd() * 0.75));
    return { el, fr, sides };
  });
  function sizeFrames() {
    for (const f of frames) {
      const r = f.el.getBoundingClientRect(), m = clamp(Math.min(r.width, r.height) * 0.05, 8, 40);
      const [l, rr, t, b] = f.sides.map((s) => (s * m).toFixed(1) + "px");
      f.fr.style.cssText = `--fl:${l};--fr:${rr};--ft:${t};--fb:${b}`;
    }
  }
  sizeFrames();

  // ---- design hero: equal visual weight per piece (width ∝ √aspect), laid out as one row when fanned ----
  const pieces = $$(".hd-piece");
  function layoutPieces() {
    if (!pieces.length) return;
    const ars = pieces.map((p) => { const im = p.querySelector("img"); return im.naturalWidth ? im.naturalWidth / im.naturalHeight : 1; });
    const gap = innerWidth * 0.025, roots = ars.map(Math.sqrt), sum = roots.reduce((a, b) => a + b, 0);
    const base = Math.min((innerWidth * 0.88 - gap * (pieces.length - 1)) / sum, innerHeight * 0.42);
    const ws = roots.map((r) => r * base), total = ws.reduce((a, b) => a + b, 0) + gap * (pieces.length - 1);
    let x = -total / 2;
    pieces.forEach((p, i) => { p.style.setProperty("--w", ws[i].toFixed(1) + "px"); p.style.setProperty("--x", (x + ws[i] / 2).toFixed(1) + "px"); x += ws[i] + gap; });
  }
  pieces.forEach((p) => p.querySelector("img").addEventListener("load", layoutPieces));
  layoutPieces();
  addEventListener("resize", layoutPieces);

  $$(".ch-title, .ch-body > *").forEach((el) => el.setAttribute("data-reveal", ""));

  // ---- reveal, lit (grade lifts when an image is well in view), count-up ----
  const io = new IntersectionObserver((es) => es.forEach((e) => {
    if (!e.isIntersecting) return;
    e.target.classList.add("in");
    $$(".fr", e.target).forEach((f) => f.classList.add("in"));
    $$(".m-img", e.target).forEach((m) => m.classList.add("in"));
    $$("[data-count]", e.target).forEach(countUp);
    io.unobserve(e.target);
  }), { rootMargin: "0px 0px -12% 0px" });
  $$("[data-reveal], .hero, .hs-item, .hd-piece").forEach((el) => io.observe(el));
  const lit = new IntersectionObserver((es) => es.forEach((e) => e.target.classList.toggle("is-lit", e.intersectionRatio > 0.55)), { threshold: [0, 0.55, 1] });
  $$(".m-cell, .hv, .hs-item, .duo-item, .hd-piece, .browser").forEach((el) => lit.observe(el));
  setTimeout(() => $$(".hero .fr").forEach((f) => f.classList.add("in")), 500);

  function countUp(el) {
    const raw = el.dataset.count;
    const m = raw.match(/^([+]?)([\d.,]+)(.*)$/);
    if (!m || raw.includes("/") || reduce) return;
    const target = parseInt(m[2].replace(/[.,]/g, ""), 10), dots = m[2].includes(".");
    const fmt = (n) => (dots ? n.toLocaleString("de-DE") : String(n));
    const t0 = performance.now(), dur = 1600;
    const step = (t) => {
      const k = clamp((t - t0) / dur, 0, 1), e = 1 - Math.pow(1 - k, 4);
      el.textContent = m[1] + fmt(Math.round(target * e)) + m[3];
      if (k < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  // ---- cursor: tilt for media, follow for the play pill, the duo split, the next-project image ----
  const tilts = fine ? $$("[data-tilt]").map((el) => ({ el, fr: el.querySelector(".fr"), x: 0, y: 0, tx: 0, ty: 0 })) : [];
  tilts.forEach((t) => {
    t.el.addEventListener("pointermove", (e) => {
      const r = t.el.getBoundingClientRect();
      t.tx = ((e.clientX - r.left) / r.width - 0.5) * 2; t.ty = ((e.clientY - r.top) / r.height - 0.5) * 2;
    });
    t.el.addEventListener("pointerleave", () => { t.tx = 0; t.ty = 0; });
  });

  const stage = document.querySelector("[data-tilt-area]");
  const stageT = { x: 0, y: 0, tx: 0, ty: 0 };
  if (stage && fine) {
    addEventListener("pointermove", (e) => { stageT.tx = (e.clientX / innerWidth - 0.5) * 2; stageT.ty = (e.clientY / innerHeight - 0.5) * 2; });
  }

  const hv = document.querySelector(".hv");
  if (hv) {
    const pill = hv.querySelector(".hv-play");
    const pos = { x: 0, y: 0, tx: 0, ty: 0, on: false };
    const center = () => { const r = hv.getBoundingClientRect(); pos.tx = r.width / 2; pos.ty = r.height / 2; };
    center(); pos.x = pos.tx; pos.y = pos.ty;
    if (fine) {
      hv.addEventListener("pointermove", (e) => { const r = hv.getBoundingClientRect(); pos.tx = e.clientX - r.left; pos.ty = e.clientY - r.top; });
      hv.addEventListener("pointerleave", center);
      const tick = () => {
        if (!hv.classList.contains("is-playing")) {
          pos.x = lerp(pos.x, pos.tx, 0.16); pos.y = lerp(pos.y, pos.ty, 0.16);
          pill.style.setProperty("--px", pos.x.toFixed(1) + "px"); pill.style.setProperty("--py", pos.y.toFixed(1) + "px");
          requestAnimationFrame(tick);
        }
      };
      requestAnimationFrame(tick);
    }
    const play = () => {
      if (hv.classList.contains("is-playing")) return;
      hv.classList.add("is-playing");
      const f = document.createElement("iframe");
      f.src = `https://www.youtube-nocookie.com/embed/${hv.dataset.yt}?autoplay=1&rel=0&modestbranding=1&playsinline=1`;
      f.allow = "autoplay; encrypted-media; picture-in-picture; fullscreen"; f.allowFullscreen = true; f.title = document.title;
      hv.appendChild(f);
    };
    hv.addEventListener("click", play);
  }

  const duo = $$(".duo-item");
  duo.forEach((d) => d.addEventListener("click", () => { if (!fine) { duo.forEach((o) => o.style.setProperty("--g", o === d ? 1.6 : 1)); } }));

  const next = document.querySelector(".next");
  // the end link: another project, picked at random (not the one you just came from)
  if (next?.dataset.others) {
    try {
      const all = JSON.parse(next.dataset.others), here = document.currentScript?.dataset.slug;
      let prev = ""; try { prev = sessionStorage.getItem("lastProject") || ""; sessionStorage.setItem("lastProject", here || ""); } catch {}
      const pool = all.filter((o) => o.slug !== prev).length ? all.filter((o) => o.slug !== prev) : all;
      const o = pool[Math.floor(Math.random() * pool.length)];
      next.href = `../${o.slug}/`; next.style.setProperty("--accent", o.accent);
      next.querySelector(".next-title").textContent = o.title;
      next.querySelector(".next-img img").src = `../../media/p/${o.slug}/${o.img}`;
    } catch {}
  }
  const nimg = next?.querySelector(".next-img");
  const np = { x: 0, y: 0, tx: 0, ty: 0, r: 0 };
  if (next && fine) {
    next.addEventListener("pointermove", (e) => { const r = next.getBoundingClientRect(); np.tx = e.clientX - r.left; np.ty = e.clientY - r.top; });
    next.addEventListener("pointerenter", (e) => { const r = next.getBoundingClientRect(); np.x = np.tx = e.clientX - r.left; np.y = np.ty = e.clientY - r.top; });
  }

  // ---- pinned heroes: progress through their tall section drives the motion ----
  const set = document.querySelector(".hero--set"), track = set?.querySelector(".hs-track"), setI = set?.querySelector(".hs-i");
  const design = document.querySelector(".hero--design");
  const site = document.querySelector(".hero--site");
  const progress = (el) => { const r = el.getBoundingClientRect(); return clamp(-r.top / Math.max(1, r.height - innerHeight), 0, 1); };
  let lastY = scrollY;

  function frame() {
    // read bar + hide the bar while reading down
    const doc = document.documentElement;
    doc.style.setProperty("--read", (scrollY / Math.max(1, doc.scrollHeight - innerHeight)).toFixed(4));
    if (Math.abs(scrollY - lastY) > 6) { document.body.classList.toggle("bar-hidden", scrollY > lastY && scrollY > 300); lastY = scrollY; }

    if (set && wide() && !reduce) {
      const p = progress(set), max = track.scrollWidth - innerWidth;
      track.style.setProperty("--tx", (-p * max).toFixed(1) + "px");
      set.style.setProperty("--p", p.toFixed(4));
      const n = track.children.length;
      setI.textContent = String(Math.min(n, 1 + Math.floor(p * n * 0.999))).padStart(2, "0");
    }
    if (design && wide() && !reduce) design.style.setProperty("--p", progress(design).toFixed(4));
    if (site && !reduce && wide()) {
      const p = progress(site);
      site.style.setProperty("--p", p.toFixed(4));
      site.querySelectorAll(".shot").forEach((img) => {
        const view = img.parentElement, max = img.offsetHeight - view.clientHeight;
        img.style.setProperty("--sy", (-Math.max(0, max) * p).toFixed(1) + "px");
      });
    }
    for (const t of tilts) {
      t.x = lerp(t.x, t.tx, 0.09); t.y = lerp(t.y, t.ty, 0.09);
      if (Math.abs(t.x) + Math.abs(t.y) < 0.0005 && !t.tx && !t.ty) { t.el.style.transform = ""; continue; }
      t.el.style.transform = `perspective(1400px) rotateY(${(t.x * 3).toFixed(3)}deg) rotateX(${(-t.y * 3).toFixed(3)}deg)`;
      if (t.fr) { t.fr.style.setProperty("--fx", (-t.x * 10).toFixed(2) + "px"); t.fr.style.setProperty("--fy", (-t.y * 10).toFixed(2) + "px"); }
    }
    if (stage) {
      stageT.x = lerp(stageT.x, stageT.tx, 0.06); stageT.y = lerp(stageT.y, stageT.ty, 0.06);
      stage.style.setProperty("--mx", stageT.x.toFixed(4)); stage.style.setProperty("--my", stageT.y.toFixed(4));
    }
    if (nimg && fine) {
      const vx = np.tx - np.x;
      np.x = lerp(np.x, np.tx, 0.12); np.y = lerp(np.y, np.ty, 0.12); np.r = lerp(np.r, clamp(vx * 0.08, -12, 12), 0.1);
      nimg.style.setProperty("--nx", np.x.toFixed(1) + "px"); nimg.style.setProperty("--ny", np.y.toFixed(1) + "px"); nimg.style.setProperty("--nr", np.r.toFixed(2) + "deg");
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
  addEventListener("resize", sizeFrames);

  // ---- lightbox for every image marked data-lb ----
  const lbItems = $$("[data-lb]");
  if (lbItems.length) {
    const lb = document.createElement("div");
    lb.className = "lb"; lb.setAttribute("role", "dialog"); lb.setAttribute("aria-modal", "true");
    lb.innerHTML = `<img alt=""><button class="lb-x mono" type="button">${T.close} ✕</button><button class="lb-p" type="button" aria-label="previous">←</button><button class="lb-n" type="button" aria-label="next">→</button><span class="lb-c mono"></span>`;
    document.body.appendChild(lb);
    const im = lb.querySelector("img"), cnt = lb.querySelector(".lb-c");
    let cur = 0, opener = null;
    const show = (i) => {
      cur = (i + lbItems.length) % lbItems.length;
      const src = lbItems[cur].querySelector("img");
      im.src = src.currentSrc || src.src; im.alt = src.alt;
      cnt.textContent = `${String(cur + 1).padStart(2, "0")} / ${String(lbItems.length).padStart(2, "0")}`;
    };
    const open = (i, el) => { opener = el; show(i); lb.classList.add("open"); lb.querySelector(".lb-x").focus(); document.documentElement.style.overflow = "hidden"; };
    const close = () => { lb.classList.remove("open"); document.documentElement.style.overflow = ""; opener?.focus?.(); };
    lbItems.forEach((el, i) => {
      el.tabIndex = 0; el.setAttribute("role", "button");
      el.addEventListener("click", (e) => { e.preventDefault(); open(i, el); });
      el.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(i, el); } });
    });
    lb.querySelector(".lb-x").onclick = close;
    lb.querySelector(".lb-p").onclick = () => show(cur - 1);
    lb.querySelector(".lb-n").onclick = () => show(cur + 1);
    lb.addEventListener("click", (e) => { if (e.target === lb) close(); });
    addEventListener("keydown", (e) => {
      if (!lb.classList.contains("open")) return;
      if (e.key === "Escape") close(); else if (e.key === "ArrowLeft") show(cur - 1); else if (e.key === "ArrowRight") show(cur + 1);
    });
    let sx = null;
    lb.addEventListener("touchstart", (e) => { sx = e.touches[0].clientX; }, { passive: true });
    lb.addEventListener("touchend", (e) => { if (sx == null) return; const dx = e.changedTouches[0].clientX - sx; if (Math.abs(dx) > 50) show(cur + (dx < 0 ? 1 : -1)); sx = null; });
  }
})();
