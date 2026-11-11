/**
 * Stage 14: the Matrix terminal. One window shows whatever node the persona is connected to: first the device's
 * ordinary screen (its "surface": a lift panel, a keypad, a kiosk…), and once access is gained the screen glitches
 * and breaks into the Matrix layer under it: security, controls, files, links to other nodes, a map of what the
 * persona has found, a log and a command line. Nothing here is a new rule: tests are the module's Matrix actions
 * (openMatrixAction: access, Overwatch, IC), rolled with the Edge engine; the terminal is a way to play them.
 *
 * Networks are world data the GM builds in the network editor (scripts/matrix-net-editor.mjs, rules in
 * matrix-net-rules.mjs). Access is the persona's target record for the network; what the persona has discovered is
 * the actor flag `netKnown`. Effects on the scene (doors, statuses, messages) are run by the active GM.
 */
import * as N from "./matrix-net-rules.mjs";
import { openMatrixAction, targetsOf, getOS, osVisible } from "./matrix.mjs";
import { CONVERGENCE } from "./matrix-rules.mjs";
import { matrixActionPool } from "./sheet/context.mjs";
import { canBreakRules } from "./ui/conflict.mjs";

const MODULE_ID = "shadowrun-edge";
const SOCKET = `module.${MODULE_ID}`;
const L = (key, data) => (data ? game.i18n.format(key, data) : game.i18n.localize(key));
const esc = (s) => foundry.utils.escapeHTML(String(s ?? ""));
const num = (v, d = 0) => (Number.isFinite(Number(v)) && v !== "" && v !== null ? Number(v) : d);

// ───── World data ─────

Hooks.once("init", () => {
  game.settings.register(MODULE_ID, "matrixNetworks", { scope: "world", config: false, type: Object, default: {}, onChange: () => refreshAll() });
  game.settings.register(MODULE_ID, "terminalCommands", {
    name: "SRE.Net.Setting.Commands.Name", hint: "SRE.Net.Setting.Commands.Hint", scope: "client", config: true, type: String,
    choices: { both: "SRE.Net.Setting.Commands.both", buttons: "SRE.Net.Setting.Commands.buttons", typed: "SRE.Net.Setting.Commands.typed" }, default: "both",
  });
});

export function networks() {
  try {
    return foundry.utils.deepClone(game.settings.get(MODULE_ID, "matrixNetworks") ?? {});
  } catch {
    return {};
  }
}
export const network = (id) => networks()[id] ?? null;
export async function saveNetwork(net) {
  const all = networks();
  all[net.id] = N.tidy(net);
  return game.settings.set(MODULE_ID, "matrixNetworks", all);
}
export async function deleteNetwork(id) {
  const all = networks();
  delete all[id];
  return game.settings.set(MODULE_ID, "matrixNetworks", all);
}

const knownOf = (actor, netId) => [...(actor.getFlag(MODULE_ID, "netKnown")?.[netId] ?? [])];
async function learn(actor, netId, ids) {
  const have = new Set(knownOf(actor, netId));
  const add = ids.filter((i) => !have.has(i));
  if (!add.length) return [];
  const all = { ...(actor.getFlag(MODULE_ID, "netKnown") ?? {}), [netId]: [...have, ...add] };
  if (actor.isOwner) await actor.setFlag(MODULE_ID, "netKnown", all);
  return add;
}

/**
 * The GM hid a node or a link again: every persona that had found it forgets it (world actors and unlinked tokens on
 * the scenes). GM only; the open terminals re-render through updateActor.
 */
export async function forgetEverywhere(netId, ids) {
  if (!game.user.isGM || !ids?.length) return;
  const actors = new Set(game.actors ?? []);
  for (const scene of game.scenes ?? []) for (const t of scene.tokens ?? []) if (!t.actorLink && t.actor) actors.add(t.actor);
  for (const actor of actors) {
    const known = actor.getFlag?.(MODULE_ID, "netKnown")?.[netId];
    if (!known?.length) continue;
    const left = N.forget(known, ids);
    if (left.length !== known.length) await actor.setFlag(MODULE_ID, "netKnown", { ...actor.getFlag(MODULE_ID, "netKnown"), [netId]: left });
  }
}

// ───── Effects on the scene: run by the active GM ─────

