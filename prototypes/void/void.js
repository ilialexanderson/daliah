// Void preview (hook phase 1 + a hint of phase 2).
// Layers: half-res volumetric fog with light shafts -> depth-of-field dust
// (GPU points) -> post pass (grain, vignette, dissolve reveal). Tagline is HTML.
import * as THREE from "./vendor/three.module.js";

// ---------------------------------------------------------------- config
const CFG = {
  particles: { desktop: 28000, phone: 10000 },
  dpr: 1.75,
  fogScale: 0.36, // fog render resolution (it is soft anyway)
  camera: { z: 8, dolly: 4.5, mouse: 0.55, damp: 0.045 },
  focus: { from: 17, to: 7.2 }, // rack focus as the text arrives
  scrollDamp: 0.085,
  grain: 0.075,
  text: { start: 0.06, span: 0.52, word: 0.075, blur: 10 },
  tension: { start: 0.8 }, // last 20% of the void scroll
  loaderMin: 1500, // ms
};

const body = document.body;
const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
const isTouch = matchMedia("(pointer: coarse)").matches;
const canvas = document.getElementById("gl");

// ---------------------------------------------------------------- tagline -> words
const tagline = document.getElementById("tagline");
const words = [];
(function splitWords(el) {
  const nodes = [...el.childNodes];
  el.textContent = "";
  for (const n of nodes) {
    const isEm = n.nodeType === 1;
    const parts = n.textContent.split(/(\s+)/);
    for (const part of parts) {
      if (!part) continue;
      if (/^\s+$/.test(part)) { el.appendChild(document.createTextNode(" ")); continue; }
      const span = document.createElement("span");
      span.className = "w";
      if (isEm) {
        const em = document.createElement("em");
        em.textContent = part;
        span.appendChild(em);
      } else span.textContent = part;
      el.appendChild(span);
      words.push(span);
    }
  }
})(tagline);

// ---------------------------------------------------------------- type switch (preview only)
document.querySelectorAll(".type-switch button").forEach((b) => {
  b.addEventListener("click", () => setType(b.dataset.type));
});
addEventListener("keydown", (e) => { if (e.key === "t") setType(body.classList.contains("type-a") ? "b" : "a"); });
function setType(t) {
  body.classList.toggle("type-a", t === "a");
  body.classList.toggle("type-b", t === "b");
  document.querySelectorAll(".type-switch button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.type === t)));
}

// ---------------------------------------------------------------- sound (off by default)
const sound = (() => {
  const btn = document.getElementById("sound");
  const label = document.getElementById("sound-label");
  let ctx, master, on = false;
  function build() {
    ctx = new AudioContext();
    master = ctx.createGain();
    master.gain.value = 0;
    master.connect(ctx.destination);
    // brown noise -> slowly breathing lowpass: wind in an empty hall
    const len = ctx.sampleRate * 4;
    const buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = buf.getChannelData(c);
      let last = 0;
      for (let i = 0; i < len; i++) {
        last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02;
        d[i] = last * 3.2;
      }
    }
    const noise = ctx.createBufferSource();
    noise.buffer = buf; noise.loop = true;
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass"; lp.frequency.value = 380; lp.Q.value = 0.7;
    const lfo = ctx.createOscillator(); lfo.frequency.value = 0.06;
    const lfoGain = ctx.createGain(); lfoGain.gain.value = 180;
    lfo.connect(lfoGain).connect(lp.frequency);
    const nGain = ctx.createGain(); nGain.gain.value = 0.55;
    noise.connect(lp).connect(nGain).connect(master);
    // a low, barely moving fifth
    [55, 82.41, 110.3].forEach((f, i) => {
      const o = ctx.createOscillator(); o.type = "sine"; o.frequency.value = f;
      o.detune.value = (i - 1) * 4;
      const g = ctx.createGain(); g.gain.value = [0.05, 0.025, 0.012][i];
      o.connect(g).connect(master); o.start();
    });
    noise.start(); lfo.start();
  }
  btn.addEventListener("click", () => {
    if (!ctx) build();
    on = !on;
    ctx.resume();
    const t = ctx.currentTime;
    master.gain.cancelScheduledValues(t);
    master.gain.setTargetAtTime(on ? 0.22 : 0, t, on ? 0.9 : 0.25);
    btn.setAttribute("aria-pressed", String(on));
    label.textContent = on ? "zvuk uklj." : "zvuk isklj.";
  });
  return { setTension(x) { if (ctx && on) master.gain.setTargetAtTime(0.22 + x * 0.12, ctx.currentTime, 0.3); } };
})();

