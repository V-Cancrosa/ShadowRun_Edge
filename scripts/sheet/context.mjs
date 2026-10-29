/**
 * Data for the Edge sheet, computed from a shadowrun6-eden actor (prepared data).
 * Pure: no Foundry globals, so tools/test_sheet.mjs can run it in node.
 */

export const EDGE_CAP = 7;
const MAGIC_TYPES = new Set(["magician", "mysticadept", "aspectedmagician", "adept"]);
const ASTRAL_TYPES = new Set(["magician", "mysticadept", "aspectedmagician"]);

const num = (v, d = 0) => (Number.isFinite(Number(v)) && v !== "" && v !== null ? Number(v) : d);

/** Wound penalty of one monitor, following the system: -1 per 3 boxes, plus one when the last partial row is full. */
export function monitorPenalty(monitor) {
  const max = num(monitor?.max);
  const dmg = Math.min(num(monitor?.dmg), max);
  const remain = max - dmg;
  let mod = Math.floor(dmg / 3);
  if (remain > 0 && max % 3 === remain) mod++;
  return mod;
}

/** Box list for a monitor; every third box carries the penalty label. */
export function monitorBoxes(monitor) {
  const max = num(monitor?.max);
  const dmg = num(monitor?.dmg);
  return Array.from({ length: max }, (_, i) => ({
    index: i + 1,
    filled: i < dmg,
    label: (i + 1) % 3 === 0 ? `−${(i + 1) / 3}` : "",
  }));
}

export function attackRatingText(ar) {
  if (!Array.isArray(ar)) return "—";
  return ar.slice(0, 5).map((v) => (num(v, -1) > 0 ? String(v) : "—")).join("/");
}

export function fireModesText(modes, L) {
  if (!modes) return "";
  return ["SS", "SA", "BF", "FA"].filter((m) => modes[m]).map((m) => L(`shadowrun6.item.mode_${m.toLowerCase()}`)).join("/");
}

/** A pool shown with the wound penalty already applied (never below zero). */
function pool(base, wound, { label, roll, woundless = false } = {}) {
  const raw = num(base);
  const minus = woundless ? 0 : wound;
  return { label, roll, raw, value: Math.max(0, raw - minus), minus };
}

/**
 * @param {object} actor   the actor document (prepared): { name, img, system, items, getWoundModifier? }
 * @param {object} opts    { L: localize, config: CONFIG.SR6 }
 */
