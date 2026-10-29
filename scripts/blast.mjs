/**
 * Thrown grenades and launched explosives (core rulebook pp. 114–117): the attack lands at a chosen point,
 * scatters (2D6 and the Scatter at Range table, direction from the diagram), and everyone in the blast radius
 * resists the Damage Value of their zone (Ground Zero / Close / Near) with Body (vehicles Body × 2).
 */
import { RANGES, rangeCategory, scatterMeters, scatterAngle, scatterPoint, blastZone, parseBlast, thrownAttackRating, blastDamage } from "./blast-rules.mjs";
import { errata } from "./errata.mjs";
import { applyDamage } from "./sheet/system-rolls.mjs";

const MODULE_ID = "shadowrun-edge";
const L = (key, data) => (data ? game.i18n.format(key, data) : game.i18n.localize(key));
const esc = (s) => foundry.utils.escapeHTML(String(s ?? ""));

/** Blast data of an item: set on the Edge item sheet, else read from its notes / description (catalog grenades). */
export function itemBlast(item) {
  const flag = item?.flags?.[MODULE_ID]?.blast;
  if (flag?.gz) return flag;
  return parseBlast(`${item?.system?.notes ?? ""} ${item?.system?.description ?? ""}`);
}

export function isExplosive(item) {
  return item?.type === "gear" && !!itemBlast(item);
}

const metersPerPixel = () => canvas.dimensions.distance / canvas.dimensions.size;

/** Waits for one click on the canvas and returns the point (or null on Escape / right click). */
function pickPoint() {
  ui.notifications.info(L("SRE.Blast.PickPoint"));
  return new Promise((resolve) => {
    const done = (value) => {
      canvas.stage.off("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
      resolve(value);
    };
    const onDown = (event) => {
      if (event.button === 2) return done(null);
      const p = event.getLocalPosition(canvas.stage);
      done({ x: p.x, y: p.y });
    };
    const onKey = (event) => event.key === "Escape" && done(null);
    canvas.stage.on("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
  });
}

async function roll2d6() {
  return (await new Roll("2d6").evaluate()).total;
}

/**
 * @param {Actor} actor  the attacker
 * @param {Item} item    the explosive (grenade from the inventory)
 */
export async function throwExplosive(actor, item) {
  const blast = itemBlast(item);
  if (!blast) return ui.notifications.warn(L("SRE.Blast.NoBlastData", { name: item.name }));
  if (!canvas?.ready) return ui.notifications.warn(L("SRE.Blast.NoScene"));
  const s = actor.system;
  const launchers = actor.items.filter((i) => i.type === "gear" && /launcher|granatnik/i.test(`${i.name} ${i.system.subtype ?? ""}`));
  const agiOrLog = errata("launcherAgility") ? "agi" : "log";
  const launchPool = (Number(s.skills?.exotic_weapons?.points) || 0) + (Number(s.skills?.exotic_weapons?.modifier) || 0) + (Number(s.attributes?.[agiOrLog]?.pool) || 0);
  const content = `<div class="sre-heal">
    <p class="sre-heal-state">${L("SRE.Blast.Info", { name: esc(item.name), gz: blast.gz, close: blast.close, near: blast.near, type: blast.stun ? "S" : "P", radius: blast.radius })}</p>
    <label>${L("SRE.Blast.Mode")} <select name="mode">
      <option value="thrown">${L("SRE.Blast.Thrown", { pool: Number(s.skills?.athletics?.pool) || 0 })}</option>
      ${launchers.map((l) => `<option value="${l.id}">${L("SRE.Blast.Launched", { name: esc(l.name), pool: launchPool })}</option>`).join("")}
    </select></label>
    <label class="checkbox"><input type="checkbox" name="airburst"> ${L("SRE.Blast.Airburst")}</label>
    <label>${L("SRE.Heal.ManualHits")} <input type="number" name="manualHits" min="0" placeholder="${L("SRE.Heal.ManualHitsPlaceholder")}"></label>
    <p class="hint">${L("SRE.Blast.Hint")}</p>
  </div>`;
  const choice = await foundry.applications.api.DialogV2.prompt({
    window: { title: L("SRE.Blast.Title", { name: item.name }) },
    content,
    ok: { label: L("SRE.Blast.PickButton"), callback: (e, b) => ({ mode: b.form.elements.mode.value, airburst: b.form.elements.airburst.checked, manualHits: b.form.elements.manualHits.value === "" ? null : Number(b.form.elements.manualHits.value) }) },
    rejectClose: false,
  });
  if (!choice) return;
  const aimed = await pickPoint();
  if (!aimed) return;

  const launched = choice.mode !== "thrown";
  const from = actor.getActiveTokens()[0]?.center ?? aimed;
  const mpp = metersPerPixel();
  const range = rangeCategory(Math.hypot(aimed.x - from.x, aimed.y - from.y) * mpp);
  const pool = launched ? launchPool : Number(s.skills?.athletics?.pool) || 0;
  let attackRoll = null;
  let hits = choice.manualHits;
  if (hits === null) {
    attackRoll = await new Roll(`${pool}d6cs>=5`).evaluate();
    hits = attackRoll.total;
  }
  const distanceRoll = await roll2d6();
  const meters = scatterMeters({ roll: distanceRoll, hits, range, launched, airburst: choice.airburst, eachHit: errata("scatterEachHit") });
  const directionRoll = await roll2d6();
  const point = scatterPoint(from, aimed, meters, scatterAngle(directionRoll), 1 / mpp);

  // Template for everyone to see, then who is in which zone.
  try {
    await canvas.scene.createEmbeddedDocuments("MeasuredTemplate", [{ t: "circle", x: point.x, y: point.y, distance: blast.radius, fillColor: "#e0409a", flags: { [MODULE_ID]: { blast: true } } }]);
  } catch (err) {
    console.warn(`${MODULE_ID} | blast template`, err);
  }
  const victims = canvas.tokens.placeables
    .map((t) => ({ t, m: Math.hypot(t.center.x - point.x, t.center.y - point.y) * mpp }))
    .map(({ t, m }) => ({ t, m, zone: blastZone(m, blast.radius) }))
    .filter((v) => v.zone && v.t.actor)
    .map((v) => ({ token: v.t.document.uuid, name: v.t.name, zone: v.zone, meters: Math.round(v.m), dv: blast[v.zone] }));

  const ar = launched || !errata("thrownGrenadeAR") ? null : thrownAttackRating(s.attackrating?.physical?.pool, range);
  const rows = victims.map((v, i) => `<li data-index="${i}"><b>${esc(v.name)}</b> — ${L(`SRE.Blast.Zone.${v.zone}`)} (${v.meters} m): <b>${v.dv}${blast.stun ? "S" : "P"}</b>
    <span class="sre-blast-buttons"><button type="button" data-soak="${i}">${L("SRE.Blast.Soak")}</button><button type="button" data-soak="${i}" data-dirt="1">${L("SRE.Blast.SoakDirt")}</button></span></li>`).join("");
  return ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor }),
    rolls: attackRoll ? [attackRoll] : [],
    content: `<div class="sre-blast-card">
      <h3>${esc(item.name)}</h3>
      <p>${L(launched ? "SRE.Blast.CardLaunched" : "SRE.Blast.CardThrown", { pool, hits, range: L(`SRE.Blast.Range.${range}`), ar: ar ?? "—" })}</p>
      <p>${L("SRE.Blast.CardScatter", { roll: distanceRoll, meters, dir: directionRoll })}</p>
      ${victims.length ? `<ul class="sre-blast-list">${rows}</ul>` : `<p>${L("SRE.Blast.NoOne")}</p>`}
      <p class="hint">${L("SRE.Blast.CardHint")}</p>
    </div>`,
    flags: { [MODULE_ID]: { blast: { victims, stun: !!blast.stun, item: item.name } } },
  });
}

