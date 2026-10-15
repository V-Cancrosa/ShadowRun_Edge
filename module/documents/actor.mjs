import { rollPool } from "../dice.mjs";

export class SRActor extends Actor {
  /** Roll a single attribute as a test. */
  rollAttribute(key) {
    const label = game.i18n.localize(CONFIG.SRE.attributes[key]);
    return rollPool({ actor: this, label, pool: this.system.attributes[key] ?? 0 });
  }

  /**
   * Dice pool for a skill + its linked attribute. An untrained skill (rating 0 or not owned)
   * defaults to the attribute alone at -1.
   */
  getSkillPool(skill, attribute) {
    const attr = this.system.attributes[attribute] ?? 0;
    const rating = skill?.system.rating ?? 0;
    return rating > 0 ? rating + attr : Math.max(0, attr - 1);
  }

  rollSkill(skill) {
    const pool = this.getSkillPool(skill, skill.system.attribute);
    return rollPool({ actor: this, label: skill.name, pool });
  }

  /** Attack with a weapon, using the owned skill whose name matches the weapon's skill field. */
  rollWeapon(weapon) {
    const { skill: skillName, attribute, damage, damageType, attackRating } = weapon.system;
    const skill = this.itemTypes.skill.find(s => s.name.toLowerCase() === skillName.trim().toLowerCase());
    const pool = this.getSkillPool(skill, attribute);
    const extra = `<p>${game.i18n.format("SRE.Roll.WeaponDamage", { damage, damageType })}`
      + (attackRating ? ` · ${game.i18n.localize("SRE.AttackRating")}: ${attackRating}` : "")
      + `</p>`;
    return rollPool({ actor: this, label: weapon.name, pool, extra });
  }
}