export function buildSheetContext(actor, { L = (k) => k, config = {} } = {}) {
  const s = actor.system ?? {};
  const wound = typeof actor.getWoundModifier === "function"
    ? num(actor.getWoundModifier())
    : monitorPenalty(s.physical) + monitorPenalty(s.stun);
  const mortype = s.mortype ?? "mundane";

  const edgeValue = num(s.edge?.value);
  const edgeMax = num(s.edge?.max);
  const edge = {
    value: edgeValue,
    max: edgeMax,
    pips: Array.from({ length: EDGE_CAP }, (_, i) => ({ index: i + 1, on: i < edgeValue, available: i < edgeMax })),
    canGain: edgeValue < Math.min(edgeMax, EDGE_CAP),
    canSpend: edgeValue > 0,
  };

  const monitor = (id, m, label) => ({
    id, label, max: num(m?.max), dmg: num(m?.dmg), boxes: monitorBoxes(m), penalty: id === "overflow" ? 0 : monitorPenalty(m),
  });
  const monitors = [monitor("physical", s.physical, L("SRE.Sheet.Monitor.physical")), monitor("stun", s.stun, L("SRE.Sheet.Monitor.stun"))];
  if (num(s.overflow?.max) > 0) monitors.push(monitor("overflow", s.overflow, L("SRE.Sheet.Monitor.overflow")));

  const ini = (id, i) => ({ id, label: L(`SRE.Sheet.Initiative.${id}`), base: num(i?.pool), dice: num(i?.dicePool, num(i?.dice)) });
  const initiative = [ini("physical", s.initiative?.physical)];
  if (ASTRAL_TYPES.has(mortype)) initiative.push(ini("astral", s.initiative?.astral));
  initiative.push(ini("matrix", s.initiative?.matrix));
  const actions = { major: 1, minor: 1 + initiative[0].dice };

  const skillPool = (id) => num(s.skills?.[id]?.pool);
  const quick = [
    pool(s.defensepool?.physical?.pool, wound, { label: L("SRE.Sheet.Quick.defense"), roll: { kind: "defense", id: "physical" } }),
    pool(s.defensepool?.damage_physical?.pool, wound, { label: L("SRE.Sheet.Quick.soak"), roll: { kind: "soak", id: "damage_physical" }, woundless: true }),
    pool(skillPool("perception"), wound, { label: L("SRE.Sheet.Quick.perception"), roll: { kind: "skill", id: "perception" } }),
    pool(s.derived?.composure?.pool, wound, { label: L("SRE.Sheet.Quick.composure"), roll: { kind: "derived", id: "composure" } }),
    pool(s.derived?.judge_intentions?.pool, wound, { label: L("SRE.Sheet.Quick.judge_intentions"), roll: { kind: "derived", id: "judge_intentions" } }),
    pool(s.derived?.memory?.pool, wound, { label: L("SRE.Sheet.Quick.memory"), roll: { kind: "derived", id: "memory" } }),
  ];

  const defense = {
    rating: num(s.defenserating?.physical?.pool),
    test: quick[0],
    soak: quick[1],
    liftCarry: num(s.derived?.lift_carry?.pool),
    walk: num(s.walk), sprint: num(s.sprint), perHit: num(s.perHit),
  };

  const items = [...(actor.items ?? [])];
  const weapons = items
    .filter((i) => i.type === "gear" && String(i.system?.type ?? "").startsWith("WEAPON_"))
    .map((i) => {
      const g = i.system ?? {};
      const cap = num(g.ammocap);
      const count = Math.min(num(g.ammocount), cap);
      const melee = g.type === "WEAPON_CLOSE_COMBAT";
      const ar = attackRatingText(i.calculatedAttackRating ?? i.calculated?.attackRating ?? g.attackRating);
      return {
        id: i.id, name: i.name, img: i.img,
        pool: pool(num(g.pool) + num(g.modes?.dicePoolMod), wound),
        dv: g.dmgDef ?? "",
        // Close combat weapons have one Attack Rating (the first range).
        ar: melee ? ar.split("/")[0] : ar,
        modes: fireModesText(g.modes, L),
        ammo: cap > 0 ? { count, cap, rounds: Array.from({ length: Math.min(cap, 40) }, (_, n) => n < count) } : null,
        melee,
      };
    });

  const sorcery = skillPool("sorcery");
  const spells = MAGIC_TYPES.has(mortype) ? items.filter((i) => i.type === "spell").map((i) => ({
    id: i.id, name: i.name, img: i.img,
    pool: pool(sorcery, wound),
    drain: i.system?.drain ?? "",
    drainPool: num(s.defensepool?.drain?.pool),
    category: i.system?.category ? L(config.spell_category?.[i.system.category] ?? i.system.category) : "",
  })) : [];

  const warnings = [];
  if (wound > 0) warnings.push({ level: "warn", text: L("SRE.Sheet.Warn.wound").replace("{wound}", wound) });
  const essence = num(s.essence, 6);
  if (essence < 1) warnings.push({ level: "bad", text: L("SRE.Sheet.Warn.essence") });
  if (edgeMax > EDGE_CAP) warnings.push({ level: "warn", text: L("SRE.Sheet.Warn.edgeCap") });

  return {
    name: actor.name,
    img: actor.img,
    initial: String(actor.name ?? "?").trim().charAt(0).toUpperCase(),
    tags: [
      s.metatype ? { text: s.metatype, kind: "accent" } : null,
      s.gender ? { text: s.gender, kind: "dim" } : null,
      { text: L(config.MOR_TYPES?.[mortype] ?? mortype), kind: "cyan" },
    ].filter(Boolean),
    chips: [
      { id: "karma", label: L("SRE.Sheet.Karma"), value: num(s.karma), extra: `/ ${num(s.karma_total)}` },
      { id: "nuyen", label: L("SRE.Sheet.Nuyen"), value: `${num(s.nuyen).toLocaleString()}¥` },
      { id: "reputation", label: L("SRE.Sheet.Reputation"), value: num(s.reputation) },
      { id: "heat", label: L("SRE.Sheet.Heat"), value: num(s.heat) },
      { id: "essence", label: L("SRE.Sheet.Essence"), value: essence.toFixed(2), kind: "cyan" },
    ],
    edge, monitors, wound, initiative, actions, defense, quick, weapons, spells, warnings,
  };
}
