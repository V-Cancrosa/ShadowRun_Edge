/**
 * Stage 14: the GM's network editor. Networks (hosts, PANs) are graphs of nodes: drag nodes, link them (a link or a
 * node may be hidden until found), and set each node's surface (what an ordinary user sees), controls (what they do
 * on the scene and the access they need), files, and a token on the scene that opens it. Saved as world data and
 * shown to players by the Matrix terminal (scripts/matrix-terminal.mjs).
 */
import * as N from "./matrix-net-rules.mjs";
import { networks, saveNetwork, deleteNetwork, openTerminal, forgetEverywhere } from "./matrix-terminal.mjs";

const MODULE_ID = "shadowrun-edge";
const L = (key, data) => (data ? game.i18n.format(key, data) : game.i18n.localize(key));
const esc = (s) => foundry.utils.escapeHTML(String(s ?? ""));
const num = (v, d = 0) => (Number.isFinite(Number(v)) && v !== "" && v !== null ? Number(v) : d);
const { ApplicationV2 } = foundry.applications.api;

let editor = null;

class NetEditor extends ApplicationV2 {
  static DEFAULT_OPTIONS = {
    id: "sre-net-editor",
    classes: ["sre-terminal", "sre-net-editor"],
    position: { width: 1120, height: 700 },
    window: { resizable: true, icon: "fas fa-diagram-project" },
  };

  netId = null;
  nodeId = null;
  linking = null; // node id a link is being drawn from

  get title() {
    return L("SRE.Net.Editor");
  }

  get net() {
    return this.draft ?? null;
  }

  /** The network being edited is a working copy; every change saves it. */
  load() {
    const all = networks();
    if (!this.netId || !all[this.netId]) this.netId = Object.keys(all)[0] ?? null;
    this.draft = this.netId ? all[this.netId] : null;
    if (this.draft && !this.draft.nodes[this.nodeId]) this.nodeId = Object.keys(this.draft.nodes)[0] ?? null;
  }

  async save() {
    if (this.draft) await saveNetwork(this.draft);
  }

