/**
 * Where the module's content lives and what is new:
 * - the guide (compendium "Przewodnik Shadowrun Edge") is imported into the Journal, folder "Shadowrun Edge",
 *   by the GM whenever the module version changes (the previous copy is replaced);
 * - after a new version, every user sees a window with the changes since the version they last saw
 *   (data/changelog.json), with a button to the guide; it can be reopened from the Journal tab.
 */
import * as ui2 from "./ui/edge-ui.mjs";
import { segments, changesOf as changesIn } from "./changelog-rules.mjs";

const MODULE_ID = "shadowrun-edge";
const L = (key, data) => (data ? game.i18n.format(key, data) : game.i18n.localize(key));
const esc = (s) => foundry.utils.escapeHTML(String(s ?? ""));

const version = () => game.modules.get(MODULE_ID)?.version ?? "0.0.0";
const newer = (a, b) => foundry.utils.isNewerVersion(a, b);

/** Versions after `seen` (all of them up to `limit` when nothing was seen yet), newest first. */
/** The entries of a version in the client's language: Polish, else English (falls back to Polish). */
export function changesOf(version, lang = globalThis.game?.i18n?.lang) {
  return changesIn(version, lang);
}

export function changesSince(changelog, seen, limit = 3) {
  const list = [...changelog].sort((a, b) => (newer(a.version, b.version) ? -1 : newer(b.version, a.version) ? 1 : 0));
  if (!seen) return list.slice(0, limit);
  return list.filter((v) => newer(v.version, seen));
}

async function loadJson(file) {
  try {
    const response = await fetch(`modules/${MODULE_ID}/data/${file}`);
    return response.ok ? await response.json() : [];
  } catch {
    return [];
  }
}
const loadChangelog = () => loadJson("changelog.json");

/** The world copy of the guide, else the compendium one. */
async function guideEntry() {
  const world = game.journal.find((j) => j.getFlag(MODULE_ID, "guide"));
  if (world) return world;
  const pack = game.packs.get(`${MODULE_ID}.przewodnik`);
  const index = await pack?.getIndex();
  return index?.size ? pack.getDocument(index.contents[0]._id) : null;
}

/** GM: the guide in the Journal, folder "Shadowrun Edge", refreshed when the module version changes. */
async function importGuide() {
  if (!game.user.isGM || !game.users.activeGM?.isSelf) return;
  if (game.settings.get(MODULE_ID, "guideImported") === version()) return;
  const pack = game.packs.get(`${MODULE_ID}.przewodnik`);
  const index = await pack?.getIndex();
  if (!index?.size) return;
  let folder = game.folders.find((f) => f.type === "JournalEntry" && f.getFlag(MODULE_ID, "folder"));
  folder ??= await Folder.implementation.create({ name: "Shadowrun Edge", type: "JournalEntry", color: "#a33b6e", sorting: "m", flags: { [MODULE_ID]: { folder: true } } });
  const old = game.journal.filter((j) => j.getFlag(MODULE_ID, "guide")).map((j) => j.id);
  if (old.length) await JournalEntry.implementation.deleteDocuments(old);
  for (const { _id } of index) await game.journal.importFromCompendium(pack, _id, { folder: folder.id }, { keepId: true });
  await game.settings.set(MODULE_ID, "guideImported", version());
}

/** The "what's new" window. `all` shows the whole history. */
export async function showWelcome({ all = false } = {}) {
  const changelog = await loadChangelog();
  const seen = game.settings.get(MODULE_ID, "welcomeSeen");
  const groups = await loadJson("changelog-groups.json");
  const list = all || !seen ? changesSince(changelog, null, changelog.length) : changesSince(changelog, seen);
  // Steps of one larger piece of work read as one entry; the first time, the latest three of them.
  let segs = segments(list, groups, game.i18n.lang);
  if (!all && !seen) segs = segs.slice(0, 3);
  const panels = segs.map((sg) => ui2.panel(sg.title === sg.versions ? sg.versions : `${sg.title} · ${sg.versions}`,
    `<ul class="sre-welcome-list">${sg.changes.map((c) => `<li>${esc(c)}</li>`).join("")}</ul>`, { hint: sg.date })).join("");
  const choice = ui2.okOnly(await foundry.applications.api.DialogV2.wait({
    classes: ["sre-dialog", "sre-welcome"],
    window: { title: L("SRE.Welcome.Title", { version: version() }), icon: "fas fa-bolt" },
    position: { width: 560, height: Math.min(720, window.innerHeight - 100) },
    content: `<div class="sre-ed">
      ${ui2.head({ kind: "Shadowrun Edge", name: L("SRE.Welcome.Name", { version: version() }), sub: L(seen && !all ? "SRE.Welcome.SinceSeen" : "SRE.Welcome.Sub", { seen }) })}
      <div class="sre-ed-body">${panels || ui2.note(L("SRE.Welcome.Nothing"), "info")}${ui2.note(L("SRE.Welcome.Where"), "info")}</div>
    </div>`,
    buttons: [
      { action: "cancel", label: L("SRE.Welcome.Close"), class: "sre-ed-ghost" },
      { action: "ok", label: L("SRE.Welcome.Guide"), icon: "fas fa-book", default: true, class: "sre-ed-main", callback: () => "guide" },
    ],
    rejectClose: false,
  }));
  await game.settings.set(MODULE_ID, "welcomeSeen", version());
  if (choice === "guide") (await guideEntry())?.sheet.render(true);
}

Hooks.once("init", () => {
  game.settings.register(MODULE_ID, "welcomeSeen", { scope: "client", config: false, type: String, default: "" });
  game.settings.register(MODULE_ID, "guideImported", { scope: "world", config: false, type: String, default: "" });
});

Hooks.once("ready", async () => {
  if (game.system.id !== "shadowrun6-eden") return;
  try {
    await importGuide();
  } catch (err) {
    console.warn(`${MODULE_ID} | guide import`, err);
  }
  if (game.settings.get(MODULE_ID, "welcomeSeen") !== version()) showWelcome();
});

/** "What's new" button in the Journal tab header. */
Hooks.on("renderJournalDirectory", (app, html) => {
  const root = html instanceof HTMLElement ? html : html?.[0];
  const actions = root?.querySelector(".header-actions");
  if (!actions || actions.querySelector(".sre-welcome-button")) return;
  const button = document.createElement("button");
  button.type = "button";
  button.className = "sre-welcome-button";
  button.innerHTML = `<i class="fas fa-bolt"></i> ${esc(L("SRE.Welcome.Button"))}`;
  button.addEventListener("click", () => showWelcome({ all: true }));
  actions.append(button);
});
