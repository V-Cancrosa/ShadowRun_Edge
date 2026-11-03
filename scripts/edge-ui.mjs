/**
 * Stage 12: the Edge look beyond the module's windows (styles/edge-ui.css).
 * Levels (world default set by the GM, each player may override):
 *   1 — the module only (sheets, module windows, roll cards), as before;
 *   2 — plus the whole chat and every button, field and list in Foundry;
 *   3 — the whole interface: sidebar and directories, scene controls, players, hotbar, navigation, pause,
 *       notifications, tooltips, context menus, Foundry's windows and the supported modules
 *       (Break Time, Carousel Combat Tracker, Chat Portrait, Dice Tray, Tokenizer, Levels, PopOut!).
 * Dice So Nice gets two "Shadowrun Edge" colorsets at any level.
 */
const MODULE_ID = "shadowrun-edge";

/** The level in effect: the player's choice, else the world's default. */
export function uiLevel(player, world) {
  const p = Number(player);
  if (p >= 1 && p <= 3) return p;
  const w = Number(world);
  return w >= 1 && w <= 3 ? w : 2;
}

function current() {
  try {
    return uiLevel(game.settings.get(MODULE_ID, "uiLevel"), game.settings.get(MODULE_ID, "uiLevelWorld"));
  } catch {
    return 2;
  }
}

/** Body classes for a level: sre-ui-2 and sre-ui-3 are cumulative (level 3 has both). */
export function levelClasses(level) {
  return { "sre-ui-2": level >= 2, "sre-ui-3": level >= 3 };
}

function apply(doc = document) {
  const classes = levelClasses(current());
  for (const [cls, on] of Object.entries(classes)) doc.body?.classList.toggle(cls, on);
}

Hooks.once("init", () => {
  const choices = { 1: "SRE.UI.Level.1", 2: "SRE.UI.Level.2", 3: "SRE.UI.Level.3" };
  game.settings.register(MODULE_ID, "uiLevelWorld", {
    name: "SRE.UI.World.Name", hint: "SRE.UI.World.Hint", scope: "world", config: true, type: String,
    choices, default: "2", onChange: () => apply(),
  });
  game.settings.register(MODULE_ID, "uiLevel", {
    name: "SRE.UI.Player.Name", hint: "SRE.UI.Player.Hint", scope: "client", config: true, type: String,
    choices: { world: "SRE.UI.Level.world", ...choices }, default: "world", onChange: () => apply(),
  });
  apply();
});
Hooks.once("ready", () => {
  apply();
  // Labels on whispered and blind messages, in the client's language.
  const q = (k) => JSON.stringify(game.i18n.localize(k));
  document.body.style.setProperty("--sre-whisper-label", q("SRE.UI.Whisper"));
  document.body.style.setProperty("--sre-blind-label", q("SRE.UI.Blind"));
});

/** New chat messages slide in (only fresh ones, with full animations). */
Hooks.on("renderChatMessageHTML", (message, html) => {
  const root = html instanceof HTMLElement ? html : html?.[0];
  if (!root || !document.body.classList.contains("sre-ui-2") || !document.body.classList.contains("sre-motion-full")) return;
  if (Date.now() - (message.timestamp ?? 0) > 3000) return;
  root.classList.add("sre-fx-msg");
  setTimeout(() => root.classList.remove("sre-fx-msg"), 600);
});

/** PopOut! windows are separate documents: they get the same look classes as the main window. */
for (const hook of ["PopOut:loaded", "PopOut:popout"]) {
  Hooks.on(hook, (app, node) => {
    const doc = node?.ownerDocument ?? node?.document ?? null;
    if (!doc?.body || doc === document) return;
    for (const cls of document.body.classList) if (cls.startsWith("sre-")) doc.body.classList.add(cls);
  });
}

/** Dice So Nice: Edge dice (magenta with cyan-lit numbers) and Edge cyan, in a "Shadowrun Edge" category. */
export const COLORSETS = [
  { name: "sre-edge", description: "Edge", category: "Shadowrun Edge", foreground: "#e8fbff", background: "#e0409a", outline: "#3fd4e8", edge: "#7a1d55", texture: "none", material: "metal", font: "Chakra Petch" },
  { name: "sre-edge-cyan", description: "Edge cyan", category: "Shadowrun Edge", foreground: "#ffffff", background: "#1a8fa0", outline: "#e0409a", edge: "#0b3a44", texture: "none", material: "metal", font: "Chakra Petch" },
];
Hooks.once("diceSoNiceReady", (dice3d) => {
  for (const set of COLORSETS) {
    try {
      dice3d.addColorset(set, "default");
    } catch (err) {
      console.warn(`${MODULE_ID} | Dice So Nice colorset`, err);
    }
  }
});
