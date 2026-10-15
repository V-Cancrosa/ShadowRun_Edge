/**
 * Reads one row copied from a rulebook table (e.g. "Ares Predator VI 3P SA/BF 10/10/8/—/— 15(c) 2(L) 750¥")
 * and splits it into wizard fields. Pure functions without Foundry dependencies, so they can be tested in Node.
 */

const DASH = "—";

// Token patterns in priority order. Each is matched at the current position (sticky).
const TOKEN_PATTERNS = [
  // Attack ratings: three to five values separated by "/", e.g. 10/10/8/—/—
  ["ar", /(?:\d+|—)(?:\s*\/\s*(?:\d+|—)){2,4}(?=\s|$)/y],
  // Two values separated by "/", e.g. Attack/Sleaze 4/3 or Data Processing/Firewall 1/1
  ["pair", /\d+\s*\/\s*\d+(?=\s|$)/y],
  // Firing modes, e.g. SA/BF or SS, SA
  ["modes", /(?:SS|SA|BF|FA)(?:\s*[\/,]\s*(?:SS|SA|BF|FA))*(?=[\s,]|$)/y],
  // Damage value, e.g. 3P, 4S(e)
  ["dv", /\d+\s*[PS](?:\s*\(e\))?(?=\s|$)/y],
  // Ammo with the loading type, e.g. 15(c), 100(belt)
  ["ammo", /\d+\s*\((?:c|m|b|cy|d|ml|belt|s)\)(?=\s|$)/iy],
  // Availability with legality, e.g. 2(L), R+2(I)
  ["avail", /(?:\d+|R(?:[*+]\d+(?:\.\d+)?)?)\s*\(\s*[LI]\s*\)(?=\s|$)/y],
  // Cost in nuyen, e.g. 750¥, R*2000¥
  ["price", /(?:R\*)?\d+(?:\.\d+)?\s*(?:¥|nuyen\b)/iy],
  // Value depending on the rating, e.g. R*0.1
  ["expr", /R(?:\s*[*+\-]\s*\d+(?:\.\d+)?)?(?=\s|$)/y],
  ["number", /[+\-]?\d+(?:\.\d+)?(?=\s|$)/y],
  ["dash", /—(?=\s|$)/y],
  ["word", /\S+/y],
];

const VALUE_KINDS = new Set(["expr", "number", "dash"]);

/** Unifies dashes, decimal commas, thousands separators and "Rating x n" before tokenizing. */
export function normalize(text) {
  return String(text ?? "")
    .replace(/[‒–—―−]/g, DASH)
    .replace(/(?<=\s|^)-(?=\s|$|\/)|(?<=\/)-/g, DASH)
    .replace(/(?:Rating|Stopień|Stopien)\s*[x×*]\s*/gi, "R*")
    .replace(/\bR\s*[x×]\s*/g, "R*")
    .replace(/(\d)[,\u00a0\u202f](?=\d{3}(?!\d))/g, "$1")
    .replace(/(\d),(\d)/g, "$1.$2")
    .replace(/\s+/g, " ")
    .trim();
}

export function tokenize(text) {
  const src = normalize(text);
  const tokens = [];
  let pos = 0;
  while (pos < src.length) {
    if (/[\s|;]/.test(src[pos])) { pos++; continue; }
    for (const [kind, re] of TOKEN_PATTERNS) {
      re.lastIndex = pos;
      const m = re.exec(src);
      if (m) {
        tokens.push({ kind, raw: m[0] });
        pos = re.lastIndex;
        break;
      }
    }
  }
  return tokens;
}

function parseDV(raw) {
  const m = raw.match(/(\d+)\s*([PS])/);
  return { dv: m[1], stun: m[2] === "S" };
}

function parseModes(raw) {
  const modes = { SS: false, SA: false, BF: false, FA: false };
  for (const mode of raw.match(/SS|SA|BF|FA/g)) modes[mode] = true;
  return modes;
}

