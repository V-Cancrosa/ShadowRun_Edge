/**
 * Toxin and drug rules (pp. 121–122), pure for tests.
 * - Power +1 per extra dose and per Toxin Resistance test after the first (every 10 rounds of exposure).
 * - Toxin Resistance: Body + Willpower + protective gear rating; each hit lowers the Power. At 0 nothing happens.
 * - Damaging toxins: the Power left is the damage (Stun or Physical); other effects (statuses) apply unless the
 *   Power is reduced to 0.
 * - Effects arrive at the end of a combat round: Speed 0 = this round, n = n rounds later.
 */
const num = (v, d = 0) => (Number.isFinite(Number(v)) ? Number(v) : d);

const UNIT = { minutes: 60, hours: 3600, days: 86400 };

export function exposurePower(power, { doses = 1, retests = 0 } = {}) {
  return num(power) + Math.max(0, num(doses, 1) - 1) + Math.max(0, num(retests));
}

export function powerLeft(power, hits) {
  return Math.max(0, num(power) - num(hits));
}

/** What a resisted exposure does: damage (the Power left, for damaging toxins) and statuses (unless Power 0). */
export function toxinOutcome(def, power, hits) {
  const left = powerLeft(power, hits);
  if (!left) return { left, damage: 0, monitor: null, statuses: [], changes: [] };
  return {
    left,
    damage: def.damage ? left : 0,
    monitor: def.damage === "physical" ? "physical" : def.damage ? "stun" : null,
    statuses: def.statuses ?? [],
    changes: def.changes ?? [],
  };
}

/**
 * Duration in seconds. (base − Body) × mult units, at least `min`; or mult × the dice roll; or fixed units.
 * @param {number} body   the character's Body
 * @param {number} roll   the dice result for dice durations
 */
export function durationSeconds(duration, body, roll = 0) {
  if (!duration) return 0;
  const unit = UNIT[duration.unit] ?? 60;
  if (duration.fixed) return duration.fixed * unit;
  if (duration.dice) return Math.max(1, num(roll)) * num(duration.mult, 1) * unit;
  const raw = (num(duration.base) - num(body)) * num(duration.mult, 1);
  return Math.max(num(duration.min, 1), raw) * unit;
}

/** Combat rounds until the effect (end of this round = 0), or null when the Speed is in minutes. */
export function speedRounds(speed) {
  return speed?.rounds !== undefined ? num(speed.rounds) : null;
}

/** Active Effect changes of a drug or toxin effect: attributes, initiative dice, pain tolerance, Perception. */
export function effectChanges(def) {
  const out = (def.changes ?? []).map((c) => ({ key: `system.attributes.${c.attr}.mod`, mode: 2, value: String(c.value) }));
  if (def.iniDice) out.push({ key: "system.initiative.physical.diceMod", mode: 2, value: String(def.iniDice) });
  if (def.perception) out.push({ key: "system.skills.perception.modifier", mode: 2, value: String(def.perception) });
  if (def.painHigh) out.push({ key: "system.painTolerance", mode: 5, value: "high" });
  return out;
}

/**
 * The crash after a drug wears off: unresisted Stun damage, attribute changes, statuses (with a level),
 * a pool penalty, attributes set to 0, for `factor` × the drug's duration.
 */
export function crashOf(def) {
  const c = def.crash;
  if (!c) return null;
  const changes = (c.changes ?? []).map((x) => ({ key: `system.attributes.${x.attr}.mod`, mode: 2, value: String(x.value) }));
  for (const attr of c.zero ?? []) changes.push({ key: `system.attributes.${attr}.pool`, mode: 5, value: "0" });
  return {
    stun: num(c.stun),
    changes,
    statuses: (c.statuses ?? []).map((s) => (Array.isArray(s) ? { id: s[0], level: s[1] } : { id: s, level: 1 })),
    pool: num(c.pool),
    factor: num(c.factor, 1),
  };
}
