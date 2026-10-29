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

// ───── Attributes & skills tab ─────

export const PRIMARY = ["bod", "agi", "rea", "str", "wil", "log", "int", "cha"];
const SHORT_KEY = { bod: "bod", agi: "agi", rea: "rea", str: "str", wil: "wil", log: "log", int: "int", cha: "cha", mag: "magic", res: "magic", edg: "edge" };

/** Finds the metatype maxima from the free-text metatype ("Elf", "troll", "Krasnolud"…); unknown → human (6). */
export function metatypeMax(text, metatypes, L) {
  const t = String(text ?? "").trim().toLowerCase();
  const id = Object.keys(metatypes).find((m) => m === t || L(`SRE.Chargen.Metatype.${m}`).toLowerCase() === t);
  return (metatypes[id] ?? metatypes.human ?? { max: {} }).max;
}

/**
 * @param {object} actor   prepared actor; actor._source holds the editable values
 * @param {object} opts    { L, config: CONFIG.SR6, metatypes: METATYPES, skills: ordered skill ids, showAll }
 */
export function buildSkillsContext(actor, { L = (k) => k, config = {}, metatypes = {}, skills = [], showAll = true } = {}) {
  const s = actor.system ?? {};
  const src = actor._source?.system ?? s;
  const wound = typeof actor.getWoundModifier === "function" ? num(actor.getWoundModifier()) : monitorPenalty(s.physical) + monitorPenalty(s.stun);
  const max = metatypeMax(s.metatype, metatypes, L);
  const mortype = s.mortype ?? "mundane";
  const special = mortype === "technomancer" ? "res" : MAGIC_TYPES.has(mortype) ? "mag" : null;

  const attr = (id) => {
    const a = s.attributes?.[id] ?? {};
    const value = num(a.pool);
    const limit = id === "mag" || id === "res" ? 6 + num(a.initiation) : num(max[id], 6);
    return {
      id, short: L(`SRE.Chargen.Short.${SHORT_KEY[id] ?? id}`), label: L(`attrib.${id}`),
      value, base: num(src.attributes?.[id]?.base), mod: num(a.mod), max: limit, atMax: value >= limit,
      special: id === "mag" || id === "res",
    };
  };
  const attributes = PRIMARY.map(attr);
  if (special) attributes.push(attr(special));

  const defs = config.ATTRIB_BY_SKILL;
  const defFor = (id) => (defs instanceof Map ? defs.get(id) : defs?.[id]) ?? {};
  const list = skills
    .filter((id) => s.skills?.[id] && (id !== "tasking" || mortype === "technomancer"))
    .map((id) => {
      const sk = s.skills[id];
      const def = defFor(id);
      const points = num(src.skills?.[id]?.points);
      const specOptions = Object.entries(config.skill_special?.[id] ?? {}).map(([value, key]) => ({ value, label: L(key) }));
      const raw = num(sk.pool);
      return {
        id, label: L(`skill.${id}`), attr: def.attrib ? L(`attrib.${def.attrib}_short`) : "",
        points, trained: points > 0, untrainedAllowed: def.useUntrained !== false,
        pool: { raw, value: Math.max(0, raw - wound), minus: wound },
        specialization: src.skills?.[id]?.specialization ?? "",
        expertise: src.skills?.[id]?.expertise ?? "",
        specPool: sk.specialization ? Math.max(0, num(sk.poolS, raw + 2) - wound) : null,
        expPool: sk.expertise ? Math.max(0, num(sk.poolE, raw + 3) - wound) : null,
        specOptions,
      };
    });
  const items = [...(actor.items ?? [])].filter((i) => i.type === "skill");
  return {
    attributes,
    edgeAttr: { value: num(s.edge?.max), base: num(src.edge?.max), max: num(max.edge, 6), cap: EDGE_CAP },
    essence: num(s.essence, 6).toFixed(2),
    skills: showAll ? list : list.filter((x) => x.trained),
    trainedCount: list.filter((x) => x.trained).length,
    showAll,
    knowledge: items.filter((i) => i.system?.genesisID === "knowledge").map((i) => ({ id: i.id, name: i.name })),
    languages: items.filter((i) => i.system?.genesisID === "language").map((i) => ({ id: i.id, name: i.name, native: num(i.system?.points) >= 4 })),
  };
}

