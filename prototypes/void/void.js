// Hook preview, phases 1-5:
//   DALIAH -> tagline out of the fog -> napetost -> explosion into particles
//   -> the particles fly straight into the grid and build each card where they land.
// Layers: half-res fog with light shafts -> cards (textured planes, revealed where their
// particles have landed) -> dust + shard particles (GPU points, depth of field)
// -> post (grain, vignette, reveal, explosion flash, cursor displacement). Text and links are HTML.
import * as THREE from "./vendor/three.module.js";

// ---------------------------------------------------------------- config
const CFG = {
  dust: { desktop: 16000, phone: 6000 },
  shards: { desktop: 22000, phone: 8000 }, // the tagline's particles
  dpr: 1.75,
  fogScale: 0.36,
  camera: { z: 8, dolly: 3, mouse: 0.55, damp: 0.045 },
  focus: { from: 17, to: 7.2 },
  scrollDamp: 0.085,
  grain: 0.075,
  // timeline, as fractions of the hook scroll (5 screens)
  title: { out: 0.075 },
  text: { start: 0.07, span: 0.36, word: 0.06, blur: 10 },
  tension: { start: 0.55, end: 0.72 },
  // from the blast to the finished grid is one short stretch of scroll (~1 screen), scrubbed both ways.
  // Times below are in 'build seconds' along that stretch: hold = text holds as particles
  explode: { at: 0.72, end: 0.95, textDist: 6.3, hold: 0.24 },
  form: { delay: 0.0, stagger: 0.12, duration: 1.6 },
  grid: { distance: 9 },
  // cursor layer: phases 4-5 and the grid only; off on touch and reduced motion
  cursor: {
    tilt: { x: 0.22, y: 0.3 },      // radians at the screen edge, settled cards
    parallax: 0.35,                 // camera drift in world units
    light: 0.11,                    // soft light on the cards under the cursor
    lightRadius: 0.32,              // as a fraction of screen height
    displace: { strength: 0.035, radius: 0.16 }, // post-pass push from cursor speed
    hoverLift: 0.28,
  },
  loaderMin: 1500,
};

const PROJECTS = [
  { id: "o-nama", ar: 1.5, col: 0, kind: "logo", title: "o nama", tags: "daliah →", href: "#o-nama" },
  { id: "cupra", ar: 0.75, col: 1, img: "media/cupra1-hero.jpg", title: "Cupra", tags: "foto-video", href: "#radovi/cupra" },
  { id: "kodeks", ar: 1.5, col: 2, img: "media/kodeks-kejs.jpg", title: "Kodeks", tags: "integrisane · social", href: "#radovi/kodeks" },
  { id: "bash", ar: 0.75, col: 0, img: "media/bash-kejs.jpg", title: "Bash", tags: "integrisane · dizajn", href: "#radovi/bash" },
  { id: "omg", ar: 1.5, col: 1, img: "media/omg.jpg", title: "OMG", tags: "integrisane · web", href: "#radovi/omg" },
  { id: "mirza", ar: 0.75, col: 2, img: "media/mirza_mustafagic.jpg", title: "Mirza Mustafagić", tags: "foto-video", href: "#radovi/mirza" },
];
const CARDS = PROJECTS;
const NC = CARDS.length;
const GRID_N = PROJECTS.length;
const ATLAS = { cols: 3, rows: 2, cw: 640, ch: 640 }; // each card gets a sub-rectangle of its cell, in its own aspect
const cellSize = (c) => (c.ar >= 1 ? [ATLAS.cw, ATLAS.cw / c.ar] : [ATLAS.ch * c.ar, ATLAS.ch]);
const FORM_DONE = CFG.explode.hold + CFG.form.delay + (NC - 1) * CFG.form.stagger + CFG.form.duration;

const body = document.body;
const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
const isTouch = matchMedia("(pointer: coarse)").matches;
const isPhone = isTouch || innerWidth < 760;
const canvas = document.getElementById("gl");
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const clamp01 = (x) => Math.min(1, Math.max(0, x));
function mulberry(a) { return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

// ---------------------------------------------------------------- title + tagline -> spans
const titleEl = document.getElementById("title");
const VB = { x: 4.31, y: 868.41, w: 660.46, h: 117.9 };
const LETTER_X = [[4.31, 122.9], [126.23, 258.43], [270.72, 356.94], [372.43, 399.88], [412.17, 544.37], [556.66, 664.77]];
const letterBox = document.createElement("span");
letterBox.className = "letters"; letterBox.setAttribute("aria-hidden", "true");
const letters = [...titleEl.querySelectorAll(".wordmark path")].map((path, i) => {
  const [x0, x1] = LETTER_X[i];
  const l = document.createElement("span");
  l.className = "l";
  l.style.cssText = `left:${((x0 - VB.x) / VB.w) * 100}%;width:${((x1 - x0) / VB.w) * 100}%;top:0;height:100%`;
  l.innerHTML = `<svg viewBox="${x0} ${VB.y} ${x1 - x0} ${VB.h}" preserveAspectRatio="none">${path.outerHTML}</svg>`;
  letterBox.appendChild(l);
  return l;
});
titleEl.appendChild(letterBox);

const tagline = document.getElementById("tagline");
const words = [];
(function splitWords(el) {
  const nodes = [...el.childNodes];
  el.textContent = "";
  for (const n of nodes) {
    const isEm = n.nodeType === 1;
    for (const part of n.textContent.split(/(\s+)/)) {
      if (!part) continue;
      if (/^\s+$/.test(part)) { el.appendChild(document.createTextNode(" ")); continue; }
      const span = document.createElement("span");
      span.className = "w";
      if (isEm) { const em = document.createElement("em"); em.textContent = part; span.appendChild(em); } else span.textContent = part;
      el.appendChild(span);
      words.push(span);
    }
  }
})(tagline);

// ---------------------------------------------------------------- grid links (HTML)
const gridUI = document.getElementById("grid-ui");
let hovered = -1;
const tiles = PROJECTS.map((c, i) => {
  const a = document.createElement("a");
  a.className = "tile"; a.href = c.href;
  const thumbBg = c.kind === "logo" ? "background-color:#efe8f1;background-image:url(media/daliah-logo.svg);background-size:38%;background-repeat:no-repeat" : `background-image:url(${c.img})`;
  a.innerHTML = `<span class="tile-thumb" style="${thumbBg}"></span><span class="tile-meta"><span class="tile-title">${c.title}</span><span class="tile-tags mono">${c.tags}</span></span>`;
  a.addEventListener("pointerenter", () => { hovered = i; });
  a.addEventListener("pointerleave", () => { if (hovered === i) hovered = -1; });
  a.addEventListener("focus", () => { hovered = i; });
  a.addEventListener("blur", () => { if (hovered === i) hovered = -1; });
  gridUI.appendChild(a);
  return a;
});

// ---------------------------------------------------------------- sound (off by default)
const sound = (() => {
  const btn = document.getElementById("sound");
  const label = document.getElementById("sound-label");
  let ctx, master, on = false;
  function build() {
    ctx = new AudioContext();
    master = ctx.createGain(); master.gain.value = 0; master.connect(ctx.destination);
    const len = ctx.sampleRate * 4;
    const buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = buf.getChannelData(c); let last = 0;
      for (let i = 0; i < len; i++) { last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02; d[i] = last * 3.2; }
    }
    const noise = ctx.createBufferSource(); noise.buffer = buf; noise.loop = true;
    const lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 380; lp.Q.value = 0.7;
    const lfo = ctx.createOscillator(); lfo.frequency.value = 0.06;
    const lfoGain = ctx.createGain(); lfoGain.gain.value = 180;
    lfo.connect(lfoGain).connect(lp.frequency);
    const nGain = ctx.createGain(); nGain.gain.value = 0.55;
    noise.connect(lp).connect(nGain).connect(master);
    [55, 82.41, 110.3].forEach((f, i) => {
      const o = ctx.createOscillator(); o.type = "sine"; o.frequency.value = f; o.detune.value = (i - 1) * 4;
      const g = ctx.createGain(); g.gain.value = [0.05, 0.025, 0.012][i];
      o.connect(g).connect(master); o.start();
    });
    noise.start(); lfo.start();
  }
  btn.addEventListener("click", () => {
    if (!ctx) build();
    on = !on; ctx.resume();
    const t = ctx.currentTime;
    master.gain.cancelScheduledValues(t);
    master.gain.setTargetAtTime(on ? 0.22 : 0, t, on ? 0.9 : 0.25);
    btn.setAttribute("aria-pressed", String(on));
    label.textContent = on ? "zvuk uklj." : "zvuk isklj.";
  });
  return {
    setTension(x) { if (ctx && on) master.gain.setTargetAtTime(0.22 + x * 0.12, ctx.currentTime, 0.3); },
    boom() {
      if (!ctx || !on) return;
      const t = ctx.currentTime;
      // a low drop plus a burst of air
      const o = ctx.createOscillator(); o.type = "sine";
      o.frequency.setValueAtTime(90, t); o.frequency.exponentialRampToValueAtTime(28, t + 1.4);
      const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.5, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + 1.8);
      o.connect(g).connect(ctx.destination); o.start(t); o.stop(t + 2);
      const len = ctx.sampleRate * 2; const b = ctx.createBuffer(1, len, ctx.sampleRate); const d = b.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
      const n = ctx.createBufferSource(); n.buffer = b;
      const f = ctx.createBiquadFilter(); f.type = "lowpass"; f.frequency.setValueAtTime(2400, t); f.frequency.exponentialRampToValueAtTime(200, t + 1.5);
      const ng = ctx.createGain(); ng.gain.value = 0.35;
      n.connect(f).connect(ng).connect(ctx.destination); n.start(t);
    },
  };
})();

