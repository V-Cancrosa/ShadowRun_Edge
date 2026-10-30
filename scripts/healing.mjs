/**
 * Healing dialog (core rulebook pp. 119–121): first aid, medkit, healing magic and natural recovery.
 * The test is rolled here (hits on 5–6) or its hits are typed in after a roll made with the system (e.g. a
 * Heal spell with Edge). The result goes to chat with an "Apply" button; the patient's owner or the GM applies it.
 * Each of first aid, medkit and magic works once per set of injuries; new damage starts a new set.
 */
import { METHODS, ONCE_PER_INJURIES, healingPool, healingResult, treatmentThreshold, isDead } from "./healing-rules.mjs";
import { errataFlags } from "./errata.mjs";
import * as ui2 from "./ui/edge-ui.mjs";
import { registerTask, runTest, hitsOf, patchTask } from "./linked-roll.mjs";

const MODULE_ID = "shadowrun-edge";
const SOCKET = `module.${MODULE_ID}`;
const L = (key, data) => (data ? game.i18n.format(key, data) : game.i18n.localize(key));
const esc = (s) => foundry.utils.escapeHTML(String(s ?? ""));

function damageOf(actor) {
  const s = actor.system;
  return { stun: Number(s.stun?.dmg) || 0, physical: Number(s.physical?.dmg) || 0, overflow: Number(s.overflow?.dmg) || 0 };
}

/** Characters the user may pick as healer: owned ones, the selected token first. */
function healers(target) {
  const list = game.actors.filter((a) => a.isOwner && ["Player", "NPC"].includes(a.type));
  const selected = canvas?.tokens?.controlled?.[0]?.actor;
  const order = [selected, game.user.character, target].filter(Boolean);
  return [...new Set([...order.filter((a) => a.isOwner), ...list])];
}

const split = (label) => {
  const m = String(label).match(/^(.*?)\s*\((.*)\)$/);
  return m ? [m[1], m[2]] : [label, ""];
};

