/**
 * The catalog is a world compendium of ready-made items, sorted into folders by rulebook category.
 * Dragging an item from it onto a character sheet gives a complete item, including built-in mods.
 */
import { ratingUpdates } from "./wizard/formulas.mjs";

const MODULE_ID = "shadowrun-edge";
const PACK_NAME = "sre-katalog";

/** The catalog compendium; created on first use when `create` is set (GM only). */
export async function getCatalog(create = false) {
  let pack = game.packs.get(`world.${PACK_NAME}`);
  if (!pack && create && game.user.isGM) {
    pack = await foundry.documents.collections.CompendiumCollection.createCompendium({
      type: "Item",
      label: game.i18n.localize("SRE.Catalog.Label"),
      name: PACK_NAME,
      package: "world",
    });
  }
  return pack ?? null;
}

/** Finds or creates the folder chain (e.g. ["Broń palna", "Ciężkie pistolety"]) inside the compendium. */
async function ensureFolder(pack, path) {
  let parent = null;
  for (const name of path.filter(Boolean)) {
    let folder = pack.folders.find((f) => f.name === name && (f.folder?.id ?? null) === (parent?.id ?? null));
    folder ??= await Folder.implementation.create(
      { name, type: "Item", folder: parent?.id ?? null },
      { pack: pack.collection },
    );
    parent = folder;
  }
  return parent;
}

/** Adds items to the catalog under the given folder path and returns the created documents. */
export async function addToCatalog(itemsData, path = []) {
  const pack = await getCatalog(true);
  if (!pack) throw new Error(game.i18n.localize("SRE.Catalog.GMOnly"));
  if (pack.locked) throw new Error(game.i18n.format("SRE.Catalog.Locked", { name: pack.title }));
  const folder = await ensureFolder(pack, path);
  const data = itemsData.map((d) => ({ ...d, folder: folder?.id ?? null }));
  return Item.implementation.createDocuments(data, { pack: pack.collection });
}

/** Turns mod documents into data stored on the item they come with. */
export function modsToFlagData(mods) {
  return mods.map((mod) => {
    const data = mod.toObject();
    for (const key of ["_id", "folder", "sort", "ownership", "_stats"]) delete data[key];
    data.system.embeddedInUuid = null;
    return data;
  });
}

/**
 * When an item with built-in mods lands on an actor (dragged from the catalog, created by the wizard),
 * the mods are created next to it and installed in it, so their effects apply right away.
 */
Hooks.on("createItem", async (item, options, userId) => {
  if (userId !== game.user.id || !(item.parent instanceof Actor)) return;
  const mods = item.getFlag(MODULE_ID, "mods");
  if (!mods?.length) return;
  const data = mods.map((mod) => {
    const copy = foundry.utils.deepClone(mod);
    copy.system = { ...copy.system, embeddedInUuid: item.uuid };
    return copy;
  });
  await item.parent.createEmbeddedDocuments("Item", data);
  // The mods now live on the actor; the flag would otherwise install them again on every copy.
  await item.unsetFlag(MODULE_ID, "mods");
});

/** Lists built-in mods on the sheet of an item that is not on an actor yet (the system only shows installed ones). */
Hooks.on("renderItemSheet", (sheet, html) => {
  const item = sheet.item;
  const mods = item?.getFlag(MODULE_ID, "mods");
  if (!mods?.length || item.parent) return;
  const root = html instanceof HTMLElement ? html : html[0];
  if (!root || root.querySelector(".sre-builtin-mods")) return;
  const box = document.createElement("div");
  box.classList.add("sre-builtin-mods");
  const title = document.createElement("h3");
  title.textContent = game.i18n.localize("SRE.Catalog.BuiltInMods");
  const list = document.createElement("ul");
  for (const mod of mods) {
    const li = document.createElement("li");
    li.textContent = mod.name;
    list.append(li);
  }
  const hint = document.createElement("p");
  hint.classList.add("hint");
  hint.textContent = game.i18n.localize("SRE.Catalog.BuiltInModsHint");
  box.append(title, list, hint);
  (root.querySelector(".sheet-body") ?? root).append(box);
});

/** Changing the Rating of an item made from a rulebook formula recalculates its cost, Essence, etc. */
Hooks.on("preUpdateItem", (item, changes) => {
  const rating = foundry.utils.getProperty(changes, "system.rating");
  const formulas = item.getFlag(MODULE_ID, "formulas");
  if (rating === undefined || !formulas) return;
  const updates = ratingUpdates(formulas, Number(rating) || 0);
  // Only fields that exist on the item type (mods and software have no plain Availability number, for example).
  for (const [path, value] of Object.entries(updates)) {
    if (foundry.utils.hasProperty(item._source, path)) foundry.utils.setProperty(changes, path, value);
  }
});
