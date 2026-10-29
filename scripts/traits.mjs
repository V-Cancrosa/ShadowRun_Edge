/**
 * Focused Concentration and Pain Resistance, which the shadowrun6-eden system lacks. Built in so the Edge sheet,
 * catalog and character creator work without anything else; when zychu's standalone modules
 * (foundry-shadowrun6-eden-focused-concentration / -pain-resistance) are active, they do the work and this
 * file steps aside, so nothing is applied twice. The data fields are the same either way.
 */
import { focusedSustainedModifier, shiftedWoundModifier, boxLabel } from "./traits-rules.mjs";

const SYSTEM_ID = "shadowrun6-eden";
const EXTERNAL = {
  focus: "foundry-shadowrun6-eden-focused-concentration",
  pain: "foundry-shadowrun6-eden-pain-resistance",
};
const LOG = "shadowrun-edge |";

const externalActive = (key) => !!game.modules.get(EXTERNAL[key])?.active;

/** Which of the two the module itself provides (false when the standalone module or the system does). */
export const provides = { focus: false, pain: false };

function patch(proto, method, field, wrap) {
  const original = proto?.[method];
  if (typeof original !== "function") {
    console.warn(`${LOG} ${method} not found, ${field} is not applied.`);
    return false;
  }
  if (original.toString().includes(field)) return false; // the system handles it natively
  proto[method] = wrap(original);
  return true;
}

Hooks.once("setup", () => {
  if (game.system.id !== SYSTEM_ID) return;
  const proto = CONFIG.Actor.documentClass?.prototype;

  if (!externalActive("focus")) {
    provides.focus = patch(proto, "getSustainedModifier", "focusedConcentration", (original) => function (...args) {
      return focusedSustainedModifier(original.apply(this, args), this.system?.focusedConcentration, this.items);
    });
  }
  if (!externalActive("pain")) {
    provides.pain = patch(proto, "_getWoundModifierPerMonitor", "painResistance", (original) => function (monitor) {
      return shiftedWoundModifier((m) => original.call(this, m), monitor, this.system?.painResistance);
    });
  }

  // Reset the fields on every data preparation so Add effects never pile up.
  const fields = [provides.focus && "focusedConcentration", provides.pain && "painResistance"].filter(Boolean);
  if (fields.length) {
    const base = proto.prepareBaseData;
    proto.prepareBaseData = function (...args) {
      const result = base?.apply(this, args);
      if (this.system && typeof this.system === "object") for (const f of fields) this.system[f] = 0;
      return result;
    };
  }

  Hooks.once("ready", () => {
    const options = CONFIG.SR6?.ACTIVE_EFFECT_OPTIONS;
    if (!options) return;
    if (provides.focus) options.system_focusedConcentration = game.i18n.localize("SRE.Traits.FocusEffect");
    if (provides.pain) options.system_painResistance = game.i18n.localize("SRE.Traits.PainEffect");
  });
});

/** The system sheet's monitors: move the −1/−2/… labels like the standalone module does. */
Hooks.on("renderActorSheet", (app, html) => {
  if (!provides.pain) return;
  const shift = Math.trunc(Number(app.actor?.system?.painResistance) || 0);
  if (!shift) return;
  const root = app.element?.[0] ?? app.element ?? html?.[0] ?? html;
  for (const id of ["barPhyBoxes", "barStunBoxes"]) {
    const bar = root?.querySelector?.(`#${id}`);
    if (!bar) continue;
    const boxes = [...bar.children].filter((el) => el.classList.contains("monitorBox"));
    boxes.forEach((box, i) => {
      (box.firstElementChild ?? box).textContent = boxLabel(i + 1, boxes.length, shift) ?? " ";
    });
  }
});
