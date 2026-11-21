---
version: 1
slug: "index-html"
primary_target: "index.html"
related_targets: ["style.css","app.js"]
---

Scope: public gallery page (`index.html`, `style.css`, `app.js`). Visitor mode: Experience. Build path: code-led (no image generation available); the user's reference screenshot of the hero (2026-11-22) is the critique reference.

Audience and job: friends and family opening Raveesha's shared link, mostly on phones, to look through her 21st birthday photos, open them full size, favourite and share.

Constraints: keep the element IDs Studio Admin and app.js rely on (`profile-avatar-img` follows the admin cover photo, `hero-cover-frame`, `hero-title`, the section IDs the nav links to); the sections below the hero keep their pink and white identity; Studio Admin shares `style.css`. Wording confirmed by the user on 2026-11-22: site name "Raveesha's 21st" at the top left, headline "Salt air, soft light.", no studio words (no bookings, packages or contact).

Unresolved: none.

## Direction contract

THESIS: The opening is a dark gallery wall for the shoot by the sea: one huge, quiet headline and four of her photos hung in a staggered row, so the photos are the first thing anyone remembers. It refuses the full-bleed cover with text over a scrim that the page had before.

OWN-WORLD: Near-black ground #0d0e10 owning the whole opening band, warm off-white ink #f3f1ec, warm grey #a9a7a2 for the intro, pale sea-blue #cfe3ec for the one italic word and the dot. Inter Tight 700 at display size with very tight tracking against Cormorant Garamond italic for "light."; Inter Tight for every label. Pills everywhere: a dark #1b1c1e nav capsule with an off-white active pill, hairline #2c2d30 outlines, an off-white primary pill carrying a dark circle with a drawn arrow. Photos in 30px-radius cards with frosted dark caption chips.

STORY: The visitor reads whose shoot this is, takes in the four photos, opens any of them full size, or follows "View gallery" into the photo grid, "Her story" to her note, and the nav to the reel. They can share the site from the top right.

FIRST VIEWPORT: Desktop, 1440 wide: name left, nav capsule centred, Share right, all on one line at the top. Below, left: the dot line "Birthday shoot by the sea", then "Salt air, / soft light." at about 137px across two lines. Right, level with the headline's last line: the two-line intro, then "View gallery" (primary) and "Her story". Under both, four bottom-aligned photo cards across the width, wide first, the second and fourth 48px taller, each numbered with its name; the fourth carries a round arrow to the gallery. Phones: name and Share, the nav capsule below, the headline at about a fifth of the screen width, the intro and both buttons, then the four cards as a swipeable row.

FORM: user-pinned reference (no roll): the hero follows the user's screenshot. Signature interaction: the photo row, each card opening its photo in the lightbox, swipeable on phones; the nav capsule stays at the top while scrolling and lights the section in view. Motion grammar: expo-out cubic-bezier(0.16,1,0.3,1); headline words rise out of their lines, the cards lift in left to right. seed: none (unavailable)

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