/** A terminal operation that changes the world: a node's control, or revealing hidden nodes. */
export async function runTerminalOp(op) {
  if (game.user.isGM) return gmRun(op);
  if (!game.users.activeGM) return ui.notifications.warn(L("SRE.Net.NoGM"));
  game.socket.emit(SOCKET, { type: "sre-net", op });
}

async function gmRun(op) {
  const net = network(op.net);
  const node = net?.nodes?.[op.node];
  const actor = op.actor ? await fromUuid(op.actor) : null;
  if (!net || !node) return;
  if (op.op === "reveal") {
    if (!actor) return;
    const ids = N.reveal(net, node.id, knownOf(actor, net.id));
    const all = { ...(actor.getFlag(MODULE_ID, "netKnown") ?? {}), [net.id]: [...knownOf(actor, net.id), ...ids] };
    await actor.setFlag(MODULE_ID, "netKnown", all);
    const label = (k) => (k.startsWith("~") ? k.slice(1).split("|").map((i) => net.nodes[i]?.name ?? "?").join(" ↔ ") : net.nodes[k]?.name ?? "?");
    return note(actor, ids.length ? L("SRE.Net.Revealed", { list: ids.map(label).join(", ") }) : L("SRE.Net.NothingHidden"));
  }
  const control = node.controls?.find((c) => c.id === op.control);
  if (!control) return;
  const fx = control.effect ?? {};
  let result = "";
  if (fx.type === "door" && fx.wall) {
    const wall = canvas?.scene?.walls?.get(fx.wall) ?? game.scenes.map((s) => s.walls.get(fx.wall)).find(Boolean);
    if (wall) {
      const S = CONST.WALL_DOOR_STATES;
      const next = { open: S.OPEN, close: S.CLOSED, lock: S.LOCKED, unlock: S.CLOSED, toggle: wall.ds === S.OPEN ? S.CLOSED : S.OPEN }[fx.action] ?? S.OPEN;
      await wall.update({ ds: next });
      result = L(`SRE.Net.Door.${fx.action ?? "open"}`);
    } else result = L("SRE.Net.NoWall");
  } else if (fx.type === "status" && fx.token && fx.status) {
    const token = await fromUuid(fx.token).catch(() => null);
    await token?.actor?.toggleStatusEffect(fx.status);
    result = token ? `${token.name}: ${fx.status}` : "";
  } else if (fx.type === "message") result = fx.text ?? "";
  return note(actor, `${node.name} · ${control.label}${result ? ` — ${result}` : ""}`, fx.type === "none");
}

function note(actor, text, gmOnly = false) {
  return ChatMessage.create({
    speaker: actor ? ChatMessage.getSpeaker({ actor }) : undefined,
    whisper: gmOnly ? ChatMessage.getWhisperRecipients("GM").map((u) => u.id) : undefined,
    content: `<div class="sre-rc"><div class="sre-rc-edge"><i class="fas fa-network-wired"></i> ${esc(text)}</div></div>`,
    flags: { [MODULE_ID]: { netNote: { actor: actor?.uuid ?? null, text } } },
  });
}

Hooks.once("ready", () => {
  game.socket.on(SOCKET, async (data, senderId) => {
    if (data?.type !== "sre-net" || !game.users.activeGM?.isSelf) return;
    const user = game.users.get(senderId);
    const actor = data.op?.actor ? await fromUuid(data.op.actor) : null;
    // Only for a persona the sender owns.
    if (!user || !actor?.testUserPermission(user, "OWNER")) return;
    await gmRun(data.op);
  });
});

// ───── The window ─────

const { ApplicationV2 } = foundry.applications.api;
const open = new Map(); // actor uuid → terminal
function refreshAll() {
  for (const t of open.values()) t.render();
  Hooks.callAll("sre.networksChanged");
}

const QUICK = ["brute_force", "probe", "backdoor_entry", "matrix_perception", "data_spike", "hide", "check_overwatch_score", "jack_out"];

export class MatrixTerminal extends ApplicationV2 {
  static DEFAULT_OPTIONS = {
    classes: ["sre-terminal"],
    position: { width: 1040, height: 680 },
    window: { resizable: true, icon: "fas fa-terminal" },
  };

