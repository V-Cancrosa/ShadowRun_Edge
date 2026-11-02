/**
 * Builds the "Przewodnik Shadowrun Edge" Journal compendium from README.md (one page per "## " section, the
 * developer sections left out) and data/changelog.json (the version history page).
 *
 *   node tools/build_guide.mjs            writes JSON sources to packs/_source/przewodnik
 *   node tools/build_guide.mjs --pack     also compiles them into the LevelDB pack packs/przewodnik
 */
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SOURCE_DIR = join(ROOT, "packs/_source/przewodnik");
const PACK_DIR = join(ROOT, "packs/przewodnik");
const MODULE_ID = "shadowrun-edge";
const SKIP = ["Aktualizacja tłumaczenia", "Budowanie katalogu", "Wydanie nowej wersji"];

function stableId(key) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  return Array.from(createHash("sha256").update(key).digest().subarray(0, 16), (b) => alphabet[b % alphabet.length]).join("");
}

const escapeHTML = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** Inline Markdown: code, bold, italic, links. */
function inline(text) {
  return escapeHTML(text)
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/(^|[^*])\*([^*\s][^*]*)\*/g, "$1<em>$2</em>")
    .replace(/\[([^\]]+)\]\((https?:[^)]+)\)/g, '<a href="$2">$1</a>');
}

/** The Markdown README uses: paragraphs, "- " lists (with indented continuations), ### headings, tables, code fences. */
export function markdownToHtml(md) {
  const lines = md.split("\n");
  const out = [];
  let para = [];
  let list = null;
  const flushPara = () => {
    if (para.length) out.push(`<p>${inline(para.join(" "))}</p>`);
    para = [];
  };
  const flushList = () => {
    if (list) out.push(`<ul>${list.map((li) => `<li>${inline(li)}</li>`).join("")}</ul>`);
    list = null;
  };
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.startsWith("```")) {
      flushPara();
      flushList();
      const code = [];
      for (i++; i < lines.length && !lines[i].startsWith("```"); i++) code.push(lines[i]);
      out.push(`<pre><code>${escapeHTML(code.join("\n"))}</code></pre>`);
      continue;
    }
    if (/^###\s/.test(line)) {
      flushPara();
      flushList();
      out.push(`<h3>${inline(line.replace(/^###\s+/, ""))}</h3>`);
      continue;
    }
    if (/^\|/.test(line)) {
      flushPara();
      flushList();
      const rows = [];
      for (; i < lines.length && /^\|/.test(lines[i]); i++) rows.push(lines[i]);
      i--;
      const cells = (r) => r.replace(/^\||\|$/g, "").split("|").map((c) => c.trim());
      const [head, , ...body] = rows;
      out.push(`<table><thead><tr>${cells(head).map((c) => `<th>${inline(c)}</th>`).join("")}</tr></thead><tbody>${body
        .map((r) => `<tr>${cells(r).map((c) => `<td>${inline(c)}</td>`).join("")}</tr>`).join("")}</tbody></table>`);
      continue;
    }
    if (/^- /.test(line)) {
      flushPara();
      list ??= [];
      list.push(line.slice(2));
      continue;
    }
    if (list && /^\s{2,}\S/.test(line)) {
      list[list.length - 1] += ` ${line.trim()}`;
      continue;
    }
    if (!line.trim()) {
      flushPara();
      flushList();
      continue;
    }
    flushList();
    para.push(line.trim());
  }
  flushPara();
  flushList();
  return out.join("\n");
}

const readme = readFileSync(join(ROOT, "README.md"), "utf8");
const [intro, ...parts] = readme.split(/^## /m);
const sections = parts
  .map((p) => {
    const [title, ...rest] = p.split("\n");
    return { title: title.trim(), body: rest.join("\n") };
  })
  .filter((s) => !SKIP.some((k) => s.title.startsWith(k)));

const changelog = JSON.parse(readFileSync(join(ROOT, "data/changelog.json"), "utf8"));
const version = JSON.parse(readFileSync(join(ROOT, "module.json"), "utf8")).version;
const historyHtml = changelog
  .map((v) => `<h3>${v.version} <small>(${v.date})</small></h3><ul>${v.changes.map((c) => `<li>${escapeHTML(c)}</li>`).join("")}</ul>`)
  .join("\n");

const entryId = stableId("journal:przewodnik");
const introText = intro.replace(/^#\s.*$/m, "").trim();
const pages = [
  { name: "Shadowrun Edge", html: markdownToHtml(introText) + `<p><em>Wersja ${version}.</em></p>` },
  ...sections.map((s) => ({ name: s.title, html: markdownToHtml(s.body) })),
  { name: "Historia zmian", html: historyHtml },
].map((p, i) => {
  const _id = stableId(`page:${p.name}`);
  return {
    _id, _key: `!journal.pages!${entryId}.${_id}`, name: p.name, type: "text", sort: (i + 1) * 100000,
    title: { show: true, level: 1 }, text: { format: 1, content: p.html }, ownership: { default: -1 }, flags: {},
  };
});

const entry = {
  _id: entryId, _key: `!journal!${entryId}`, name: "Przewodnik Shadowrun Edge", pages, folder: null, sort: 0,
  ownership: { default: 2 }, flags: { [MODULE_ID]: { guide: version } },
};

rmSync(SOURCE_DIR, { recursive: true, force: true });
mkdirSync(SOURCE_DIR, { recursive: true });
writeFileSync(join(SOURCE_DIR, `Przewodnik_${entryId}.json`), JSON.stringify(entry, null, 2));
console.log(`guide: ${pages.length} pages -> ${SOURCE_DIR}`);

if (process.argv.includes("--pack")) {
  const { compilePack } = await import("@foundryvtt/foundryvtt-cli");
  rmSync(PACK_DIR, { recursive: true, force: true });
  await compilePack(SOURCE_DIR, PACK_DIR, { log: false });
  console.log(`guide: compiled -> ${PACK_DIR}`);
}
