# OFF TRACKS Â· Reel 07 â€” 3D Immersive Cars Landing Page

A cinematic, scroll-driven, 3D immersive landing page in the spirit of **OFF TRACKS** ("curated rare finds. driven obsessions."), shot as a film reel and rendered live in WebGL with the included car GLB / glTF models.

> Built with Next.js 15 (App Router) + React Three Fiber + drei + postprocessing + Lenis smooth-scroll, deploy-ready on Vercel.

## âœ¦ The reel

The page is structured as a film with **acts**, driven by scroll position:

| Act | Beat | Subject |
|-----|------|---------|
| 00  | Title sequence | OFF TRACKS â€” Reel 07 |
| 01  | Mercedes W13 (silver arrows, low-key) |
| 02  | Ferrari F40 (twin-turbo, naked carbon) |
| 03  | McLaren MP4 (papaya streak) |
| 04  | Porsche 911 RWB (Nakai-san hand-carved) |
| 05  | Ferrari SF90 / F1 2019 (scarlet, screaming) |
| 06  | Formula Apex (no livery, no country) |
| 07  | End credits + access form |

Each act has its own:

- camera "beat" (entrance + reveal positions, eased with smoothstep)
- per-car lighting palette (key + rim + fill)
- ground tint
- copy block (director's notes)
- meta strip (origin, era, class)

## âœ¦ Cinematic effects

- Bloom (specular highlights blown out like a film print)
- Chromatic aberration (subtle 70mm prism fringe)
- Depth of field (focus pull on hero car)
- Vignette + film grain (SVG turbulence overlay)
- Scanlines + letterbox bars
- Custom blend cursor with magnetic ring
- Scroll-driven FOV breathing + handheld micro-shake
- ACES filmic tonemapping
- Lenis smooth-scroll
- Auto-degrading DPR (drei `PerformanceMonitor`) for mobile

## âœ¦ Local dev

```bash
npm install
npm run dev      # http://localhost:3000
npm run build && npm start
```

## âœ¦ Deploy on Vercel

Two ways:

### Option A â€” Git
1. Push this repo to GitHub (already connected: `ritesh-kumar289/cars-landing-page`).
2. Go to [vercel.com/new](https://vercel.com/new), pick the repo, accept defaults â€” Next.js is auto-detected via `vercel.json`.
3. Click **Deploy**.

### Option B â€” CLI
```bash
npm i -g vercel
vercel       # link/create project
vercel --prod
```

That's it â€” no env vars required.

## âœ¦ Project layout

```
app/
  layout.tsx
  page.tsx
  globals.css
  components/
    CarScene.tsx     # the 3D film â€” Director, ActiveCar, Stage, Effects
    Sections.tsx     # HTML overlay acts (hero, cars, credits)
    HUD.tsx          # top nav, side rail, timecode, progress
    Loader.tsx       # OFF TRACKS title-card preloader
    CustomCursor.tsx # magnetic dot + ring (mix-blend-difference)
    Marquee.tsx
  lib/
    cars.ts          # car + act data, palettes, copy
    scroll.tsx       # Lenis-driven scroll context
public/models/
  f1_mercedes_w13_concept.glb
  formula_1_generico_2.glb
  mclaren_mp45__formula_1.glb
  porsche_911_rauh-welt_free.glb
  ferrari_f1_2019/scene.gltf  (+ scene.bin, textures/)
  ferrari_f40/scene.gltf      (+ scene.bin)
```

## âœ¦ Performance notes

The total weight of the 3D models is ~70 MB. On first load:
- Loader title-card hides this behind a progress animation.
- All models are preloaded once via `useGLTF.preload`.
- Scene auto-fits each model to a unit height so individual GLB scales don't matter.
- DPR auto-throttles 1.0â€“2.0 based on FPS; heavy effects (DOF) skip on low DPR.
- `prefers-reduced-motion` disables postprocessing.

If you serve from a slow region, consider hosting the GLBs on a CDN or running them through `gltf-pipeline -d -t` for Draco + texture compression.

## âœ¦ Credits

3D models are bundled by the repo owner and remain under their original Sketchfab licenses (see `license.txt` inside each model folder). All UI/code in this repo is original work for the OFF TRACKS reel.


