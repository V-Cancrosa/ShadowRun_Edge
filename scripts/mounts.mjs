/**
 * Accessory mounts (SR6 core p. 251–260) and Capacity (armor p. 266, optical/audio devices p. 274–276).
 * Each weapon mount (top, barrel, under) holds one accessory; add-ons with a Capacity cost [x] must fit the
 * host's Capacity. The system installs mods without these checks, so the module checks every installation.
 */
import { resolveConflict } from "./ui/conflict.mjs";

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

/** Checks a mod about to be installed in a host: { ok, slot, reason, detail, message }. */
function check(mod, host, pending = []) {
  const result = checkFit(
    weaponMounts(host), Number(host.system.capacity) || 0, [...installedIn(host, mod.id), ...pending],
    modMounts(mod), capacityCost(mod),
  );
  if (result.ok) return result;
  const d = result.detail ?? {};
  const message = game.i18n.format(`SRE.Mount.Error.${result.reason}`, {
    mod: mod.name, item: host.name, mounts: (d.mounts ?? []).map(slotLabel).join(" / "),
    used: d.used, cost: d.cost, capacity: d.capacity,
  });
  return { ...result, message };
}

/** Mods installed in a host on a given mount slot. */
function occupants(host, slot) {
  return host.actor.items.filter((i) => i.type === "mod" && i.system.installedIn?.id === host.id && (i.getFlag(MODULE_ID, "slot") ?? null) === slot);
}

/**
 * A mod that doesn't fit: the user picks what to do (never a hard stop for the GM). `retry(slot)` repeats the
 * installation with the chosen slot, skipping the checks.
 */
async function askMount(mod, host, result, retry) {
  const L = (key, data) => (data ? game.i18n.format(key, data) : game.i18n.localize(key));
  const options = [];
  const slot = result.slot ?? result.detail?.mounts?.[0] ?? null;
  if (result.reason === "mountTaken") {
    const taken = occupants(host, slot);
    options.push({ id: "replace", label: L("SRE.Mount.Choice.replace", { mods: taken.map((m) => m.name).join(", ") || "—", slot: slotLabel(slot) }), hint: L("SRE.Mount.Choice.replaceHint") });
  }
  if (result.reason === "capacity") {
    const need = result.detail.used + result.detail.cost - result.detail.capacity;
    for (const m of host.actor.items.filter((i) => i.type === "mod" && i.system.installedIn?.id === host.id && capacityCost(i) >= need)) {
      options.push({ id: `free:${m.id}`, label: L("SRE.Mount.Choice.free", { mod: m.name, cost: capacityCost(m) }), hint: L("SRE.Mount.Choice.replaceHint") });
    }
  }
  options.push({ id: "force", label: L("SRE.Mount.Choice.force"), hint: L(`SRE.Mount.Choice.forceHint.${result.reason}`), breaksRules: true });
  const choice = await resolveConflict({ title: L("SRE.Mount.Choice.Title", { mod: mod.name }), name: `${mod.name} → ${host.name}`, problems: [result.message], options });
  if (!choice) return;
  if (choice === "replace") {
    for (const m of occupants(host, slot)) await m.update({ "system.embeddedInUuid": null });
    return retry(slot);
  }
  if (choice.startsWith("free:")) {
    await host.actor.items.get(choice.slice(5))?.update({ "system.embeddedInUuid": null });
    return retry(result.slot ?? null);
  }
  if (choice === "force") return retry(result.reason === "noMount" ? null : slot);
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
  let slot;
  if (options.sreMountChoice) slot = options.sreMountChoice.slot ?? null;
  else {
    const result = check(item, host, reserved.filter((r) => r.host === host.id));
    if (!result.ok) {
      // Stop this creation and ask; the chosen option creates it again.
      const source = item.toObject();
      askMount(item, host, result, (chosen) => item.parent.createEmbeddedDocuments("Item", [source], { sreMountChoice: { slot: chosen }, sreSkipAcquire: options.sreSkipAcquire }));
      return false;
    }
    slot = result.slot;
  }
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
  if (options.sreMountChoice) {
    foundry.utils.setProperty(changes, `flags.${MODULE_ID}.slot`, options.sreMountChoice.slot ?? null);
    return;
  }
  const result = check(item, host);
  if (!result.ok) {
    const retryChanges = foundry.utils.deepClone(changes);
    askMount(item, host, result, (chosen) => item.update(retryChanges, { sreMountChoice: { slot: chosen } }));
    return false;
  }
  foundry.utils.setProperty(changes, `flags.${MODULE_ID}.slot`, result.slot);
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
