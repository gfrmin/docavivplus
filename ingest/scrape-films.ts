// For each film slug, fetch /films/<slug>/, extract metadata via cheerio,
// and write enriched/<slug>.json. Concurrency-limited, snapshots raw HTML for debug.
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { request } from "undici";
import * as cheerio from "cheerio";

const RAW_DIR = new URL("./raw/", import.meta.url);
const HTML_DIR = new URL("./raw/html/", import.meta.url);
const ENRICHED_DIR = new URL("./enriched/", import.meta.url);

const CONCURRENCY = 6;
const POLITE_DELAY_MS = 80;

export interface ScrapedFilm {
  slug: string;
  url: string;
  titleHe: string;
  titleEn: string;
  section: string;        // e.g. "פנורמה" / "Israeli Competition"
  director: string;
  runtimeMin?: number;
  countryHe: string;
  countryLanguageHe: string;
  synopsisHe: string;
  synopsisEn: string;
  posterUrl?: string;
  trailerUrl?: string;
  screenings: ScrapedScreening[];
}

export interface ScrapedScreening {
  programId: number;
  dateText: string;       // "29/5"
  infoText: string;       // "יום ו׳ / 21:30 אולם 3, סינמטק תל אביב בנוכחות היוצרים"
  ticketUrl?: string;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function fetchHtml(slug: string): Promise<string> {
  const url = `https://www.docaviv.co.il/films/${slug}/`;
  const res = await request(url, {
    headers: { "User-Agent": "docavivplus-scraper/0.1 (+contact: claude@gfrm.in)" },
  });
  if (res.statusCode !== 200) throw new Error(`${url} → ${res.statusCode}`);
  return await res.body.text();
}

export function extract(html: string, slug: string): ScrapedFilm {
  const $ = cheerio.load(html);
  $("script,style,noscript").remove();

  const url = `https://www.docaviv.co.il/films/${slug}/`;

  // Titles: first two .elementor-heading-title h-tags. Hebrew is #0, English is #1.
  const headings = $(".elementor-heading-title").map((_, el) => $(el).text().trim()).get();
  const titleHe = headings[0] ?? "";
  const titleEn = headings[1] ?? "";

  // Section name (competition / programme)
  const section = $(".film-competition-badge .comp-span-link").first().text().trim();

  // Director
  const director = $(".e-n-accordion-item .title-row").first().text().trim();

  // Poster from og:image
  // Note: cheerio strips <head> meta on script/style removal? No — meta tags survive.
  const posterUrl = $('meta[property="og:image"]').attr("content") || undefined;

  // Trailer: regex-search raw HTML for first YouTube/Vimeo ID
  let trailerUrl: string | undefined;
  const ytMatch = html.match(/(?:youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/watch\?v=)([A-Za-z0-9_-]{8,15})/);
  if (ytMatch) trailerUrl = `https://www.youtube.com/embed/${ytMatch[1]}`;
  else {
    const vMatch = html.match(/vimeo\.com\/(?:video\/)?(\d{6,12})/);
    if (vMatch) trailerUrl = `https://player.vimeo.com/video/${vMatch[1]}`;
  }

  // Text-editor blocks: scoped to the film-header card.
  // Strategy: collect text-editor texts in document order, but only those that appear
  // BEFORE the first "סרטים נוספים" / "More Films" heading marker.
  const moreFilmsMarker = "סרטים נוספים";
  let stop = false;
  const beforeMore: string[] = [];

  // Walk all relevant widgets in document order
  $(".elementor-widget-text-editor, .elementor-heading-title").each((_, el) => {
    if (stop) return;
    const text = $(el).text().trim().replace(/\s+/g, " ");
    if ($(el).hasClass("elementor-heading-title") && text === moreFilmsMarker) {
      stop = true;
      return;
    }
    if ($(el).hasClass("elementor-widget-text-editor") && text) {
      beforeMore.push(text);
    }
  });

  let runtimeMin: number | undefined;
  let countryHe = "";
  let countryLanguageHe = "";
  const synopsisCandidates: string[] = [];

  // Label blocks that show up between real metadata; ignore them.
  const LABELS = new Set([
    "ההקרנות הבאות", "במאי", "Director", "More Films", "סרטים נוספים",
    "לכרטיסים וזמני הקרנה", "לעמוד הסרט", "Film page", "Tickets",
  ]);

  for (const t of beforeMore) {
    if (LABELS.has(t)) continue;
    const rm = t.match(/^(\d{1,3})\s*דק/);
    if (rm) { runtimeMin ??= Number(rm[1]); continue; }
    if (t.length < 60) {
      if (t.includes(",")) { if (!countryLanguageHe) countryLanguageHe = t; }
      else if (!countryHe) countryHe = t;
      continue;
    }
    synopsisCandidates.push(t);
  }

  // Synopses: first long candidate that contains Hebrew chars is HE, first non-HE is EN.
  let synopsisHe = "";
  let synopsisEn = "";
  for (const s of synopsisCandidates) {
    const hasHebrew = /[֐-׿]/.test(s);
    if (hasHebrew && !synopsisHe) synopsisHe = s;
    else if (!hasHebrew && !synopsisEn) synopsisEn = s;
  }

  // Screenings
  const screenings: ScrapedScreening[] = [];
  $(".screening-box").each((_, box) => {
    const $box = $(box);
    const $loop = $box.closest('[data-elementor-type="loop-item"]');
    const cls = $loop.attr("class") || "";
    const m = cls.match(/\bpost-(\d+)\b/);
    if (!m) return;
    const programId = Number(m[1]);
    const dateText = $box.find(".date-part").text().trim().replace(/\s+/g, " ");
    const infoText = $box.find(".info-part").text().trim().replace(/\s+/g, " ");
    let ticketUrl: string | undefined;
    $loop.find("a[href]").each((_, a) => {
      const href = $(a).attr("href") || "";
      if (/presglobal|smarticket|leaan|eventim|tickchak|bimot/i.test(href)) {
        ticketUrl ??= href;
      }
    });
    screenings.push({ programId, dateText, infoText, ticketUrl });
  });

  return {
    slug, url, titleHe, titleEn, section, director,
    runtimeMin, countryHe, countryLanguageHe,
    synopsisHe, synopsisEn, posterUrl, trailerUrl, screenings,
  };
}

async function processOne(slug: string): Promise<{ slug: string; ok: boolean; error?: string }> {
  try {
    const html = await fetchHtml(slug);
    await writeFile(new URL(`${slug}.html`, HTML_DIR), html);
    const data = extract(html, slug);
    await writeFile(new URL(`${slug}.json`, ENRICHED_DIR), JSON.stringify(data, null, 2));
    return { slug, ok: true };
  } catch (e) {
    return { slug, ok: false, error: (e as Error).message };
  }
}

async function main() {
  await mkdir(HTML_DIR, { recursive: true });
  await mkdir(ENRICHED_DIR, { recursive: true });

  const films = JSON.parse(
    await readFile(new URL("films.json", RAW_DIR), "utf8"),
  ) as Array<{ slug: string }>;

  const slugs = films.map((f) => f.slug);
  console.log(`scraping ${slugs.length} film pages with concurrency=${CONCURRENCY}`);

  const queue = slugs.slice();
  const results: Array<{ slug: string; ok: boolean; error?: string }> = [];
  let done = 0;

  await Promise.all(
    Array.from({ length: CONCURRENCY }, async () => {
      while (queue.length) {
        const slug = queue.shift()!;
        const r = await processOne(slug);
        results.push(r);
        done++;
        if (done % 10 === 0 || !r.ok) {
          process.stdout.write(`  [${done}/${slugs.length}] ${r.ok ? "✓" : "✗"} ${slug}${r.error ? " — " + r.error : ""}\n`);
        }
        await sleep(POLITE_DELAY_MS);
      }
    }),
  );

  const failures = results.filter((r) => !r.ok);
  console.log(`done. success=${results.length - failures.length} fail=${failures.length}`);
  if (failures.length) console.log("failures:", failures.map((f) => `${f.slug}: ${f.error}`).join("\n"));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((e) => { console.error(e); process.exit(1); });
}
