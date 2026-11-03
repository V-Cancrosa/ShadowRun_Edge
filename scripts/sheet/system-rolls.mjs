/**
 * Rolls through the shadowrun6-eden system, the way its own sheet does it, so the roll dialog,
 * Edge handling and chat cards stay the system's. Constructor signatures differ between 3.x and 4.x;
 * every difference is handled here and nowhere else.
 */
import { engineOn, edgeTest } from "../dice/edge-roll.mjs";

let rollTypes;
const L = (k, d) => (d ? game.i18n.format(k, d) : game.i18n.localize(k));
const n = (v, d = 0) => (Number.isFinite(Number(v)) && v !== "" && v !== null ? Number(v) : d);

/** Edge Action context of a skill test (pp. 47–48). */
function skillContext(skillId) {
  if (skillId === "close_combat") return ["melee"];
  if (skillId === "firearms" || skillId === "exotic_weapons") return ["ranged"];
  if (skillId === "influence") return ["influence"];
  if (skillId === "con") return ["con"];
  return [];
}

/** "Skill (spec) + Attribute" for a skill test, and its pool from the system (_getSkillPool). */
function skillTest(actor, skillId, spec, attrib) {
  const def = CONFIG.SR6?.ATTRIB_BY_SKILL?.get?.(skillId);
  const attr = attrib ?? def?.attrib;
  let pool = 0;
  try {
    pool = n(actor._getSkillPool?.(skillId, spec, attrib));
  } catch {
    pool = n(actor.system?.skills?.[skillId]?.pool) + n(actor.system?.attributes?.[attr]?.pool);
  }
  const specLabel = spec ? game.i18n.localize(`shadowrun6.special.${skillId}.${spec}`) : "";
  const attrId = attr && attr.length === 3 ? attr : String(attr ?? "").match(/attributes\.(\w+)\./)?.[1];
  const label = `${L(`skill.${skillId}`)}${spec && !specLabel.startsWith("shadowrun6.") ? ` (${specLabel})` : spec ? ` (${spec})` : ""}${attrId ? ` + ${L(`attrib.${attrId}`)}` : ""}`;
  const points = n(actor.system?.skills?.[skillId]?.points);
  return { pool, label, rank: points, untrained: points === 0 && def?.useUntrained !== false, context: skillContext(skillId) };
}

/** The system's roll classes (PreparedRoll, SkillRoll, WeaponRoll, SpellRoll, RollType). */
async function types() {
  rollTypes ??= await import(foundry.utils.getRoute("systems/shadowrun6-eden/module/dice/RollTypes.js"));
  return rollTypes;
}

const isV4 = () => !foundry.utils.isNewerVersion("4.0.0", game.system.version);

/**
 * A plain pool check (defense, soak, derived values), built like the system sheet's _onCommonCheck.
 * `useWoundModifier` (true/false) presets the dialog's wound-modifier box when the rule decides it.
 */
export async function rollPool(actor, { pool, label, kind, threshold, useWoundModifier, wildDie, task }) {
  if (engineOn()) {
    return edgeTest(actor, {
      kind: kind === "defense" ? "defense" : kind === "soak" ? "soak" : kind === "test" ? "test" : "common",
      label, pool: n(pool), threshold: n(threshold), wild: !!n(wildDie),
      allowBuy: kind !== "defense" && kind !== "soak", useWound: kind === "soak" ? false : useWoundModifier !== false,
      useSustain: kind !== "soak" && kind !== "defense", context: kind === "defense" ? ["block", "hit_dirt"] : [], task,
    }).then((m) => m ?? null);
  }
  const { PreparedRoll, RollType } = await types();
  const roll = new PreparedRoll();
  roll.pool = Number(pool) || 0;
  roll.rollType = kind === "soak" ? RollType.Soak : RollType.Common;
  roll.actionText = roll.checkText = label;
  let dialogConfig;
  if (kind === "defense" || kind === "soak") {
    roll.allowBuyHits = false;
    roll.threshold = Number(threshold) || 1;
    dialogConfig = { useModifier: kind !== "soak", useThreshold: false };
  } else {
    roll.allowBuyHits = true;
    // Wild die by default; a spray's fast stream asks for it, a normal spray turns it off (p. 117).
    roll.useWildDie = wildDie === undefined ? 1 : Number(wildDie) ? 1 : 0;
    if (Number(threshold) > 0) roll.threshold = Number(threshold);
    dialogConfig = { useModifier: true, useThreshold: true };
  }
  if (typeof useWoundModifier === "boolean") roll.useWoundModifier = useWoundModifier;
  return actor.rollCommonCheck(roll, dialogConfig);
}

