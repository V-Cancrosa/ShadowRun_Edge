/**
 * Focused Concentration (quality, core rulebook p. 71) and Pain Resistance (adept power, p. 158), pure for tests.
 * Same rules and data fields as zychu's standalone modules (MIT): system.focusedConcentration and
 * system.painResistance, both set by Active Effects in Add mode.
 * - Focused Concentration: per level one sustained spell or complex form costs no −2 dice; spells with a Drain
 *   Value of 7 or more don't qualify.
 * - Pain Resistance: per level the wound modifiers move one box farther down both Condition Monitors; negative
 *   values move them up.
 */

const num = (v, d = 0) => (Number.isFinite(Number(v)) && v !== "" && v !== null ? Number(v) : d);

export const PENALTY_PER_SUSTAINED = 2;
export const FOCUS_MAX_DRAIN = 7;

/** Sustained spells and complex forms Focused Concentration may cover (as the system counts them). */
export function eligibleSustained(items) {
  let n = 0;
  for (const item of items ?? []) {
    if (item.type !== "spell" && item.type !== "complexform") continue;
    const s = item.system ?? {};
    if (s.duration !== "sustained" || !s.isSustained) continue;
    if (item.type === "spell" && num(s.drain, 0) >= FOCUS_MAX_DRAIN) continue;
    n++;
  }
  return n;
}

/** Sustaining penalty after Focused Concentration. */
export function focusedSustainedModifier(modifier, level, items) {
  const lvl = Math.max(0, Math.trunc(num(level)));
  if (!lvl || !modifier) return modifier;
  return Math.max(0, modifier - Math.min(lvl, eligibleSustained(items)) * PENALTY_PER_SUSTAINED);
}

/**
 * Wound modifier of a monitor moved by Pain Resistance: the first `shift` boxes are free (negative: extra boxes
 * count as filled), then the system's own formula (`original`) runs on the shifted monitor.
 */
export function shiftedWoundModifier(original, monitor, shift) {
  const sh = Math.trunc(num(shift));
  if (!sh || !monitor) return original(monitor);
  const max = num(monitor.max);
  const dmg = num(monitor.dmg);
  const shiftedMax = max - sh;
  if (dmg <= 0 || shiftedMax <= 0) return 0;
  const shiftedDmg = Math.max(0, dmg - sh);
  return original({ ...monitor, max: shiftedMax, dmg: shiftedDmg, value: shiftedMax - shiftedDmg });
}

/** Penalty label of box i (1-based) on a monitor of `boxes` boxes: every third box, and the last box. */
export function boxLabel(i, boxes, shift = 0) {
  const sh = Math.trunc(num(shift));
  if (i === boxes) {
    const last = Math.ceil(Math.max(0, boxes - sh) / 3);
    return last > 0 ? `-${last}` : null;
  }
  const n = i - sh;
  return n > 0 && n % 3 === 0 ? `-${n / 3}` : null;
}
