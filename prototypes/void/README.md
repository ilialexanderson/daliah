# Void preview (hook phase 1, plus the start of phase 2)

A standalone prototype to judge the feel of the void before the hook is built into the site.
Not the production module: no flag, no GPU-tier detection yet.

    python3 -m http.server 4321 --directory prototypes/void   # then open http://localhost:4321

What it shows:

- 0-100 loader ending on "spremno.", then the void dissolves in through noise (no hard cut)
- half-res volumetric fog: three drifting sheets with domain warp, a wandering light behind,
  god rays occluded by the fog
- ~28k dust points (10k on phones) with depth of field: in-focus specks, out-of-focus bokeh,
  rack focus as the text arrives
- film grain, vignette, no bloom; palette colours never used here
- damped camera drift on the mouse, dolly into the fog on scroll
- tagline fades in word by word out of blur; last 20% of the scroll is "napetost": glow,
  slight scale, 24 fps tremor in the text, the air and the camera
- hairline chrome, chapter labels (praznina -> napetost), skip link, progress, sound toggle
  (generated drone, off by default)
- type switch A/B (press `t`): Newsreader + IBM Plex Mono, or Geist + Geist Mono
- prefers-reduced-motion or no WebGL2: static fog gradient and the full text

All tunable values are in `CFG` at the top of `void.js`. Fonts and three.js are self-hosted.
