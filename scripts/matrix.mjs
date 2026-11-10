/**
 * Matrix (pp. 175–187): Overwatch Score, Convergence, dumpshock, access levels and backdoors, Data Spike and IC damage.
 *
 * Matrix actions from the Edge sheet open a module window (target, access wanted, hacking program, Under the Radar,
 * noise) and roll through the system's dialog. Their chat card gets a task: the defender's hits (typed or rolled by
 * the GM), the OS to add (GM only: the OS is secret unless the world shows it), access or a backdoor to record,
 * Data Spike damage. Illegal access held on hosts adds OS every combat round; at 40 the GM is asked about Convergence.
 * Nothing blocks the GM: access the persona lacks, missing Edge and the like ask (ui/conflict.mjs).
 */
import * as R from "./matrix-rules.mjs";
import { addStatus } from "./effects.mjs";
import { systemTest, registerTask, patchTask } from "./linked-roll.mjs";
import * as rolls from "./sheet/system-rolls.mjs";
import { matrixActionPool } from "./sheet/context.mjs";
import { resolveConflict } from "./ui/conflict.mjs";
import * as ui2 from "./ui/edge-ui.mjs";
import * as fx from "./fx.mjs";

const MODULE_ID = "shadowrun-edge";
const L = (key, data) => (data ? game.i18n.format(key, data) : game.i18n.localize(key));
const esc = (s) => foundry.utils.escapeHTML(String(s ?? ""));
const num = (v, d = 0) => (Number.isFinite(Number(v)) ? Number(v) : d);
const DEVICE_SUBTYPES = new Set(["COMMLINK", "CYBERDECK", "RIGGER_CONSOLE", "CYBERJACK"]);

// ───── Actor state ─────

/** Where the system keeps the OS: legacy actors `system.overwatch`, data-model personas `system.matrix.overwatchScore`. */
export const osPath = (actor) => (actor.system?.matrix?.overwatchScore !== undefined ? "system.matrix.overwatchScore" : "system.overwatch");
export const getOS = (actor) => num(foundry.utils.getProperty(actor, osPath(actor)));
export const osVisible = () => game.user.isGM || !!game.settings.get(MODULE_ID, "overwatchVisible");

const state = (actor) => actor.getFlag(MODULE_ID, "matrix") ?? {};
export const targetsOf = (actor) => [...(state(actor).targets ?? [])];
const setState = (actor, patch) => actor.update({ [`flags.${MODULE_ID}.matrix`]: { ...state(actor), ...patch } });

const firewall = (actor) => num(actor.system?.persona?.used?.f ?? actor.system?.matrix?.attributes?.firewall);
const willpower = (actor) => num(actor.system?.attributes?.wil?.pool);
const attrPool = (actor, id) => {
  if (["a", "s", "d", "f"].includes(id)) return num(actor.system?.persona?.used?.[id]);
  return num(actor.system?.attributes?.[id]?.pool);
};
const attrLabel = (id) => (["a", "s", "d", "f"].includes(id) ? L(`SRE.Sheet.Asdf.${id}`) : L(`attrib.${id}`));

/** The device the persona uses: the active cyberdeck, else any active Matrix device. */
export function activeDevice(actor) {
  const devices = actor.items.filter((i) => i.type === "gear" && DEVICE_SUBTYPES.has(i.system?.subtype) && i.system?.usedForPool);
  return devices.find((i) => i.system?.subtype === "CYBERDECK") ?? devices[0] ?? null;
}

const noEdgeEffect = (actor) => actor.effects.find((e) => e.getFlag(MODULE_ID, "noEdge") || e.statuses?.has?.("sreDumpshock"));

/** Edge use under the dumpshock lock: asks (the GM may always go on). */
export async function edgeAllowed(actor) {
  if (!noEdgeEffect(actor)) return true;
  const choice = await resolveConflict({
    title: actor.name, name: actor.name, problems: [L("SRE.Matrix.NoEdgeProblem")],
    options: [{ id: "go", label: L("SRE.Matrix.EdgeAnyway"), breaksRules: true }],
  });
  return choice === "go";
}

// ───── Overwatch, Convergence, reboot, dumpshock ─────

/** Adds OS (GM). Reaching the Convergence threshold asks the GM. */
export async function addOS(actor, amount, { quiet = false } = {}) {
  if (!game.user.isGM || !amount) return;
  const before = getOS(actor);
  const after = Math.max(0, before + amount);
  await actor.update({ [osPath(actor)]: after });
  if (!quiet) ui.notifications.info(L("SRE.Matrix.OSAdded", { name: actor.name, n: amount, os: after }));
  if (R.isConvergence(after) && !state(actor).converged) await convergence(actor, after);
}

export async function setOS(actor, value) {
  await actor.update({ [osPath(actor)]: Math.max(0, num(value)) });
  if (game.user.isGM && R.isConvergence(value) && !state(actor).converged) await convergence(actor, value);
}

