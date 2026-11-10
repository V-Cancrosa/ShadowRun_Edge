/**
 * Matrix networks for the terminal (stage 14): hosts and PANs as graphs of nodes the gamemaster builds. Pure for tests.
 * Rules they lean on (core rulebook, Matrix chapter): a system has three levels of access — Outsider (a look around),
 * User (read files, basic functions), Admin (change configuration, turn devices on or off); to get to a device
 * attached to a PAN or host one first gains access to that network, so access is held per network, unless a node is
 * marked as standing on its own. Icons running silent need Matrix Perception to be found.
 *
 * Network: { id, name, kind: "host"|"pan", rating, hostUuid, nodes: { [id]: node }, links: [{ a, b, hidden }] }
 * Node: { id, name, kind: "host"|"device", surface, title, text, img, rating, x, y, hidden, entry, own,
 *         controls: [{ id, label, access, test, effect: { type: "door"|"message"|"status"|"none", … } }],
 *         files: [{ id, name, type, access, text }] }
 */
export const ACCESS = ["outsider", "user", "admin"];
export const SURFACES = ["elevator", "keypad", "kiosk", "camera", "computer", "image"];
export const EFFECTS = ["none", "door", "message", "status"];
export const DOOR_ACTIONS = ["open", "close", "lock", "unlock", "toggle"];
const num = (v, d = 0) => (Number.isFinite(Number(v)) && v !== "" && v !== null ? Number(v) : d);

export const rank = (level) => Math.max(0, ACCESS.indexOf(level ?? "outsider"));
export const allows = (need, have) => rank(have) >= rank(need);

/** The key of the persona's access record for a node: the network's, or the node's own when it stands alone. */
export function accessKey(net, node) {
  return node?.own ? `net_${net.id}_${node.id}` : `net_${net.id}`;
}

/** The target record a Matrix action is rolled against for a node (shape of the module's persona targets). */
export function targetFor(net, node, held = null) {
  const own = !!node?.own;
  return {
    key: accessKey(net, node), name: own ? node.name : net.name, kind: own ? "device" : net.kind === "pan" ? "persona" : "host",
    rating: own ? num(node.rating, 1) : num(net.rating, 1), hostUuid: own ? null : net.hostUuid ?? null,
    access: held?.access ?? "outsider", illegal: !!held?.illegal, backdoor: held?.backdoor ?? null,
  };
}

/** The access a persona holds on a node, from its target records. */
export function accessOn(net, node, targets = []) {
  const t = targets.find((x) => x.key === accessKey(net, node));
  return { access: t?.access ?? "outsider", illegal: !!t?.illegal, record: t ?? null };
}

/** Nodes linked to a node: [{ node, hidden }] (hidden when the link or the node is hidden). */
export function neighbors(net, nodeId) {
  const out = [];
  for (const l of net.links ?? []) {
    const other = l.a === nodeId ? l.b : l.b === nodeId ? l.a : null;
    const node = other && net.nodes?.[other];
    if (node) out.push({ node, hidden: !!l.hidden || !!node.hidden });
  }
  return out;
}

/** What a scan from a node adds to the known ids: its neighbors that are not hidden. */
export function scan(net, nodeId, known = []) {
  const have = new Set(known);
  return neighbors(net, nodeId).filter((n) => !n.hidden && !have.has(n.node.id)).map((n) => n.node.id);
}

/** What a successful Matrix Perception from a node adds: its hidden neighbors. */
export function reveal(net, nodeId, known = []) {
  const have = new Set(known);
  return neighbors(net, nodeId).filter((n) => n.hidden && !have.has(n.node.id)).map((n) => n.node.id);
}

/** The map a persona sees: known nodes, links between two known nodes, and a "?" stub per unknown visible neighbor. */
export function visibleMap(net, known = [], current = null) {
  const have = new Set(known);
  const nodes = Object.values(net.nodes ?? {}).filter((n) => have.has(n.id)).map((n) => ({ id: n.id, name: n.name, kind: n.kind, x: num(n.x), y: num(n.y), current: n.id === current }));
  const links = [];
  const stubs = [];
  for (const l of net.links ?? []) {
    const a = net.nodes?.[l.a];
    const b = net.nodes?.[l.b];
    if (!a || !b) continue;
    if (have.has(a.id) && have.has(b.id)) links.push({ a: a.id, b: b.id });
    else if (!l.hidden && (have.has(a.id) !== have.has(b.id))) {
      const [from, to] = have.has(a.id) ? [a, b] : [b, a];
      if (!to.hidden) stubs.push({ from: from.id, x: num(to.x), y: num(to.y) });
    }
  }
  return { nodes, links, stubs };
}

/** Controls split for the surface: usable without access, and locked ones (shown, not usable). */
export function surfaceControls(node) {
  const list = node?.controls ?? [];
  return { open: list.filter((c) => rank(c.access) === 0), locked: list.filter((c) => rank(c.access) > 0) };
}

