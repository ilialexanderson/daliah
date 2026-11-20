# Hook preview (phases 1-5)

A standalone prototype to judge the feel of the hook before it is built into the site.
Not the production module: no flag, no GPU-tier detection yet.

    python3 -m http.server 4321 --directory prototypes/void   # then open http://localhost:4321

Scroll through it slowly (the hook is 10 screens long). `?p=0.6` jumps to a point in the hook.

What it shows:

1. **praznina**: 0-100 loader, the void dissolves in, DALIAH arrives letter by letter;
   the first scroll lifts it off into the fog and the tagline drifts in word by word.
2. **napetost**: glow, slight scale, 24 fps tremor in the text, the air and the camera.
3. **eksplozija**: the tagline's own pixels become ~22k particles (8k on phones); they hold
   the text for a beat, then blast out (flash, radial smear, shockwave in the dust, a boom
   if sound is on). Scrolling back rebuilds the text.
4. **haos**: the particles fly to 14 cards (real project images) tumbling in 3D with depth
   blur; the card images fade in under the particles.
5. **radovi**: the 6 grid cards settle into a grid (3x2 desktop, 2x3 phone), logo tile first
   (links to "o nama"); the extra frames fall back into the dark. HTML links and labels are
   placed over the projected cards.

Cursor layer (phases 4-5, off on touch): card tilt, camera parallax, a soft light on the
cards and a displacement push in the post pass. Values in `CFG.cursor`.

Look: purple void `#150b17`, fog tinted from `#642969`, lavender light, grain, no bloom.
Type switch A/B (press `t`). Reduced motion or no WebGL2: static text and a plain grid.

All tunable values are in `CFG` at the top of `void.js`. Fonts, images and three.js are
self-hosted (images in `media/`, resized copies from `content/projects`).