/** Convergence (p. 176, errata Aug 2019): the GM executes it or puts it off. */
export async function convergence(actor, os = getOS(actor)) {
  const device = actor.items.get(state(actor).lastDevice) ?? activeDevice(actor);
  const shock = R.dumpshock(actor.system?.matrixIni, willpower(actor));
  const effects = [
    device ? L("SRE.Matrix.Brick", { device: device.name }) : L("SRE.Matrix.BrickNone"),
    L("SRE.Matrix.Dumped"),
    shock ? L("SRE.Matrix.DumpshockShort", { dv: `${shock.damage}${shock.monitor === "physical" ? "P" : "S"}` }) : L("SRE.Matrix.NoDumpshockAR"),
    L("SRE.Matrix.Reported"),
  ].join(" · ");
  const choice = ui2.okOnly(await foundry.applications.api.DialogV2.wait({
    classes: ["sre-dialog"],
    window: { title: L("SRE.Matrix.ConvergenceTitle", { name: actor.name }), icon: "fas fa-eye" },
    position: { width: 440 },
    content: `<div class="sre-ed">${ui2.head({ kind: L("SRE.Matrix.Convergence"), name: actor.name, sub: `OS ${os} / ${R.CONVERGENCE}` })}
      <div class="sre-ed-body">${ui2.note(L("SRE.Matrix.GodFound"), "warn")}
      ${ui2.panel(L("SRE.Matrix.WhatNow"), ui2.options("choice", [
        { value: "do", label: L("SRE.Matrix.Execute"), small: effects, checked: true },
        { value: "later", label: L("SRE.Matrix.Later"), small: L("SRE.Matrix.LaterHint") },
      ]))}</div></div>`,
    buttons: ui2.buttons(L("SRE.Matrix.Confirm"), (event, button) => button.form.elements.choice.value, { icon: "fas fa-check" }),
    rejectClose: false,
  }));
  if (choice !== "do") return;
  fx.convergence(actor);
  if (device) await device.update({ "system.usedForPool": false, [`flags.${MODULE_ID}.bricked`]: true });
  await setState(actor, { converged: true, targets: [], linkLock: false });
  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor }),
    whisper: ChatMessage.getWhisperRecipients("GM").map((u) => u.id),
    content: `<div class="sre-blast-card"><h3>${L("SRE.Matrix.ConvergenceTitle", { name: esc(actor.name) })}</h3><p>${esc(effects)}</p></div>`,
  });
  if (shock) await dumpshockFor(actor);
}

/** Reboot (errata Feb 2020): OS, exploits and backdoors reset; held access ends; link-lock gone. */
export async function reboot(actor) {
  await actor.update({ [osPath(actor)]: 0, [`flags.${MODULE_ID}.matrix`]: { ...state(actor), targets: [], converged: false, linkLock: false } });
  ui.notifications.info(L("SRE.Matrix.Rebooted", { name: actor.name }));
}

/** Dumpshock (p. 176): resistance with Willpower through the system's soak card, and no Edge for (10 − WIL) minutes. */
export async function dumpshockFor(actor) {
  const shock = R.dumpshock(actor.system?.matrixIni, willpower(actor));
  if (!shock) return ui.notifications.info(L("SRE.Matrix.NoDumpshockAR"));
  if (shock.minutes > 0) {
    // The module's Dumpshock status (token HUD), ending after (10 − Willpower) minutes.
    await addStatus(actor, "sreDumpshock", { source: L("SRE.Effects.Status.dumpshock"), seconds: shock.minutes * 60, flags: { noEdge: true } });
  }
  return rolls.rollSoakTest(actor, {
    soakType: shock.monitor === "physical" ? "damage_phys" : "damage_stun", damage: shock.damage, monitor: shock.monitor,
    pool: willpower(actor), label: L("SRE.Matrix.DumpshockLabel", { minutes: shock.minutes }),
  });
}

// ───── The action window ─────

const ACTION_KEY = (id) => `shadowrun6.matrixaction.${id}.name`;

/** Targets the window offers: the persona's recorded targets, then host actors (system 4.x) not yet recorded. */
function targetChoices(actor) {
  const list = targetsOf(actor);
  for (const host of game.actors?.filter?.((a) => a.type === "host") ?? []) {
    if (!list.some((t) => t.hostUuid === host.uuid)) list.push({ key: `h_${host.id}`, name: host.name, kind: "host", rating: num(host.system?.rating), access: "outsider", illegal: false, hostUuid: host.uuid });
  }
  return list;
}

const accessText = (t) => (t ? `${L(`SRE.Matrix.Access.${t.access ?? "outsider"}`)}${t.access && t.access !== "outsider" ? ` · ${L(t.illegal ? "SRE.Matrix.IllegalAccess" : "SRE.Matrix.LegalAccess")}` : ""}` : "—");

function checkText(action) {
  const attackers = `${L(`skill.${action.skill}`)} + ${attrLabel(action.attrib)}`;
  const a1 = action.attr1 ?? action.opposedAttr1;
  const a2 = action.attr2 ?? action.opposedAttr2;
  return a1 ? `${attackers} ${L("SRE.Matrix.Vs")} ${attrLabel(a1)}${a2 ? ` + ${attrLabel(a2)}` : ""}` : attackers;
}

