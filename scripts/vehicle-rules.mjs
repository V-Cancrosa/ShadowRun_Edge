/**
 * Vehicles and drones, SR6 core rulebook pp. 197–202 with the August 2019 and February 2020 errata, pure for tests.
 * The core rulebook has no chase rules: drivers face off with opposed Piloting + Reaction tests.
 */
const num = (v, d = 0) => (Number.isFinite(Number(v)) ? Number(v) : d);

/** Speed Intervals passed: a cumulative −1 to Handling tests and attacks from the vehicle (p. 199). */
export const speedIntervals = (speed, interval) => Math.floor(Math.max(0, num(speed)) / Math.max(1, num(interval, 1)));

/** Handling threshold: on-road or off-road, +1 for every three boxes of damage (p. 201). */
export const handlingThreshold = ({ handlOn, handlOff, offRoad, dmg }) => num(offRoad ? handlOff : handlOn) + Math.floor(num(dmg) / 3);

/** New speed after accelerating (+1) or braking (−1) by up to Acceleration, kept within 0 … Top Speed (p. 199). */
export function changeSpeed(speed, { accel, top, dir, by }) {
  const step = Math.min(num(accel), Math.max(0, num(by, num(accel))));
  return Math.max(0, Math.min(num(top, Infinity), num(speed) + Math.sign(num(dir)) * step));
}

/** Meters traveled this round: speed at the start ± ½ the change (p. 199). */
export const distance = (from, to) => num(from) + (num(to) - num(from)) / 2;

/** Meters per combat round to km/h (table p. 200). */
export const kmh = (speed) => Math.round(num(speed) * 1.2);

/** Crash (p. 200): those inside resist (speed / 10) damage, rounded down, less safety features. */
export const crashDamage = (speed, safety = 0) => Math.max(0, Math.floor(num(speed) / 10) - Math.max(0, num(safety)));

/**
 * Ramming (p. 201, errata Feb 2020): (Body / 2, rounded up) + 1 per current Speed Interval, Physical. A target vehicle
 * does the same back from its own Body and speed; a soft target does (its Body / 4, rounded up).
 */
export const ramDamage = (body, intervals) => Math.ceil(num(body) / 2) + Math.max(0, num(intervals));
export const softTargetDamage = (body) => Math.ceil(num(body) / 4);

/** Vehicles ignore Stun damage with DV up to their Body, except electricity (errata Feb 2020). */
export const ignoresStun = (dv, body, electric = false) => !electric && num(dv) <= num(body);

/** The tests a driver makes, by operation mode: who rolls and with what (p. 197). */
export const JUMPED_IN = { bod: "wil", str: "cha", agi: "log", rea: "int" };
export const isRigged = (mode) => mode === "riggedAR" || mode === "riggedVR";
export const isDriven = (mode) => mode === "manual" || isRigged(mode);

/**
 * Driver's Handling pool (Piloting + Reaction; jumped in VR: Intuition) from the system's vehicle piloting pool.
 * The system subtracts speed and damage (⌊dmg / 3⌋) from the pool; the rulebook puts damage on the threshold
 * instead, so the damage part is given back here and speed alone stays as a dice penalty.
 */
export function handlingPool({ mode, systemPool, pilot, maneuver, speedPenalty, damagePenalty }) {
  if (isDriven(mode)) return Math.max(0, num(systemPool) + num(damagePenalty));
  return Math.max(0, num(maneuver) + num(pilot) - num(speedPenalty));
}

/** Autosoft tests of a drone acting on its own (p. 201): the autosoft as skill, Pilot or Sensor as attribute. */
export const AUTOSOFTS = {
  CLEARSIGHT: "sen", ELECTRONIC_WARFARE: "sen", EVASION: "pil", MANEUVER: "pil", STEALTH: "pil", TARGETING: "sen",
};

/** Pools for each autosoft: rating + attribute; without one, nothing — except Targeting: Sensor − 1. */
export function droneTests({ pil, sen }, ratings = {}) {
  return Object.entries(AUTOSOFTS).map(([id, attr]) => {
    const rating = num(ratings[id]);
    const value = attr === "pil" ? num(pil) : num(sen);
    if (rating > 0) return { id, attr, rating, pool: rating + value, missing: false };
    if (id === "TARGETING") return { id, attr, rating: 0, pool: Math.max(0, num(sen) - 1), missing: true };
    return { id, attr, rating: 0, pool: 0, missing: true };
  });
}

/** A drone on its own: Initiative Pilot × 2 + 4D6 (p. 201); autosoft slots Pilot / 2 rounded up. */
export const droneInitiative = (pilot) => ({ base: num(pilot) * 2, dice: 4 });
export const autosoftSlots = (pilot) => Math.ceil(num(pilot) / 2);

/** RCC (p. 197): slaved drones up to Rating × 3; it shares programs up to its Data Processing. */
export const rccSlaves = (rating) => num(rating) * 3;

/** Weapon mounts: unaugmented Body / 3, rounded down (pp. 200–201). */
export const weaponMounts = (body) => Math.floor(num(body) / 3);
