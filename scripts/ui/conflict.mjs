/**
 * The module never blocks the GM on a game rule. When something breaks a rule, it shows what is wrong and lets
 * the user choose: options that follow the rules for everyone, and options that break them ("…anyway") for the
 * GM — and for players too when the world setting allows it. Foundry permission checks are not rules and stay.
 */
import * as ui2 from "./edge-ui.mjs";

const MODULE_ID = "shadowrun-edge";
const L = (key, data) => (data ? game.i18n.format(key, data) : game.i18n.localize(key));

Hooks.once("init", () => {
  game.settings.register(MODULE_ID, "playersBreakRules", {
    name: "SRE.Conflict.Setting.Name",
    hint: "SRE.Conflict.Setting.Hint",
    scope: "world",
    config: true,
    type: Boolean,
    default: false,
  });
});

/** Whether this user may pick options that break a rule. */
export function canBreakRules() {
  if (game.user?.isGM) return true;
  try {
    return !!game.settings.get(MODULE_ID, "playersBreakRules");
  } catch {
    return false;
  }
}

/** Options this user may pick: rule-breaking ones only with canBreakRules(). */
export function allowedOptions(options, breakRules = canBreakRules()) {
  return options.filter((o) => breakRules || !o.breaksRules);
}

/**
 * Asks how to resolve a rule conflict.
 * @param {object} c
 * @param {string} c.title     window title
 * @param {string} c.kind      small heading, e.g. "Rule conflict"
 * @param {string} c.name      what it is about (an item, a character)
 * @param {string[]} c.problems what breaks which rule
 * @param {{id: string, label: string, hint?: string, icon?: string, breaksRules?: boolean}[]} c.options
 * @returns {Promise<string|null>} the chosen option id, or null (cancelled)
 */
export async function resolveConflict({ title, kind, name, problems = [], options = [] }) {
  const allowed = allowedOptions(options);
  const hidden = options.length - allowed.length;
  const content = `<div class="sre-ed">
    ${ui2.head({ kind: kind ?? L("SRE.Conflict.Kind"), name })}
    <div class="sre-ed-body">
      ${problems.map((p) => ui2.note(p, "warn")).join("")}
      ${allowed.length ? ui2.panel(L("SRE.Conflict.Options"), ui2.options("choice", allowed.map((o, i) => ({
        value: o.id, label: o.label, small: [o.hint, o.breaksRules ? L("SRE.Conflict.BreaksRules") : ""].filter(Boolean).join(" · "), checked: i === 0,
      })))) : ""}
      ${hidden ? ui2.note(L("SRE.Conflict.AskGM"), "info") : ""}
    </div>
  </div>`;
  const buttons = allowed.length
    ? ui2.buttons(L("SRE.Conflict.Apply"), (event, button) => button.form.elements.choice.value, { icon: "fas fa-check" })
    : [{ action: "cancel", label: L("Cancel"), default: true }];
  const result = await foundry.applications.api.DialogV2.wait({
    classes: ["sre-dialog"],
    window: { title: title ?? L("SRE.Conflict.Kind") },
    position: { width: 480 },
    content,
    buttons,
    rejectClose: false,
  });
  return ui2.okOnly(result);
}
