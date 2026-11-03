/**
 * Gas clouds, spray attacks and planted charges (core rulebook pp. 116–117).
 *
 * Gas: a grenade or rocket thrown through blast.mjs leaves a cloud (four zones: Range, × 2, × 3, × 4) kept on the
 * scene. Each combat round (or the GM's "next round" outside combat) the cloud's level per zone follows the Gas
 * table; a token in it gets a Toxin exposure card (substances.mjs) with the zone's Power — again only when that
 * Power rises above what it already faced. Smoke is the same cloud without a substance.
 * Spray: style (straight / wobbly / sweeping), fast stream (wild die), the targeted tokens, damage per target.
 * Demolitions: Engineering + Logic on a charge, the result stored on the item, detonation without scatter.
 */
import * as G from "./gas-rules.mjs";
import { RANGES, rangeCategory, areaEdge, explosiveBlast } from "./blast-rules.mjs";
import { itemBlast, detonate } from "./blast.mjs";
import { substance } from "./substances-data.mjs";
import { exposure } from "./substances.mjs";
import { registerTask, runTest, patchTask } from "./linked-roll.mjs";
import * as rolls from "./sheet/system-rolls.mjs";
import * as ui2 from "./ui/edge-ui.mjs";

const MODULE_ID = "shadowrun-edge";
const L = (key, data) => (data ? game.i18n.format(key, data) : game.i18n.localize(key));
const esc = (s) => foundry.utils.escapeHTML(String(s ?? ""));
const num = (v, d = 0) => (Number.isFinite(Number(v)) ? Number(v) : d);
const metersPerPixel = () => canvas.dimensions.distance / canvas.dimensions.size;
const COLORS = { gas: ["#7fbf3f", "#9fcf6f", "#bfdf9f", "#dfefcf"], smoke: ["#777777", "#999999", "#bbbbbb", "#dddddd"] };

// ───── Gas clouds ─────

const clouds = (scene) => [...(scene?.getFlag(MODULE_ID, "gasClouds") ?? [])];
const saveClouds = (scene, list) => scene.setFlag(MODULE_ID, "gasClouds", list);

/** Breathing protection: a gas mask (or chemical seal) the character has. */
function protectedFrom(actor) {
  return actor?.items?.some((i) => i.type === "gear" && /gas mask|maska gazowa|chemical seal|chemiczn/i.test(i.name));
}

/** A new cloud where the grenade landed (GM or the attacker; the scene flag needs the GM, so ask when not GM). */
export async function createCloud({ point, gas, item, source, scatter }) {
  const scene = canvas.scene;
  const range = Math.max(1, num(gas.range, G.DEFAULT_GAS_RANGE));
  const kind = gas.smoke ? "smoke" : "gas";
  let templates = [];
  try {
    const created = await scene.createEmbeddedDocuments("MeasuredTemplate", [3, 2, 1, 0].map((z) => ({
      t: "circle", x: point.x, y: point.y, distance: range * (z + 1), fillColor: COLORS[kind][z], borderColor: COLORS[kind][0],
      flags: { [MODULE_ID]: { gas: true, zone: z } },
    })));
    templates = created.map((t) => t.id);
  } catch (err) {
    console.warn(`${MODULE_ID} | gas template`, err);
  }
  const cloud = {
    id: foundry.utils.randomID(), x: point.x, y: point.y, range, kind, substance: gas.smoke ? null : gas.substance,
    condition: gas.condition ?? "open", round: 0, item, source: source?.uuid ?? null, templates, exposed: {},
    // Rounds follow the combat tracker: the cloud remembers the combat and the round it landed in.
    combat: game.combat?.started ? game.combat.id : null, startRound: game.combat?.started ? game.combat.round : null,
  };
  await ChatMessage.create({
    speaker: source ? ChatMessage.getSpeaker({ actor: source }) : ChatMessage.getSpeaker(),
    content: `<div class="sre-blast-card"><h3>${esc(item)}</h3>
      <p>${L("SRE.Blast.CardScatter", { roll: scatter.roll, meters: scatter.meters, dir: scatter.dir })}</p>
      <p>${L(`SRE.Gas.Released.${kind}`, { range, r2: range * 2, r3: range * 3, r4: range * 4, condition: L(`SRE.Gas.Conditions.${cloud.condition}`) })}</p></div>`,
  });
  if (!game.user.isGM) {
    game.socket.emit(`module.${MODULE_ID}`, { type: "gasCloud", sceneId: scene.id, cloud });
    return;
  }
  await saveClouds(scene, [...clouds(scene), cloud]);
  return advanceCloud(scene, cloud.id);
}

