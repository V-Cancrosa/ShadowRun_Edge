/**
 * Toxins and drugs of the Shadowrun, Sixth World core rulebook (pp. 121–125), stats only. Availability and cost
 * per dose come from the August 2019 errata (Toxin Costs). Durations: { base, mult, unit, min } means
 * (base − Body) × mult units, at least `min`; { dice, mult, unit } means mult × dice units.
 * Speed: { rounds } in combat rounds (0 = immediate, at the end of this round) or { minutes }.
 */
const d = (base, mult, unit, min) => ({ base, mult, unit, min });
const dice = (formula, mult, unit) => ({ dice: formula, mult, unit });

export const TOXINS = [
  {
    id: "gamma_scopolamine", name: "Gamma-Scopolamine", vectors: ["injection"], speed: { rounds: 0 },
    duration: d(6, 30, "minutes", 30), power: 12, statuses: ["dazed", "immobilized"],
    changes: [{ attr: "wil", value: -3, note: "truthSerum" }], avail: "7(I)", cost: 200,
  },
  { id: "narcoject", name: "Narcoject", vectors: ["injection"], speed: { rounds: 0 }, duration: d(6, 1, "hours", 1), power: 15, damage: "stun", avail: "4(L)", cost: 50 },
  {
    id: "cs_gas", name: "CS/Tear Gas", vectors: ["contact", "inhalation"], speed: { rounds: 1 }, duration: d(6, 5, "minutes", 5),
    power: 8, damage: "stun", statuses: ["dazed", "nauseated"], avail: "2(L)", cost: 20,
  },
  {
    id: "nausea_gas", name: "Nausea Gas", vectors: ["inhalation"], speed: { rounds: 3 }, duration: d(6, 1, "minutes", 1),
    power: 9, statuses: ["dazed", "nauseated"], avail: "3(L)", cost: 25,
  },
  ...[["VIII", 9, "5(L)", 60], ["IX", 12, "6(L)", 60], ["X", 15, "7(L)", 100]].map(([grade, power, avail, cost]) => ({
    id: `neuro_stun_${grade.toLowerCase()}`, name: `Neuro-Stun ${grade}`, vectors: ["contact", "inhalation"], speed: { rounds: 1 },
    duration: d(6, 10, "minutes", 10), power, damage: "stun", statuses: ["dazed"], avail, cost,
  })),
  {
    id: "pepper_punch", name: "Pepper Punch", vectors: ["contact", "inhalation"], speed: { rounds: 1 }, duration: d(8, 20, "minutes", 20),
    power: 11, damage: "stun", statuses: ["blinding", "dazed", "nauseated"], avail: "", cost: 5,
  },
  {
    id: "seven_7", name: "Seven-7", vectors: ["contact", "inhalation"], speed: { rounds: 1 }, duration: d(6, 10, "minutes", 10),
    power: 12, damage: "physical", statuses: ["blinding", "dazed", "nauseated"], avail: "10(I)", cost: 1000,
  },
];

export const DRUGS = [
  { id: "alcohol", name: "Alcohol", vectors: ["ingestion"], speed: { minutes: 1 }, duration: d(8, 1, "hours", 1), power: 6, changes: [{ attr: "rea", value: -1 }, { attr: "log", value: -1 }], painHigh: true, avail: "", cost: 5 },
  { id: "bliss", name: "Bliss", vectors: ["inhalation", "injection"], speed: { rounds: 1 }, duration: d(6, 1, "hours", 1), power: 8, changes: [{ attr: "rea", value: -1 }, { attr: "wil", value: -1 }], painHigh: true, avail: "2(I)", cost: 15 },
  {
    id: "cram", name: "Cram", vectors: ["ingestion", "inhalation"], speed: { minutes: 10 }, duration: d(12, 1, "hours", 1), power: 8,
    changes: [{ attr: "rea", value: 1 }], iniDice: 1, crash: { stun: 6 }, avail: "2(L)", cost: 10,
  },
  {
    id: "deepweed", name: "Deepweed", vectors: ["ingestion", "inhalation"], speed: { rounds: 0 }, duration: d(6, 1, "hours", 1), power: 7,
    changes: [{ attr: "wil", value: 1 }], notes: ["astral"], crash: { pool: -1, factor: 1 }, avail: "4(I)", cost: 400,
  },
  {
    id: "jazz", name: "Jazz", vectors: ["inhalation"], speed: { rounds: 0 }, duration: dice("1d6", 10, "minutes"), power: 9,
    changes: [{ attr: "rea", value: 1 }], iniDice: 2, crash: { statuses: ["dazed"], factor: 1 }, avail: "2(L)", cost: 75,
  },
  {
    id: "kamikaze", name: "Kamikaze", vectors: ["inhalation"], speed: { rounds: 0 }, duration: dice("1d6", 10, "minutes"), power: 10,
    changes: [{ attr: "bod", value: 1 }, { attr: "agi", value: 1 }, { attr: "str", value: 2 }, { attr: "wil", value: 1 }], iniDice: 2, painHigh: true,
    crash: { stun: 6, changes: [{ attr: "rea", value: -1 }, { attr: "wil", value: -1 }], statuses: [["fatigued", 2]], factor: 2 }, avail: "3(L)", cost: 100,
  },
  { id: "long_haul", name: "Long Haul", vectors: ["injection"], speed: { minutes: 10 }, duration: { fixed: 4, unit: "days" }, power: 11, notes: ["noSleep"], avail: "", cost: 50 },
  {
    id: "nitro", name: "Nitro", vectors: ["inhalation"], speed: { rounds: 1 }, duration: dice("1d6", 10, "minutes"), power: 12,
    changes: [{ attr: "str", value: 2 }, { attr: "wil", value: 2 }], perception: 2, iniDice: 1, painHigh: true,
    crash: { stun: 9, pool: -2, factor: 1 }, avail: "2(L)", cost: 50,
  },
  {
    id: "novacoke", name: "Novacoke", vectors: ["inhalation", "injection"], speed: { rounds: 1 }, duration: d(10, 1, "hours", 1), power: 12,
    changes: [{ attr: "rea", value: 1 }, { attr: "cha", value: 1 }], perception: 1, painHigh: true, crash: { zero: ["cha", "wil"], factor: 1 },
    avail: "2(L)", cost: 10,
  },
  { id: "psyche", name: "Psyche", vectors: ["ingestion"], speed: { minutes: 10 }, duration: d(12, 1, "hours", 1), power: 8, changes: [{ attr: "int", value: 1 }, { attr: "log", value: 1 }], notes: ["psyche"], avail: "", cost: 200 },
  {
    id: "zen", name: "Zen", vectors: ["inhalation"], speed: { minutes: 5 }, duration: dice("1d6", 10, "minutes"), power: 7,
    changes: [{ attr: "rea", value: -2 }, { attr: "wil", value: 1 }], notes: ["zenPhysical"], avail: "3(L)", cost: 5,
  },
];

export const SUBSTANCES = [...TOXINS.map((t) => ({ ...t, kind: "toxin" })), ...DRUGS.map((x) => ({ ...x, kind: "drug" }))];

export const substance = (id) => SUBSTANCES.find((s) => s.id === id) ?? null;
