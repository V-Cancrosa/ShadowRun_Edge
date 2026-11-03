/**
 * Character advancement with Karma (pp. 68–70): a cart of attributes, skills, specializations and expertise,
 * knowledge skills and languages, qualities, spells and complex forms, initiation/submersion. Rule problems ask
 * (never block the GM). With the world setting "advancement needs GM approval", a player's cart becomes a chat
 * request the GM approves. Applied advancements spend Karma, go to chat and to the character's advancement log.
 */
import { SKILLS, ATTRIBUTES, METATYPES } from "./chargen/rules.mjs";
import { QUALITIES } from "./chargen/qualities.mjs";
import { qualityItem } from "./chargen/build.mjs";
import { cartTotal, cartProblems } from "./advancement-rules.mjs";
import { metatypeMax } from "./sheet/context.mjs";
import { resolveConflict } from "./ui/conflict.mjs";
import * as ui2 from "./ui/edge-ui.mjs";

const MODULE_ID = "shadowrun-edge";
const L = (key, data) => (data ? game.i18n.format(key, data) : game.i18n.localize(key));
const esc = (s) => foundry.utils.escapeHTML(String(s ?? ""));
const short = (id) => L(`SRE.Chargen.Short.${id}`);
const skillLabel = (id) => L(`skill.${id}`);

const specialAttr = (actor) => (actor.system.mortype === "technomancer" ? "res" : ["magician", "mysticadept", "aspectedmagician", "adept"].includes(actor.system.mortype) ? "mag" : null);

/** Rules context of an actor: Karma, attribute maxima (metatype + Exceptional), skills. */
function rulesContext(actor) {
  const s = actor.system;
  const max = { ...metatypeMax(s.metatype, METATYPES, L) };
  for (const q of actor.items.filter((i) => i.type === "quality" && i.getFlag(MODULE_ID, "quality")?.id === "exceptional")) {
    const detail = String(q.system?.explain ?? "").toLowerCase();
    const id = ATTRIBUTES.find((a) => detail.includes(a) || detail.includes(short(a).toLowerCase()));
    if (id) max[id] = Math.min(10, (max[id] ?? 6) + 1);
  }
  const aptitude = new Set(actor.items.filter((i) => i.getFlag(MODULE_ID, "quality")?.id === "aptitude").map((i) => String(i.system?.explain ?? "")));
  const skillMax = Object.fromEntries(SKILLS.map((id) => [id, [...aptitude].some((d) => d.includes(id) || d.includes(skillLabel(id))) ? 10 : 9]));
  return { karma: Number(s.karma) || 0, attrMax: max, skillMax, skills: s.skills ?? {} };
}

/** The cart from the dialog form. */
function readCart(form, actor) {
  const s = actor.system;
  const f = form.elements;
  const cart = [];
  for (const id of ATTRIBUTES) {
    const from = Number(s.attributes?.[id]?.base ?? s.attributes?.[id]?.pool) || 0;
    const to = Number(f[`attr.${id}`]?.value) || from;
    if (to > from) cart.push({ kind: "attribute", id, from, to });
  }
  for (const id of SKILLS) {
    const from = Number(s.skills?.[id]?.points) || 0;
    const to = Number(f[`skill.${id}`]?.value) || from;
    if (to > from) cart.push({ kind: "skill", id, from, to });
  }
  const spec = f.spec?.value;
  if (spec) {
    const [id, value] = spec.split("|");
    cart.push({ kind: "specialization", id, spec: value });
  }
  for (const box of form.querySelectorAll("input[name^='expertise.']:checked")) {
    const id = box.name.slice("expertise.".length);
    cart.push({ kind: "expertise", id, spec: s.skills?.[id]?.specialization ?? cart.find((e) => e.kind === "specialization" && e.id === id)?.spec });
  }
  const names = (v) => String(v ?? "").split(",").map((x) => x.trim()).filter(Boolean);
  for (const name of names(f.knowledge?.value)) cart.push({ kind: "knowledge", name, language: false });
  for (const name of names(f.languages?.value)) cart.push({ kind: "knowledge", name, language: true });
  const qid = f.quality?.value;
  if (qid && QUALITIES[qid]) {
    const def = QUALITIES[qid];
    cart.push({ kind: "quality", id: qid, name: def.name, karma: def.karma, level: def.levels ? Math.max(1, Number(f.qualityLevel?.value) || 1) : 1 });
  }
  for (const box of form.querySelectorAll("input[name^='remove.']:checked")) {
    const item = actor.items.get(box.name.slice("remove.".length));
    if (item) cart.push({ kind: "removeQuality", itemId: item.id, name: item.name, karma: Number(item.getFlag(MODULE_ID, "quality")?.karma ?? QUALITIES[item.getFlag(MODULE_ID, "quality")?.id]?.karma) || 0 });
  }
  for (const drop of JSON.parse(f.drops?.value || "[]")) cart.push({ kind: drop.type === "complexform" ? "form" : "spell", name: drop.name, uuid: drop.uuid });
  if (f.initiation?.checked) {
    const attr = specialAttr(actor);
    cart.push({ kind: attr === "res" ? "submersion" : "initiation", attr, from: Number(s.attributes?.[attr]?.initiation) || 0 });
  }
  return cart;
}

