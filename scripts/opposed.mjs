/**
 * Defense against non-combat spells and complex forms (system issues #4 and #5): the chat card of the
 * caster's roll gets a "Defend" button for the target. The defender rolls two attributes against the
 * caster's hits. Who wins a tie follows the errata setting: February 2020 errata (p. 105) gives ties to the
 * attacker, so the defender needs more hits; with that erratum off a tie goes to the defender.
 * - Complex forms: the system's own oppAttr1/oppAttr2 (a mental attribute and a Matrix attribute).
 * - Spells: chosen per spell on the Edge item sheet; Body + Willpower when the spell names none
 *   (Sixth World FAQ: the default resistance for spells without a stated test).
 */
import * as rolls from "./sheet/system-rolls.mjs";
import { errata } from "./errata.mjs";

const MODULE_ID = "shadowrun-edge";
const MATRIX = new Set(["a", "s", "d", "f", "devRating"]);
export const DEFAULT_SPELL_DEFENSE = ["bod", "wil"];
const L = (key, data) => (data ? game.i18n.format(key, data) : game.i18n.localize(key));

/** The two attributes defending against this item, or null when it is not opposed this way. */
export function defenseAttributes(item) {
  if (!item) return null;
  if (item.type === "complexform") {
    const pair = [item.system?.oppAttr1, item.system?.oppAttr2].filter(Boolean);
    return pair.length ? pair : null;
  }
  // Combat spells have their own defense in the system (direct/indirect).
  if (item.type === "spell" && item.system?.isOpposed && item.system?.category !== "combat") {
    const flag = item.flags?.[MODULE_ID]?.defense;
    const pair = [flag?.[0], flag?.[1]].filter(Boolean);
    return pair.length ? pair : DEFAULT_SPELL_DEFENSE;
  }
  return null;
}

/** Defender's pool: attributes from the actor, Matrix attributes from the persona in use. */
export function defensePool(actor, attrs) {
  const s = actor?.system ?? {};
  return attrs.reduce((sum, a) => sum + (Number(MATRIX.has(a) ? s.persona?.used?.[a] : s.attributes?.[a]?.pool) || 0), 0);
}

function attrLabel(a) {
  const key = CONFIG.SR6?.COMPLEX_FORMS?.attributes?.[a] ?? `attrib.${a}`;
  return L(key);
}

/** Hits the defender needs to resist: more than the caster's when ties go to the attacker. */
export function defenseThreshold(hits, tiesToAttacker) {
  return Math.max(1, (Number(hits) || 0) + (tiesToAttacker ? 1 : 0));
}

/** The character defending: the selected token, else the user's own character. */
function defender() {
  return canvas?.tokens?.controlled?.[0]?.actor ?? game.user.character ?? null;
}

Hooks.on("renderChatMessageHTML", (message, html) => {
  const roll = message.rolls?.[0];
  const itemId = roll?.options?.itemId;
  if (!itemId) return;
  const caster = ChatMessage.getSpeakerActor(message.speaker);
  const item = caster?.items.get(itemId);
  const attrs = defenseAttributes(item);
  if (!attrs) return;
  const root = html instanceof HTMLElement ? html : html?.[0];
  if (!root || root.querySelector(".sre-defend")) return;
  const hits = Number(roll.total) || 0;
  const names = attrs.map(attrLabel).join(" + ");
  const box = document.createElement("div");
  box.className = "sre-defend";
  const button = document.createElement("button");
  button.type = "button";
  button.innerHTML = `<i class="fas fa-shield-halved"></i> ${L("SRE.Defend.Button", { attrs: names })}`;
  const tiesToAttacker = errata("tiesToAttacker");
  button.dataset.tooltip = L(tiesToAttacker ? "SRE.Defend.HintAttacker" : "SRE.Defend.Hint", { hits });
  button.addEventListener("click", async () => {
    const actor = defender();
    if (!actor) return ui.notifications.warn(L("SRE.Defend.NoDefender"));
    const pool = defensePool(actor, attrs);
    const label = L("SRE.Defend.Label", { item: item.name, attrs: names, hits });
    return rolls.rollPool(actor, { pool, label, kind: "defense", threshold: defenseThreshold(hits, tiesToAttacker) });
  });
  box.append(button);
  (root.querySelector(".message-content") ?? root).append(box);
});
