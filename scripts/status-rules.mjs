/**
 * Statuses, Shadowrun, Sixth World core rulebook pp. 51–53 (with the August 2019 Cover errata), pure for tests.
 * Status ids are the shadowrun6-eden ones (CONFIG.statusEffects); levels are the effect's system.level.
 *
 * - poolChips(statuses, ctx): dice pool modifiers for one roll, as chips the roll dialog can toggle. `on` means the
 *   rules apply it to this kind of roll; situational ones (vision, hearing, the source of fear…) start off.
 * - statusChanges(id, level): Active Effect changes for values that are always on (Initiative, Defense Rating).
 * - ongoingDamage(statuses): Burning, Corrosive and Poisoned damage at the end of a combat round.
 * - cancels(id): statuses removed when this one is gained.
 * - warnings(statuses, ctx): what a status forbids — shown, never enforced (the GM decides).
 */

const num = (v, d = 0) => (Number.isFinite(Number(v)) ? Number(v) : d);

/** Statuses with an effect in the module (others stay icons). */
export const KNOWN = [
  "blinding", "burning", "chilled", "confused", "corrosive", "cover", "dazed", "deafened", "fatigued", "frightened",
  "hazed", "hobbled", "immobilized", "invisible", "invisibleImproved", "nauseated", "panicked", "petrified",
  "poisoned", "prone", "silent", "silentImproved", "stilled", "wet", "zapped",
];

const INI_KEYS = ["system.initiative.physical.mod", "system.initiative.astral.mod", "system.initiative.matrix.mod"];
const DR_KEY = "system.defenserating.physical.mod";

/** Active Effect changes (mode 2 = Add) a status brings at a level. */
export function statusChanges(id, level = 1) {
  const lvl = Math.max(1, Math.trunc(num(level, 1)));
  const add = (key, value) => ({ key, mode: 2, value: String(value) });
  switch (id) {
    case "chilled":
    case "dazed":
      return INI_KEYS.map((k) => add(k, -4));
    case "zapped":
      return INI_KEYS.map((k) => add(k, -2));
    case "cover":
      return [add(DR_KEY, lvl)];
    case "stilled":
      // −10 to the Defense Rating (minimum 0 is the system's floor on the pool).
      return [add(DR_KEY, -10)];
    case "petrified":
      // +10 Armor Rating, which counts toward the Defense Rating.
      return [add(DR_KEY, 10)];
    default:
      return [];
  }
}

/**
 * Dice pool chips for a roll.
 * @param {{id: string, level?: number}[]} statuses  the actor's active statuses
 * @param {object} ctx  { kind: "attack"|"defense"|"soak"|"test", melee, bow, firearm, errata }
 * @returns {{id: string, value: number, on: boolean, note?: string, arMod?: number, reaction?: boolean}[]}
 */
export function poolChips(statuses, ctx = {}) {
  const chips = [];
  const kind = ctx.kind ?? "test";
  const soak = kind === "soak";
  const attack = kind === "attack";
  const defense = kind === "defense";
  for (const { id, level } of statuses) {
    const lvl = Math.max(1, Math.trunc(num(level, 1)));
    switch (id) {
      case "chilled":
        chips.push({ id, value: -1, on: !soak });
        break;
      case "confused":
        chips.push({ id, value: -lvl, on: !soak });
        break;
      case "fatigued":
        chips.push({ id, value: -2 * Math.min(lvl, 3), on: !soak });
        break;
      case "zapped":
        chips.push({ id, value: -1, on: !soak });
        break;
      case "blinding":
      case "deafened":
        // Only tests involving sight / hearing: the user knows; level III fails them outright.
        chips.push({ id, value: lvl >= 3 ? 0 : -3 * lvl, on: false, note: lvl >= 3 ? "autoFail" : undefined });
        break;
      case "frightened":
        chips.push({ id, value: -4, on: false, note: "source" });
        break;
      case "wet":
        if (soak) chips.push({ id, value: -6, on: false, note: "coldElectric" });
        break;
      case "cover":
        if (defense) chips.push({ id, value: Math.min(lvl, 4), on: true });
        // August 2019 errata: −2 to attacks made at Cover IV.
        if (attack && lvl >= 4 && ctx.errata?.coverIVAttack !== false) chips.push({ id, value: -2, on: true, note: "coverIV" });
        break;
      case "prone":
        if (defense) {
          chips.push({ id: "prone_far", value: 2, on: false, note: "proneFar" });
          chips.push({ id: "prone_near", value: -2, on: false, note: "proneNear" });
        }
        if (attack && (ctx.melee || ctx.bow)) chips.push({ id, value: -4, on: true });
        if (attack && ctx.firearm && !ctx.bow) chips.push({ id: "prone_ar", value: 0, arMod: 2, on: true, note: "proneAR" });
        break;
      case "immobilized":
        if (attack) chips.push({ id, value: -3, arMod: -3, on: true });
        if (defense) chips.push({ id, value: 0, reaction: true, on: true, note: "noReaction" });
        break;
      default:
        break;
    }
  }
  return chips;
}

/** What a status forbids or demands for this roll: shown as notes, the GM decides. */
export function warnings(statuses, ctx = {}) {
  const out = [];
  const has = (id) => statuses.find((s) => s.id === id);
  if (has("dazed")) out.push("dazed");
  if (has("panicked")) out.push("panicked");
  if (has("petrified")) out.push("petrified");
  if (has("stilled")) out.push(ctx.kind === "defense" ? "stilledDefense" : "stilled");
  if (has("cover") && ctx.kind === "attack") out.push("coverAttack");
  for (const id of ["blinding", "deafened"]) if (num(has(id)?.level) >= 3) out.push(`${id}III`);
  return out;
}

/** Ongoing damage at the end of a combat round (p. 51): Burning and Corrosive Physical, Poisoned as noted. */
export function ongoingDamage(statuses) {
  const ids = new Set(statuses.map((s) => s.id));
  // Stilled halts ongoing damage; Petrified cancels damaging statuses.
  if (ids.has("stilled") || ids.has("petrified")) return [];
  return statuses
    .filter((s) => ["burning", "corrosive", "poisoned"].includes(s.id) && num(s.level) > 0)
    .map((s) => ({ id: s.id, dv: num(s.level), monitor: s.id === "poisoned" && s.stun ? "stun" : "physical" }));
}

/** Statuses removed when `id` is gained (p. 51–53). */
export function cancels(id) {
  switch (id) {
    case "burning":
      return ["wet", "chilled"];
    case "wet":
    case "chilled":
      return ["burning"];
    case "petrified":
      return ["burning", "corrosive", "poisoned"];
    default:
      return [];
  }
}

/** Walking / sprinting meters with the movement statuses (Fatigued, Hobbled, Prone). */
export function movement(statuses, walk = 10, sprint = 15) {
  const ids = new Set(statuses.map((s) => s.id));
  let w = num(walk, 10);
  let s = num(sprint, 15);
  if (ids.has("fatigued")) {
    w = Math.min(w, 5);
    s = Math.min(s, 10);
  }
  if (ids.has("hobbled")) {
    w = Math.ceil(w / 2);
    s = Math.ceil(s / 2);
  }
  if (ids.has("prone")) {
    w = Math.min(w, 2);
    s = 0;
  }
  if (ids.has("zapped")) s = 0;
  return { walk: w, sprint: s };
}

/** Damage after hiding behind a barrier (p. 111): half the Structure (rounded up) off the incoming damage. */
export function barrierDamage(damage, structure) {
  return Math.max(0, num(damage) - Math.ceil(num(structure) / 2));
}
