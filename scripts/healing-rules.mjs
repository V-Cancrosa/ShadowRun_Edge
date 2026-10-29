/**
 * Healing rules of Shadowrun, Sixth World (core rulebook pp. 119–121), pure so they can be tested in node.
 * Errata switches come in as options: August 2019 (p. 121: no wound modifiers on natural recovery) and
 * February 2020 (p. 120: medkit rating + Logic as an alternative to Biotech + Logic).
 */

export const METHODS = ["firstAid", "medkit", "magic", "restStun", "restPhysical"];
/** Methods a character can benefit from only once per set of injuries (pp. 119–120). */
export const ONCE_PER_INJURIES = ["firstAid", "medkit", "magic"];

const num = (v, d = 0) => (Number.isFinite(Number(v)) ? Number(v) : d);

/** Threshold 5 − target's Essence (never below 0); a fully natural target (Essence 6) gives the healer +1 hit. */
export function treatmentThreshold(essence) {
  const e = num(essence, 6);
  return { threshold: Math.max(0, Math.ceil(5 - e - 1e-9)), autoHit: e >= 6 ? 1 : 0 };
}

/**
 * Dice pool of a healing test.
 * @param {string} method
 * @param {object} healer  prepared system data of the healer (first aid, medkit, magic)
 * @param {object} target  prepared system data of the patient (natural recovery)
 * @param {object} o       { kit, medkitRating, useMedkitRating, assistance, woundModifier, errata }
 */
export function healingPool(method, healer, target, o = {}) {
  const errata = o.errata ?? {};
  const attr = (s, a) => num(s?.attributes?.[a]?.pool);
  switch (method) {
    case "firstAid":
      // Biotech + Logic; without a first aid kit −2 dice and no Edge (p. 119).
      return Math.max(0, num(healer?.skills?.biotech?.pool) - (o.kit === false ? 2 : 0));
    case "medkit":
      if (o.useMedkitRating && errata.medkitRating !== false) return num(o.medkitRating) + attr(healer, "log");
      return num(healer?.skills?.biotech?.pool);
    case "magic":
      return num(healer?.skills?.sorcery?.pool);
    case "restStun":
    case "restPhysical": {
      // Stun: Body + Willpower per hour; Physical: Body + Body per day; Overflow like Physical, − wound modifiers.
      // Medical attention +2 dice (p. 120). Wound modifiers don't apply to natural recovery (errata Aug 2019, p. 121).
      const base = method === "restStun" ? attr(target, "bod") + attr(target, "wil") : attr(target, "bod") * 2;
      const overflow = method === "restPhysical" && num(target?.overflow?.dmg) > 0;
      const wounds = overflow || errata.noWoundsOnRecovery === false ? num(o.woundModifier) : 0;
      return Math.max(0, base + (o.assistance ? 2 : 0) - wounds);
    }
    default:
      return 0;
  }
}

/**
 * Boxes healed by a test. Overflow always heals first (p. 119). Drain is never healed by first aid, medkits or
 * magic, so `drainBoxes` of the Stun damage stay.
 * - First aid: hits above the threshold heal 1 Stun per hit, or 1 Physical/Overflow per 2 hits.
 * - Medkit, magic: hits above the threshold heal 1 box of Stun, Physical or Overflow per hit.
 * - Rest: every hit heals 1 box (Stun per hour; Physical, Overflow first, per day).
 * @param {object} p { method, hits, threshold, autoHit, damage: { stun, physical, overflow }, drainBoxes, prefer: "physical"|"stun" }
 */
export function healingResult({ method, hits, threshold = 0, autoHit = 0, damage, drainBoxes = 0, prefer = "physical" }) {
  const d = { stun: num(damage?.stun), physical: num(damage?.physical), overflow: num(damage?.overflow) };
  const heal = { overflow: 0, physical: 0, stun: 0 };
  const rest = method === "restStun" || method === "restPhysical";
  const total = num(hits) + (rest ? 0 : num(autoHit));
  let budget = rest ? total : Math.max(0, total - num(threshold));
  const success = rest ? total > 0 : total >= num(threshold) && budget > 0;
  const healableStun = rest ? d.stun : Math.max(0, d.stun - num(drainBoxes));

  if (method === "restStun") {
    heal.stun = Math.min(budget, d.stun);
  } else if (method === "restPhysical") {
    heal.overflow = Math.min(budget, d.overflow);
    heal.physical = Math.min(budget - heal.overflow, d.physical);
  } else {
    const cost = method === "firstAid" ? 2 : 1; // per box of Physical or Overflow
    const take = (kind, per, limit) => {
      const n = Math.min(Math.floor(budget / per), limit);
      heal[kind] += n;
      budget -= n * per;
    };
    take("overflow", cost, d.overflow);
    const order = prefer === "stun" ? ["stun", "physical"] : ["physical", "stun"];
    for (const kind of order) take(kind, kind === "stun" ? 1 : cost, kind === "stun" ? healableStun : d.physical);
  }
  return {
    success, hits: total, threshold: rest ? 0 : num(threshold), net: rest ? total : Math.max(0, total - num(threshold)),
    heal, unused: rest ? Math.max(0, total - heal.stun - heal.physical - heal.overflow) : budget,
    after: { stun: d.stun - heal.stun, physical: d.physical - heal.physical, overflow: d.overflow - heal.overflow },
  };
}

/** Overflow at (Body × 2) boxes means death, beyond any healing (p. 121). */
export function isDead(system) {
  return num(system?.overflow?.dmg) >= 2 * num(system?.attributes?.bod?.pool) && num(system?.attributes?.bod?.pool) > 0;
}
