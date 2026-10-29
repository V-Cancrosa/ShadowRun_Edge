/**
 * Major and Minor actions per combat round in the combat tracker (system issue #46).
 * SR6: every combatant has 1 Major and 1 Minor action, plus 1 Minor action per initiative die.
 * Spent actions are kept in combatant flags and reset at the start of each round.
 */
const MODULE_ID = "shadowrun-edge";
const SYSTEM_ID = "shadowrun6-eden";

/** Actions a combatant has this round, from the initiative it uses (physical, astral or matrix). */
export function actionTotals(combatant) {
  const type = combatant.getFlag?.(SYSTEM_ID, "iniType") ?? combatant.flags?.[SYSTEM_ID]?.iniType ?? "physical";
  const ini = combatant.actor?.system?.initiative?.[type] ?? {};
  const dice = Number(ini.dicePool ?? ini.dice) || 0;
  return { major: 1, minor: 1 + dice };
}

export function actionsLeft(combatant) {
  const totals = actionTotals(combatant);
  const spent = combatant.flags?.[MODULE_ID]?.actions ?? {};
  return {
    major: { total: totals.major, left: Math.max(0, totals.major - (Number(spent.major) || 0)) },
    minor: { total: totals.minor, left: Math.max(0, totals.minor - (Number(spent.minor) || 0)) },
  };
}

/** Clicking a used pip gives the action back, clicking a free one spends it. */
async function toggle(combatant, kind, index) {
  const { [kind]: a } = actionsLeft(combatant);
  const spent = a.total - a.left;
  const next = index < spent ? index : index + 1;
  await combatant.setFlag(MODULE_ID, "actions", { ...(combatant.getFlag(MODULE_ID, "actions") ?? {}), [kind]: Math.min(a.total, next) });
}

Hooks.on("renderCombatTracker", (app, html) => {
  if (game.system.id !== SYSTEM_ID || !game.settings.get(MODULE_ID, "trackActions")) return;
  const root = html instanceof HTMLElement ? html : html?.[0];
  const combat = app.viewed ?? game.combat;
  if (!root || !combat?.started) return;
  for (const li of root.querySelectorAll("li.combatant[data-combatant-id]")) {
    const combatant = combat.combatants.get(li.dataset.combatantId);
    if (!combatant || li.querySelector(".sre-actions")) continue;
    const left = actionsLeft(combatant);
    const box = document.createElement("div");
    box.className = "sre-actions";
    for (const kind of ["major", "minor"]) {
      const { total, left: free } = left[kind];
      for (let i = 0; i < total; i++) {
        const pip = document.createElement("button");
        pip.type = "button";
        pip.className = `sre-action-pip ${kind} ${i < total - free ? "spent" : ""}`;
        pip.dataset.tooltip = game.i18n.localize(`SRE.Actions.${kind}`);
        pip.disabled = !combatant.isOwner;
        pip.addEventListener("click", (event) => {
          event.stopPropagation();
          toggle(combatant, kind, i);
        });
        box.append(pip);
      }
    }
    li.querySelector(".token-name")?.append(box);
  }
});

/** New round: everyone gets their actions back. Only the active GM writes the flags. */
Hooks.on("updateCombat", async (combat, changes) => {
  if (!("round" in changes) || !game.users.activeGM?.isSelf) return;
  const updates = combat.combatants
    .filter((c) => c.getFlag(MODULE_ID, "actions"))
    .map((c) => ({ _id: c.id, [`flags.${MODULE_ID}.-=actions`]: null }));
  if (updates.length) await combat.updateEmbeddedDocuments("Combatant", updates);
});

Hooks.once("init", () => {
  game.settings.register(MODULE_ID, "trackActions", {
    name: "SRE.Actions.Setting.Name",
    hint: "SRE.Actions.Setting.Hint",
    scope: "world",
    config: true,
    type: Boolean,
    default: true,
    onChange: () => ui.combat?.render(),
  });
});
