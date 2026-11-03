/**
 * Vehicles and drones (pp. 197–202): speed and distance, Handling tests with the crash test and crash damage,
 * drivers' opposed tests, ramming, drones' autosoft tests and RCC group commands. Values from the system's vehicle
 * data (handling, speed, opMode, the driver in system.vehicle.belongs); rules in vehicle-rules.mjs.
 */
import * as V from "./vehicle-rules.mjs";
import { systemTest, registerTask, patchTask } from "./linked-roll.mjs";
import * as rolls from "./sheet/system-rolls.mjs";
import { resolveConflict } from "./ui/conflict.mjs";
import * as ui2 from "./ui/edge-ui.mjs";

const MODULE_ID = "shadowrun-edge";
const L = (key, data) => (data ? game.i18n.format(key, data) : game.i18n.localize(key));
const esc = (s) => foundry.utils.escapeHTML(String(s ?? ""));
const num = (v, d = 0) => (Number.isFinite(Number(v)) ? Number(v) : d);

export const driverOf = (vehicle) => game.actors?.get(vehicle.system?.vehicle?.belongs) ?? null;

/** Autosoft ratings by type (system "software" items, or gear with an AUTOSOFT type), highest of each. */
export function autosoftRatings(vehicle) {
  const out = {};
  for (const i of vehicle.items ?? []) {
    const isSoft = (i.type === "software" && i.system?.type === "AUTOSOFT") || (i.type === "gear" && (i.system?.type === "AUTOSOFT" || i.system?.subtype === "AUTOSOFT"));
    if (!isSoft) continue;
    const id = Object.keys(V.AUTOSOFTS).find((k) => i.system?.subtype === k || String(i.name).toUpperCase().replace(/[\s-]+/g, "_").includes(k.replace("MANEUVER", "MANEUV")));
    if (id) out[id] = Math.max(out[id] ?? 0, num(i.system?.rating));
  }
  return out;
}

/** Everything the Edge vehicle sheet shows about driving (pure data from the actor). */
export function vehicleState(vehicle) {
  const s = vehicle.system ?? {};
  const veh = s.vehicle ?? {};
  const mode = veh.opMode ?? "manual";
  const speed = num(veh.speed);
  const from = num(vehicle.getFlag?.(MODULE_ID, "speedFrom"), speed);
  const interval = veh.offRoad ? num(s.spdiOff, num(s.spdiOn)) : num(s.spdiOn);
  const intervals = V.speedIntervals(speed, interval);
  const dmg = num(s.physical?.dmg);
  const damagePenalty = Math.floor(dmg / 3);
  const softs = autosoftRatings(vehicle);
  const pool = V.handlingPool({ mode, systemPool: s.skills?.piloting?.pool, pilot: s.pil, maneuver: softs.MANEUVER, speedPenalty: intervals, damagePenalty });
  const driver = driverOf(vehicle);
  return {
    mode, driver, speed, from, top: num(s.tspd), accel: num(veh.offRoad ? s.accOff || s.accOn : s.accOn), offRoad: !!veh.offRoad,
    interval, intervals, distance: V.distance(from, speed), kmh: V.kmh(speed),
    threshold: V.handlingThreshold({ handlOn: s.handlOn, handlOff: s.handlOff, offRoad: veh.offRoad, dmg }), damagePenalty,
    pool, body: num(s.bod), armor: num(s.arm), sensor: num(s.sen), pilot: num(s.pil),
    monitor: { dmg, max: num(s.physical?.max) },
    ar: V.isDriven(mode) ? num(s.ar?.pool) : num(softs.MANEUVER) + num(s.pil),
    dr: num(s.defenserating?.physical?.pool),
    softs, drone: !V.isDriven(mode),
  };
}

// ───── Speed ─────

/** Accelerate (+1), brake (−1) or hold (0): the start-of-round speed is kept for the distance. */
export async function setSpeed(vehicle, dir) {
  const st = vehicleState(vehicle);
  if (!dir) return vehicle.update({ [`flags.${MODULE_ID}.speedFrom`]: st.speed });
  const next = V.changeSpeed(st.speed, { accel: st.accel, top: st.top || Infinity, dir });
  return vehicle.update({ "system.vehicle.speed": next, [`flags.${MODULE_ID}.speedFrom`]: st.speed });
}

// ───── Handling and crash ─────

function head(vehicle, kind, sub) {
  return ui2.head({ kind, name: vehicle.name, sub });
}