/** A Matrix action from the Edge sheet. Actions without a test go straight to the system. */
export async function openMatrixAction(actor, actionId, { target: preset = null, terminal = null } = {}) {
  const action = CONFIG.SR6?.MATRIX_ACTIONS?.[actionId];
  if (!action) return;
  if (!action.skill) return rolls.rollMatrixAction(actor, actionId);
  const raw = matrixActionPool(action, actor.system);
  const name = L(ACTION_KEY(actionId));
  const targets = targetChoices(actor);
  // From the Matrix terminal: the node's network is the target (added to the list when not yet recorded).
  if (preset && !targets.some((t) => t.key === preset.key)) targets.unshift(preset);
  const needs = R.accessNeeded(action);
  const isBrute = actionId === "brute_force";
  const isBackdoor = actionId === "backdoor_entry";
  const kind = [L("SRE.Matrix.Kind"), L(action.illegal ? "SRE.Matrix.Illegal" : "SRE.Matrix.Legal"), L(action.major ? "SRE.Matrix.Major" : "SRE.Matrix.Minor"),
    R.actionLevels(action).map((l) => L(`SRE.Matrix.Access.${l}`)).join("/")].filter(Boolean).join(" · ");
  const targetOptions = [`<option value="">${esc(L("SRE.Matrix.NoTarget"))}</option>`,
    ...targets.map((t) => `<option value="${esc(t.key)}"${preset?.key === t.key ? " selected" : ""}>${esc(L(`SRE.Matrix.Kinds.${t.kind}`))}: ${esc(t.name)}${t.rating ? ` (${t.rating})` : ""}</option>`),
    `<option value="new">${esc(L("SRE.Matrix.NewTarget"))}</option>`].join("");

  const content = `<div class="sre-ed sre-matrix">
    ${ui2.head({ kind, name, sub: checkText(action) })}
    <div class="sre-ed-body">
      ${ui2.tiles([
        { id: "pool", big: raw, label: L("SRE.Matrix.Pool"), calc: "", accent: true },
        action.illegal ? { id: "os", big: "+?", label: "OS", calc: L("SRE.Matrix.OSForecast") } : null,
      ])}
      ${ui2.panel(L("SRE.Matrix.Target"), ui2.rows([
        ui2.row(L("SRE.Matrix.Target"), `<select name="target">${targetOptions}</select>`),
        `<div data-for="new" hidden>${ui2.rows([
          ui2.row(L("SRE.Matrix.TargetName"), `<input type="text" name="newName">`),
          ui2.row(L("SRE.Matrix.TargetKind"), `<select name="newKind"><option value="host">${esc(L("SRE.Matrix.Kinds.host"))}</option><option value="device">${esc(L("SRE.Matrix.Kinds.device"))}</option><option value="persona">${esc(L("SRE.Matrix.Kinds.persona"))}</option></select>`),
          ui2.row(L("SRE.Matrix.Rating"), ui2.stepper("newRating", 3, { min: 1, max: 12 })),
        ])}</div>`,
        ui2.row(L("SRE.Matrix.YouHave"), `<span class="sre-acc" data-acc>—</span>`),
        ui2.note("", "info", { id: "backdoor" }),
      ]), { hint: L("SRE.Matrix.Needs", { level: L(`SRE.Matrix.Access.${needs}`) }) })}
      ${isBrute ? ui2.panel(L("SRE.Matrix.Want"), ui2.options("want", [
        { value: "user", label: L("SRE.Matrix.Access.user"), checked: true },
        { value: "admin", label: L("SRE.Matrix.Access.admin"), small: L("SRE.Matrix.AdminJump") },
      ])) : ""}
      ${ui2.panel(L("SRE.Matrix.Modifiers"), ui2.rows([
        ui2.chips([
          ui2.chip("program", L("SRE.Matrix.Program")),
          action.illegal ? ui2.chip("radar", L("SRE.Matrix.Radar")) : "",
        ]),
        ui2.row(L("SRE.Matrix.Noise"), ui2.stepper("noise", 0, { min: 0 })),
      ]))}
      ${ui2.note("", "info", { id: "summary" })}
    </div></div>`;

  const read = (f) => {
    const key = f.elements.target.value;
    const t = targets.find((x) => x.key === key) ?? null;
    const noise = num(f.elements.noise?.value);
    const backdoor = isBackdoor && t?.backdoor && num(t.backdoor.until) > game.time.worldTime ? num(t.backdoor.bonus) : 0;
    return { key, t, noise, backdoor, pool: Math.max(0, raw - noise + backdoor),
      want: f.elements.want?.value ?? "user", program: !!f.elements.program?.checked, radar: !!f.elements.radar?.checked,
      newName: f.elements.newName?.value?.trim(), newKind: f.elements.newKind?.value, newRating: num(f.elements.newRating?.value, 3) };
  };

  const result = ui2.okOnly(await foundry.applications.api.DialogV2.wait({
    classes: ["sre-dialog"],
    window: { title: `${name} — ${actor.name}`, icon: "fas fa-network-wired" },
    position: { width: 480 },
    content,
    render: (event, dialog) => ui2.wire(dialog, (f) => {
      const d = read(f);
      ui2.showFor(f, d.key === "new" ? "new" : "");
      ui2.setTile(f, "pool", { big: d.pool, calc: [`${L("SRE.Matrix.Base")} ${raw}`, d.noise ? `${L("SRE.Matrix.Noise")} −${d.noise}` : "", d.backdoor ? `${L("SRE.Matrix.Backdoor")} +${d.backdoor}` : ""].filter(Boolean).join(" · ") });
      const acc = f.querySelector("[data-acc]");
      if (acc) {
        acc.textContent = accessText(d.t);
        acc.className = `sre-acc ${d.t?.access === "admin" ? (d.t.illegal ? "a" : "l") : d.t?.access === "user" ? (d.t.illegal ? "u" : "l") : ""}`;
      }
      ui2.setNote(f, "backdoor", d.backdoor ? L("SRE.Matrix.BackdoorBonus", { n: d.backdoor }) : "");
      const lines = [];
      if (action.illegal) lines.push(d.radar ? L("SRE.Matrix.RadarNote") : L("SRE.Matrix.OSNote", { program: d.program ? " + 1" : "" }));
      else if (d.program) lines.push(L("SRE.Matrix.ProgramNote"));
      if (isBrute) {
        const def = R.bruteForceDefense(d.want, d.t?.access);
        if (def.drBonus) lines.push(L("SRE.Matrix.JumpNote"));
        lines.push(L(d.want === "admin" ? "SRE.Matrix.AdminHeld" : "SRE.Matrix.UserHeld"));
      }
      ui2.setNote(f, "summary", lines.join(" "));
      ui2.setMainLabel(dialog, L("SRE.Matrix.Roll", { n: d.pool }));
    }),
    buttons: ui2.buttons(L("SRE.Matrix.RollShort"), (event, button) => read(button.form), { icon: "fas fa-dice" }),
    rejectClose: false,
  }));
  if (!result) return;

  // A new target is recorded on the persona.
  let target = result.t;
  if (result.key === "new") {
    target = { key: `t_${foundry.utils.randomID()}`, name: result.newName || L("SRE.Matrix.Unnamed"), kind: result.newKind || "device", rating: result.newRating, access: "outsider", illegal: false };
  }
  // Access the persona lacks (p. 179): asks; the GM may always go on.
  if (target && !R.accessAllowed(action, target.access)) {
    const choice = await resolveConflict({
      title: name, name: actor.name,
      problems: [L("SRE.Matrix.NoAccess", { action: name, needs: L(`SRE.Matrix.Access.${needs}`), target: target.name, has: L(`SRE.Matrix.Access.${target.access ?? "outsider"}`) })],
      options: [{ id: "go", label: L("SRE.Matrix.ActAnyway"), breaksRules: true }],
    });
    if (choice !== "go") return;
  }
  // Under the Radar: 3 Edge (p. 175).
  if (result.radar) {
    if (!(await edgeAllowed(actor))) return;
    const edge = num(actor.system?.edge?.value);
    if (edge < 3) {
      const choice = await resolveConflict({ title: name, name: actor.name, problems: [L("SRE.Matrix.NoEdgeForRadar", { edge })],
        options: [{ id: "go", label: L("SRE.Matrix.ActAnyway"), breaksRules: true }] });
      if (choice !== "go") return;
    }
    await actor.update({ "system.edge.value": Math.max(0, edge - 3) });
  }
  const patch = {};
  if (result.key === "new") patch.targets = [...targetsOf(actor), target];
  else if (target && !targetsOf(actor).some((t) => t.key === target.key)) patch.targets = [...targetsOf(actor), target];
  if (action.illegal) patch.lastDevice = activeDevice(actor)?.id ?? null;
  if (Object.keys(patch).length) await setState(actor, patch);

  const jump = isBrute ? R.bruteForceDefense(result.want, target?.access) : { firewallBonus: 0, drBonus: 0 };
  return systemTest(actor, {
    pool: result.pool,
    label: `${L("SRE.Matrix.Kind")}: ${name}${target ? ` → ${target.name}` : ""}`,
    task: {
      kind: "matrix", actionId, actor: actor.uuid, illegal: !!action.illegal, opposed: !!(action.attr1 ?? action.opposedAttr1), program: result.program, radar: result.radar,
      target: target ? { key: target.key, name: target.name, kind: target.kind, rating: num(target.rating), access: target.access ?? "outsider", hostUuid: target.hostUuid ?? null } : null,
      want: isBrute ? result.want : null, jump, ar: num(actor.system?.attackrating?.matrix?.pool),
      defensePool: defensePoolGuess(target, jump), defenderHits: null,
      terminal,
    },
  });
}

