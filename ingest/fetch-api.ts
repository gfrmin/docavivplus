// Fetch core resources from docaviv.co.il WordPress REST API.
// Writes raw JSON to ingest/raw/{films,programs,theaters,category_l1,category_l2}.json
import { mkdir, writeFile } from "node:fs/promises";
import { request } from "undici";

const API = "https://www.docaviv.co.il/wp-json/wp/v2";
const RAW_DIR = new URL("./raw/", import.meta.url);

type Json = unknown;

async function fetchAll(resource: string, perPage = 100): Promise<Json[]> {
  const out: Json[] = [];
  for (let page = 1; page < 20; page++) {
    const url = `${API}/${resource}?per_page=${perPage}&page=${page}`;
    const res = await request(url, { headers: { Accept: "application/json" } });
    if (res.statusCode === 400) break;
    if (res.statusCode !== 200) throw new Error(`${url} → ${res.statusCode}`);
    const body = (await res.body.json()) as Json[];
    out.push(...body);
    if (body.length < perPage) break;
  }
  return out;
}

async function main() {
  await mkdir(RAW_DIR, { recursive: true });
  const resources = ["films", "programs", "theaters", "category_l1", "category_l2", "director", "country", "language"] as const;

  for (const r of resources) {
    process.stdout.write(`fetch ${r}… `);
    const data = await fetchAll(r);
    await writeFile(new URL(`${r}.json`, RAW_DIR), JSON.stringify(data, null, 2));
    console.log(`${data.length} records`);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