// ---------------------------------------------------------------- scroll + pointer state
const state = { scrollTarget: 0, scroll: 0, mx: 0, my: 0, smx: 0, smy: 0, pmx: 0, pmy: 0, vel: 0, time: 0, mouseSeen: false };
const voidEl = document.getElementById("void");
function readScroll() {
  const max = voidEl.offsetHeight - innerHeight;
  state.scrollTarget = max > 0 ? clamp01(scrollY / max) : 0;
  body.classList.toggle("is-scrolled", scrollY > 8);
}
addEventListener("scroll", readScroll, { passive: true });
// review aid: ?p=0.6 jumps straight to that point of the hook
const jumpTo = parseFloat(new URLSearchParams(location.search).get("p"));
function applyJump() {
  if (!(jumpTo >= 0)) return;
  scrollTo(0, jumpTo * (voidEl.offsetHeight - innerHeight));
  readScroll();
  state.scroll = state.scrollTarget;
}
addEventListener("pointermove", (e) => {
  if (e.pointerType !== "mouse") return;
  state.mouseSeen = true;
  state.mx = (e.clientX / innerWidth) * 2 - 1;
  state.my = (e.clientY / innerHeight) * 2 - 1;
});

// ---------------------------------------------------------------- chapter label
const chapterWord = document.getElementById("chapter-word");
const chapterNum = document.getElementById("chapter-num");
let chapter = "praznina";
function setChapter(word, num) {
  if (word === chapter) return;
  chapter = word;
  chapterWord.classList.add("is-out");
  setTimeout(() => {
    chapterWord.textContent = chapter; chapterNum.textContent = num;
    chapterWord.classList.remove("is-out"); chapterWord.classList.add("is-in");
    void chapterWord.offsetWidth;
    chapterWord.classList.remove("is-in");
  }, 420);
}
const CHAPTERS = { praznina: "01", napetost: "02", eksplozija: "03", radovi: "04" };

// ---------------------------------------------------------------- DOM per frame
const progressNum = document.getElementById("progress-num");
const progressFill = document.getElementById("progress-fill");
let lastJitter = 0, jx = 0, jy = 0;
let titleParticles = false; // true once DALIAH has been sampled into particles: the letters then hand over instead of fading out

function updateDOM(p, now, introT, exploded, chapterName) {
  // DALIAH: letters arrive after the loader, and lift off into the fog on the first scroll
  const nL = letters.length;
  for (let i = 0; i < nL; i++) {
    const inT = smooth(0, 1, (introT - 0.35 - i * 0.09) / 1.1);
    const c = (i - (nL - 1) / 2) / nL;
    const outT = titleParticles ? 0 : smooth(0.002 + Math.abs(c) * 0.01, CFG.title.out, p);
    const gone = titleParticles ? smooth(0, 0.004, p) : 0;
    const l = letters[i];
    l.style.opacity = (inT * (1 - outT) * (1 - gone)).toFixed(3);
    const blur = (1 - inT) * 14 + outT * 16;
    l.style.filter = blur > 0.05 ? `blur(${blur.toFixed(2)}px)` : "none";
    l.style.transform = `translate3d(${(c * outT * 0.9).toFixed(3)}em, ${((1 - inT) * 0.12 - outT * 0.25).toFixed(3)}em, 0) scale(${(1 + outT * 0.25).toFixed(3)})`;
  }

  // tagline: words drift in out of the fog, one after another
  const n = words.length;
  for (let i = 0; i < n; i++) {
    const s = CFG.text.start + (i / n) * CFG.text.span;
    const t = smooth(s, s + CFG.text.word, p);
    const w = words[i];
    w.style.opacity = t.toFixed(3);
    w.style.filter = t < 1 ? `blur(${((1 - t) * CFG.text.blur).toFixed(2)}px)` : "none";
    w.style.transform = t < 1 ? `translate3d(0, ${((1 - t) * 0.35).toFixed(3)}em, 0)` : "none";
  }
  tagline.style.visibility = exploded ? "hidden" : "visible";

  // tension: glow, a little bigger, then it trembles
  const k = smooth(CFG.tension.start, CFG.tension.end, p);
  if (now - lastJitter > 42) {
    lastJitter = now;
    const amp = Math.pow(k, 2.2) * 3.4;
    jx = (Math.random() * 2 - 1) * amp; jy = (Math.random() * 2 - 1) * amp;
  }
  tagline.style.transform = `translate3d(${jx.toFixed(2)}px, ${jy.toFixed(2)}px, 0) scale(${(1 + k * 0.045).toFixed(4)})`;
  tagline.style.textShadow = k > 0.001
    ? `0 0 ${(k * 26).toFixed(1)}px rgba(226, 200, 236, ${(k * 0.45).toFixed(3)}), 0 0 ${(k * 3).toFixed(1)}px rgba(250, 242, 252, ${(k * 0.55).toFixed(3)})`
    : "none";
  tagline.style.color = k > 0.001 ? `rgba(${232 + 20 * k | 0}, ${222 + 26 * k | 0}, ${236 + 16 * k | 0}, ${0.9 + 0.1 * k})` : "";
  sound.setTension(k);

  setChapter(chapterName, CHAPTERS[chapterName]);
  progressNum.textContent = String(Math.round(p * 100)).padStart(3, "0");
  progressFill.style.transform = `scaleX(${p.toFixed(4)})`;
}

// ---------------------------------------------------------------- loader
const loader = document.getElementById("loader");
const loaderNum = document.getElementById("loader-num");
const loaderFill = document.getElementById("loader-fill");
let loadTarget = 0;
function runLoader(onDone) {
  const t0 = performance.now();
  let shown = 0, last = t0;
  (function tick(now) {
    const dt = Math.min(0.25, (now - last) / 1000); last = now;
    const goal = Math.min(loadTarget, Math.min(1, (now - t0) / CFG.loaderMin));
    shown += (goal - shown) * (1 - Math.exp(-dt * 9));
    if (goal >= 1 && shown > 0.995) shown = 1;
    loaderNum.textContent = String(Math.round(shown * 100)).padStart(3, "0");
    loaderFill.style.transform = `scaleX(${shown})`;
    if (shown < 1) return requestAnimationFrame(tick);
    loader.classList.add("is-ready");
    setTimeout(() => { loader.classList.add("is-done"); body.classList.remove("is-loading"); onDone(); }, 750);
  })(t0);
}

// ---------------------------------------------------------------- static fallback
function startStatic() {
  body.classList.add("no-gl", "no-motion");
  loader.classList.add("is-done");
  body.classList.remove("is-loading");
  body.classList.add("is-ready");
  words.forEach((w) => { w.style.opacity = 1; });
  letters.forEach((l) => { l.style.opacity = 1; });
}

if (reduceMotion || !hasWebGL()) startStatic();
else startGL();

function hasWebGL() {
  try { return !!document.createElement("canvas").getContext("webgl2"); } catch { return false; }
}