/** A starting point for the defender's pool the GM may change: a host's Firewall (or a device's rating × 2). */
function defensePoolGuess(target, jump) {
  if (!target) return 0;
  const host = target.hostUuid ? fromUuidSync(target.hostUuid) : null;
  const fw = host ? num(host.system?.matrix?.attributes?.firewall) : num(target.rating) * 2;
  return fw + num(jump?.firewallBonus);
}

// ───── Chat tasks ─────

const canEdit = (message) => message.isOwner || game.user.isGM;

/** The defender's hits: typed, or rolled by the GM from a pool. */
function defenderControls(task, message) {
  if (task.defenderHits !== null && task.defenderHits !== undefined) return "";
  if (!canEdit(message)) return `<p class="sre-task-dim">${L("SRE.Matrix.WaitDefense")}</p>`;
  return `<p class="sre-mx-def">${L("SRE.Matrix.DefenderHits")} <input type="number" min="0" data-def-hits value="0">
    <button type="button" data-def-set>${L("SRE.Matrix.Set")}</button>
    ${game.user.isGM ? `· ${L("SRE.Matrix.DefensePool")} <input type="number" min="0" data-def-pool value="${num(task.defensePool)}"> <button type="button" data-def-roll><i class="fas fa-dice"></i> ${L("SRE.Matrix.RollDefense")}</button>` : ""}</p>`;
}

