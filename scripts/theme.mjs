/**
 * "Edge" look for the shadowrun6-eden system: a stylesheet scoped to body.sre-theme
 * (styles/system-theme.css) plus a few DOM touches the CSS can't do alone.
 * Always on; each player switches between dark and light on the character sheet.
 */
const MODULE_ID = "shadowrun-edge";
const THEMES = ["dark", "light"];

/** Foundry's own color scheme for applications (Settings → Core → Interface), light or dark. */
function foundryScheme() {
  let scheme = "";
  try {
    const cs = game.settings.get("core", "uiConfig")?.colorScheme;
    scheme = cs?.applications || cs?.interface || "";
  } catch {
    // older cores: no uiConfig
  }
  if (!scheme) scheme = document.body.classList.contains("theme-light") ? "light"
    : document.body.classList.contains("theme-dark") ? "dark"
    : globalThis.matchMedia?.("(prefers-color-scheme: light)").matches ? "light" : "dark";
  return scheme === "light" ? "light" : "dark";
}

/**
 * The look in effect for this user: dark or light, switched on the character sheet (stored on the user, so it
 * follows the player to any device). Until the player picks one, an earlier choice from the old settings is kept,
 * else Foundry's color scheme decides. There are no settings for it any more.
 */
export function activeTheme() {
  const picked = game.user?.getFlag?.(MODULE_ID, "theme");
  if (picked === "dark" || picked === "light") return picked;
  let stored = null;
  try {
    stored = game.settings.get(MODULE_ID, "theme");
  } catch {
    // not registered (outside Foundry)
  }
  if (stored === "dark" || stored === "light") return stored;
  return foundryScheme();
}

export const isLightTheme = () => activeTheme() === "light";

/** Switches this player's look between dark and light. */
export async function toggleTheme() {
  const next = isLightTheme() ? "dark" : "light";
  await game.user.setFlag(MODULE_ID, "theme", next);
  applyTheme();
}

function applyTheme() {
  const theme = activeTheme();
  const body = document.body;
  body.classList.add("sre-theme");
  for (const t of THEMES) body.classList.toggle(`sre-theme-${t}`, theme === t);
  body.classList.toggle("sre-edge-light", theme === "light");
  // Re-render open sheets so the damage monitors and the switch pick up the look.
  const apps = [...Object.values(ui.windows ?? {}), ...(globalThis.foundry?.applications?.instances?.values?.() ?? [])];
  for (const app of apps) if (app.actor && app.rendered) app.render(false);
}

Hooks.once("init", () => {
  // Kept only to read an earlier choice; no longer shown in the settings.
  game.settings.register(MODULE_ID, "theme", { scope: "client", config: false, type: String, default: "auto" });
  game.settings.register(MODULE_ID, "themeOverride", { scope: "world", config: false, type: String, default: "player" });
});

Hooks.once("setup", () => {
  if (game.system.id === "shadowrun6-eden") applyTheme();
});
Hooks.once("ready", () => {
  if (game.system.id === "shadowrun6-eden") applyTheme();
});
// Foundry's color scheme changed: players who haven't picked a look follow it.
Hooks.on("clientSettingChanged", (key) => {
  if (key === "core.uiConfig" && game.system.id === "shadowrun6-eden") applyTheme();
});

/**
 * Damage monitors: the system draws a percentage bar with clickable boxes on top.
 * The theme hides the bar, so mark the damaged boxes (the first `dmg` boxes in DOM order,
 * which are the ones the system's click handler maps to 1..dmg).
 */
function markMonitors(root) {
  for (const [input, boxes] of [[".health-phys", "#barPhyBoxes"], [".health-stun", "#barStunBoxes"]]) {
    const field = root.querySelector(input);
    const container = root.querySelector(boxes);
    if (!field || !container) continue;
    const paint = () => {
      const dmg = Number(field.value) || 0;
      [...container.querySelectorAll(".monitorBox")].forEach((box, i) => box.classList.toggle("sre-dmg", i < dmg));
    };
    paint();
    if (!field.dataset.sreMonitor) {
      field.dataset.sreMonitor = "1";
      field.addEventListener("input", paint);
    }
  }
}

Hooks.on("renderActorSheet", (app, html) => {
  const root = html instanceof HTMLElement ? html : html?.[0];
  if (root) markMonitors(root.closest(".app") ?? root);
});

/** The system's roll dialog is a plain Dialog subclass; tag it so the theme can reach it. */
Hooks.on("renderRollDialog", (app, html) => {
  const root = html instanceof HTMLElement ? html : html?.[0];
  (root?.closest(".app") ?? app.element?.[0])?.classList.add("sre-roll-dialog");
});

/**
 * The system's own confirmations (DialogV2) and its Active Effect window get the Edge
 * dialog style too. The module's dialogs always carry the class.
 */
for (const hook of ["renderDialogV2", "renderActiveEffectConfig"]) {
  Hooks.on(hook, (app, html) => {
    const root = app.element instanceof HTMLElement ? app.element : html instanceof HTMLElement ? html : html?.[0];
    root?.classList.add("sre-dialog");
  });
}

/** The light/dark switch on the system's character sheet too (AppV1 in 3.x, AppV2 in 4.x). */
const switchLabel = () => game.i18n.localize(isLightTheme() ? "SRE.Theme.ToDark" : "SRE.Theme.ToLight");
const switchIcon = () => (isLightTheme() ? "fas fa-moon" : "fas fa-sun");
Hooks.on("getActorSheetHeaderButtons", (sheet, buttons) => {
  if (game.system.id !== "shadowrun6-eden" || sheet.actor?.type !== "Player") return;
  buttons.unshift({ label: switchLabel(), class: "sre-theme-switch", icon: switchIcon(), onclick: () => toggleTheme() });
});
Hooks.on("getHeaderControlsActorSheetV2", (sheet, controls) => {
  if (game.system.id !== "shadowrun6-eden" || sheet.actor?.type !== "Player" || sheet.constructor.name === "EdgeActorSheet") return;
  controls.unshift({ label: switchLabel(), icon: switchIcon(), action: "sreToggleTheme", onClick: () => toggleTheme() });
});