/**
 * A resistance test through the system's soak roll (SoakRoll): its chat card shows the damage left after the
 * hits and has the system's own "Apply damage" button. `soakType`: "damage_phys" | "damage_stun" | "drain".
 */
export async function rollSoakTest(actor, { soakType, damage, monitor, pool, label }) {
  if (engineOn()) {
    const dv = Math.max(0, n(damage));
    const kind = soakType === "drain" ? "drain" : soakType === "fading" ? "fading" : "damage";
    const limit = kind === "fading" ? n(actor.system?.attributes?.res?.pool) : n(actor.system?.attributes?.mag?.pool);
    return edgeTest(actor, {
      kind: kind === "damage" ? "soak" : kind, label, pool: n(pool), useWound: false, allowBuy: false, allowThreshold: false,
      soak: { dv, monitor: monitor ?? (soakType === "damage_phys" ? "physical" : "stun"), kind, limit },
    });
  }
  const { SoakRoll } = await types();
  const dv = Math.max(0, Number(damage) || 0);
  const roll = new SoakRoll(dv, soakType);
  roll.monitor = monitor ?? (soakType === "damage_phys" ? "physical" : "stun");
  roll.threshold = dv;
  roll.pool = Number(pool) || 0;
  roll.allowBuyHits = false;
  roll.actionText = roll.checkText = label;
  roll.performer = actor.system;
  return actor.rollCommonCheck(roll, { useModifier: true, useThreshold: false });
}

/** A vehicle test (piloting, sensors, evasion…), like the system's vehicle sheet: VehicleRoll with a pool. */
export async function rollVehicle(actor, { pool, label, threshold }) {
  if (engineOn()) return edgeTest(actor, { kind: "vehicle", label, pool: n(pool), threshold: n(threshold), useWound: false });
  const { VehicleRoll } = await types();
  const roll = new VehicleRoll();
  roll.pool = Number(pool) || 0;
  roll.calcPool = roll.pool;
  roll.checkText = label;
  if (Number(threshold) > 0) roll.threshold = Number(threshold);
  return actor.rollVehicle(roll);
}

/** Attribute test, like the system sheet's attribute tiles (attribute + optional second attribute in the dialog). */
export async function rollAttribute(actor, { id, pool, label }) {
  if (engineOn()) return edgeTest(actor, { kind: "attribute", label, pool: n(pool), useSustain: true });
  const { PreparedRoll, RollType } = await types();
  const roll = new PreparedRoll();
  roll.pool = Number(pool) || 0;
  roll.rollType = RollType.Common;
  roll.actionText = roll.checkText = label;
  roll.allowBuyHits = true;
  roll.useAttributeMod = true;
  roll.attributeTested = id;
  return actor.rollCommonCheck(roll, { useModifier: true, useThreshold: true });
}

export async function rollSkill(actor, skillId, skillSpec) {
  if (engineOn()) {
    const t = skillTest(actor, skillId, skillSpec);
    return edgeTest(actor, { kind: "skill", label: t.label, pool: t.pool, skillRank: t.rank, untrained: t.untrained, context: t.context, useSustain: true });
  }
  const { SkillRoll } = await types();
  const roll = new SkillRoll(actor.system, skillId);
  if (skillSpec) roll.skillSpec = skillSpec;
  return actor.rollSkill(roll);
}