function bindDefender(root, message, task) {
  const setHits = (n) => message.setFlag(MODULE_ID, "task", { ...task, defenderHits: Math.max(0, num(n)) });
  root.querySelector("[data-def-set]")?.addEventListener("click", () => setHits(root.querySelector("[data-def-hits]")?.value));
  root.querySelector("[data-def-roll]")?.addEventListener("click", async () => {
    const pool = num(root.querySelector("[data-def-pool]")?.value);
    const roll = await new Roll(`${pool}d6cs>=5`).evaluate();
    await roll.toMessage({ flavor: L("SRE.Matrix.DefenseRoll", { name: task.target?.name ?? "" }), whisper: ChatMessage.getWhisperRecipients("GM").map((u) => u.id) });
    await setHits(roll.total);
  });
}

registerTask("matrix", {
  render(task, hits, message) {
    const parts = [task.opposed ? defenderControls(task, message) : ""];
    const def = task.opposed ? task.defenderHits : 0;
    if (def === null || def === undefined) {
      if (task.program && !task.illegal && game.user.isGM) parts.push(osLine(task, 0));
      return parts.join("");
    }
    const net = hits - num(def);
    if (task.opposed) parts.push(`<p>${L("SRE.Matrix.Versus", { hits, def, net })}</p>`);
    parts.push(osLine(task, def));
    const result = R.accessResult(task.actionId, { want: task.want, net, rating: task.target?.rating });
    if (result && task.target) {
      const text = result.backdoor ? L("SRE.Matrix.BackdoorMade", { bonus: result.backdoor.bonus, hours: result.backdoor.hours })
        : L("SRE.Matrix.Grant", { level: L(`SRE.Matrix.Access.${result.access}`), legality: L(result.illegal ? "SRE.Matrix.IllegalAccess" : "SRE.Matrix.LegalAccess") });
      parts.push(`<p><b>${L("SRE.Matrix.AccessTitle")}</b>: ${esc(text)}${task.created ? ` <em>${L("SRE.Matrix.Done")}</em>` : canEdit(message) ? ` <button type="button" data-grant>${L("SRE.Matrix.Record")}</button>` : ""}</p>`);
    }
    if (task.actionId === "backdoor_entry" && net <= 0 && task.target) {
      parts.push(`<p>${L("SRE.Matrix.BackdoorLost")}${task.created ? ` <em>${L("SRE.Matrix.Done")}</em>` : canEdit(message) ? ` <button type="button" data-lose>${L("SRE.Matrix.Record")}</button>` : ""}</p>`);
    }
    if (task.actionId === "data_spike" && net > 0) {
      const dv = R.dataSpikeDamage(task.ar, net);
      parts.push(`<p><b>${L("SRE.Matrix.Damage")}</b>: ${L("SRE.Matrix.SpikeDV", { dv, ar: task.ar, net })}${game.user.isGM ? ` <button type="button" data-soak="${dv}">${L("SRE.Matrix.TargetResists")}</button>` : ""}</p>`);
    }
    if (task.actionId === "check_overwatch_score" && hits >= 4 && (message.isOwner || game.user.isGM)) {
      const actor = fromUuidSync(task.actor);
      if (actor) parts.push(`<p><b>${L("SRE.Matrix.YourOS", { os: getOS(actor) })}</b></p>`);
    }
    // From the Matrix terminal: a won Control Device runs the node's control, a won Matrix Perception reveals hidden nodes.
    if (task.terminal?.op && net >= 0 && hits > 0) {
      parts.push(`<p><b>${esc(task.terminal.label ?? "")}</b> ${task.applied ? `<em>${L("SRE.Matrix.Done")}</em>` : canEdit(message) ? `<button type="button" data-terminal>${L("SRE.Net.Execute")}</button>` : ""}</p>`);
    }
    if (task.actionId === "jack_out" && net >= 0 && canEdit(message)) {
      parts.push(`<p>${task.applied ? `<em>${L("SRE.Matrix.Done")}</em>` : `<button type="button" data-jackout>${L("SRE.Matrix.JackOut")}</button>`}</p>`);
    }
    return parts.join("");
  },
  bind(root, message, task, hits) {
    bindDefender(root, message, task);
    root.querySelector("[data-os]")?.addEventListener("click", async (e) => {
      const actor = await fromUuid(task.actor);
      if (!actor) return;
      await addOS(actor, num(root.querySelector("[data-os-n]")?.value, num(e.currentTarget.dataset.os)));
      await patchTask(message, { applied: true });
    });
    root.querySelector("[data-grant]")?.addEventListener("click", async () => {
      const actor = await fromUuid(task.actor);
      const result = R.accessResult(task.actionId, { want: task.want, net: hits - (task.opposed ? num(task.defenderHits) : 0), rating: task.target?.rating });
      if (!actor || !result) return;
      const list = targetsOf(actor);
      const i = list.findIndex((t) => t.key === task.target.key);
      const base = i >= 0 ? list[i] : { ...task.target };
      const next = result.backdoor ? { ...base, backdoor: { bonus: result.backdoor.bonus, until: game.time.worldTime + result.backdoor.hours * 3600 } }
        : { ...base, access: result.access, illegal: result.illegal };
      if (i >= 0) list[i] = next;
      else list.push(next);
      await setState(actor, { targets: list });
      await patchTask(message, { created: true });
    });
    root.querySelector("[data-lose]")?.addEventListener("click", async () => {
      const actor = await fromUuid(task.actor);
      if (!actor) return;
      await setState(actor, { targets: targetsOf(actor).map((t) => (t.key === task.target.key ? { ...t, backdoor: null } : t)) });
      await patchTask(message, { created: true });
    });
    root.querySelector("[data-soak]")?.addEventListener("click", (e) => resistMatrixDamage(num(e.currentTarget.dataset.soak), L(ACTION_KEY("data_spike"))));
    root.querySelector("[data-terminal]")?.addEventListener("click", async () => {
      const { runTerminalOp } = await import("./matrix-terminal.mjs");
      await runTerminalOp({ ...task.terminal, actor: task.actor });
      await patchTask(message, { applied: true });
    });
    root.querySelector("[data-jackout]")?.addEventListener("click", async () => {
      const actor = await fromUuid(task.actor);
      if (!actor) return;
      await reboot(actor);
      await patchTask(message, { applied: true });
      await dumpshockFor(actor);
    });
  },
});

