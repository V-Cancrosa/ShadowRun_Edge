/**
 * Stage 13D: the Garage. In the system a vehicle or drone a character owns is a gear item (type VEHICLES or
 * DRONES) with the vehicle's stats, while driving, the Handling test, ramming and drone tests need a Vehicle
 * actor. The Garage links the two: "Take out the vehicle" creates a Vehicle actor from the item (stats copied,
 * the character as owner and driver, the same players as owners) and remembers it in the item's flag; the item
 * then shows the vehicle's state and its maneuvers, and "Sync" copies the stats again after the item changed.
 * Players who may not create actors get the vehicle created by the active GM through the module socket.
 */
const MODULE_ID = "shadowrun-edge";
const SOCKET = `module.${MODULE_ID}`;
const L = (key, data) => (data ? game.i18n.format(key, data) : game.i18n.localize(key));
const num = (v, d = 0) => (Number.isFinite(Number(v)) && v !== "" && v !== null ? Number(v) : d);

/** The stats a vehicle item and a Vehicle actor share (same names in the system's data). */
export const VEHICLE_STATS = ["handlOn", "handlOff", "accOn", "accOff", "spdiOn", "spdiOff", "tspd", "bod", "arm", "pil", "sen", "sea"];

/** Whether an item is a vehicle or drone. Pure. */
export function isVehicleItem(item) {
  return item?.type === "gear" && ["VEHICLES", "DRONES"].includes(item.system?.type);
}

/** Vehicle type of the actor from the item (system VEHICLE_TYPE keys: ground_craft, water_craft, air_craft). Pure. */
export function vtypeOf(item) {
  const v = String(item.system?.vtype ?? "").toLowerCase();
  if (v) return v;
  const sub = String(item.system?.subtype ?? "");
  if (/BOAT|SHIP|SUB|WATER/.test(sub)) return "water_craft";
  if (/AIR|PLANE|HELI|ROTOR|VTOL|LTA|DRONE_FLY/.test(sub)) return "air_craft";
  return "ground_craft";
}

/** The Vehicle actor's data from an item (pure). */
export function vehicleData(item, owner) {
  const s = item.system ?? {};
  const system = Object.fromEntries(VEHICLE_STATS.map((k) => [k, num(s[k])]));
  system.vtype = vtypeOf(item);
  system.vehicle = { belongs: owner?.id ?? "", opMode: item.system?.type === "DRONES" ? "rcc" : "manual", offRoad: false, speed: 0 };
  return {
    name: item.name, type: "Vehicle", img: item.img, system,
    ownership: owner?.ownership ? foundry.utils.deepClone(owner.ownership) : undefined,
    flags: { [MODULE_ID]: { fromItem: item.uuid } },
  };
}

/** The changes that bring a Vehicle actor back in line with its item (empty when equal). Pure. */
export function syncChanges(item, vehicle) {
  const out = {};
  for (const k of VEHICLE_STATS) if (num(item.system?.[k]) !== num(vehicle.system?.[k])) out[`system.${k}`] = num(item.system?.[k]);
  if (item.name !== vehicle.name) out.name = item.name;
  return out;
}

/** The linked Vehicle actor of an item, if it still exists. */
export function linkedVehicle(item) {
  const uuid = item?.getFlag?.(MODULE_ID, "vehicle");
  if (!uuid) return null;
  try {
    return fromUuidSync(uuid) ?? null;
  } catch {
    return null;
  }
}

async function folder() {
  if (!game.user.isGM) return null;
  const name = L("SRE.Garage.Folder");
  return game.folders.find((f) => f.type === "Actor" && f.name === name) ?? Folder.implementation.create({ name, type: "Actor", color: "#4a1236" });
}

async function create(item, owner) {
  const data = vehicleData(item, owner);
  const f = await folder();
  if (f) data.folder = f.id;
  const actor = await Actor.implementation.create(data);
  if (actor) await item.setFlag(MODULE_ID, "vehicle", actor.uuid);
  return actor;
}

/** "Take out the vehicle": creates (or opens) the Vehicle actor for an item on a character. */
export async function takeOut(item) {
  if (!isVehicleItem(item)) return null;
  const existing = linkedVehicle(item);
  if (existing) return existing.sheet.render(true);
  const owner = item.actor;
  if (!owner) return ui.notifications.warn(L("SRE.Garage.NeedsOwner"));
  if (game.user.can("ACTOR_CREATE")) {
    const actor = await create(item, owner);
    actor?.sheet.render(true);
    return actor;
  }
  if (!game.users.activeGM) return ui.notifications.warn(L("SRE.Garage.NoGM"));
  game.socket.emit(SOCKET, { type: "sre-garage", itemUuid: item.uuid });
  ui.notifications.info(L("SRE.Garage.Asked"));
  return null;
}

/** Copies the item's stats to its vehicle again. */
export async function sync(item) {
  const vehicle = linkedVehicle(item);
  if (!vehicle) return;
  const changes = syncChanges(item, vehicle);
  if (!Object.keys(changes).length) return ui.notifications.info(L("SRE.Garage.InSync"));
  if (vehicle.isOwner) await vehicle.update(changes);
  ui.notifications.info(L("SRE.Garage.Synced", { name: vehicle.name }));
}

Hooks.once("ready", () => {
  game.socket.on(SOCKET, async (data, senderId) => {
    if (data?.type !== "sre-garage" || !game.users.activeGM?.isSelf) return;
    const item = await fromUuid(data.itemUuid);
    const user = game.users.get(senderId);
    // Only for an item on a character the asking player owns.
    if (!item?.actor || !user || !item.actor.testUserPermission(user, "OWNER") || linkedVehicle(item)) return;
    await create(item, item.actor);
  });
});

// A deleted vehicle actor: its item forgets it (the GM cleans up for everyone).
Hooks.on("deleteActor", async (actor) => {
  if (!game.user.isGM || actor.type !== "Vehicle") return;
  const uuid = actor.getFlag(MODULE_ID, "fromItem");
  const item = uuid ? await fromUuid(uuid).catch(() => null) : null;
  if (item?.getFlag(MODULE_ID, "vehicle") === actor.uuid) await item.unsetFlag(MODULE_ID, "vehicle");
});

// The item changed its stats: its vehicle follows (for whoever owns both); the vehicle moved: the item sheet shows it.
Hooks.on("updateItem", (item, changes, options, userId) => {
  if (userId !== game.user.id || !isVehicleItem(item)) return;
  const vehicle = linkedVehicle(item);
  if (!vehicle?.isOwner) return;
  const diff = syncChanges(item, vehicle);
  if (Object.keys(diff).length) vehicle.update(diff);
});
Hooks.on("updateActor", (actor) => {
  if (actor.type !== "Vehicle") return;
  const uuid = actor.getFlag(MODULE_ID, "fromItem");
  if (!uuid) return;
  try {
    const item = fromUuidSync(uuid);
    if (item?.sheet?.rendered) item.sheet.render();
  } catch {
    /* the item is gone */
  }
});