export async function rollWeapon(actor, item) {
  if (engineOn()) return edgeTest(actor, weaponRequest(actor, item));
  const { WeaponRoll } = await types();
  const roll = isV4() ? new WeaponRoll(actor, item) : new WeaponRoll(actor.system, item, item.id, item.system);
  if (!isV4()) roll.useWildDie = item.system.wild ? 1 : 0;
  return actor.rollItem(roll);
}

export async function rollSpell(actor, item) {
  if (engineOn()) return edgeTest(actor, spellRequest(actor, item, false));
  const { SpellRoll } = await types();
  const roll = new SpellRoll(actor.system, item, item.id, item.system);
  roll.skillSpec = "spellcasting";
  return actor.rollSpell(roll, false);
}

export async function rollRitual(actor, item) {
  if (engineOn()) return edgeTest(actor, spellRequest(actor, item, true));
  const { RitualRoll } = await types();
  return actor.rollSpell(new RitualRoll(actor.system, item, item.id, item.system), true);
}

/** Threading a complex form: 3.x rollComplexForm, 4.x rollResonanceAbility. */
export async function rollComplexForm(actor, item) {
  if (engineOn()) {
    const skillId = item.system.skill || "electronics";
    const t = skillTest(actor, skillId, skillId === "electronics" ? "complex_forms" : "cybercombat", "res");
    return edgeTest(actor, {
      kind: "complexform", title: item.name, label: t.label, pool: t.pool, img: item.img, useSustain: true, skillRank: t.rank,
      fading: n(item.system.fading), extra: { itemUuid: item.uuid, fading: n(item.system.fading) },
    });
  }
  const { ComplexFormRoll } = await types();
  const roll = new ComplexFormRoll(actor.system, item, item.id, item.system);
  return (actor.rollResonanceAbility ?? actor.rollComplexForm).call(actor, roll);
}

/** A matrix action from CONFIG.SR6.MATRIX_ACTIONS, as the system sheet's reference table does it. */
export async function rollMatrixAction(actor, actionId) {
  const { MatrixActionRoll } = await types();
  const action = CONFIG.SR6.MATRIX_ACTIONS[actionId];
  if (!action) return;
  if (!isV4()) return actor.performMatrixAction(new MatrixActionRoll(actor.system, action));
  const roll = new MatrixActionRoll(actor, action, { fromReferenceSection: true });
  if (action.onMatrixActionRoll) await action.onMatrixActionRoll(roll);
  if (!action.skill) return roll.toChat();
  return actor.performMatrixAction(roll);
}

/** Legwork with a contact: Connection × 2 dice, threshold 1, no wound or sustain penalty (system rules). */
export async function rollLegwork(actor, contact) {
  if (engineOn()) {
    return edgeTest(actor, {
      kind: "legwork", title: contact.name, label: L("SRE.Roll.LegworkLabel", { n: n(contact.system.rating) }),
      pool: n(contact.system.rating) * 2, threshold: 1, useWound: false, img: contact.img,
      extra: { loyalty: n(contact.system.loyalty), contact: contact.name },
    });
  }
  const { PreparedRoll, RollType } = await types();
  const roll = new PreparedRoll();
  roll.rollType = RollType.Legwork;
  roll.pool = (Number(contact.system.rating) || 0) * 2;
  roll.allowBuyHits = true;
  roll.threshold = 1;
  roll.legwork = { loyalty: Number(contact.system.loyalty) || 0, contact: contact.name };
  roll.actionText = roll.checkText = game.i18n.format("shadowrun6.legwork.legwork_description", { name: contact.name });
  return actor.rollCommonCheck(roll, { useWoundModifier: false, useSustainedSpellModifier: false });
}

/**
 * Physical initiative goes through the combat tracker (the system's combatant formula);
 * astral and matrix scores are rolled to chat, since the tracker uses one type per combatant.
 */
