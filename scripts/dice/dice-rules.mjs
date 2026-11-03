/**
 * The Edge dice engine's rules, Shadowrun, Sixth World core rulebook pp. 35–48 with the August 2019 and
 * February 2020 errata. Pure (no Foundry globals) so tools/test_dice.mjs can run it in node.
 *
 * - Hits are 5s and 6s (p. 35). Glitch: more than half of the dice rolled are 1s; critical glitch: a glitch with
 *   no hit (p. 44). Simple tests meet or beat a threshold; net hits are the hits above it (p. 36).
 * - Wild die (p. 48–49): a 5 or 6 counts as 3 hits; a 1 cancels all the 5s rolled; 2–4 mean nothing. With exploding
 *   6s a wild 6 counts 3 hits and is rerolled; extra dice, 1s and rerolls then count as regular dice.
 * - Buying hits (p. 36): one hit per four dice, rounded down; all or nothing; no Edge at all.
 * - Extended tests (p. 36, August 2019 errata): the pool is 1 die smaller each roll, until the threshold is met or
 *   the dice run out. Teamwork (p. 36): helpers' hits are extra dice, at most the leader's skill rank.
 * - Edge (pp. 44–48): one expenditure per action (August 2019 errata, p. 44); a boost may be multiplied on the same
 *   roll; Edge carries over up to 7; at most two bonus Edge per combat round; Attack Rating vs Defense Rating
 *   4 or more apart gives a point of Edge to the higher side. Nothing makes a boost or Edge Action cost 0 (errata).
 */

export const EDGE_CAP = 7;
export const MAX_GAIN_PER_ROUND = 2;

/** Edge Boosts (pp. 46–47). when: pre (before the roll), post (after it), any (outside a roll). */
export const BOOSTS = [
  { id: "reroll_one", cost: 1, when: "post", multi: true },
  { id: "plus_3_ini", cost: 1, when: "any" },
  { id: "plus_1_die", cost: 2, when: "post", multi: true },
  { id: "give_ally", cost: 2, when: "any", multi: true },
  { id: "negate_foe", cost: 2, when: "pre", multi: true },
  { id: "auto_hit", cost: 3, when: "post", multi: true },
  { id: "heal_stun", cost: 3, when: "any", multi: true },
  { id: "add_edge", cost: 4, when: "pre" },
  { id: "heal_physical", cost: 4, when: "any", multi: true },
  { id: "reroll_failed", cost: 4, when: "post" },
  { id: "twos_glitch", cost: 5, when: "pre" },
  { id: "special_effect", cost: 5, when: "any" },
];

/**
 * Edge Actions (pp. 47–48, errata: Fire from Cover, Shank, Tactical Roll, Knockout Blow): chosen before the test.
 * needs: the action they go with — melee, ranged, attack (any attack), block, hit_dirt, multi_ranged, influence, con, any.
 * effect: what the engine does with it (dv +3, double roll…); others are carried as a note for the gamemaster.
 */
export const EDGE_ACTIONS = [
  { id: "shank", cost: 1, needs: "melee" },
  { id: "sudden_insight", cost: 1, needs: "any", effect: "untrained" },
  { id: "tactical_roll", cost: 1, needs: "hit_dirt" },
  { id: "tumble", cost: 1, needs: "melee", effect: "tumble" },
  { id: "bring_the_drama", cost: 2, needs: "con" },
  { id: "fire_from_cover", cost: 2, needs: "ranged" },
  { id: "knockout_blow", cost: 2, needs: "melee", effect: "knockout" },
  { id: "wrest", cost: 2, needs: "block" },
  { id: "anticipation", cost: 4, needs: "multi_ranged" },
  { id: "big_speech", cost: 4, needs: "influence", effect: "big_speech" },
  { id: "disarm", cost: 5, needs: "attack", effect: "disarm" },
  { id: "vitals", cost: 5, needs: "attack", effect: "vitals" },
];

/** Burning Edge (p. 48): lose a point of Edge rank and all Edge points. */
export const BURNS = ["smackdown", "not_dead_yet"];

/** Edge Actions that fit a test of this context (a set of words: melee, ranged, attack, influence, con…). */
export function edgeActionsFor(context = []) {
  const has = new Set(context);
  return EDGE_ACTIONS.filter((a) => a.needs === "any" || has.has(a.needs)
    || (a.needs === "attack" && (has.has("melee") || has.has("ranged")))
    || (a.needs === "multi_ranged" && has.has("ranged") && has.has("multi")));
}

