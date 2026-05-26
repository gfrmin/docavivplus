// Single source of truth for festival data in the UI.
// At build time Astro inlines this JSON via Vite's JSON loader.
import raw from "../data/festival-2026.json";

export type { FestivalData, Film, Screening, Venue, Topic } from "../ingest/normalize.ts";

import type { FestivalData, Film, Screening, Venue, Topic } from "../ingest/normalize.ts";

export const data = raw as FestivalData;

export const filmBySlug: Map<string, Film> = new Map(data.films.map((f) => [f.slug, f]));
export const venueById: Map<number, Venue> = new Map(data.venues.map((v) => [v.id, v]));
export const screeningById: Map<number, Screening> = new Map(data.screenings.map((s) => [s.id, s]));

// Country code → Hebrew (extracted from source: ~20% of films have 2-letter ISO codes
// instead of proper Hebrew names, e.g. "CA" instead of "קנדה")
const COUNTRY_MAP: Record<string, string> = {
  AT: "אוסטריה", BE: "בלגיה", CA: "קנדה", EE: "אסטוניה", FR: "צרפת",
  IT: "איטליה", NL: "הולנד", NO: "נורווגיה", PL: "פולין",
  Greece: "יוון", Lithuania: "ליטא",
  // Source has a misspelling of Ukraine (אוקריאנה → אוקראינה); normalise for display.
  "אוקריאנה": "אוקראינה",
};
const COUNTRY_EN_MAP: Record<string, string> = {
  AT: "Austria", BE: "Belgium", CA: "Canada", EE: "Estonia", FR: "France",
  IT: "Italy", NL: "Netherlands", NO: "Norway", PL: "Poland", Greece: "Greece", Lithuania: "Lithuania",
  "ישראל": "Israel", "ארצות הברית": "United States", "גרמניה": "Germany",
  "בריטניה": "United Kingdom", "ספרד": "Spain", "אוקריאנה": "Ukraine",
};

export function countryHe(raw: string): string {
  if (!raw) return "";
  return COUNTRY_MAP[raw] ?? raw;
}
export function countryEn(raw: string): string {
  if (!raw) return "";
  return COUNTRY_EN_MAP[raw] ?? raw;
}

// Festival sections (competitions / programmes) — source has Hebrew only.
const SECTION_EN_MAP: Record<string, string> = {
  "פנורמה": "Panorama",
  "תחרות בינלאומית": "International Competition",
  "תחרות ישראלית": "Israeli Competition",
  "תחרות סטודנטים": "Student Competition",
  "תחרות קצרים": "Short Film Competition",
  "תחרות מעבר למסך": "Beyond the Screen Competition",
  "תחרות היילייטס דוקומנטריים בשיתוף Schweppes": "Documentary Highlights (Schweppes)",
  "מאסטרים": "Masters",
  "מוזיקה": "Music",
  "רטרוספקטיבה לורנר הרצוג": "Werner Herzog Retrospective",
  "רטרופקטיבה לרם לוי": "Ram Loevy Retrospective",
  "אורחים לרגע | מבטים תיעודיים על ארץ מדומיינת": "Brief Encounters | Documentary Glimpses",
  "אמנות ותרבות בחסות יובלים סיטיבוי": "Art & Culture",
};
export function sectionEn(raw: string): string {
  if (!raw) return "";
  return SECTION_EN_MAP[raw] ?? raw;
}

// Venue display names. The source `nameHe` is actually English/transliterated and
// often carries an internal hall-code prefix ("CIN3 - …"). Provide proper bilingual
// names for the known venues; fall back to the source string with the code stripped.
const VENUE_HE: Record<string, string> = {
  "Beit Ziyonei America": "בית ציוני אמריקה",
  "CIN1 - Tel Aviv Cinematheque - Hall 1": "סינמטק תל אביב · אולם 1",
  "CIN2 - Tel Aviv Cinematheque - Hall 2": "סינמטק תל אביב · אולם 2",
  "CIN3 - Tel Aviv Cinematheque - Hall 3": "סינמטק תל אביב · אולם 3",
  "CIN4 - Tel Aviv Cinematheque - Hall 4": "סינמטק תל אביב · אולם 4",
  "CIN5 - Tel Aviv Cinematheque - Hall 5": "סינמטק תל אביב · אולם 5",
  "Tel Aviv Cinematheque - Hall 6": "סינמטק תל אביב · אולם 6",
  "Tel Aviv Cinematheque Plaza": "רחבת הסינמטק",
  "Tel Aviv Museum - Assia Auditorium": "מוזיאון תל אביב · אולם אסיה",
  "Suzanne Dellal Centre for Dance and Theatre": "מרכז סוזן דלל",
  "Gan Hapisga": "גן הפסגה",
  "Herzel 107": "הרצל 107",
  "Migdalor": "מגדלור",
  "Mitzpor": "מצפור",
  "Teder": "טדר",
  "Tamra Davis": "תמרה דייוויס",
};
const VENUE_EN: Record<string, string> = {
  "CIN1 - Tel Aviv Cinematheque - Hall 1": "Tel Aviv Cinematheque · Hall 1",
  "CIN2 - Tel Aviv Cinematheque - Hall 2": "Tel Aviv Cinematheque · Hall 2",
  "CIN3 - Tel Aviv Cinematheque - Hall 3": "Tel Aviv Cinematheque · Hall 3",
  "CIN4 - Tel Aviv Cinematheque - Hall 4": "Tel Aviv Cinematheque · Hall 4",
  "CIN5 - Tel Aviv Cinematheque - Hall 5": "Tel Aviv Cinematheque · Hall 5",
  "Tel Aviv Cinematheque - Hall 6": "Tel Aviv Cinematheque · Hall 6",
  "Tel Aviv Museum - Assia Auditorium": "Tel Aviv Museum · Assia Auditorium",
  "Suzanne Dellal Centre for Dance and Theatre": "Suzanne Dellal Centre",
  "Beit Ziyonei America": "Beit Zionei America",
  "דרמה": "Drama",
};
function cleanVenue(raw: string): string {
  return raw.replace(/^CIN\d+\s*-\s*/, "").trim();
}
export function venueNameHe(raw: string): string {
  if (!raw) return "";
  return VENUE_HE[raw] ?? cleanVenue(raw);
}
export function venueNameEn(raw: string): string {
  if (!raw) return "";
  return VENUE_EN[raw] ?? cleanVenue(raw);
}

