/**
 * Matrix rules of the SR6 core rulebook (pp. 175–187) with the August 2019 and February 2020 errata, pure for tests.
 * Overwatch Score, Convergence, dumpshock, access levels, backdoors, Data Spike, device monitors and IC.
 */
const num = (v, d = 0) => (Number.isFinite(Number(v)) ? Number(v) : d);

/** Convergence happens when the OS reaches this (p. 176). */
export const CONVERGENCE = 40;

export const ACCESS = ["outsider", "user", "admin"];
const rank = (level) => Math.max(0, ACCESS.indexOf(level));

/**
 * OS gained by one Matrix action (p. 176, errata Aug 2019): an illegal action adds every hit the defender scored
 * (not net hits, whether the defense succeeded or not); +1 if a hacking program modified the action. Under the
 * Radar (3 Edge) makes the next illegal action add nothing.
 */
export function osFromAction({ illegal, defenderHits, program, radar }) {
  if (radar) return { total: 0, hits: 0, program: 0 };
  const hits = illegal ? Math.max(0, num(defenderHits)) : 0;
  const prog = program ? 1 : 0;
  return { total: hits + prog, hits, program: prog };
}

/** OS per combat round from illegal access held on hosts: +1 per host with illegal User, +3 per illegal Admin. */
export function osPerRound(targets = []) {
  return targets.filter((t) => t.kind === "host" && t.illegal)
    .reduce((a, t) => a + (t.access === "admin" ? 3 : t.access === "user" ? 1 : 0), 0);
}

export const isConvergence = (os, threshold = CONVERGENCE) => num(os) >= num(threshold, CONVERGENCE);

/**
 * Dumpshock (p. 176): only when dropped from VR. 3S cold-sim, 3P hot-sim, biofeedback resisted with Willpower,
 * and no Edge for (10 − Willpower) minutes, even if all the damage is resisted.
 * @param {string} mode  the system's matrixIni: "ar" | "vrcold" | "vrhot"
 */
export function dumpshock(mode, willpower) {
  if (mode !== "vrcold" && mode !== "vrhot") return null;
  return { damage: 3, monitor: mode === "vrhot" ? "physical" : "stun", minutes: Math.max(0, 10 - num(willpower)) };
}

/** Matrix Condition Monitor of a device (p. 179): (Device Rating / 2) + 8, rounded up. */
export const deviceMonitor = (rating) => Math.ceil(num(rating) / 2) + 8;

/** Data Spike damage (p. 181): [Attack Rating / 2, rounded up] + 1 per net hit. */
export const dataSpikeDamage = (attackRating, netHits) => Math.ceil(num(attackRating) / 2) + Math.max(0, num(netHits));

/**
 * Brute Force defense (p. 180, errata Feb 2020): Willpower + Firewall for User, or for Admin with User already held;
 * Admin without User: Willpower + (Firewall + 2) and +4 Defense Rating.
 */
export function bruteForceDefense(want, current = "outsider") {
  const jump = want === "admin" && rank(current) < rank("user");
  return { firewallBonus: jump ? 2 : 0, drBonus: jump ? 4 : 0 };
}

/** Backdoor from a Probe (p. 182): net hits as a bonus on Backdoor Entry, lasting (10 − rating) hours. */
export const backdoorHours = (rating) => Math.max(0, 10 - num(rating));

/** Access levels that may take an action (the system's outsider/user/admin flags). */
export function actionLevels(action = {}) {
  return ACCESS.filter((l) => action[l]);
}

/** Whether `level` is enough for the action: one of its listed levels at or below the access held. */
export function accessAllowed(action, level = "outsider") {
  const levels = actionLevels(action);
  if (!levels.length) return true;
  return levels.some((l) => rank(l) <= rank(level));
}

/** The lowest access an action needs. */
export const accessNeeded = (action) => actionLevels(action)[0] ?? "outsider";

/**
 * What a won access test grants:
 *  brute_force → the wanted level, illegal; backdoor_entry → Admin, not illegal access (p. 180);
 *  probe → a backdoor (net hits bonus, (10 − rating) h).
 */
export function accessResult(actionId, { want = "user", net = 0, rating = 0 } = {}) {
  if (net <= 0) return null;
  if (actionId === "brute_force") return { access: want === "admin" ? "admin" : "user", illegal: true };
  if (actionId === "backdoor_entry") return { access: "admin", illegal: false };
  if (actionId === "probe") return { backdoor: { bonus: net, hours: backdoorHours(rating) } };
  return null;
}

/** Host attributes: rating, +1, +2, +3 in any order (p. 185). */
export const hostAttributeValues = (rating) => [0, 1, 2, 3].map((d) => num(rating) + d);

/**
 * IC (p. 186–187, errata Feb 2020: Host Attack Rating, (Host Rating × 2) for Condition Monitor and most rolls,
 * Initiative (Data Processing × 2) + 3D6). `damage`: what a hit deals, from host rating and net hits.
 */
export const IC = {
  acid: { defense: ["wil", "f"], effect: "attrLoss", attr: "f" },
  binder: { defense: ["wil", "d"], effect: "attrLoss", attr: "d" },
  black: { defense: ["int", "f"], effect: "damage", matrix: true, bio: true },
  blaster: { defense: ["log", "f"], effect: "damage", matrix: true, linkLock: true, flat: true },
  crash: { defense: ["int", "f"], effect: "crash" },
  jammer: { defense: ["wil", "a"], effect: "attrLoss", attr: "a" },
  killer: { defense: ["int", "f"], effect: "damage", matrix: true },
  marker: { defense: ["wil", "s"], effect: "attrLoss", attr: "s" },
  patrol: { defense: [], effect: "perception" },
  scramble: { defense: ["wil", "f"], effect: "reboot" },
  sparky: { defense: ["int", "f"], effect: "damage", bio: true },
  tarbaby: { defense: ["log", "f"], effect: "linkLock" },
  track: { defense: ["wil", "s"], effect: "track" },
};

export function icStats(hostRating, dataProcessing) {
  const r = num(hostRating);
  return { pool: r * 2, monitor: r * 2, initiative: { base: num(dataProcessing) * 2, dice: 3 }, maxRunning: r };
}

/** What an IC hit does: damage boxes (Blaster: rating; Killer/Black/Sparky: rating + net hits) or attribute loss. */
export function icHit(id, hostRating, netHits) {
  const ic = IC[id];
  const net = Math.max(0, num(netHits));
  if (!ic || net <= 0) return null;
  const amount = ic.flat ? num(hostRating) : num(hostRating) + net;
  return {
    matrix: ic.matrix ? amount : 0,
    bio: ic.bio ? amount : 0,
    attrLoss: ic.effect === "attrLoss" ? { attr: ic.attr, amount: net } : null,
    linkLock: !!ic.linkLock || ic.effect === "linkLock",
    effect: ic.effect,
  };
}