export async function openHealing(target) {
  if (!target) return;
  if (isDead(target.system)) return ui.notifications.error(L("SRE.Heal.Dead", { name: target.name }));
  const used = target.getFlag(MODULE_ID, "healed") ?? {};
  const list = healers(target);
  const d = damageOf(target);
  const s = target.system;
  const essence = Number(s.essence ?? 6);
  const { threshold, autoHit } = treatmentThreshold(essence);
  const first = METHODS.find((m) => !used[m]) ?? METHODS[0];
  const methodTiles = METHODS.map((m) => {
    const [label, small] = split(L(`SRE.Heal.Method.${m}`));
    return { value: m, label, small: used[m] ? L("SRE.Heal.AlreadyUsed") : small, checked: m === first };
  });
  const monitors = [
    ui2.monitorRow("physical", L("SRE.Sheet.Monitor.physical"), Number(s.physical?.max) || 0, d.physical),
    ui2.monitorRow("stun", L("SRE.Sheet.Monitor.stun"), Number(s.stun?.max) || 0, d.stun),
    Number(s.overflow?.max) > 0 ? ui2.monitorRow("overflow", L("SRE.Sheet.Monitor.overflow"), Number(s.overflow.max), d.overflow) : "",
  ].join("");
  const treatment = "firstAid medkit magic";
  const content = `<div class="sre-ed">
    ${ui2.head({ kind: L("SRE.Heal.Kind"), name: target.name, sub: L("SRE.Heal.Sub", { essence: essence.toFixed(2), threshold }) })}
    <div class="sre-ed-body">
      ${ui2.tiles([
        { id: "pool", big: "–", label: L("SRE.Roll.Pool"), accent: true },
        { id: "threshold", big: threshold, label: L("SRE.Roll.Threshold"), calc: autoHit ? L("SRE.Heal.AutoHit") : `5 − ${essence.toFixed(1)}` },
      ])}
      ${ui2.panel(L("SRE.Heal.MethodLabel"), ui2.options("method", methodTiles), { hint: "s. 119–121" })}
      ${ui2.panel(L("SRE.Heal.Monitors"), `${monitors}${ui2.note("", "ok", { id: "forecast" })}${ui2.note("", "warn", { id: "used" })}`, { hint: L("SRE.Heal.ForecastHint") })}
      ${ui2.panel(L("SRE.Heal.Options"), ui2.rows([
        ui2.row(L("SRE.Heal.Healer"), `<select name="healer">${list.map((a) => `<option value="${a.id}">${esc(a.name)}</option>`).join("")}</select>`, { attrs: ` data-for="${treatment}"` }),
        ui2.chips([
          ui2.chip("kit", L("SRE.Heal.KitShort"), { checked: true, attrs: ' data-for="firstAid"' }),
          ui2.chip("useMedkitRating", L("SRE.Heal.UseMedkitRatingShort"), { attrs: ' data-for="medkit"' }),
          ui2.chip("assistance", L("SRE.Heal.AssistanceShort"), { value: "+2", attrs: ' data-for="restStun restPhysical"' }),
        ]),
        ui2.row(L("SRE.Heal.MedkitRating"), ui2.stepper("medkitRating", 3, { min: 1, max: 6 }), { attrs: ' data-for="medkit"' }),
        ui2.row(L("SRE.Heal.DrainBoxes"), ui2.stepper("drainBoxes", 0, { min: 0, max: d.stun }), { attrs: ` data-for="${treatment}"` }),
        ui2.row(L("SRE.Heal.Prefer"), `<select name="prefer"><option value="physical">${L("SRE.Heal.PreferPhysical")}</option><option value="stun">${L("SRE.Heal.PreferStun")}</option></select>`, { attrs: ` data-for="${treatment}"` }),
        ui2.row(L("SRE.Heal.ManualHits"), `<input type="number" name="manualHits" min="0" placeholder="—">`),
      ]))}
      ${ui2.note(L("SRE.Heal.HintShort"), "info")}
    </div>
  </div>`;
  const read = (f) => ({
    method: f.method.value, healer: f.healer?.value, kit: f.kit?.checked, useMedkitRating: f.useMedkitRating?.checked,
    medkitRating: Number(f.medkitRating?.value) || 0, assistance: f.assistance?.checked, drainBoxes: Number(f.drainBoxes?.value) || 0,
    prefer: f.prefer?.value ?? "physical", manualHits: f.manualHits.value === "" ? null : Number(f.manualHits.value),
  });
  const result = ui2.okOnly(await foundry.applications.api.DialogV2.wait({
    classes: ["sre-dialog"],
    window: { title: L("SRE.Heal.Title", { name: target.name }) },
    position: { width: 500 },
    content,
    render: (event, dialog) => {
      ui2.wire(dialog, (form) => {
        const o = read(form.elements);
        ui2.showFor(form, o.method);
        const isTreatment = ONCE_PER_INJURIES.includes(o.method);
        const healer = isTreatment ? game.actors.get(o.healer) ?? target : target;
        const pool = healingPool(o.method, healer.system, target.system, { ...o, woundModifier: 0, errata: errataFlags() });
        const thr = isTreatment ? threshold : 0;
        ui2.setTile(form, "pool", { big: pool, calc: split(L(`SRE.Heal.Method.${o.method}`))[1] });
        ui2.setTile(form, "threshold", { big: isTreatment ? thr : "—", calc: isTreatment ? (autoHit ? L("SRE.Heal.AutoHit") : `5 − ${essence.toFixed(1)}`) : "" });
        const hits = o.manualHits ?? Math.round(pool / 3);
        const res = healingResult({ method: o.method, hits, threshold: thr, autoHit: isTreatment ? autoHit : 0, damage: d, drainBoxes: o.drainBoxes, prefer: o.prefer });
        ui2.setMonitorForecast(form, res.heal);
        const parts = ["overflow", "physical", "stun"].filter((k) => res.heal[k]).map((k) => L(`SRE.Heal.Box.${k}`, { n: res.heal[k] }));
        ui2.setNote(form, "forecast", L(o.manualHits === null ? "SRE.Heal.Forecast" : "SRE.Heal.ForecastManual", { hits, text: parts.length ? parts.join(", ") : L("SRE.Heal.Nothing") }));
        ui2.setNote(form, "used", isTreatment && used[o.method] ? L("SRE.Heal.UsedWarning") : "");
        ui2.setMainLabel(dialog, o.manualHits === null ? L("SRE.Heal.RollButton", { n: pool }) : L("SRE.Heal.ApplyButton"));
      });
    },
    buttons: ui2.buttons(L("SRE.Heal.Roll"), (event, button) => read(button.form.elements), { icon: "fas fa-kit-medical" }),
    rejectClose: false,
  }));
  if (!result) return;
  return healingTest(target, result);
}

async function healingTest(target, o) {
  const errata = errataFlags();
  const treatment = ONCE_PER_INJURIES.includes(o.method);
  const healer = treatment ? game.actors.get(o.healer) ?? target : target;
  // Wound modifiers come from the system dialog's box: the healer's for treatment, the patient's for rest
  // (not at all for natural recovery with the August 2019 errata, except with Overflow damage).
  const pool = healingPool(o.method, healer.system, target.system, { ...o, woundModifier: 0, errata });
  const restWounds = (o.method === "restPhysical" && Number(target.system.overflow?.dmg) > 0) || errata.noWoundsOnRecovery === false;
  const { threshold, autoHit } = treatment ? treatmentThreshold(target.system.essence) : { threshold: 0, autoHit: 0 };
  const task = {
    kind: "heal", target: target.uuid, targetName: target.name, healer: healer.name, method: o.method, pool, threshold, autoHit,
    damage: damageOf(target), drainBoxes: o.drainBoxes, prefer: o.prefer,
    used: !!(treatment && target.getFlag(MODULE_ID, "healed")?.[o.method]), applied: false,
  };
  const label = `${split(L(`SRE.Heal.Method.${o.method}`))[0]}: ${target.name}`;
  return runTest(healer, { pool, label, threshold, useWoundModifier: treatment || restWounds, manualHits: o.manualHits, task });
}