// ---------------------------------------------------------------- scroll + pointer state
const state = {
  scrollTarget: 0, scroll: 0,
  mx: 0, my: 0, smx: 0, smy: 0,
  time: 0, reveal: 0,
};
const voidEl = document.getElementById("void");
function readScroll() {
  const max = voidEl.offsetHeight - innerHeight;
  state.scrollTarget = max > 0 ? Math.min(1, Math.max(0, scrollY / max)) : 0;
  body.classList.toggle("is-scrolled", scrollY > 8);
}
addEventListener("scroll", readScroll, { passive: true });
addEventListener("pointermove", (e) => {
  if (e.pointerType !== "mouse") return;
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
    chapterWord.textContent = word;
    chapterNum.textContent = num;
    chapterWord.classList.remove("is-out");
    chapterWord.classList.add("is-in");
    void chapterWord.offsetWidth;
    chapterWord.classList.remove("is-in");
  }, 420);
}

// ---------------------------------------------------------------- DOM per frame
const progressNum = document.getElementById("progress-num");
const progressFill = document.getElementById("progress-fill");
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
let lastJitter = 0, jx = 0, jy = 0;

function updateDOM(p, now) {
  // words drift in out of the fog, one after another
  const n = words.length;
  for (let i = 0; i < n; i++) {
    const s = CFG.text.start + (i / n) * CFG.text.span;
    const t = smooth(s, s + CFG.text.word, p);
    const w = words[i];
    w.style.opacity = t.toFixed(3);
    w.style.filter = t < 1 ? `blur(${((1 - t) * CFG.text.blur).toFixed(2)}px)` : "none";
    w.style.transform = t < 1 ? `translate3d(0, ${((1 - t) * 0.35).toFixed(3)}em, 0)` : "none";
  }
  // tension: glow, a little bigger, then it starts to shake
  const k = smooth(CFG.tension.start, 1, p);
  if (now - lastJitter > 42) { // ~24 fps shake reads as tremor, not as smooth wobble
    lastJitter = now;
    const amp = Math.pow(k, 2.2) * 3.2;
    jx = (Math.random() * 2 - 1) * amp;
    jy = (Math.random() * 2 - 1) * amp;
  }
  tagline.style.transform = `translate3d(${jx.toFixed(2)}px, ${jy.toFixed(2)}px, 0) scale(${(1 + k * 0.045).toFixed(4)})`;
  tagline.style.textShadow = k > 0.001
    ? `0 0 ${(k * 26).toFixed(1)}px rgba(214, 232, 228, ${(k * 0.42).toFixed(3)}), 0 0 ${(k * 3).toFixed(1)}px rgba(240, 248, 246, ${(k * 0.5).toFixed(3)})`
    : "none";
  tagline.style.color = k > 0.001 ? `rgba(${214 + 26 * k | 0}, ${223 + 22 * k | 0}, ${221 + 22 * k | 0}, ${0.88 + 0.12 * k})` : "";
  sound.setTension(k);

  setChapter(p >= CFG.tension.start ? "napetost" : "praznina", p >= CFG.tension.start ? "02" : "01");
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
    const timeCap = Math.min(1, (now - t0) / CFG.loaderMin);
    const goal = Math.min(loadTarget, timeCap);
    shown += (goal - shown) * (1 - Math.exp(-dt * 9)); // frame-rate independent
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
}

if (reduceMotion || !hasWebGL()) startStatic();
else startGL();

function hasWebGL() {
  try { return !!document.createElement("canvas").getContext("webgl2"); } catch { return false; }
}