  constructor(actor, netId, nodeId, options = {}) {
    super({ id: `sre-terminal-${actor.id}`, ...options });
    this.actor = actor;
    this.netId = netId;
    this.nodeId = nodeId;
    this.log = [];
    this.entered = new Set(); // node ids whose Matrix layer was already shown (the glitch plays once)
    this.booted = false;
  }

  get title() {
    return `${L("SRE.Net.Terminal")} — ${this.actor.name}`;
  }

  get net() {
    return network(this.netId);
  }

  say(text, cls = "") {
    const t = new Date();
    this.log.push({ time: `${String(t.getHours()).padStart(2, "0")}:${String(t.getMinutes()).padStart(2, "0")}:${String(t.getSeconds()).padStart(2, "0")}`, text, cls });
    if (this.log.length > 200) this.log.shift();
  }

  async connect(nodeId, { quiet = false } = {}) {
    const net = this.net;
    const node = net?.nodes?.[nodeId];
    if (!node) return;
    this.nodeId = nodeId;
    await learn(this.actor, net.id, [nodeId]);
    if (!quiet) this.say(`connect ${node.name}`, "cmd");
    this.say(L("SRE.Net.Connected", { name: node.name, level: L(`SRE.Matrix.Access.${this.access(node).access}`) }), "dim");
    this.render();
  }

  access(node) {
    return N.accessOn(this.net, node, targetsOf(this.actor));
  }

  mode() {
    const m = this.actor.system?.matrixIni ?? "ar";
    return m === "vrhot" ? "hot" : m === "vrcold" ? "cold" : "ar";
  }

  // ── Rendering ──