/** Damage Resistance from the chat card: the victim's owner or the GM rolls Body (vehicles Body × 2) and applies. */
Hooks.on("renderChatMessageHTML", (message, html) => {
  const data = message.getFlag(MODULE_ID, "blast");
  if (!data) return;
  const root = html instanceof HTMLElement ? html : html?.[0];
  for (const button of root?.querySelectorAll("[data-soak]") ?? []) {
    button.addEventListener("click", async () => {
      const v = data.victims[Number(button.dataset.soak)];
      const token = v && (await fromUuid(v.token));
      const actor = token?.actor;
      if (!actor?.isOwner) return ui.notifications.warn(L("SRE.Blast.NotOwner"));
      const body = Number(actor.system.attributes?.bod?.pool ?? actor.system.bod ?? actor.system.vehicle?.bod) || 0;
      const pool = actor.type === "Vehicle" ? body * 2 : body;
      const roll = await new Roll(`${pool}d6cs>=5`).evaluate();
      const dirt = !!button.dataset.dirt;
      const damage = blastDamage(v.dv, roll.total, { hitTheDirt: dirt });
      const monitor = data.stun ? "stun" : "physical";
      if (damage > 0) await applyDamage(actor, monitor, damage);
      await ChatMessage.create({
        speaker: ChatMessage.getSpeaker({ actor }),
        rolls: [roll],
        content: `<p class="sre-blast-result">${L("SRE.Blast.Result", { name: esc(actor.name), item: esc(data.item), pool, hits: roll.total, dv: v.dv - (dirt ? 2 : 0), damage, type: L(`SRE.Heal.Box.${monitor}`, { n: damage }) })}</p>`,
      });
    });
  }
});