// Hebrew day-of-week names
const HE_DAYS = ["יום א׳", "יום ב׳", "יום ג׳", "יום ד׳", "יום ה׳", "יום ו׳", "שבת"];
const EN_DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
export function formatHebrewDate(iso: string): string {
  const d = new Date(iso);
  return `${HE_DAYS[d.getDay()]} ${d.getDate()}/${d.getMonth() + 1}`;
}
export function formatEnDate(iso: string): string {
  const d = new Date(iso);
  return `${EN_DAYS[d.getDay()]} ${d.getDate()}/${d.getMonth() + 1}`;
}
export function formatTime(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}
export function dayKey(iso: string): string { return iso.slice(0, 10); }

// "now" as a naive Asia/Jerusalem wall-clock string (YYYY-MM-DDTHH:mm:ss), matching
// the offsetless `start` timestamps so string comparison stays apples-to-apples.
// `new Date().toISOString()` would be UTC and skew the "upcoming" cutoff by the
// Israel offset (2–3h), leaving screenings flagged "upcoming" after they've started.
export function israelNow(): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jerusalem",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date());
  const v = (t: string) => parts.find((p) => p.type === t)!.value;
  return `${v("year")}-${v("month")}-${v("day")}T${v("hour")}:${v("minute")}:${v("second")}`;
}

export function screeningsByDay(): Map<string, Screening[]> {
  const m = new Map<string, Screening[]>();
  for (const s of [...data.screenings].sort((a, b) => a.start.localeCompare(b.start))) {
    const k = dayKey(s.start);
    if (!m.has(k)) m.set(k, []);
    m.get(k)!.push(s);
  }
  return m;
}

export function filmsByVenue(venueId: number): Set<string> {
  const slugs = new Set<string>();
  for (const s of data.screenings) {
    if (s.venueId === venueId && s.filmSlug) slugs.add(s.filmSlug);
  }
  return slugs;
}

export function filmsBySection(): Map<string, Film[]> {
  const m = new Map<string, Film[]>();
  for (const f of data.films) {
    const key = f.section || "אחר";
    if (!m.has(key)) m.set(key, []);
    m.get(key)!.push(f);
  }
  return m;
}

// The festival site uses a single fallback image for every film that hasn't
// uploaded its own poster. Treat that URL as "no poster" so the UI can render
// a typographic placeholder instead of 50 identical logos.
export const PLACEHOLDER_POSTER_URL = "https://www.docaviv.co.il/wp-content/uploads/2026/05/DOCAVIV-Main-Slide-1-scaled.png";
export function hasRealPoster(film: Film): boolean {
  return !!film.posterUrl && film.posterUrl !== PLACEHOLDER_POSTER_URL;
}

// Deterministic hue per section for the typographic poster fallback.
// Unknown sections still get a stable colour without a hard-coded mapping.
export function sectionHue(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return (h >>> 0) % 360;
}

export function nextScreeningForFilm(film: Film, nowIso: string = israelNow()): Screening | undefined {
  const list = film.screeningIds
    .map((id) => screeningById.get(id))
    .filter((s): s is Screening => Boolean(s))
    .sort((a, b) => a.start.localeCompare(b.start));
  return list.find((s) => s.start >= nowIso) ?? list[0];
}

export function nextScreenings(limit = 8): Screening[] {
  const now = israelNow();
  return data.screenings
    .filter((s) => s.start >= now)
    .sort((a, b) => a.start.localeCompare(b.start))
    .slice(0, limit);
}

export function todayScreenings(): Screening[] {
  const today = israelNow().slice(0, 10);
  return data.screenings.filter((s) => s.start.startsWith(today)).sort((a, b) => a.start.localeCompare(b.start));
}