/** One more round for a cloud (or straight to `toRound`): levels per zone, exposures, the cloud gone when over (GM). */
export async function advanceCloud(scene, id, toRound = null) {
  if (!game.user.isGM) return;
  const list = clouds(scene);
  const cloud = list.find((c) => c.id === id);
  if (!cloud) return;
  cloud.round = toRound ?? cloud.round + 1;
  if (G.cloudOver(cloud.round, cloud.condition)) return removeCloud(scene, id, true);
  const def = cloud.substance ? substance(cloud.substance) : null;
  const source = cloud.source ? await fromUuid(cloud.source) : null;
  const mpp = canvas.scene?.id === scene.id ? metersPerPixel() : scene.dimensions.distance / scene.dimensions.size;
  const lines = [];
  for (const token of scene.tokens) {
    const actor = token.actor;
    if (!actor) continue;
    const c = token.object?.center ?? { x: token.x + (token.width * scene.dimensions.size) / 2, y: token.y + (token.height * scene.dimensions.size) / 2 };
    const zone = G.gasZone(Math.hypot(c.x - cloud.x, c.y - cloud.y) * mpp, cloud.range);
    if (zone === null) continue;
    const level = G.gasLevel(zone, cloud.round, cloud.condition);
    if (level === "none") continue;
    const power = def ? G.gasPower(def.power, level) : 0;
    let note = L(`SRE.Gas.Level.${level}`);
    if (def && protectedFrom(actor)) note += ` — ${L("SRE.Gas.Mask")}`;
    else if (def && power > 0 && power > num(cloud.exposed[token.uuid])) {
      cloud.exposed[token.uuid] = power;
      await exposure(source, actor, def, { doses: 1, vector: "inhalation", power });
      note += ` — ${L("SRE.Gas.Exposed", { power })}`;
    }
    lines.push(`<li><b>${esc(token.name)}</b>: ${L("SRE.Gas.ZoneName", { n: zone + 1 })}, ${note}</li>`);
  }
  // Zones the gas no longer reaches leave the map.
  const gone = [];
  for (const tid of cloud.templates) {
    const t = scene.templates.get(tid);
    const zone = t?.getFlag(MODULE_ID, "zone");
    if (t && zone !== undefined && G.gasLevel(zone, cloud.round, cloud.condition) === "none") gone.push(tid);
  }
  if (gone.length) {
    await scene.deleteEmbeddedDocuments("MeasuredTemplate", gone);
    cloud.templates = cloud.templates.filter((t) => !gone.includes(t));
  }
  await saveClouds(scene, list);
  return ChatMessage.create({
    whisper: ChatMessage.getWhisperRecipients("GM").map((u) => u.id),
    content: `<div class="sre-blast-card"><h3>${esc(cloud.item)} — ${L("SRE.Gas.Round", { n: cloud.round })}</h3>
      <p class="hint">${zoneSummary(cloud)}</p>
      ${lines.length ? `<ul class="sre-blast-list">${lines.join("")}</ul>` : `<p>${L("SRE.Gas.NoOne")}</p>`}</div>`,
    flags: { [MODULE_ID]: { gasCard: { scene: scene.id, cloud: cloud.id } } },
  });
}

/** "Range: full · × 2: half …" for the current round. */
function zoneSummary(cloud) {
  return [0, 1, 2, 3].map((z) => `${z ? `× ${z + 1}` : L("SRE.Gas.Range")} (${cloud.range * (z + 1)} m): ${L(`SRE.Gas.Level.${G.gasLevel(z, cloud.round, cloud.condition)}`)}`).join(" · ");
}

