/**
 * Blast attacks and scatter, Shadowrun, Sixth World core rulebook pp. 114–117, pure for tests.
 * Errata (August 2019) come in as options: each hit reduces scatter (p. 114, first print: "extra hits");
 * thrown grenades use the thrower's unarmed Attack Rating (p. 115); launchers roll Exotic Weapons + Agility
 * (p. 263, first print: + Logic).
 */

const num = (v, d = 0) => (Number.isFinite(Number(v)) ? Number(v) : d);

export const RANGES = ["close", "near", "medium", "far", "extreme"];
/** Range categories in meters (Close 1–3, Near 4–50 as in the blast rules; the longer ones as for firearms). */
export const RANGE_LIMITS = { close: 3, near: 50, medium: 250, far: 500, extreme: Infinity };

export function rangeCategory(meters) {
  const m = num(meters);
  return RANGES.find((r) => m <= RANGE_LIMITS[r]) ?? "extreme";
}

/** Scatter at Range table (p. 115): value added to the hits before they are taken off 2D6. */
const SCATTER = {
  thrown: { close: 4, near: 2, medium: 0, far: -2, extreme: -4 },
  launched: { close: -2, near: 0, medium: -2, far: -4, extreme: -6 },
};

/**
 * Meters of scatter: 2D6 − (hits + modifier), never below 0. Airburst doubles the hits used against scatter
 * (grenade launcher example, p. 116). Without the August 2019 erratum only "extra" hits (beyond the first) count.
 */
export function scatterMeters({ roll, hits, range, launched = false, airburst = false, eachHit = true }) {
  let h = Math.max(0, num(hits) - (eachHit ? 0 : 1));
  if (airburst) h *= 2;
  const mod = SCATTER[launched ? "launched" : "thrown"][range] ?? 0;
  return Math.max(0, num(roll) - (h + mod));
}

/**
 * Scatter Direction Diagram (p. 114), 2D6 around the line of the attack: 7 is straight on, 8–12 turn right
 * (11 = short and to the right, as in the example on p. 115), 6–2 turn left. Returns degrees, clockwise.
 */
export function scatterAngle(roll) {
  return (Math.min(12, Math.max(2, num(roll))) - 7) * 30;
}

/** Point where the explosive lands: the aimed point moved by the scatter, relative to the attack direction. */
export function scatterPoint(from, to, meters, angleDeg, gridUnitsPerMeter = 1) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const len = Math.hypot(dx, dy) || 1;
  const a = Math.atan2(dy, dx) + (angleDeg * Math.PI) / 180;
  const d = meters * gridUnitsPerMeter;
  return { x: to.x + Math.cos(a) * d, y: to.y + Math.sin(a) * d, len };
}

/** Blast zone at a distance: Ground Zero (within 1 m), Close (1–3), Near (4 up to the blast radius, max 50). */
export function blastZone(meters, radius = 50) {
  const m = num(meters);
  if (m <= 1) return "gz";
  if (m <= 3) return "close";
  if (m <= Math.min(num(radius, 50) || 50, 50)) return "near";
  return null;
}

/** Damage codes of an explosive from a catalog note like "DV 16P / 12P / 8P, wybuch 20 m". */
export function parseBlast(text) {
  const m = String(text ?? "").match(/(\d+)\s*([PSFO])\s*\/\s*(\d+)\s*[PSFO]?\s*\/\s*(\d+)\s*[PSFO]?/i);
  if (!m) return null;
  const r = String(text).match(/(?:wybuch|blast|promień|radius)\D{0,6}(\d+)\s*m/i);
  const stun = /^[SO]$/i.test(m[2]);
  return { gz: num(m[1]), close: num(m[3]), near: num(m[4]), stun, radius: r ? num(r[1]) : 50 };
}

/** Commercial explosives against personnel (p. 117): Ground Zero rating, Close rating/2, Near rating/4, radius rating. */
export function explosiveBlast(rating) {
  const r = num(rating);
  return { gz: r, close: Math.floor(r / 2), near: Math.floor(r / 4), stun: false, radius: r };
}

/**
 * Attack Rating of a thrown grenade (August 2019 errata, p. 115): the thrower's unarmed AR at Close, −1 Near,
 * −6 Medium, 0 at Far and Extreme.
 */
export function thrownAttackRating(unarmedAR, range) {
  const ar = num(unarmedAR);
  return { close: ar, near: ar - 1, medium: ar - 6, far: 0, extreme: 0 }[range] ?? 0;
}

/** Damage after the Damage Resistance test (Body, vehicles Body × 2); Hit the Dirt lowers the DV by 2 (p. 114). */
export function blastDamage(dv, soakHits, { hitTheDirt = false } = {}) {
  return Math.max(0, num(dv) - (hitTheDirt ? 2 : 0) - num(soakHits));
}
