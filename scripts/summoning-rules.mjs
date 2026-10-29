/**
 * Conjuring, Shadowrun, Sixth World core rulebook pp. 146–148, pure for tests.
 * - Summoning: Conjuring + Magic vs (Force × 2); at least one net hit; services = net hits; drain = the
 *   spirit's hits (not net hits), Physical if higher than the summoner's Magic, else Stun.
 * - Banishing: Conjuring + Magic vs (Force × 2); each net hit removes a service; drain = 2 × the spirit's hits.
 *   Physical when the drain is higher than Magic: the initial drain (first print) or the final drain after the
 *   resistance test (August 2019 errata, p. 147).
 * - Combined Force of active spirits ≤ Magic × 3; one optional power per 3 full points of Force.
 */

const num = (v, d = 0) => (Number.isFinite(Number(v)) ? Number(v) : d);

/** Spirit types of the core rulebook (p. 147); the system has more for other books. */
export const CORE_SPIRITS = ["air", "beasts", "earth", "fire", "kin", "water"];

export function summoningResult({ summonerHits, spiritHits, magic }) {
  const net = num(summonerHits) - num(spiritHits);
  const drain = num(spiritHits);
  return { success: net >= 1, services: Math.max(0, net), drain, physical: drain > num(magic) };
}

export function banishingResult({ banisherHits, spiritHits, services }) {
  const net = Math.max(0, num(banisherHits) - num(spiritHits));
  const left = Math.max(0, num(services) - net);
  return { net, servicesLeft: left, departs: left === 0, drain: 2 * num(spiritHits) };
}

/** Is drain Physical? With the errata the damage left after resistance counts, otherwise the drain itself. */
export function drainIsPhysical({ drain, resisted = 0, magic, finalDrain = true }) {
  const value = finalDrain ? Math.max(0, num(drain) - num(resisted)) : num(drain);
  return value > num(magic);
}

export function optionalPowers(force) {
  return Math.floor(num(force) / 3);
}

/** Force still available for new spirits: Magic × 3 minus the Force of active ones. */
export function forceBudget(magic, activeForces = []) {
  const used = activeForces.reduce((a, f) => a + num(f), 0);
  return { max: num(magic) * 3, used, left: Math.max(0, num(magic) * 3 - used) };
}
