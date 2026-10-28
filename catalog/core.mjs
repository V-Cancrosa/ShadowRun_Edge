/**
 * Catalog source: gear tables of the Shadowrun Sixth World core rulebook (pp. 248–301), stats only.
 * Rows are written like the rulebook tables and read by the item wizard's parser (scripts/wizard/parser.mjs);
 * tools/build_catalog.mjs fails if a row is not fully recognized.
 *
 * A row is "table line" or ["table line", options]:
 *   rating: [min, max]   item has a Rating; formulas with R follow the Rating
 *   start: n             starting Rating (default: min)
 *   mods: [names]        built-in accessories (names from the "mod" sections), installed when dropped on an actor
 *   notes: "..."         short note shown above the description
 *   fields: {...}        wizard state overrides (e.g. ammo, dv), for cells the parser cannot read
 *   set: {...}           system data overrides (e.g. vehicle stats)
 *   effects: [...]       Active Effects on the item itself ({ label, target, value, toggle })
 */

const AR_ALL = "ar";

export const SECTIONS = [
  // ───────────── Melee (pp. 248–250) ─────────────
  {
    category: "melee", subtype: "BLADES", page: 249,
    rows: [
      "Combat axe 5P 9/—/—/—/— 4 500¥",
      ["Combat knife 3P 8/2*/—/—/— 2 220¥", { notes: "Rzucany: maks. zasięg 20 m." }],
      "Forearm snap blades 3P 6/—/—/—/— 3 185¥",
      ["Knife 2P 6/1*/—/—/— 1 20¥", { notes: "Rzucany: maks. zasięg 20 m." }],
      "Katana 4P 10/—/—/—/— 3 350¥",
      "Polearm 4P 8/—/—/—/— 2 210¥",
      ["Survival knife 4P 8/2*/—/—/— 2 250¥", { notes: "Rzucany: maks. zasięg 20 m." }],
      "Sword 3P 9/—/—/—/— 3 320¥",
    ],
  },
  {
    category: "melee", subtype: "CLUBS", page: 249,
    rows: [
      "Club 3S 6/—/—/—/— 1 65¥",
      "Extendable baton 2S 5/—/—/—/— 2 52¥",
      "Sap 2S 6/—/—/—/— 1 75¥",
      "Staff 4S 8/—/—/—/— 1 150¥",
      ["Stun baton 5S(e) 6/—/—/—/— 2 600¥", { notes: "10 ładunków." }],
      "Telescoping staff 4S 8/—/—/—/— 2 250¥",
    ],
  },
  {
    category: "melee", subtype: "UNARMED", page: 250,
    rows: [
      "Bike chain 2S 5/—/—/—/— 1 15¥",
      "Knucks 3P 6/—/—/—/— 1 100¥",
      ["Shock gloves 4S(e) 5/—/—/—/— 4 790¥", { notes: "10 ładunków." }],
    ],
  },
  {
    category: "melee", subtype: "WHIPS", page: 250,
    rows: [
      "Bullwhip 1P 6/—/—/—/— 4 255¥",
      "Monofilament whip 6P 14/—/—/—/— 6(I) 1,300¥",
    ],
  },

  // ───────────── Thrown / projectile (p. 250) ─────────────
  {
    category: "projectile", subtype: "BOWS", page: 250,
    rows: [
      ["Bow", {
        rating: [1, 14], start: 4,
        fields: { dv: "R/2", ar: ["R/2", "R", "R/4", "", ""], avail: "R/3", legality: "L", price: "100+R*10" },
        notes: "Stopień = minimalna Siła (maks. 14).",
      }],
    ],
  },
  {
    category: "projectile", subtype: "CROSSBOWS", page: 250,
    rows: [
      ["Crossbow, Light 2P 6/8/2/—/— 3 150¥", { fields: { ammo: "4" } }],
      ["Crossbow, Standard 3P 2/10/4/2/— 3(L) 290¥", { fields: { ammo: "4" } }],
      ["Crossbow, Heavy 4P 2/8/6/4/— 4(L) 425¥", { fields: { ammo: "4" } }],
    ],
  },
  {
    category: "projectile", subtype: "THROWING", page: 250,
    rows: [
      "Throwing knives 2P 10/9/3/—/— 2 155¥",
      "Throwing stars 2P 9/11/5/—/— 2 160¥",
    ],
  },

  // ───────────── Firearms (pp. 251–258) ─────────────
  {
    category: "firearm", subtype: "TASERS", page: 251,
    rows: [
      ["Defiance Super Shock 6S(e) SS 10/6*/—/—/— 4(m) 1 340¥", { notes: "Maks. zasięg 20 m." }],
      ["Yamaha Pulsar I 4S(e) SS 9/9†/—/—/— 4(m) 1 325¥", { notes: "Maks. zasięg 50 m." }],
      ["Yamaha Pulsar II 4S(e) SS 9/9†/—/—/— 4(m) 1 350¥", { notes: "Maks. zasięg 50 m. Styki w rękojeści do walki wręcz (jak pałka)." }],
    ],
  },
  {
    category: "firearm", subtype: "HOLDOUTS", page: 253,
    rows: [
      "Fichetti Tiffani Needler 3P SS 10/6/2/—/— 4(c) 2 435¥",
      "Streetline Special 2P SS 8/8/—/—/— 6(c) 2 200¥",
      "Walther Palm Pistol 2P SS/BF 12/7/—/—/— 6(b) 2 345¥",
    ],
  },
  {
    category: "firearm", subtype: "PISTOLS_LIGHT", page: 253,
    rows: [
      ["Ares Light Fire 70 2P SA 10/7/6/—/— 16(c) 3(L) 350¥", { mods: ["Silencer/suppressor", "Laser sight (built-in)"] }],
      ["Ares Light Fire 75 2P SA 10/7/6/—/— 16(c) 3(L) 400¥", { mods: ["Silencer/suppressor", "Smartgun system, internal", "Laser sight (built-in)"] }],
      "Beretta 101T 2P SA 9/8/6/—/— 21(c) 2(L) 260¥",
      ["Beretta 201T 2P SA/FA 9/8/6/—/— 21(c) 3(L) 460¥", { notes: "Odłączana kolba." }],
      "Colt America L36 2P SA 8/8/6/—/— 11(c) 2(L) 230¥",
      ["Fichetti Security 600 2P SA 10/9/6/—/— 30(c) 3(L) 390¥", { mods: ["Laser sight (built-in)"], notes: "Odłączana składana kolba." }],
      "Ruger Redhawk 3P SA/BF 7/10/7/—/— 8(cy) 2(L) 250¥",
    ],
  },
  {
    category: "firearm", subtype: "MACHINE_PISTOLS", page: 254,
    rows: [
      ["Ares Crusader II 2P SA/BF 9/9/7/—/— 40(c) 4(L) 520¥", { mods: ["Gas-vent system", "Smartgun system, internal"] }],
      ["Ceska Black Scorpion 2P SA/BF 10/9/8/—/— 35(c) 3(L) 510¥", { notes: "Zintegrowana składana kolba." }],
      ["Steyr TMP 2P SA/FA 8/8/6/—/— 30(c) 3(L) 690¥", { mods: ["Laser sight (built-in)"] }],
    ],
  },
  {
    category: "firearm", subtype: "PISTOLS_HEAVY", page: 255,
    rows: [
      ["Ares Predator VI 3P SA/BF 10/10/8/—/— 15(c) 2(L) 750¥", { mods: ["Smartgun system, internal"] }],
      ["Ares Viper Slivergun 4P(f) SA/BF 12/8/6/—/— 30(c) 4(L) 610¥", { mods: ["Silencer/suppressor"], notes: "Strzela amunicją strzałkową (f)." }],
      ["Browning Ultra Power 3P SA 10/9/6/—/— 10(c) 2(L) 315¥", { mods: ["Laser sight (built-in)"] }],
      ["Colt Government 2076 3P SA 10/8/6/—/— 14(c) 3(L) 275¥", { mods: ["Laser sight (built-in)"] }],
      ["Colt Manhunter 3P SA 10/8/6/—/— 14(c) 3(L) 500¥", { mods: ["Laser sight (built-in)", "Smartgun system, internal"] }],
      "Ruger Super Warhawk 4P SA 8/11/8/—/— 6(cy) 3(L) 400¥",
    ],
  },
  {
    category: "firearm", subtype: "SUBMACHINE_GUNS", page: 255,
    rows: [
      ["Colt Cobra TZ-100 3P SA/BF 9/9/6/—/— 32(c) 2(L) 730¥", { notes: "Zintegrowana składana kolba." }],
      ["Colt Cobra TZ-110 3P SA/BF 10/10/7/—/— 32(c) 2(L) 785¥", { mods: ["Laser sight (built-in)"], notes: "Zintegrowana składana kolba." }],
      ["Colt Cobra TZ-120 3P SA/BF 10/11/8/—/— 32(c) 3(L) 840¥", { mods: ["Laser sight (built-in)", "Gas-vent system"], notes: "Zintegrowana składana kolba." }],
      ["FN P93 Praetor 4P SA/BF/FA 9/12/7/—/— 50(c) 4(L) 925¥", { mods: ["Laser sight (built-in)"], notes: "Sztywna kolba, latarka (zwykła/słabe światło/termowizja)." }],
      ["HK-227 3P SA/BF 10/11/8/—/— 28(c) 3(L) 825¥", { mods: ["Smartgun system, internal", "Silencer/suppressor"], notes: "Wysuwana kolba." }],
      ["Ingram Smartgun XI 3P SA/BF 11/9/6/—/— 32(c) 3(L) 750¥", { mods: ["Gas-vent system", "Smartgun system, internal", "Silencer/suppressor"] }],
      ["SCK Model 100 3P SA/BF 10/10/7/—/— 30(c) 3(L) 725¥", { mods: ["Smartgun system, internal"], notes: "Składana kolba." }],
      ["Uzi IV 3P SA/BF/FA 8/8/7/—/— 24(c) 2(L) 455¥", { mods: ["Laser sight (built-in)"], notes: "Zintegrowana składana kolba." }],
    ],
  },
  {
    category: "firearm", subtype: "SHOTGUNS", page: 256,
    rows: [
      "Defiance T-250 4P SS/SA 7/10/6/—/— 5(m) 2(L) 330¥",
      "Defiance T-250 (short barrel) 3P SS/SA 8/8/4/—/— 5(m) 2(L) 330¥",
      ["Mossberg CMDT 4P SA/BF 4/11/7/—/— 10(c) 4(L) 700¥", { mods: ["Laser sight (built-in)"], notes: "Można załadować bęben 24 naboi." }],
      ["PJSS Model 55 4P SA/BF 3/12/8/—/— 2(b) 5(L) 325¥", { mods: ["Shock pad"], notes: "Seria tylko krótka (oba lufy). Sztywna kolba." }],
      ["Remington Roomsweeper 5P SA 9/8/4/—/— 8(m) 2(L) 325¥", { notes: "Może strzelać amunicją do ciężkich pistoletów." }],
    ],
  },
  {
    category: "firearm", subtype: "RIFLE_ASSAULT", page: 257,
    rows: [
      "AK-97 5P SA/BF/FA 4/11/9/7/1 38(c) 2(L) 2,100¥",
      ["Ares Alpha 4P SA/BF/FA 4/10/9/7/2 42(c) 5(L) 3,400¥", { mods: ["Smartgun system, internal"], notes: "Zintegrowany granatnik podlufowy (osobny przedmiot w katalogu)." }],
      ["Colt M23 4P SA/BF/FA 5/8/8/8/4 40(c) 2(L) 5,100¥", { notes: "Przyjmuje dwa dodatkowe akcesoria podlufowe." }],
      ["FN-HAR 5P SA/BF/FA 3/11/10/6/1 35(c) 3(L) 2,100¥", { mods: ["Laser sight (built-in)", "Gas-vent system"] }],
      ["Yamaha Raiden 4P SA/BF/FA 4/11/10/7/2 60(c) 5(L) 3,200¥", { mods: ["Silencer/suppressor", "Smartgun system, internal"], notes: "Zintegrowany granatnik i strzelba podlufowa (osobne przedmioty w katalogu)." }],
    ],
  },
  {
    category: "firearm", subtype: "RIFLE_SNIPER", page: 257,
    rows: [
      ["Ares Desert Strike 5P SA/BF/FA 3/10/10/10/10 14(c) 4(I) 11,000¥", { mods: ["Shock pad", "Imaging scope"] }],
      ["Cavalier Arms Crockett EBR 5P SA/BF 3/8/11/8/8 20(c) 5(I) 9,050¥", { mods: ["Shock pad", "Imaging scope"] }],
      ["Ranger Arms SM-6 5P SA 3/6/9/11/12 15(c) 5(I) 13,200¥", { mods: ["Silencer/suppressor", "Imaging scope", "Smartgun system, internal", "Shock pad"], notes: "W tabeli podręcznika jako SM-5. Składanie/rozkładanie: Broń palna + Logika (6, akcja główna), test rozszerzony." }],
      ["Barret Model 122 6P SA 1/8/11/16/14 10(c) 6(I) 15,200¥", { mods: ["Silencer/suppressor", "Smartgun system, internal", "Bipod"] }],
    ],
  },
  {
    category: "firearm", subtype: "RIFLE_HUNTING", page: 257,
    rows: [
      ["Remington 900 5P SA 2/7/10/12/11 5(m) 3(L) 12,000¥", { mods: ["Imaging scope"], notes: "Nie przyjmuje akcesoriów podlufowych." }],
      ["Ruger 101 5P SA 2/6/10/12/11 8(m) 2(L) 11,100¥", { mods: ["Imaging scope", "Shock pad"] }],
    ],
  },
  {
    category: "firearm", subtype: "LMG", page: 257,
    rows: [
      ["Ingram Valiant 4P SA/BF/FA 2/11/12/7/3 50(c) 4(L) 4,175¥", { mods: ["Shock pad", "Laser sight (built-in)", "Gas-vent system"], notes: "Magazynek 50 lub taśma 100." }],
    ],
  },
  {
    category: "firearm", subtype: "MMG", page: 257,
    rows: [
      ["Stoner-Ares M202 5P SA/BF/FA 1/10/11/7/6 50(c) 4(L) 6,900¥", { notes: "Magazynek 50 lub taśma 100. Wymaga Siły 3+." }],
    ],
  },
  {
    category: "firearm", subtype: "HMG", page: 257,
    rows: [
      ["RPK HMG 6P SA/BF/FA 1/10/12/8/7 50(c) 5(L) 8,000¥", { mods: ["Tripod"], notes: "Magazynek 50 lub taśma 100. Wymaga Siły 5+." }],
    ],
  },
  {
    category: "firearm", subtype: "ASSAULT_CANNON", page: 257,
    rows: [
      ["Panther XXL 7P SA 1/9/12/8/6 15(c) 6(I) 10,000¥", { mods: ["Smartgun system, internal"] }],
    ],
  },

  // ───────────── Special weapons and launchers (pp. 258–259) ─────────────
  {
    category: "special", subtype: "DMSO", page: 258,
    rows: [
      ["Ares Super Squirt SS 8/12/9/—/— 20(c) 3(L) 560¥", { notes: "Bez obrażeń; dostarcza substancję kontaktową (DMSO)." }],
    ],
  },
  {
    category: "special", subtype: "DART", page: 258,
    rows: [
      ["Parashield DART Pistol 1P SS 9/10/8/—/— 5(c) 2 510¥", { notes: "+ ładunek toksyny/narkotyku." }],
      ["Parashield DART Rifle 1P SS 5/8/11/3/— 6(m) 3 710¥", { mods: ["Imaging scope"], notes: "+ ładunek toksyny/narkotyku." }],
    ],
  },
  {
    category: "special", subtype: "LAUNCHERS", page: 259,
    rows: [
      ["Ares Antioch II SS —/6/8/6/5 8(m) 3(I) 5,900¥", { mods: ["Smartgun system, internal"], notes: "Obrażenia jak granat." }],
      ["ArmTech MGL-6 SA —/8/8/3/— 6(c) 4(I) 1,800¥", { notes: "Obrażenia jak granat." }],
      ["ArmTech MGL-12 SA —/8/9/6/2 12(c) 4(I) 5,000¥", { notes: "Obrażenia jak granat." }],
      ["Aztechnology Striker SS —/4/10/9/6 1(ml) 5(I) 7,000¥", { notes: "Obrażenia jak rakieta/pocisk." }],
      ["Onotari Interceptor SS —/5/9/10/8 2(ml) 5(I) 9,000¥", { mods: ["Smartgun system, internal"], notes: "Obrażenia jak rakieta/pocisk. Dwie lufy." }],
      ["Ares Alpha grenade launcher SS 4/10/6/2/— 6(c)", { notes: "Granatnik podlufowy Ares Alpha. Obrażenia jak granat." }],
      ["Yamaha Raiden grenade launcher SS 4/11/7/1/— 4(c)", { notes: "Granatnik podlufowy Yamaha Raiden. Obrażenia jak granat." }],
    ],
  },
  {
    category: "firearm", subtype: "SHOTGUNS", page: 257,
    rows: [
      ["Yamaha Raiden underbarrel shotgun 4P SS/SA 7/9/8/—/— 2(b)", { notes: "Strzelba podlufowa Yamaha Raiden." }],
    ],
  },

  // ───────────── Weapon accessories (pp. 259–261) ─────────────
  {
    category: "mod", type: "accessory_weapon", page: 261,
    rows: [
      ["Airburst link 3 600¥", { notes: "Do granatników i wyrzutni rakiet; wymaga trybu bezprzewodowego." }],
      ["Bipod 1 200¥", { notes: "Montaż: pod lufą.", effects: [
        { label: "Dwójnóg rozłożony", target: AR_ALL, value: "2", toggle: true },
        { label: "Dwójnóg: bezprzewodowo, leżąc lub siedząc", target: AR_ALL, value: "1", toggle: true },
      ] }],
      "Concealable holster 1 150¥",
      ["Gas-vent system 3 500¥", { notes: "Montaż: lufa. Usuwa karę WA za ogień półautomatyczny, za serię zmniejsza do 2." }],
      ["Gyro mount 3 1,400¥", { notes: "Montaż: pod lufą. Znosi karę WA za SA i BF, +3 WA przy FA." }],
      "Hidden arm slide 2 350¥",
      ["Imaging scope 1 350¥", { notes: "Montaż: góra. Pojemność 3 na ulepszenia wizji." }],
      ["Laser sight 1 125¥", { notes: "Montaż: góra lub pod lufą. Nie sumuje się ze smartlinkiem.", effects: [
        { label: "Celownik laserowy", target: AR_ALL, value: "1" },
        { label: "Celownik laserowy (bezprzewodowo)", target: AR_ALL, value: "1", toggle: true },
      ] }],
      ["Laser sight (built-in) 1 0¥", { notes: "Wbudowany celownik laserowy: premia +1 WA jest już wliczona w WA broni.", effects: [
        { label: "Celownik laserowy (bezprzewodowo)", target: AR_ALL, value: "1", toggle: true },
      ] }],
      ["Periscope 2 70¥", { notes: "Montaż: góra." }],
      "Quick-draw holster 2 175¥",
      "Shock pad 2 50¥",
      ["Silencer/suppressor 4 500¥", { notes: "Montaż: lufa. +2 do progu testów Percepcji, by zauważyć strzał. Nie dla rewolwerów i strzelb." }],
      ["Smart firing platform 5 2,500¥", { notes: "Montaż: pod lufą." }],
      ["Smartgun system, internal 1(L) 500¥", { notes: "Wewnętrzny: +500¥ do ceny broni.", effects: [
        { label: "Smartgun ze smartlinkiem", target: AR_ALL, value: "2", toggle: true },
      ] }],
      ["Smartgun system, external 2(L) 200¥", { notes: "Montaż: góra lub pod lufą.", effects: [
        { label: "Smartgun ze smartlinkiem", target: AR_ALL, value: "2", toggle: true },
      ] }],
      "Spare clip 2 5¥",
      "Speed loader 1 25¥",
      ["Tripod 2 500¥", { notes: "Montaż: pod lufą. Znosi karę WA za SA i BF, +3 WA przy FA." }],
    ],
  },

  // ───────────── Ammunition and explosives (pp. 261–264) ─────────────
  ...ammoSections(),
  {
    category: "ammo", subtype: "GRENADES", page: 263,
    rows: [
      ["Stun grenade 4(L) 100¥", { notes: "DV 10S / 8S / 6S, wybuch 15 m. Oślepienie I, Ogłuszenie I, Oszołomienie." }],
      ["Fragmentation grenade 4(I) 150¥", { notes: "DV 16P / 12P / 8P, wybuch 20 m." }],
      ["High explosive grenade 4(I) 150¥", { notes: "DV 16P / 10P / 4P, wybuch 15 m." }],
      ["Gas grenade 4(I) 50¥", { notes: "+ 20 dawek substancji." }],
      "Smoke/thermal smoke grenade 4(I) 50¥",
      ["Flash-pak 4(L) 125¥", { notes: "Oślepienie III / II / I, 10 m. 10 ładunków." }],
    ],
  },
  {
    category: "ammo", subtype: "ROCKETS", page: 264,
    rows: [
      ["Anti-vehicle rocket 5(I) 2,800¥", { notes: "DV 12P / 8P / 4P, wybuch 10 m." }],
      ["Fragmentation rocket 5(I) 2,000¥", { notes: "DV 16P / 12P / 8P, wybuch 30 m." }],
      ["High explosive rocket 5(I) 2,100¥", { notes: "DV 16P / 10P / 4P, wybuch 20 m." }],
      ["Gas rocket 4(I) 750¥", { notes: "+ 100 dawek substancji." }],
      "Smoke/thermal smoke rocket 4(I) 1,200¥",
    ],
  },
  {
    category: "ammo", subtype: "MISSILES", page: 264,
    rows: [
      ["Anti-vehicle missile 6(I)", { rating: [1, 8], fields: { price: "2800+R*500" }, notes: "Stopień = czujnik. DV 12P / 8P / 4P, wybuch 10 m. +2 WA." }],
      ["Fragmentation missile 6(I)", { rating: [1, 8], fields: { price: "2000+R*500" }, notes: "Stopień = czujnik. DV 16P / 12P / 8P, wybuch 30 m. +2 WA." }],
      ["High explosive missile 6(I)", { rating: [1, 8], fields: { price: "2100+R*500" }, notes: "Stopień = czujnik. DV 16P / 10P / 4P, wybuch 20 m. +2 WA." }],
    ],
  },
  {
    category: "ammo", subtype: "EXPLOSIVES", page: 264,
    rows: [
      ["Explosive package (1–3)", { rating: [1, 3], fields: { price: "R*10" } }],
      ["Explosive package (4–6)", { rating: [4, 6], fields: { price: "R*50" } }],
      ["Explosive package (7–9)", { rating: [7, 9], fields: { price: "R*100" } }],
      ["Explosive package (10–12)", { rating: [10, 12], fields: { price: "R*250" } }],
      ["Explosive package (13–15)", { rating: [13, 15], fields: { price: "R*500" } }],
      ["Explosive package (16–18)", { rating: [16, 18], fields: { price: "R*1000" } }],
      ["Explosive package (19–20)", { rating: [19, 20], fields: { price: "R*5000" } }],
    ],
  },

  // ───────────── Clothing and armor (pp. 265–267) ─────────────
  {
    category: "armor", subtype: "ARMOR_CLOTHES", page: 265,
    rows: [
      ["Clothing 0 0 1 10¥", { notes: "Cena 10¥–10 000¥ zależnie od stylu." }],
      "Synthleather jacket +1 3 1 300¥",
      "Armor clothing +2 4 2 500¥",
    ],
  },
  {
    category: "armor", subtype: "ARMOR_SOCIAL", page: 266,
    rows: [
      ["Actioneer business clothes +2 6 2 1,500¥", { notes: "Kabura ukryta w marynarce (jak kabura do ukrycia)." }],
    ],
  },
  {
    category: "armor", subtype: "ARMOR_BODY", page: 266,
    rows: [
      "Armor jacket +4 8 2 1,000¥",
      "Armor vest +3 6 2 750¥",
      ["Chameleon suit +2 4 4(I) 2,000¥", { notes: "Premia Edge do testów Skradania (ukrywanie się).", effects: [
        { label: "Kombinezon kameleon (bezprzewodowo)", target: "defense", value: "2", toggle: true },
      ] }],
      "Full body armor +5 10 4(L) 2,000¥",
      ["Full body armor helmet +2 6 — 500¥", { notes: "Hełm do pełnego pancerza; pojemność 6 na ulepszenia wizji/słuchu." }],
      ["Lined coat +3 7 2 900¥", { notes: "Premia Edge przeciw testom wykrycia schowanych pod nim przedmiotów." }],
      ["Urban explorer jumpsuit +3 6 2 800¥", { notes: "Wbudowany odtwarzacz muzyki i biomonitor." }],
    ],
  },
  {
    category: "armor", subtype: "ARMOR_HELMET", page: 267,
    rows: ["Helmet +1 4 1 200¥"],
  },
  {
    category: "armor", subtype: "ARMOR_SHIELD", page: 267,
    rows: [
      ["Ballistic shield +2 2 4 900¥", { notes: "Atak tarczą (broń egzotyczna): 2S, WA 4/—/—/—/—." }],
      ["Riot shield +2 2 4 1,200¥", { notes: "Atak (Walka wręcz, jak pałka ogłuszająca): 4S(e), WA 4/—/—/—/—. 10 ładunków." }],
    ],
  },
  {
    category: "mod", type: "armor_mod", page: 266,
    rows: [
      ["Chemical protection [R] 3 R*250¥", { rating: [1, 6], notes: "Neutralizuje stan Żrący tyle razy, ile wynosi Stopień." }],
      ["Chemical seal [6] 5 3,000¥", { notes: "Tylko do pełnego pancerza." }],
      ["Cold resistance [R] 3 R*250¥", { rating: [1, 6], notes: "Znosi stan Wychłodzenie tyle razy, ile wynosi Stopień." }],
      ["Fire resistance [R] 3 R*250¥", { rating: [1, 6], notes: "Znosi stan Płonący tyle razy, ile wynosi Stopień." }],
      ["Electricity resistance [R] 3 R*250¥", { rating: [1, 6], notes: "Znosi stan Porażony tyle razy, ile wynosi Stopień." }],
      ["Electrochromic feature 1 75¥", { notes: "Do ubrań i pancerzy." }],
      ["Feedback feature 2 150¥", { notes: "Do ubrań i pancerzy." }],
    ],
  },

  // ───────────── Electronics (pp. 267–273) ─────────────
  {
    category: "electronics", subtype: "COMMLINK", page: 267,
    rows: [
      "Meta Link 1 1/0 0 2 100¥",
      "Sony Emperor 2 1/1 1 2 700¥",
      "Renraku Sensei 3 2/0 1 2 1,000¥",
      "Erika Elite 4 2/1 2 2 2,500¥",
      "Hermes Ikon 5 3/0 2 3 5,000¥",
      "Transys Avalon 6 3/1 3 3 8,000¥",
    ],
  },
  {
    category: "electronics", subtype: "CYBERDECK", page: 267,
    rows: [
      "Erika MCD-6 1 4/3 2 3(I) 24,750¥",
      "Spinrad Falcon 2 5/4 4 3(I) 61,500¥",
      "MCT 360 3 6/5 6 3(I) 107,000¥",
      "Renraku Kitsune 4 7/6 8 4(I) 95,000¥",
      "Shiawase Cyber-6 5 8/7 10 5(I) 172,500¥",
      "Fairlight Excalibur 6 9/8 12 8(I) 410,600¥",
    ],
  },
  {
    category: "electronics", subtype: "ELECTRONIC_ACCESSORIES", page: 268, columns: ["rating", "avail", "price"],
    rows: [
      "AR gloves 3 1 150¥",
      "Biometric reader 3 2 200¥",
      "Electronic paper 1 1 5¥",
      "Printer 3 1 25¥",
      "Satellite link 4 3 500¥",
      "Simrig 3 4 1,000¥",
      "Subvocal mic 3 2 50¥",
      "Trid projector 3 1 200¥",
      "Trodes 3 1 70¥",
    ],
  },
  {
    category: "electronics", subtype: "RFID", page: 269, columns: ["rating", "avail", "price"],
    rows: [
      ["Standard tags (10) 1 1 1¥", { notes: "Paczka 10 sztuk." }],
      ["Security/stealth tags (10) 3 2 10¥", { notes: "Paczka 10 sztuk." }],
      ["Sensor tags (10) 2 2 40¥", { notes: "Paczka 10 sztuk." }],
    ],
  },
  {
    category: "electronics", subtype: "FILE_STORAGE", page: 269, columns: ["rating", "avail", "price"],
    rows: [["Datachips (10) 1 1 5¥", { notes: "Paczka 10 sztuk." }]],
  },
  {
    category: "electronics", subtype: "COMMUNICATION", page: 270, columns: ["rating", "avail", "price"],
    rows: [
      ["Headjammer 5(I) R*150¥", { rating: [1, 6] }],
      ["Jammer, area 4(L) R*200¥", { rating: [1, 6], notes: "Szum = Stopień, −1 co 10 m." }],
      ["Jammer, directional 4(L) R*200¥", { rating: [1, 6], notes: "Szum = Stopień, stożek 30°, −1 co 30 m." }],
      "Micro-transceiver 2 1 100¥",
    ],
  },
  {
    category: "electronics", subtype: "SECURITY", page: 270, columns: ["rating", "avail", "price"],
    rows: [
      "Bug scanner 3 200¥",
      ["White noise generator 3 R*50¥", { rating: [1, 6] }],
    ],
  },
  {
    category: "electronics", subtype: "BREAKING", page: 270, columns: ["rating", "avail", "price"],
    rows: [
      "Data tap 2 300¥",
      ["Tag eraser 3 450¥", { notes: "10 polów obrażeń matrycowych, zasięg 5 mm." }],
    ],
  },
  {
    category: "electronics", subtype: "ID_CREDIT", page: 273, columns: ["rating", "avail", "price"],
    rows: [
      ["Credstick, standard 1 5¥", { notes: "Maks. 5 000¥." }],
      ["Credstick, silver 1 20¥", { notes: "Maks. 20 000¥." }],
      ["Credstick, gold 2 100¥", { notes: "Maks. 100 000¥." }],
      ["Credstick, platinum 3 500¥", { notes: "Maks. 500 000¥." }],
      ["Credstick, ebony 5 1,000¥", { notes: "Maks. 1 000 000¥." }],
    ],
  },
  {
    category: "electronics", subtype: "OPTICAL", page: 274, columns: ["rating", "avail", "price"],
    rows: [
      ["Binoculars 1 R*50¥", { rating: [1, 3], fields: { capacity: "R" }, notes: "Stopień = pojemność." }],
      "Binoculars, optical 1 50¥",
      ["Camera 1 R*100¥", { rating: [1, 6], fields: { capacity: "R" }, notes: "Stopień = pojemność." }],
      ["Micro-camera 1 100¥", { fields: { capacity: "1" } }],
      ["Contacts 2 R*200¥", { rating: [1, 3], fields: { capacity: "R" }, notes: "Stopień = pojemność." }],
      "Endoscope 3 250¥",
      ["Glasses 1 R*100¥", { rating: [1, 4], fields: { capacity: "R" }, notes: "Stopień = pojemność." }],
      ["Goggles 1 R*50¥", { rating: [1, 6], fields: { capacity: "R" }, notes: "Stopień = pojemność." }],
      ["Monocle 1 R*120¥", { rating: [1, 4], fields: { capacity: "R" }, notes: "Stopień = pojemność." }],
      "Mage sight goggles 5 3,000¥",
    ],
  },
  {
    category: "mod", type: "visual_enhancement", page: 275,
    rows: [
      ["Flare compensation [1] 1 250¥", { notes: "Premia Edge przeciw oślepiającemu światłu." }],
      "Image link [1] 1 25¥",
      ["Low-light vision [1] 2 500¥", { notes: "Premia Edge przy słabym świetle." }],
      "Smartlink [2] 2 2,000¥",
      "Thermographic vision [1] 2 500¥",
      "Ultrasound link [1] 1 300¥",
      ["Vision enhancement [2] 1 500¥", { notes: "+1 kość do wzrokowych testów Percepcji." }],
      ["Vision magnification [1] 1 250¥", { notes: "+2 WA na średnim, dalekim i ekstremalnym zasięgu." }],
    ],
  },
  {
    category: "electronics", subtype: "AUDIO", page: 276, columns: ["rating", "avail", "price"],
    rows: [
      ["Directional microphone 2 R*50¥", { rating: [1, 6], fields: { capacity: "R" }, notes: "Stopień = pojemność." }],
      ["Earbuds 1 R*50¥", { rating: [1, 3], fields: { capacity: "R" }, notes: "Stopień = pojemność." }],
      ["Headphones 1 R*50¥", { rating: [1, 6], fields: { capacity: "R" }, notes: "Stopień = pojemność." }],
      ["Laser microphone 2 R*100¥", { rating: [1, 6], fields: { capacity: "R" }, notes: "Stopień = pojemność. Zasięg 100 m." }],
      ["Omni-directional microphone 1 R*50¥", { rating: [1, 6], fields: { capacity: "R" }, notes: "Stopień = pojemność." }],
    ],
  },
  {
    category: "mod", type: "audio_enhancement", page: 276,
    rows: [
      ["Audio enhancement [1] 1 500¥", { notes: "+1 kość do słuchowych testów Percepcji." }],
      ["Select sound filter [R] 3 R*250¥", { rating: [1, 3] }],
      ["Spatial recognizer [2] 2 1,000¥", { notes: "Premia Edge do lokalizowania źródła dźwięku." }],
    ],
  },
  {
    category: "electronics", subtype: "SENSOR_HOUSING", page: 277, columns: ["rating", "avail", "price"],
    rows: [
      ["Handheld housing 1 R*100¥", { rating: [1, 3], fields: { capacity: "R" }, notes: "Stopień = pojemność." }],
      ["Wall-mounted housing 1 R*250¥", { rating: [1, 6], fields: { capacity: "R" }, notes: "Stopień = pojemność." }],
      ["Sensor array 3 R*1,000¥", { rating: [2, 8] }],
      ["Single sensor [1] 2 R*100¥", { rating: [1, 8] }],
    ],
  },
  {
    category: "electronics", subtype: "SECURITY", page: 278, columns: ["rating", "avail", "price"],
    rows: [
      "Containment manacles 3 250¥",
      ["Lock 2 R*10¥", { rating: [1, 6] }],
      ["Maglock 3 R*100¥", { rating: [1, 9] }],
      "Keypad 1 50¥",
      "Card reader 1 50¥",
      "Metal restraints 1 20¥",
      "Plasteel restraints 2 50¥",
      ["Plastic straps (10) 1 5¥", { notes: "Paczka 10 sztuk." }],
    ],
  },
  {
    category: "electronics", subtype: "BREAKING", page: 279, columns: ["rating", "avail", "price"],
    rows: [
      ["Autopicker 4 R*500¥", { rating: [1, 6] }],
      ["Cellular glove molder 6(I) R*500¥", { rating: [1, 4] }],
      ["Keycard copier 4(I) R*600¥", { rating: [1, 6] }],
      ["Maglock passkey 3(I) R*2,000¥", { rating: [1, 4] }],
      ["Sequencer 4(I) R*250¥", { rating: [1, 6] }],
    ],
  },

  // ───────────── Software (pp. 271–272) ─────────────
  {
    category: "software", type: "SOFTWARE", subtype: "OTHER_PROGRAMS", page: 272, folder: ["Oprogramowanie", "Agenci"],
    rows: [["Agent R R*1,500¥", { rating: [1, 6] }]],
  },
  {
    itemType: "software", softwareType: "AUTOSOFT", page: 272,
    rows: [["Autosoft R R*500¥", { rating: [1, 6] }]],
  },
  {
    itemType: "software", softwareType: "STANDARD", page: 272,
    rows: ["Cyberprogram, basic 1 60¥"],
  },
  {
    itemType: "software", softwareType: "HACKING", page: 272,
    rows: ["Cyberprogram, hacking 4 250¥"],
  },
  {
    itemType: "software", softwareType: "DATASOFT", page: 272,
    rows: ["Datasoft 2 120¥"],
  },
  {
    itemType: "software", softwareType: "MAPSOFT", page: 272,
    rows: [["Mapsoft 2 100¥", { notes: "+1 kość do testów orientacji w terenie." }]],
  },
  {
    itemType: "software", softwareType: "SHOPSOFT", page: 272,
    rows: [["Shopsoft 2 150¥", { notes: "+1 kość do testów Wpływu przy kupnie i sprzedaży." }]],
  },
  {
    itemType: "software", softwareType: "TALENTSOFT", page: 272,
    rows: [
      ["Activesoft 4 R*5,000¥", { rating: [1, 6], notes: "Wymaga skillwires." }],
      ["Knowsoft 2 2,500¥", { notes: "Wymaga skilljacka." }],
      ["Linguasoft 1 R*1,500¥", { rating: [1, 4], notes: "Wymaga skilljacka." }],
    ],
  },
  {
    itemType: "software", softwareType: "TEACHSOFT", page: 272,
    rows: [["Tutorsoft R/3 R*400¥", { rating: [1, 6], notes: "Uczy z pulą Stopień × 2." }]],
  },

  // ───────────── Tools, chemicals, survival, biotech (pp. 273–282) ─────────────
  {
    category: "gear", type: "TOOLS", subtype: "TOOLS", page: 273,
    rows: [
      "Tool kit 1 500¥",
      ["Tool shop 4 5,000¥", { notes: "+1 kość do testów na miejscu." }],
      ["Tool facility 7 50,000¥", { notes: "+1 kość i premia Edge; Edge w testach rozszerzonych." }],
      "Chisel/wrecking bar 1 20¥",
      "Lockpick set 2 250¥",
      "Miniwelder 1 250¥",
      "Miniwelder fuel canister 1 80¥",
      ["Monofilament chainsaw 3 500¥", { notes: "DV 8 przeciw barierom." }],
    ],
  },
  {
    category: "gear", type: "CHEMICALS", subtype: "INDUSTRIAL_CHEMICALS", page: 279,
    rows: [
      "Glue solvent 1 90¥",
      "Glue sprayer 1 150¥",
      ["Thermite burning bar 5(L) 500¥", { notes: "10P obrażeń od ognia przeciw barierom." }],
    ],
  },
  {
    category: "gear", type: "SURVIVAL", subtype: "SURVIVAL_GEAR", page: 280,
    rows: [
      ["Chemsuit 4 R*150¥", { rating: [1, 6], notes: "Ochrona chemiczna o Stopniu kombinezonu." }],
      "Climbing gear 1 200¥",
      ["Diving gear 3 2,000¥", { notes: "Odporność na zimno 2; chroni jak maska gazowa." }],
      "Flashlight 1 25¥",
      "Gas mask 1 200¥",
      "Gecko tape gloves 3 250¥",
      "Hazmat suit 3 3,000¥",
      "Light stick 1 25¥",
      ["Magnesium torch/flare 1 5¥", { notes: "Uderzenie: 3P od ognia." }],
      "Microflare launcher 1 175¥",
      "Microflares 1 25¥",
      "Rappelling gloves 1 50¥",
      ["Respirator 1 R*50¥", { rating: [1, 6], notes: "+Stopień kości przeciw toksynom wziewnym." }],
      "Survival kit 2 200¥",
    ],
  },
  {
    category: "gear", type: "SURVIVAL", subtype: "GRAPPLE_GUN", page: 281,
    rows: [
      ["Grapple gun 3 500¥", { notes: "Jako broń (bez umiejętności): WA 1, DV 1S." }],
      ["Microwire (100 m) 2 50¥", { notes: "Bez rękawic zjazdowych rani dłonie (5P)." }],
      ["Myomeric rope (10 m) 4 200¥", { notes: "Sterowana zdalnie, 2 m na rundę." }],
      "Standard rope (100 m) 1 50¥",
      "Stealth rope (100 m) 3(I) 85¥",
      "Catalyst stick 3(I) 120¥",
    ],
  },
  {
    category: "gear", type: "BIOLOGY", subtype: "BIOTECH", page: 282,
    rows: [
      "Biomonitor 2 300¥",
      "Disposable syringe 2 10¥",
      ["Medkit 3 R*250¥", { rating: [1, 6], notes: "Liczy się jako zestaw (kit) do Biotechniki." }],
      ["Medkit supplies 1 100¥", { notes: "Uzupełnienie po każdym użyciu." }],
      ["DocWagon contract, basic 1 5,000¥", { notes: "Na rok (500¥ miesięcznie)." }],
      ["DocWagon contract, gold 1 25,000¥", { notes: "Na rok (2 500¥ miesięcznie)." }],
      ["DocWagon contract, platinum 1 50,000¥", { notes: "Na rok (5 000¥ miesięcznie)." }],
      ["DocWagon contract, super-platinum 1 100,000¥", { notes: "Na rok." }],
    ],
  },
  {
    category: "gear", type: "BIOLOGY", subtype: "SLAP_PATCHES", page: 282,
    rows: [
      "Antidote patch 3 150¥",
      ["Chem patch 3 200¥", { notes: "+ 1 dawka substancji." }],
      ["Stim patch 3 R*25¥", { rating: [1, 6], notes: "Leczy Stopień pól ogłuszenia na Stopień × 10 minut, potem Stopień + 1 ogłuszenia bez odporności." }],
      ["Tranq patch 3 0¥", { rating: [1, 12], fields: { price: "R*R*10" }, notes: "Zadaje Stopień ogłuszenia (odporność samą Budową)." }],
      ["Trauma patch 3 500¥", { notes: "Stabilizuje pacjenta z nadmiarem obrażeń." }],
    ],
  },

  // ───────────── Augmentations (pp. 283–294) ─────────────
  {
    category: "cyberware", subtype: "CYBER_HEADWARE", page: 284,
    rows: [
      ["Commlink (implant) 0.2 [2] 2 2,000¥", { notes: "+ cena komlinka. Zawiera moduł sim." }],
      ["Control rig — 4(L) 0¥", { rating: [1, 3], fields: { essence: "R", price: "R*R*30000" }, notes: "+Stopień kości do testów pojazdów po wpięciu, premia Edge." }],
      "Cortex kink bomb — [1] 6(I) 10,000¥",
      "Cortex microbomb — [2] 6(I) 25,000¥",
      "Cortex area bomb — [3] 6(I) 40,000¥",
      ["Cyberdeck (implant) 0.4 [4] 4(L) 5,000¥", { notes: "+ cena cyberdeka." }],
      "Datajack 0.1 — 2 1,000¥",
      ["Datalock 0.1 — 4 R*1,000¥", { rating: [1, 12] }],
      ["Olfactory booster 0.2 — 3 R*4,000¥", { rating: [1, 3] }],
      "Simrig (implant) 0.2 — 4(L) 4,000¥",
      ["Skilljack R*0.1 — 4 R*20,000¥", { rating: [1, 6] }],
      ["Taste booster 0.2 — 3 R*3,000¥", { rating: [1, 3] }],
      "Tooth compartment — — 4 800¥",
      "Ultrasound sensor 0.3 [2] 4 36,000¥",
      ["Voice modulator 0.2 — 4(L) R*5,000¥", { rating: [1, 3] }],
    ],
  },
  {
    category: "electronics", type: "ELECTRONICS", subtype: "CYBERJACK", page: 284, columns: ["essence", "avail", "price"],
    folder: ["Cyberware", "Cyberjacki"],
    rows: [1, 2, 3, 4, 5, 6].map((r) => {
      const [df, init, avail, ess, cost] = {
        1: ["4/3", 1, "3(L)", "1", "45,000"], 2: ["5/4", 1, "3(L)", "1.5", "65,000"], 3: ["6/5", 2, "3(L)", "2", "80,000"],
        4: ["7/6", 2, "4(L)", "2.3", "95,000"], 5: ["8/7", 3, "5(L)", "2.6", "140,000"], 6: ["9/8", 3, "6(L)", "3", "210,000"],
      }[r];
      return [`Cyberjack ${df} ${ess} ${avail} ${cost}¥`, {
        name: `Cyberjack (Rating ${r})`,
        fields: { rating: String(r) },
        set: { type: "CYBERWARE", subtype: "CYBERJACK" },
        notes: `Premia do inicjatywy Matrycy: +${init}. Działa też jak datajack.`,
      }];
    }),
  },
  {
    category: "cyberware", subtype: "CYBER_EYEWARE", page: 285,
    rows: [
      ["Cybereyes (Rating 1) 0.1 1 2 1,000¥", { fields: { rating: "1" }, notes: "Wizja 20/20, image link, kamera." }],
      ["Cybereyes (Rating 2) 0.2 4 2 4,000¥", { fields: { rating: "2" }, notes: "Wizja 20/20, image link, kamera." }],
      ["Cybereyes (Rating 3) 0.3 8 3 6,000¥", { fields: { rating: "3" }, notes: "Wizja 20/20, image link, kamera." }],
      ["Cybereyes (Rating 4) 0.4 12 3 10,000¥", { fields: { rating: "4" }, notes: "Wizja 20/20, image link, kamera." }],
      ["Cybereyes (Rating 5) 0.5 16 3 16,000¥", { fields: { rating: "5" }, notes: "Wizja 20/20, image link, kamera." }],
      "Flare compensation (implant) 0.1 [1] 2 1,000¥",
      "Image link (implant) 0.1 — 2 800¥",
      "Low-light vision (implant) 0.1 [2] 2 1,500¥",
      "Ocular drone 0.3 [6] 3 6,000¥",
      ["Retinal duplication 0.1 [1] 5(I) R*20,000¥", { rating: [1, 6] }],
      "Smartlink (implant) 0.2 [3] 3(L) 4,000¥",
      "Thermographic vision (implant) 0.1 [2] 2 2,000¥",
      "Vision enhancement (implant) 0.1 [2] 3 4,000¥",
      "Vision magnification (implant) 0.1 [2] 3 2,000¥",
    ],
  },
  {
    category: "cyberware", subtype: "CYBER_EARWARE", page: 286,
    rows: [
      ["Cyberears (Rating 1) 0.1 1 2 1,000¥", { fields: { rating: "1" } }],
      ["Cyberears (Rating 2) 0.2 4 2 3,000¥", { fields: { rating: "2" } }],
      ["Cyberears (Rating 3) 0.3 8 3 4,500¥", { fields: { rating: "3" } }],
      ["Cyberears (Rating 4) 0.4 12 3 7,500¥", { fields: { rating: "4" } }],
      ["Cyberears (Rating 5) 0.5 16 3 11,000¥", { fields: { rating: "5" } }],
      "Audio enhancement (implant) 0.1 [1] 2 4,000¥",
      ["Balance augmenter 0.1 [4] 3 8,000¥", { notes: "+1 kość do testów równowagi." }],
      "Damper 0.1 [1] 2 2,250¥",
      ["Select sound filter (implant) 0.1 [R] 4 R*3,500¥", { rating: [1, 6] }],
      "Sound link 0.1 — 2 1,000¥",
      "Spatial recognizer (implant) 0.1 [2] 3 4,000¥",
    ],
  },
  {
    category: "cyberware", subtype: "CYBER_BODYWARE", page: 288,
    rows: [
      ["Bone lacing (plastic) 0.5 — 3(L) 8,000¥", { notes: "Budowa +1 (odporność na obrażenia fizyczne), obrona +1, bez broni 3P, WA +1." }],
      ["Bone lacing (aluminum) 1 — 4(L) 18,000¥", { notes: "Budowa +2 (odporność na obrażenia fizyczne), obrona +1, bez broni 4P, WA +2." }],
      ["Bone lacing (titanium) 1.5 — 6(L) 30,000¥", { notes: "Budowa +2 (odporność na obrażenia fizyczne), obrona +2, bez broni 4P, WA +3." }],
      ["Dermal plating R*0.3 — 4(L) R*4,000¥", { rating: [1, 4], notes: "+Stopień do Wartości Obrony." }],
      "Fingertip compartment 0.1 [1] 2 3,000¥",
      "Grapple gun (implant) 0.5 [4] 3 5,000¥",
      ["Internal air tank 0.25 [R] 2 R*4,500¥", { rating: [1, 4] }],
      ["Muscle replacement R*0.7 — 3(L) R*30,000¥", { rating: [1, 4], notes: "+Stopień do Siły i Zręczności." }],
      ["Reaction enhancers R*0.3 — 4(L) R*15,000¥", { rating: [1, 4], notes: "+Stopień do Reakcji." }],
      ["Skillwires R*0.1 — 4 R*20,000¥", { rating: [1, 6] }],
      "Smuggling compartment 0.2 [2] 3 7,500¥",
      ["Wired reflexes 1 1 — 3(L) 40,000¥", { notes: "+1 Reakcja, +1 kość inicjatywy, +1 akcja poboczna." }],
      ["Wired reflexes 2 2 — 3(L) 150,000¥", { notes: "+2 Reakcja, +2 kości inicjatywy, +2 akcje poboczne." }],
      ["Wired reflexes 3 3 — 4(I) 250,000¥", { notes: "+3 Reakcja, +3 kości inicjatywy, +3 akcje poboczne." }],
      ["Wired reflexes 4 4 — 6(I) 400,000¥", { notes: "+4 Reakcja, +4 kości inicjatywy, +4 akcje poboczne." }],
    ],
  },
  {
    category: "cyberware", subtype: "CYBER_LIMBS", page: 289,
    rows: [
      ["Skull", 0.75, 5, 15000, 2, 10000, 4],
      ["Torso", 1.5, 4, 25000, 5, 20000, 10],
      ["Arm", 1, 4, 20000, 8, 15000, 15],
      ["Forearm", 0.45, 3, 12000, 5, 10000, 10],
      ["Hand", 0.25, 3, 6000, 2, 5000, 4],
      ["Leg", 1, 4, 20000, 10, 15000, 20],
      ["Lower leg", 0.45, 4, 12000, 6, 10000, 12],
      ["Foot", 0.25, 4, 6000, 2, 5000, 4],
    ].flatMap(([limb, ess, avail, synCost, synCap, obvCost, obvCap]) => [
      [`Cyber ${limb.toLowerCase()} (synthetic) ${ess} ${synCap} ${avail} ${synCost}¥`, { notes: "Atrybuty fizyczne 2; +1 pole fizycznego monitora." }],
      [`Cyber ${limb.toLowerCase()} (obvious) ${ess} ${obvCap} ${avail} ${obvCost}¥`, { notes: "Atrybuty fizyczne 2; +1 pole fizycznego monitora." }],
    ]),
  },
  {
    category: "cyberware", subtype: "CYBER_LIMBS", page: 289,
    rows: [
      ["Cyberlimb attribute increase — [R] R R*5,000¥", { rating: [1, 4], notes: "Zręczność, Pancerz lub Siła +Stopień (maks. 4)." }],
      "Cyberlimb gyromount — [8] 5(I) 6,000¥",
      "Cyberlimb slide — [3] 5(L) 3,000¥",
      "Cyberlimb holster — [5] 4 2,000¥",
      ["Hydraulic jacks — [R] 4 R*2,500¥", { rating: [1, 6], notes: "Para, po jednym w każdej nodze." }],
      "Cyberlimb smuggling compartment — [5] 2 6,000¥",
    ],
  },
  {
    category: "cyberware", subtype: "CYBER_IMPLANT_WEAPON", page: 290,
    rows: [
      ["Implanted hold-out pistol mount 0.1 [2] 3(L) 2,000¥", { notes: "Tylko miejsce na broń; pistolet kupuje się osobno." }],
      ["Implanted light pistol mount 0.25 [4] 3(L) 3,000¥", { notes: "Tylko miejsce na broń; pistolet kupuje się osobno." }],
      ["Implanted machine pistol mount 0.5 [6] 4(L) 3,500¥", { notes: "Tylko miejsce na broń." }],
      ["Implanted heavy pistol mount 0.5 [6] 4(L) 4,300¥", { notes: "Tylko miejsce na broń." }],
      ["Implanted SMG mount 1 [8] 5(L) 4,800¥", { notes: "Tylko miejsce na broń." }],
      ["Implanted shotgun mount 1.25 [10] 5(L) 8,500¥", { notes: "Tylko miejsce na broń." }],
      ["Implanted grenade launcher mount 1.5 [15] 6(I) 24,000¥", { notes: "Tylko miejsce na broń." }],
      "Implant external clip port 0.1 [1] 1 1,000¥",
      ["Implant laser sight 0.1 [1] 1 1,000¥", { notes: "Do broni wszczepionej." }],
      ["Implant silencer/suppressor 0.1 [2] 4(I) 1,000¥", { notes: "Do broni wszczepionej." }],
    ],
  },
  {
    category: "melee", subtype: "UNARMED", page: 290, folder: ["Cyberware", "Broń wszczepiana"],
    rows: [
      ["Cyberjaw 5P 2/—/—/—/— 2 1,500¥", { fields: { essence: "0.1", capacityCost: "1" }, notes: "Tylko z cyberczaszką." }],
      ["Hardening 3P 6/—/—/—/— 2 2,500¥", { fields: { essence: "0.1", capacityCost: "1" }, notes: "DV 4P przy Sile 7+." }],
      ["Shock limb 4S(e) 5/—/—/—/— 3 5,000¥", { fields: { essence: "0.25", capacityCost: "1" } }],
    ],
  },
  {
    category: "melee", subtype: "BLADES", page: 290, folder: ["Cyberware", "Broń wszczepiana"],
    rows: [
      ["Handblade 3P 6/—/—/—/— 4(I) 2,000¥", { fields: { essence: "0.15", capacityCost: "1" } }],
      ["Retractable handblade 3P 6/—/—/—/— 4(I) 2,500¥", { fields: { essence: "0.25", capacityCost: "2" }, notes: "Schowane: próg ukrycia 8." }],
      ["Hand razors 2P 6/—/—/—/— 3(I) 1,000¥", { fields: { essence: "0.15", capacityCost: "1" } }],
      ["Retractable hand razors 2P 6/—/—/—/— 3(I) 1,250¥", { fields: { essence: "0.25", capacityCost: "2" }, notes: "Schowane: próg ukrycia 8." }],
      ["Spurs 3P 7/—/—/—/— 4(I) 3,000¥", { fields: { essence: "0.15", capacityCost: "1" } }],
      ["Retractable spurs 3P 7/—/—/—/— 4(I) 5,000¥", { fields: { essence: "0.25", capacityCost: "3" }, notes: "Schowane: próg ukrycia 8." }],
    ],
  },
  {
    category: "bioware", type: "BIOWARE", subtype: "BIOWARE_STANDARD", page: 293,
    rows: [
      ["Adrenaline pump R*0.75 5(I) R*55,000¥", { rating: [1, 3] }],
      ["Bone density augmentation R*0.3 4(L) R*5,000¥", { rating: [1, 4] }],
      ["Cat's eyes 0.1 3 4,000¥", { notes: "Widzenie w słabym świetle." }],
      ["Enhanced articulation 0.2 4 30,000¥", { notes: "+1 Zręczność." }],
      ["Muscle augmentation R*0.2 4(L) R*31,000¥", { rating: [1, 4], notes: "+Stopień do Siły." }],
      ["Muscle toner R*0.2 4(L) R*32,000¥", { rating: [1, 4], notes: "+Stopień do Zręczności." }],
      ["Orthoskin R*0.25 4(L) R*6,000¥", { rating: [1, 4], notes: "+Stopień do Wartości Obrony." }],
      "Platelet factories 0.2 4 17,000¥",
      "Skin pocket 0.1 4 12,000¥",
      ["Suprathyroid gland 0.7 5(L) 140,000¥", { notes: "+1 Zręczność, Budowa, Reakcja, Siła; koszty Stylu życia +25%." }],
      ["Symbiotes R*0.2 4 R*3,500¥", { rating: [1, 4] }],
      ["Synthacardium R*0.1 3 R*30,000¥", { rating: [1, 3] }],
      ["Tailored pheromones R*0.2 4(L) R*31,000¥", { rating: [1, 4] }],
      ["Toxin extractor R*0.2 4 R*4,800¥", { rating: [1, 6] }],
      ["Tracheal filter R*0.1 4 R*4,500¥", { rating: [1, 6] }],
    ],
  },
  {
    category: "bioware", type: "BIOWARE", subtype: "BIOWARE_CULTURED", page: 294,
    rows: [
      ["Cerebral booster R*0.2 5 R*31,500¥", { rating: [1, 3], notes: "+Stopień do Logiki." }],
      ["Damage compensator R*0.1 5(L) R*2,000¥", { rating: [1, 12] }],
      ["Mnemonic enhancer R*0.1 5 R*9,000¥", { rating: [1, 3] }],
      "Pain editor 0.3 5(I) 48,000¥",
      "Reflex recorder 0.1 5 14,000¥",
      "Sleep regulator 0.1 5 12,000¥",
      ["Synaptic booster R*0.5 5(L) R*95,000¥", { rating: [1, 3], notes: "+Stopień Reakcja, kości inicjatywy i akcje poboczne." }],
    ],
  },

  // ───────────── Magic (p. 294) ─────────────
  {
    itemType: "focus", page: 294,
    rows: [
      ["Enchanting focus R(L) R*5,000¥", { rating: [1, 6], notes: "Wiązanie: Moc × 3 Karmy." }],
      ["Metamagic focus R(L) R*9,000¥", { rating: [1, 6], notes: "Wiązanie: Moc × 3 Karmy." }],
      ["Power focus R+3(L) R*18,000¥", { rating: [1, 6], notes: "Wiązanie: Moc × 6 Karmy." }],
      ["Qi focus R(L) R*3,000¥", { rating: [1, 6], notes: "Wiązanie: Moc × 2 Karmy." }],
      ["Spell focus R(L) R*4,000¥", { rating: [1, 6], notes: "Wiązanie: Moc × 2 Karmy." }],
      ["Spirit focus R(L) R*4,000¥", { rating: [1, 6], notes: "Wiązanie: Moc × 2 Karmy." }],
      ["Weapon focus R+3(L) R*7,000¥", { rating: [1, 6], notes: "Wiązanie: Moc × 3 Karmy." }],
    ],
  },
  {
    category: "gear", type: "MAGICAL", subtype: "MAGICAL_FORMULA", page: 294,
    rows: [
      "Spell formula, combat 3(L) 2,000¥",
      "Spell formula, detection 2(L) 500¥",
      "Spell formula, health 2(L) 500¥",
      "Spell formula, illusion 3(L) 1,000¥",
      "Spell formula, manipulation 3(L) 1,500¥",
    ],
  },
  {
    category: "gear", type: "MAGICAL", subtype: "MAGIC_LODGE", page: 294,
    rows: [["Magical lodge materials R(L) R*500¥", { rating: [1, 6] }]],
  },
  {
    category: "gear", type: "MAGICAL", subtype: "MAGIC_SUPPLIES", page: 294,
    rows: [["Reagents (1 dram) 2 50¥", { fields: { count: "1" } }]],
  },

  // ───────────── Vehicles and drones (pp. 295–301) ─────────────
  ...vehicleSections(),
  {
    category: "gear", type: "ACCESSORY", subtype: "ACCESSORY", page: 295, folder: ["Pojazdy i drony", "Modyfikacje pojazdów"],
    rows: [
      "Rigger interface 2 1,000¥",
      ["Standard weapon mount 4(I) 2,500¥", { notes: "Karabin szturmowy lub mniejsza broń + 250 naboi." }],
      ["Heavy weapon mount 5(I) 5,000¥", { notes: "Liczy się jak dwa stanowiska. Dowolna broń + 500 naboi taśmy lub Budowa rakiet." }],
    ],
  },
];

