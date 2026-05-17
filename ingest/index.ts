// Orchestrator: fetch API → scrape film pages → normalize.
import { spawnSync } from "node:child_process";

const steps = ["fetch-api.ts", "scrape-films.ts", "normalize.ts"];

for (const step of steps) {
  console.log(`\n=== ${step} ===`);
  const r = spawnSync("tsx", [`ingest/${step}`], { stdio: "inherit" });
  if (r.status !== 0) {
    console.error(`step ${step} failed (status ${r.status})`);
    process.exit(r.status ?? 1);
  }
}
console.log("\n=== ingest complete ===");
