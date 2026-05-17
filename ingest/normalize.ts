// Merge raw API data + enriched HTML data into a single normalized JSON blob.
// Output: data/festival-2026.json
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import type { ScrapedFilm } from "./scrape-films.ts";

const RAW_DIR = new URL("./raw/", import.meta.url);
const ENRICHED_DIR = new URL("./enriched/", import.meta.url);
const OUT = new URL("../data/festival-2026.json", import.meta.url);
const OUT_DIR = new URL("../data/", import.meta.url);

interface ApiFilm { id: number; slug: string; title: { rendered: string }; modified: string; tags_l1?: number[]; category_l1?: number[]; category_l2?: number[]; }
interface ApiProgram { id: number; slug: string; title: { rendered: string }; date: string; theaters: number[]; modified: string; }
interface ApiTerm { id: number; name: string; slug: string; description?: string; }

export interface Venue { id: number; slug: string; nameHe: string; description?: string; }
export interface Topic { id: number; slug: string; nameHe: string; level: 1 | 2; }
export interface Screening {
  id: number;             // programId
  filmSlug: string | null;
  venueId: number | null;
  start: string;          // ISO local-time (no timezone shift)
  dateText: string;       // raw "29/5"
  infoText: string;       // raw info string from film page
  isPremiere: boolean;    // creators present
  ticketUrl: string | null;
}
export interface Film {
  slug: string;
  id: number;
  titleHe: string;
  titleEn: string;
  section: string;
  director: string;
  runtimeMin: number | null;
  countryHe: string;
  countryLanguageHe: string;
  synopsisHe: string;
  synopsisEn: string;
  posterUrl: string | null;
  trailerUrl: string | null;
  topicIds: number[];
  screeningIds: number[];
  url: string;
}
export interface FestivalData {
  edition: string;
  generatedAt: string;
  films: Film[];
  screenings: Screening[];
  venues: Venue[];
  topics: Topic[];
}

// Parse screening start from "29/5" + "יום ו׳ / 21:30 ...". Year is festival edition (2026).
function parseScreeningStart(dateText: string, infoText: string): string {
  const FESTIVAL_YEAR = 2026;
  const dm = dateText.match(/^(\d{1,2})\/(\d{1,2})/);
  if (!dm) return `${FESTIVAL_YEAR}-01-01T00:00:00`;
  const day = dm[1].padStart(2, "0");
  const month = dm[2].padStart(2, "0");
  const tm = infoText.match(/\b(\d{1,2}):(\d{2})\b/);
  const hh = tm ? tm[1].padStart(2, "0") : "00";
  const mm = tm ? tm[2] : "00";
  return `${FESTIVAL_YEAR}-${month}-${day}T${hh}:${mm}:00`;
}