/** A Handling test (Piloting + Reaction vs Handling); a failure asks for the crash test (p. 200). */
export async function openHandling(vehicle) {
  const st = vehicleState(vehicle);
  const who = st.driver ? L("SRE.Vehicle.DriverIs", { name: st.driver.name }) : L(st.drone ? "SRE.Vehicle.DroneDrives" : "SRE.Vehicle.NoDriver");
  const result = ui2.okOnly(await foundry.applications.api.DialogV2.wait({
    classes: ["sre-dialog"],
    window: { title: `${L("SRE.Vehicle.Handling")} — ${vehicle.name}`, icon: "fas fa-car" },
    position: { width: 440 },
    content: `<div class="sre-ed">${head(vehicle, L("SRE.Vehicle.HandlingKind"), who)}<div class="sre-ed-body">
      ${ui2.tiles([
        { id: "pool", big: st.pool, label: L("SRE.Vehicle.Pool"), calc: st.intervals ? L("SRE.Vehicle.SpeedPenalty", { n: st.intervals }) : "", accent: true },
        { id: "th", big: st.threshold, label: L("SRE.Vehicle.Threshold"), calc: L(st.offRoad ? "SRE.Vehicle.OffRoad" : "SRE.Vehicle.OnRoad") + (st.damagePenalty ? ` · +${st.damagePenalty} ${L("SRE.Vehicle.FromDamage")}` : "") },
      ])}
      ${ui2.panel(L("SRE.Vehicle.Maneuver"), ui2.rows([
        ui2.row(L("SRE.Vehicle.ThresholdGM"), ui2.stepper("threshold", st.threshold, { min: 1 })),
        ui2.row(L("SRE.Vehicle.Difficulty"), ui2.stepper("mod", 0)),
      ]))}
      ${ui2.note(L("SRE.Vehicle.CrashNote"), "info")}
    </div></div>`,
    render: (event, dialog) => ui2.wire(dialog, (f) => {
      const pool = Math.max(0, st.pool + num(f.elements.mod.value));
      ui2.setTile(f, "pool", { big: pool });
      ui2.setTile(f, "th", { big: num(f.elements.threshold.value) });
      ui2.setMainLabel(dialog, L("SRE.Vehicle.Roll", { n: pool }));
    }),
    buttons: ui2.buttons(L("SRE.Vehicle.RollShort"), (event, button) => ({ threshold: num(button.form.elements.threshold.value), mod: num(button.form.elements.mod.value) }), { icon: "fas fa-dice" }),
    rejectClose: false,
  }));
  if (!result) return;
  return systemTest(vehicle, {
    pool: Math.max(0, st.pool + result.mod), label: `${L("SRE.Vehicle.Handling")}: ${vehicle.name}`, threshold: result.threshold, useWoundModifier: false,
    task: { kind: "handling", vehicle: vehicle.uuid, threshold: result.threshold, mod: result.mod, crash: false, speed: st.speed },
  });
}

registerTask("handling", {
  render(task, hits, message) {
    const ok = hits >= num(task.threshold);
    if (ok) return `<p><b>${L(task.crash ? "SRE.Vehicle.CrashAvoided" : "SRE.Vehicle.Success")}</b></p>`;
    if (!task.crash) {
      return `<p><b>${L("SRE.Vehicle.Failed")}</b> — ${L("SRE.Vehicle.CrashTest", { th: task.threshold })}</p>
        ${task.created ? `<em>${L("SRE.Matrix.Done")}</em>` : message.isOwner || game.user.isGM ? `<button type="button" data-crash>${L("SRE.Vehicle.RollCrash")}</button>` : ""}`;
    }
    const dv = V.crashDamage(task.speed, task.safety ?? 0);
    return `<p><b>${L("SRE.Vehicle.Crash")}</b> ${L("SRE.Vehicle.CrashDV", { speed: task.speed, dv: V.crashDamage(task.speed) })}</p>
      <p>${L("SRE.Vehicle.Safety")} <input type="number" min="0" data-safety value="${num(task.safety)}" ${game.user.isGM ? "" : "disabled"}> → DV <b data-dv>${dv}</b></p>
      ${game.user.isGM ? `<p><button type="button" data-occupants>${L("SRE.Vehicle.OccupantsResist")}</button> <button type="button" data-driver-soak>${L("SRE.Vehicle.DriverResists")}</button></p><p class="sre-task-dim">${L("SRE.Vehicle.OccupantsHint")}</p>` : ""}`;
  },
  bind(root, message, task) {
    root.querySelector("[data-crash]")?.addEventListener("click", async () => {
      const vehicle = await fromUuid(task.vehicle);
      if (!vehicle) return;
      await patchTask(message, { created: true });
      const st = vehicleState(vehicle);
      return systemTest(vehicle, {
        pool: Math.max(0, st.pool + num(task.mod)), label: `${L("SRE.Vehicle.CrashTestTitle")}: ${vehicle.name}`, threshold: task.threshold, useWoundModifier: false,
        task: { ...task, crash: true, created: false, safety: 0 },
      });
    });
    const safety = root.querySelector("[data-safety]");
    safety?.addEventListener("change", () => message.setFlag(MODULE_ID, "task", { ...task, safety: num(safety.value) }));
    const dv = () => V.crashDamage(task.speed, num(safety?.value));
    root.querySelector("[data-occupants]")?.addEventListener("click", async () => {
      const actors = [...(game.user.targets ?? [])].map((t) => t.actor).filter(Boolean);
      if (!actors.length) return ui.notifications.warn(L("SRE.Vehicle.TargetOccupants"));
      for (const a of actors) await resistBody(a, dv(), L("SRE.Vehicle.Crash"));
    });
    root.querySelector("[data-driver-soak]")?.addEventListener("click", async () => {
      const vehicle = await fromUuid(task.vehicle);
      const driver = vehicle && driverOf(vehicle);
      if (!driver) return ui.notifications.warn(L("SRE.Vehicle.NoDriver"));
      return resistBody(driver, dv(), L("SRE.Vehicle.Crash"));
    });
  },
});

