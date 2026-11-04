/**
 * The Effects tab / panel on the Edge sheets: every status and effect on the actor (its own and the ones its items
 * give), with level, sources and time left, and switching on/off, levels, editing, removal and adding a status.
 */
import { effectRows } from "../effects.mjs";
import { statusLabel } from "../statuses.mjs";
import * as ui2 from "../ui/edge-ui.mjs";

const L = (key, data) => (data ? game.i18n.format(key, data) : game.i18n.localize(key));

export function effectsContext(actor) {
  const rows = effectRows(actor, { now: game.time.worldTime, L, statusLabel });
  const kinds = ["status", "module", "marker", "item", "other"];
  return {
    groups: kinds.map((k) => ({ kind: k, label: L(`SRE.Effects.Kind.${k}`), rows: rows.filter((r) => r.kind === k) })).filter((g) => g.rows.length),
    count: rows.length,
  };
}

function effectOf(sheet, target) {
  const row = target.closest("[data-effect-uuid]");
  return row ? fromUuidSync(row.dataset.effectUuid) : null;
}

export const effectActions = {
  async effectToggle(event, target) {
    const e = effectOf(this, target);
    if (e?.isOwner) await e.update({ disabled: !e.disabled });
  },
  effectEdit(event, target) {
    effectOf(this, target)?.sheet?.render(true);
  },
  async effectDelete(event, target) {
    const e = effectOf(this, target);
    if (e?.isOwner) await e.delete();
  },
  async effectLevel(event, target) {
    const e = effectOf(this, target);
    if (!e?.isOwner) return;
    const step = Number(target.dataset.step) || 0;
    const level = (Number(e.system?.level) || 1) + step;
    if (level <= 0) return e.delete();
    if (typeof e.system?.increase === "function" && step > 0) return e.system.increase();
    if (typeof e.system?.decrease === "function" && step < 0) return e.system.decrease();
    return e.update({ "system.level": level });
  },
  async effectCreate() {
    const actor = this.document;
    if (!actor.isOwner) return;
    const [e] = await actor.createEmbeddedDocuments("ActiveEffect", [{ name: L("SRE.Effects.New"), img: "icons/svg/aura.svg" }]);
    e?.sheet?.render(true);
  },
  /** Adding a status: the system's list and the module's, as option tiles. */
  async statusAdd() {
    const actor = this.document;
    if (!actor.isOwner) return;
    const list = (CONFIG.statusEffects ?? []).filter((s) => s.hud !== false && !actor.statuses?.has?.(s.id));
    const id = ui2.okOnly(await foundry.applications.api.DialogV2.wait({
      classes: ["sre-dialog"], window: { title: actor.name, icon: "fas fa-plus" }, position: { width: 560 },
      content: `<div class="sre-ed">${ui2.head({ kind: L("SRE.Effects.AddStatus"), name: actor.name })}<div class="sre-ed-body">
        ${ui2.options("status", list.map((s, i) => ({ value: s.id, label: L(s.name ?? s.id), avatar: { img: s.img, name: L(s.name ?? s.id) }, checked: i === 0 })), { cards: true })}</div></div>`,
      buttons: ui2.buttons(L("SRE.Effects.AddStatus"), (event, button) => new FormData(button.form).get("status"), { icon: "fas fa-plus" }),
      rejectClose: false,
    }));
    if (id) await actor.toggleStatusEffect(id, { active: true });
  },
};

Hooks.once("init", () => {
  const load = foundry.applications?.handlebars?.loadTemplates ?? globalThis.loadTemplates;
  load?.(["modules/shadowrun-edge/templates/sheet/edge-effects.hbs"]);
});
