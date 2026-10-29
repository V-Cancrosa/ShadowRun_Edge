// Every literal "SRE.*" key used in scripts and templates exists in both languages. Run: node tools/test_lang.mjs
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname;
const files = (dir) => readdirSync(dir).flatMap((f) => {
  const p = join(dir, f);
  return statSync(p).isDirectory() ? files(p) : /\.(mjs|hbs)$/.test(f) ? [p] : [];
});
const used = new Set();
for (const f of [...files(join(ROOT, "scripts")), ...files(join(ROOT, "templates"))]) {
  for (const m of readFileSync(f, "utf8").matchAll(/["'`](SRE\.[A-Za-z0-9_.]+)(?=["'`])/g)) {
    if (!m[1].endsWith(".")) used.add(m[1]);
  }
}
let missing = [];
for (const lang of ["pl", "en"]) {
  const data = JSON.parse(readFileSync(join(ROOT, `lang/${lang}/shadowrun-edge.json`), "utf8"));
  for (const key of used) {
    const v = key.split(".").reduce((o, k) => o?.[k], data);
    if (typeof v !== "string") missing.push(`${lang}: ${key}`);
  }
}
if (missing.length) {
  console.error(missing.join("\n"));
  process.exit(1);
}
console.log(`lang OK (${used.size} keys)`);
