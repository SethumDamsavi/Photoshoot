---
version: 1
slug: "index-html"
primary_target: "index.html"
related_targets: []
---

Scope: public gallery page (`index.html`, `site.css`, `app.js`, `motion.js`, `coverflow.js`). Visitor mode: Experience. Build path: code-led (no image generation available).

Audience and job: friends and family opening Raveesha's shared link, mostly on phones, to look through her 21st birthday photos, open them full-screen, favorite and share.

Constraints: keep every element ID Studio Admin and app.js sync rely on; keep `style.css` untouched for admin; pink and white identity pinned by the user; user picked 3D coverflow carousel, morphing ring cursor, modern editorial grid (2026-11-08). Kexsio reference links could not be opened; the user confirmed these choices instead.

## Direction contract

THESIS: The site is Raveesha's "Chapter 21" birthday issue: a pink-and-white fashion-magazine special edition where her photos lead and the type and motion move around them. It refuses the centred-headline-over-card-row template and the old scrapbook clutter (washi tape, pins, watercolour wash, typewriter quotes).

OWN-WORLD: Blush ground #f9dde6 owning whole sections, porcelain white #fff8fa panels, berry ink #3b0f24, peony #d23f6c for actions, one berry-drenched stage for the coverflow, a peony marquee band. Display: Bodoni Moda (fashion masthead Didone) with italic turns; labels and UI: Jost (cover-line geometric sans, tracked caps). A giant outlined "21" is the issue's mark. Watercolour rose sprays are the only ornament. Photos at 20px radius, pill controls, authored 1.75-stroke SVG icons.

STORY: The visitor sees her cover portrait and name at once, scrolls into an editorial grid of her photos, filters albums, opens any photo full-screen, reads her note, flips through highlights on the coverflow, and favorites or shares a moment.

FIRST VIEWPORT: Desktop: left 55%, "Raveesha's" and an italic "21st Birthday Shoot" at masthead scale, the subtitle, the curator statement, primary action "Explore the photos" and a secondary "Her story". Right 45%: the arch-topped cover portrait with a giant outlined "21" behind it, a rose spray at its foot, a slowly rotating circular "Chapter 21" seal on its edge, the plaque line beneath. Mobile: name, then portrait, then actions.

FORM: User-pinned direction (no roll): modern pink and white, 3D coverflow, morphing ring cursor, editorial grid. Signature interaction: the berry-stage coverflow, dragged with inertia while the cursor becomes "Drag". Focal moment: the cover opening, a peony curtain with "21" lifting to unmask the portrait. Motion grammar: expo-out cubic-bezier(0.16,1,0.3,1); clip-path unmasking for photos; line-rise for headings. seed: none (unavailable)

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