  async _renderHTML() {
    const net = this.net;
    const node = net?.nodes?.[this.nodeId];
    if (!net || !node) return `<div class="sre-term-empty">${esc(L("SRE.Net.Gone"))}</div>`;
    const acc = this.access(node);
    const inside = N.rank(acc.access) > 0;
    const glitch = inside && !this.entered.has(node.id);
    if (inside) this.entered.add(node.id);
    const known = knownOf(this.actor, net.id);
    const map = N.visibleMap(net, known.includes(node.id) ? known : [...known, node.id], node.id);
    const s = this.actor.system ?? {};
    const used = s.persona?.used ?? {};
    const os = getOS(this.actor);
    const showOs = osVisible();
    const edge = s.edge ?? {};
    const mode = this.mode();
    const commands = (() => {
      try {
        return game.settings.get(MODULE_ID, "terminalCommands");
      } catch {
        return "both";
      }
    })();

    const header = `<header class="sre-term-head">
      <i class="fas ${mode === "hot" ? "fa-bolt" : "fa-terminal"}"></i>
      <div><small>${esc(L(inside ? "SRE.Net.LayerMatrix" : "SRE.Net.LayerSurface"))}</small><b>${esc(node.name)}</b></div>
      <span class="sre-term-badge mode">${esc(L(`SRE.Net.Mode.${mode}`))}</span>
      <span class="sre-term-dim">${esc(net.name)} · ${esc(L("SRE.Matrix.Rating"))} ${node.own ? num(node.rating, 1) : num(net.rating, 1)}</span>
      <span class="sre-term-badge acc ${acc.access}">${esc(L("SRE.Net.YourAccess", { level: L(`SRE.Matrix.Access.${acc.access}`) }))}</span>
    </header>`;

    const left = `<aside class="sre-term-left">
      <section><h4>${esc(L("SRE.Matrix.Persona"))}</h4><div class="sre-term-asdf">${["a", "s", "d", "f"].map((k) => `<div data-tooltip="${esc(L(`SRE.Sheet.Asdf.${k}`))}"><small>${esc(L(`SRE.Sheet.Asdf.${k}`))}</small><b>${num(used[k])}</b></div>`).join("")}</div></section>
      <section><h4>Edge</h4><div class="sre-term-pips">${Array.from({ length: Math.max(num(edge.max), num(edge.value)) }, (_, i) => `<i class="${i < num(edge.value) ? "on" : ""}"></i>`).join("")}</div></section>
      <section class="trace"><h4>${esc(L("SRE.Net.Trace"))}</h4>${showOs
        ? `<div class="sre-term-bar ${os >= 30 ? "hot" : ""}"><i style="width:${Math.min(100, Math.round((os / CONVERGENCE) * 100))}%"></i></div><small>OS ${os} / ${CONVERGENCE}</small>`
        : `<small>${esc(L("SRE.Net.TraceHidden"))}</small>`}</section>
      <section class="grow"><h4>${esc(L("SRE.Net.Map"))}</h4>${this.#mapHtml(map)}</section>
    </aside>`;

    const center = `<main class="sre-term-center${glitch ? " sre-term-glitching" : ""}" data-mode="${mode}">
      ${inside ? this.#layerHtml(net, node, acc) : this.#surfaceHtml(net, node, acc)}
      ${glitch ? `<div class="sre-term-glitch" aria-hidden="true">${this.#surfaceHtml(net, node, acc, true)}<div class="noise">${"▓▒░ 0x7F #@&% ░▒▓ ACCESS 1101 ▓▒░ 0xA3 ▒▓░▒ OVERRIDE %#@& 0110 ".repeat(14)}</div></div>` : ""}
    </main>`;

    const quick = QUICK.filter((id) => CONFIG.SR6?.MATRIX_ACTIONS?.[id]).map((id) => {
      const a = CONFIG.SR6.MATRIX_ACTIONS[id];
      const pool = a.skill ? matrixActionPool(a, s) : null;
      return `<button type="button" data-term-action="${id}">${esc(L(`shadowrun6.matrixaction.${id}.name`))}${pool !== null ? ` <span>${pool}</span>` : ""}</button>`;
    }).join("");
    const right = `<aside class="sre-term-right">
      <div class="sre-term-log" data-log>${this.log.map((l) => `<div class="${l.cls}"><span>${l.time}</span> ${l.cls === "cmd" ? `<b>${esc(this.#prompt())}</b> ` : ""}${esc(l.text)}</div>`).join("")}<div class="caret">▌</div></div>
      ${commands !== "buttons" ? `<label class="sre-term-cmd"><span>${esc(this.#prompt())}</span><input type="text" data-cmd autocomplete="off" spellcheck="false" placeholder="help"></label>` : ""}
      ${commands !== "typed" ? `<div class="sre-term-quick">${quick}</div>` : ""}
    </aside>`;

    return `<div class="sre-term" data-mode="${mode}">${header}<div class="sre-term-body">${left}${center}${right}</div></div>`;
  }

  #prompt() {
    return `${String(this.actor.name).split(/\s+/)[0].toLowerCase()}$`;
  }

  #mapHtml(map) {
    const all = [...map.nodes, ...map.stubs];
    if (!all.length) return "";
    const xs = all.map((n) => n.x);
    const ys = all.map((n) => n.y);
    const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
    // One coordinate system for lines and labels: x in % of the map's width, y in px. (A stretched viewBox let lines
    // drift away from the labels, so a line could seem to join nodes it does not.)
    const H = 190;
    const r = (v) => Math.round(v * 10) / 10;
    const px = (x) => r(14 + ((x - x0) / Math.max(1, x1 - x0)) * 72);
    const py = (y) => r(16 + ((y - y0) / Math.max(1, y1 - y0)) * (H - 36));
    const at = Object.fromEntries(map.nodes.map((n) => [n.id, n]));
    const line = (a, b, cls = "") => `<line${cls ? ` class="${cls}"` : ""} x1="${px(a.x)}%" y1="${py(a.y)}" x2="${px(b.x)}%" y2="${py(b.y)}"/>`;
    const lines = map.links.map((l) => line(at[l.a], at[l.b])).join("") + map.stubs.map((st) => line(at[st.from], st, "stub")).join("");
    const nodes = map.nodes.map((n) => `<button type="button" class="${n.kind}${n.current ? " current" : ""}" style="left:${px(n.x)}%;top:${py(n.y)}px" data-term-connect="${esc(n.id)}" data-tooltip="${esc(n.name)}">${esc(n.name)}</button>`).join("")
      + map.stubs.map((st) => `<span class="stub" style="left:${px(st.x)}%;top:${py(st.y)}px">?</span>`).join("");
    return `<div class="sre-term-map" style="height:${H}px"><svg width="100%" height="${H}" aria-hidden="true">${lines}</svg>${nodes}</div><small>${esc(L("SRE.Net.MapHint"))}</small>`;
  }

  /** The device's ordinary screen: what any user sees. Controls without an access level work from here. */
  #surfaceHtml(net, node, acc, ghost = false) {
    const { open: free, locked } = N.surfaceControls(node);
    const kind = N.SURFACES.includes(node.surface) ? node.surface : "kiosk";
    const title = node.title || node.name;
    const btn = (c, off) => `<button type="button" ${off || ghost ? "disabled" : `data-term-control="${esc(c.id)}"`} class="${off ? "locked" : ""}">${esc(c.label)}${off ? ` <small>${esc(L("SRE.Net.Locked"))}</small>` : ""}</button>`;
    const body = {
      camera: `<div class="feed">${node.img ? `<img src="${esc(node.img)}" alt="">` : `<span>${esc(L("SRE.Net.NoSignal"))}</span>`}<em>REC ●</em></div>`,
      image: node.img ? `<img class="full" src="${esc(node.img)}" alt="">` : "",
      computer: `<div class="login"><span>${esc(L("SRE.Net.Login"))}</span><input type="text" disabled placeholder="user"><input type="password" disabled placeholder="••••••"></div>`,
    }[kind] ?? "";
    const hack = ghost ? "" : `<footer class="sre-term-hack">
      <span>${esc(L("SRE.Net.SurfaceHint"))}</span>
      ${["brute_force", "probe", acc.record?.backdoor ? "backdoor_entry" : null].filter((id) => id && CONFIG.SR6?.MATRIX_ACTIONS?.[id]).map((id, i) => `<button type="button" class="${i === 0 ? "main" : ""}" data-term-action="${id}">${esc(L(`shadowrun6.matrixaction.${id}.name`))}</button>`).join("")}
    </footer>`;
    return `<div class="sre-surface sre-surface-${kind}">
      <div class="panel"><header><i></i><div><b>${esc(title)}</b>${node.text ? `<span>${esc(node.text)}</span>` : ""}</div></header>
        ${body}
        ${free.length || locked.length ? `<div class="keys">${free.map((c) => btn(c, false)).join("")}${locked.map((c) => btn(c, true)).join("")}</div>` : ""}
      </div></div>${hack}`;
  }

  /** The Matrix layer under the surface: security, controls, files, links. */
  #layerHtml(net, node, acc) {
    const ladder = N.ACCESS.map((lvl) => {
      const have = N.allows(lvl, acc.access);
      return `<div class="${have ? "have" : ""} ${lvl}"><small>${esc(L(`SRE.Matrix.Access.${lvl}`))}</small><span>${have ? "✓" : esc(L("SRE.Net.Closed"))}</span></div>`;
    }).join("");
    const controls = (node.controls ?? []).map((c) => {
      const ok = N.allows(c.access, acc.access) || canBreakRules();
      return `<button type="button" ${ok ? `data-term-control="${esc(c.id)}"` : "disabled"} class="${N.allows(c.access, acc.access) ? "" : "locked"}">${esc(c.label)}${N.rank(c.access) ? ` <small>${esc(L(`SRE.Matrix.Access.${c.access}`))}${N.needsTest(c) ? ` · ${esc(L("SRE.Net.Test"))}` : ""}</small>` : ""}</button>`;
    }).join("");
    const files = N.readable(node, acc.access).map((f) => `<button type="button" class="file ${f.ok ? "" : "locked"}" ${f.ok ? `data-term-file="${esc(f.id)}"` : "disabled"}><i>${esc(f.type || "FILE")}</i><span>${esc(f.name)}</span><small>${esc(L(`SRE.Matrix.Access.${f.access ?? "user"}`))}</small></button>`).join("");
    const known = new Set(knownOf(this.actor, net.id));
    const links = N.neighbors(net, node.id).filter((n) => known.has(n.node.id)).map((n) => `<button type="button" data-term-connect="${esc(n.node.id)}"><i class="fas fa-arrow-right"></i> ${esc(n.node.name)}</button>`).join("");
    return `<div class="sre-layer">
      <section><h4>${esc(L("SRE.Net.Security"))}</h4><div class="ladder">${ladder}</div></section>
      <section><h4>${esc(L("SRE.Net.Controls"))}</h4><div class="grid">${controls || `<em>${esc(L("SRE.Net.NoControls"))}</em>`}</div></section>
      <section class="grow"><h4>${esc(L("SRE.Net.Files"))}</h4><div class="files">${files || `<em>${esc(L("SRE.Net.NoFiles"))}</em>`}</div></section>
      <section><h4>${esc(L("SRE.Net.Links"))} <button type="button" class="mini" data-term-cmd="scan">scan</button></h4><div class="grid">${links || `<em>${esc(L("SRE.Net.NoLinks"))}</em>`}</div></section>
    </div>`;
  }

  _replaceHTML(result, content) {
    content.innerHTML = result;
    const log = content.querySelector("[data-log]");
    if (log) log.scrollTop = log.scrollHeight;
    const input = content.querySelector("[data-cmd]");
    input?.addEventListener("keydown", (e) => {
      if (e.key !== "Enter") return;
      e.preventDefault();
      const text = input.value;
      input.value = "";
      this.command(text);
    });
    if (this.focusCmd) input?.focus();
    this.focusCmd = false;
    content.querySelectorAll("[data-term-action]").forEach((b) => b.addEventListener("click", () => this.action(b.dataset.termAction)));
    content.querySelectorAll("[data-term-control]").forEach((b) => b.addEventListener("click", () => this.control(b.dataset.termControl)));
    content.querySelectorAll("[data-term-file]").forEach((b) => b.addEventListener("click", () => this.file(b.dataset.termFile)));
    content.querySelectorAll("[data-term-connect]").forEach((b) => b.addEventListener("click", () => this.connect(b.dataset.termConnect)));
    content.querySelectorAll("[data-term-cmd]").forEach((b) => b.addEventListener("click", () => this.command(b.dataset.termCmd)));
    // The glitch overlay removes itself; a click skips it.
    const g = content.querySelector(".sre-term-glitch");
    if (g) {
      const off = document.body.classList.contains("sre-motion-off");
      const done = () => { g.remove(); content.querySelector(".sre-term-glitching")?.classList.remove("sre-term-glitching"); };
      if (off) done();
      else {
        g.addEventListener("click", done);
        setTimeout(done, document.body.classList.contains("sre-motion-reduced") ? 500 : 1900);
      }
    }
  }

  _onFirstRender(context, options) {
    super._onFirstRender?.(context, options);
    open.set(this.actor.uuid, this);
  }

  _onClose(options) {
    super._onClose?.(options);
    open.delete(this.actor.uuid);
  }

  // ── What the persona does ──

  target(node) {
    const acc = this.access(node);
    return N.targetFor(this.net, node, acc.record);
  }

  /** A Matrix action against the current node's network, through the module's action window and the Edge engine. */
  async action(id, terminal = null) {
    const node = this.net?.nodes?.[this.nodeId];
    if (!node || !CONFIG.SR6?.MATRIX_ACTIONS?.[id]) return;
    this.say(`${id} ${node.name}`, "cmd");
    this.render();
    return openMatrixAction(this.actor, id, { target: this.target(node), terminal });
  }

  async control(id) {
    const net = this.net;
    const node = net?.nodes?.[this.nodeId];
    const c = node?.controls?.find((x) => x.id === id);
    if (!c) return;
    const acc = this.access(node);
    if (!N.allows(c.access, acc.access) && !canBreakRules()) {
      this.say(L("SRE.Net.Denied", { level: L(`SRE.Matrix.Access.${c.access}`) }), "bad");
      return this.render();
    }
    this.say(`control ${c.label}`, "cmd");
    const op = { op: "control", net: net.id, node: node.id, control: c.id, label: `${node.name} · ${c.label}` };
    if (N.needsTest(c) && CONFIG.SR6?.MATRIX_ACTIONS?.control_device) {
      this.render();
      return openMatrixAction(this.actor, "control_device", { target: this.target(node), terminal: op });
    }
    await runTerminalOp({ ...op, actor: this.actor.uuid });
    this.say(`✓ ${c.label}`, "ok");
    this.render();
  }

  file(id) {
    const node = this.net?.nodes?.[this.nodeId];
    const f = N.readable(node, this.access(node).access).find((x) => x.id === id);
    if (!f) return;
    this.say(`cat ${f.name}`, "cmd");
    if (!f.ok) this.say(L("SRE.Net.Denied", { level: L(`SRE.Matrix.Access.${f.access ?? "user"}`) }), "bad");
    else for (const line of String(f.text || L("SRE.Net.EmptyFile")).split(/\n/)) this.say(line, "file");
    this.render();
  }

  async command(text) {
    const c = N.parseCommand(text);
    if (!c) return;
    this.focusCmd = true;
    const net = this.net;
    const node = net?.nodes?.[this.nodeId];
    if (!node) return;
    const acc = this.access(node);
    const known = knownOf(this.actor, net.id);
    const alias = { brute: "brute_force", bruteforce: "brute_force", backdoor: "backdoor_entry", spike: "data_spike", perception: "matrix_perception", os: "check_overwatch_score", jackout: "jack_out" };
    switch (c.cmd) {
      case "help":
      case "?":
        this.say(text, "cmd");
        this.say(L("SRE.Net.Help"), "dim");
        break;
      case "scan": {
        this.say("scan", "cmd");
        const found = await learn(this.actor, net.id, N.scan(net, node.id, known));
        this.say(found.length ? L("SRE.Net.Found", { list: found.map((i) => net.nodes[i].name).join(", ") }) : L("SRE.Net.NothingNew"), found.length ? "ok" : "dim");
        if (N.reveal(net, node.id, [...known, ...found]).length || c.args.includes("--deep")) this.say(L("SRE.Net.MaybeHidden"), "dim");
        break;
      }
      case "search":
        return this.action("matrix_perception", { op: "reveal", net: net.id, node: node.id, label: L("SRE.Net.RevealLabel", { name: node.name }) });
      case "connect":
      case "cd": {
        const list = Object.values(net.nodes).filter((n) => known.includes(n.id));
        const to = N.findByName(list, c.rest);
        if (!to) {
          this.say(text, "cmd");
          this.say(L("SRE.Net.NoSuchNode"), "bad");
          break;
        }
        return this.connect(to.id);
      }
      case "ls":
      case "dir":
        this.say("ls", "cmd");
        if (!N.rank(acc.access)) this.say(L("SRE.Net.Denied", { level: L("SRE.Matrix.Access.user") }), "bad");
        else {
          for (const f of N.readable(node, acc.access)) this.say(`${(f.type || "FILE").padEnd(5)} ${f.name}${f.ok ? "" : `  [${L(`SRE.Matrix.Access.${f.access}`)}]`}`, f.ok ? "file" : "dim");
          for (const k of node.controls ?? []) this.say(`CTRL  ${k.label}  [${L(`SRE.Matrix.Access.${k.access ?? "outsider"}`)}]`, "dim");
        }
        break;
      case "cat":
      case "read": {
        const f = N.findByName(node.files ?? [], c.rest);
        if (f) return this.file(f.id);
        this.say(text, "cmd");
        this.say(L("SRE.Net.NoSuchFile"), "bad");
        break;
      }
      case "control":
      case "run": {
        const k = N.findByName(node.controls ?? [], c.rest, "label");
        if (k) return this.control(k.id);
        this.say(text, "cmd");
        this.say(L("SRE.Net.NoSuchControl"), "bad");
        break;
      }
      case "disconnect":
      case "exit":
        return this.close();
      default: {
        const id = alias[c.cmd] ?? c.cmd;
        if (CONFIG.SR6?.MATRIX_ACTIONS?.[id]) return this.action(id);
        this.say(text, "cmd");
        this.say(L("SRE.Net.Unknown"), "bad");
      }
    }
    this.render();
  }
}

// What happens to the persona shows in its open terminal: access, Overwatch, chat results.
Hooks.on("updateActor", (actor, changes) => {
  const t = open.get(actor.uuid);
  if (!t) return;
  const f = changes?.flags?.[MODULE_ID];
  if (f?.matrix?.targets) {
    const node = t.net?.nodes?.[t.nodeId];
    if (node) t.say(L("SRE.Net.AccessNow", { level: L(`SRE.Matrix.Access.${t.access(node).access}`) }), "ok");
  }
  t.render();
});
Hooks.on("createChatMessage", (message) => {
  const actorId = message.speaker?.actor;
  for (const t of open.values()) {
    if (t.actor.id !== actorId) continue;
    const roll = message.getFlag(MODULE_ID, "roll");
    const noteFlag = message.getFlag(MODULE_ID, "netNote");
    if (roll && message.getFlag(MODULE_ID, "task")?.kind === "matrix") {
      const faces = (roll.dice ?? []).map((d) => d.v).sort((a, b) => b - a).join(" ");
      t.say(L("SRE.Net.Rolled", { pool: roll.pool, faces, hits: roll.result?.hits ?? 0 }), roll.result?.glitch ? "bad" : "roll");
    } else if (noteFlag) t.say(`✓ ${noteFlag.text}`, "ok");
    else continue;
    t.render();
  }
});

/** Opens (or refocuses) the persona's terminal on a node. */
export async function openTerminal(actor, netId, nodeId) {
  const net = network(netId);
  const node = net?.nodes?.[nodeId] ?? Object.values(net?.nodes ?? {}).find((n) => n.entry);
  if (!actor || !net || !node) return ui.notifications.warn(L("SRE.Net.Gone"));
  let t = open.get(actor.uuid);
  if (!t) {
    t = new MatrixTerminal(actor, netId, node.id);
    t.say(L("SRE.Net.Boot", { deck: actor.name, mode: L(`SRE.Net.Mode.${t.mode()}`) }), "boot");
  } else t.netId = netId;
  await t.connect(node.id, { quiet: false });
  t.render(true);
  return t;
}

/** Picks a network entry point to connect to (remote: nodes the GM marked as entry points). */
export async function pickTerminal(actor) {
  const ui2 = await import("./ui/edge-ui.mjs");
  const list = Object.values(networks()).flatMap((net) => Object.values(net.nodes ?? {}).filter((n) => n.entry && (!n.hidden || game.user.isGM)).map((n) => ({ net, node: n })));
  if (!list.length) return ui.notifications.info(L(game.user.isGM ? "SRE.Net.NoNetworksGM" : "SRE.Net.NoNetworks"));
  const pick = ui2.okOnly(await foundry.applications.api.DialogV2.wait({
    classes: ["sre-dialog"], window: { title: L("SRE.Net.Terminal"), icon: "fas fa-terminal" }, position: { width: 460 },
    content: `<div class="sre-ed">${ui2.head({ kind: L("SRE.Net.Terminal"), name: actor.name, sub: L("SRE.Net.PickHint") })}<div class="sre-ed-body">
      ${ui2.options("entry", list.map((e, i) => ({ value: `${e.net.id}|${e.node.id}`, label: e.node.name, small: e.net.name, checked: i === 0 })))}</div></div>`,
    buttons: ui2.buttons(L("SRE.Net.Connect"), (event, button) => new FormData(button.form).get("entry"), { icon: "fas fa-plug" }),
    rejectClose: false,
  }));
  if (!pick) return null;
  const [netId, nodeId] = String(pick).split("|");
  return openTerminal(actor, netId, nodeId);
}

// A token bound to a node (flag `node`: { net, node }): double-click connects the user's character to it.
Hooks.on("canvasReady", () => {
  const view = canvas?.app?.view ?? canvas?.app?.canvas;
  if (!view || view.dataset.sreNet) return;
  view.dataset.sreNet = "1";
  view.addEventListener("dblclick", () => {
    const p = canvas.mousePosition;
    const token = canvas.tokens?.placeables?.find((t) => t.document.getFlag(MODULE_ID, "node") && t.bounds.contains(p.x, p.y));
    if (!token) return;
    const actor = canvas.tokens.controlled.find((t) => t.actor?.isOwner && t !== token)?.actor ?? game.user.character;
    if (!actor) return ui.notifications.warn(L("SRE.Macro.NoActor"));
    const { net, node } = token.document.getFlag(MODULE_ID, "node");
    openTerminal(actor, net, node);
  });
});

Hooks.on("chatMessage", (chatLog, message) => {
  const text = String(message).trim().toLowerCase();
  if (text === "/edge-term") {
    const actor = canvas?.tokens?.controlled?.[0]?.actor ?? game.user.character;
    if (actor) pickTerminal(actor);
    else ui.notifications.warn(L("SRE.Macro.NoActor"));
    return false;
  }
  if (text === "/edge-net" && game.user.isGM) {
    import("./matrix-net-editor.mjs").then((m) => m.openNetEditor());
    return false;
  }
});