/** Damage resisted with Body through the system's soak card (people and vehicles alike, p. 201). */
export function resistBody(actor, dv, source) {
  const body = actor.type === "Vehicle" ? num(actor.system?.bod) : num(actor.system?.attributes?.bod?.pool);
  return rolls.rollSoakTest(actor, { soakType: "damage_phys", damage: dv, monitor: "physical", pool: body, label: L("SRE.Vehicle.ResistLabel", { source, dv }) });
}

// ───── Opposed drivers' test ─────

export async function driversTest(vehicle) {
  const st = vehicleState(vehicle);
  return systemTest(vehicle, {
    pool: st.pool, label: `${L("SRE.Vehicle.Drivers")}: ${vehicle.name}`, useWoundModifier: false,
    task: { kind: "drivers", vehicle: vehicle.uuid, name: vehicle.name, otherHits: null },
  });
}

/** The other driver's hits, typed by whoever runs them (or the GM). */
function otherHitsControls(task, message, key = "otherHits") {
  if (task[key] !== null && task[key] !== undefined) return "";
  if (!(message.isOwner || game.user.isGM)) return `<p class="sre-task-dim">${L("SRE.Matrix.WaitDefense")}</p>`;
  return `<p>${L("SRE.Vehicle.OtherHits")} <input type="number" min="0" data-other value="0"> <button type="button" data-other-set>${L("SRE.Matrix.Set")}</button></p>`;
}
function bindOther(root, message, task, key = "otherHits") {
  root.querySelector("[data-other-set]")?.addEventListener("click", () => message.setFlag(MODULE_ID, "task", { ...task, [key]: num(root.querySelector("[data-other]")?.value) }));
}

registerTask("drivers", {
  render(task, hits, message) {
    const ctl = otherHitsControls(task, message);
    if (ctl) return ctl;
    const net = hits - num(task.otherHits);
    return `<p>${L("SRE.Matrix.Versus", { hits, def: task.otherHits, net })} — <b>${L(net > 0 ? "SRE.Vehicle.Wins" : net < 0 ? "SRE.Vehicle.Loses" : "SRE.Vehicle.Tie", { name: esc(task.name) })}</b></p>
      <p class="sre-task-dim">${L("SRE.Vehicle.AfterTest")}</p>`;
  },
  bind: (root, message, task) => bindOther(root, message, task),
});

// ───── Ramming ─────

