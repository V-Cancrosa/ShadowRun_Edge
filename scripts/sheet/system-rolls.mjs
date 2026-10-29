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
export async function rollPool(actor, { pool, label, kind }) {
  const { PreparedRoll, RollType } = await types();
  const roll = new PreparedRoll();
  roll.pool = Number(pool) || 0;
  roll.rollType = kind === "soak" ? RollType.Soak : RollType.Common;
  roll.actionText = roll.checkText = label;
  let dialogConfig;
  if (kind === "defense" || kind === "soak") {
    roll.allowBuyHits = false;
    roll.threshold = 1;
    dialogConfig = { useModifier: kind !== "soak", useThreshold: false };
  } else {
    roll.allowBuyHits = true;
    roll.useWildDie = 1;
    dialogConfig = { useModifier: true, useThreshold: true };
  }
  return actor.rollCommonCheck(roll, dialogConfig);
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
