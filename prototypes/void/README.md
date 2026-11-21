# Hook preview (phases 1-5)

A standalone prototype to judge the feel of the hook before it is built into the site.
Not the production module: no flag, no GPU-tier detection yet.

    python3 -m http.server 4321 --directory prototypes/void   # then open http://localhost:4321

Scroll through it slowly (the hook is 5 screens long). `?p=0.6` jumps to a point in the hook.

What it shows:

1. **praznina**: 0-100 loader, the void dissolves in, the DALIAH wordmark (letters from the
   logo) arrives letter by letter; the first scroll lifts it off into the fog and the tagline
   drifts in word by word.
2. **napetost**: glow, slight scale, 24 fps tremor in the text, the air and the camera.
3. **eksplozija**: the tagline's own pixels become ~22k particles (8k on phones); they hold
   the text for a beat, then burst (flash, smear, a boom if sound is on).
4. **radovi**: from here it runs on time, not scroll. The particles fly straight into the
   grid and build the 6 cards one after another; each card's image appears only where its
   particles have landed. All cards are built about 2.3 s after the blast. Logo tile first
   (links to "o nama"); HTML links and labels sit over the projected cards.
   Scrolling back above the explosion rebuilds the text.

Cursor layer (grid only, off on touch): card tilt, camera parallax, a soft light on the
cards and a displacement push in the post pass. Values in `CFG.cursor`.

Look: purple void `#150b17`, fog tinted from `#642969`, lavender light, grain, no bloom.
Type: Plus Jakarta Sans, with Cormorant Garamond italic for the highlight word ("mirišu"),
IBM Plex Mono for the chrome. Reduced motion or no WebGL2: static text and a plain grid.

Review aid: `__hook.paused = true; __hook.step(frames)` in the console steps the animation.

All tunable values are in `CFG` at the top of `void.js`. Fonts, images and three.js are
self-hosted (images in `media/`, resized copies from `content/projects`).
