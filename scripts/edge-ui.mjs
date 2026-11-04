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
  document.body.style.setProperty("--sre-bt-back", q("SRE.UI.BreakBack"));
  document.body.style.setProperty("--sre-bt-away", q("SRE.UI.BreakAway"));
  document.body.style.setProperty("--sre-pause-sub", q("SRE.UI.PauseSub"));
  // The icon font Foundry ships (Font Awesome 6 or 7, Pro or Free), read from one of its own icons: rules that put
  // the Edge face on buttons give icon buttons this font back, whatever the version.
  // A probe outside the interface, so no module rule touches it.
  const icon = document.createElement("i");
  icon.className = "fa-solid fa-dice";
  icon.style.cssText = "position:absolute;visibility:hidden;pointer-events:none";
  document.body.append(icon);
  const family = getComputedStyle(icon).fontFamily;
  icon.remove();
  if (family && !/chakra|signika/i.test(family)) document.body.style.setProperty("--sre-icon-font", family);
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

// ───── Diagnostics: the interface's skeleton for precise styling ─────

/** "tag#id.class1.class2" for an element (data-* names kept for buttons and tabs, no text, no values). */
export function describe(el) {
  if (!el?.tagName) return "";
  const id = el.id ? `#${el.id}` : "";
  const cls = [...(el.classList ?? [])].filter((c) => !c.startsWith("sre-fx")).map((c) => `.${c}`).join("");
  const data = ["data-tab", "data-action", "data-tool", "data-control", "data-group", "aria-pressed"]
    .filter((a) => el.getAttribute?.(a) !== null && el.getAttribute?.(a) !== undefined).map((a) => `[${a}=${el.getAttribute(a)}]`).join("");
  return `${el.tagName.toLowerCase()}${id}${cls}${data}`;
}

/** An indented tree of the element's structure; repeated sibling shapes collapse to one line with a count. */
export function skeleton(el, depth = 0, maxDepth = 6, out = []) {
  if (!el || depth > maxDepth) return out;
  out.push(`${"  ".repeat(depth)}${describe(el)}`);
  const kids = [...(el.children ?? [])].filter((c) => !["SCRIPT", "STYLE", "SVG", "PATH", "svg", "path"].includes(c.tagName));
  const seen = new Map();
  for (const c of kids) {
    const key = describe(c).replace(/#[\w-]+/, "#…");
    seen.set(key, (seen.get(key) ?? 0) + 1);
    if (seen.get(key) > 2) continue;
    skeleton(c, depth + 1, maxDepth, out);
  }
  for (const [key, n] of seen) if (n > 2) out.push(`${"  ".repeat(depth + 1)}… ${n - 2} × ${key}`);
  return out;
}

/** The skeleton of the interface and of every open window, as text (classes and ids only). */
export function uiDumpText() {
  const roots = ["#interface", "#sidebar", "#chat", "#hotbar", "#players", "#scene-controls", "#navigation", "#scene-navigation",
    "#combat", "#combat-dock", "#pause", "#notifications", "#context-menu", "#tooltip", "#chat-form", "#chat-message"];
  const parts = [`Foundry ${game.version} · ${game.system.id} ${game.system.version} · Shadowrun Edge ${game.modules.get(MODULE_ID)?.version}`,
    `body${[...document.body.classList].map((c) => `.${c}`).join("")}`,
    `modules: ${game.modules.filter((m) => m.active).map((m) => m.id).join(", ")}`];
  for (const sel of roots) {
    const el = document.querySelector(sel);
    if (el) parts.push(`\n=== ${sel}\n${skeleton(el, 0, 5).join("\n")}`);
  }
  for (const app of document.querySelectorAll(".application, .app.window-app")) {
    parts.push(`\n=== window ${describe(app)}\n${skeleton(app, 0, 4).join("\n")}`);
  }
  return parts.join("\n");
}

/** A window with the skeleton in a text box: select and copy by hand, or with the Copy button. */
export async function uiDump() {
  const text = uiDumpText();
  const esc = (v) => foundry.utils.escapeHTML(String(v));
  await foundry.applications.api.DialogV2.wait({
    classes: ["sre-dialog"],
    window: { title: game.i18n.localize("SRE.UI.DumpTitle"), icon: "fas fa-stethoscope" },
    position: { width: 640, height: 560 },
    content: `<p>${esc(game.i18n.localize("SRE.UI.DumpHint"))}</p>
      <textarea class="sre-ui-dump" readonly style="width:100%;height:400px;font:11px/1.3 monospace;white-space:pre">${esc(text)}</textarea>`,
    render: (event, dialog) => {
      const area = dialog.element.querySelector(".sre-ui-dump");
      area?.focus();
      area?.select();
    },
    buttons: [
      { action: "copy", label: game.i18n.localize("SRE.UI.DumpCopy"), icon: "fas fa-copy", default: true, callback: async (event, button) => {
        const area = button.form?.querySelector(".sre-ui-dump") ?? button.closest(".application")?.querySelector(".sre-ui-dump");
        area?.select();
        try {
          await navigator.clipboard.writeText(text);
        } catch {
          document.execCommand?.("copy");
        }
        ui.notifications.info(game.i18n.localize("SRE.UI.DumpCopied"));
      } },
      { action: "close", label: game.i18n.localize("Close") },
    ],
    rejectClose: false,
  });
  return text;
}

/** Typing /edge-ui in the chat opens it (nothing is posted). */
Hooks.on("chatMessage", (chatLog, message) => {
  if (String(message).trim().toLowerCase() !== "/edge-ui") return;
  uiDump();
  return false;
});
