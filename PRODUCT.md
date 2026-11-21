# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- **Visitors:** Raveesha's friends and family, opening a shared link, mostly on phones, to look through the photos from her 21st birthday shoot, open them full size, favourite them and share them. (The owner confirmed on 2026-11-22 that the site is for Raveesha's birthday, not a studio.)
- **The owner:** runs Studio Admin (`/admin`) to add, edit and remove photos and to set the cover photo, the story photo and the story text.

## Product Purpose

One place for the photos from Raveesha's 21st birthday shoot ("Chapter 21"): a public gallery of the shoot plus a short story in her words. Success is a visitor finding the photos straight away, opening them full size and sharing the ones they love.

## Positioning

A personal birthday photo site, not a photography business. It takes no bookings and shows no packages, prices or contact forms (confirmed 2026-11-22).

## Operating Context

- Shared by link; live at https://photoshoot-six.vercel.app (Vercel, deployed by pushing `main`).
- Live photos and settings are kept in Upstash Redis; the files in `data/` and `default-data.js` are only seeds and the offline fallback.
- Photos added on the owner's computer (files in `uploads/`) reach the live site on the next push.

## Capabilities and Constraints

- Gallery with optional albums and optional titles, search and sort, a full-size lightbox, favourites, share links for single photos, a story section and a moving photo reel.
- Studio Admin has one sign-in, chosen on `/admin` (or set by environment variables). The repository is public: credentials never go in it.
- Photo titles and albums stay optional.

## Brand Commitments

- The site's name is "Raveesha's 21st" (shown at the top left, confirmed 2026-11-22). "Chapter 21" is used across the site. Page title: "Raveesha's 21st Birthday Shoot | Chapter 21".

## Evidence on Hand

- 55 photos from the shoot by the sea (`uploads/DSC*.jpg`): white off-shoulder top and skirt, a bouquet of white flowers, pearls in her hair, a beach with palms and a hillside hotel.
- No testimonials, press, photographer credit or confirmed shoot date are on hand. Do not invent them.

## Product Principles

- Her photos lead; everything else frames them.
- Personal and warm, never commercial.
- Phones first: most visitors arrive on a phone from a shared link.
- The owner changes photos and words in Studio Admin, without touching code.
