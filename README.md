# The Birthday Archive — Editorial Monograph & Photo Gallery

A modern, high-performance birthday photoshoot album and living photo gallery powered by an **integrated, zero-dependency backend** with an administrative studio panel at `/admin`.

**Zero WordPress, zero LocalWP, zero external database setup, and ZERO pricing or commerce jargon.** Everything runs natively in Node.js, storing photoshoot albums and milestone portraits cleanly in `data/`.

---

## 👑 Studio Admin Sign-in

The admin account is set with private environment variables, never in this repository (it is public):

- `ADMIN_USERNAME`: the name typed in the Username box
- `ADMIN_PASSWORD`: any length; without it, nobody can sign in
- `ADMIN_TOKEN_SECRET` (optional): a long random string used to sign sessions

**Live site:** add them in Vercel → the project → Settings → Environment Variables, then redeploy.
**This computer:** copy `.env.example` to `.env.local` and fill it in (git ignores `.env.local`).

A sign-in lasts until the browser tab is closed (at most 8 hours). Changing the password signs everyone out.

---

## 🔌 Integrated Backend Architecture

- **Backend API Endpoints:**
  - `POST /api/auth/login` — Checks the admin sign-in from the environment variables and returns a signed 8-hour session token.
  - `GET /api/auth/me` — Verifies active admin session.
  - `POST /api/auth/logout` — Destroys current session.
  - `GET /api/products` (alias `GET /api/photos`) — Fetches birthday photoshoot moments with search, album filtering, and sorting (`newest`, `featured`, `oldest`, `title`).
  - `GET /api/products/:id` — Fetches single photo details.
  - `POST /api/products` — Admin-authenticated photo upload & moment creation (title, album, shot date, location, story caption, technical camera/lens specs, featured cover toggle). **Zero pricing!**
  - `PUT /api/products/:id` — Admin-authenticated update of photos and metadata.
  - `DELETE /api/products/:id` — Admin-authenticated deletion of photos.
  - `GET /api/categories` — Fetches photo albums with live photo count badges.
  - `POST /api/categories` — Admin-authenticated album creation.
  - `DELETE /api/categories/:id` — Admin-authenticated album deletion.
  - `POST /api/upload` — Admin-authenticated photo upload (saves directly to `uploads/`).

- **Data Persistence:**
  - `data/products.json` — Birthday photoshoot moments and captions.
  - `data/categories.json` — Photo albums taxonomy.
  - `uploads/` — Uploaded photo image files.

---

## ✨ Features

1. **Dedicated Birthday Shoot Photo Gallery**:
   - Zero pricing, zero shopping carts, zero commerce.
   - Preserves milestone portraits, golden hour silhouettes, cake cutting rituals, and candid celebration memories.

2. **Full-Featured `/admin` Studio**:
   - Secure login screen styled in the **Pink & White** couture aesthetic.
   - Quick statistics cards: Total Photos, Photo Albums, Featured Milestones, and Shoot Locations.
   - Photos table with preview thumbnails, title, album collection, date, location, and status.
   - Add/Edit Photo modal with drag-and-drop file uploader, instant preview, shot details builder (Camera, Lens, Lighting, Mood), and cover highlight toggle.

3. **Live Public Gallery (`/`)**:
   - Editorial Monograph Hero celebrating the milestone chapter.
   - Dynamic album filter tabs ("All Moments", "Hearted Memories", "Portraits", "Golden Hour", "Cake & Wishes", etc.).
   - Interactive Lightbox with high-res photo viewing, story narratives, and technical camera specs.
   - Masonry and Uniform Grid layout toggles.
   - Favorites / Hearting system with local persistence.

4. **Curated Pink & White Luxury Aesthetic**:
   - Soft porcelain rosewater canvas (`#fff8fa`), French Peony accents (`#de4b75`), warm silk card surfaces, and Cormorant Garamond typography.

---

## 🚀 How to Run

```bash
# Option 1: Development Server (Vite)
npm run dev

# Option 2: Standalone Node Server
npm start
# or
node server.js
```

Then visit:
- **Public Gallery:** [http://localhost:5173/](http://localhost:5173/)
- **Studio Admin:** [http://localhost:5173/admin](http://localhost:5173/admin)
