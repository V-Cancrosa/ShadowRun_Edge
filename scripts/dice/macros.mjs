/**
 * Stage 13F: hotbar macros for the Edge engine. Dragging a roll button (skill, weapon, spell, ritual, complex form)
 * from an Edge sheet, or such an item from a character, onto the hotbar makes a macro that rolls it through the
 * engine: game.modules.get("shadowrun-edge").api.roll({ actor, kind, id, spec }).
 */
import * as rolls from "../sheet/system-rolls.mjs";

const MODULE_ID = "shadowrun-edge";
const ROLLABLE = new Set(["spell", "ritual", "complexform"]);
const L = (key, data) => (data ? game.i18n.format(key, data) : game.i18n.localize(key));

/** Whether an item rolls (weapons, spells, rituals, complex forms). Pure. */
export function rollableItem(item) {
  if (!item) return false;
  if (ROLLABLE.has(item.type)) return true;
  return item.type === "gear" && String(item.system?.type ?? "").startsWith("WEAPON");
}

/** The macro for a drag payload (pure: names and command only). */
export function macroFor(payload, { name, img } = {}) {
  const arg = JSON.stringify({ actor: payload.actor, kind: payload.kind, id: payload.id, spec: payload.spec ?? null });
  return { name, img: img || "icons/svg/d20-black.svg", type: "script", command: `game.modules.get("${MODULE_ID}").api.roll(${arg});`, flags: { [MODULE_ID]: { roll: payload } } };
}

/** Rolls what a macro names: an item by id or a skill (with a specialization), for the actor or the selected token. */
export async function rollFromMacro({ actor: actorUuid, kind, id, spec } = {}) {
  let actor = actorUuid ? await fromUuid(actorUuid) : null;
  actor = actor?.actor ?? actor ?? canvas?.tokens?.controlled?.[0]?.actor ?? game.user.character;
  if (!actor) return ui.notifications.warn(L("SRE.Macro.NoActor"));
  if (kind === "skill") return rolls.rollSkill(actor, id, spec || undefined);
  const item = actor.items.get(id);
  if (!item) return ui.notifications.warn(L("SRE.Macro.NoItem"));
  if (item.type === "spell") return rolls.rollSpell(actor, item);
  if (item.type === "ritual") return rolls.rollRitual(actor, item);
  if (item.type === "complexform") return rolls.rollComplexForm(actor, item);
  return rolls.rollWeapon(actor, item);
}

/** Makes Edge sheet roll buttons draggable to the hotbar. */
export function makeDraggable(sheet) {
  const actor = sheet.document;
  for (const b of sheet.element.querySelectorAll('[data-action="rollSkill"], [data-action="rollWeapon"], [data-action="rollSpell"], [data-action="rollForm"]')) {
    if (b.draggable) continue;
    b.draggable = true;
    b.addEventListener("dragstart", (event) => {
      const itemId = b.closest("[data-item-id]")?.dataset.itemId;
      const payload = b.dataset.action === "rollSkill"
        ? { type: "sre-roll", actor: actor.uuid, kind: "skill", id: b.dataset.skill, spec: b.dataset.spec || null }
        : { type: "sre-roll", actor: actor.uuid, kind: "item", id: itemId };
      if (payload.kind === "item" && !payload.id) return;
      event.dataTransfer.setData("text/plain", JSON.stringify(payload));
    });
  }
}

Hooks.on("hotbarDrop", (bar, data, slot) => {
  let payload = null;
  let name = "";
  let img = "";
  if (data?.type === "sre-roll") {
    payload = data;
    if (data.kind === "skill") name = `${game.i18n.localize(`skill.${data.id}`)}${data.spec ? ` (${data.spec})` : ""}`;
    else {
      const item = fromUuidSync(data.actor)?.items?.get?.(data.id);
      name = item?.name ?? "";
      img = item?.img ?? "";
    }
  } else if (data?.type === "Item" && data.uuid) {
    let item = null;
    try {
      item = fromUuidSync(data.uuid);
    } catch {
      item = null;
    }
    if (!item?.actor || !rollableItem(item)) return;
    payload = { type: "sre-roll", actor: item.actor.uuid, kind: "item", id: item.id };
    name = item.name;
    img = item.img;
  }
  if (!payload) return;
  const actorName = fromUuidSync(payload.actor)?.name;
  Macro.implementation.create(macroFor(payload, { name: actorName ? `${name} · ${actorName}` : name, img }), { displaySheet: false })
    .then((macro) => game.user.assignHotbarMacro(macro, slot));
  return false;
});
