/**
 * Shadowrun Edge: a companion module for the shadowrun6-eden system.
 * It never patches the system's code; it only adds translations and its own features on top.
 */
const MODULE_ID = "shadowrun-edge";
const SYSTEM_ID = "shadowrun6-eden";

Hooks.once("ready", () => {
  if (game.system.id !== SYSTEM_ID) {
    ui.notifications.warn(game.i18n.format("SRE.WrongSystem", { system: SYSTEM_ID }));
    return;
  }
  console.log(`${MODULE_ID} | ready (shadowrun6-eden ${game.system.version})`);
});
