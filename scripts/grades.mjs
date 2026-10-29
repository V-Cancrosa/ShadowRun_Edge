/**
 * Implant grades (SR6 core p. 282): used, alphaware, betaware, deltaware change Essence, cost and Availability
 * of cyberware and bioware. The system has no grades, so the module keeps the standard values in a flag and
 * recalculates the item from them.
 */
const MODULE_ID = "shadowrun-edge";

export const GRADES = {
  standard: { essence: 1, cost: 1, avail: 0 },
  used: { essence: 1.1, cost: 0.5, avail: -1 },
  alpha: { essence: 0.8, cost: 1.2, avail: 1 },
  beta: { essence: 0.7, cost: 1.5, avail: 2 },
  delta: { essence: 0.5, cost: 2.5, avail: 3 },
};

const round2 = (n) => Math.round(n * 100) / 100;

/** Cyberware, bioware and other gear that costs Essence (e.g. implanted weapons). */
export function isAugmentation(item) {
  return item?.type === "gear"
    && (["CYBERWARE", "BIOWARE"].includes(item.system?.type) || Number(item.system?.essence) > 0);
}

/** Standard-grade values of an item: the stored ones, or its current stats if it has no grade yet. */
export function baseValues(system, gradeFlag) {
  if (gradeFlag?.base) return gradeFlag.base;
  return {
    essence: Number(system.essence) || 0,
    price: Number(system.price) || 0,
    avail: Number(system.avail) || 0,
    availDef: system.availDef ?? "",
  };
}

/** Item stats ("system.*" update keys) for the given standard values and grade. */
export function gradeUpdates(base, gradeId) {
  const grade = GRADES[gradeId] ?? GRADES.standard;
  const avail = Math.max(0, base.avail + grade.avail);
  const legality = String(base.availDef ?? "").match(/\(([LI])\)/)?.[1];
  return {
    "system.essence": round2(base.essence * grade.essence),
    "system.price": Math.round(base.price * grade.cost),
    "system.avail": avail,
    "system.availDef": base.availDef ? `${avail}${legality ? `(${legality})` : ""}` : "",
  };
}

const SUFFIX = /\s\((?:używane|alfa|beta|delta|used|alpha|beta|delta)\)$/i;

/** Item name with the grade in parentheses, e.g. "Datajack (alfa)". */
export function gradedName(name, label, gradeId) {
  const plain = String(name).replace(SUFFIX, "");
  return gradeId === "standard" ? plain : `${plain} (${label})`;
}

/** Applies a grade to an item, keeping its standard values so the grade can be changed back later. */
export async function applyGrade(item, gradeId) {
  const flag = item.getFlag(MODULE_ID, "grade");
  const base = baseValues(item.system, flag);
  const label = game.i18n.localize(`SRE.Grade.Short.${gradeId}`);
  await item.update({
    ...gradeUpdates(base, gradeId),
    name: gradedName(item.name, label, gradeId),
    [`flags.${MODULE_ID}.grade`]: { id: gradeId, base },
  });
}

/** Lets the player pick a grade, showing what each one costs; resolves to a grade id or null. */
export async function promptGrade(item) {
  const flag = item.getFlag(MODULE_ID, "grade");
  const base = baseValues(item.system, flag);
  const current = flag?.id ?? "standard";
  const rows = Object.keys(GRADES).map((id) => {
    const u = gradeUpdates(base, id);
    const details = game.i18n.format("SRE.Grade.Details", {
      essence: u["system.essence"], price: u["system.price"].toLocaleString(), avail: u["system.availDef"] || u["system.avail"],
    });
    return `<label class="sre-grade"><input type="radio" name="grade" value="${id}" ${id === current ? "checked" : ""}>
      <strong>${game.i18n.localize(`SRE.Grade.Name.${id}`)}</strong> <span>${details}</span></label>`;
  }).join("");
  return foundry.applications.api.DialogV2.wait({
    classes: ["sre-dialog"],
    window: { title: game.i18n.format("SRE.Grade.Title", { name: item.name.replace(SUFFIX, "") }) },
    content: `<p class="hint">${game.i18n.localize("SRE.Grade.Hint")}</p><div class="sre-grades">${rows}</div>`,
    buttons: [
      {
        action: "ok", label: game.i18n.localize("SRE.Grade.Apply"), icon: "fas fa-check", default: true,
        callback: (event, button) => button.form.elements.grade.value,
      },
      { action: "cancel", label: game.i18n.localize("Cancel") },
    ],
    rejectClose: false,
  }).then((result) => (result && result !== "cancel" ? result : null));
}

/** Asks for a grade and applies it; resolves once the item is updated (or the player cancelled). */
export async function chooseAndApply(item) {
  const gradeId = await promptGrade(item);
  if (gradeId && gradeId !== (item.getFlag(MODULE_ID, "grade")?.id ?? "standard")) await applyGrade(item, gradeId);
}

/** "Grade" button in the header of augmentation sheets, to change the grade later. */
Hooks.on("getItemSheetHeaderButtons", (sheet, buttons) => {
  const item = sheet.item;
  if (!isAugmentation(item) || !item.isOwner) return;
  const gradeId = item.getFlag(MODULE_ID, "grade")?.id ?? "standard";
  buttons.unshift({
    label: game.i18n.format("SRE.Grade.Button", { grade: game.i18n.localize(`SRE.Grade.Name.${gradeId}`) }),
    class: "sre-grade-button",
    icon: "fas fa-microchip",
    onclick: () => chooseAndApply(item),
  });
});
