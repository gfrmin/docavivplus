# docaviv+

A faster, mobile-friendlier discovery frontend for [docaviv.co.il](https://www.docaviv.co.il) — the Tel Aviv International Documentary Film Festival.

The official site is unfortunately bad at search, filtering, and presenting a coherent schedule. This is a thin static mirror that:

- Pulls film + screening data from the festival's public WordPress REST API
- Scrapes each film's rendered page for the synopsis, runtime, director, trailer, and per-screening ticket links (none of which are exposed in the API)
- Joins screenings to films via the program IDs embedded in each film page's HTML
- Renders the result as a static, ~2.5 MB Astro site with client-side search and filtering

## Stack

- [Astro 4](https://astro.build) — static-site generation
- [cheerio](https://cheerio.js.org) — server-side HTML parsing during ingest
- [Fuse.js](https://fusejs.io) — client-side fuzzy search on `/films`
- [undici](https://undici.nodejs.org) — HTTP client for ingest

## Local development

```bash
npm install
npm run ingest      # fetch API + scrape 126 film pages (~30s)
npm run dev         # localhost:4321
npm run build       # → dist/
npm run preview     # serve dist/
```

The `data/festival-2026.json` blob is committed so `npm run build` works without re-ingesting. Run `npm run ingest` to refresh.

## Architecture

```
ingest/
  fetch-api.ts      WP REST  → ingest/raw/{films,programs,theaters,…}.json
  scrape-films.ts   for each film slug, fetch /films/<slug>/, cheerio-extract → ingest/enriched/<slug>.json
  normalize.ts      merge → data/festival-2026.json (single blob inlined by Vite)
  index.ts          orchestrator (fetch → scrape → normalize)

src/
  pages/index.astro            home (upcoming screenings + featured films)
  pages/films/index.astro      grid with search/filter (Fuse.js island)
  pages/films/[slug].astro     one page per film
  pages/schedule.astro         all screenings by day
  pages/venues/[slug].astro    per-venue screening list
  components/FilmCard.astro
  layouts/Layout.astro         RTL/LTR shell + language toggle
  data.ts                      data accessors & helpers
  styles/global.css

data/festival-2026.json        normalized festival data (~500 KB)
```

## Data sources

| What | Source | Notes |
|---|---|---|
| Film list, slugs, taxonomies | `wp/v2/films` | director/country/language taxonomies registered but never populated on film records |
| Program list (raw screenings) | `wp/v2/programs` | not linked to films via API; linkage recovered from HTML |
| Theaters | `wp/v2/theaters` | venue list |
| Title, synopsis (HE+EN), runtime, country, director, trailer | scraped from `/films/<slug>/` | Elementor-rendered, plain `curl` is enough |
| Screenings per film + ticket URLs | scraped from `/films/<slug>/` | program IDs embedded in `post-N` classes |

`robots.txt` allows scraping. No auth, no rate limiting, no Cloudflare gate. Bright Data is wired in as a fallback but unused in v1.

## Caveats / known limits

- ~20% of films have ISO 2-letter country codes (FR, NL, …) in the source instead of Hebrew names. `src/data.ts` includes a small mapping; extend it when new codes appear.
- Trailers are present for ~45% of films (the rest aren't in the source yet at festival start).
- English synopses are present where the festival provides them; UI falls back to Hebrew otherwise.
- Past editions (2024/2025) aren't exposed via the REST API. Out of scope for v1.

## Deploy

Build target is Cloudflare Pages. `dist/` is fully static — drop into any host.