/** Whether a control needs a Control Device test: the GM's choice, by default every control above Outsider. */
export function needsTest(control) {
  return control?.test === undefined || control?.test === null ? rank(control?.access) > 0 : !!control.test;
}

/** Files a persona may read at this access. */
export function readable(node, access) {
  return (node?.files ?? []).map((f) => ({ ...f, ok: allows(f.access ?? "user", access) }));
}

/** "connect elevator b" → { cmd: "connect", args: ["elevator", "b"], rest: "elevator b" }. */
export function parseCommand(text) {
  const parts = String(text ?? "").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return null;
  const cmd = parts[0].toLowerCase().replace(/^\//, "");
  return { cmd, args: parts.slice(1), rest: parts.slice(1).join(" ") };
}

/** Finds an entry by id or by the start of its name / label (case-insensitive, spaces and _ alike). */
export function findByName(list, query, field = "name") {
  const norm = (s) => String(s ?? "").toLowerCase().replace(/[\s_·:-]+/g, "");
  const q = norm(query);
  if (!q) return null;
  return list.find((x) => x.id === query) ?? list.find((x) => norm(x[field]) === q) ?? list.find((x) => norm(x[field]).startsWith(q)) ?? list.find((x) => norm(x[field]).includes(q)) ?? null;
}

export function newNode(id, patch = {}) {
  return { id, name: "NODE", kind: "device", surface: "kiosk", title: "", text: "", img: "", rating: 1, x: 200, y: 200, hidden: false, entry: false, own: false, controls: [], files: [], ...patch };
}

export function newNetwork(id, name = "HOST") {
  const root = newNode("root", { name, kind: "host", surface: "computer", x: 340, y: 60, entry: true });
  return { id, name, kind: "host", rating: 3, hostUuid: null, nodes: { root }, links: [] };
}

/** A small ready-made network (an office floor): host, lift, door lock, camera and a file server. Names only. */
export function presetOffice(id, L = (k) => k) {
  const net = newNetwork(id, L("SRE.Net.Preset.host"));
  const add = (nid, patch) => { net.nodes[nid] = newNode(nid, patch); net.links.push({ a: patch.parent ?? "root", b: nid, hidden: !!patch.hiddenLink }); delete net.nodes[nid].parent; delete net.nodes[nid].hiddenLink; };
  add("lift", { name: L("SRE.Net.Preset.lift"), surface: "elevator", title: L("SRE.Net.Preset.liftTitle"), x: 120, y: 220, entry: true,
    controls: [1, 2, 3].map((n) => ({ id: `f${n}`, label: `${n}`, access: "outsider", test: false, effect: { type: "message", text: L("SRE.Net.Preset.floor").replace("{n}", n) } }))
      .concat([{ id: "f13", label: "13", access: "user", effect: { type: "message", text: L("SRE.Net.Preset.floor").replace("{n}", 13) } }]) });
  add("lock", { name: L("SRE.Net.Preset.lock"), surface: "keypad", title: L("SRE.Net.Preset.lockTitle"), x: 340, y: 240,
    controls: [{ id: "open", label: L("SRE.Net.Preset.open"), access: "user", effect: { type: "door", action: "open", wall: "" } }, { id: "lock", label: L("SRE.Net.Preset.lockDoor"), access: "admin", effect: { type: "door", action: "lock", wall: "" } }] });
  add("cam", { name: L("SRE.Net.Preset.cam"), surface: "camera", x: 560, y: 220,
    controls: [{ id: "loop", label: L("SRE.Net.Preset.loop"), access: "admin", effect: { type: "message", text: L("SRE.Net.Preset.loopDone") } }] });
  add("files", { name: L("SRE.Net.Preset.files"), surface: "computer", x: 340, y: 400, parent: "lock", hiddenLink: true, hidden: true,
    files: [{ id: "f1", name: "paydata.dat", type: "DATA", access: "admin", text: "" }] });
  return net;
}

/** A network name not taken yet: "HOST", then "HOST 2", "HOST 3"… */
export function uniqueName(name, taken = []) {
  const have = new Set(taken.map((n) => String(n ?? "").trim().toLowerCase()));
  if (!have.has(String(name).trim().toLowerCase())) return name;
  let i = 2;
  while (have.has(`${name} ${i}`.toLowerCase())) i++;
  return `${name} ${i}`;
}

/** The links of one node, for the editor's list: [{ index, other, hidden }]. */
export function linksOf(net, nodeId) {
  return (net.links ?? []).map((l, index) => ({ index, l })).filter(({ l }) => l.a === nodeId || l.b === nodeId)
    .map(({ index, l }) => ({ index, other: net.nodes?.[l.a === nodeId ? l.b : l.a] ?? null, hidden: !!l.hidden })).filter((x) => x.other);
}

/** Cleans a network after editing: drops links to missing nodes and duplicate links. */
export function tidy(net) {
  const seen = new Set();
  const links = (net.links ?? []).filter((l) => {
    if (!net.nodes?.[l.a] || !net.nodes?.[l.b] || l.a === l.b) return false;
    const k = [l.a, l.b].sort().join("|");
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  return { ...net, links };
}