export async function removeCloud(scene, id, ended = false) {
  const list = clouds(scene);
  const cloud = list.find((c) => c.id === id);
  if (!cloud) return;
  const existing = cloud.templates.filter((t) => scene.templates.get(t));
  if (existing.length) await scene.deleteEmbeddedDocuments("MeasuredTemplate", existing);
  await saveClouds(scene, list.filter((c) => c.id !== id));
  if (ended) await ChatMessage.create({ whisper: ChatMessage.getWhisperRecipients("GM").map((u) => u.id), content: `<p class="sre-blast-result">${L("SRE.Gas.Gone", { item: esc(cloud.item) })}</p>` });
}

/** The GM's buttons on the round card: next round (outside combat) and remove the cloud. */
Hooks.on("renderChatMessageHTML", (message, html) => {
  const data = message.getFlag(MODULE_ID, "gasCard");
  if (!data || !game.user.isGM) return;
  const root = html instanceof HTMLElement ? html : html?.[0];
  const card = root?.querySelector(".sre-blast-card");
  if (!card || card.querySelector(".sre-gas-actions")) return;
  const scene = game.scenes.get(data.scene);
  if (!clouds(scene).some((c) => c.id === data.cloud)) return;
  const box = document.createElement("p");
  box.className = "sre-gas-actions";
  box.innerHTML = `${game.combat?.started ? "" : `<button type="button" data-next>${L("SRE.Gas.Next")}</button> <small class="sre-task-dim">${L("SRE.Gas.NoCombat")}</small><br>`}<button type="button" data-remove>${L("SRE.Gas.Remove")}</button>`;
  card.append(box);
  box.querySelector("[data-next]")?.addEventListener("click", () => advanceCloud(scene, data.cloud));
  box.querySelector("[data-remove]")?.addEventListener("click", () => removeCloud(scene, data.cloud));
});

/**
 * The combat tracker drives the clouds: the cloud's round is the combat's round counted from the one it landed in.
 * A cloud thrown outside combat joins the first combat that starts, from the round it reached.
 */
Hooks.on("updateCombat", async (combat, changed) => {
  if (!game.users.activeGM?.isSelf || !("round" in changed) || !combat.started) return;
  const scene = combat.scene ?? canvas.scene;
  if (!scene) return;
  let list = clouds(scene);
  let linked = false;
  for (const cloud of list) {
    if (cloud.combat && cloud.combat !== combat.id) continue;
    if (!cloud.combat) {
      cloud.combat = combat.id;
      cloud.startRound = combat.round - cloud.round;
      linked = true;
    }
  }
  if (linked) await saveClouds(scene, list);
  for (const cloud of clouds(scene).filter((c) => c.combat === combat.id)) {
    const target = G.cloudRound(combat.round, cloud.startRound);
    if (target > cloud.round) await advanceCloud(scene, cloud.id, target);
  }
});

Hooks.once("ready", () => {
  game.socket.on(`module.${MODULE_ID}`, async (data) => {
    if (data?.type !== "gasCloud" || !game.users.activeGM?.isSelf) return;
    const scene = game.scenes.get(data.sceneId);
    if (!scene || !data.cloud?.id) return;
    await saveClouds(scene, [...clouds(scene), data.cloud]);
    await advanceCloud(scene, data.cloud.id);
  });
});

// ───── Spray attacks (p. 117) ─────

const targeted = () => [...(game.user.targets ?? [])].filter((t) => t.actor);
const defenseRating = (actor) => num(actor?.system?.defenserating?.physical?.pool) || num(actor?.system?.bod) + num(actor?.system?.arm);

