/**
 * Gas, spray and demolitions, SR6 core rulebook pp. 116–117 with the August 2019 errata, pure for tests.
 *
 * Gas: the Range is where the gas has full effect; it spreads to Range × 2, × 3 and × 4 with less effect, by the
 * number of rounds after the attack lands (Gas Ranges, Effect, and Duration table; errata: Range × 3, half effect
 * in rounds 1–4). Fractions round down. Behind a solid barrier the concentration builds to full in the first
 * 5 rounds and decreases only in rounds 9 and 10; in a sealed space it builds through round 5 and holds until it
 * goes inert in round 10. The module reads both as: each zone keeps its strongest level until then.
 */
const num = (v, d = 0) => (Number.isFinite(Number(v)) ? Number(v) : d);

export const LEVELS = ["full", "half", "quarter", "none"];
export const FRACTION = { full: 1, half: 0.5, quarter: 0.25, none: 0 };

/** Open ground: per zone (Range, × 2, × 3, × 4), the last round of each level. */
const TABLE = [
  [[5, "full"], [8, "half"], [10, "quarter"]],
  [[5, "half"], [8, "quarter"]],
  [[4, "half"], [6, "quarter"]],
  [[5, "quarter"]],
];

/** Gas zone at a distance from the point of dispersion: 0 (Range) … 3 (Range × 4), null outside. */
export function gasZone(meters, range) {
  const r = Math.max(1, num(range, 1));
  const m = num(meters);
  for (let z = 0; z < 4; z++) if (m <= r * (z + 1)) return z;
  return null;
}

const step = (level) => LEVELS[Math.min(3, LEVELS.indexOf(level) + 1)];

/**
 * Effect level in a zone, `round` rounds after the attack landed (1 = the first round).
 * @param {"open"|"barrier"|"sealed"} condition
 */
export function gasLevel(zone, round, condition = "open") {
  const rows = TABLE[zone];
  const r = num(round);
  if (!rows || r < 1) return "none";
  const strongest = rows[0][1];
  if (condition === "barrier") return r <= 8 ? strongest : r <= 10 ? step(strongest) : "none";
  if (condition === "sealed") return r <= 9 ? strongest : "none";
  return rows.find(([last]) => r <= last)?.[1] ?? "none";
}

/** Power of the gas's substance at a level: full, half or a quarter, rounded down. */
export const gasPower = (power, level) => Math.floor(num(power) * (FRACTION[level] ?? 0));

/** The cloud is gone: inert from round 10 when sealed, after round 10 otherwise. */
export const cloudOver = (round, condition = "open") => (condition === "sealed" ? num(round) >= 10 : num(round) > 10);

/** Range of a gas grenade when the item does not give one: 5, as in the rulebook's example (p. 117). */
export const DEFAULT_GAS_RANGE = 5;

/** Gas or smoke grenades and rockets, by name (catalog rows) or the module flag. */
export function gasKind(item) {
  const flag = item?.flags?.["shadowrun-edge"]?.gas;
  if (flag) return flag.smoke ? "smoke" : "gas";
  const name = String(item?.name ?? "");
  if (/smoke|dym/i.test(name) && /grenade|rocket|granat|rakieta/i.test(name)) return "smoke";
  if (/\bgas\b|gazow/i.test(name) && /grenade|rocket|granat|rakieta/i.test(name)) return "gas";
  return null;
}

// ───── Spray (p. 117) ─────

/** Spray styles: straight as normal; wobbly (about 3 m wide) AR +2, DV −1; sweeping (10 m) AR +4, DV −3. */
export const SPRAY_STYLES = {
  straight: { ar: 0, dv: 0, width: 0 },
  wobbly: { ar: 2, dv: -1, width: 3 },
  sweeping: { ar: 4, dv: -3, width: 10 },
};

/** Damage of a spray hit: base DV + style + net hits, never below 0. */
export const sprayDamage = (baseDV, style, netHits) => Math.max(0, num(baseDV) + (SPRAY_STYLES[style]?.dv ?? 0) + Math.max(0, num(netHits)));

/** Moving the stream extra fast (wobbly or sweeping only): a normal die becomes the wild die. */
export const fastStreamAllowed = (style) => style === "wobbly" || style === "sweeping";

/** Spray weapons: flamethrowers, nausea guns, extinguishers, the Super Squirt (DMSO), or the module flag. */
export function isSpray(item) {
  if (item?.flags?.["shadowrun-edge"]?.spray) return true;
  return item?.system?.subtype === "DMSO" || /flamethrower|miotacz|nausea gun|extinguisher|gaśnic|squirt|spray/i.test(String(item?.name ?? ""));
}

// ───── Building a Bigger Boom (p. 117, errata Aug 2019) ─────

/** Commercial explosive packages (p. 264): their Rating is the base DV against Structures. */
export const isPackage = (item) => /explosive package|pakiet/i.test(String(item?.name ?? ""));

/**
 * Engineering + Logic test on a planted charge.
 *  grenade/personnel: threshold 2; each hit above it is +1 DV in a range category of the player's choice.
 *  grenade/structure: Close DV against Structures, +1 per hit above 2, never beyond the Ground Zero DV (errata).
 *  package/structure: +1 to the effective rating per hit, no threshold.
 *  package/personnel: threshold 2; hits above it add to the rating, whose blast is GZ R, Close R/2, Near R/4, radius R.
 */
export function demolition({ kind, target, hits, blast = null, rating = 0 }) {
  const h = Math.max(0, num(hits));
  const above = Math.max(0, h - 2);
  if (kind === "grenade" && target === "personnel") return { bonus: above };
  if (kind === "grenade") return { structureDV: Math.min(num(blast?.gz), num(blast?.close) + above) };
  if (target === "structure") return { structureRating: num(rating) + h };
  const r = num(rating) + above;
  return { rating: r, blast: { gz: r, close: Math.floor(r / 2), near: Math.floor(r / 4), stun: false, radius: r } };
}

/** Spreads grenade bonus points over the zones as chosen; any left over goes to Ground Zero. */
export function spreadBonus(blast, bonus, split = {}) {
  const want = { gz: Math.max(0, num(split.gz)), close: Math.max(0, num(split.close)), near: Math.max(0, num(split.near)) };
  const asked = want.gz + want.close + want.near;
  const scale = asked > bonus ? bonus / asked : 1;
  const add = { gz: Math.floor(want.gz * scale), close: Math.floor(want.close * scale), near: Math.floor(want.near * scale) };
  add.gz += bonus - add.gz - add.close - add.near;
  return { ...blast, gz: num(blast.gz) + add.gz, close: num(blast.close) + add.close, near: num(blast.near) + add.near };
}