  async _renderHTML() {
    this.load();
    const all = networks();
    const net = this.draft;
    const opt = (list, sel, label) => list.map((v) => `<option value="${esc(v)}"${v === sel ? " selected" : ""}>${esc(label(v))}</option>`).join("");
    const lAccess = (v) => L(`SRE.Matrix.Access.${v}`);
    const lEffect = (v) => L(`SRE.Net.Effect.${v}`);
    const lDoor = (v) => L(`SRE.Net.DoorAction.${v}`);
    const lSurface = (v) => L(`SRE.Net.Surface.${v}`);
    const lKind = (v) => L(`SRE.Net.NetKind.${v}`);
    const head = `<header class="sre-term-head">
      <i class="fas fa-diagram-project"></i>
      <div><small>${esc(L("SRE.Net.EditorKicker"))}</small>
        <select data-ed="pickNet">${Object.values(all).map((n) => `<option value="${esc(n.id)}"${n.id === this.netId ? " selected" : ""}>${esc(n.name)} · ${esc(L("SRE.Net.EditorCount", { n: Object.keys(n.nodes ?? {}).length }))} · ${esc(L("SRE.Matrix.Rating"))} ${num(n.rating, 3)}</option>`).join("") || `<option value="">—</option>`}</select></div>
      <span class="spacer"></span>
      <button type="button" data-ed="newNet">+ ${esc(L("SRE.Net.NewNetwork"))}</button>
      <button type="button" data-ed="preset">${esc(L("SRE.Net.InsertPreset"))}</button>
      ${net ? `<button type="button" data-ed="addNode">+ ${esc(L("SRE.Net.Node"))}</button>
      <button type="button" data-ed="preview">${esc(L("SRE.Net.Preview"))}</button>
      <button type="button" class="danger" data-ed="delNet">${esc(L("SRE.Net.DeleteNetwork"))}</button>` : ""}
    </header>`;
    if (!net) return `<div class="sre-term">${head}<div class="sre-term-empty">${esc(L("SRE.Net.EditorEmpty"))}</div></div>`;

    const lines = net.links.map((l, i) => {
      const a = net.nodes[l.a];
      const b = net.nodes[l.b];
      return a && b ? `<line class="${l.hidden ? "hidden" : ""}" data-link="${i}" x1="${a.x + 70}" y1="${a.y + 24}" x2="${b.x + 70}" y2="${b.y + 24}"><title>${esc(L("SRE.Net.LinkHint"))}</title></line>` : "";
    }).join("");
    const nodes = Object.values(net.nodes).map((n) => `<div class="node ${n.kind}${n.id === this.nodeId ? " selected" : ""}${n.hidden ? " hidden" : ""}${this.linking === n.id ? " linking" : ""}" data-node="${esc(n.id)}" style="left:${num(n.x)}px;top:${num(n.y)}px">
      <small>${esc(L(`SRE.Matrix.Kinds.${n.kind}`))}${n.entry ? ` · ${esc(L("SRE.Net.EntryShort"))}` : ""}${n.hidden ? ` · ${esc(L("SRE.Net.HiddenShort"))}` : ""}</small><b>${esc(n.name)}</b><span>${esc(L(`SRE.Net.Surface.${n.surface}`))}</span></div>`).join("");
    const node = net.nodes[this.nodeId];
    const controlRow = (c, i) => `<div class="row" data-control="${i}">
      <input type="text" data-f="label" value="${esc(c.label)}" placeholder="${esc(L("SRE.Net.ControlLabel"))}">
      <select data-f="access">${opt(N.ACCESS, c.access ?? "outsider", lAccess)}</select>
      <select data-f="effect.type">${opt(N.EFFECTS, c.effect?.type ?? "none", lEffect)}</select>
      ${c.effect?.type === "door" ? `<select data-f="effect.action">${opt(N.DOOR_ACTIONS, c.effect?.action ?? "open", lDoor)}</select>
        <button type="button" data-ed="pickWall" data-tooltip="${esc(L("SRE.Net.PickWallHint"))}">${c.effect?.wall ? "✓ " : ""}${esc(L("SRE.Net.PickWall"))}</button>` : ""}
      ${c.effect?.type === "message" ? `<input type="text" class="wide" data-f="effect.text" value="${esc(c.effect?.text ?? "")}" placeholder="${esc(L("SRE.Net.MessageText"))}">` : ""}
      ${c.effect?.type === "status" ? `<input type="text" data-f="effect.status" value="${esc(c.effect?.status ?? "")}" placeholder="disabled">
        <button type="button" data-ed="pickToken" data-tooltip="${esc(L("SRE.Net.PickTokenHint"))}">${c.effect?.token ? "✓ " : ""}${esc(L("SRE.Net.PickToken"))}</button>` : ""}
      <label class="chk"><input type="checkbox" data-f="test"${N.needsTest(c) ? " checked" : ""}> ${esc(L("SRE.Net.Test"))}</label>
      <button type="button" class="danger" data-ed="delControl">×</button></div>`;
    const fileRow = (f, i) => `<div class="row" data-file="${i}">
      <input type="text" data-f="type" class="short" value="${esc(f.type ?? "DATA")}">
      <input type="text" data-f="name" value="${esc(f.name)}" placeholder="plik.dat">
      <select data-f="access">${opt(["user", "admin"], f.access ?? "user", lAccess)}</select>
      <button type="button" class="danger" data-ed="delFile">×</button>
      <textarea data-f="text" rows="2" placeholder="${esc(L("SRE.Net.FileText"))}">${esc(f.text ?? "")}</textarea></div>`;
    const hosts = game.actors?.filter?.((a) => a.type === "host") ?? [];
    const panel = node ? `<aside class="sre-ed-panel" data-panel>
      <h4>${esc(L("SRE.Net.Network"))}</h4>
      <div class="two"><label>${esc(L("SRE.Net.Name"))}<input type="text" data-net="name" value="${esc(net.name)}"></label>
        <label>${esc(L("SRE.Matrix.Rating"))}<input type="number" min="1" max="12" data-net="rating" value="${num(net.rating, 3)}"></label></div>
      <div class="two"><label>${esc(L("SRE.Net.Kind"))}<select data-net="kind">${opt(["host", "pan"], net.kind ?? "host", lKind)}</select></label>
        <label>${esc(L("SRE.Net.HostActor"))}<select data-net="hostUuid"><option value="">—</option>${hosts.map((h) => `<option value="${esc(h.uuid)}"${h.uuid === net.hostUuid ? " selected" : ""}>${esc(h.name)}</option>`).join("")}</select></label></div>
      <h4>${esc(L("SRE.Net.Node"))}</h4>
      <div class="two"><label>${esc(L("SRE.Net.Name"))}<input type="text" data-node-f="name" value="${esc(node.name)}"></label>
        <label>${esc(L("SRE.Net.SurfaceLabel"))}<select data-node-f="surface">${opt(N.SURFACES, node.surface, lSurface)}</select></label></div>
      <label>${esc(L("SRE.Net.SurfaceTitle"))}<input type="text" data-node-f="title" value="${esc(node.title ?? "")}"></label>
      <label>${esc(L("SRE.Net.SurfaceText"))}<input type="text" data-node-f="text" value="${esc(node.text ?? "")}"></label>
      <label>${esc(L("SRE.Net.Image"))}<input type="text" data-node-f="img" value="${esc(node.img ?? "")}" placeholder="path/to/image.webp"></label>
      <div class="checks">
        <label class="chk"><input type="checkbox" data-node-f="entry"${node.entry ? " checked" : ""}> ${esc(L("SRE.Net.Entry"))}</label>
        <label class="chk"><input type="checkbox" data-node-f="hidden"${node.hidden ? " checked" : ""}> ${esc(L("SRE.Net.Hidden"))}</label>
        <label class="chk"><input type="checkbox" data-node-f="own"${node.own ? " checked" : ""}> ${esc(L("SRE.Net.Own"))}</label>
        ${node.own ? `<label>${esc(L("SRE.Matrix.Rating"))} <input type="number" class="short" min="1" max="12" data-node-f="rating" value="${num(node.rating, 1)}"></label>` : ""}
      </div>
      <h4>${esc(L("SRE.Net.Links"))}</h4>
      ${N.linksOf(net, node.id).map((x) => `<div class="row link" data-link-row="${x.index}"><span>${esc(node.name)} ↔ <b>${esc(x.other.name)}</b></span>
        <button type="button" data-ed="toggleLink" class="${x.hidden ? "on" : ""}">${esc(L(x.hidden ? "SRE.Net.LinkHidden" : "SRE.Net.LinkVisible"))}</button>
        <button type="button" class="danger" data-ed="delLink">×</button></div>`).join("") || `<em>${esc(L("SRE.Net.NoLinks"))}</em>`}
      <h4>${esc(L("SRE.Net.Controls"))} <button type="button" data-ed="addControl">+</button></h4>
      ${(node.controls ?? []).map(controlRow).join("") || `<em>${esc(L("SRE.Net.NoControls"))}</em>`}
      <h4>${esc(L("SRE.Net.Files"))} <button type="button" data-ed="addFile">+</button></h4>
      ${(node.files ?? []).map(fileRow).join("") || `<em>${esc(L("SRE.Net.NoFiles"))}</em>`}
      <div class="foot">
        <button type="button" data-ed="link">${esc(L(this.linking ? "SRE.Net.LinkPick" : "SRE.Net.LinkFrom"))}</button>
        <button type="button" data-ed="bindToken" data-tooltip="${esc(L("SRE.Net.BindHint"))}">${esc(L("SRE.Net.Bind"))}</button>
        <button type="button" class="danger" data-ed="delNode">${esc(L("SRE.Net.DeleteNode"))}</button>
      </div>
    </aside>` : "";
    return `<div class="sre-term">${head}<div class="sre-ed-body2">
      <div class="sre-ed-canvas" data-canvas><svg aria-hidden="true">${lines}</svg>${nodes}
        <p class="hint">${esc(L("SRE.Net.EditorHint"))}</p></div>${panel}</div></div>`;
  }