export async function rollInitiative(actor, { id, base, dice, label }) {
  if (engineOn()) {
    const { initiativeTest } = await import("../dice/initiative.mjs");
    return initiativeTest(actor, { base, dice, label });
  }
  if (id === "physical" && game.combat) return actor.rollInitiative({ createCombatants: true, rerollInitiative: true });
  const roll = await new Roll(`${Number(base) || 0} + ${Number(dice) || 0}d6`).evaluate();
  return roll.toMessage({ speaker: ChatMessage.getSpeaker({ actor }), flavor: label });
}

export async function reloadWeapon(item) {
  return item.update({ "system.ammocount": item.system.ammocap });
}

/** Damage through the system (overflow into Physical and the Overflow track): 3.x (monitor, damage), 4.x ({ monitor, damage }). */
export async function applyDamage(actor, monitor, damage) {
  if (isV4()) return actor.applyDamage({ monitor, damage });
  return actor.applyDamage(monitor, damage);
}

// ───── Requests for the Edge engine, from the system's prepared item data ─────

/** A weapon attack: pool, Attack Rating per range, Damage and fire modes as the system computes them. */
export function weaponRequest(actor, item) {
  const sys = item.system ?? {};
  const melee = sys.type === "WEAPON_CLOSE_COMBAT";
  const t = skillTest(actor, sys.skill || (melee ? "close_combat" : "firearms"), sys.skillSpec || undefined);
  const pool = n(sys.pool) ? n(sys.pool) + n(sys.modes?.dicePoolMod) : t.pool;
  const ar = (item.calculatedAttackRating ?? sys.attackRating ?? [0, 0, 0, 0, 0]).map((v) => n(v));
  const dv = n(item.calculatedDamage, n(sys.dmg));
  const ranged = !melee && ["WEAPON_FIREARMS", "WEAPON_RANGED", "WEAPON_SPECIAL"].includes(sys.type);
  const context = melee ? ["melee"] : ranged ? ["ranged"] : [];
  if (game.user?.targets?.size > 1) context.push("multi");
  return {
    kind: "weapon", title: item.name, label: t.label, pool, img: item.img, wild: !!sys.wild, useSustain: true, skillRank: t.rank, context,
    attack: {
      ar, dv, stun: !!(item.calculatedStun ?? sys.stun), ranged, modes: sys.modes ?? {},
      arMods: { SA: sys.modes?.SA_ar_mod, BF: sys.modes?.BF_ar_mod, FA: sys.modes?.FA_ar_mod },
      ammo: n(sys.ammocap) > 0 ? { count: n(sys.ammocount), cap: n(sys.ammocap), item: item.uuid } : null,
    },
    extra: { itemUuid: item.uuid },
  };
}

/** A spell or ritual: Sorcery + Magic; Drain, Amp Up for Combat spells and Increase Area for area spells (pp. 131–132). */
export function spellRequest(actor, item, ritual) {
  const sys = item.system ?? {};
  const t = skillTest(actor, "sorcery", ritual ? "ritual_spellcasting" : "spellcasting", "mag");
  const drain = ritual ? Math.max(2, n(sys.threshold) * 2) : n(sys.drain);
  const combat = !ritual && sys.category === "combat";
  const area = !ritual && (sys.range === "line_of_sight_area" || sys.range === "self_area");
  let threshold = 0;
  if (!ritual && sys.category === "heal" && sys.withEssence) threshold = 5 - Math.ceil(n(actor.system?.attributes?.essence?.pool, 6));
  if (ritual) threshold = n(sys.threshold);
  // A caster's Attack Rating: Magic + tradition attribute (p. 132).
  const magic = n(actor.system?.attributes?.mag?.pool);
  const trad = actor.system?.tradition?.attribute;
  const ar = magic + (trad ? n(actor.system?.attributes?.[trad]?.pool) : 0);
  return {
    kind: ritual ? "ritual" : "spell", title: item.name, label: t.label, pool: t.pool, img: item.img, threshold, useSustain: true, skillRank: t.rank,
    wild: !!sys.wildDie,
    spell: { drain, combat, area, indirect: sys.combatSpellType === "spells_indirect", damage: sys.damage === "stun" ? "stun" : "physical", magic, ar },
    extra: { itemUuid: item.uuid },
  };
}
