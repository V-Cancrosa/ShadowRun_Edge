/**
 * Character creation rules of the SR6 core rulebook (pp. 62–69), as pure functions so they can be tested in Node.
 * `evaluateDraft(draft)` returns every budget, the final values and the rule violations of a character draft.
 */
import { QUALITIES } from "./qualities.mjs";

export const ROWS = ["A", "B", "C", "D", "E"];
export const COLUMNS = ["metatype", "attributes", "skills", "magic", "resources"];
export const ATTRIBUTES = ["bod", "agi", "rea", "str", "wil", "log", "int", "cha"];
export const SKILLS = [
  "astral", "athletics", "biotech", "close_combat", "con", "conjuring", "cracking", "electronics", "enchanting",
  "engineering", "exotic_weapons", "firearms", "influence", "outdoors", "perception", "piloting", "sorcery",
  "stealth", "tasking",
];

/** Priority table (p. 64). */
export const PRIORITY = {
  A: { metatypes: ["dwarf", "ork", "troll"], adjustment: 13, attributes: 24, skills: 32,
    magic: { full: 4, aspected: 5, mystic: 4, adept: 4, techno: 4 }, resources: 450000 },
  B: { metatypes: ["dwarf", "elf", "ork", "troll"], adjustment: 11, attributes: 16, skills: 24,
    magic: { full: 3, aspected: 4, mystic: 3, adept: 3, techno: 3 }, resources: 275000 },
  C: { metatypes: ["dwarf", "elf", "human", "ork", "troll"], adjustment: 9, attributes: 12, skills: 20,
    magic: { full: 2, aspected: 3, mystic: 2, adept: 2, techno: 2 }, resources: 150000 },
  D: { metatypes: ["dwarf", "elf", "human", "ork", "troll"], adjustment: 4, attributes: 8, skills: 16,
    magic: { full: 1, aspected: 2, mystic: 1, adept: 1, techno: 1 }, resources: 50000 },
  E: { metatypes: ["dwarf", "elf", "human", "ork", "troll"], adjustment: 1, attributes: 2, skills: 10,
    magic: { mundane: 0 }, resources: 8000 },
};

/** Metatype attribute maximums and racial qualities (p. 65). Every range starts at 1. */
export const METATYPES = {
  human: { max: { bod: 6, agi: 6, rea: 6, str: 6, wil: 6, log: 6, int: 6, cha: 6, edge: 7 }, racial: [] },
  dwarf: { max: { bod: 7, agi: 6, rea: 5, str: 8, wil: 7, log: 6, int: 6, cha: 6, edge: 6 },
    racial: ["toxin_resistance", "thermographic_vision"] },
  elf: { max: { bod: 6, agi: 7, rea: 6, str: 6, wil: 6, log: 6, int: 6, cha: 8, edge: 6 }, racial: ["low_light_vision"] },
  ork: { max: { bod: 8, agi: 6, rea: 6, str: 8, wil: 6, log: 6, int: 6, cha: 5, edge: 6 },
    racial: ["low_light_vision", { id: "built_tough", level: 1 }] },
  troll: { max: { bod: 9, agi: 5, rea: 6, str: 9, wil: 6, log: 6, int: 6, cha: 5, edge: 6 },
    racial: ["dermal_deposits", "thermographic_vision", { id: "built_tough", level: 2 }] },
};

/** Magic or Resonance choices and the system's mortype for each. */
export const MAGIC_TYPES = {
  full: { mortype: "magician", attribute: "mag" },
  aspected: { mortype: "aspectedmagician", attribute: "mag" },
  mystic: { mortype: "mysticadept", attribute: "mag" },
  adept: { mortype: "adept", attribute: "mag" },
  techno: { mortype: "technomancer", attribute: "res" },
  mundane: { mortype: "mundane", attribute: null },
};

export const KARMA = { standard: 50, street: 50, prime: 100 };
export const NUYEN_PER_KARMA = 2000;
export const NUYEN_PER_KARMA_IN_DEBT = 5000;

/** Karma to raise an attribute or skill from `from` to `to`: 5 × each new rank (p. 68–69). */
export function advancementCost(from, to) {
  let cost = 0;
  for (let rank = from + 1; rank <= to; rank++) cost += 5 * rank;
  return cost;
}

/** Priority row whose values apply: street-level runners use one row lower (p. 63). */
export function effectiveRow(letter, level) {
  if (level !== "street") return letter;
  return ROWS[Math.min(ROWS.indexOf(letter) + 1, ROWS.length - 1)];
}

const n = (v) => Math.max(0, Math.trunc(Number(v) || 0));

export function emptyDraft() {
  return {
    name: "",
    concept: "",
    level: "standard",
    priorities: { metatype: "", attributes: "", skills: "", magic: "", resources: "" },
    metatype: "human",
    magicType: "mundane",
    attrPoints: Object.fromEntries(ATTRIBUTES.map((a) => [a, 0])),
    attrKarma: Object.fromEntries([...ATTRIBUTES, "edge", "magic"].map((a) => [a, 0])),
    adjust: Object.fromEntries([...ATTRIBUTES, "edge", "magic"].map((a) => [a, 0])),
    skills: Object.fromEntries(SKILLS.map((s) => [s, { points: 0, karma: 0, spec: "", specKarma: false }])),
    qualities: [],
    karmaToNuyen: 0,
    contacts: [],
    knowledge: [],
    languages: [{ name: "", native: true }],
  };
}

