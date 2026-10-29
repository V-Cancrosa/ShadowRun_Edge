/**
 * "Edge" look for the shadowrun6-eden system: a stylesheet scoped to body.sre-theme
 * (styles/system-theme.css) plus a few DOM touches the CSS can't do alone.
 * Each player picks the look; the GM can force one for the whole world.
 */
const MODULE_ID = "shadowrun-edge";
const THEMES = ["off", "dark", "light"];

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
 * The look in effect for this client: the GM's world override wins over the player's choice;
 * "auto" follows Foundry's color scheme.
 */
export function activeTheme() {
  const forced = game.settings.get(MODULE_ID, "themeOverride");
  let theme = forced === "player" ? game.settings.get(MODULE_ID, "theme") : forced;
  if (theme === "auto") theme = foundryScheme();
  return THEMES.includes(theme) ? theme : "off";
}

function applyTheme() {
  const theme = activeTheme();
  const body = document.body;
  body.classList.toggle("sre-theme", theme !== "off");
  for (const t of THEMES) body.classList.toggle(`sre-theme-${t}`, theme === t);
  // The module's own windows (Edge sheets, creator, dialogs) are always Edge: light with the light look,
  // or with Foundry's light scheme when the system look is off.
  body.classList.toggle("sre-edge-light", theme === "light" || (theme === "off" && foundryScheme() === "light"));
  // Re-render open sheets so the damage monitors pick up (or drop) the box styling.
  const apps = [...Object.values(ui.windows ?? {}), ...(globalThis.foundry?.applications?.instances?.values?.() ?? [])];
  for (const app of apps) if (app.actor && app.rendered) app.render(false);
}

Hooks.once("init", () => {
  game.settings.register(MODULE_ID, "theme", {
    name: "SRE.Theme.Setting.Name",
    hint: "SRE.Theme.Setting.Hint",
    scope: "client",
    config: true,
    type: String,
    choices: { auto: "SRE.Theme.auto", dark: "SRE.Theme.dark", light: "SRE.Theme.light", off: "SRE.Theme.off" },
    default: "auto",
    onChange: applyTheme,
  });

  game.settings.register(MODULE_ID, "themeOverride", {
    name: "SRE.Theme.Override.Name",
    hint: "SRE.Theme.Override.Hint",
    scope: "world",
    config: true,
    type: String,
    choices: { player: "SRE.Theme.player", auto: "SRE.Theme.auto", dark: "SRE.Theme.dark", light: "SRE.Theme.light", off: "SRE.Theme.off" },
    default: "player",
    onChange: applyTheme,
  });
});

Hooks.once("setup", () => {
  if (game.system.id === "shadowrun6-eden") applyTheme();
});
Hooks.once("ready", () => {
  if (game.system.id === "shadowrun6-eden") applyTheme();
});
// Foundry's color scheme changed: "auto" (and the Edge windows with the look off) follow it.
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
  if (activeTheme() === "off") return;
  const root = html instanceof HTMLElement ? html : html?.[0];
  if (root) markMonitors(root.closest(".app") ?? root);
});

/** The system's roll dialog is a plain Dialog subclass; tag it so the theme can reach it. */
Hooks.on("renderRollDialog", (app, html) => {
  const root = html instanceof HTMLElement ? html : html?.[0];
  (root?.closest(".app") ?? app.element?.[0])?.classList.add("sre-roll-dialog");
});

/**
 * With the Edge look on, the system's own confirmations (DialogV2) and its Active Effect window get the Edge
 * dialog style too. The module's dialogs always carry the class.
 */
for (const hook of ["renderDialogV2", "renderActiveEffectConfig"]) {
  Hooks.on(hook, (app, html) => {
    if (activeTheme() === "off") return;
    const root = app.element instanceof HTMLElement ? app.element : html instanceof HTMLElement ? html : html?.[0];
    root?.classList.add("sre-dialog");
  });
}
