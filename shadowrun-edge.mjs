import { SRE } from "./module/config.mjs";
import { CharacterData, NpcData } from "./module/data/actors.mjs";
import { GearData, SkillData, WeaponData } from "./module/data/items.mjs";
import { SRActor } from "./module/documents/actor.mjs";
import { SRActorSheet } from "./module/sheets/actor-sheet.mjs";
import { SRItemSheet } from "./module/sheets/item-sheet.mjs";

Hooks.once("init", () => {
  CONFIG.SRE = SRE;

  CONFIG.Actor.documentClass = SRActor;
  Object.assign(CONFIG.Actor.dataModels, { character: CharacterData, npc: NpcData });
  Object.assign(CONFIG.Item.dataModels, { skill: SkillData, weapon: WeaponData, gear: GearData });

  // Reaction + Intuition + 1d6, reduced by wound modifiers.
  CONFIG.Combat.initiative = {
    formula: "@initiative.base + @woundModifier + (@initiative.dice)d6",
    decimals: 0
  };

  const { DocumentSheetConfig } = foundry.applications.apps;
  DocumentSheetConfig.registerSheet(Actor, "shadowrun-edge", SRActorSheet, {
    makeDefault: true,
    label: "SRE.Sheet.Actor"
  });
  DocumentSheetConfig.registerSheet(Item, "shadowrun-edge", SRItemSheet, {
    makeDefault: true,
    label: "SRE.Sheet.Item"
  });
});
