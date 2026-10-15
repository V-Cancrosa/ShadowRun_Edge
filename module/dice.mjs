import { SRE } from "./config.mjs";

const { DialogV2 } = foundry.applications.api;
const { FormDataExtended } = foundry.applications.ux;

/**
 * Ask for a modifier and whether to push the limit with Edge, then roll a Shadowrun dice pool.
 * Hits are dice showing 5 or 6. A glitch is more than half the pool showing 1s, and a
 * critical glitch is a glitch with no hits. Pushing the limit spends 1 Edge point, adds the
 * actor's Edge rating to the pool and makes 6s explode.
 *
 * @param {object} options
 * @param {Actor} options.actor   The actor making the test.
 * @param {string} options.label  Name of the test, shown in the dialog and chat card.
 * @param {number} options.pool   Base dice pool before modifiers.
 * @param {string} [options.extra] Extra HTML appended to the chat card (e.g. weapon damage).
 */
export async function rollPool({ actor, label, pool, extra = "" }) {
  const system = actor.system;
  const wound = system.woundModifier ?? 0;
  const i18n = game.i18n;

  const content = `
    <p>${i18n.format("SRE.Roll.BasePool", { pool, wound })}</p>
    <div class="form-group">
      <label>${i18n.localize("SRE.Roll.Modifier")}</label>
      <input type="number" name="modifier" value="0" step="1" autofocus>
    </div>
    <div class="form-group">
      <label>${i18n.format("SRE.Roll.PushTheLimit", { edge: system.edge.value })}</label>
      <input type="checkbox" name="edge" ${system.edge.value > 0 ? "" : "disabled"}>
    </div>`;

  const options = await DialogV2.prompt({
    window: { title: label },
    content,
    ok: {
      label: i18n.localize("SRE.Roll.Roll"),
      callback: (event, button) => new FormDataExtended(button.form).object
    },
    rejectClose: false
  });
  if (!options) return null;

  const useEdge = !!options.edge && system.edge.value > 0;
  const dice = Math.max(0, pool + wound + (Number(options.modifier) || 0) + (useEdge ? system.attributes.edge : 0));
  if (dice === 0) {
    ui.notifications.warn("SRE.Roll.NoDice", { localize: true });
    return null;
  }

  const roll = await new Roll(`${dice}d6${useEdge ? "x6" : ""}cs>=${SRE.hitThreshold}`).evaluate();
  const results = roll.dice[0].results;
  const hits = roll.total;
  const ones = results.filter(r => r.result === 1).length;
  const glitch = ones > dice / 2;

  if (useEdge) await actor.update({ "system.edge.value": system.edge.value - 1 });

  let outcome = `<p class="sre-hits">${i18n.format("SRE.Roll.Hits", { hits })}</p>`;
  if (glitch) {
    const key = hits === 0 ? "SRE.Roll.CriticalGlitch" : "SRE.Roll.Glitch";
    outcome += `<p class="sre-glitch">${i18n.localize(key)}</p>`;
  }
  if (useEdge) outcome += `<p class="sre-edge">${i18n.localize("SRE.Roll.EdgeUsed")}</p>`;

  return roll.toMessage({
    speaker: ChatMessage.getSpeaker({ actor }),
    flavor: `<div class="shadowrun-edge sre-roll"><h3>${label}</h3>${outcome}${extra}</div>`
  });
}