const timeText = (t) => [t.months ? `${t.months} ${L("SRE.Advance.Months")}` : "", t.weeks ? `${t.weeks} ${L("SRE.Advance.Weeks")}` : ""].filter(Boolean).join(" + ");

function lineText(e) {
  switch (e.kind) {
    case "attribute":
      return `${short(e.id)} ${e.from} → ${e.to}`;
    case "skill":
      return `${skillLabel(e.id)} ${e.from} → ${e.to}`;
    case "specialization":
      return `${L("SRE.Advance.Spec")}: ${skillLabel(e.id)} (${L(`shadowrun6.special.${e.id}.${e.spec}`)})`;
    case "expertise":
      return `${L("SRE.Advance.Expertise")}: ${skillLabel(e.id)} (${L(`shadowrun6.special.${e.id}.${e.spec}`)})`;
    case "knowledge":
      return `${L(e.language ? "SRE.Advance.Language" : "SRE.Advance.Knowledge")}: ${e.name}`;
    case "quality":
      return `${L("SRE.Advance.QualityBuy")}: ${e.name}${e.level > 1 ? ` ${e.level}` : ""}`;
    case "removeQuality":
      return `${L("SRE.Advance.QualityRemove")}: ${e.name}`;
    case "spell":
    case "form":
      return `${L(e.kind === "spell" ? "SRE.Advance.Spell" : "SRE.Advance.Form")}: ${e.name}`;
    default:
      return `${L(`SRE.Advance.${e.kind}`)} ${e.from} → ${e.from + 1}`;
  }
}

