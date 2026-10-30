/**
 * Thrown grenades and launched explosives (core rulebook pp. 114–117): the attack lands at a chosen point,
 * scatters (2D6 and the Scatter at Range table, direction from the diagram), and everyone in the blast radius
 * resists the Damage Value of their zone (Ground Zero / Close / Near) with Body (vehicles Body × 2).
 */
import { RANGES, rangeCategory, scatterMeters, scatterAngle, scatterPoint, blastZone, parseBlast, thrownAttackRating, areaEdge, avoidMove } from "./blast-rules.mjs";
import { spendAction, usedThisRound } from "./actions.mjs";
import { errata } from "./errata.mjs";
import * as rolls from "./sheet/system-rolls.mjs";
import { registerTask, runTest, hitsOf, patchTask } from "./linked-roll.mjs";
import * as ui2 from "./ui/edge-ui.mjs";

const MODULE_ID = "shadowrun-edge";
const SOCKET = `module.${MODULE_ID}`;
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
  const athletics = Number(s.skills?.athletics?.pool) || 0;
  const content = `<div class="sre-ed">
    ${ui2.head({ kind: L("SRE.Blast.Kind"), name: item.name, sub: L("SRE.Blast.Sub", { gz: blast.gz, close: blast.close, near: blast.near, type: blast.stun ? "S" : "P", radius: blast.radius }) })}
    <div class="sre-ed-body">
      ${ui2.panel(L("SRE.Blast.Zones"), `<div class="sre-ed-zones">
        <div class="sre-ed-zone"><i>${L("SRE.Blast.Zone.gz")}</i><b>${blast.gz}${blast.stun ? "S" : "P"}</b></div>
        <div class="sre-ed-zone"><i>${L("SRE.Blast.Zone.close")} ≤3 m</i><b>${blast.close}${blast.stun ? "S" : "P"}</b></div>
        <div class="sre-ed-zone"><i>${L("SRE.Blast.Zone.near")} ≤${blast.radius} m</i><b>${blast.near}${blast.stun ? "S" : "P"}</b></div></div>`)}
      ${ui2.panel(L("SRE.Blast.Mode"), `${ui2.options("mode", [
        { value: "thrown", label: L("SRE.Blast.ThrownShort"), small: L("SRE.Blast.Dice", { skill: L("SRE.Blast.Athletics"), n: athletics }), checked: true },
        ...launchers.map((l) => ({ value: l.id, label: l.name, small: L("SRE.Blast.Dice", { skill: L("SRE.Blast.Launcher"), n: launchPool }) })),
      ])}${ui2.rows([
        ui2.chips([ui2.chip("airburst", L("SRE.Blast.AirburstShort"))]),
        ui2.row(L("SRE.Heal.ManualHits"), `<input type="number" name="manualHits" min="0" placeholder="—">`),
      ])}`)}
      ${ui2.note(L("SRE.Blast.HintShort"), "info")}
    </div>
  </div>`;
  const choice = ui2.okOnly(await foundry.applications.api.DialogV2.wait({
    classes: ["sre-dialog"],
    window: { title: L("SRE.Blast.Title", { name: item.name }) },
    position: { width: 480 },
    content,
    render: (event, dialog) => ui2.wire(dialog),
    buttons: ui2.buttons(L("SRE.Blast.PickButton"), (e, b) => ({ mode: b.form.elements.mode.value, airburst: b.form.elements.airburst.checked, manualHits: b.form.elements.manualHits.value === "" ? null : Number(b.form.elements.manualHits.value) }), { icon: "fas fa-crosshairs" }),
    rejectClose: false,
  }));
  if (!choice) return;
  const aimed = await pickPoint();
  if (!aimed) return;

  const launched = choice.mode !== "thrown";
  const from = actor.getActiveTokens()[0]?.center ?? aimed;
  const mpp = metersPerPixel();
  const range = rangeCategory(Math.hypot(aimed.x - from.x, aimed.y - from.y) * mpp);
  const pool = launched ? launchPool : Number(s.skills?.athletics?.pool) || 0;
  const ownAR = Number(item.system?.attackRating?.[RANGES.indexOf(range)]) || 0;
  const ar = !launched && errata("thrownGrenadeAR") ? thrownAttackRating(s.attackrating?.physical?.pool, range) : ownAR > 0 ? ownAR : null;
  const edge = await grantAreaEdge(actor, ar, aimed, blast.radius);
  const task = {
    kind: "blast", item: item.name, blast, from, aimed, range, launched, airburst: choice.airburst, eachHit: errata("scatterEachHit"),
    pool, ar, edge, scene: canvas.scene.id, exploded: false, avoiders: [],
  };
  return runTest(actor, { pool, label: L("SRE.Blast.TestLabel", { name: item.name }), manualHits: choice.manualHits, task });
}

