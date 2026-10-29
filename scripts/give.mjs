/**
 * Deleting an item from a character or giving it to another character. Installed mods go with their host item.
 * A player usually cannot create items on someone else's character, so the transfer is then done by the active
 * GM through the module socket, after checking that the sender owns the item.
 */
const MODULE_ID = "shadowrun-edge";
const SOCKET = `module.${MODULE_ID}`;
const L = (key, data) => (data ? game.i18n.format(key, data) : game.i18n.localize(key));

/** Mods installed in a host item (system field embeddedInUuid points at the host). */
export function installedMods(host, items) {
  return [...items].filter((i) => i.type === "mod" && i.system?.embeddedInUuid && i.system.embeddedInUuid === host.uuid);
}

const clean = (data) => {
  for (const key of ["_id", "folder", "sort", "ownership", "_stats"]) delete data[key];
  return data;
};

/**
 * What a transfer creates and removes.
 * @param {object} item    the item (document or plain object with toObject/uuid/system)
 * @param {object[]} items all items of the source actor
 * @param {number} [count] how many of a countable item; less than all splits the stack and leaves the mods
 * @returns {{ host: object, mods: object[], deleteIds: string[], sourceUpdate: object|null }}
 */
export function planTransfer(item, items, count) {
  const total = Number(item.system?.count) || 0;
  const split = item.system?.countable && count > 0 && count < total;
  const host = clean(item.toObject());
  if (split) {
    host.system.count = count;
    return { host, mods: [], deleteIds: [], sourceUpdate: { _id: item.id, "system.count": total - count } };
  }
  const mods = installedMods(item, items);
  return {
    host,
    mods: mods.map((m) => clean(m.toObject())),
    deleteIds: [...mods.map((m) => m.id), item.id],
    sourceUpdate: null,
  };
}

/** Moves the item; the caller must be allowed to edit both actors. */
async function transfer(source, itemId, target, count, user = game.user) {
  const item = source.items.get(itemId);
  if (!item) return false;
  const plan = planTransfer(item, source.items, count);
  const [created] = await target.createEmbeddedDocuments("Item", [plan.host], { sreSkipAcquire: true });
  if (!created) return false;
  if (plan.mods.length) {
    const mods = plan.mods.map((m) => ({ ...m, system: { ...m.system, embeddedInUuid: created.uuid } }));
    await target.createEmbeddedDocuments("Item", mods, { sreSkipAcquire: true });
  }
  if (plan.sourceUpdate) await source.updateEmbeddedDocuments("Item", [plan.sourceUpdate]);
  if (plan.deleteIds.length) await source.deleteEmbeddedDocuments("Item", plan.deleteIds);
  const qty = plan.sourceUpdate ? ` ×${count}` : "";
  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor: source }),
    content: `<p class="sre-give-msg">${L("SRE.Give.Chat", { from: source.name, item: `${item.name}${qty}`, to: target.name, user: user.name })}</p>`,
  });
  return true;
}

/** Player characters that can receive an item, with their owners' names. */
function recipients(source) {
  return game.actors
    .filter((a) => a.type === "Player" && a.id !== source.id)
    .map((a) => {
      const owners = game.users.filter((u) => !u.isGM && a.testUserPermission(u, "OWNER")).map((u) => u.name);
      return { id: a.id, name: a.name, owners: owners.join(", ") };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** Asks for the recipient (and the amount of a countable item), then transfers. */
export async function giveItem(item) {
  const source = item.actor;
  if (!source?.isOwner) return;
  const list = recipients(source);
  if (!list.length) return ui.notifications.warn(L("SRE.Give.NoRecipients"));
  const total = Number(item.system.count) || 0;
  const countable = item.system.countable && total > 1;
  const mods = installedMods(item, source.items);
  const options = list.map((r) => `<option value="${r.id}">${foundry.utils.escapeHTML(r.name)}${r.owners ? ` (${foundry.utils.escapeHTML(r.owners)})` : ""}</option>`).join("");
  const result = await foundry.applications.api.DialogV2.prompt({
    classes: ["sre-dialog"],
    window: { title: L("SRE.Give.Title", { name: item.name }) },
    content: `<div class="sre-give">
      <label>${L("SRE.Give.To")} <select name="target">${options}</select></label>
      ${countable ? `<label>${L("SRE.Give.Count", { total })} <input type="number" name="count" value="${total}" min="1" max="${total}"></label>` : ""}
      ${mods.length ? `<p class="hint">${L("SRE.Give.WithMods", { mods: mods.map((m) => m.name).join(", ") })}</p>` : ""}
    </div>`,
    ok: { label: L("SRE.Give.Button"), callback: (event, button) => ({ target: button.form.elements.target.value, count: Number(button.form.elements.count?.value) || 0 }) },
    rejectClose: false,
  });
  if (!result?.target) return;
  const target = game.actors.get(result.target);
  const count = countable ? Math.max(1, Math.min(total, result.count)) : 0;
  if (target?.isOwner) return transfer(source, item.id, target, count);
  if (!game.users.activeGM) return ui.notifications.warn(L("SRE.Give.NoGM"));
  game.socket.emit(SOCKET, { type: "giveItem", sourceId: source.id, itemId: item.id, targetId: target.id, count });
  ui.notifications.info(L("SRE.Give.Sent", { name: item.name, to: target.name }));
}

/** Deletes an item, together with the mods installed in it, after confirmation. */
export async function deleteItem(item) {
  const actor = item.actor;
  const mods = actor ? installedMods(item, actor.items) : [];
  const ok = await foundry.applications.api.DialogV2.confirm({
    classes: ["sre-dialog"],
    window: { title: L("SRE.Give.DeleteTitle", { name: item.name }) },
    content: `<p>${L("SRE.Give.DeleteText", { name: item.name })}</p>${mods.length ? `<p class="hint">${L("SRE.Give.DeleteMods", { mods: mods.map((m) => m.name).join(", ") })}</p>` : ""}`,
  });
  if (!ok) return;
  if (actor) return actor.deleteEmbeddedDocuments("Item", [...mods.map((m) => m.id), item.id]);
  return item.delete();
}

Hooks.once("ready", () => {
  game.socket.on(SOCKET, async (data, senderId) => {
    if (data?.type !== "giveItem" || !game.users.activeGM?.isSelf) return;
    const user = game.users.get(senderId);
    const source = game.actors.get(data.sourceId);
    const target = game.actors.get(data.targetId);
    // Only the owner of the source character may give its items away.
    if (!user || !source || !target || !source.testUserPermission(user, "OWNER")) return;
    await transfer(source, data.itemId, target, Number(data.count) || 0, user);
  });
});

/** "Give" and "Delete" buttons on the system's item sheets of items on a character. */
Hooks.on("getItemSheetHeaderButtons", (sheet, buttons) => {
  const item = sheet.item;
  if (!item?.actor?.isOwner || item.type === "skill") return;
  buttons.unshift(
    { label: L("SRE.Give.Button"), class: "sre-give-button", icon: "fas fa-hand-holding", onclick: () => giveItem(item) },
    { label: L("SRE.Give.Delete"), class: "sre-delete-button", icon: "fas fa-trash", onclick: async () => { await deleteItem(item); } },
  );
});