/** The advancement window. */
export async function openAdvancement(actor) {
  if (!actor?.isOwner) return;
  const s = actor.system;
  const special = CONFIG.SR6?.skill_special ?? {};
  const attrRows = ATTRIBUTES.map((id) => {
    const cur = Number(s.attributes?.[id]?.base ?? s.attributes?.[id]?.pool) || 0;
    return ui2.row(`${short(id)} (${cur})`, ui2.stepper(`attr.${id}`, cur, { min: cur }));
  });
  const skillRows = SKILLS.map((id) => {
    const cur = Number(s.skills?.[id]?.points) || 0;
    return ui2.row(`${skillLabel(id)} (${cur})`, ui2.stepper(`skill.${id}`, cur, { min: cur }));
  });
  const specOptions = SKILLS.map((id) => {
    const entries = Object.entries(special[id] ?? {});
    if (!entries.length) return "";
    return `<optgroup label="${esc(skillLabel(id))}">${entries.map(([value, key]) => `<option value="${id}|${value}">${esc(L(key))}</option>`).join("")}</optgroup>`;
  }).join("");
  const expertiseChips = SKILLS.filter((id) => s.skills?.[id]?.specialization && !s.skills?.[id]?.expertise)
    .map((id) => ui2.chip(`expertise.${id}`, `${skillLabel(id)}: ${L(`shadowrun6.special.${id}.${s.skills[id].specialization}`)}`));
  const qualityOptions = Object.values(QUALITIES).filter((q) => q.positive)
    .map((q) => `<option value="${q.id}">${esc(q.name)} (${q.karma}${q.levels ? `/${L("SRE.Advance.PerLevel")}` : ""})</option>`).join("");
  const negatives = actor.items.filter((i) => i.type === "quality" && i.system?.category === "DISADVANTAGE");
  const attr = specialAttr(actor);
  const grade = attr ? Number(s.attributes?.[attr]?.initiation) || 0 : 0;

  const content = `<div class="sre-ed sre-advance">
    ${ui2.head({ kind: L("SRE.Advance.Kind"), name: actor.name, sub: L("SRE.Advance.Sub", { karma: Number(s.karma) || 0 }) })}
    <div class="sre-ed-body">
      ${ui2.tiles([
        { id: "total", big: 0, label: L("SRE.Advance.Total"), accent: true },
        { id: "left", big: Number(s.karma) || 0, label: L("SRE.Advance.Left") },
      ])}
      ${ui2.note("", "info", { id: "time" })}
      ${ui2.panel(L("SRE.Advance.Attributes"), ui2.rows(attrRows), { hint: L("SRE.Advance.AttrHint") })}
      ${ui2.panel(L("SRE.Advance.Skills"), ui2.rows(skillRows), { hint: L("SRE.Advance.SkillHint") })}
      ${ui2.panel(L("SRE.Advance.SpecTitle"), ui2.rows([
        ui2.row(L("SRE.Advance.Spec"), `<select name="spec"><option value="">—</option>${specOptions}</select>`),
        expertiseChips.length ? ui2.chips(expertiseChips) : "",
      ]), { hint: L("SRE.Advance.SpecHint") })}
      ${ui2.panel(L("SRE.Advance.KnowledgeTitle"), ui2.rows([
        ui2.row(L("SRE.Advance.Knowledge"), `<input type="text" name="knowledge" placeholder="${esc(L("SRE.Advance.CommaHint"))}">`),
        ui2.row(L("SRE.Advance.Language"), `<input type="text" name="languages" placeholder="${esc(L("SRE.Advance.CommaHint"))}">`),
      ]), { hint: L("SRE.Advance.KnowledgeHint") })}
      ${ui2.panel(L("SRE.Advance.Qualities"), ui2.rows([
        ui2.row(L("SRE.Advance.QualityBuy"), `<select name="quality"><option value="">—</option>${qualityOptions}</select>`),
        ui2.row(L("SRE.Advance.Level"), ui2.stepper("qualityLevel", 1, { min: 1 })),
        negatives.length ? ui2.chips(negatives.map((q) => ui2.chip(`remove.${q.id}`, `${L("SRE.Advance.QualityRemove")}: ${q.name}`))) : "",
      ]), { hint: L("SRE.Advance.QualityHint") })}
      ${ui2.panel(L("SRE.Advance.SpellsTitle"), `<div class="sre-advance-drop" data-drop>${esc(L("SRE.Advance.DropHint"))}</div><input type="hidden" name="drops" value="[]">`, { hint: L("SRE.Advance.SpellHint") })}
      ${attr ? ui2.panel(L(attr === "res" ? "SRE.Advance.submersion" : "SRE.Advance.initiation"), ui2.rows([
        ui2.chips([ui2.chip("initiation", L("SRE.Advance.Grade", { from: grade, to: grade + 1 }))]),
      ]), { hint: L("SRE.Advance.InitiationHint") }) : ""}
    </div>
  </div>`;

  const result = ui2.okOnly(await foundry.applications.api.DialogV2.wait({
    classes: ["sre-dialog"],
    window: { title: L("SRE.Advance.Title", { name: actor.name }), icon: "fas fa-arrow-trend-up" },
    position: { width: 560, height: Math.min(820, window.innerHeight - 80) },
    content,
    render: (event, dialog) => {
      const form = ui2.wire(dialog, (f) => {
        const { total, lines } = cartTotal(readCart(f, actor));
        ui2.setTile(f, "total", { big: total, calc: L("SRE.Advance.Count", { n: lines.length }) });
        ui2.setTile(f, "left", { big: (Number(s.karma) || 0) - total });
        f.querySelector('[data-tile="left"]')?.classList.toggle("bad", total > (Number(s.karma) || 0));
        ui2.setNote(f, "time", lines.length ? L("SRE.Advance.TimeNote", { list: lines.map((l) => `${lineText(l)}: ${timeText(l.time)}`).join("; ") }) : "");
        ui2.setMainLabel(dialog, L("SRE.Advance.Buy", { n: total }));
      });
      // Spells and complex forms dragged from a compendium or the Items tab.
      const zone = form?.querySelector("[data-drop]");
      zone?.addEventListener("dragover", (e) => e.preventDefault());
      zone?.addEventListener("drop", async (e) => {
        e.preventDefault();
        const data = foundry.applications.ux.TextEditor.implementation.getDragEventData(e);
        const item = data?.type === "Item" ? await fromUuid(data.uuid) : null;
        if (!item || !["spell", "complexform"].includes(item.type)) return ui.notifications.warn(L("SRE.Advance.DropOnly"));
        const input = form.elements.drops;
        const list = JSON.parse(input.value || "[]");
        list.push({ uuid: item.uuid, name: item.name, type: item.type });
        input.value = JSON.stringify(list);
        zone.textContent = list.map((d) => d.name).join(", ");
        input.dispatchEvent(new Event("change", { bubbles: true }));
      });
    },
    buttons: ui2.buttons(L("SRE.Advance.BuyShort"), (event, button) => readCart(button.form, actor), { icon: "fas fa-arrow-trend-up" }),
    rejectClose: false,
  }));
  if (!result?.length) return;

  const problems = cartProblems(result, rulesContext(actor));
  if (problems.length) {
    const choice = await resolveConflict({
      title: L("SRE.Advance.Title", { name: actor.name }), name: actor.name,
      problems: problems.map((p) => L(`SRE.Advance.Problem.${p.key}`, {
        ...p.data, label: p.data.id ? (ATTRIBUTES.includes(p.data.id) ? short(p.data.id) : skillLabel(p.data.id)) : "",
      })),
      options: [{ id: "buy", label: L("SRE.Advance.BuyAnyway"), breaksRules: true }],
    });
    if (choice !== "buy") return;
  }
  if (!game.user.isGM && game.settings.get(MODULE_ID, "advancementApproval")) return requestApproval(actor, result);
  return applyAdvancement(actor, result);
}