/** Ammunition (p. 262): price per 10 rounds by weapon class, multiplied by ammo type. */
function ammoSections() {
  const classes = [
    ["Holdout/Light Pistol/Machine Pistol", "1", 5],
    ["Heavy Pistol/SMG", "1", 10],
    ["Rifle", "2(L)", 20],
  ];
  const types = [
    ["Regular", 1, ""],
    ["APDS", 3, "WA +2, DV −1."],
    ["Explosive", 2, "DV +1. Krytyczna komplikacja niszczy broń."],
    ["Flechette", 1.5, "WA +1, DV −1."],
    ["Gel", 1.5, "Obrażenia ogłuszające; test Zręczność (2) lub Budowa (4), inaczej Powalony."],
    ["Stick-n-Shock", 2, "WA +1, DV −1, ogłuszające elektryczne (e), Porażony."],
  ];
  const rows = classes.flatMap(([cls, avail, cost]) => types.map(([type, mult, notes]) => [
    `Ammo (${cls}), ${type} ${avail} ${cost * mult}¥`,
    { fields: { count: "10" }, notes: [`Cena za 10 naboi.`, notes].filter(Boolean).join(" ") },
  ]));
  rows.push(
    ["Ammo (Taser darts) 1 10¥", { fields: { count: "10" }, notes: "Cena za 10 strzałek." }],
    ["Ammo (Injection darts) 2 5¥", { fields: { count: "10" }, notes: "Cena za 10 strzałek + toksyna." }],
    ["Ammo (Assault cannon) 4(I) 50¥", { fields: { count: "10" }, notes: "Cena za 10 naboi." }],
    ["Arrow R/3 R*2¥", { rating: [1, 14], start: 4, fields: { count: "1" }, notes: "Stopień strzały ≥ Stopień łuku." }],
    ["Injection arrow 4 R*20¥", { rating: [8, 14], fields: { count: "1" }, notes: "+ dawka substancji." }],
    ["Bolt 2 5¥", { fields: { count: "1" } }],
    ["Injection bolt 4 50¥", { fields: { count: "1" }, notes: "+ dawka substancji." }],
  );
  return [{ category: "ammo", subtype: "AMMUNITION", page: 262, rows }];
}

