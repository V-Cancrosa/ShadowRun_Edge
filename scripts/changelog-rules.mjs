/**
 * The changelog shown by segments: versions that were steps of one larger piece of work (data/changelog-groups.json)
 * read as one entry with a version range; every other version stands alone. Pure, used by the "What's new" window and
 * by tools/build_guide.mjs for the guide's history page.
 */

/** Entries of a version in a language: Polish, else English (falls back to Polish). */
export const changesOf = (version, lang) => (lang === "pl" ? version.changes : (version.changes_en ?? version.changes));

/**
 * @param {object[]} list    changelog entries, newest first
 * @param {object[]} groups  [{ id, pl, en, versions }]
 * @returns {{ title: string, versions: string, date: string, changes: string[] }[]} newest first
 */
export function segments(list, groups = [], lang = "pl") {
  const byVersion = new Map();
  for (const g of groups) for (const v of g.versions) byVersion.set(v, g);
  const out = [];
  const open = new Map();
  for (const entry of list) {
    const g = byVersion.get(entry.version);
    if (!g) {
      out.push({ title: entry.version, versions: entry.version, date: entry.date, changes: [...changesOf(entry, lang)] });
      continue;
    }
    let seg = open.get(g.id);
    if (!seg) {
      seg = { title: lang === "pl" ? g.pl : (g.en ?? g.pl), newest: entry.version, oldest: entry.version, date: entry.date, changes: [] };
      open.set(g.id, seg);
      out.push(seg);
    }
    seg.oldest = entry.version;
    seg.changes.push(...changesOf(entry, lang));
  }
  return out.map((s) => (s.newest ? { title: s.title, versions: s.newest === s.oldest ? s.newest : `${s.oldest}–${s.newest}`, date: s.date, changes: s.changes } : s));
}
