# Shadowrun Edge

A Shadowrun game system for [Foundry Virtual Tabletop](https://foundryvtt.com/) (v13).

## Features

- **Actors:** Character and NPC, with the eleven attributes plus Essence, Edge points, Physical and Stun condition monitors, wound modifiers and initiative (Reaction + Intuition + 1d6).
- **Items:** Skills (rating + linked attribute), Weapons (damage, attack rating, attack skill) and Gear.
- **Dice pools:** clicking an attribute, skill or weapon rolls a d6 pool. 5s and 6s are hits, and the chat card flags glitches and critical glitches.
- **Edge:** *Push the Limit* spends 1 Edge point, adds your Edge rating to the pool and makes 6s explode.
- **Languages:** English and Polish.

## Development setup

Foundry expects the system folder to be named after the system id, `shadowrun-edge`. To work from this repo, link it into your Foundry data folder. On Windows, run this in `cmd`:

```bat
mklink /J "%LOCALAPPDATA%\FoundryVTT\Data\systems\shadowrun-edge" "%USERPROFILE%\Documents\ShadowRun_Edge"
```

Then restart Foundry and create a world that uses **Shadowrun Edge**.

## Project layout

```
system.json             System manifest
shadowrun-edge.mjs      Entry point (registers data models, sheets, initiative)
module/config.mjs       Attribute and damage type lists (CONFIG.SRE)
module/data/            Actor and item data models
module/documents/       Actor document (attribute / skill / weapon rolls)
module/dice.mjs         Dice pool roller (hits, glitches, Edge)
module/sheets/          Actor and item sheets (ApplicationV2)
templates/              Handlebars templates
styles/                 CSS
lang/                   Translations
```
