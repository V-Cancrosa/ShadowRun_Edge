/**
 * Context for the compact Edge sheets (NPC/Critter, Spirit, Vehicle): one page like a rulebook stat block.
 * Pure for tests; `actor` is the prepared actor (system, items, getWoundModifier?).
 */
import { monitorBoxes, monitorPenalty, buildCombatContext } from "./context.mjs";

const num = (v, d = 0) => (Number.isFinite(Number(v)) && v !== "" && v !== null ? Number(v) : d);
const ATTRS = ["bod", "agi", "rea", "str", "wil", "log", "int", "cha"];

function monitor(id, m, label, shift = 0) {
  return { id, label, max: num(m?.max), dmg: num(m?.dmg), boxes: monitorBoxes(m, shift), penalty: monitorPenalty(m, shift) };
}

const SHORT = { mag: "SRE.Chargen.Short.magic", res: "SRE.Compact.Res", ess: "SRE.Compact.Ess" };
const short = (id) => SHORT[id] ?? `SRE.Chargen.Short.${id}`;

function attributes(s, L, extra = []) {
  const list = ATTRS.map((id) => ({ id, label: L(short(id)), value: num(s.attributes?.[id]?.pool) }));
  for (const id of extra) {
    const value = id === "ess" ? num(s.essence, 0) : num(s.attributes?.[id]?.pool);
    if (value > 0) list.push({ id, label: L(short(id)), value: id === "ess" ? Number(value).toFixed(1).replace(/\.0$/, "") : value });
  }
  return list;
}

