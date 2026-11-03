/**
 * Edge Motion (stage 11A, styles/edge-motion.css): the player's animation level and the one-off classes that play
 * when an Edge window opens, switches tabs or a module dialog appears.
 * Levels: full, reduced (short fades, no travel), off; "auto" follows the system's reduced-motion preference.
 */
const MODULE_ID = "shadowrun-edge";
export const LEVELS = ["auto", "full", "reduced", "off"];

/** The level in effect: the setting, with "auto" read from the operating system's preference. */
export function motionLevel(setting, prefersReduced = false) {
  if (setting === "full" || setting === "reduced" || setting === "off") return setting;
  return prefersReduced ? "reduced" : "full";
}

function applyLevel() {
  let setting = "auto";
  try {
    setting = game.settings.get(MODULE_ID, "motion");
  } catch {
    /* not registered yet */
  }
  const level = motionLevel(setting, globalThis.matchMedia?.("(prefers-reduced-motion: reduce)").matches);
  for (const l of ["full", "reduced", "off"]) document.body.classList.toggle(`sre-motion-${l}`, l === level);
  return level;
}

/** Adds a class for one play of its animation, then removes it (also when the animation never runs). */
function playOnce(element, cls, ms = 900) {
  if (!element || document.body.classList.contains("sre-motion-off")) return;
  element.classList.remove(cls);
  void element.offsetWidth;
  element.classList.add(cls);
  setTimeout(() => element.classList.remove(cls), ms);
}

Hooks.once("init", () => {
  game.settings.register(MODULE_ID, "motion", {
    name: "SRE.Motion.Setting.Name",
    hint: "SRE.Motion.Setting.Hint",
    scope: "client",
    config: true,
    type: String,
    choices: Object.fromEntries(LEVELS.map((l) => [l, `SRE.Motion.Level.${l}`])),
    default: "auto",
    onChange: () => applyLevel(),
  });
});

Hooks.once("ready", () => {
  applyLevel();
  globalThis.matchMedia?.("(prefers-reduced-motion: reduce)").addEventListener?.("change", () => applyLevel());
});

/** Edge sheets: open (first render) and tab switches; module dialogs: pop in. */
Hooks.on("renderApplicationV2", (app, element, context, options) => {
  const el = element instanceof HTMLElement ? element : app.element;
  if (!el?.classList) return;
  if (el.classList.contains("sre-sheet")) {
    if (options?.isFirstRender) playOnce(el, "sre-fx-open");
    else if (app.sheetTab && app._sreLastTab && app._sreLastTab !== app.sheetTab) playOnce(el, "sre-fx-tab", 500);
    app._sreLastTab = app.sheetTab;
    return;
  }
  if (el.classList.contains("sre-dialog") && options?.isFirstRender) playOnce(el, "sre-fx-pop", 500);
});