/** Qualities a draft has, racial ones included, as [{ def, level, detail, racial }]. */
export function draftQualities(draft) {
  const racial = (METATYPES[draft.metatype]?.racial ?? []).map((q) => {
    const { id, level } = typeof q === "string" ? { id: q, level: 1 } : q;
    return { def: QUALITIES[id], level, detail: "", racial: true };
  });
  const chosen = (draft.qualities ?? [])
    .filter((q) => QUALITIES[q.id])
    .map((q) => ({ def: QUALITIES[q.id], level: Math.max(1, n(q.level) || 1), detail: q.detail ?? "", karma: q.karma, racial: false }));
  return [...racial, ...chosen];
}

/** Karma of a chosen quality: cost for positive, bonus for negative (Allergy's bonus is chosen, 2–20). */
export function qualityKarma(q) {
  if (q.racial) return 0;
  if (q.def.variable) return Math.min(q.def.max ?? 20, Math.max(q.def.min ?? 0, n(q.karma)));
  return q.def.karma * (q.def.levels ? q.level : 1);
}

/**
 * Evaluates a draft: budgets ({ total, used }), final values and errors ([{ key, data }], keys under SRE.Chargen.Error).
 */
export function evaluateDraft(draft) {
  const errors = [];
  const err = (key, data = {}) => errors.push({ key, data });
  const p = draft.priorities ?? {};
  const level = draft.level ?? "standard";

  // Priorities: each row once.
  const letters = COLUMNS.map((c) => p[c]).filter(Boolean);
  if (letters.length < COLUMNS.length) err("PriorityMissing");
  if (new Set(letters).size !== letters.length) err("PriorityTwice");
  const row = (column) => (p[column] ? PRIORITY[effectiveRow(p[column], level)] : null);

  const metaRow = row("metatype");
  const meta = METATYPES[draft.metatype] ?? METATYPES.human;
  if (p.metatype && !PRIORITY[p.metatype].metatypes.includes(draft.metatype)) err("MetatypeRow", { row: p.metatype });

  const magicRow = row("magic");
  const magicOptions = magicRow ? magicRow.magic : {};
  const magicType = draft.magicType ?? "mundane";
  if (p.magic && !(magicType in magicOptions)) err("MagicRow", { row: p.magic });
  const magicBase = magicOptions[magicType] ?? 0;
  const awakened = magicType !== "mundane" && magicBase > 0;

  const qualities = draftQualities(draft);
  const has = (id) => qualities.filter((q) => q.def.id === id);

  // Attribute maximums: metatype, Exceptional (+1, max 10), Impaired (−level, min 2).
  const max = { ...meta.max, magic: 6 };
  for (const q of has("exceptional")) if (q.detail in max) max[q.detail] = Math.min(10, max[q.detail] + 1);
  for (const q of has("impaired")) if (q.detail in max) max[q.detail] = Math.max(2, max[q.detail] - q.level);

  // Adjustment points: Edge, Magic/Resonance and special racial attributes (those above the 1–6 range).
  const adjustable = new Set(["edge", ...ATTRIBUTES.filter((a) => meta.max[a] > 6)]);
  if (awakened) adjustable.add("magic");
  let adjustUsed = 0;
  for (const [a, v] of Object.entries(draft.adjust ?? {})) {
    if (!n(v)) continue;
    if (!adjustable.has(a)) err("AdjustNotAllowed", { attribute: a });
    adjustUsed += n(v);
  }
  const adjustTotal = metaRow?.adjustment ?? 0;
  if (adjustUsed > adjustTotal) err("AdjustOver", { used: adjustUsed, total: adjustTotal });

  // Attributes.
  const attrTotal = row("attributes")?.attributes ?? 0;
  let attrUsed = 0;
  let karmaSpent = 0;
  const final = {};
  for (const a of ATTRIBUTES) {
    const points = n(draft.attrPoints?.[a]);
    attrUsed += points;
    const bought = 1 + points + n(draft.adjust?.[a]);
    final[a] = bought + n(draft.attrKarma?.[a]);
    karmaSpent += advancementCost(bought, final[a]);
    if (final[a] > max[a]) err("AttrOverMax", { attribute: a, max: max[a] });
  }
  if (attrUsed > attrTotal) err("AttrOver", { used: attrUsed, total: attrTotal });
  const atMax = ATTRIBUTES.filter((a) => final[a] >= max[a]);
  if (atMax.length > 1) err("AttrTwoAtMax");

  const edgeBought = 1 + n(draft.adjust?.edge);
  final.edge = edgeBought + n(draft.attrKarma?.edge);
  karmaSpent += advancementCost(edgeBought, final.edge);
  if (final.edge > max.edge) err("AttrOverMax", { attribute: "edge", max: max.edge });

  final.magic = 0;
  if (awakened) {
    const bought = magicBase + n(draft.adjust?.magic);
    final.magic = bought + n(draft.attrKarma?.magic);
    karmaSpent += advancementCost(bought, final.magic);
    if (final.magic > max.magic) err("AttrOverMax", { attribute: "magic", max: max.magic });
  }

  // Skills: ranks up to 6 (7 with Aptitude), one skill at the maximum, specializations 1 point (or 5 Karma).
  const skillTotal = row("skills")?.skills ?? 0;
  let skillUsed = 0;
  const skills = {};
  const aptitude = new Set(has("aptitude").map((q) => q.detail));
  const incompetent = new Set(has("incompetent").map((q) => q.detail));
  let skillsAtMax = 0;
  for (const s of SKILLS) {
    const entry = draft.skills?.[s] ?? {};
    const points = n(entry.points);
    const rank = points + n(entry.karma);
    skillUsed += points;
    karmaSpent += advancementCost(points, rank);
    const skillMax = aptitude.has(s) ? 7 : 6;
    if (rank > skillMax) err("SkillOverMax", { skill: s, max: skillMax });
    if (rank === skillMax) skillsAtMax++;
    if (rank > 0 && incompetent.has(s)) err("SkillIncompetent", { skill: s });
    if (entry.spec) {
      if (!rank) err("SpecWithoutSkill", { skill: s });
      if (entry.specKarma) karmaSpent += 5;
      else skillUsed += 1;
    }
    skills[s] = { rank, max: skillMax, spec: rank ? entry.spec ?? "" : "" };
  }
  if (skillUsed > skillTotal) err("SkillOver", { used: skillUsed, total: skillTotal });
  if (skillsAtMax > 1) err("SkillTwoAtMax");

  // Qualities: at most six chosen, net bonus Karma at most 20 (p. 66).
  const chosen = qualities.filter((q) => !q.racial);
  if (chosen.length > 6) err("QualitiesCount");
  let positive = 0;
  let negative = 0;
  for (const q of chosen) {
    if (q.def.positive) positive += qualityKarma(q);
    else negative += qualityKarma(q);
    if (q.def.detail && !q.detail) err("QualityDetail", { quality: q.def.id });
  }
  if (negative - positive > 20) err("QualitiesNet", { net: negative - positive });

  // Knowledge and languages: Logic free knowledge/language skills plus one native language; more cost 3 Karma.
  const knowledgeCount = (draft.knowledge ?? []).filter((k) => k.name?.trim()).length;
  const languages = (draft.languages ?? []).filter((l) => l.name?.trim());
  const natives = languages.filter((l) => l.native).length;
  if (natives > 1) err("NativeTwice");
  const freeKnowledge = final.log;
  const paidKnowledge = Math.max(0, knowledgeCount + languages.length - natives - freeKnowledge);
  karmaSpent += paidKnowledge * 3;

  // Karma and nuyen.
  const karmaToNuyen = n(draft.karmaToNuyen);
  const inDebt = has("in_debt").length > 0;
  const karmaTotal = (KARMA[level] ?? 50) + negative;
  const karmaUsed = positive + karmaSpent + karmaToNuyen;
  if (karmaUsed > karmaTotal) err("KarmaOver", { used: karmaUsed, total: karmaTotal });
  const nuyen = (row("resources")?.resources ?? 0) + karmaToNuyen * (inDebt ? NUYEN_PER_KARMA_IN_DEBT : NUYEN_PER_KARMA);

  // Contacts: Charisma × 6 points, no rating above Charisma (p. 67).
  const contactTotal = final.cha * 6;
  let contactUsed = 0;
  for (const c of draft.contacts ?? []) {
    const connection = n(c.connection);
    const loyalty = n(c.loyalty);
    contactUsed += connection + loyalty;
    if (connection > final.cha || loyalty > final.cha) err("ContactOverCha", { name: c.name || "?", cha: final.cha });
  }
  if (contactUsed > contactTotal) err("ContactOver", { used: contactUsed, total: contactTotal });

  return {
    errors,
    max,
    adjustable: [...adjustable],
    final,
    skills,
    qualities,
    magicBase,
    awakened,
    budgets: {
      adjustment: { used: adjustUsed, total: adjustTotal },
      attributes: { used: attrUsed, total: attrTotal },
      skills: { used: skillUsed, total: skillTotal },
      karma: { used: karmaUsed, total: karmaTotal },
      contacts: { used: contactUsed, total: contactTotal },
      knowledge: { used: knowledgeCount + languages.length - natives, total: freeKnowledge },
    },
    positive,
    negative,
    karmaLeft: karmaTotal - karmaUsed,
    nuyen,
    // Spells/rituals, adept power points, complex forms come from the priority Magic/Resonance (p. 65–66).
    magicChoices: {
      spells: ["full", "aspected"].includes(magicType) ? magicBase * 2 : 0,
      powerPoints: ["adept", "mystic"].includes(magicType) ? magicBase : 0,
      complexForms: magicType === "techno" ? magicBase * 2 : 0,
    },
  };
}