/** Defense Rating of a token's actor: the system's value, or Body + Armor for vehicles. */
function defenseRating(actor) {
  const s = actor?.system ?? {};
  const dr = Number(s.defenserating?.physical?.pool);
  if (Number.isFinite(dr) && dr > 0) return dr;
  return (Number(s.vehicle?.bod ?? s.bod) || 0) + (Number(s.vehicle?.arm ?? s.arm) || 0);
}

/** Tokens in the blast radius around a point, with their distance in meters. */
function tokensInBlast(point, radius) {
  const mpp = metersPerPixel();
  return canvas.tokens.placeables
    .filter((t) => t.actor)
    .map((t) => ({ t, m: Math.hypot(t.center.x - point.x, t.center.y - point.y) * mpp }))
    .filter(({ m }) => blastZone(m, radius));
}

/** +1 Edge for the attacker when the AR beats the highest DR in the (aimed) blast by 4 or more, before the roll. */
async function grantAreaEdge(actor, ar, point, radius) {
  const result = areaEdge(ar, tokensInBlast(point, radius).map(({ t }) => defenseRating(t.actor)));
  if (!result.gain) return result;
  const now = Number(actor.system.edge?.value) || 0;
  const max = Math.min(7, Number(actor.system.edge?.max) || 7);
  if (now >= max) return { ...result, gain: 0, capped: true };
  await actor.update({ "system.edge.value": now + 1 });
  await ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor }), content: `<p class="sre-blast-result">${L("SRE.Blast.EdgeGain", { name: esc(actor.name), ar, dr: result.highest })}</p>` });
  return result;
}

/** Avoid Incoming for the user's selected token: a Minor Action (with the action tracker), position noted. */
async function avoidIncoming(message, task) {
  const token = canvas.tokens.controlled.find((t) => t.actor?.isOwner);
  if (!token) return ui.notifications.warn(L("SRE.Blast.AvoidSelect"));
  if ((task.avoiders ?? []).some((a) => a.token === token.document.uuid)) return;
  const combatant = game.combat?.started ? game.combat.combatants.find((c) => c.tokenId === token.id) : null;
  if (combatant && game.settings.get(MODULE_ID, "trackActions")) {
    if (usedThisRound(combatant, "avoid")) return ui.notifications.warn(L("SRE.Blast.AvoidUsed", { name: token.name }));
    if (!(await spendAction(combatant, "minor", { mark: "avoid" }))) return ui.notifications.warn(L("SRE.Blast.AvoidNoMinor", { name: token.name }));
  }
  const entry = { token: token.document.uuid, name: token.name, x: token.center.x, y: token.center.y };
  if (message.isOwner) await message.setFlag(MODULE_ID, "task", { ...task, avoiders: [...(task.avoiders ?? []), entry] });
  else if (game.users.activeGM) game.socket.emit(SOCKET, { type: "blastAvoid", messageId: message.id, entry });
  else return ui.notifications.warn(L("SRE.Give.NoGM"));
  ui.notifications.info(L("SRE.Blast.AvoidNow", { name: token.name }));
}

/** Scatter, template and the victims card, from the attack's hits at the moment of the explosion. */
async function explode(message, task) {
  if (canvas.scene?.id !== task.scene) return ui.notifications.warn(L("SRE.Blast.OtherScene"));
  const hits = hitsOf(message);
  const { blast } = task;
  const mpp = metersPerPixel();
  const distanceRoll = await roll2d6();
  const meters = scatterMeters({ roll: distanceRoll, hits, range: task.range, launched: task.launched, airburst: task.airburst, eachHit: task.eachHit });
  const directionRoll = await roll2d6();
  const point = scatterPoint(task.from, task.aimed, meters, scatterAngle(directionRoll), 1 / mpp);

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
    .map((v) => {
      const avoided = (task.avoiders ?? []).find((a) => a.token === v.t.document.uuid);
      const moved = avoided ? avoidMove(avoided, v.t.center, mpp) : null;
      return { token: v.t.document.uuid, name: v.t.name, zone: v.zone, meters: Math.round(v.m), dv: blast[v.zone], prone: !!moved?.prone, moved: moved?.meters ?? null };
    });

  const rows = victims.map((v, i) => `<li data-index="${i}"><b>${esc(v.name)}</b> — ${L(`SRE.Blast.Zone.${v.zone}`)} (${v.meters} m): <b>${v.dv}${blast.stun ? "S" : "P"}</b>${v.prone ? ` <i>${L("SRE.Blast.ProneNote", { m: v.moved })}</i>` : ""}
    <span class="sre-blast-buttons"><button type="button" data-soak="${i}">${L("SRE.Blast.Soak")}</button><button type="button" data-soak="${i}" data-dirt="1">${L("SRE.Blast.SoakDirt")}</button></span></li>`).join("");
  await patchTask(message, { exploded: true });
  return ChatMessage.create({
    speaker: message.speaker,
    content: `<div class="sre-blast-card">
      <h3>${esc(task.item)}</h3>
      <p>${L("SRE.Blast.CardScatter", { roll: distanceRoll, meters, dir: directionRoll })}</p>
      ${victims.length ? `<ul class="sre-blast-list">${rows}</ul>` : `<p>${L("SRE.Blast.NoOne")}</p>`}
      <p class="hint">${L("SRE.Blast.CardHint")}</p>
    </div>`,
    flags: { [MODULE_ID]: { blast: { victims, stun: !!blast.stun, item: task.item } } },
  });
}