// ================================================================= WebGL
function startGL() {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false, powerPreference: "high-performance" });
  renderer.outputColorSpace = THREE.LinearSRGBColorSpace; // all colours are written as display values
  renderer.setClearColor(0x0d1113, 1);
  renderer.autoClear = false;

  const quadGeo = new THREE.PlaneGeometry(2, 2);
  const orthoCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const quadVert = /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;

  // ---------- fog (half res)
  const fogMat = new THREE.ShaderMaterial({
    vertexShader: quadVert,
    depthTest: false, depthWrite: false,
    uniforms: {
      uTime: { value: 0 }, uRes: { value: new THREE.Vector2() }, uCam: { value: new THREE.Vector2() },
      uScroll: { value: 0 }, uLight: { value: new THREE.Vector2(0.64, 0.8) }, uTension: { value: 0 },
    },
    fragmentShader: /* glsl */ `
      precision highp float;
      varying vec2 vUv;
      uniform float uTime, uScroll, uTension;
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
      // three fog sheets at different depths, each with its own drift and parallax
      float fog(vec2 uv, int oct){
        vec2 p = (uv - 0.5) * vec2(uRes.x / uRes.y, 1.0);
        float t = uTime, d = 0.0;
        for (int i = 0; i < 3; i++){
          float fi = float(i);
          float sc = 1.1 + fi * 0.85 + uScroll * (0.35 + fi * 0.25);        // dolly: sheets grow as we move in
          vec2 q = p * sc + uCam * (0.05 + fi * 0.07) + vec2(t * (0.011 + fi * 0.007), t * (0.003 - fi * 0.002));
          float w = fbm(vec3(q * 0.7, t * 0.018 + fi * 5.0), 2);               // domain warp: curling smoke
          float f = fbm(vec3(q + w * 1.1, t * 0.026 + fi * 3.1), oct);
          d += smoothstep(0.38, 0.82, f) * (0.7 - fi * 0.17);
        }
        return d;
      }
      // cheap single-sheet density, only used to occlude the light shafts
      float fogLite(vec2 uv){
        vec2 q = (uv - 0.5) * vec2(uRes.x / uRes.y, 1.0) * 1.3 + uCam * 0.06 + vec2(uTime * 0.012, 0.0);
        return smoothstep(0.3, 0.8, fbm(vec3(q, uTime * 0.026), 2));
      }
      void main(){
        vec2 uv = vUv;
        vec2 asp = vec2(uRes.x / uRes.y, 1.0);
        float dens = fog(uv, 4);

        // light behind the fog, slowly wandering
        vec2 lp = uLight + uCam * 0.02;
        float ld = length((uv - lp) * asp);
        float glow = exp(-ld * 2.4) * 0.6 + exp(-ld * 9.0) * 0.35;

        // god rays: march toward the light, fog in between occludes it
        vec2 stepv = (lp - uv) / 8.0;
        vec2 s = uv; float occ = 0.0;
        for (int i = 0; i < 8; i++){ s += stepv; occ += fogLite(s); }
        float shaft = exp(-occ * 0.32);
        // long thin rays fanning out of the light, modulated by the fog they cross
        float ang = atan((uv - lp).y * asp.y, (uv - lp).x * asp.x);
        float rays = 0.6 + 0.4 * noise(vec3(ang * 5.0, uTime * 0.05, 0.0)) * noise(vec3(ang * 11.0, uTime * 0.03, 4.0));
        rays = mix(1.0, rays, smoothstep(0.04, 0.35, ld)); // no lens-star at the core: rays only show further out

        vec3 base = vec3(0.051, 0.067, 0.075);                 // #0d1113
        vec3 fogCol = vec3(0.175, 0.222, 0.230);
        vec3 lightCol = vec3(0.50, 0.585, 0.600);
        vec3 col = base;
        col += fogCol * dens * (0.55 + 0.45 * shaft);           // fog lit from behind
        col += lightCol * glow * shaft * rays * (0.36 + uTension * 0.3);
        col += lightCol * exp(-ld * 1.1) * shaft * rays * 0.07;   // faint long rays
        col += lightCol * glow * dens * 0.22;                   // forward scatter in the fog
        col *= mix(0.72, 1.06, smoothstep(0.0, 1.0, uv.y));    // darker floor
        gl_FragColor = vec4(col, 1.0);
      }`,
  });
  const fogScene = new THREE.Scene();
  fogScene.add(new THREE.Mesh(quadGeo, fogMat));

  // fog texture drawn into the main scene buffer
  const bgMat = new THREE.ShaderMaterial({
    vertexShader: quadVert, depthTest: false, depthWrite: false,
    uniforms: { tFog: { value: null } },
    fragmentShader: `precision highp float; varying vec2 vUv; uniform sampler2D tFog; void main(){ gl_FragColor = texture2D(tFog, vUv); }`,
  });
  const bgScene = new THREE.Scene();
  bgScene.add(new THREE.Mesh(quadGeo, bgMat));

  // ---------- dust
  const count = isTouch || innerWidth < 760 ? CFG.particles.phone : CFG.particles.desktop;
  const pos = new Float32Array(count * 3);
  const seed = new Float32Array(count * 4);
  for (let i = 0; i < count; i++) {
    // denser toward the middle depth, a few motes very close to the lens
    const near = Math.random() < 0.025;
    pos[i * 3 + 0] = (Math.random() * 2 - 1) * 15;
    pos[i * 3 + 1] = (Math.random() * 2 - 1) * 9;
    pos[i * 3 + 2] = near ? 2 + Math.random() * 4.5 : -42 + Math.pow(Math.random(), 0.8) * 44;
    for (let k = 0; k < 4; k++) seed[i * 4 + k] = Math.random();
  }
  const dustGeo = new THREE.BufferGeometry();
  dustGeo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  dustGeo.setAttribute("aSeed", new THREE.BufferAttribute(seed, 4));
  const dustMat = new THREE.ShaderMaterial({
    transparent: true, depthTest: false, depthWrite: false,
    blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor, // premultiplied additive
    uniforms: {
      uTime: { value: 0 }, uFocus: { value: CFG.focus.from }, uPx: { value: 1000 },
      uAlpha: { value: 0 }, uAgitate: { value: 0 },
    },
    vertexShader: /* glsl */ `
      attribute vec4 aSeed;
      uniform float uTime, uFocus, uPx, uAlpha, uAgitate;
      varying float vAlpha, vCoc, vTint;
      void main(){
        vec3 p = position;
        float t = uTime * (1.0 + uAgitate * 1.6);
        float tau = 6.2831853;
        // slow brownian-ish drift + a faint updraft, wrapped inside the box
        p.x += sin(t * 0.07 * (0.4 + aSeed.x) + aSeed.y * tau) * 0.9 + uTime * 0.045;
        p.y += cos(t * 0.05 * (0.4 + aSeed.z) + aSeed.x * tau) * 0.55 + uTime * 0.03 * (0.3 + aSeed.w);
        p.z += sin(t * 0.035 + aSeed.w * tau) * 0.7;
        // tension: a fine tremor in the air
        p.xy += uAgitate * uAgitate * 0.035 * vec2(sin(uTime * 61.0 + aSeed.x * 90.0), cos(uTime * 53.0 + aSeed.y * 70.0));
        p.x = mod(p.x + 15.0, 30.0) - 15.0;
        p.y = mod(p.y + 9.0, 18.0) - 9.0;

        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        float z = max(0.05, -mv.z);
        float sharp = (0.5 + 1.8 * aSeed.w * aSeed.w) * uPx * 0.0105 / z;     // in-focus size
        float coc = clamp(abs(z - uFocus) / z * 1.35, 0.0, 1.0);                 // circle of confusion
        float size = sharp + coc * uPx * (0.003 + 0.013 * aSeed.y * aSeed.y) * (z < 3.0 ? 2.5 : 1.0);
        size = min(size, z < 3.0 ? 72.0 : 34.0);
        gl_PointSize = size;
        gl_Position = projectionMatrix * mv;

        float energy = (sharp * sharp) / (size * size);                          // blur spreads the same light
        float tw = 0.65 + 0.35 * sin(uTime * (0.4 + aSeed.x * 1.7) + aSeed.z * 40.0);
        float depthFade = smoothstep(46.0, 16.0, z) * smoothstep(0.25, 1.4, z);
        vAlpha = uAlpha * depthFade * tw * clamp(0.9 * energy + 0.06 * coc, 0.0, 1.0) * (0.45 + 0.55 * aSeed.z) * 0.85;
        vCoc = coc;
        vTint = aSeed.x;
      }`,
    fragmentShader: /* glsl */ `
      precision highp float;
      varying float vAlpha, vCoc, vTint;
      void main(){
        float d = length(gl_PointCoord - 0.5) * 2.0;
        if (d > 1.0) discard;
        float focused = exp(-d * d * 5.0);
        float disc = smoothstep(1.0, 0.82, d) * (0.7 + 0.3 * smoothstep(0.55, 0.95, d)); // bokeh with a faint rim
        float a = mix(focused, disc, smoothstep(0.08, 0.5, vCoc)) * vAlpha;
        vec3 col = mix(vec3(0.74, 0.82, 0.82), vec3(0.86, 0.85, 0.80), vTint * 0.6);  // cool grey, a little warmth
        gl_FragColor = vec4(col * a, a);
      }`,
  });
  const dust = new THREE.Points(dustGeo, dustMat);
  dust.frustumCulled = false;
  const scene = new THREE.Scene();
  scene.add(dust);
  const camera = new THREE.PerspectiveCamera(45, 1, 0.05, 100);

  // ---------- post
  const postMat = new THREE.ShaderMaterial({
    vertexShader: quadVert, depthTest: false, depthWrite: false,
    uniforms: {
      tScene: { value: null }, uTime: { value: 0 }, uRes: { value: new THREE.Vector2() },
      uReveal: { value: 0 }, uGrain: { value: CFG.grain }, uTension: { value: 0 },
    },
    fragmentShader: /* glsl */ `
      precision highp float;
      varying vec2 vUv;
      uniform sampler2D tScene;
      uniform float uTime, uReveal, uGrain, uTension;
      uniform vec2 uRes;
      float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
      float vn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
        return mix(mix(h(i), h(i + vec2(1,0)), f.x), mix(h(i + vec2(0,1)), h(i + vec2(1,1)), f.x), f.y); }
      void main(){
        vec2 uv = vUv;
        vec3 c = texture2D(tScene, uv).rgb;

        // vignette, slightly oval
        vec2 q = (uv - 0.5) * vec2(uRes.x / uRes.y, 1.0);
        float v = smoothstep(1.2, 0.2, length(q * vec2(0.9, 1.1)));
        c *= mix(0.5, 1.0, v);

        // film grain: per-frame, stronger in the shadows, never pure noise in the highlights
        vec2 gp = floor(uv * uRes / 1.5);
        float g = h(gp + fract(uTime * 23.17) * 311.0) + h(gp * 1.37 + fract(uTime * 17.3) * 97.0) - 1.0;
        float luma = dot(c, vec3(0.299, 0.587, 0.114));
        c += g * (uGrain + uTension * 0.03) * (1.0 - luma * 0.8);

        // reveal: the void dissolves in through cloudy noise (no hard cut)
        float n = vn(uv * vec2(uRes.x / uRes.y, 1.0) * 4.0) * 0.6 + vn(uv * 17.0) * 0.4;
        float r = smoothstep(n - 0.18, n + 0.18, uReveal * 1.36 - 0.18);
        c = mix(vec3(0.051, 0.067, 0.075) * 0.55, c, r);

        gl_FragColor = vec4(c, 1.0);
      }`,
  });
  const postScene = new THREE.Scene();
  postScene.add(new THREE.Mesh(quadGeo, postMat));

  // ---------- targets + resize
  let fogRT, sceneRT;
  function resize() {
    const dpr = Math.min(devicePixelRatio || 1, CFG.dpr);
    const w = innerWidth, hgt = innerHeight;
    renderer.setPixelRatio(dpr);
    renderer.setSize(w, hgt, false);
    const W = Math.floor(w * dpr), H = Math.floor(hgt * dpr);
    fogRT?.dispose(); sceneRT?.dispose();
    fogRT = new THREE.WebGLRenderTarget(Math.floor(W * CFG.fogScale), Math.floor(H * CFG.fogScale), { depthBuffer: false });
    sceneRT = new THREE.WebGLRenderTarget(W, H, { depthBuffer: false });
    fogMat.uniforms.uRes.value.set(W, H);
    postMat.uniforms.uRes.value.set(W, H);
    dustMat.uniforms.uPx.value = H;
    bgMat.uniforms.tFog.value = fogRT.texture;
    postMat.uniforms.tScene.value = sceneRT.texture;
    camera.aspect = w / hgt;
    camera.updateProjectionMatrix();
    readScroll();
  }
  addEventListener("resize", resize);
  resize();

  // ---------- loading: fonts + shader compile count toward 100
  loadTarget = 0.15;
  document.fonts.ready.then(() => { loadTarget = Math.max(loadTarget, 0.6); });
  setTimeout(() => {
    renderer.compile(fogScene, orthoCam);
    renderer.compile(scene, camera);
    renderer.compile(postScene, orthoCam);
    loadTarget = Math.max(loadTarget, 0.85);
    document.fonts.ready.then(() => { loadTarget = 1; });
  }, 0);

  let revealStart = 0;
  runLoader(() => {
    body.classList.add("is-ready");
    revealStart = performance.now();
  });

  // ---------- frame loop
  const clock = new THREE.Clock();
  function frame(now) {
    const dt = Math.min(clock.getDelta(), 0.05);
    state.time += dt;
    state.scroll += (state.scrollTarget - state.scroll) * (1 - Math.pow(1 - CFG.scrollDamp, dt * 60));
    const damp = 1 - Math.pow(1 - CFG.camera.damp, dt * 60);
    state.smx += (state.mx - state.smx) * damp;
    state.smy += (state.my - state.smy) * damp;

    const p = state.scroll;
    const k = smooth(CFG.tension.start, 1, p);
    const reveal = revealStart ? Math.min(1, (now - revealStart) / 2400) : 0;
    const easedReveal = 1 - Math.pow(1 - reveal, 3);

    // camera: damped mouse drift + dolly into the fog with scroll + tremor under tension
    const shake = k * k * 0.018;
    camera.position.set(
      state.smx * CFG.camera.mouse + Math.sin(state.time * 0.11) * 0.15 + (Math.random() - 0.5) * shake,
      -state.smy * CFG.camera.mouse * 0.6 + Math.cos(state.time * 0.09) * 0.1 + (Math.random() - 0.5) * shake,
      CFG.camera.z - p * CFG.camera.dolly,
    );
    camera.lookAt(state.smx * 0.25, -state.smy * 0.15, -12);
    camera.rotation.z = Math.sin(state.time * 0.07) * 0.012;

    fogMat.uniforms.uTime.value = state.time;
    fogMat.uniforms.uScroll.value = p;
    fogMat.uniforms.uCam.value.set(state.smx, -state.smy);
    fogMat.uniforms.uLight.value.set(0.64 + Math.sin(state.time * 0.045) * 0.07, 0.8 + Math.cos(state.time * 0.06) * 0.05);
    fogMat.uniforms.uTension.value = k;

    dustMat.uniforms.uTime.value = state.time;
    dustMat.uniforms.uFocus.value = CFG.focus.from + (CFG.focus.to - CFG.focus.from) * smooth(0, 0.45, p) - p * CFG.camera.dolly * 0.5;
    dustMat.uniforms.uAlpha.value = easedReveal;
    dustMat.uniforms.uAgitate.value = k;

    postMat.uniforms.uTime.value = state.time;
    postMat.uniforms.uReveal.value = easedReveal;
    postMat.uniforms.uTension.value = k;

    renderer.setRenderTarget(fogRT);
    renderer.clear();
    renderer.render(fogScene, orthoCam);
    renderer.setRenderTarget(sceneRT);
    renderer.clear();
    renderer.render(bgScene, orthoCam);
    renderer.render(scene, camera);
    renderer.setRenderTarget(null);
    renderer.render(postScene, orthoCam);

    if (body.classList.contains("is-ready")) updateDOM(p, now);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}