/** The OS line of a matrix task: GM sees the amount and adds it; others see that the GM handles it. */
function osLine(task, defenderHits) {
  if (!task.illegal && !task.program) return "";
  if (!game.user.isGM && !osVisible()) return `<p class="sre-task-dim">${L("SRE.Matrix.OSByGM")}</p>`;
  const os = R.osFromAction({ illegal: task.illegal, defenderHits, program: task.program, radar: task.radar });
  const actor = fromUuidSync(task.actor);
  const now = actor ? getOS(actor) : 0;
  const calc = task.radar ? L("SRE.Matrix.RadarUsed") : L("SRE.Matrix.OSCalc", { hits: os.hits, program: os.program });
  return `<p><b>Overwatch</b>: ${esc(calc)} = <b>+${os.total}</b> → ${now + os.total} / ${R.CONVERGENCE}
    ${task.applied ? `<em>${L("SRE.Matrix.Done")}</em>` : !game.user.isGM ? "" : `<input type="number" min="0" data-os-n value="${os.total}"> <button type="button" data-os="${os.total}">${L("SRE.Matrix.AddOS")}</button>`}</p>`;
}

/** The first targeted token's actor. */
function targetedActor() {
  const token = [...(game.user.targets ?? [])][0];
  return token?.actor ?? null;
}

/** Matrix damage on the targeted persona: resisted with Firewall (errata Aug 2019), then applied to its device. */
export async function resistMatrixDamage(dv, source) {
  const actor = targetedActor();
  if (!actor) return ui.notifications.warn(L("SRE.Matrix.TargetFirst"));
  const device = activeDevice(actor);
  return systemTest(actor, {
    pool: firewall(actor), label: L("SRE.Matrix.ResistLabel", { source, dv }),
    task: { kind: "matrixSoak", actor: actor.uuid, deviceId: device?.id ?? null, dv: num(dv) },
  });
}

registerTask("matrixSoak", {
  render(task, hits) {
    const left = Math.max(0, num(task.dv) - hits);
    const actor = fromUuidSync(task.actor);
    const device = task.deviceId ? actor?.items?.get(task.deviceId) : null;
    const where = device ? device.name : L("SRE.Matrix.LivingPersona");
    return `<p>${L("SRE.Matrix.SoakLeft", { dv: task.dv, hits, left, where: esc(where) })}
      ${task.applied ? `<em>${L("SRE.Matrix.Done")}</em>` : left && game.user.isGM ? `<button type="button" data-apply="${left}">${L("SRE.Matrix.Apply")}</button>` : ""}</p>`;
  },
  bind(root, message, task) {
    root.querySelector("[data-apply]")?.addEventListener("click", async (e) => {
      const actor = await fromUuid(task.actor);
      if (!actor) return;
      await applyMatrixDamage(actor, task.deviceId, num(e.currentTarget.dataset.apply));
      await patchTask(message, { applied: true });
    });
  },
});