registerTask("blast", {
  render(task, hits) {
    return `<div class="sre-blast-card">
      <h3>${esc(task.item)}</h3>
      <p>${L(task.launched ? "SRE.Blast.CardLaunched" : "SRE.Blast.CardThrown", { pool: task.pool, hits, range: L(`SRE.Blast.Range.${task.range}`), ar: task.ar ?? "—" })}</p>
      ${task.edge?.highest !== null && task.edge?.highest !== undefined ? `<p>${L(task.edge.gain ? "SRE.Blast.EdgeYes" : "SRE.Blast.EdgeNo", { ar: task.ar, dr: task.edge.highest })}</p>` : ""}
      ${task.avoiders?.length ? `<p>${L("SRE.Blast.Avoiders", { names: task.avoiders.map((a) => esc(a.name)).join(", ") })}</p>` : ""}
      ${task.exploded ? "" : `<button type="button" class="sre-blast-avoid">${L("SRE.Blast.Avoid")}</button>`}
      <button type="button" class="sre-task-apply"${task.exploded ? " disabled" : ""}>${L(task.exploded ? "SRE.Blast.Exploded" : "SRE.Blast.Explode")}</button>
      <p class="hint">${L("SRE.Blast.ExplodeHint")}</p>
    </div>`;
  },
  bind(root, message, task) {
    root.querySelector(".sre-blast-avoid")?.addEventListener("click", () => avoidIncoming(message, task));
    root.querySelector(".sre-task-apply")?.addEventListener("click", (event) => {
      if (!message.isOwner && !game.user.isGM) return ui.notifications.warn(L("SRE.Blast.NotOwner"));
      event.currentTarget.disabled = true;
      return explode(message, task);
    });
  },
});

/** Damage Resistance from the chat card: the victim's owner (or the GM) rolls through the system's soak card. */
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
      const vehicle = actor.type === "Vehicle";
      // Lifeforms: the system's damage resistance pool (Body and its modifiers); vehicles: Body × 2 (p. 114).
      const pool = vehicle ? body * 2 : Number(actor.system.defensepool?.damage_physical?.pool) || body;
      const dirt = !!button.dataset.dirt;
      // Drop Prone and Prone from Avoid Incoming both lower the DV by 2; they don't stack.
      const dv = Math.max(0, v.dv - (dirt || v.prone ? 2 : 0));
      const stun = data.stun && !vehicle;
      return rolls.rollSoakTest(actor, {
        soakType: stun ? "damage_stun" : "damage_phys", damage: dv, monitor: stun ? "stun" : "physical", pool,
        label: L("SRE.Blast.SoakLabel", { item: data.item, dv, type: stun ? "S" : "P" }),
      });
    });
  }
});

/** GM side of Avoid Incoming for players who don't own the attack's message: only their own token, once. */
Hooks.once("ready", () => {
  game.socket.on(SOCKET, async (data, senderId) => {
    if (data?.type !== "blastAvoid" || !game.users.activeGM?.isSelf) return;
    const message = game.messages.get(data.messageId);
    const task = message?.getFlag(MODULE_ID, "task");
    const user = game.users.get(senderId);
    if (task?.kind !== "blast" || task.exploded || !user || !data.entry?.token) return;
    const token = await fromUuid(data.entry.token);
    if (!token?.actor?.testUserPermission(user, "OWNER")) return;
    if ((task.avoiders ?? []).some((a) => a.token === data.entry.token)) return;
    const entry = { token: data.entry.token, name: token.name, x: Number(data.entry.x) || 0, y: Number(data.entry.y) || 0 };
    await message.setFlag(MODULE_ID, "task", { ...task, avoiders: [...(task.avoiders ?? []), entry] });
  });
});
