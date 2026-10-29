/**
 * Rolls through the shadowrun6-eden system, the way its own sheet does it, so the roll dialog,
 * Edge handling and chat cards stay the system's. Constructor signatures differ between 3.x and 4.x;
 * every difference is handled here and nowhere else.
 */
let rollTypes;

/** The system's roll classes (PreparedRoll, SkillRoll, WeaponRoll, SpellRoll, RollType). */
async function types() {
  rollTypes ??= await import(foundry.utils.getRoute("systems/shadowrun6-eden/module/dice/RollTypes.js"));
  return rollTypes;
}

const isV4 = () => !foundry.utils.isNewerVersion("4.0.0", game.system.version);

/** A plain pool check (defense, soak, derived values), built like the system sheet's _onCommonCheck. */
export async function rollPool(actor, { pool, label, kind, threshold }) {
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
    roll.useWildDie = 1;
    dialogConfig = { useModifier: true, useThreshold: true };
  }
  return actor.rollCommonCheck(roll, dialogConfig);
}

/** Attribute test, like the system sheet's attribute tiles (attribute + optional second attribute in the dialog). */
export async function rollAttribute(actor, { id, pool, label }) {
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
  const { SkillRoll } = await types();
  const roll = new SkillRoll(actor.system, skillId);
  if (skillSpec) roll.skillSpec = skillSpec;
  return actor.rollSkill(roll);
}

export async function rollWeapon(actor, item) {
  const { WeaponRoll } = await types();
  const roll = isV4() ? new WeaponRoll(actor, item) : new WeaponRoll(actor.system, item, item.id, item.system);
  if (!isV4()) roll.useWildDie = item.system.wild ? 1 : 0;
  return actor.rollItem(roll);
}

export async function rollSpell(actor, item) {
  const { SpellRoll } = await types();
  const roll = new SpellRoll(actor.system, item, item.id, item.system);
  roll.skillSpec = "spellcasting";
  return actor.rollSpell(roll, false);
}

export async function rollRitual(actor, item) {
  const { RitualRoll } = await types();
  return actor.rollSpell(new RitualRoll(actor.system, item, item.id, item.system), true);
}

/** Threading a complex form: 3.x rollComplexForm, 4.x rollResonanceAbility. */
export async function rollComplexForm(actor, item) {
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
  if (id === "physical" && game.combat) return actor.rollInitiative({ createCombatants: true, rerollInitiative: true });
  const roll = await new Roll(`${Number(base) || 0} + ${Number(dice) || 0}d6`).evaluate();
  return roll.toMessage({ speaker: ChatMessage.getSpeaker({ actor }), flavor: label });
}

export async function reloadWeapon(item) {
  return item.update({ "system.ammocount": item.system.ammocap });
}