/** Device boxes (module flag, legacy devices have no Matrix monitor); full means bricked. A living persona takes Stun. */
export async function applyMatrixDamage(actor, deviceId, boxes) {
  const device = deviceId ? actor.items.get(deviceId) : null;
  if (!device) return rolls.applyDamage(actor, "stun", boxes);
  const max = R.deviceMonitor(device.system?.devRating);
  const dmg = Math.min(max, num(device.getFlag(MODULE_ID, "matrixDmg")) + boxes);
  const bricked = dmg >= max;
  await device.update({ [`flags.${MODULE_ID}.matrixDmg`]: dmg, ...(bricked ? { [`flags.${MODULE_ID}.bricked`]: true, "system.usedForPool": false } : {}) });
  ui.notifications.info(L(bricked ? "SRE.Matrix.Bricked" : "SRE.Matrix.DeviceDamage", { device: device.name, dmg, max }));
}

// ───── IC (host sheet) ─────

/** An IC attack (Host Rating × 2) against the targeted persona. */
export async function icAttack(host, icId) {
  const rating = num(host.system?.rating);
  const actor = targetedActor();
  const ic = R.IC[icId];
  const defense = actor && ic.defense.length ? ic.defense.reduce((a, id) => a + attrPool(actor, id), 0) : 0;
  return systemTest(host, {
    pool: R.icStats(rating).pool,
    label: `${L("SRE.Matrix.IC.Title")}: ${L(`SRE.Matrix.IC.${icId}`)}${actor ? ` → ${actor.name}` : ""}`,
    task: { kind: "icAttack", ic: icId, rating, host: host.name, target: actor?.uuid ?? null, targetName: actor?.name ?? "", defensePool: defense, defenderHits: null },
  });
}

registerTask("icAttack", {
  render(task, hits, message) {
    const ic = R.IC[task.ic];
    const parts = [`<p class="sre-task-dim">${L("SRE.Matrix.IC.Defense")}: ${ic.defense.map(attrLabel).join(" + ") || "—"}</p>`, defenderControls(task, message)];
    if (task.defenderHits === null || task.defenderHits === undefined) return parts.join("");
    const net = hits - num(task.defenderHits);
    parts.push(`<p>${L("SRE.Matrix.Versus", { hits, def: task.defenderHits, net })}</p>`);
    const hit = R.icHit(task.ic, task.rating, net);
    if (!hit) return parts.join("");
    const gm = game.user.isGM;
    if (hit.matrix) parts.push(`<p>${L("SRE.Matrix.IC.MatrixDamage", { n: hit.matrix })}${gm ? ` <button type="button" data-mx="${hit.matrix}">${L("SRE.Matrix.TargetResists")}</button>` : ""}</p>`);
    if (hit.bio) parts.push(`<p>${L("SRE.Matrix.IC.BioDamage", { n: hit.bio })}${gm ? ` <button type="button" data-bio="${hit.bio}">${L("SRE.Matrix.TargetResists")}</button>` : ""}</p>`);
    if (hit.attrLoss) parts.push(`<p>${L("SRE.Matrix.IC.AttrLoss", { attr: attrLabel(hit.attrLoss.attr), n: hit.attrLoss.amount })}</p>`);
    if (hit.linkLock) parts.push(`<p>${L("SRE.Matrix.IC.LinkLock")}${gm && task.target ? (task.applied ? ` <em>${L("SRE.Matrix.Done")}</em>` : ` <button type="button" data-lock>${L("SRE.Matrix.Record")}</button>`) : ""}</p>`);
    if (["crash", "reboot", "track"].includes(hit.effect)) parts.push(`<p>${L(`SRE.Matrix.IC.Effect.${hit.effect}`)}</p>`);
    return parts.join("");
  },
  bind(root, message, task) {
    bindDefender(root, message, task);
    const target = () => (task.target ? fromUuid(task.target) : null);
    root.querySelector("[data-mx]")?.addEventListener("click", async (e) => {
      const actor = await target();
      if (!actor) return ui.notifications.warn(L("SRE.Matrix.TargetFirst"));
      return systemTest(actor, { pool: firewall(actor), label: L("SRE.Matrix.ResistLabel", { source: L(`SRE.Matrix.IC.${task.ic}`), dv: e.currentTarget.dataset.mx }),
        task: { kind: "matrixSoak", actor: actor.uuid, deviceId: activeDevice(actor)?.id ?? null, dv: num(e.currentTarget.dataset.mx) } });
    });
    root.querySelector("[data-bio]")?.addEventListener("click", async (e) => {
      const actor = await target();
      if (!actor) return ui.notifications.warn(L("SRE.Matrix.TargetFirst"));
      const mode = actor.system?.matrixIni;
      if (mode !== "vrcold" && mode !== "vrhot") return ui.notifications.info(L("SRE.Matrix.NoBioAR"));
      const monitor = mode === "vrhot" ? "physical" : "stun";
      return rolls.rollSoakTest(actor, { soakType: monitor === "physical" ? "damage_phys" : "damage_stun", damage: num(e.currentTarget.dataset.bio), monitor,
        pool: willpower(actor), label: L("SRE.Matrix.BioLabel", { source: L(`SRE.Matrix.IC.${task.ic}`) }) });
    });
    root.querySelector("[data-lock]")?.addEventListener("click", async () => {
      const actor = await target();
      if (!actor) return;
      await setState(actor, { linkLock: true });
      await patchTask(message, { applied: true });
    });
  },
});