// ───── Combat tab ─────

const RANGED = new Set(["WEAPON_FIREARMS", "WEAPON_RANGED", "WEAPON_SPECIAL"]);
const stripHtml = (h) => String(h ?? "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();

export function buildCombatContext(actor, { L = (k) => k, config = {} } = {}) {
  const s = actor.system ?? {};
  const wound = typeof actor.getWoundModifier === "function" ? num(actor.getWoundModifier()) : monitorPenalty(s.physical) + monitorPenalty(s.stun);
  const items = [...(actor.items ?? [])];
  const modsOf = (w) => items
    .filter((m) => {
      if (m.type !== "mod") return false;
      const host = m.system?.embeddedInUuid;
      const into = m.system?.installedIn;
      return (host && host === w.uuid) || (into && (into.id ?? into) === w.id);
    })
    .map((m) => m.name);
  const ammoTypes = Object.entries(config.AMMO_TYPES ?? {}).map(([value, key]) => ({ value, label: L(key) }));

  const weapon = (i) => {
    const g = i.system ?? {};
    const cap = num(g.ammocap);
    const ar = (i.calculatedAttackRating ?? i.calculated?.attackRating ?? g.attackRating ?? []).slice(0, 5).map((v) => (num(v) > 0 ? String(v) : null));
    while (ar.length < 5) ar.push(null);
    const raw = num(g.pool) + num(g.modes?.dicePoolMod);
    const extras = [...modsOf(i), stripHtml(g.accessories)].filter(Boolean).join(", ");
    return {
      id: i.id, name: i.name, dv: g.dmgDef ?? "", modes: fireModesText(g.modes, L), ar, arFirst: ar[0] ?? "—", extras,
      pool: { raw, value: Math.max(0, raw - wound), minus: wound },
      ammo: cap > 0 ? { count: Math.min(num(g.ammocount), cap), cap, loaded: g.ammoLoaded ?? "regular",
        types: ammoTypes.map((t) => ({ ...t, selected: t.value === (g.ammoLoaded ?? "regular") })) } : null,
    };
  };
  const gear = items.filter((i) => i.type === "gear");
  const ranged = gear.filter((i) => RANGED.has(i.system?.type)).map(weapon);
  const melee = gear.filter((i) => i.system?.type === "WEAPON_CLOSE_COMBAT").map(weapon);

  // Unarmed: DV = STR/2 (rounded up) stun, AR = REA + STR, pool = Close Combat.
  const str = num(s.attributes?.str?.pool);
  const ccRaw = num(s.skills?.close_combat?.pool);
  const unarmed = { dv: `${Math.ceil(str / 2)}${L("SRE.Sheet.StunShort")}`, ar: num(s.attributes?.rea?.pool) + str,
    pool: { raw: ccRaw, value: Math.max(0, ccRaw - wound), minus: wound } };

  const armor = gear.filter((i) => i.system?.type === "ARMOR").map((i) => ({
    id: i.id, name: i.name, defense: num(i.system?.defense), social: num(i.system?.social), worn: !!i.system?.usedForPool,
  }));

  const dp = s.defensepool ?? {};
  const resist = [
    ["physical", "defense"], ["astral", "defense"], ["spells_direct", "defense"], ["spells_indirect", "defense"],
    ["spells_other", "defense"], ["toxin", "defense"], ["damage_physical", "soak"], ["damage_astral", "soak"],
  ].filter(([id]) => dp[id]).map(([id, kind]) => {
    const raw = num(dp[id].pool);
    const minus = kind === "soak" ? 0 : wound;
    return { id, kind, label: L(`SRE.Sheet.Resist.${id}`), raw, value: Math.max(0, raw - minus), minus };
  });

  return { ranged, melee, unarmed, armor, defenseRating: num(s.defenserating?.physical?.pool), resist };
}
