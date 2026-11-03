/**
 * Character advancement with Karma, Shadowrun, Sixth World core rulebook pp. 68–70 (the August 2019 errata only
 * corrects the Attribute and Skill Advancement table to match "5 × new rank"), pure for tests.
 *
 * A cart is a list of entries:
 *   { kind: "attribute", id, from, to }        5 × each new rank, (new rank × 2) months each
 *   { kind: "skill", id, from, to }            5 × each new rank, (new rank) months each
 *   { kind: "specialization", id, spec }       5, 1 month
 *   { kind: "expertise", id, spec }            5, 2 months
 *   { kind: "knowledge", name, language }      3, 1 month
 *   { kind: "quality", id, name, karma, level } positive: 2 × cost, 1 week
 *   { kind: "removeQuality", itemId, name, karma } negative: 2 × bonus, 1 week
 *   { kind: "spell" | "form", name }           5, 1 week
 *   { kind: "initiation" | "submersion", from } 10 + new grade; (grade + 1) months / weeks
 */
import { advancementCost } from "./chargen/rules.mjs";

const num = (v, d = 0) => (Number.isFinite(Number(v)) ? Number(v) : d);

/** Karma of one entry. */
export function entryCost(e) {
  switch (e.kind) {
    case "attribute":
    case "skill":
      return advancementCost(num(e.from), num(e.to));
    case "specialization":
    case "expertise":
    case "spell":
    case "form":
      return 5;
    case "knowledge":
      return 3;
    case "quality":
      return 2 * num(e.karma) * Math.max(1, num(e.level, 1));
    case "removeQuality":
      return 2 * Math.abs(num(e.karma));
    case "initiation":
    case "submersion":
      return 10 + num(e.from) + 1;
    default:
      return 0;
  }
}

/** Suggested training time of one entry, as { months, weeks } (summed over each new rank). */
export function entryTime(e) {
  let months = 0;
  let weeks = 0;
  const ranks = (from, to) => Array.from({ length: Math.max(0, num(to) - num(from)) }, (_, i) => num(from) + i + 1);
  switch (e.kind) {
    case "attribute":
      months = ranks(e.from, e.to).reduce((a, r) => a + 2 * r, 0);
      break;
    case "skill":
      months = ranks(e.from, e.to).reduce((a, r) => a + r, 0);
      break;
    case "specialization":
    case "knowledge":
      months = 1;
      break;
    case "expertise":
      months = 2;
      break;
    case "initiation":
      months = num(e.from) + 2; // (new grade + 1)
      break;
    case "submersion":
      weeks = num(e.from) + 2;
      break;
    default:
      weeks = 1;
  }
  return { months, weeks };
}

/** Total Karma and the per-entry costs of a cart. */
export function cartTotal(cart) {
  const lines = cart.map((e) => ({ ...e, cost: entryCost(e), time: entryTime(e) }));
  return { lines, total: lines.reduce((a, l) => a + l.cost, 0) };
}

/**
 * What in a cart breaks a rule (never enforced: the GM decides).
 * @param {object[]} cart
 * @param {object} c  { karma, attrMax: { id: max }, skillMax: { id: max }, skills: { id: { points, specialization, expertise } } }
 * @returns {{ key: string, data: object }[]}
 */
export function cartProblems(cart, c = {}) {
  const out = [];
  const { total } = cartTotal(cart);
  if (total > num(c.karma)) out.push({ key: "karma", data: { total, karma: num(c.karma) } });
  for (const e of cart) {
    if (e.kind === "attribute" && c.attrMax?.[e.id] !== undefined && num(e.to) > num(c.attrMax[e.id])) {
      out.push({ key: "attrMax", data: { id: e.id, to: e.to, max: c.attrMax[e.id] } });
    }
    if (e.kind === "skill") {
      const max = num(c.skillMax?.[e.id], 9);
      if (num(e.to) > max) out.push({ key: "skillMax", data: { id: e.id, to: e.to, max } });
    }
    const skill = c.skills?.[e.id] ?? {};
    if (e.kind === "expertise") {
      const rank = Math.max(num(skill.points), num(cart.find((x) => x.kind === "skill" && x.id === e.id)?.to));
      if (!skill.specialization && !cart.some((x) => x.kind === "specialization" && x.id === e.id)) out.push({ key: "expertiseNoSpec", data: { id: e.id } });
      if (rank < 5) out.push({ key: "expertiseRank", data: { id: e.id, rank } });
    }
    if (e.kind === "specialization" && skill.specialization && !skill.expertise && !cart.some((x) => x.kind === "expertise" && x.id === e.id)) {
      out.push({ key: "secondSpec", data: { id: e.id } });
    }
  }
  return out;
}