/** Applies a cart: the character's values, items, Karma, chat card and advancement log. */
export async function applyAdvancement(actor, cart) {
  const { lines, total } = cartTotal(cart);
  const update = {};
  const create = [];
  const remove = [];
  for (const e of lines) {
    if (e.kind === "attribute") update[`system.attributes.${e.id}.base`] = e.to;
    if (e.kind === "skill") update[`system.skills.${e.id}.points`] = e.to;
    if (e.kind === "specialization") update[`system.skills.${e.id}.specialization`] = e.spec;
    if (e.kind === "expertise") {
      update[`system.skills.${e.id}.expertise`] = e.spec;
      update[`system.skills.${e.id}.specialization`] = "";
    }
    if (e.kind === "knowledge") create.push({ name: e.name, type: "skill", system: { genesisID: e.language ? "language" : "knowledge", points: 1 } });
    if (e.kind === "quality") {
      const def = QUALITIES[e.id];
      if (def) create.push(qualityItem({ def, level: def.levels ? e.level : null }, e.cost, { racial: "" }));
    }
    if (e.kind === "removeQuality") remove.push(e.itemId);
    if ((e.kind === "spell" || e.kind === "form") && e.uuid) {
      const source = await fromUuid(e.uuid);
      if (source) {
        const data = source.toObject();
        delete data._id;
        create.push(data);
      }
    }
    if (e.kind === "initiation" || e.kind === "submersion") update[`system.attributes.${e.attr}.initiation`] = e.from + 1;
  }
  update["system.karma"] = (Number(actor.system.karma) || 0) - total;
  const log = [...(actor.getFlag(MODULE_ID, "advancement") ?? []), {
    date: new Date().toISOString().slice(0, 10), worldTime: game.time.worldTime, total,
    lines: lines.map((l) => ({ text: lineText(l), cost: l.cost })),
  }];
  update[`flags.${MODULE_ID}.advancement`] = log;
  await actor.update(update);
  if (create.length) await actor.createEmbeddedDocuments("Item", create, { sreSkipAcquire: true });
  if (remove.length) await actor.deleteEmbeddedDocuments("Item", remove);
  return ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor }),
    content: `<div class="sre-blast-card"><h3>${L("SRE.Advance.ChatTitle", { name: esc(actor.name) })}</h3>
      <ul class="sre-blast-list">${lines.map((l) => `<li>${esc(lineText(l))} — <b>${l.cost}</b> · ${esc(timeText(l.time))}</li>`).join("")}</ul>
      <p><strong>${L("SRE.Advance.ChatTotal", { total, left: update["system.karma"] })}</strong></p></div>`,
  });
}

