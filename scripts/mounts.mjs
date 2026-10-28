/**
 * Accessory mounts (SR6 core p. 251–260) and Capacity (armor p. 266, optical/audio devices p. 274–276).
 * Each weapon mount (top, barrel, under) holds one accessory; add-ons with a Capacity cost [x] must fit the
 * host's Capacity. The system installs mods without these checks, so the module checks every installation.
 */
const MODULE_ID = "shadowrun-edge";

export const SLOTS = ["top", "barrel", "under"];

/** Mounts a weapon has by subtype (p. 251–258); null = the rulebook gives none, nothing is checked. */
const MOUNTS_BY_SUBTYPE = {
  TASERS: { top: 1 },
  HOLDOUTS: {},
  PISTOLS_LIGHT: { top: 1, barrel: 1 },
  MACHINE_PISTOLS: { top: 1, barrel: 1 },
  PISTOLS_HEAVY: { top: 1, barrel: 1 },
  SUBMACHINE_GUNS: { top: 1, barrel: 1 },
  SHOTGUNS: { top: 1, barrel: 1, under: 1 },
  RIFLE_ASSAULT: { top: 1, barrel: 1, under: 1 },
  RIFLE_HUNTING: { top: 1, barrel: 1, under: 1 },
  RIFLE_SNIPER: { top: 1, barrel: 1, under: 1 },
  LMG: { top: 1, barrel: 1, under: 1 },
  MMG: { top: 1, barrel: 1, under: 1 },
  HMG: { top: 1, barrel: 1, under: 1 },
  ASSAULT_CANNON: { top: 1, barrel: 1, under: 1 },
  DMSO: { top: 1, under: 1 },
  DART: { top: 1 },
  LAUNCHERS: { top: 1, under: 1 },
};

/** Mounts of a weapon: its own flag (catalog exceptions such as the Colt M23) or the subtype default. */
export function weaponMounts(item) {
  const own = item?.flags?.[MODULE_ID]?.mounts;
  if (own) return own;
  if (!String(item?.system?.type ?? "").startsWith("WEAPON_")) return null;
  return MOUNTS_BY_SUBTYPE[item.system.subtype] ?? null;
}

/** Mounts an accessory may use, e.g. ["top", "under"]; empty = it needs no mount (holster, shock pad). */
export function modMounts(mod) {
  return mod?.flags?.[MODULE_ID]?.mount ?? [];
}

/** Capacity an add-on takes up: a number, or its Rating for "[Rating]" add-ons. */
export function capacityCost(mod) {
  const cost = mod?.flags?.[MODULE_ID]?.capacityCost;
  if (cost === undefined || cost === null || cost === "") return 0;
  if (String(cost).toUpperCase() === "R") return Math.max(1, Number(mod.system?.rating) || 1);
  return Number(cost) || 0;
}

/**
 * Checks whether a mod fits a host next to the mods already installed in it.
 * @param {object|null} mounts      host mounts ({ top: 1, ... }) or null when not checked
 * @param {number} capacity          host Capacity (0 = not checked)
 * @param {object[]} installed       [{ slot, cost }] of the mods already installed
 * @param {string[]} allowed         mounts the new mod may use
 * @param {number} cost              Capacity the new mod takes up
 * @returns {{ ok: boolean, slot: string|null, reason?: string, detail?: object }}
 */
export function checkFit(mounts, capacity, installed, allowed, cost) {
  let slot = null;
  if (mounts && allowed.length) {
    const offered = allowed.filter((s) => (mounts[s] ?? 0) > 0);
    if (!offered.length) return { ok: false, slot: null, reason: "noMount", detail: { mounts: allowed } };
    slot = offered.find((s) => installed.filter((m) => m.slot === s).length < mounts[s]) ?? null;
    if (!slot) return { ok: false, slot: null, reason: "mountTaken", detail: { mounts: offered } };
  }
  if (capacity > 0 && cost > 0) {
    const used = installed.reduce((sum, m) => sum + (m.cost ?? 0), 0);
    if (used + cost > capacity) return { ok: false, slot, reason: "capacity", detail: { used, cost, capacity } };
  }
  return { ok: true, slot };
}

/** Mods installed in a host item on its actor, with their slot and Capacity cost. */
function installedIn(host, exceptId) {
  return host.actor.items
    .filter((i) => i.type === "mod" && i.id !== exceptId && i.system.installedIn?.id === host.id)
    .map((i) => ({ name: i.name, slot: i.getFlag(MODULE_ID, "slot") ?? null, cost: capacityCost(i) }));
}