/** Vehicles and drones (pp. 301–302): Handling (on/off road), Accel, Speed Interval, Top Speed, Body, Armor, Pilot, Sensor, Seats, Avail, Cost. */
function vehicleSections() {
  const groups = [
    ["VEHICLES", "BIKES", "GROUND", [
      ["Dodge Scoot", "5/7", 4, 10, 80, 2, 0, 1, 0, 2, 2, 3000],
      ["Harley-Davidson Scorpion", "3/5", 16, 30, 200, 7, 6, 1, 1, 2, 2, 14000],
      ["Yamaha Growler", "3/3", 15, 20, 180, 6, 4, 1, 1, 2, 2, 8000],
      ["Suzuki Mirage", "2/6", 29, 30, 260, 4, 2, 1, 1, 1, 2, 12000],
    ]],
    ["VEHICLES", "CARS", "GROUND", [
      ["Chrysler-Nissan Jackrabbit", "3/5", 20, 15, 160, 8, 4, 2, 1, 3, 2, 11000],
      ["Honda Spirit", "4/5", 15, 20, 150, 10, 3, 1, 1, 4, 2, 13000],
      ["Eurocar Westwind X80", "2/6", 24, 30, 250, 6, 1, 4, 3, 2, 3, 115000],
      ["Hyundai Shin-Hyung", "3/5", 12, 25, 200, 7, 1, 1, 1, 3, 2, 20000],
      ["Ford Americar", "4/5", 9, 20, 160, 11, 4, 1, 2, 4, 2, 16000],
      ["Saeder-Krupp-Bentley Concordat", "3/5", 18, 30, 180, 14, 8, 3, 3, 4, 3, 65000],
      ["Mitsubishi Nightsky", "4/6", 10, 10, 160, 18, 10, 3, 4, 8, 3, 259000],
    ]],
    ["VEHICLES", "TRUCKS", "GROUND", [
      ["Toyota Gopher", "4/4", 15, 15, 150, 12, 6, 1, 1, 4, 2, 25000],
      ["Range Rover Model 2080", "4/5", 12, 20, 160, 16, 10, 4, 4, 7, 3, 73000],
    ]],
    ["VEHICLES", "VANS", "GROUND", [
      ["GMC Bulldog Step-Van", "5/7", 10, 10, 140, 16, 12, 2, 3, "2/10", 2, 35000],
      ["Ares Roadmaster", "5/7", 8, 10, 120, 18, 16, 2, 2, "2/12", 2, 68000],
    ]],
    ["VEHICLES", "BOATS", "WATER", [
      ["Samuvani Criscraft Otter", "4", 10, 15, 90, 6, 4, 2, 2, 6, 2, 25000],
      ["Aztechnology Sunrunner/Nightrunner", "3", 20, 20, 120, 10, 8, 3, 3, 5, 3, 39000],
      ["GMC Riverine", "4", 15, 15, 100, 14, 12, 4, 4, 8, 4, 113000],
    ]],
    ["VEHICLES", "SUBMARINES", "WATER", [
      ["Proteus Lamprey/Sea Snake", "3", 13, 10, 60, 2, 1, 2, 1, 4, "2/4", 15000],
      ["YNT Delfin", "5", 18, 10, 70, 6, 12, 3, 3, 3, 3, 110000],
    ]],
    ["VEHICLES", "FIXED_WING", "AIR", [
      ["Artemis Industries Nightwing", "4", 15, 25, 150, 2, 0, 1, 1, 1, 2, 20000],
      ["Cessna C750", "5", 20, 25, 250, 8, 2, 2, 1, 4, 2, 150000],
      ["MCT-Sikorsky-Bell Seahawk", "5", 30, 50, 500, 12, 4, 2, 2, 8, 2, 300000],
    ]],
    ["VEHICLES", "ROTORCRAFT", "AIR", [
      ["Ares Dragon", "4", 10, 30, 260, 12, 10, 2, 3, "2/16", 2, 360000],
      ["MCT-Sikorsky-Bell Wolfhound", "3", 20, 40, 320, 12, 14, 4, 4, 8, 4, 423000],
      ["Northrup Wasp", "3", 25, 30, 330, 10, 8, 3, 3, 2, 3, 93000],
    ]],
    ["VEHICLES", "VTOL", "AIR", [
      ["Ares Venture", "4", 40, 60, 680, 16, 12, 2, 2, "2/8", 3, 400000],
      ["GMC Banshee", "3", 60, 90, 900, 18, 18, 4, 4, "2/12", 4, 1300000],
      ["Federated Boeing Commuter", "3", 35, 60, 420, 16, 10, 2, 2, "2/10", 2, 350000],
      ["Federated Boeing Osprey X", "3", 35, 80, 420, 16, 16, 4, 4, "2/10", 4, 800000],
    ]],
    ["DRONE_MICRO", "GROUND", "GROUND", [
      ["GMC Micromachine", "3/6", 5, 5, 25, 0, 0, 1, 1, "", 2, 450],
      ["Shiawase Kanmushi", "2/3", 4, 5, 15, 0, 0, 3, 2, "", 2, 900],
    ]],
    ["DRONE_MICRO", "AIR", "AIR", [
      ["Sikorsky-Bell Microskimmer XXS", "2", 6, 10, 35, 0, 0, 2, 1, "", 2, 850],
      ["MCT Gnat", "3", 4, 10, 30, 0, 0, 2, 1, "", 2, 800],
    ]],
    ["DRONE_MINI", "GROUND", "GROUND", [
      ["GM-Nissan Flip-Flop", "2/4", 8, 15, 50, 1, 0, 2, 1, "", 2, 1000],
      ["Shiawase Inu", "2/3", 6, 8, 24, 1, 0, 2, 2, "", 2, 1100],
    ]],
    ["DRONE_MINI", "AIR", "AIR", [
      ["Horizon Flying Eye", "3", 15, 15, 40, 1, 0, 2, 2, "", 2, 2000],
      ["MCT Hornet", "3", 20, 15, 35, 1, 0, 2, 2, "", 2, 2100],
    ]],
    ["DRONE_SMALL", "GROUND", "GROUND", [
      ["Chrysler-Nissan Pursuit V", "3/6", 30, 50, 280, 4, 2, 4, 3, "", 3, 11000],
      ["Aztechnology Crawler", "3/4", 8, 10, 30, 6, 2, 2, 2, "", 2, 4500],
    ]],
    ["DRONE_SMALL", "AIR", "AIR", [
      ["Cyberspace Designs Quadrotor", "2", 15, 20, 120, 3, 1, 3, 2, "", 2, 5000],
      ["Lockheed Optic-X2", "4", 15, 30, 140, 2, 4, 4, 4, "", 3, 18000],
    ]],
    ["DRONE_MEDIUM", "GROUND", "GROUND", [
      ["GM-Nissan Doberman", "3/5", 10, 15, 100, 4, 6, 2, 3, "", 2, 6500],
    ]],
    ["DRONE_MEDIUM", "ANTHRO", "GROUND", [
      ["Nissan Samurai", "3/4", 10, 10, 30, 6, 6, 3, 2, "", 2, 4500],
    ]],
    ["DRONE_MEDIUM", "AIR", "AIR", [
      ["MCT-Nissan Roto-Drone", "3", 20, 30, 160, 5, 6, 3, 2, "", 2, 5000],
      ["Federated Boeing Blackhawk", "3", 35, 40, 200, 8, 6, 3, 3, "", 3, 8000],
    ]],
    ["DRONE_LARGE", "GROUND", "GROUND", [
      ["Steel Lynx Combat Drone", "3/5", 15, 15, 80, 12, 16, 4, 4, "", 4, 25000],
    ]],
    ["DRONE_LARGE", "ANTHRO", "GROUND", [
      ["Nissan Oni", "3/4", 10, 8, 30, 9, 10, 3, 2, "", 2, 6700],
      ["Ares Packmule", "3/4", 6, 5, 30, 8, 6, 2, 1, "", 3, 10000],
    ]],
    ["DRONE_LARGE", "AIR", "AIR", [
      ["Cyberspace Designs Dalmatian", "3", 13, 20, 130, 6, 4, 3, 3, "", 3, 10000],
      ["Ares Black Sky", "2", 25, 50, 300, 8, 10, 4, 4, "", 5, 43000],
    ]],
  ];
  return groups.map(([type, subtype, vtype, vehicles]) => ({
    category: "gear", type, subtype, page: 301, folder: ["Pojazdy i drony"], vehicle: true, columns: ["avail", "price"],
    rows: vehicles.map(([name, hand, acc, spdi, tspd, bod, arm, pil, sen, sea, avail, cost]) => {
      const [handlOn, handlOff = handlOn] = String(hand).split("/").map(Number);
      const seats = String(sea);
      return [`${name} ${avail} ${cost}¥`, {
        set: {
          handlOn, handlOff, accOn: acc, accOff: acc, spdiOn: spdi, spdiOff: spdi, tspd,
          bod, arm, pil, sen, sea: Number(seats.split("/").pop()) || 0, vtype,
        },
        notes: seats.includes("/") ? `Miejsca: ${seats}.` : "",
      }];
    }),
  }));
}