// ---------------------------------------------------------------- card atlas (one texture for all cards)
function loadImage(src) {
  return new Promise((res) => { const im = new Image(); im.onload = () => res(im); im.onerror = () => res(null); im.src = src; });
}
async function buildAtlas() {
  const { cols, rows, cw, ch } = ATLAS;
  const cv = document.createElement("canvas");
  cv.width = cols * cw; cv.height = rows * ch;
  const g = cv.getContext("2d");
  g.fillStyle = "#1d1220"; g.fillRect(0, 0, cv.width, cv.height);
  const imgs = await Promise.all(CARDS.map((c) => loadImage(c.kind === "logo" ? "media/daliah-logo.svg" : c.img)));
  CARDS.forEach((c, i) => {
    const x = (i % cols) * cw, y = Math.floor(i / cols) * ch, im = imgs[i];
    const [w0, h0] = cellSize(c);
    if (c.kind === "logo") {
      g.fillStyle = "#efe8f1"; g.fillRect(x, y, w0, h0);
      if (im) { const h = h0 * 0.42, w = h * ((im.width / im.height) || 0.674); g.drawImage(im, x + (w0 - w) / 2, y + (h0 - h) / 2, w, h); }
      return;
    }
    if (!im) return;
    const s = Math.max(w0 / im.width, h0 / im.height); // cover
    const w = im.width * s, h = im.height * s;
    g.save(); g.beginPath(); g.rect(x, y, w0, h0); g.clip();
    g.drawImage(im, x + (w0 - w) / 2, y + (h0 - h) / 2, w, h);
    g.restore();
  });
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.NoColorSpace;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.generateMipmaps = true;
  tex.anisotropy = 4;
  return tex;
}