// ───── Sheet panel data ─────

/** What the Edge sheet's Matrix tab shows for this persona. */
export function matrixPanel(actor) {
  const s = state(actor);
  const now = game.time.worldTime;
  const targets = targetsOf(actor).map((t) => {
    const until = num(t.backdoor?.until);
    return {
      key: t.key, name: t.name, kindLabel: L(`SRE.Matrix.Kinds.${t.kind ?? "device"}`), rating: num(t.rating),
      access: t.access ?? "outsider", accessLabel: accessText(t),
      cls: t.access === "admin" ? (t.illegal ? "a" : "l") : t.access === "user" ? (t.illegal ? "u" : "l") : "",
      perRound: R.osPerRound([t]),
      backdoor: t.backdoor ? (until > now ? L("SRE.Matrix.BackdoorLeft", { bonus: t.backdoor.bonus, hours: Math.ceil((until - now) / 3600) }) : L("SRE.Matrix.Expired")) : "",
    };
  });
  const effect = noEdgeEffect(actor);
  const left = effect ? Math.max(0, num(effect.duration?.startTime) + num(effect.duration?.seconds) - now) : 0;
  const os = getOS(actor);
  return {
    visible: osVisible(),
    gm: game.user.isGM,
    os, pct: Math.min(100, Math.round((os / R.CONVERGENCE) * 100)), threshold: R.CONVERGENCE,
    perRound: R.osPerRound(targetsOf(actor)),
    lastDevice: actor.items.get(s.lastDevice)?.name ?? "",
    targets,
    mode: L(`shadowrun6.matrixini.${actor.system?.matrixIni ?? "ar"}`),
    linkLock: !!s.linkLock,
    noEdge: effect ? Math.ceil(left / 60) : 0,
  };
}

export async function cycleAccess(actor, key) {
  const order = ["outsider", "user", "admin"];
  await setState(actor, { targets: targetsOf(actor).map((t) => (t.key === key ? { ...t, access: order[(order.indexOf(t.access ?? "outsider") + 1) % 3] } : t)) });
}
export async function toggleIllegal(actor, key) {
  await setState(actor, { targets: targetsOf(actor).map((t) => (t.key === key ? { ...t, illegal: !t.illegal } : t)) });
}
export async function removeTarget(actor, key) {
  await setState(actor, { targets: targetsOf(actor).filter((t) => t.key !== key) });
}
export async function toggleLinkLock(actor) {
  await setState(actor, { linkLock: !state(actor).linkLock });
}

// ───── Hooks ─────

Hooks.once("init", () => {
  game.settings.register(MODULE_ID, "overwatchVisible", {
    name: "SRE.Matrix.Setting.Name", hint: "SRE.Matrix.Setting.Hint", scope: "world", config: true, type: Boolean, default: false,
  });
});

/** Every new combat round: OS for illegal access held on hosts (+1 User, +3 Admin per host). */
Hooks.on("updateCombat", async (combat, changed) => {
  if (!game.users.activeGM?.isSelf || !("round" in changed) || !combat.started || (changed.round ?? 0) < 2) return;
  const seen = new Set();
  const lines = [];
  for (const c of combat.combatants) {
    const actor = c.actor;
    if (!actor || seen.has(actor.uuid)) continue;
    seen.add(actor.uuid);
    const n = R.osPerRound(targetsOf(actor));
    if (!n) continue;
    await addOS(actor, n, { quiet: true });
    lines.push(`${esc(actor.name)}: +${n} → ${getOS(actor)}`);
  }
  if (lines.length) {
    await ChatMessage.create({ whisper: ChatMessage.getWhisperRecipients("GM").map((u) => u.id),
      content: `<div class="sre-blast-card"><h3>${L("SRE.Matrix.RoundOS")}</h3><p>${lines.join("<br>")}</p></div>` });
  }
});

/** The dumpshock Edge lock ends by itself. */
Hooks.on("updateWorldTime", async (worldTime) => {
  if (!game.users.activeGM?.isSelf) return;
  for (const actor of game.actors ?? []) {
    const e = noEdgeEffect(actor);
    if (e && num(e.duration?.startTime) + num(e.duration?.seconds) <= worldTime) await e.delete();
  }
});
