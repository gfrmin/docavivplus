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

// Hebrew day-of-week names
const HE_DAYS = ["יום א׳", "יום ב׳", "יום ג׳", "יום ד׳", "יום ה׳", "יום ו׳", "שבת"];
export function formatHebrewDate(iso: string): string {
  const d = new Date(iso);
  return `${HE_DAYS[d.getDay()]} ${d.getDate()}/${d.getMonth() + 1}`;
}
export function formatTime(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}
export function dayKey(iso: string): string { return iso.slice(0, 10); }

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

export function nextScreenings(limit = 8): Screening[] {
  const now = new Date().toISOString();
  return data.screenings
    .filter((s) => s.start >= now)
    .sort((a, b) => a.start.localeCompare(b.start))
    .slice(0, limit);
}

export function todayScreenings(): Screening[] {
  const today = new Date().toISOString().slice(0, 10);
  return data.screenings.filter((s) => s.start.startsWith(today)).sort((a, b) => a.start.localeCompare(b.start));
}