/** Cost of a boost or action taken `times` times (never below 1 per use). */
export function costOf(entry, times = 1) {
  return Math.max(1, Number(entry?.cost) || 1) * Math.max(1, Number(times) || 1);
}

/** A d6 from a random source returning [0, 1). */
export function d6(rng = Math.random) {
  return Math.min(6, Math.floor(rng() * 6) + 1);
}

/**
 * Rolls a pool. Each die: { v, wild?, exploded? (a die added by an exploding 6), from? }.
 * `wild`: one of the dice is the wild die (it is part of the pool). `explode`: 6s roll again (add Edge boost).
 */
export function rollDice(pool, { wild = false, explode = false, rng = Math.random } = {}) {
  const n = Math.max(0, Math.floor(Number(pool) || 0));
  const dice = [];
  for (let i = 0; i < n; i++) dice.push({ v: d6(rng), wild: wild && i === 0 });
  if (explode) explodeDice(dice, rng);
  return dice;
}

/** Adds a die for every 6 (and every 6 those roll), as regular dice. */
export function explodeDice(dice, rng = Math.random, from = 0) {
  let i = from;
  while (i < dice.length) {
    if (dice[i].v === 6 && !dice[i].spent) {
      dice[i].spent = true;
      dice.push({ v: d6(rng), exploded: true });
    }
    i++;
  }
  return dice;
}

/**
 * Counts a roll.
 * @param dice       from rollDice (exploded dice are not counted for glitches)
 * @param threshold  0 = no threshold (any hit is a success)
 * @param twos       count 2s as glitch dice too (5-Edge boost on this roller)
 * @param autoHits   hits bought with Edge, added to the total
 * @returns { hits, ones, glitch, critical, success, net, wildCancel }
 */
export function evaluate(dice, { threshold = 0, twos = false, autoHits = 0 } = {}) {
  const wildDie = dice.find((d) => d.wild);
  const wildCancel = wildDie?.v === 1;
  let hits = 0;
  for (const d of dice) {
    if (d.v < 5) continue;
    if (wildCancel && d.v === 5) continue;
    hits += d.wild ? 3 : 1;
  }
  hits += Math.max(0, Number(autoHits) || 0);
  const counted = dice.filter((d) => !d.exploded);
  const ones = counted.filter((d) => d.v === 1 || (twos && d.v === 2)).length;
  const glitch = counted.length > 0 && ones > counted.length / 2;
  const critical = glitch && hits === 0;
  const t = Math.max(0, Number(threshold) || 0);
  const success = t > 0 ? hits >= t : hits > 0;
  return { hits, ones, glitch, critical, success, net: Math.max(0, hits - t), wildCancel };
}

/** Bought hits (p. 36): one per four dice, rounded down. */
export function boughtHits(pool) {
  return Math.floor(Math.max(0, Number(pool) || 0) / 4);
}

/** Opposed test (p. 36, February 2020 errata p. 105): ties go to the aggressor unless net hits are needed. */
export function opposed(attackerHits, defenderHits, { tiesToAttacker = true } = {}) {
  const a = Number(attackerHits) || 0;
  const d = Number(defenderHits) || 0;
  const wins = tiesToAttacker ? a > 0 && a >= d : a > d;
  return { wins, net: Math.max(0, a - d) };
}

/** Teamwork (p. 36): helpers' hits as extra dice, capped by the leader's skill rank. */
export function teamworkDice(helperHits, leaderRank) {
  const sum = (helperHits ?? []).reduce((s, h) => s + Math.max(0, Number(h) || 0), 0);
  return Math.min(sum, Math.max(0, Number(leaderRank) || 0));
}

/** Extended test (p. 36): the pool for roll number `n` (1-based). */
export function extendedPool(pool, n) {
  return Math.max(0, (Number(pool) || 0) - Math.max(0, (Number(n) || 1) - 1));
}

/** Trying again (p. 37): −2 per earlier attempt, not for combat actions. */
export function retryPenalty(attempts) {
  return -2 * Math.max(0, Number(attempts) || 0);
}

/**
 * Edge from Attack Rating vs Defense Rating (p. 45): 4 or more apart gives the higher side a point.
 * Cover (August 2019 errata p. 52): no Edge while attacking from cover.
 */
export function edgeFromRatings(ar, dr, { attackerInCover = false } = {}) {
  const a = Number(ar) || 0;
  const d = Number(dr) || 0;
  if (!a && !d) return { attacker: 0, defender: 0 };
  return { attacker: !attackerInCover && a - d >= 4 ? 1 : 0, defender: d - a >= 4 ? 1 : 0 };
}