/** Trained skills as roll chips (pool includes the attribute, as the system computes it). */
function skills(s, L) {
  return Object.entries(s.skills ?? {})
    .filter(([, v]) => num(v?.points) > 0)
    .map(([id, v]) => ({ id, label: L(`skill.${id}`), pool: num(v?.pool) }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

const wound = (actor) => (typeof actor.getWoundModifier === "function" ? num(actor.getWoundModifier())
  : monitorPenalty(actor.system?.physical) + monitorPenalty(actor.system?.stun));

/** NPCs and critters. */
export function buildNpcContext(actor, { L = (k) => k, config = {} } = {}) {
  const s = actor.system ?? {};
  const items = [...(actor.items ?? [])];
  const monitors = [monitor("physical", s.physical, L("SRE.Sheet.Monitor.physical"), s.painResistance)];
  if (num(s.stun?.max) > 0) monitors.push(monitor("stun", s.stun, L("SRE.Sheet.Monitor.stun"), s.painResistance));
  if (num(s.overflow?.max) > 0) monitors.push(monitor("overflow", s.overflow, L("SRE.Sheet.Monitor.overflow")));
  const combat = buildCombatContext(actor, { L, config });
  const ini = s.initiative?.physical ?? {};
  return {
    kind: actor.type,
    rating: num(s.rating, 0),
    metatype: s.metatype ?? s.gruntmeta ?? "",
    attributes: attributes(s, L, ["ess", "mag", "res"]),
    monitors,
    wound: wound(actor),
    chips: [
      { label: L("SRE.Roll.DR"), value: num(s.defenserating?.physical?.pool) },
      { label: L("SRE.Sheet.InitiativeTitle"), value: `${num(ini.pool)}+${num(ini.dicePool ?? ini.dice)}K6` },
      { label: L("SRE.Compact.Move"), value: `${num(s.walk, 10)}/${num(s.sprint, 15)}` },
    ],
    initiative: { base: num(ini.pool), dice: num(ini.dicePool ?? ini.dice) },
    skills: skills(s, L),
    weapons: [...combat.ranged, ...combat.melee],
    unarmed: combat.unarmed,
    resist: [
      { kind: "defense", id: "physical", label: L("SRE.Compact.Defense"), pool: num(s.defensepool?.physical?.pool) },
      { kind: "soak", id: "damage_physical", label: L("SRE.Compact.Soak"), pool: num(s.defensepool?.damage_physical?.pool) },
      { kind: "derived", id: "resist_toxin", label: L("SRE.Compact.Toxins"), pool: num(s.derived?.resist_toxin?.pool) },
    ].filter((r) => r.pool > 0),
    spells: items.filter((i) => i.type === "spell").map((i) => ({ id: i.id, name: i.name, drain: num(i.system?.drain) })),
    powers: items.filter((i) => ["critterpower", "adeptpower"].includes(i.type)).map((i) => ({ id: i.id, name: i.name, type: i.type })),
    gear: items.filter((i) => i.type === "gear" && !String(i.system?.type ?? "").startsWith("WEAPON")).map((i) => ({ id: i.id, name: i.name })),
    notes: s.notes ?? "",
  };
}

/** Spirits: Force, type, services from the module's summoning flag. */
export function buildSpiritContext(actor, { L = (k) => k, config = {} } = {}) {
  const npc = buildNpcContext(actor, { L, config });
  const s = actor.system ?? {};
  const flag = actor.flags?.["shadowrun-edge"]?.spirit ?? null;
  const astral = s.initiative?.astral ?? {};
  return {
    ...npc,
    force: num(s.rating, 1),
    spiritType: s.spiritType ?? "",
    services: flag ? num(flag.services) : null,
    summoner: flag?.summoner ?? null,
    chips: [
      ...(flag ? [{ label: L("SRE.Compact.Services"), value: num(flag.services) }] : []),
      npc.chips[1],
      { label: L("SRE.Compact.AstralIni"), value: `${num(astral.pool)}+${num(astral.dicePool ?? astral.dice)}K6` },
    ],
  };
}

/** Vehicles and drones. */
export function buildVehicleContext(actor, { L = (k) => k, config = {} } = {}) {
  const s = actor.system ?? {};
  const items = [...(actor.items ?? [])];
  const combat = buildCombatContext(actor, { L, config });
  const sk = (id) => num(s.skills?.[id]?.pool);
  const bod = num(s.bod);
  const autosofts = items.filter((i) => i.type === "software" || (i.type === "gear" && i.system?.type === "AUTOSOFT"))
    .map((i) => ({ id: i.id, name: i.name, rating: num(i.system?.rating) }));
  const monitors = [monitor("physical", s.physical, L("SRE.Sheet.Monitor.physical"))];
  if (num(s.stun?.max) > 0) monitors.push(monitor("stun", s.stun, L("SRE.Compact.MatrixMonitor")));
  return {
    kind: "Vehicle",
    vtype: s.vtype ?? "",
    stats: [
      { label: L("SRE.Compact.Handling"), value: `${num(s.handlOn)}/${num(s.handlOff)}`, hint: L("SRE.Compact.OnOff") },
      { label: L("SRE.Compact.Accel"), value: num(s.accOn), hint: num(s.accOff) && num(s.accOff) !== num(s.accOn) ? `${num(s.accOn)}/${num(s.accOff)}` : "" },
      { label: L("SRE.Compact.SpeedInterval"), value: num(s.spdiOn), hint: "" },
      { label: L("SRE.Compact.TopSpeed"), value: num(s.tspd), hint: "" },
      { label: L("SRE.Compact.Body"), value: bod, hint: "" },
      { label: L("SRE.Compact.Armor"), value: num(s.arm), hint: "" },
      { label: L("SRE.Compact.Pilot"), value: num(s.pil), hint: "" },
      { label: L("SRE.Compact.Sensor"), value: num(s.sen), hint: "" },
    ],
    chips: [
      { label: L("SRE.Compact.TopSpeed"), value: num(s.tspd) },
      { label: L("SRE.Roll.DR"), value: bod + num(s.arm) },
      { label: L("SRE.Compact.Seats"), value: num(s.sea) },
    ],
    monitors,
    tests: [
      { id: "piloting", label: L("SRE.Compact.Test.piloting"), pool: sk("piloting") || num(s.pil) },
      { id: "evasion", label: L("SRE.Compact.Test.evasion"), pool: sk("evasion") },
      { id: "perception", label: L("SRE.Compact.Test.perception"), pool: sk("perception") || num(s.sen) },
      { id: "stealth", label: L("SRE.Compact.Test.stealth"), pool: sk("stealth") },
      { id: "cracking", label: L("SRE.Compact.Test.cracking"), pool: sk("cracking") },
    ].filter((t) => t.pool > 0),
    soak: bod * 2, // Body × 2 as in the explosion examples (p. 114); ramming uses Body alone (p. 201)
    weapons: [...combat.ranged, ...combat.melee],
    autosofts,
    // 13D: the stats as fields (edited on the sheet) and the rest of what the vehicle carries.
    fields: [
      ["handlOn", "SRE.Garage.Stat.handlOn"], ["handlOff", "SRE.Garage.Stat.handlOff"], ["accOn", "SRE.Garage.Stat.accOn"], ["accOff", "SRE.Garage.Stat.accOff"],
      ["spdiOn", "SRE.Garage.Stat.spdiOn"], ["spdiOff", "SRE.Garage.Stat.spdiOff"], ["tspd", "SRE.Compact.TopSpeed"], ["bod", "SRE.Compact.Body"],
      ["arm", "SRE.Compact.Armor"], ["pil", "SRE.Compact.Pilot"], ["sen", "SRE.Compact.Sensor"], ["sea", "SRE.Compact.Seats"],
    ].map(([id, key]) => ({ name: `system.${id}`, label: L(key), value: num(s[id]) })),
    equipment: items.filter((i) => i.type === "gear" && !String(i.system?.type ?? "").startsWith("WEAPON") && i.system?.type !== "AUTOSOFT")
      .map((i) => ({ id: i.id, name: i.name, img: i.img, rating: num(i.system?.rating) })),
    notes: s.notes ?? "",
  };
}

/** Grunt group members on the scene (tokens sharing the system's GruntGroupId), with the system's bonuses. */
export function gruntGroup(groupId, tokens) {
  if (groupId === undefined || groupId === null || groupId === "") return null;
  const members = tokens.filter((t) => String(t.groupId) === String(groupId));
  const n = members.length;
  return {
    id: groupId,
    members: members.map((t) => ({ name: t.name, dmg: num(t.dmg), max: num(t.max), down: num(t.max) > 0 && num(t.dmg) >= num(t.max) })),
    arMod: Math.max(0, n - 1),
    diceMod: Math.max(0, Math.floor((n - 1) / 2)),
  };
}

/**
 * Hosts (system 4.x "host" actors, pp. 185–187): rating, ASDF, Convergence threshold, IC with the target's
 * defense and effect, and the personas inside (from their module access records).
 * @param {object[]} personas  [{ name, access, illegal, os }]
 */
export function buildHostContext(actor, { L = (k) => k, IC = {}, icStats = () => ({}), personas = [] } = {}) {
  const s = actor.system ?? {};
  const a = s.matrix?.attributes ?? {};
  const rating = num(s.rating, 1);
  const stats = icStats(rating, num(a.dataProcessing));
  const running = new Set(actor.flags?.["shadowrun-edge"]?.ic ?? []);
  const asdf = (id) => (["a", "s", "d", "f"].includes(id) ? L(`SRE.Sheet.Asdf.${id}`) : L(`attrib.${id}`));
  return {
    kind: "Host",
    rating,
    tiles: [
      { label: L("SRE.Compact.Rating"), value: rating, name: "system.rating" },
      { label: L("SRE.Sheet.Asdf.a"), value: num(a.attack) },
      { label: L("SRE.Sheet.Asdf.s"), value: num(a.sleaze) },
      { label: L("SRE.Sheet.Asdf.d"), value: num(a.dataProcessing) },
      { label: L("SRE.Sheet.Asdf.f"), value: num(a.firewall) },
      { label: L("SRE.Matrix.Convergence"), value: num(s.convergenceThreshold, 40) },
    ],
    icInfo: L("SRE.Matrix.IC.Info", { pool: num(stats.pool), monitor: num(stats.monitor), ini: `${num(stats.initiative?.base)}+${num(stats.initiative?.dice)}`, max: num(stats.maxRunning) }),
    running: running.size,
    ic: Object.entries(IC).map(([id, ic]) => ({
      id, label: L(`SRE.Matrix.IC.${id}`), defense: ic.defense.map(asdf).join(" + ") || "—",
      effect: L(`SRE.Matrix.IC.Desc.${id}`), on: running.has(id), attacks: ic.effect !== "perception",
    })),
    personas: personas.map((p) => ({ ...p, cls: p.access === "admin" ? (p.illegal ? "a" : "l") : p.access === "user" ? (p.illegal ? "u" : "l") : "" })),
    notes: s.description ?? s.notes ?? "",
  };
}

/**
 * Sprites (system 4.x "sprite" actors, core pp. 192–195): level, type, tasks, the five attributes, Matrix
 * attributes, skills as test pools (skill + attribute as the system computes them), Matrix Initiative and monitor,
 * and the sprite's powers. Pure for tests.
 */
export function buildSpriteContext(actor, { L = (k) => k } = {}) {
  const s = actor.system ?? {};
  const attrs = s.attributes ?? {};
  const pool = (a) => num(a?.pool, num(a?.rank) + num(a?.mod));
  const m = s.matrix?.attributes ?? {};
  const skillAttr = { electronics: "logic", engineering: "logic", cracking: "logic", con: "charisma" };
  const skills = Object.entries(skillAttr).map(([id, attr]) => {
    const sk = s.skills?.[id];
    let value = 0;
    try {
      value = typeof sk?.testPool === "function" ? num(sk.testPool()) : num(sk?.rank) + num(sk?.mod) + pool(attrs[attr]);
    } catch {
      value = 0;
    }
    return { id, label: L(`skill.${id}`), attr: L(`SRE.Sprite.Attr.${attr}`), pool: value };
  }).filter((x) => x.pool > 0);
  const cm = s.matrix?.matrixCM ?? {};
  const max = num(cm.max);
  const dmg = cm.dmg !== undefined ? num(cm.dmg) : Math.max(0, max - num(cm.value, max));
  const ini = s.initiative?.matrix ?? {};
  return {
    kind: "sprite",
    level: num(s.level, 1),
    type: s.type ?? "",
    tasks: num(s.tasksOwned),
    registered: !!s.registered,
    attributes: ["willpower", "logic", "intuition", "charisma", "resonance"].map((id) => ({ id, label: L(`SRE.Sprite.Attr.${id}`), value: pool(attrs[id]) })),
    asdf: [["attack", "a"], ["sleaze", "s"], ["dataProcessing", "d"], ["firewall", "f"]].map(([id, k]) => ({ id, label: L(`SRE.Sheet.Asdf.${k}`), value: num(m[id]) })),
    skills,
    initiative: { base: num(ini.rank, num(ini.pool)), dice: num(ini.dice, 1) },
    monitor: { max, dmg, boxes: Array.from({ length: max }, (_, i) => ({ index: i + 1, on: i < dmg })) },
    powers: [...(actor.items ?? [])].filter((i) => i.type === "spritepower").map((i) => ({ id: i.id, name: i.name, img: i.img })),
    notes: s.description ?? s.notes ?? "",
  };
}