function hostOf(actor, uuid) {
  if (!actor || !uuid) return null;
  const parsed = foundry.utils.parseUuid(uuid);
  return actor.items.get(parsed?.id ?? parsed?.documentId) ?? null;
}

function slotLabel(slot) {
  return game.i18n.localize(`SRE.Mount.Slot.${slot}`);
}

/** Runs the checks for a mod about to be installed; returns the slot to record, or false to stop it. */
function validate(mod, host, pending = []) {
  const result = checkFit(
    weaponMounts(host), Number(host.system.capacity) || 0, [...installedIn(host, mod.id), ...pending],
    modMounts(mod), capacityCost(mod),
  );
  if (result.ok) return result.slot;
  const d = result.detail ?? {};
  const message = game.i18n.format(`SRE.Mount.Error.${result.reason}`, {
    mod: mod.name, item: host.name, mounts: (d.mounts ?? []).map(slotLabel).join(" / "),
    used: d.used, cost: d.cost, capacity: d.capacity,
  });
  const rule = game.settings.get(MODULE_ID, "mountRules");
  if (rule === "off") return null;
  if (rule === "warn") {
    ui.notifications.warn(message);
    return null;
  }
  ui.notifications.error(message);
  return false;
}

// Mods created in one go (an item's built-in mods) are not on the actor yet while the next one is checked,
// so the slots they take are remembered until the creation finishes.
let reserved = [];
function reserve(entry) {
  if (!reserved.length) setTimeout(() => { reserved = []; }, 0);
  reserved.push(entry);
}

// A mod created already installed (dragged from a compendium onto a weapon sheet, or a built-in mod).
Hooks.on("preCreateItem", (item, data, options, userId) => {
  if (userId !== game.user.id || item.type !== "mod" || !(item.parent instanceof Actor)) return;
  const host = hostOf(item.parent, item.system.embeddedInUuid);
  if (!host) return;
  const slot = validate(item, host, reserved.filter((r) => r.host === host.id));
  if (slot === false) return false;
  reserve({ host: host.id, name: item.name, slot, cost: capacityCost(item) });
  item.updateSource({ [`flags.${MODULE_ID}.slot`]: slot });
});

// A mod from the inventory installed in an item, or uninstalled.
Hooks.on("preUpdateItem", (item, changes, options, userId) => {
  if (userId !== game.user.id || item.type !== "mod" || !item.actor) return;
  if (!foundry.utils.hasProperty(changes, "system.embeddedInUuid")) return;
  const uuid = foundry.utils.getProperty(changes, "system.embeddedInUuid");
  if (!uuid) {
    foundry.utils.setProperty(changes, `flags.${MODULE_ID}.slot`, null);
    return;
  }
  const host = hostOf(item.actor, uuid);
  if (!host) return;
  const slot = validate(item, host);
  if (slot === false) return false;
  foundry.utils.setProperty(changes, `flags.${MODULE_ID}.slot`, slot);
});

/** Mount and Capacity overview on the sheet of an item that holds mods. */
Hooks.on("renderItemSheet", (sheet, html) => {
  const host = sheet.item;
  if (!host?.actor || host.type !== "gear") return;
  const mounts = weaponMounts(host);
  const capacity = Number(host.system.capacity) || 0;
  const installed = installedIn(host);
  if (!mounts && !(capacity > 0 && installed.some((m) => m.cost > 0))) return;
  const root = html instanceof HTMLElement ? html : html[0];
  if (!root || root.querySelector(".sre-mounts")) return;

  const box = document.createElement("div");
  box.classList.add("sre-mounts");
  const parts = [];
  if (mounts) {
    for (const slot of SLOTS) {
      const count = mounts[slot] ?? 0;
      const used = installed.filter((m) => m.slot === slot).map((m) => m.name);
      const text = !count ? "—" : used.length ? used.join(", ") : game.i18n.localize("SRE.Mount.Free");
      parts.push(`<span><strong>${slotLabel(slot)}${count > 1 ? ` (${used.length}/${count})` : ""}:</strong> ${Handlebars.escapeExpression(text)}</span>`);
    }
  }
  if (capacity > 0) {
    const used = installed.reduce((sum, m) => sum + m.cost, 0);
    parts.push(`<span><strong>${game.i18n.localize("shadowrun6.item.capacity")}:</strong> ${used}/${capacity}</span>`);
  }
  box.innerHTML = `<i class="fas fa-screwdriver-wrench"></i> ${parts.join(" ")}`;
  (root.querySelector(".sheet-body") ?? root).prepend(box);
});