export async function openSpray(actor, item) {
  const targets = targeted();
  const from = actor.getActiveTokens?.()[0]?.center;
  const far = targets.length && from && canvas?.ready
    ? Math.max(...targets.map((t) => Math.hypot(t.center.x - from.x, t.center.y - from.y) * metersPerPixel())) : 0;
  const range = rangeCategory(far);
  const baseAR = num(item.system?.attackRating?.[RANGES.indexOf(range)]);
  const baseDV = num(item.system?.dmg);
  const stun = !!item.system?.stun;
  const pool = num(item.system?.pool);
  const drs = targets.map((t) => defenseRating(t.actor));
  const result = ui2.okOnly(await foundry.applications.api.DialogV2.wait({
    classes: ["sre-dialog"],
    window: { title: `${L("SRE.Spray.Title")} — ${item.name}`, icon: "fas fa-spray-can" },
    position: { width: 460 },
    content: `<div class="sre-ed">${ui2.head({ kind: L("SRE.Spray.Kind"), name: item.name, sub: targets.length ? targets.map((t) => t.name).join(", ") : L("SRE.Spray.NoTargets") })}
      <div class="sre-ed-body">
        ${ui2.tiles([
          { id: "ar", big: baseAR, label: "AR", calc: L(`SRE.Blast.Range.${range}`), accent: true },
          { id: "dv", big: `${baseDV}${stun ? "S" : "P"}`, label: "DV", calc: "" },
        ])}
        ${ui2.panel(L("SRE.Spray.Style"), ui2.options("style", Object.entries(G.SPRAY_STYLES).map(([id, st], i) => ({
          value: id, label: L(`SRE.Spray.Styles.${id}`), small: st.width ? L("SRE.Spray.StyleHint", { w: st.width, ar: st.ar, dv: st.dv }) : L("SRE.Spray.Straight"), checked: i === 0,
        }))))}
        ${ui2.panel(L("SRE.Spray.Options"), ui2.chips([ui2.chip("fast", L("SRE.Spray.Fast"))]))}
        ${ui2.note("", "info", { id: "edge" })}
      </div></div>`,
    render: (event, dialog) => ui2.wire(dialog, (f) => {
      const st = G.SPRAY_STYLES[f.elements.style.value];
      const ar = baseAR + st.ar;
      ui2.setTile(f, "ar", { big: ar });
      ui2.setTile(f, "dv", { big: `${Math.max(0, baseDV + st.dv)}${stun ? "S" : "P"}` });
      const fast = f.querySelector("input[name='fast']");
      if (fast) {
        fast.disabled = !G.fastStreamAllowed(f.elements.style.value);
        if (fast.disabled) fast.checked = false;
      }
      const edge = areaEdge(baseAR ? ar : null, drs);
      ui2.setNote(f, "edge", edge.highest !== null ? L(edge.gain ? "SRE.Blast.EdgeYes" : "SRE.Blast.EdgeNo", { ar, dr: edge.highest }) : L("SRE.Spray.TargetHint"));
      ui2.setMainLabel(dialog, L("SRE.Spray.Roll", { n: pool }));
    }),
    buttons: ui2.buttons(L("SRE.Spray.RollShort"), (event, button) => ({ style: button.form.elements.style.value, fast: !!button.form.elements.fast?.checked }), { icon: "fas fa-spray-can" }),
    rejectClose: false,
  }));
  if (!result) return;
  const st = G.SPRAY_STYLES[result.style];
  const ar = baseAR + st.ar;
  const edge = areaEdge(baseAR ? ar : null, drs);
  if (edge.gain) {
    const now = num(actor.system.edge?.value);
    if (now < Math.min(7, num(actor.system.edge?.max, 7))) await actor.update({ "system.edge.value": now + 1 });
  }
  return runTest(actor, {
    pool, label: `${L("SRE.Spray.Title")}: ${item.name} (${L(`SRE.Spray.Styles.${result.style}`)})`, wildDie: result.fast ? 1 : 0,
    task: {
      kind: "spray", item: item.name, style: result.style, fast: result.fast, ar, dv: baseDV, stun,
      targets: targets.map((t) => ({ token: t.document.uuid, name: t.name, def: null })),
    },
  });
}