function healOf(task, hits) {
  return healingResult({ method: task.method, hits, threshold: task.threshold, autoHit: task.autoHit, damage: task.damage, drainBoxes: task.drainBoxes, prefer: task.prefer });
}

registerTask("heal", {
  render(task, hits) {
    const res = healOf(task, hits);
    const treatment = ONCE_PER_INJURIES.includes(task.method);
    const parts = ["overflow", "physical", "stun"].filter((k) => res.heal[k]).map((k) => L(`SRE.Heal.Box.${k}`, { n: res.heal[k] }));
    const button = parts.length
      ? `<button type="button" class="sre-heal-apply"${task.applied ? " disabled" : ""}>${L(task.applied ? "SRE.Heal.Applied" : "SRE.Heal.Apply")}</button>`
      : "";
    return `<div class="sre-heal-card">
      <h3>${esc(split(L(`SRE.Heal.Method.${task.method}`))[0])}: ${esc(task.targetName)}</h3>
      <p>${treatment
        ? L("SRE.Heal.CardTreatment", { healer: esc(task.healer), pool: task.pool, hits: res.hits, threshold: task.threshold, auto: task.autoHit ? L("SRE.Heal.AutoHit") : "" })
        : L("SRE.Heal.CardRest", { pool: task.pool, hits: res.hits })}</p>
      <p class="sre-heal-result"><strong>${parts.length ? parts.join(", ") : L("SRE.Heal.Nothing")}</strong></p>
      ${task.used ? `<p class="sre-heal-warn">${L("SRE.Heal.UsedWarning")}</p>` : ""}
      ${button}
    </div>`;
  },
  bind(root, message, task) {
    root.querySelector(".sre-heal-apply")?.addEventListener("click", async (event) => {
      event.currentTarget.disabled = true;
      const target = await fromUuid(task.target);
      if (!target) return;
      // The hits at this moment: Edge spent after the roll counts.
      const { heal } = healOf(task, hitsOf(message));
      if (target.isOwner) {
        await applyHealing(task.target, task.method, heal);
        await patchTask(message, { applied: true });
      } else if (game.users.activeGM) game.socket.emit(SOCKET, { type: "applyHealing", messageId: message.id });
      else ui.notifications.warn(L("SRE.Give.NoGM"));
    });
  },
});

/** Applies the healing on the patient (by its owner, or by the GM when asked through the socket). */
async function applyHealing(targetUuid, method, heal) {
  const target = await fromUuid(targetUuid);
  if (!target) return false;
  const d = damageOf(target);
  const update = {
    "system.stun.dmg": Math.max(0, d.stun - (heal.stun || 0)),
    "system.physical.dmg": Math.max(0, d.physical - (heal.physical || 0)),
    "system.overflow.dmg": Math.max(0, d.overflow - (heal.overflow || 0)),
  };
  if (ONCE_PER_INJURIES.includes(method)) update[`flags.${MODULE_ID}.healed.${method}`] = true;
  await target.update(update, { sreHealing: true });
  return true;
}

/** New damage starts a new set of injuries: first aid, medkit and magic can be used again. */
Hooks.on("preUpdateActor", (actor, changes, options) => {
  if (options.sreHealing) return;
  const grew = ["stun", "physical", "overflow"].some((k) => {
    const v = foundry.utils.getProperty(changes, `system.${k}.dmg`);
    return v !== undefined && Number(v) > (Number(actor.system[k]?.dmg) || 0);
  });
  if (grew && actor.getFlag(MODULE_ID, "healed")) foundry.utils.setProperty(changes, `flags.${MODULE_ID}.-=healed`, null);
});

Hooks.once("ready", () => {
  game.socket.on(SOCKET, async (data) => {
    if (data?.type !== "applyHealing" || !game.users.activeGM?.isSelf) return;
    const message = game.messages.get(data.messageId);
    const task = message?.getFlag(MODULE_ID, "task");
    // Only heal what the chat card says (from its current hits), once.
    if (task?.kind !== "heal" || task.applied) return;
    await applyHealing(task.target, task.method, healOf(task, hitsOf(message)).heal);
    await message.setFlag(MODULE_ID, "task", { ...task, applied: true });
  });
});

/** "Healing" button in the header of the system's character and NPC sheets. */
Hooks.on("getActorSheetHeaderButtons", (sheet, buttons) => {
  if (game.system.id !== "shadowrun6-eden" || !["Player", "NPC"].includes(sheet.actor?.type)) return;
  buttons.unshift({ label: L("SRE.Heal.Button"), class: "sre-heal-button", icon: "fas fa-kit-medical", onclick: () => openHealing(sheet.actor) });
});