// ================================================================= WebGL
function startGL() {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false, powerPreference: "high-performance" });
  renderer.outputColorSpace = THREE.LinearSRGBColorSpace; // colours are written as display values
  renderer.setClearColor(0x150b17, 1);
  renderer.autoClear = false;

  const quadGeo = new THREE.PlaneGeometry(2, 2);
  const orthoCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const quadVert = /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;
  const camera = new THREE.PerspectiveCamera(45, 1, 0.05, 100);

  // ---------- fog (low res), tinted from brand purple #642969
  const fogMat = new THREE.ShaderMaterial({
    vertexShader: quadVert, depthTest: false, depthWrite: false,
    uniforms: {
      uTime: { value: 0 }, uRes: { value: new THREE.Vector2() }, uCam: { value: new THREE.Vector2() },
      uScroll: { value: 0 }, uLight: { value: new THREE.Vector2(0.64, 0.8) }, uTension: { value: 0 }, uDim: { value: 1 },
    },
    fragmentShader: /* glsl */ `
      precision highp float;
      varying vec2 vUv;
      uniform float uTime, uScroll, uTension, uDim;
      uniform vec2 uRes, uCam, uLight;
      float hash(vec3 p){ p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
      float noise(vec3 x){
        vec3 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);
        return mix(mix(mix(hash(i), hash(i + vec3(1,0,0)), f.x), mix(hash(i + vec3(0,1,0)), hash(i + vec3(1,1,0)), f.x), f.y),
                   mix(mix(hash(i + vec3(0,0,1)), hash(i + vec3(1,0,1)), f.x), mix(hash(i + vec3(0,1,1)), hash(i + vec3(1,1,1)), f.x), f.y), f.z);
      }
      float fbm(vec3 p, int oct){
        float a = 0.5, s = 0.0;
        for (int i = 0; i < 6; i++){ if (i >= oct) break; s += a * noise(p); p = p * 2.03 + vec3(1.7, 9.2, 3.1); a *= 0.5; }
        return s;
      }
      float fog(vec2 uv, int oct){
        vec2 p = (uv - 0.5) * vec2(uRes.x / uRes.y, 1.0);
        float t = uTime, d = 0.0;
        for (int i = 0; i < 3; i++){
          float fi = float(i);
          float sc = 1.1 + fi * 0.85 + uScroll * (0.35 + fi * 0.25);
          vec2 q = p * sc + uCam * (0.05 + fi * 0.07) + vec2(t * (0.011 + fi * 0.007), t * (0.003 - fi * 0.002));
          float w = fbm(vec3(q * 0.7, t * 0.018 + fi * 5.0), 2);
          float f = fbm(vec3(q + w * 1.1, t * 0.026 + fi * 3.1), oct);
          d += smoothstep(0.38, 0.82, f) * (0.7 - fi * 0.17);
        }
        return d;
      }
      float fogLite(vec2 uv){
        vec2 q = (uv - 0.5) * vec2(uRes.x / uRes.y, 1.0) * 1.3 + uCam * 0.06 + vec2(uTime * 0.012, 0.0);
        return smoothstep(0.3, 0.8, fbm(vec3(q, uTime * 0.026), 2));
      }
      void main(){
        vec2 uv = vUv;
        vec2 asp = vec2(uRes.x / uRes.y, 1.0);
        float dens = fog(uv, 4);
        vec2 lp = uLight + uCam * 0.02;
        float ld = length((uv - lp) * asp);
        float glow = exp(-ld * 2.4) * 0.6 + exp(-ld * 9.0) * 0.35;
        vec2 stepv = (lp - uv) / 8.0;
        vec2 s = uv; float occ = 0.0;
        for (int i = 0; i < 8; i++){ s += stepv; occ += fogLite(s); }
        float shaft = exp(-occ * 0.32);
        float ang = atan((uv - lp).y * asp.y, (uv - lp).x * asp.x);
        float rays = 0.6 + 0.4 * noise(vec3(ang * 5.0, uTime * 0.05, 0.0)) * noise(vec3(ang * 11.0, uTime * 0.03, 4.0));
        rays = mix(1.0, rays, smoothstep(0.04, 0.35, ld));

        vec3 base = vec3(0.082, 0.043, 0.090);                // #150b17
        vec3 fogCol = vec3(0.215, 0.120, 0.235);              // #642969, lifted into the fog
        vec3 lightCol = vec3(0.600, 0.470, 0.660);            // lavender light behind it
        vec3 col = base;
        col += fogCol * dens * (0.55 + 0.45 * shaft) * uDim;
        col += lightCol * glow * shaft * rays * (0.36 + uTension * 0.3);
        col += lightCol * exp(-ld * 1.1) * shaft * rays * 0.07;
        col += lightCol * glow * dens * 0.22 * uDim;
        col *= mix(0.72, 1.06, smoothstep(0.0, 1.0, uv.y));
        gl_FragColor = vec4(col, 1.0);
      }`,
  });
  const fogScene = new THREE.Scene();
  fogScene.add(new THREE.Mesh(quadGeo, fogMat));
  const bgMat = new THREE.ShaderMaterial({
    vertexShader: quadVert, depthTest: false, depthWrite: false,
    uniforms: { tFog: { value: null } },
    fragmentShader: `precision highp float; varying vec2 vUv; uniform sampler2D tFog; void main(){ gl_FragColor = texture2D(tFog, vUv); }`,
  });
  const bgScene = new THREE.Scene();
  bgScene.add(new THREE.Mesh(quadGeo, bgMat));

  const scene = new THREE.Scene();

  // shared depth-of-field point sizing (dust and shards)
  const dofChunk = /* glsl */ `
    float dofSize(float z, float sharp, float seedY, out float coc){
      coc = clamp(abs(z - uFocus) / z * 1.35, 0.0, 1.0);
      float size = sharp + coc * uPx * (0.003 + 0.013 * seedY * seedY) * (z < 3.0 ? 2.5 : 1.0);
      return min(size, z < 3.0 ? 72.0 : 34.0);
    }`;

  // ---------- dust
  const dustCount = isPhone ? CFG.dust.phone : CFG.dust.desktop;
  const dPos = new Float32Array(dustCount * 3), dSeed = new Float32Array(dustCount * 4);
  for (let i = 0; i < dustCount; i++) {
    const near = Math.random() < 0.025;
    dPos[i * 3] = (Math.random() * 2 - 1) * 15;
    dPos[i * 3 + 1] = (Math.random() * 2 - 1) * 9;
    dPos[i * 3 + 2] = near ? 2 + Math.random() * 4.5 : -42 + Math.pow(Math.random(), 0.8) * 44;
    for (let k = 0; k < 4; k++) dSeed[i * 4 + k] = Math.random();
  }
  const dustGeo = new THREE.BufferGeometry();
  dustGeo.setAttribute("position", new THREE.BufferAttribute(dPos, 3));
  dustGeo.setAttribute("aSeed", new THREE.BufferAttribute(dSeed, 4));
  const dustMat = new THREE.ShaderMaterial({
    transparent: true, depthTest: false, depthWrite: false,
    blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor,
    uniforms: { uTime: { value: 0 }, uFocus: { value: CFG.focus.from }, uPx: { value: 1000 }, uAlpha: { value: 0 }, uAgitate: { value: 0 }, uBlast: { value: 0 } },
    vertexShader: /* glsl */ `
      attribute vec4 aSeed;
      uniform float uTime, uFocus, uPx, uAlpha, uAgitate, uBlast;
      varying float vAlpha, vCoc, vTint;
      ${dofChunk}
      void main(){
        vec3 p = position;
        float t = uTime * (1.0 + uAgitate * 1.6);
        float tau = 6.2831853;
        p.x += sin(t * 0.07 * (0.4 + aSeed.x) + aSeed.y * tau) * 0.9 + uTime * 0.045;
        p.y += cos(t * 0.05 * (0.4 + aSeed.z) + aSeed.x * tau) * 0.55 + uTime * 0.03 * (0.3 + aSeed.w);
        p.z += sin(t * 0.035 + aSeed.w * tau) * 0.7;
        p.xy += uAgitate * uAgitate * 0.035 * vec2(sin(uTime * 61.0 + aSeed.x * 90.0), cos(uTime * 53.0 + aSeed.y * 70.0));
        p.x = mod(p.x + 15.0, 30.0) - 15.0;
        p.y = mod(p.y + 9.0, 18.0) - 9.0;
        // the shockwave pushes the air outward for a moment
        p.xy *= 1.0 + uBlast * 0.18 * (0.5 + aSeed.y);
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        float z = max(0.05, -mv.z);
        float sharp = (0.5 + 1.8 * aSeed.w * aSeed.w) * uPx * 0.0105 / z;
        float coc; float size = dofSize(z, sharp, aSeed.y, coc);
        gl_PointSize = size;
        gl_Position = projectionMatrix * mv;
        float energy = (sharp * sharp) / (size * size);
        float tw = 0.65 + 0.35 * sin(uTime * (0.4 + aSeed.x * 1.7) + aSeed.z * 40.0);
        float depthFade = smoothstep(46.0, 16.0, z) * smoothstep(0.25, 1.4, z);
        vAlpha = uAlpha * depthFade * tw * clamp(0.9 * energy + 0.06 * coc, 0.0, 1.0) * (0.45 + 0.55 * aSeed.z) * 0.85;
        vCoc = coc; vTint = aSeed.x;
      }`,
    fragmentShader: /* glsl */ `
      precision highp float;
      varying float vAlpha, vCoc, vTint;
      void main(){
        float d = length(gl_PointCoord - 0.5) * 2.0;
        if (d > 1.0) discard;
        float focused = exp(-d * d * 5.0);
        float disc = smoothstep(1.0, 0.82, d) * (0.7 + 0.3 * smoothstep(0.55, 0.95, d));
        float a = mix(focused, disc, smoothstep(0.08, 0.5, vCoc)) * vAlpha;
        vec3 col = mix(vec3(0.82, 0.74, 0.88), vec3(0.92, 0.84, 0.86), vTint * 0.6);  // lilac, a little warmth
        gl_FragColor = vec4(col * a, a);
      }`,
  });
  const dust = new THREE.Points(dustGeo, dustMat);
  dust.frustumCulled = false; dust.renderOrder = 9000;
  scene.add(dust);

  // ---------- cards: built in place in the grid, revealed where their particles land
  const landedChunk = /* glsl */ `
    // where on a card a particle lands first: mostly noise, swept a little from the top.
    // the card shader uses the same function, so the image appears exactly where particles land
    float h21(vec2 p){ return fract(sin(dot(p, vec2(41.3, 289.1))) * 43758.5453); }
    float vn2(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
      return mix(mix(h21(i), h21(i + vec2(1,0)), f.x), mix(h21(i + vec2(0,1)), h21(i + vec2(1,1)), f.x), f.y); }
    float landed(float prog, vec2 uv){
      float o = clamp(vn2(uv * 11.0 + 3.7) * 0.35 + h21(floor(uv * vec2(96.0, 120.0))) * 0.35 + (1.0 - uv.y) * 0.3, 0.0, 1.0);
      return clamp((prog - o * 0.5) / 0.5, 0.0, 1.0);
    }`;
  const rnd = mulberry(1203);
  const cards = CARDS.map((c, i) => {
    const r = (a, b) => a + rnd() * (b - a);
    const col = i % ATLAS.cols, row = Math.floor(i / ATLAS.cols);
    return {
      ...c, i,
      rot0: new THREE.Vector3(r(-0.45, 0.45), r(-0.6, 0.6), r(-0.18, 0.18)), // the tilt it forms at
      zOff: -r(1.4, 2.6),                                                    // and how far back
      grid: new THREE.Vector3(),
      cell: (() => { const [w, h] = cellSize(c); return new THREE.Vector4(col / ATLAS.cols, 1 - (row * ATLAS.ch + h) / (ATLAS.rows * ATLAS.ch), w / (ATLAS.cols * ATLAS.cw), h / (ATLAS.rows * ATLAS.ch)); })(),
      pos: new THREE.Vector3(), quat: new THREE.Quaternion(), size: new THREE.Vector2(1, 1.25), gsize: new THREE.Vector2(1, 1.25),
      prog: 0, hover: 0,
    };
  });
  const restCam = new THREE.Vector3(0, 0, CFG.camera.z - CFG.camera.dolly);
  // masonry: equal-width columns, each card in its own aspect (landscape or portrait)
  function layoutGrid() {
    const aspect = innerWidth / innerHeight;
    const D = CFG.grid.distance;
    const Hv = 2 * D * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)), Wv = Hv * aspect;
    const cols = aspect >= 1 ? 3 : 2;
    const gap = Hv * (aspect >= 1 ? 0.02 : 0.015), label = Hv * (aspect >= 1 ? 0.05 : 0.04);
    const areaW = Wv * (aspect >= 1 ? 0.94 : 0.95), areaH = Hv * (aspect >= 1 ? 0.82 : 0.8);
    // desktop: the columns set in PROJECTS; phone: each card goes to the shorter column
    const colOf = [], sum = new Array(cols).fill(0), count = new Array(cols).fill(0);
    PROJECTS.forEach((p, i) => {
      const c = cols === 3 ? p.col : (sum[0] <= sum[1] ? 0 : 1);
      colOf[i] = c; sum[c] += 1 / p.ar; count[c]++;
    });
    const fixed = (c) => (count[c] - 1) * (gap + label) + label;
    let cw = (areaW - (cols - 1) * gap) / cols;
    for (let c = 0; c < cols; c++) if (count[c]) cw = Math.min(cw, (areaH - fixed(c)) / sum[c]);
    const colH = sum.map((sm, c) => cw * sm + fixed(c));
    const totalW = cols * cw + (cols - 1) * gap, totalH = Math.max(...colH);
    const y = new Array(cols).fill(0);
    cards.forEach((card, i) => {
      const c = colOf[i], h = cw / PROJECTS[i].ar;
      card.gsize.set(cw, h);
      card.grid.set(-totalW / 2 + cw / 2 + c * (cw + gap), totalH / 2 - y[c] - h / 2 - Hv * 0.01, restCam.z - D);
      y[c] += h + gap + label;
    });
  }

  const cardUniformsM = cards.map(() => new THREE.Matrix4());
  const cardUniformsS = cards.map(() => new THREE.Vector2(1, 1));
  const cardUniformsCell = cards.map((c) => c.cell);
  const cardUniformsP = cards.map(() => 0);
  const atlasRef = { value: null };
  const mouseUniforms = { uMouse: { value: new THREE.Vector2(-9999, -9999) }, uRes: { value: new THREE.Vector2(1, 1) } };

  const cardGeo = new THREE.PlaneGeometry(1, 1);
  const cardVert = `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
  const cardFrag = /* glsl */ `
    precision highp float;
    varying vec2 vUv;
    uniform sampler2D uAtlas;
    uniform vec4 uCell;
    uniform float uProg, uBlur, uHover, uDim, uLightAmt, uLightR;
    uniform vec2 uMouse, uRes;
    ${landedChunk}
    void main(){
      vec2 uv = vUv;
      float l = landed(clamp((uProg - 0.3) / 0.7, 0.0, 1.0), uv);
      float rev = smoothstep(0.93, 1.0, l);                       // image only where particles have landed
      float front = smoothstep(0.7, 0.95, l) * (1.0 - rev);       // a faint glow just ahead of them
      float edge = min(min(uv.x, 1.0 - uv.x), min(uv.y, 1.0 - uv.y));
      float line = (1.0 - smoothstep(0.0, 0.005, edge)) * smoothstep(0.3, 0.45, uProg);
      if (rev + front + line < 0.002) discard;
      vec3 c = vec3(0.0);
      float rad = uBlur * 0.065;
      for (int i = 0; i < 8; i++){
        float fi = float(i);
        float a = fi * 2.39996;
        vec2 o = vec2(cos(a), sin(a) * 0.8) * sqrt((fi + 0.5) / 8.0) * rad;
        vec2 u = clamp(uv + o, 0.004, 0.996);
        c += texture2D(uAtlas, uCell.xy + u * uCell.zw, uBlur * 3.5).rgb;
      }
      c /= 8.0;
      c *= uDim * (1.0 + uHover * 0.1);
      c = mix(c, vec3(0.95, 0.9, 0.97), (1.0 - smoothstep(0.0, 0.006, edge)) * (0.18 + uHover * 0.5) * (1.0 - uBlur));
      vec2 d = (gl_FragCoord.xy - uMouse) / uRes.y;
      c += vec3(0.62, 0.5, 0.7) * exp(-dot(d, d) / (uLightR * uLightR)) * uLightAmt;
      vec3 glow = vec3(0.86, 0.74, 0.94);
      c = mix(glow, c, rev);
      c = mix(c, vec3(0.92, 0.86, 0.96), line * (1.0 - rev));
      float a = max((rev + front * 0.16) * smoothstep(0.0, 0.004 + uBlur * 0.05, edge), line * 0.55);
      gl_FragColor = vec4(c, a);
    }`;
  cards.forEach((c) => {
    const mat = new THREE.ShaderMaterial({
      transparent: true, depthTest: false, depthWrite: false,
      vertexShader: cardVert, fragmentShader: cardFrag,
      uniforms: {
        uAtlas: atlasRef, uCell: { value: c.cell }, uProg: { value: 0 }, uBlur: { value: 0 }, uHover: { value: 0 }, uDim: { value: 1 },
        uLightAmt: { value: 0 }, uLightR: { value: CFG.cursor.lightRadius }, ...mouseUniforms,
      },
    });
    const mesh = new THREE.Mesh(cardGeo, mat);
    mesh.frustumCulled = false; mesh.visible = false;
    scene.add(mesh);
    c.mesh = mesh;
  });

  // ---------- shards: the tagline as particles; blast, then they become the cards
  const shardCount = isPhone ? CFG.shards.phone : CFG.shards.desktop;
  const sText = new Float32Array(shardCount * 3), sDir = new Float32Array(shardCount * 3);
  const sCard = new Float32Array(shardCount * 4), sSeed = new Float32Array(shardCount * 4);
  for (let i = 0; i < shardCount; i++) {
    const ci = Math.floor(Math.random() * NC);
    let u = Math.random(), v = Math.random();
    let tag = 0; // 0 = fills the inside; 1 + t = traces the outline, t = position around it
    if (Math.random() < 0.35) {
      const t = Math.random(), per = t * 4, side = Math.floor(per), q = per - side;
      if (side === 0) { u = q; v = 1; } else if (side === 1) { u = 1; v = 1 - q; } else if (side === 2) { u = 1 - q; v = 0; } else { u = 0; v = q; }
      tag = 1 + t;
    }
    sCard.set([ci, u, v, tag], i * 4);
    for (let k = 0; k < 4; k++) sSeed[i * 4 + k] = Math.random();
  }
  const shardGeo = new THREE.BufferGeometry();
  shardGeo.setAttribute("position", new THREE.BufferAttribute(sText, 3)); // text points live in position
  shardGeo.setAttribute("aDir", new THREE.BufferAttribute(sDir, 3));
  shardGeo.setAttribute("aCard", new THREE.BufferAttribute(sCard, 4));
  shardGeo.setAttribute("aSeed", new THREE.BufferAttribute(sSeed, 4));
  const shardMat = new THREE.ShaderMaterial({
    transparent: true, depthTest: false, depthWrite: false,
    blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor,
    defines: { NC, HOLD: CFG.explode.hold.toFixed(3), OUTLINE_END: '0.4', FILL_START: '0.3' },
    uniforms: {
      uTime: { value: 0 }, uFocus: { value: 7 }, uPx: { value: 1000 }, uVis: { value: 0 },
      uBurstT: { value: 0 }, uAtlas: atlasRef, uCardP: { value: cardUniformsP },
      uCardM: { value: cardUniformsM }, uCardS: { value: cardUniformsS }, uCardCell: { value: cardUniformsCell },
    },
    vertexShader: /* glsl */ `
      attribute vec3 aDir;
      attribute vec4 aCard, aSeed;
      uniform float uTime, uFocus, uPx, uVis, uBurstT;
      uniform float uCardP[NC];
      uniform mat4 uCardM[NC];
      uniform vec2 uCardS[NC];
      uniform vec4 uCardCell[NC];
      uniform sampler2D uAtlas;
      varying float vAlpha, vCoc;
      varying vec3 vCol;
      ${dofChunk}
      ${landedChunk}
      void main(){
        // hold: the text shivers in place for a beat, then the blast (fast out, heavy drag, slow drift)
        float bt = max(0.0, uBurstT - HOLD);
        float e = 1.0 - exp(-bt * 3.4);
        float shiver = (1.0 - step(HOLD, uBurstT)) * 0.012 * uBurstT / HOLD;
        vec3 b = position + aDir * e + shiver * vec3(sin(uTime * 83.0 + aSeed.x * 50.0), cos(uTime * 71.0 + aSeed.y * 50.0), 0.0);
        float tt = uTime * 0.35;
        b += vec3(sin(tt + aSeed.x * 6.28 + b.y * 0.3), cos(tt * 0.8 + aSeed.y * 6.28 + b.x * 0.3), sin(tt * 0.6 + aSeed.z * 6.28)) * 0.18 * e;

        // build: each particle flies straight to its spot on its card
        int ci = int(aCard.x + 0.5);
        vec3 tgt = (uCardM[ci] * vec4((aCard.yz - 0.5) * uCardS[ci], 0.0, 1.0)).xyz;
        float prog = uCardP[ci];
        bool outline = aCard.w >= 1.0;
        float l = outline
          ? clamp((prog / OUTLINE_END - (aCard.w - 1.0) * 0.6) / 0.4, 0.0, 1.0)   // drawn around the edge
          : landed(clamp((prog - FILL_START) / (1.0 - FILL_START), 0.0, 1.0), aCard.yz);
        float f = l * l * (3.0 - 2.0 * l);
        vec3 p = mix(b, tgt, f) + (aSeed.xyz - 0.5) * 1.2 * sin(f * 3.14159);

        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        float z = max(0.05, -mv.z);
        float sharp = (0.7 + 0.9 * aSeed.w * aSeed.w) * uPx * 0.0115 / z;
        float coc; float size = dofSize(z, sharp, aSeed.y, coc);
        gl_PointSize = uVis > 0.0 ? size : 0.0;
        gl_Position = projectionMatrix * mv;

        // colour: white-hot text, cooling to lilac, then the card's own image
        vec3 col = mix(vec3(1.0, 0.97, 1.0), vec3(0.84, 0.74, 0.92), smoothstep(0.05, 0.7, e));
        vec4 cell = uCardCell[ci];
        vec3 img = texture2D(uAtlas, cell.xy + clamp(aCard.yz, 0.01, 0.99) * cell.zw).rgb;
        col = mix(col, outline ? vec3(0.96, 0.9, 1.0) : img * 1.3 + 0.04, f);
        vCol = col;

        float energy = (sharp * sharp) / (size * size);
        float flash = 1.0 + 1.6 * exp(-bt * 4.0);
        float depthFade = smoothstep(46.0, 16.0, z) * smoothstep(0.2, 1.0, z);
        float handoff = outline ? 1.0 - smoothstep(0.88, 1.0, prog) * 0.85   // the outline stays until the card is whole
                                : 1.0 - smoothstep(0.9, 1.0, l);                 // landed: the card's pixel takes over
        vAlpha = uVis * depthFade * flash * handoff * clamp(energy + 0.05 * coc, 0.0, 1.0) * (0.55 + 0.45 * aSeed.z);
        vCoc = coc;
      }`,
    fragmentShader: /* glsl */ `
      precision highp float;
      varying float vAlpha, vCoc;
      varying vec3 vCol;
      void main(){
        float d = length(gl_PointCoord - 0.5) * 2.0;
        if (d > 1.0) discard;
        float focused = exp(-d * d * 4.0);
        float disc = smoothstep(1.0, 0.82, d) * (0.7 + 0.3 * smoothstep(0.55, 0.95, d));
        float a = mix(focused, disc, smoothstep(0.08, 0.5, vCoc)) * vAlpha;
        gl_FragColor = vec4(vCol * a, a);
      }`,
  });
  const shards = new THREE.Points(shardGeo, shardMat);
  shards.frustumCulled = false; shards.renderOrder = 9500; shards.visible = false;
  scene.add(shards);

  // read the tagline's pixels from the page and turn them into particle start points
  const textCanvas = document.createElement("canvas");
  function captureText() {
    const S = 0.5;
    textCanvas.width = Math.ceil(innerWidth * S); textCanvas.height = Math.ceil(innerHeight * S);
    const g = textCanvas.getContext("2d", { willReadFrequently: true });
    g.clearRect(0, 0, textCanvas.width, textCanvas.height);
    g.scale(S, S); g.fillStyle = "#fff"; g.textBaseline = "middle";
    const scale = parseFloat(tagline.style.transform.match(/scale\(([\d.]+)\)/)?.[1] || "1");
    for (const w of words) {
      const el = w.firstElementChild || w;
      const cs = getComputedStyle(el), r = w.getBoundingClientRect();
      g.font = `${cs.fontStyle} ${cs.fontWeight} ${parseFloat(cs.fontSize) * scale}px ${cs.fontFamily}`;
      g.fillText(w.textContent, r.left, r.top + r.height / 2);
    }
    const data = g.getImageData(0, 0, textCanvas.width, textCanvas.height).data;
    const pts = [];
    for (let y = 0; y < textCanvas.height; y++) for (let x = 0; x < textCanvas.width; x++) {
      if (data[(y * textCanvas.width + x) * 4 + 3] > 110) pts.push(x / S, y / S);
    }
    if (!pts.length) { const r = tagline.getBoundingClientRect(); for (let i = 0; i < 400; i++) pts.push(r.left + Math.random() * r.width, r.top + Math.random() * r.height); }

    camera.updateMatrixWorld();
    const fwdV = new THREE.Vector3(); camera.getWorldDirection(fwdV);
    const v = new THREE.Vector3(), c = new THREE.Vector3();
    const D = CFG.explode.textDist;
    for (let i = 0; i < shardCount; i++) {
      const k = Math.floor(Math.random() * (pts.length / 2)) * 2;
      const sx = pts[k] + (Math.random() - 0.5) * 2 / S, sy = pts[k + 1] + (Math.random() - 0.5) * 2 / S;
      v.set((sx / innerWidth) * 2 - 1, -(sy / innerHeight) * 2 + 1, 0.5).unproject(camera).sub(camera.position).normalize();
      v.multiplyScalar(D / v.dot(fwdV)).add(camera.position);
      sText[i * 3] = v.x; sText[i * 3 + 1] = v.y; sText[i * 3 + 2] = v.z;
      c.add(v);
    }
    c.multiplyScalar(1 / shardCount);
    for (let i = 0; i < shardCount; i++) {
      const dx = sText[i * 3] - c.x, dy = sText[i * 3 + 1] - c.y;
      const s = 0.2 + Math.random() * 0.45;
      // radial blast, plus a random spherical kick; some particles fly at the lens
      const th = Math.random() * Math.PI * 2, ph = Math.acos(Math.random() * 2 - 1), m = 0.25 + Math.pow(Math.random(), 2) * 1.2;
      sDir[i * 3] = dx * s + Math.sin(ph) * Math.cos(th) * m * 1.4;
      sDir[i * 3 + 1] = dy * s * 1.8 + Math.sin(ph) * Math.sin(th) * m;
      sDir[i * 3 + 2] = Math.cos(ph) * m + (Math.random() - 0.5) * 1.2;
    }
    shardGeo.attributes.position.needsUpdate = true;
    shardGeo.attributes.aDir.needsUpdate = true;
  }


  // ---------- DALIAH as particles: the wordmark's pixels, which come apart on the first scroll
  const titleCount = isPhone ? 5000 : 12000;
  const tPos = new Float32Array(titleCount * 3), tSeed = new Float32Array(titleCount * 4);
  const titleGeo = new THREE.BufferGeometry();
  titleGeo.setAttribute("position", new THREE.BufferAttribute(tPos, 3));
  titleGeo.setAttribute("aSeed", new THREE.BufferAttribute(tSeed, 4));
  for (let i = 0; i < titleCount * 4; i++) tSeed[i] = Math.random();
  const titleMat = new THREE.ShaderMaterial({
    transparent: true, depthTest: false, depthWrite: false,
    blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor,
    uniforms: { uT: { value: 0 }, uVis: { value: 0 }, uTime: { value: 0 }, uDpr: { value: 1 }, uX0: { value: 0 }, uXW: { value: 1 } },
    vertexShader: /* glsl */ `
      attribute vec4 aSeed;
      uniform float uT, uVis, uTime, uDpr, uX0, uXW;
      varying float vA, vM;
      void main(){
        float sweep = (position.x - uX0) / uXW;
        float start = aSeed.w * 0.5 + sweep * 0.2;           // a ragged front, drifting left to right
        float t = clamp((uT - start) / 0.5, 0.0, 1.0);
        float e = 1.0 - pow(1.0 - t, 3.0);
        vec3 dir = vec3((aSeed.x - 0.5) * 1.6 + 0.35, 0.3 + aSeed.y * 1.4, (aSeed.z - 0.35) * 3.0);
        vec3 p = position + dir * e * 1.2;
        p.x += sin(uTime * 1.3 + aSeed.y * 6.28 + p.y * 2.0) * 0.06 * e;
        p.y += cos(uTime * 1.1 + aSeed.x * 6.28) * 0.04 * e;
        vec4 mv = vec4(p, 1.0); // already in view space
        float z = max(0.2, -mv.z);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = uVis > 0.0 ? (1.25 + aSeed.z * 0.8 + e * 1.8) * uDpr * clamp(6.3 / z, 0.5, 3.0) : 0.0;
        vA = uVis * (1.0 - smoothstep(0.55, 1.0, t)) * (0.42 + 0.12 * aSeed.x);
        vM = e;
      }`,
    fragmentShader: /* glsl */ `
      precision highp float;
      varying float vA, vM;
      void main(){
        float d = length(gl_PointCoord - 0.5) * 2.0;
        if (d > 1.0) discard;
        float a = smoothstep(1.0, 0.3, d) * vA;
        vec3 col = mix(vec3(0.93, 0.88, 0.96), vec3(0.78, 0.62, 0.9), vM);
        gl_FragColor = vec4(col * a, a);
      }`,
  });
  const titleDust = new THREE.Points(titleGeo, titleMat);
  titleDust.frustumCulled = false; titleDust.renderOrder = 9400; titleDust.visible = false;
  scene.add(titleDust);

  function captureTitle() {
    const r = letterBox.getBoundingClientRect();
    if (r.width < 10 || r.height < 2) return;
    const cv = document.createElement("canvas");
    cv.width = Math.ceil(r.width); cv.height = Math.ceil(r.height);
    const g = cv.getContext("2d", { willReadFrequently: true });
    g.scale(cv.width / VB.w, cv.height / VB.h); g.translate(-VB.x, -VB.y); g.fillStyle = "#fff";
    for (const path of titleEl.querySelectorAll(".wordmark path")) g.fill(new Path2D(path.getAttribute("d")));
    const data = g.getImageData(0, 0, cv.width, cv.height).data;
    const pts = [];
    for (let y = 0; y < cv.height; y++) for (let x = 0; x < cv.width; x++) if (data[(y * cv.width + x) * 4 + 3] > 110) pts.push(r.left + x, r.top + y);
    if (!pts.length) return;
    // where the camera sits before any scrolling, so the particles start exactly under the letters
    const cam = camera.clone();
    cam.position.set(0, 0, CFG.camera.z); cam.rotation.set(0, 0, 0); cam.updateMatrixWorld(true);
    const v = new THREE.Vector3(), D = CFG.explode.textDist;
    let x0 = 1e9, x1 = -1e9;
    for (let i = 0; i < titleCount; i++) {
      const k = Math.floor(Math.random() * (pts.length / 2)) * 2;
      const sx = pts[k] + Math.random() - 0.5, sy = pts[k + 1] + Math.random() - 0.5;
      v.set((sx / innerWidth) * 2 - 1, -(sy / innerHeight) * 2 + 1, 0.5).unproject(cam).sub(cam.position).normalize();
      v.multiplyScalar(D / -v.z).add(cam.position);
      v.sub(cam.position); // view space: the particles ride with the screen, not the world
      tPos[i * 3] = v.x; tPos[i * 3 + 1] = v.y; tPos[i * 3 + 2] = v.z;
      x0 = Math.min(x0, v.x); x1 = Math.max(x1, v.x);
    }
    titleMat.uniforms.uX0.value = x0; titleMat.uniforms.uXW.value = Math.max(0.001, x1 - x0);
    titleGeo.attributes.position.needsUpdate = true;
    titleParticles = true;
  }

  // ---------- post
  const postMat = new THREE.ShaderMaterial({
    vertexShader: quadVert, depthTest: false, depthWrite: false,
    uniforms: {
      tScene: { value: null }, uTime: { value: 0 }, uRes: { value: new THREE.Vector2() },
      uReveal: { value: 0 }, uGrain: { value: CFG.grain }, uTension: { value: 0 }, uFlash: { value: 0 },
      uMouseUv: { value: new THREE.Vector2(0.5, 0.5) }, uDisplace: { value: 0 }, uDispR: { value: CFG.cursor.displace.radius },
    },
    fragmentShader: /* glsl */ `
      precision highp float;
      varying vec2 vUv;
      uniform sampler2D tScene;
      uniform float uTime, uReveal, uGrain, uTension, uFlash, uDisplace, uDispR;
      uniform vec2 uRes, uMouseUv;
      float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
      float vn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
        return mix(mix(h(i), h(i + vec2(1,0)), f.x), mix(h(i + vec2(0,1)), h(i + vec2(1,1)), f.x), f.y); }
      void main(){
        vec2 asp = vec2(uRes.x / uRes.y, 1.0);
        vec2 uv = vUv;
        // cursor displacement: a soft lens push that follows the cursor's speed
        vec2 dm = (uv - uMouseUv) * asp;
        uv -= dm / asp * uDisplace * exp(-dot(dm, dm) / (uDispR * uDispR));
        // explosion: a short radial smear and a lavender flash
        vec2 dc = uv - 0.5;
        vec3 c = texture2D(tScene, uv).rgb;
        if (uFlash > 0.002){
          c = c * 0.5 + 0.25 * texture2D(tScene, 0.5 + dc * (1.0 - uFlash * 0.06)).rgb + 0.25 * texture2D(tScene, 0.5 + dc * (1.0 - uFlash * 0.12)).rgb;
          c += vec3(0.62, 0.5, 0.68) * uFlash * 0.35 * exp(-dot(dc * asp, dc * asp) * 3.0);
        }
        vec2 q = dc * asp;
        float v = smoothstep(1.2, 0.2, length(q * vec2(0.9, 1.1)));
        c *= mix(0.5, 1.0, v);
        vec2 gp = floor(vUv * uRes / 1.5);
        float g = h(gp + fract(uTime * 23.17) * 311.0) + h(gp * 1.37 + fract(uTime * 17.3) * 97.0) - 1.0;
        float luma = dot(c, vec3(0.299, 0.587, 0.114));
        c += g * (uGrain + uTension * 0.03) * (1.0 - luma * 0.8);
        float n = vn(vUv * asp * 4.0) * 0.6 + vn(vUv * 17.0) * 0.4;
        float r = smoothstep(n - 0.18, n + 0.18, uReveal * 1.36 - 0.18);
        c = mix(vec3(0.082, 0.043, 0.090) * 0.55, c, r);
        gl_FragColor = vec4(c, 1.0);
      }`,
  });
  const postScene = new THREE.Scene();
  postScene.add(new THREE.Mesh(quadGeo, postMat));

  // ---------- targets + resize
  let fogRT, sceneRT, W = 1, H = 1;
  function resize() {
    const dpr = Math.min(devicePixelRatio || 1, CFG.dpr);
    renderer.setPixelRatio(dpr);
    renderer.setSize(innerWidth, innerHeight, false);
    W = Math.floor(innerWidth * dpr); H = Math.floor(innerHeight * dpr);
    fogRT?.dispose(); sceneRT?.dispose();
    fogRT = new THREE.WebGLRenderTarget(Math.floor(W * CFG.fogScale), Math.floor(H * CFG.fogScale), { depthBuffer: false });
    sceneRT = new THREE.WebGLRenderTarget(W, H, { depthBuffer: false });
    fogMat.uniforms.uRes.value.set(W, H);
    postMat.uniforms.uRes.value.set(W, H);
    mouseUniforms.uRes.value.set(W, H);
    dustMat.uniforms.uPx.value = H; shardMat.uniforms.uPx.value = H; titleMat.uniforms.uDpr.value = dpr;
    bgMat.uniforms.tFog.value = fogRT.texture;
    postMat.uniforms.tScene.value = sceneRT.texture;
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    layoutGrid();
    captureTitle();
    readScroll();
  }
  addEventListener("resize", resize);
  resize();

  // ---------- loading: fonts, card images and shader compile count toward 100
  loadTarget = 0.1;
  let atlasReady = false, fontsReady = false;
  const bump = () => { loadTarget = Math.max(loadTarget, 0.25 + (fontsReady ? 0.25 : 0) + (atlasReady ? 0.35 : 0)); };
  document.fonts.ready.then(() => { fontsReady = true; bump(); });
  buildAtlas().then((tex) => {
    atlasRef.value = tex; atlasReady = true; bump();
    setTimeout(() => {
      renderer.compile(fogScene, orthoCam);
      cards.forEach((c) => { c.mesh.visible = true; }); shards.visible = true;
      renderer.compile(scene, camera);
      cards.forEach((c) => { c.mesh.visible = false; }); shards.visible = false;
      renderer.compile(postScene, orthoCam);
      renderer.initTexture(tex);
      document.fonts.ready.then(() => { loadTarget = 1; });
    }, 0);
  });

  let revealStart = 0;
  runLoader(() => { captureTitle(); body.classList.add("is-ready"); revealStart = performance.now(); applyJump(); });

  // ---------- frame loop
  const clock = new THREE.Clock();
  const tmpE = new THREE.Euler(), tmpQ = new THREE.Quaternion(), tmpQ2 = new THREE.Quaternion(), tmpV = new THREE.Vector3();
  const one = new THREE.Vector3(1, 1, 1), fwd = new THREE.Vector3(), lookAt = new THREE.Vector3();
  const corners = [[-0.5, -0.5], [0.5, -0.5], [-0.5, 0.5], [0.5, 0.5]];
  let exploded = false, flash = 0;

  // camera: dolly into the fog until the blast, then it holds on the grid with a little parallax
  function updateCamera(k, pre, built) {
    const T = state.time;
    const mouseAmt = CFG.camera.mouse * pre + CFG.cursor.parallax * (1 - pre) * (1 - built * 0.6);
    const shake = k * k * 0.018 * pre + flash * 0.05;
    camera.position.set(
      state.smx * mouseAmt + Math.sin(T * 0.11) * 0.15 * pre + (Math.random() - 0.5) * shake,
      -state.smy * mouseAmt * 0.6 + Math.cos(T * 0.09) * 0.1 * pre + (Math.random() - 0.5) * shake,
      CFG.camera.z - Math.min(1, state.scroll / CFG.explode.at) * CFG.camera.dolly,
    );
    lookAt.set(state.smx * (0.25 * pre + 0.08 * (1 - pre)), -state.smy * (0.15 * pre + 0.05 * (1 - pre)), camera.position.z - 20);
    camera.lookAt(lookAt);
    camera.rotation.z += Math.sin(T * 0.07) * 0.012 * pre;
    camera.updateMatrixWorld();
  }

  function frame(now, forcedDt) {
    if (window.__hook?.paused && forcedDt == null) return requestAnimationFrame(frame);
    const dt = forcedDt ?? Math.min(clock.getDelta(), 0.05);
    state.time += dt;
    state.scroll += (state.scrollTarget - state.scroll) * (1 - Math.pow(1 - CFG.scrollDamp, dt * 60));
    const damp = 1 - Math.pow(1 - CFG.camera.damp, dt * 60);
    state.smx += (state.mx - state.smx) * damp;
    state.smy += (state.my - state.smy) * damp;
    const speed = Math.hypot(state.mx - state.pmx, state.my - state.pmy) / Math.max(dt, 1e-3);
    state.pmx = state.mx; state.pmy = state.my;
    state.vel += (Math.min(speed, 4) - state.vel) * (1 - Math.exp(-dt * 6));

    const p = state.scroll, T = state.time;
    const k = smooth(CFG.tension.start, CFG.tension.end, p);
    const reveal = revealStart ? Math.min(1, (now - revealStart) / 2400) : 0;
    const easedReveal = 1 - Math.pow(1 - reveal, 3);
    const introT = revealStart ? (now - revealStart) / 1000 : 0;

    // explosion: fires at the end of the tension, then everything runs on time;
    // scrolling back above it rebuilds the text
    if (!exploded && p >= CFG.explode.at && body.classList.contains("is-ready")) {
      updateCamera(0, 1, 0);
      captureText();
      exploded = true;
      if (p < CFG.explode.at + 0.03) sound.boom(); // not when landing here from a jump
    } else if (exploded && p < CFG.explode.at - 0.012) {
      exploded = false;
    }
    const burstT = exploded ? clamp01((p - CFG.explode.at) / (CFG.explode.end - CFG.explode.at)) * FORM_DONE : 0;
    const blastT = burstT - CFG.explode.hold;
    flash = exploded && blastT > 0 && blastT < 3 ? Math.exp(-blastT * 3.2) * smooth(0, 0.04, blastT) : 0;
    const built = exploded ? smooth(FORM_DONE - 0.5, FORM_DONE, burstT) : 0; // 1 = grid finished
    const pre = exploded ? 1 - smooth(0, 0.9, burstT) : 1;                   // 1 = still in the void phases
    const cursorOn = !isTouch && state.mouseSeen && exploded;
    const chapterName = !exploded ? (p < CFG.tension.start ? "praznina" : "napetost") : (burstT < 1.1 ? "eksplozija" : "radovi");

    updateCamera(k, pre, built);

    // focus: rack onto the text, then pull to the grid as the cards build
    const preFocus = CFG.focus.from + (CFG.focus.to - CFG.focus.from) * smooth(0, 0.45, p) - Math.min(1, p / CFG.explode.at) * CFG.camera.dolly * 0.5;
    const focus = exploded ? CFG.explode.textDist + (CFG.grid.distance - CFG.explode.textDist) * smooth(0.1, 1.2, burstT) : preFocus;

    // cards: each forms tilted and a little deep, and straightens into its grid slot as it builds
    camera.getWorldDirection(fwd);
    const tiltOn = cursorOn ? built : 0;
    cards.forEach((c, i) => {
      const start = CFG.explode.hold + CFG.form.delay + i * CFG.form.stagger;
      c.prog = exploded ? clamp01((burstT - start) / CFG.form.duration) : 0;
      const ease = 1 - Math.pow(1 - c.prog, 3);
      c.hover += ((hovered === i && built > 0.9 ? 1 : 0) - c.hover) * (1 - Math.exp(-dt * 10));
      c.pos.copy(c.grid);
      c.pos.z += c.zOff * (1 - ease) + c.hover * CFG.cursor.hoverLift;
      tmpE.set(c.rot0.x * (1 - ease), c.rot0.y * (1 - ease), c.rot0.z * (1 - ease));
      tmpQ.setFromEuler(tmpE);
      tmpE.set(state.smy * CFG.cursor.tilt.x * tiltOn * (0.6 + c.hover * 0.6), state.smx * CFG.cursor.tilt.y * tiltOn * (0.6 + c.hover * 0.6), 0);
      tmpQ2.setFromEuler(tmpE);
      c.quat.copy(tmpQ).multiply(tmpQ2);
      c.size.copy(c.gsize);
      cardUniformsM[i].compose(c.pos, c.quat, one);
      cardUniformsS[i].copy(c.size);
      cardUniformsP[i] = c.prog;

      const dist = tmpV.copy(c.pos).sub(camera.position).dot(fwd);
      const coc = Math.min(1, Math.abs(dist - focus) / Math.max(dist, 0.1) * 1.7);
      const u = c.mesh.material.uniforms;
      u.uProg.value = c.prog;
      u.uBlur.value = coc;
      u.uDim.value = 1 - 0.45 * smooth(9, 20, dist);
      u.uHover.value = c.hover;
      u.uLightAmt.value = CFG.cursor.light * tiltOn;
      c.mesh.visible = exploded && c.prog > 0;
      c.mesh.position.copy(c.pos); c.mesh.quaternion.copy(c.quat); c.mesh.scale.set(c.size.x, c.size.y, 1);
      c.mesh.renderOrder = Math.round(5000 - dist * 100);
    });

    // grid links follow the projected cards
    gridUI.classList.toggle("is-on", built > 0.6);
    // past the hook (kontakt scrolls in): the void, the cards and their links fade out
    const past = clamp01(1 - voidEl.getBoundingClientRect().bottom / innerHeight);
    canvas.style.opacity = (1 - past).toFixed(3);
    gridUI.style.setProperty("--past", past.toFixed(3));
    gridUI.classList.toggle("is-past", past > 0.15);
    if (exploded) {
      for (let i = 0; i < GRID_N; i++) {
        const c = cards[i];
        let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
        for (const [ax, ay] of corners) {
          tmpV.set(ax * c.size.x, ay * c.size.y, 0).applyQuaternion(c.quat).add(c.pos).project(camera);
          const sx = (tmpV.x + 1) / 2 * innerWidth, sy = (1 - tmpV.y) / 2 * innerHeight;
          x0 = Math.min(x0, sx); x1 = Math.max(x1, sx); y0 = Math.min(y0, sy); y1 = Math.max(y1, sy);
        }
        const t = tiles[i];
        t.style.transform = `translate3d(${x0.toFixed(1)}px, ${y0.toFixed(1)}px, 0)`;
        t.style.width = `${(x1 - x0).toFixed(1)}px`; t.style.height = `${(y1 - y0).toFixed(1)}px`;
      }
    }

    // uniforms
    fogMat.uniforms.uTime.value = T;
    fogMat.uniforms.uScroll.value = Math.min(p, CFG.explode.at) * 0.6 + (1 - pre) * 0.15;
    fogMat.uniforms.uCam.value.set(state.smx, -state.smy);
    fogMat.uniforms.uLight.value.set(0.64 + Math.sin(T * 0.045) * 0.07, 0.8 + Math.cos(T * 0.06) * 0.05);
    fogMat.uniforms.uTension.value = k * pre + flash * 1.2;
    fogMat.uniforms.uDim.value = 1 - 0.45 * (1 - pre);

    dustMat.uniforms.uTime.value = T;
    dustMat.uniforms.uFocus.value = focus;
    dustMat.uniforms.uAlpha.value = easedReveal * (1 - 0.35 * built);
    dustMat.uniforms.uAgitate.value = k * pre;
    dustMat.uniforms.uBlast.value = exploded && blastT > 0 ? (1 - Math.exp(-blastT * 2.5)) * Math.exp(-blastT * 0.6) : 0;

    const tHand = smooth(0, 0.004, p), titleLive = body.classList.contains("is-ready") && !exploded && p < CFG.title.out + 0.02;
    titleMat.uniforms.uT.value = smooth(0.003, CFG.title.out, p);
    titleMat.uniforms.uVis.value = titleLive ? tHand : 0;
    titleMat.uniforms.uTime.value = T;
    titleDust.visible = titleLive && p > 0.0005;

    shardMat.uniforms.uTime.value = T;
    shardMat.uniforms.uFocus.value = focus;
    shardMat.uniforms.uVis.value = exploded ? 1 : 0;
    shardMat.uniforms.uBurstT.value = burstT;
    shards.visible = exploded && burstT < FORM_DONE + 0.2;

    mouseUniforms.uMouse.value.set((state.smx + 1) / 2 * W, (1 - (state.smy + 1) / 2) * H);
    postMat.uniforms.uTime.value = T;
    postMat.uniforms.uReveal.value = easedReveal;
    postMat.uniforms.uTension.value = k * pre;
    postMat.uniforms.uFlash.value = flash;
    postMat.uniforms.uMouseUv.value.set((state.mx + 1) / 2, 1 - (state.my + 1) / 2);
    postMat.uniforms.uDisplace.value = cursorOn ? Math.min(1, state.vel / 3) * CFG.cursor.displace.strength : 0;

    renderer.setRenderTarget(fogRT); renderer.clear(); renderer.render(fogScene, orthoCam);
    renderer.setRenderTarget(sceneRT); renderer.clear();
    renderer.render(bgScene, orthoCam);
    renderer.render(scene, camera);
    renderer.setRenderTarget(null);
    renderer.render(postScene, orthoCam);

    if (body.classList.contains("is-ready")) updateDOM(p, now, introT, exploded, chapterName);
    if (forcedDt == null) requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
  // review aid for throttled tabs: __hook.step(frames, dt) runs frames at a fixed step
  window.__hook = { paused: false, step(n = 1, d = 1 / 60) { for (let i = 0; i < n; i++) frame(performance.now(), d); } };
}

// kontakt: copy the email without leaving the page
(() => {
  const btn = document.getElementById("copy-mail");
  const mail = document.querySelector(".contact-mail");
  if (!btn || !mail) return;
  let t;
  btn.addEventListener("click", async () => {
    try { await navigator.clipboard.writeText(mail.dataset.copy); btn.textContent = "kopirano"; }
    catch { btn.textContent = mail.dataset.copy; }
    clearTimeout(t); t = setTimeout(() => { btn.textContent = "kopiraj"; }, 1800);
  });
})();