registerTask("spray", {
  render(task, hits, message) {
    const edit = message.isOwner || game.user.isGM;
    const rows = task.targets.map((t, i) => {
      if (t.def === null || t.def === undefined) {
        return `<li><b>${esc(t.name)}</b>: ${edit ? `${L("SRE.Matrix.DefenderHits")} <input type="number" min="0" data-def="${i}" value="0"> <button type="button" data-set="${i}">${L("SRE.Matrix.Set")}</button>` : L("SRE.Matrix.WaitDefense")}</li>`;
      }
      const net = hits - num(t.def);
      if (net <= 0) return `<li><b>${esc(t.name)}</b>: ${L("SRE.Spray.Miss", { def: t.def })}</li>`;
      const dv = G.sprayDamage(task.dv, task.style, net);
      const what = task.dv > 0 ? `<b>${dv}${task.stun ? "S" : "P"}</b> <button type="button" data-soak="${i}" data-dv="${dv}">${L("SRE.Blast.Soak")}</button>` : L("SRE.Spray.Delivered");
      return `<li><b>${esc(t.name)}</b>: ${L("SRE.Spray.Hit", { def: t.def, net })} — ${what}</li>`;
    }).join("");
    return `<p>${L("SRE.Spray.Summary", { style: L(`SRE.Spray.Styles.${task.style}`), ar: task.ar, fast: task.fast ? L("SRE.Spray.FastOn") : "" })}</p>
      ${rows ? `<ul class="sre-blast-list">${rows}</ul>` : `<p>${L("SRE.Spray.NoTargets")}</p>`}`;
  },
  bind(root, message, task) {
    for (const b of root.querySelectorAll("[data-set]")) {
      b.addEventListener("click", () => {
        const i = Number(b.dataset.set);
        const targets = task.targets.map((t, j) => (j === i ? { ...t, def: num(root.querySelector(`[data-def="${i}"]`)?.value) } : t));
        return message.setFlag(MODULE_ID, "task", { ...task, targets });
      });
    }
    for (const b of root.querySelectorAll("[data-soak]")) {
      b.addEventListener("click", async () => {
        const t = task.targets[Number(b.dataset.soak)];
        const actor = (await fromUuid(t.token))?.actor;
        if (!actor?.isOwner) return ui.notifications.warn(L("SRE.Blast.NotOwner"));
        const vehicle = actor.type === "Vehicle";
        const body = num(actor.system.attributes?.bod?.pool ?? actor.system.bod);
        const pool = vehicle ? body * 2 : num(actor.system.defensepool?.damage_physical?.pool) || body;
        const stun = task.stun && !vehicle;
        return rolls.rollSoakTest(actor, { soakType: stun ? "damage_stun" : "damage_phys", damage: num(b.dataset.dv), monitor: stun ? "stun" : "physical", pool,
          label: L("SRE.Blast.SoakLabel", { item: task.item, dv: b.dataset.dv, type: stun ? "S" : "P" }) });
      });
    }
  },
});

// ───── Building a Bigger Boom (p. 117) ─────