/** Ramming (p. 201): opposed Piloting + Reaction vs Piloting + Reaction (vehicle) or Intuition + Reaction (person). */
export async function openRam(vehicle) {
  const st = vehicleState(vehicle);
  const target = [...(game.user.targets ?? [])][0]?.actor ?? null;
  const targetIsVehicle = target?.type === "Vehicle";
  const dmg = V.ramDamage(st.body, st.intervals);
  const targetDR = target ? num(target.system?.defenserating?.physical?.pool) : null;
  const result = ui2.okOnly(await foundry.applications.api.DialogV2.wait({
    classes: ["sre-dialog"],
    window: { title: `${L("SRE.Vehicle.Ram")} — ${vehicle.name}`, icon: "fas fa-car-burst" },
    position: { width: 460 },
    content: `<div class="sre-ed">${head(vehicle, L("SRE.Vehicle.RamKind"), L("SRE.Vehicle.RamCheck"))}<div class="sre-ed-body">
      ${ui2.tiles([
        { big: st.pool, label: L("SRE.Vehicle.Pool"), calc: st.intervals ? L("SRE.Vehicle.SpeedPenalty", { n: st.intervals }) : "", accent: true },
        { big: dmg, label: L("SRE.Vehicle.Damage"), calc: L("SRE.Vehicle.RamCalc", { body: st.body, n: st.intervals }) },
      ])}
      ${ui2.panel(L("SRE.Vehicle.Target"), ui2.options("kind", [
        { value: "vehicle", label: L("SRE.Vehicle.TargetVehicle"), small: targetIsVehicle ? `${target.name} · ${L("SRE.Vehicle.BackSame")}` : L("SRE.Vehicle.BackSame"), checked: !target || targetIsVehicle },
        { value: "person", label: L("SRE.Vehicle.TargetPerson"), small: !targetIsVehicle && target ? `${target.name} · ${L("SRE.Vehicle.BackSoft")}` : L("SRE.Vehicle.BackSoft"), checked: !!target && !targetIsVehicle },
      ]))}
      ${ui2.panel(L("SRE.Vehicle.Edge"), ui2.rows([
        ui2.row(L("SRE.Vehicle.AR"), `<b>${st.ar}</b>`),
        ui2.row(L("SRE.Vehicle.TargetDR"), `<b>${targetDR ?? "—"}</b>`),
      ]))}
      ${ui2.note(target ? L("SRE.Vehicle.EdgeNote") : L("SRE.Vehicle.TargetHint"), "info")}
    </div></div>`,
    buttons: ui2.buttons(L("SRE.Vehicle.RamButton", { n: st.pool }), (event, button) => ({ kind: button.form.elements.kind.value }), { icon: "fas fa-car-burst" }),
    rejectClose: false,
  }));
  if (!result) return;
  const tst = target?.type === "Vehicle" ? vehicleState(target) : null;
  return systemTest(vehicle, {
    pool: st.pool, label: `${L("SRE.Vehicle.Ram")}: ${vehicle.name}${target ? ` → ${target.name}` : ""}`, useWoundModifier: false,
    task: {
      kind: "ram", vehicle: vehicle.uuid, name: vehicle.name, targetKind: result.kind, target: target?.uuid ?? null, targetName: target?.name ?? "",
      damage: dmg,
      back: result.kind === "vehicle" ? (tst ? V.ramDamage(tst.body, tst.intervals) : null) : target ? V.softTargetDamage(target.system?.attributes?.bod?.pool) : null,
      otherHits: null,
    },
  });
}

registerTask("ram", {
  render(task, hits, message) {
    const ctl = otherHitsControls(task, message);
    if (ctl) return ctl;
    const net = hits - num(task.otherHits);
    if (net <= 0) return `<p>${L("SRE.Matrix.Versus", { hits, def: task.otherHits, net })} — <b>${L("SRE.Vehicle.Miss")}</b></p>`;
    const gm = game.user.isGM;
    const back = task.back;
    return `<p>${L("SRE.Matrix.Versus", { hits, def: task.otherHits, net })} — <b>${L("SRE.Vehicle.Hit")}</b></p>
      <p><b>${esc(task.targetName || L("SRE.Vehicle.Target"))}</b>: ${task.damage}P ${gm && task.target ? `<button type="button" data-hit="${task.damage}">${L("SRE.Vehicle.Resist")}</button>` : ""}</p>
      <p><b>${esc(task.name)}</b> (${L("SRE.Vehicle.Back")}): ${back !== null && back !== undefined ? `${back}P ${gm ? `<button type="button" data-back="${back}">${L("SRE.Vehicle.Resist")}</button>` : ""}` : `<input type="number" min="0" data-back-dv value="0" ${gm ? "" : "disabled"}> ${gm ? `<button type="button" data-back-typed>${L("SRE.Vehicle.Resist")}</button>` : ""}`}</p>
      <p class="sre-task-dim">${L("SRE.Vehicle.StunNote")}</p>`;
  },
  bind(root, message, task) {
    bindOther(root, message, task);
    root.querySelector("[data-hit]")?.addEventListener("click", async (e) => {
      const target = task.target ? await fromUuid(task.target) : null;
      if (target) return resistBody(target, num(e.currentTarget.dataset.hit), L("SRE.Vehicle.Ram"));
    });
    const backResist = async (dv) => {
      const vehicle = await fromUuid(task.vehicle);
      if (vehicle) return resistBody(vehicle, dv, L("SRE.Vehicle.Ram"));
    };
    root.querySelector("[data-back]")?.addEventListener("click", (e) => backResist(num(e.currentTarget.dataset.back)));
    root.querySelector("[data-back-typed]")?.addEventListener("click", () => backResist(num(root.querySelector("[data-back-dv]")?.value)));
  },
});