/**
 * How much Edge can be gained now (p. 45): the round's bonus limit and the cap of 7.
 * @param current     Edge points now
 * @param gainedRound bonus Edge already gained this combat round
 * @param maxRound    the limit per round (system setting, book 2)
 */
export function gainable(want, { current = 0, gainedRound = 0, maxRound = MAX_GAIN_PER_ROUND, inCombat = true } = {}) {
  let n = Math.max(0, Number(want) || 0);
  if (inCombat) n = Math.min(n, Math.max(0, maxRound - gainedRound));
  return Math.max(0, Math.min(n, EDGE_CAP - (Number(current) || 0)));
}

/** Applies a post-roll boost to the dice (returns new dice; does not check Edge). */
export function applyPost(dice, boost, { index = 0, rng = Math.random, times = 1 } = {}) {
  const out = dice.map((d) => ({ ...d }));
  if (boost === "reroll_one") {
    const idx = Array.isArray(index) ? index : [index];
    for (const i of idx.slice(0, times)) if (out[i]) out[i] = { ...out[i], v: d6(rng), rerolled: true, spent: false };
  } else if (boost === "plus_1_die") {
    const idx = Array.isArray(index) ? index : [index];
    for (const i of idx.slice(0, times)) if (out[i] && out[i].v < 6) out[i] = { ...out[i], v: out[i].v + 1, edged: true };
  } else if (boost === "reroll_failed") {
    for (let i = 0; i < out.length; i++) if (out[i].v < 5) out[i] = { ...out[i], v: d6(rng), rerolled: true, spent: false };
  }
  return out;
}

/** Why a post-roll boost cannot be used now (null when it can). */
export function postBlocked(boost, result, { buy = false } = {}) {
  if (buy) return "bought";
  if (boost === "reroll_failed" && (result?.glitch || result?.critical)) return "glitch";
  return null;
}

/** Smackdown (p. 48): an automatic success with four net hits. */
export function smackdown(threshold = 0) {
  const t = Math.max(0, Number(threshold) || 0);
  return { hits: t + 4, net: 4, success: true, glitch: false, critical: false };
}

/** Initiative (p. 39): rank + dice (at most 5D6); the score is the total. */
export function initiativeDice(dice) {
  return Math.max(0, Math.min(5, Number(dice) || 0));
}

/** Wound modifier from filled rows (p. 38): −1 per full row of three boxes on each monitor. */
export function woundModifier(physDamage, stunDamage) {
  return -(Math.floor((Number(physDamage) || 0) / 3) + Math.floor((Number(stunDamage) || 0) / 3));
}

/** Sort for display: hits first (wild, 6, 5), then the rest high to low. */
export function displayOrder(dice) {
  const rank = (d) => (d.v >= 5 ? 0 : d.v === 1 ? 2 : 1);
  return dice.map((d, i) => ({ ...d, i })).sort((a, b) => rank(a) - rank(b) || (b.wild ? 1 : 0) - (a.wild ? 1 : 0) || b.v - a.v);
}

// ───── The system's optional rules (shadowrun6-eden settings, from Sixth World Companion), as the system applies them ─────

/** Hard dice cap: at most 20 dice; Edge added before the roll may go above it. */
export function capPool(pool, cap = true) {
  const n = Math.max(0, Number(pool) || 0);
  return cap ? Math.min(20, n) : n;
}

/** High Strength reduces recoil: fire-mode AR penalties lessened by 1 at Strength 7+, by 2 at 10+ (both hands). */
export function recoilReduction(strength) {
  const s = Number(strength) || 0;
  return (s >= 7 ? 1 : 0) + (s >= 10 ? 1 : 0);
}

/** You can't dodge bullets: a Simple test with threshold = highest target defense pool / 6 (down) + range index. */
export function bulletThreshold(defensePool, rangeIndex = 0) {
  return Math.floor((Number(defensePool) || 0) / 6) + Math.max(0, Number(rangeIndex) || 0);
}

/** Armor lessens Physical damage: one box per 8 full points of Defense Rating becomes Stun. */
export function armorSplit(damage, dr) {
  const d = Math.max(0, Number(damage) || 0);
  const k = Math.floor((Number(dr) || 0) / 8);
  const physical = Math.max(0, d - k);
  return { physical, stun: d - physical };
}
