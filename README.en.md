# Shadowrun Edge (English summary)

A companion module for the **Shadowrun 6th Edition** system for Foundry VTT v13
([shadowrun6-eden](https://github.com/Shadowrun6Eden/foundry-shadowrun6-eden), versions 3.3.9 through 4.x).
It changes nothing in the system's code. The full manual is in Polish in [README.md](README.md) and, in the game,
in the **Shadowrun Edge** guide (Compendiums and Journal). The module's interface is translated into English;
the Polish translation of the system and the catalog's folder names are Polish.

## What it adds

- **Edge sheets** for player characters (seven tabs, from combat to contacts), NPCs and critters (with grunt groups),
  spirits, vehicles and drones, Matrix hosts (system 4.x) and items — with a light/dark switch.
- **Catalog compendium** (about 710 entries, stats only): core rulebook gear with built-in accessories, toxins and
  drugs, spells, adept powers, metamagic, complex forms, echoes and qualities, with the SR6 errata applied.
- **Character creator** (priority system) and an **item creator** that reads rulebook table rows.
- **Rules that run through the system's roll dialog**, with results that follow Edge spent after the roll:
  healing, grenades with scatter and blast zones, summoning and banishing, toxins, statuses (pp. 51–53),
  Matrix (Overwatch, Convergence, dumpshock, access levels, IC), vehicles (Handling, crashes, ramming, drones)
  and Karma advancement with an optional GM approval.
- **The GM always decides**: a rule conflict opens a window with choices instead of blocking; players cannot
  break rules unless the world allows it.
- **SR6 errata** (August 2019, February 2020) as world toggles; a “What's new” window after updates.

## Install

In Foundry: *Add-on Modules → Install Module*, manifest URL:

```
https://github.com/V-Cancrosa/ShadowRun_Edge/releases/latest/download/module.json
```

Enable it in a world using the Shadowrun 6th Edition system.

## Development

`npm test` runs the Node tests; with the [Quench](https://github.com/Ethaks/FVTT-Quench) module active, the
module's in-Foundry test batches appear in Quench. Releases are created automatically when `module.json`'s version
is raised (add the version to `data/changelog.json` in Polish and English).