function decodeEntities(s: string): string {
  return s
    .replace(/&#8211;/g, "–")
    .replace(/&#8212;/g, "—")
    .replace(/&#8217;/g, "’")
    .replace(/&#8216;/g, "‘")
    .replace(/&#8220;/g, "“")
    .replace(/&#8221;/g, "”")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)));
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });

  const films = JSON.parse(await readFile(new URL("films.json", RAW_DIR), "utf8")) as ApiFilm[];
  const programs = JSON.parse(await readFile(new URL("programs.json", RAW_DIR), "utf8")) as ApiProgram[];
  const theaters = JSON.parse(await readFile(new URL("theaters.json", RAW_DIR), "utf8")) as ApiTerm[];
  const cat1 = JSON.parse(await readFile(new URL("category_l1.json", RAW_DIR), "utf8")) as ApiTerm[];
  const cat2 = JSON.parse(await readFile(new URL("category_l2.json", RAW_DIR), "utf8")) as ApiTerm[];

  // Load all enriched film files keyed by slug
  const enrichedFiles = (await readdir(ENRICHED_DIR)).filter((f) => f.endsWith(".json"));
  const enrichedBySlug = new Map<string, ScrapedFilm>();
  for (const f of enrichedFiles) {
    const data = JSON.parse(await readFile(new URL(f, ENRICHED_DIR), "utf8")) as ScrapedFilm;
    enrichedBySlug.set(data.slug, data);
  }

  // Venues
  const venues: Venue[] = theaters.map((t) => ({
    id: t.id, slug: t.slug, nameHe: decodeEntities(t.name), description: t.description ? decodeEntities(t.description) : undefined,
  }));

  // Topics: cat1 (sections) + cat2 (subtopics)
  const topics: Topic[] = [
    ...cat1.map((t) => ({ id: t.id, slug: t.slug, nameHe: decodeEntities(t.name), level: 1 as const })),
    ...cat2.map((t) => ({ id: t.id, slug: t.slug, nameHe: decodeEntities(t.name), level: 2 as const })),
  ];

  // Build screening map from scraped data — primary source for film↔program linkage.
  // Each scraped film lists its own screenings (programId, dateText, infoText, ticketUrl).
  // Cross-reference with API /programs for canonical start time + theater.
  const programById = new Map<number, ApiProgram>(programs.map((p) => [p.id, p]));

  const screenings: Screening[] = [];
  const filmScreeningIds = new Map<string, number[]>();

  const decodeSlug = (s: string) => { try { return decodeURIComponent(s); } catch { return s; } };
  for (const ef of enrichedBySlug.values()) {
    const ids: number[] = [];
    const decodedSlug = decodeSlug(ef.slug);
    for (const s of ef.screenings) {
      const apiProg = programById.get(s.programId);
      const venueId = apiProg?.theaters?.[0] ?? null;
      const start = parseScreeningStart(s.dateText, s.infoText);
      const isPremiere = /בנוכחות/.test(s.infoText);
      screenings.push({
        id: s.programId,
        filmSlug: decodedSlug,
        venueId,
        start,
        dateText: s.dateText,
        infoText: s.infoText,
        isPremiere,
        ticketUrl: s.ticketUrl ?? null,
      });
      ids.push(s.programId);
    }
    filmScreeningIds.set(decodedSlug, ids);
  }

  // Normalize films. Decode percent-encoded Hebrew slugs so Astro can route them.
  const safeDecode = (s: string) => { try { return decodeURIComponent(s); } catch { return s; } };
  const outFilms: Film[] = [];
  for (const af of films) {
    const ef = enrichedBySlug.get(af.slug);
    if (!ef) continue;
    const slug = safeDecode(af.slug);
    outFilms.push({
      slug,
      id: af.id,
      titleHe: ef.titleHe || decodeEntities(af.title.rendered),
      titleEn: ef.titleEn,
      section: ef.section,
      director: ef.director,
      runtimeMin: ef.runtimeMin ?? null,
      countryHe: ef.countryHe,
      countryLanguageHe: ef.countryLanguageHe,
      synopsisHe: ef.synopsisHe,
      synopsisEn: ef.synopsisEn,
      posterUrl: ef.posterUrl ?? null,
      trailerUrl: ef.trailerUrl ?? null,
      topicIds: [...(af.category_l1 ?? []), ...(af.category_l2 ?? [])],
      screeningIds: filmScreeningIds.get(slug) ?? [],
      url: ef.url,
    });
  }

  const data: FestivalData = {
    edition: "2026",
    generatedAt: new Date().toISOString(),
    films: outFilms,
    screenings,
    venues,
    topics,
  };

  await writeFile(OUT, JSON.stringify(data));
  console.log(`wrote ${OUT.pathname}`);
  console.log(`  films=${outFilms.length}`);
  console.log(`  screenings=${screenings.length}`);
  console.log(`  films with ≥1 screening: ${outFilms.filter((f) => f.screeningIds.length).length}`);
  console.log(`  films with poster: ${outFilms.filter((f) => f.posterUrl).length}`);
  console.log(`  films with trailer: ${outFilms.filter((f) => f.trailerUrl).length}`);
  console.log(`  films with synopsis: ${outFilms.filter((f) => f.synopsisHe || f.synopsisEn).length}`);
  console.log(`  venues=${venues.length}, topics=${topics.length}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