  _replaceHTML(result, content) {
    const scroll = content.querySelector("[data-panel]")?.scrollTop ?? 0;
    content.innerHTML = result;
    const panel = content.querySelector("[data-panel]");
    if (panel) panel.scrollTop = scroll;
    const net = this.draft;
    const commit = async () => { await this.save(); this.render(); };
    content.querySelector("[data-ed=pickNet]")?.addEventListener("change", (e) => { this.netId = e.target.value; this.nodeId = null; this.render(); });
    content.querySelectorAll("button[data-ed]").forEach((b) => b.addEventListener("click", (e) => this.#click(b.dataset.ed, b, e)));
    if (!net) return;
    // Network and node fields.
    content.querySelectorAll("[data-net]").forEach((el) => el.addEventListener("change", () => {
      const k = el.dataset.net;
      net[k] = k === "rating" ? num(el.value, 3) : el.value || (k === "hostUuid" ? null : "");
      if (k === "hostUuid" && net.hostUuid) net.rating = num(fromUuidSync(net.hostUuid)?.system?.rating, net.rating);
      commit();
    }));
    const node = net.nodes[this.nodeId];
    content.querySelectorAll("[data-node-f]").forEach((el) => el.addEventListener("change", () => {
      const k = el.dataset.nodeF;
      node[k] = el.type === "checkbox" ? el.checked : el.type === "number" ? num(el.value, 1) : el.value;
      if (k === "name" && node.kind === "host" && node.id === "root") net.name = node.name;
      commit();
      if (k === "hidden" && node.hidden) forgetEverywhere(net.id, [node.id]);
    }));
    const bindRows = (sel, list) => content.querySelectorAll(sel).forEach((row) => {
      const item = list[Number(row.dataset.control ?? row.dataset.file)];
      row.querySelectorAll("[data-f]").forEach((el) => el.addEventListener("change", () => {
        const value = el.type === "checkbox" ? el.checked : el.value;
        foundry.utils.setProperty(item, el.dataset.f, value);
        commit();
      }));
    });
    bindRows("[data-control]", node?.controls ?? []);
    bindRows("[data-file]", node?.files ?? []);
    // Links: click toggles hidden, right-click removes.
    content.querySelectorAll("line[data-link]").forEach((ln) => {
      ln.addEventListener("click", () => { const l = net.links[Number(ln.dataset.link)]; l.hidden = !l.hidden; commit(); if (l.hidden) forgetEverywhere(net.id, [N.linkKey(l)]); });
      ln.addEventListener("contextmenu", (e) => { e.preventDefault(); net.links.splice(Number(ln.dataset.link), 1); commit(); });
    });
    // Nodes: click selects (or ends a link), drag moves.
    const area = content.querySelector("[data-canvas]");
    area?.querySelectorAll("[data-node]").forEach((el) => el.addEventListener("pointerdown", (down) => {
      if (down.button !== 0) return;
      const id = el.dataset.node;
      const n = net.nodes[id];
      const start = { x: down.clientX, y: down.clientY, nx: num(n.x), ny: num(n.y) };
      let moved = false;
      const move = (e) => {
        moved = moved || Math.abs(e.clientX - start.x) + Math.abs(e.clientY - start.y) > 3;
        if (!moved) return;
        n.x = Math.max(0, Math.round(start.nx + e.clientX - start.x));
        n.y = Math.max(0, Math.round(start.ny + e.clientY - start.y));
        el.style.left = `${n.x}px`;
        el.style.top = `${n.y}px`;
      };
      const up = () => {
        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup", up);
        if (!moved) {
          if (this.linking && this.linking !== id) {
            net.links.push({ a: this.linking, b: id, hidden: false });
            this.linking = null;
          } else this.nodeId = id;
        }
        commit();
      };
      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", up);
    }));
  }

  async #click(what, button) {
    const net = this.draft;
    const node = net?.nodes?.[this.nodeId];
    const row = button.closest("[data-control], [data-file], [data-link-row]");
    const names = () => Object.values(networks()).map((n) => n.name);
    const id = () => foundry.utils.randomID(8);
    switch (what) {
      case "newNet": {
        const fresh = N.newNetwork(id(), N.uniqueName(L("SRE.Net.NewNetwork").toUpperCase(), names()));
        this.netId = fresh.id;
        this.nodeId = "root";
        await saveNetwork(fresh);
        return this.render();
      }
      case "preset": {
        const fresh = N.presetOffice(id(), L);
        fresh.name = fresh.nodes.root.name = N.uniqueName(fresh.name, names());
        this.netId = fresh.id;
        this.nodeId = "root";
        await saveNetwork(fresh);
        return this.render();
      }
      case "delNet": {
        const ok = await foundry.applications.api.DialogV2.confirm({ window: { title: L("SRE.Net.DeleteNetwork") }, content: `<p>${esc(L("SRE.Net.DeleteNetworkAsk", { name: net.name }))}</p>` });
        if (!ok) return;
        await deleteNetwork(net.id);
        this.netId = null;
        return this.render();
      }
      case "preview": {
        const actor = canvas?.tokens?.controlled?.[0]?.actor ?? game.user.character ?? game.actors.find((a) => a.type === "Player");
        if (!actor) return ui.notifications.warn(L("SRE.Macro.NoActor"));
        return openTerminal(actor, net.id, this.nodeId);
      }
      case "addNode": {
        // No silent link: the new node stands next to the selected one and the GM links it on purpose.
        const name = N.uniqueName(L("SRE.Net.Node").toUpperCase(), Object.values(net.nodes).map((x) => x.name));
        const n = N.newNode(id(), { name, x: node ? num(node.x) + 180 : 60, y: node ? num(node.y) + 90 : 320 });
        net.nodes[n.id] = n;
        this.nodeId = n.id;
        break;
      }
      case "toggleLink": {
        const l = net.links[Number(row.dataset.linkRow)];
        if (l) l.hidden = !l.hidden;
        if (l?.hidden) forgetEverywhere(net.id, [N.linkKey(l)]);
        break;
      }
      case "delLink":
        net.links.splice(Number(row.dataset.linkRow), 1);
        break;
      case "delNode":
        if (!node || Object.keys(net.nodes).length <= 1) return;
        delete net.nodes[node.id];
        this.nodeId = null;
        break;
      case "link":
        this.linking = this.linking ? null : this.nodeId;
        return this.render();
      case "addControl":
        (node.controls ??= []).push({ id: id(), label: L("SRE.Net.ControlLabel"), access: "user", effect: { type: "none" } });
        break;
      case "delControl":
        node.controls.splice(Number(row.dataset.control), 1);
        break;
      case "addFile":
        (node.files ??= []).push({ id: id(), name: "file.dat", type: "DATA", access: "user", text: "" });
        break;
      case "delFile":
        node.files.splice(Number(row.dataset.file), 1);
        break;
      case "pickWall": {
        const wall = canvas?.walls?.controlled?.[0];
        if (!wall) return ui.notifications.warn(L("SRE.Net.PickWallHint"));
        node.controls[Number(row.dataset.control)].effect.wall = wall.document.id;
        break;
      }
      case "pickToken": {
        const token = canvas?.tokens?.controlled?.[0];
        if (!token) return ui.notifications.warn(L("SRE.Net.PickTokenHint"));
        node.controls[Number(row.dataset.control)].effect.token = token.document.uuid;
        break;
      }
      case "bindToken": {
        const token = canvas?.tokens?.controlled?.[0];
        if (!token) return ui.notifications.warn(L("SRE.Net.BindHint"));
        await token.document.setFlag(MODULE_ID, "node", { net: net.id, node: node.id });
        return ui.notifications.info(L("SRE.Net.Bound", { token: token.name, node: node.name }));
      }
      default:
        return;
    }
    await this.save();
    this.render();
  }

  _onClose(options) {
    super._onClose?.(options);
    editor = null;
  }
}

export function openNetEditor() {
  if (!game.user.isGM) return null;
  editor ??= new NetEditor();
  editor.render(true);
  return editor;
}
