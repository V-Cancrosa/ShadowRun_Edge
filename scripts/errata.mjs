/**
 * Official Shadowrun, Sixth World core rulebook errata (Catalyst, August 2019 and February 2020) as world
 * settings. Each erratum the module implements is listed in ERRATA with the page it changes; a document
 * switched off means the first-print text applies. Later errata win over earlier ones where both touch a rule.
 */
const MODULE_ID = "shadowrun-edge";

export const ERRATA = {
  aug2019: {
    setting: "errataAug2019",
    rules: [
      { id: "exceptionalOnce", page: 71 }, // Exceptional (Attribute): purchased once
    ],
  },
  feb2020: {
    setting: "errataFeb2020",
    rules: [
      { id: "tiesToAttacker", page: 105 }, // Step 3: ties go to the attacker
      { id: "exceptionalPerAttribute", page: 71 }, // Exceptional: once per attribute (replaces "once")
      { id: "essenceLowersMagicMax", page: 167 }, // max Magic/Resonance 6 + grade, −1 per full Essence point lost (also p. 195)
    ],
  },
};

/** Is this erratum in force? Outside Foundry (tests) everything defaults to the errata being on. */
export function errata(ruleId) {
  for (const doc of Object.values(ERRATA)) {
    if (!doc.rules.some((r) => r.id === ruleId)) continue;
    try {
      return game.settings.get(MODULE_ID, doc.setting) !== false;
    } catch {
      return true;
    }
  }
  return false;
}

/** All rule switches as a plain object, for pure code that takes them as options. */
export function errataFlags() {
  return Object.fromEntries(Object.values(ERRATA).flatMap((d) => d.rules).map((r) => [r.id, errata(r.id)]));
}

Hooks.once("init", () => {
  for (const [id, doc] of Object.entries(ERRATA)) {
    game.settings.register(MODULE_ID, doc.setting, {
      name: `SRE.Errata.${id}.Name`,
      hint: `SRE.Errata.${id}.Hint`,
      scope: "world",
      config: true,
      type: Boolean,
      default: true,
      requiresReload: false,
    });
  }
});