/** "10/10/8/—/—" -> ["10","10","8","",""] (always five ranges). */
export function parseAR(raw) {
  const parts = String(raw ?? "").split("/").map((p) => p.trim().replace(DASH, "").replace("-", ""));
  while (parts.length < 5) parts.push("");
  return parts.slice(0, 5);
}

function parseAvail(raw) {
  const m = raw.match(/^(.*?)\s*\(\s*([LI])\s*\)$/);
  return { avail: m[1].replace(/\s+/g, ""), legality: m[2] };
}

/**
 * @param {string} text            One table row from the rulebook.
 * @param {object} category        Wizard category ({ id, weapon, columns }).
 * @param {string} [subtype]       Gear subtype; cyberdecks read the pair as Attack/Sleaze.
 * @returns {{name: string, fields: object, unparsed: string[]}}
 */
export function parseStatLine(text, category, subtype = "") {
  const tokens = tokenize(text);
  const fields = {};
  const unparsed = [];
  const values = [];
  const nameParts = [];
  let nameOpen = true;

  for (const token of tokens) {
    if (nameOpen && token.kind === "word") { nameParts.push(token.raw); continue; }
    if (nameOpen && VALUE_KINDS.has(token.kind) && token.kind !== "dash" && category.weapon) {
      // Weapon names often contain numbers (Colt M23, Fichetti Security 600); they end at the damage value.
      if (tokens.some((t) => t.kind === "dv")) { nameParts.push(token.raw); continue; }
    }
    nameOpen = false;
    switch (token.kind) {
      case "dv": Object.assign(fields, parseDV(token.raw)); break;
      case "modes": fields.modes = parseModes(token.raw); break;
      case "ar": fields.ar = parseAR(token.raw); break;
      case "ammo": fields.ammo = token.raw.match(/\d+/)[0]; break;
      case "avail": Object.assign(fields, parseAvail(token.raw)); break;
      case "price": fields.price = token.raw.replace(/\s*(?:¥|nuyen)$/i, ""); break;
      case "pair": {
        const [a, b] = token.raw.split("/").map((v) => v.trim());
        if (subtype === "CYBERDECK") Object.assign(fields, { a, s: b });
        else Object.assign(fields, { d: a, f: b });
        break;
      }
      case "word": unparsed.push(token.raw); break;
      default: values.push(token);
    }
  }

  // Bare numbers fill the remaining table columns from the right, so optional leading columns may be missing.
  const columns = category.columns.filter((c) => fields[c] === undefined);
  const extra = values.length - columns.length;
  if (extra > 0) {
    // Leading numbers that do not fit a column belong to the name, e.g. "Fichetti Security 600".
    const spill = values.splice(0, extra);
    if (nameParts.length) nameParts.push(...spill.map((t) => t.raw));
    else unparsed.push(...spill.map((t) => t.raw));
  }
  const offset = columns.length - values.length;
  values.forEach((token, i) => {
    const column = columns[offset + i];
    const value = token.kind === "dash" ? "" : token.raw.replace(/^\+/, "").replace(/\s+/g, "");
    if (column === "ar0") fields.ar = [value, "", "", "", ""];
    // A rating column of "R" only says the item has a rating; the player picks the value.
    else if (column === "rating" && token.kind === "expr") return;
    else fields[column] = value;
  });

  return { name: nameParts.join(" "), fields, unparsed };
}

/**
 * Evaluates a field that may depend on the item rating ("R*0.1", "R+2", "750").
 * Returns 0 for empty or invalid input.
 */
export function evaluate(expr, rating = 0) {
  const src = String(expr ?? "").trim().replace(/,/g, ".").replace(/[×x]/g, "*");
  if (!src) return 0;
  const withRating = src.replace(/\b(?:R|Rating|Stopień)\b/gi, `(${Number(rating) || 0})`);
  if (!/^[\d\s.+\-*/()]+$/.test(withRating)) return 0;
  try {
    const value = Function(`"use strict"; return (${withRating});`)();
    return Number.isFinite(value) ? Math.round(value * 100) / 100 : 0;
  } catch {
    return 0;
  }
}
