/**
 * Shadowrun Edge: a companion module for the shadowrun6-eden system.
 * It never patches the system's code; it only adds translations and its own features on top.
 */
import { openItemWizard } from "./wizard/item-wizard.mjs";
import "./acquire.mjs";
import "./mounts.mjs";

const MODULE_ID = "shadowrun-edge";
const SYSTEM_ID = "shadowrun6-eden";

const isSystemActive = () => game.system.id === SYSTEM_ID;

Hooks.once("init", () => {
  // Item wizard presets saved by the GM from their own rulebook.
  game.settings.register(MODULE_ID, "presets", {
    scope: "world",
    config: false,
    type: Array,
    default: [],
  });

  game.settings.register(MODULE_ID, "askImplantGrade", {
    name: "SRE.Grade.Setting.Name",
    hint: "SRE.Grade.Setting.Hint",
    scope: "client",
    config: true,
    type: Boolean,
    default: true,
  });

  game.settings.register(MODULE_ID, "askPurchase", {
    name: "SRE.Purchase.Setting.Name",
    hint: "SRE.Purchase.Setting.Hint",
    scope: "client",
    config: true,
    type: Boolean,
    default: true,
  });

  game.settings.register(MODULE_ID, "mountRules", {
    name: "SRE.Mount.Setting.Name",
    hint: "SRE.Mount.Setting.Hint",
    scope: "world",
    config: true,
    type: String,
    choices: { block: "SRE.Mount.Setting.block", warn: "SRE.Mount.Setting.warn", off: "SRE.Mount.Setting.off" },
    default: "block",
  });

  game.modules.get(MODULE_ID).api = { openItemWizard };
});

Hooks.once("ready", () => {
  if (!isSystemActive()) {
    ui.notifications.warn(game.i18n.format("SRE.WrongSystem", { system: SYSTEM_ID }));
    return;
  }
  console.log(`${MODULE_ID} | ready (shadowrun6-eden ${game.system.version})`);
});

/** "Item wizard" button next to "Create Item" in the Items sidebar. */
Hooks.on("renderItemDirectory", (app, html) => {
  if (!isSystemActive() || !game.user.can("ITEM_CREATE")) return;
  const root = html instanceof HTMLElement ? html : html[0];
  const actions = root?.querySelector(".header-actions");
  if (!actions || actions.querySelector(".sre-wizard-button")) return;
  const button = document.createElement("button");
  button.type = "button";
  button.classList.add("sre-wizard-button");
  button.innerHTML = `<i class="fas fa-wand-magic-sparkles"></i> ${game.i18n.localize("SRE.Wizard.Button")}`;
  button.addEventListener("click", () => openItemWizard());
  actions.append(button);
});

/** "Item wizard" button in the header of character, NPC and vehicle sheets. */
Hooks.on("getActorSheetHeaderButtons", (sheet, buttons) => {
  if (!isSystemActive() || !sheet.actor?.isOwner) return;
  buttons.unshift({
    label: "SRE.Wizard.Button",
    class: "sre-wizard-button",
    icon: "fas fa-wand-magic-sparkles",
    onclick: () => openItemWizard({ actor: sheet.actor }),
  });
});