export async function openPlant(actor, item) {
  const kind = G.isPackage(item) ? "package" : "grenade";
  const blast = kind === "grenade" ? itemBlast(item) : null;
  if (kind === "grenade" && !blast) return ui.notifications.warn(L("SRE.Blast.NoBlastData", { name: item.name }));
  const rating = num(item.system?.rating);
  const s = actor.system;
  const pool = num(s.skills?.engineering?.points) + num(s.skills?.engineering?.modifier) + num(s.attributes?.log?.pool);
  const result = ui2.okOnly(await foundry.applications.api.DialogV2.wait({
    classes: ["sre-dialog"],
    window: { title: `${L("SRE.Demo.Title")} — ${item.name}`, icon: "fas fa-bomb" },
    position: { width: 440 },
    content: `<div class="sre-ed">${ui2.head({ kind: L("SRE.Demo.Kind"), name: item.name, sub: L("SRE.Demo.Sub", { pool }) })}
      <div class="sre-ed-body">
        ${ui2.panel(L("SRE.Demo.Against"), ui2.options("target", [
          { value: "personnel", label: L("SRE.Demo.Personnel"), small: L(`SRE.Demo.Hint.${kind}.personnel`), checked: true },
          { value: "structure", label: L("SRE.Demo.Structure"), small: L(`SRE.Demo.Hint.${kind}.structure`) },
        ]))}
        ${ui2.row(L("SRE.Heal.ManualHits"), `<input type="number" name="manualHits" min="0" placeholder="—">`)}
      </div></div>`,
    render: (event, dialog) => ui2.wire(dialog),
    buttons: ui2.buttons(L("SRE.Demo.Roll", { n: pool }), (event, button) => ({
      target: button.form.elements.target.value, manualHits: button.form.elements.manualHits.value === "" ? null : Number(button.form.elements.manualHits.value),
    }), { icon: "fas fa-screwdriver-wrench" }),
    rejectClose: false,
  }));
  if (!result) return;
  const threshold = kind === "package" && result.target === "structure" ? 0 : 2;
  return runTest(actor, {
    pool, label: L("SRE.Demo.TestLabel", { name: item.name }), threshold, manualHits: result.manualHits,
    task: { kind: "demolition", actor: actor.uuid, item: item.id, name: item.name, charge: kind, target: result.target, blast, rating, split: { gz: 0, close: 0, near: 0 } },
  });
}

/** The planted charge's DV after the test (scripts/gas-rules.mjs demolition). */
function chargeOf(task, hits) {
  const out = G.demolition({ kind: task.charge, target: task.target, hits, blast: task.blast, rating: task.rating });
  if (task.charge === "grenade" && task.target === "personnel") return { ...out, blast: G.spreadBonus(task.blast, out.bonus, task.split) };
  if (task.charge === "package" && task.target === "personnel") return out;
  return out;
}

registerTask("demolition", {
  render(task, hits, message) {
    const out = chargeOf(task, hits);
    const edit = message.isOwner || game.user.isGM;
    let text;
    if (out.structureDV !== undefined) text = L("SRE.Demo.StructureDV", { dv: out.structureDV });
    else if (out.structureRating !== undefined) text = L("SRE.Demo.StructureRating", { rating: out.structureRating });
    else text = L("SRE.Demo.PersonnelResult", { gz: out.blast.gz, close: out.blast.close, near: out.blast.near, radius: out.blast.radius });
    const split = task.charge === "grenade" && task.target === "personnel" && out.bonus > 0 && edit && !task.applied
      ? `<p>${L("SRE.Demo.Split", { n: out.bonus })} GZ <input type="number" min="0" data-split="gz" value="${num(task.split.gz)}">
         ${L("SRE.Blast.Zone.close")} <input type="number" min="0" data-split="close" value="${num(task.split.close)}">
         ${L("SRE.Blast.Zone.near")} <input type="number" min="0" data-split="near" value="${num(task.split.near)}"></p>` : "";
    const canBlow = !!out.blast && edit;
    return `<p><b>${esc(text)}</b></p>${split}
      ${canBlow ? `<p><button type="button" data-detonate>${L("SRE.Demo.Detonate")}</button></p>` : `<p class="sre-task-dim">${L("SRE.Demo.StructureNote")}</p>`}`;
  },
  bind(root, message, task, hits) {
    for (const input of root.querySelectorAll("[data-split]")) {
      input.addEventListener("change", () => message.setFlag(MODULE_ID, "task", { ...task, split: { ...task.split, [input.dataset.split]: num(input.value) } }));
    }
    root.querySelector("[data-detonate]")?.addEventListener("click", async () => {
      const actor = await fromUuid(task.actor);
      if (!actor) return;
      await patchTask(message, { applied: true });
      return detonate(actor, { name: task.name, blast: chargeOf(task, hits).blast });
    });
  },
});

/** Commercial explosives as a blast (p. 117), for lists that show them. */
export const packageBlast = (item) => explosiveBlast(num(item.system?.rating));