/** Player cart waiting for the GM (world setting). */
async function requestApproval(actor, cart) {
  const { lines, total } = cartTotal(cart);
  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor }),
    whisper: ChatMessage.getWhisperRecipients("GM").map((u) => u.id).concat(game.user.id),
    content: `<div class="sre-blast-card"><h3>${L("SRE.Advance.RequestTitle", { name: esc(actor.name) })}</h3>
      <ul class="sre-blast-list">${lines.map((l) => `<li>${esc(lineText(l))} — <b>${l.cost}</b></li>`).join("")}</ul>
      <p><strong>${L("SRE.Advance.Total")}: ${total}</strong></p></div>`,
    flags: { [MODULE_ID]: { advanceRequest: { actor: actor.uuid, cart, status: "open" } } },
  });
  ui.notifications.info(L("SRE.Advance.Requested"));
}

Hooks.on("renderChatMessageHTML", (message, html) => {
  const data = message.getFlag(MODULE_ID, "advanceRequest");
  if (!data) return;
  const root = html instanceof HTMLElement ? html : html?.[0];
  const card = root?.querySelector(".sre-blast-card");
  if (!card || card.querySelector(".sre-advance-actions")) return;
  const box = document.createElement("p");
  box.className = "sre-advance-actions";
  if (data.status !== "open") box.innerHTML = `<em>${L(`SRE.Advance.${data.status === "approved" ? "Approved" : "Rejected"}`)}</em>`;
  else if (game.user.isGM) box.innerHTML = `<button type="button" data-approve="1">${L("SRE.Advance.Approve")}</button> <button type="button" data-reject="1">${L("SRE.Advance.Reject")}</button>`;
  else box.innerHTML = `<em>${L("SRE.Advance.Waiting")}</em>`;
  card.append(box);
  box.querySelector("[data-approve]")?.addEventListener("click", async () => {
    const actor = await fromUuid(data.actor);
    if (!actor) return;
    await message.setFlag(MODULE_ID, "advanceRequest", { ...data, status: "approved" });
    await applyAdvancement(actor, data.cart);
  });
  box.querySelector("[data-reject]")?.addEventListener("click", () => message.setFlag(MODULE_ID, "advanceRequest", { ...data, status: "rejected" }));
});

Hooks.once("init", () => {
  game.settings.register(MODULE_ID, "advancementApproval", {
    name: "SRE.Advance.Setting.Name",
    hint: "SRE.Advance.Setting.Hint",
    scope: "world",
    config: true,
    type: Boolean,
    default: false,
  });
});