// ───── Drones ─────

export function droneTest(vehicle, id) {
  const st = vehicleState(vehicle);
  const t = V.droneTests({ pil: st.pilot, sen: st.sensor }, st.softs).find((x) => x.id === id);
  if (!t) return;
  return rolls.rollVehicle(vehicle, { pool: t.pool, label: `${L(`SRE.Vehicle.Soft.${id}`)} (${vehicle.name})` });
}

export function droneInitiative(vehicle) {
  const ini = V.droneInitiative(vehicle.system?.pil);
  return rolls.rollInitiative(vehicle, { id: "matrix", base: ini.base, dice: ini.dice, label: `${L("SRE.Sheet.InitiativeTitle")}: ${vehicle.name}` });
}

/** Drones slaved to the same RCC: same owner, operation mode "rcc". */
export function rccGroup(vehicle) {
  const owner = vehicle.system?.vehicle?.belongs;
  if (!owner) return [];
  return (game.actors?.filter?.((a) => a.type === "Vehicle" && a.system?.vehicle?.belongs === owner && a.system?.vehicle?.opMode === "rcc") ?? []);
}

/** The owner's active rigger command console. */
export function rccOf(vehicle) {
  const owner = driverOf(vehicle);
  return owner?.items?.find((i) => i.type === "gear" && i.system?.subtype === "RIGGER_CONSOLE" && i.system?.usedForPool) ?? null;
}

/** One command to every drone slaved to the RCC (a Minor Action, errata Feb 2020): each rolls its own test. */
export async function groupCommand(vehicle) {
  const drones = rccGroup(vehicle);
  if (!drones.length) return ui.notifications.warn(L("SRE.Vehicle.NoGroup"));
  const rcc = rccOf(vehicle);
  const max = rcc ? V.rccSlaves(rcc.system?.devRating) : null;
  if (max !== null && drones.length > max) {
    const choice = await resolveConflict({ title: L("SRE.Vehicle.Group"), name: vehicle.name, problems: [L("SRE.Vehicle.TooManyDrones", { n: drones.length, max })],
      options: [{ id: "go", label: L("SRE.Matrix.ActAnyway"), breaksRules: true }] });
    if (choice !== "go") return;
  }
  const choice = ui2.okOnly(await foundry.applications.api.DialogV2.wait({
    classes: ["sre-dialog"],
    window: { title: L("SRE.Vehicle.Group"), icon: "fas fa-satellite-dish" },
    position: { width: 420 },
    content: `<div class="sre-ed">${ui2.head({ kind: L("SRE.Vehicle.Group"), name: rcc?.name ?? L("SRE.Vehicle.RCC"), sub: drones.map((d) => d.name).join(", ") })}
      <div class="sre-ed-body">${ui2.panel(L("SRE.Vehicle.Command"), ui2.options("test", Object.keys(V.AUTOSOFTS).map((id, i) => ({ value: id, label: L(`SRE.Vehicle.Soft.${id}`), checked: i === 0 }))))}
      ${ui2.note(L("SRE.Vehicle.GroupNote"), "info")}</div></div>`,
    buttons: ui2.buttons(L("SRE.Vehicle.Order"), (event, button) => button.form.elements.test.value, { icon: "fas fa-satellite-dish" }),
    rejectClose: false,
  }));
  if (!choice) return;
  for (const d of drones) await droneTest(d, choice);
}

/** Speed at the start of each combat round: the distance counts from it. */
Hooks.on("updateCombat", async (combat, changed) => {
  if (!game.users.activeGM?.isSelf || !("round" in changed)) return;
  for (const c of combat.combatants) {
    const a = c.actor;
    if (a?.type === "Vehicle") await a.setFlag(MODULE_ID, "speedFrom", num(a.system?.vehicle?.speed));
  }
});
