/**
 * What happens when an item lands on a character (dragged from the catalog, the Items directory or another actor):
 * first the implant grade (it changes the price), then the purchase.
 */
import { chooseAndApply, isAugmentation } from "./grades.mjs";
import { offerPurchase } from "./purchase.mjs";

const MODULE_ID = "shadowrun-edge";

async function acquire(item) {
  if (isAugmentation(item) && !item.getFlag(MODULE_ID, "grade") && game.settings.get(MODULE_ID, "askImplantGrade")) {
    await chooseAndApply(item);
  }
  if (item.parent?.items.has(item.id)) await offerPurchase(item);
}

// Only for a single item: several items created together (importing a character, dropping a folder, the module
// installing built-in mods) are left alone instead of opening a dialog for each one.
let pending = [];
Hooks.on("createItem", (item, options, userId) => {
  if (userId !== game.user.id || !(item.parent instanceof Actor) || options.sreSkipAcquire) return;
  pending.push(item);
  if (pending.length > 1) return;
  setTimeout(() => {
    const batch = pending;
    pending = [];
    if (batch.length === 1) acquire(batch[0]);
  }, 0);
});
