/**
 * Buying gear: when an item lands on a player character, the module offers to pay for it from the character's
 * nuyen (SR6 core p. 245–246: Availability, legality, size cost adjustments). The system has no shop.
 */
const MODULE_ID = "shadowrun-edge";

// Dwarf and troll metavariants (SR6 core p. 66–67), matched in the free-text metatype field, in several languages.
const DWARF = /dwarf|krasnolud|zwerg|nain|gnom|gnome|hanuman|koborokuru|menehune/i;
const TROLL = /troll|trol|cyclop|cyklop|fomori|giant|olbrzym|minotaur/i;

/** "troll", "dwarf" or null, from the actor's metatype. */
export function sizeClass(metatype) {
  const text = String(metatype ?? "");
  if (TROLL.test(text)) return "troll";
  if (DWARF.test(text)) return "dwarf";
  return null;
}

/**
 * Size markup (p. 246): trolls pay 10% more for everything, dwarfs for fitted gear (armor and clothing).
 * @returns {number} the markup factor, e.g. 0.1
 */
export function sizeMarkup(size, gearType) {
  if (size === "troll") return 0.1;
  if (size === "dwarf" && ["ARMOR", "ARMOR_ADDITION"].includes(gearType)) return 0.1;
  return 0;
}

/** Total cost of a purchase. */
export function purchaseTotal(price, quantity = 1, markup = 0) {
  return Math.round((Number(price) || 0) * Math.max(1, quantity) * (1 + markup));
}

/** Legality letter from an Availability string like "4(L)". */
export function legalityOf(availDef) {
  return String(availDef ?? "").match(/\(([LI])\)/)?.[1] ?? "";
}

function escape(text) {
  return foundry.utils.escapeHTML?.(String(text)) ?? Handlebars.escapeExpression(String(text));
}

/** Asks how to acquire the item; resolves to { action: "buy"|"free"|"remove", quantity, markup } or null. */
async function promptPurchase(item) {
  const actor = item.parent;
  const nuyen = Number(actor.system.nuyen) || 0;
  const price = Number(item.system.price) || 0;
  const countable = !!item.system.countable;
  const size = sizeClass(actor.system.metatype);
  const markup = sizeMarkup(size, item.system.type);
  const legality = legalityOf(item.system.availDef);
  const L = (key, data) => (data ? game.i18n.format(key, data) : game.i18n.localize(key));

  const warnings = [];
  if (legality === "L") warnings.push(L("SRE.Purchase.Licensed"));
  if (legality === "I") warnings.push(L("SRE.Purchase.Illegal"));
  const content = `
    <div class="sre-purchase">
      <p><strong>${escape(item.name)}</strong> — ${price.toLocaleString()}¥
        ${item.system.availDef ? `· ${L("SRE.Wizard.Avail")} ${escape(item.system.availDef)}` : ""}</p>
      ${warnings.map((w) => `<p class="sre-warn"><i class="fas fa-triangle-exclamation"></i> ${w}</p>`).join("")}
      ${countable ? `<div class="form-group"><label>${L("SRE.Purchase.Quantity")}</label>
        <input type="number" name="quantity" value="1" min="1" step="1"></div>` : ""}
      <div class="form-group"><label>${L("SRE.Purchase.Markup")}</label>
        <input type="checkbox" name="markup" ${markup ? "checked" : ""}></div>
      ${size ? `<p class="hint">${L(`SRE.Purchase.Size.${size}`)}</p>` : ""}
      <p>${L("SRE.Purchase.Balance", { nuyen: nuyen.toLocaleString() })}</p>
      <p class="hint">${L("SRE.Purchase.Hint")}</p>
    </div>`;

  const read = (button) => {
    const form = button.form;
    return {
      quantity: Math.max(1, Math.trunc(Number(form.elements.quantity?.value) || 1)),
      markup: form.elements.markup?.checked ? 0.1 : 0,
    };
  };
  return foundry.applications.api.DialogV2.wait({
    classes: ["sre-dialog"],
    window: { title: L("SRE.Purchase.Title", { name: actor.name }), icon: "fas fa-cart-shopping" },
    content,
    buttons: [
      { action: "buy", label: L("SRE.Purchase.Buy"), icon: "fas fa-cart-shopping", default: true,
        callback: (event, button) => ({ action: "buy", ...read(button) }) },
      { action: "free", label: L("SRE.Purchase.Free"), icon: "fas fa-gift",
        callback: (event, button) => ({ action: "free", ...read(button) }) },
      { action: "remove", label: L("SRE.Purchase.Remove"), icon: "fas fa-xmark",
        callback: () => ({ action: "remove" }) },
    ],
    rejectClose: false,
  });
}

/** Offers to buy an item that just landed on a player character. */
export async function offerPurchase(item) {
  const actor = item.parent;
  if (!(actor instanceof Actor) || actor.system?.nuyen === undefined) return;
  if (!(Number(item.system?.price) > 0) || !game.settings.get(MODULE_ID, "askPurchase")) return;

  const choice = await promptPurchase(item);
  if (!choice) return;
  if (choice.action === "remove") {
    await item.delete();
    return;
  }
  if (choice.quantity > 1) await item.update({ "system.count": (Number(item.system.count) || 1) * choice.quantity });
  if (choice.action === "free") return;

  const total = purchaseTotal(item.system.price, choice.quantity, choice.markup);
  const nuyen = Number(actor.system.nuyen) || 0;
  if (total > nuyen) {
    ui.notifications.warn(game.i18n.format("SRE.Purchase.NotEnough", { total: total.toLocaleString(), nuyen: nuyen.toLocaleString() }));
    // Leave the decision to the table: the item stays, nothing is paid.
    return;
  }
  await actor.update({ "system.nuyen": nuyen - total });
  await item.setFlag(MODULE_ID, "purchase", { price: total, quantity: choice.quantity, time: Date.now() });

  const quantity = choice.quantity > 1 ? ` ×${choice.quantity}` : "";
  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor }),
    whisper: ChatMessage.getWhisperRecipients("GM").map((u) => u.id).concat(game.user.id),
    content: game.i18n.format("SRE.Purchase.Chat", {
      actor: escape(actor.name), item: escape(item.name) + quantity, total: total.toLocaleString(),
      avail: escape(item.system.availDef || "—"), left: (nuyen - total).toLocaleString(),
    }),
  });
}
