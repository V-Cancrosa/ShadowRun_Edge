/**
 * Turns an evaluated character draft into shadowrun6-eden Actor data ("Player") plus its embedded items
 * (qualities, knowledge and language skills, contacts). Field names follow the system's template.json.
 */
import { ATTRIBUTES, MAGIC_TYPES, SKILLS } from "./rules.mjs";

const MODULE_ID = "shadowrun-edge";

/** Character effects of qualities, using the system's effect paths (see CONFIG.SR6.ACTIVE_EFFECT_OPTIONS). */
const QUALITY_EFFECT_KEYS = {
  physical: "system.physical.mod",
  stun: "system.stun.mod",
  overflow: "system.overflow.mod",
  defenseRating: "system.defenserating.physical.mod",
};

const ATTRIBUTE_DEFAULTS = { mod: 0, modString: "", augment: 0 };
const SPECIAL_DEFAULTS = { mod: 0, min: 0 };
const SKILL_DEFAULTS = { expertise: "", modifier: 0, augment: 0, expandedSpecializations: [] };

/**
 * Fields an actor made by creator versions up to 0.5.0 may lack (they were written without mod/modifier).
 * @param {object} system  the actor's source system data
 * @returns {object} a flat update ({ "system.attributes.bod.mod": 0, ... }), empty when nothing is missing
 */
export function repairUpdate(system) {
  const update = {};
  const fill = (path, obj, defaults) => {
    for (const [k, v] of Object.entries(defaults)) {
      const ok = typeof v === "number" ? Number.isFinite(obj?.[k]) : obj?.[k] !== undefined;
      if (!ok) update[`system.${path}.${k}`] = v;
    }
  };
  for (const a of ATTRIBUTES) if (system?.attributes?.[a]) fill(`attributes.${a}`, system.attributes[a], ATTRIBUTE_DEFAULTS);
  for (const a of ["mag", "res"]) if (system?.attributes?.[a]) fill(`attributes.${a}`, system.attributes[a], SPECIAL_DEFAULTS);
  for (const s of SKILLS) if (system?.skills?.[s]) fill(`skills.${s}`, system.skills[s], SKILL_DEFAULTS);
  return update;
}

function qualityItem(q, karma, label) {
  const def = q.def;
  const level = def.levels ? q.level : null;
  const name = [def.name, q.detail ? `(${q.detail})` : null, level ? level : null].filter(Boolean).join(" ");
  const effects = (def.effects ?? []).map((e) => ({
    name: `${def.name}${level ? ` ${level}` : ""}`,
    img: "icons/svg/aura.svg",
    type: "base",
    disabled: false,
    transfer: true,
    changes: [{ key: QUALITY_EFFECT_KEYS[e.target], mode: 2, value: String(e.perLevel ? e.perLevel * (level ?? 1) : e.value) }],
    system: { level: 1, advanced: false },
  }));
  return {
    name,
    type: "quality",
    img: "systems/shadowrun6-eden/icons/compendium/default/Default_Skill.svg",
    system: {
      category: def.positive ? "ADVANTAGE" : "DISADVANTAGE",
      level: !!def.levels,
      value: level ?? 0,
      explain: [q.detail, q.racial ? label.racial : null].filter(Boolean).join(" · "),
      product: "core",
      page: def.page,
    },
    effects,
    flags: { [MODULE_ID]: { quality: { id: def.id, level, karma, racial: q.racial } } },
  };
}

/**
 * @param {object} draft     the creator's draft
 * @param {object} result    evaluateDraft(draft)
 * @param {object} label     localized strings: { metatype, racial, knowledge, language }
 * @returns {{ actor: object, items: object[] }}
 */
export function buildCharacter(draft, result, label) {
  const magic = MAGIC_TYPES[draft.magicType] ?? MAGIC_TYPES.mundane;
  // Write complete entries: the system computes pools as base + mod (points + modifier), so a missing
  // field gives NaN and every roll ends up as 0d6.
  const attributes = Object.fromEntries(ATTRIBUTES.map((a) => [a, { ...ATTRIBUTE_DEFAULTS, base: result.final[a], pool: result.final[a] }]));
  const magicValue = (a) => (magic.attribute === a ? result.final.magic : 0);
  attributes.mag = { ...SPECIAL_DEFAULTS, base: magicValue("mag"), pool: magicValue("mag") };
  attributes.res = { ...SPECIAL_DEFAULTS, base: magicValue("res"), pool: magicValue("res") };
  const skills = Object.fromEntries(SKILLS.map((s) => [s, {
    ...SKILL_DEFAULTS,
    points: result.skills[s].rank,
    specialization: result.skills[s].spec ?? "",
  }]));

  const actor = {
    name: draft.name?.trim() || label.unnamed,
    type: "Player",
    system: {
      metatype: label.metatype,
      mortype: magic.mortype,
      attributes,
      edge: { max: result.final.edge, value: result.final.edge },
      skills,
      karma: Math.max(0, result.karmaLeft),
      karma_total: 0,
      nuyen: result.nuyen,
      notes: draft.concept ? `<p>${String(draft.concept).replace(/</g, "&lt;")}</p>` : "",
    },
    flags: { [MODULE_ID]: { chargen: { draft, level: draft.level, priorities: draft.priorities } } },
  };

  const items = [];
  for (const q of result.qualities) {
    const karma = q.racial ? 0 : (q.def.variable ? q.karma : q.def.karma * (q.def.levels ? q.level : 1));
    items.push(qualityItem(q, karma, label));
  }
  for (const k of draft.knowledge ?? []) {
    if (!k.name?.trim()) continue;
    items.push({ name: k.name.trim(), type: "skill", system: { genesisID: "knowledge", points: 1 } });
  }
  for (const l of draft.languages ?? []) {
    if (!l.name?.trim()) continue;
    // Language levels on the system sheet: 1 basic, 4 native.
    items.push({ name: l.name.trim(), type: "skill", system: { genesisID: "language", points: l.native ? 4 : 1 } });
  }
  for (const c of draft.contacts ?? []) {
    if (!c.name?.trim()) continue;
    items.push({
      name: c.name.trim(),
      type: "contact",
      system: { name: c.name.trim(), rating: Number(c.connection) || 1, loyalty: Number(c.loyalty) || 1, type: c.type ?? "" },
    });
  }
  return { actor, items };
}
