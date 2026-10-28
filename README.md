# Shadowrun Edge

Moduł do [Foundry VTT](https://foundryvtt.com/) (v13–v14) współpracujący z systemem
**Shadowrun 6th Edition** ([`shadowrun6-eden`](https://github.com/yjeroen/foundry-shadowrun6-eden)).
Nie zmienia kodu systemu, tylko dokłada swoje rzeczy na wierzch, więc aktualizacje systemu go nie psują.

## Co zawiera

- **Pełne polskie tłumaczenie systemu:** wszystkie 2125 tekstów z `shadowrun6-eden` 4.0.11.
  Zastępuje automatyczne tłumaczenie z systemu, które pokrywa tylko ok. 34% tekstów.
- **Katalog sprzętu z podręcznika podstawowego** (kompendium *Katalog Shadowrun Edge*, ok. 500 pozycji):
  broń, akcesoria, amunicja, materiały wybuchowe, pancerze i ich modyfikacje, elektronika, oprogramowanie,
  cyberware, bioware, sprzęt, magia, pojazdy i drony. Przeciągasz przedmiot na kartę postaci i gotowe.
- **Kreator przedmiotów** do tworzenia sprzętu tak, jak jest opisany w tabelach podręcznika.

## Katalog sprzętu

W zakładce *Kompendia* jest folder **Shadowrun Edge** z kompendium **Katalog Shadowrun Edge**. Przedmioty
są ułożone w folderach jak w rozdziale *Gear* (s. 245–301): np. *Broń palna / Ciężki pistolet*,
*Cyberware / Cyberware ciała*, *Pojazdy i drony / Pojazdy / Motocykl*.

- **Przeciągnij na kartę postaci** — przedmiot trafia do ekwipunku z kompletem statystyk: DV, tryby ognia,
  WA na pięciu zasięgach, magazynek, umiejętność i specjalizacja do rzutu, WO pancerza, Esencja, atrybuty
  Matrycy, statystyki pojazdów, dostępność i cena.
- **Wyposażenie standardowe montuje się samo.** Np. Ares Predator VI po przeciągnięciu na postać dostaje
  zamontowany smartgun, Ingram Smartgun XI — gas-vent, smartgun i tłumik. Na karcie broni widać je w sekcji
  modyfikacji systemu.
- **Efekty dodatków:** celownik laserowy daje +1 WA (a w trybie bezprzewodowym kolejne +1 do włączenia),
  smartgun +2 WA do włączenia, gdy postać ma smartlink, dwójnóg +2 WA po rozłożeniu. Efekty włączane
  przełącza się na karcie przedmiotu (zakładka efektów). Wbudowany celownik laserowy ma już premię wliczoną
  w WA broni, więc daje tylko premię bezprzewodową.
- **Przedmioty ze Stopniem** (medkit, skilljack, mięśnie zastępcze, odporność na ogień…) przeliczają
  cenę, Esencję, dostępność i pojemność, gdy zmienisz Stopień na karcie przedmiotu.
- **Wszczepy działają na postać.** Mięśnie zastępcze dodają Stopień do Siły i Zręczności, wired reflexes —
  Reakcję i kości inicjatywy, płytki skórne i orthoskin — WO, bone lacing — WO i odporność na obrażenia,
  cyberjack — inicjatywę w Matrycy itd. Premia ze Stopniem rośnie razem ze Stopniem przedmiotu; system
  sam ogranicza premię do atrybutu do +4. Wszczepy działające tylko w pewnych sytuacjach (pompa adrenaliny,
  edytor bólu, feromony, synthacardium, filtr tchawicy) mają efekt **do włączenia** na karcie przedmiotu.
- **Klasy wszczepów (s. 282).** Po przeciągnięciu cyberware lub bioware na postać moduł pyta o klasę:
  standardowa, używana, alfa, beta, delta — i przelicza Esencję, cenę i dostępność (np. datajack alfa:
  Esencja 0,08). Klasę zmienisz później przyciskiem **Klasa** w nagłówku karty przedmiotu. Przy imporcie
  wielu przedmiotów naraz moduł nie pyta. Pytanie można wyłączyć w ustawieniach modułu.
- **Zakupy.** Po przeciągnięciu przedmiotu z ceną na postać gracza pojawia się okno zakupu: cena,
  dostępność, ostrzeżenie o licencji (L) lub nielegalności (I), ilość paczek (amunicja, plastry), dopłata
  +10% za rozmiar (troll za wszystko, krasnolud za pancerz i ubrania — moduł rozpoznaje to z pola
  metatypu) i stan nuyenów. **Kup** odejmuje nuyeny i wysyła MG wiadomość na czacie, **Za darmo** zostawia
  przedmiot bez płacenia (sprzęt startowy, łup), **Nie dodawaj** usuwa przedmiot. Wszczepy najpierw pytają
  o klasę, bo zmienia ona cenę. Przy przenoszeniu wielu przedmiotów naraz moduł nie pyta.
- **Mocowania i pojemność.** Każde mocowanie broni (góra, lufa, pod lufą) mieści jedno akcesorium, a liczba
  mocowań zależy od rodzaju broni (s. 251–258; np. paralizator — tylko góra, Colt M23 — trzy pod lufą,
  pistolety bez spodu). Akcesorium „góra lub pod lufą” zajmuje pierwsze wolne. Modyfikacje pancerza
  i ulepszenia urządzeń nie mogą przekroczyć ich pojemności. Na karcie broni lub pancerza postaci widać,
  co jest zamontowane i ile pojemności zostało. W ustawieniach modułu: blokuj montaż / tylko ostrzegaj /
  wyłącz. Mody z kompendium systemu nie mają zapisanych mocowań, więc nie są sprawdzane.
- Modyfikacje pancerza (odporność na ogień, zimno, prąd, chemię) i akcesoria do broni montujesz,
  przeciągając je na kartę pancerza/broni postaci.

Katalog zawiera tylko statystyki, nazwy i numery stron — bez opisów z podręcznika. Krótkie notatki przy
przedmiotach (np. „Montaż: lufa”) są streszczeniami zasad. Premie, na które system nie ma pola (dodatkowe akcje
poboczne z wired reflexes, obrażenia bez broni z bone lacing), opisuje notatka przy przedmiocie.

Kompendium jest zablokowane do edycji, a przy aktualizacji modułu zostaje nadpisane. Własne przedmioty
twórz kreatorem w **Katalogu własnym (świat)**.

## Kreator postaci

Przycisk **Kreator postaci** jest w zakładce *Aktorzy* (dla każdego, kto może tworzyć aktorów; makro:
`game.modules.get("shadowrun-edge").api.openCharacterCreator()`). Prowadzi przez tworzenie postaci
według rozdziału *Character Creation* (s. 62–69), a na górze okna cały czas widać budżety: punkty atrybutów,
dostosowania i umiejętności, Karmę, kontakty, wiedzę i nuyeny. Na dole jest lista tego, co jeszcze się nie
zgadza.

1. **Priorytety:** imię, koncepcja, poziom gry (standardowy / uliczny — wartości z rzędu niżej / prime —
   100 Karmy), rzędy A–E dla pięciu kolumn (każdy raz), metatyp dostępny w wybranym rzędzie i typ magii.
2. **Atrybuty:** punkty atrybutów, punkty dostosowania (tylko Edge, Magia/Rezonans i atrybuty rasowe powyżej
   6) i dodatkowe poziomy za Karmę według tabeli z s. 69. Tylko jeden atrybut na maksimum.
3. **Umiejętności:** punkty, Karma, specjalizacje (1 punkt albo 5 Karmy). Maks. 6, z Aptitude 7, tylko
   jedna na maksimum.
4. **Cechy:** pełna lista zalet i wad z kosztami. Najwyżej 6 cech, wady najwyżej 20 Karmy netto. Exceptional,
   Impaired, Aptitude, Incompetent i In Debt zmieniają limity i przeliczenia. Cechy rasowe dochodzą same.
5. **Karma i kontakty:** Karma na nuyeny (2000¥, z In Debt 5000¥), kontakty (Charyzma × 6 punktów),
   umiejętności wiedzy i języki (Logika za darmo + język ojczysty, kolejne po 3 Karmy).
6. **Podsumowanie** i **Utwórz postać**: powstaje zwykła postać gracza systemu z atrybutami, Edge, magią,
   umiejętnościami, specjalizacjami, cechami (Built Tough, Glass Jaw, Will to Live i Dermal Deposits od
   razu zmieniają monitory i WO), wiedzą, językami, kontaktami, pozostałą Karmą i nuyenami.

Sprzęt kupuje się potem z katalogu — okno zakupu odejmuje nuyeny postaci. Wybór czarów, mocy adepta i form
złożonych dojdzie w kolejnej wersji; kreator pokazuje, ile ich przysługuje. MG może utworzyć postać mimo
błędów (zaznaczenie w podsumowaniu).

## Głosowanie Karmy

MG ma w zakładce *Aktorzy* przycisk **Głosowanie Karmy** (albo makro:
`game.modules.get("shadowrun-edge").api.startKarmaVote()`).

1. MG wybiera postacie graczy, maksimum Karmy w jednym głosie i czy gracze mogą głosować na własną postać
   (domyślnie nie).
2. Na czacie pojawia się karta z postaciami. Każdy klika, ile Karmy proponuje każdej postaci. Głos można
   zmieniać do końca, a wybrana wartość jest podświetlona. Gracze widzą tylko liczbę głosów, MG widzi też
   średnią.
3. **Zakończ i przyznaj** (tylko MG): okno z propozycją dla każdej postaci (zaokrąglona średnia), którą MG
   może zmienić. Karma dopisuje się do bieżącej i łącznej Karmy postaci, a karta pokazuje wynik.

Głosy graczy trafiają do MG przez gniazdo modułu, więc MG musi być zalogowany.

## Kreator przedmiotów

Przycisk **Kreator przedmiotów** jest w zakładce *Przedmioty* (przedmiot trafia do świata) i w nagłówku
karty postaci, NPC i pojazdu (przedmiot trafia od razu do ekwipunku).

1. **Rodzaj:** wybierz kategorię jak w podręczniku (broń palna, broń do walki wręcz, pancerz, cyberware,
   elektronika…) i podtyp. Kreator sam ustawia rzut: np. ciężki pistolet → *Broń palna / Ciężkie pistolety*,
   łuk → *Atletyka / Łucznictwo*.
2. **Wiersz z podręcznika:** skopiuj wiersz z tabeli w PDF-ie i kliknij **Rozpoznaj**, np.
   `Pistolet 3P SA/BF 10/10/8/—/— 15(c) 2(L) 750¥`. Kreator wypełni DV, tryby ognia, pięć wartości WA,
   magazynek, dostępność z legalnością i cenę. Kolumny są czytane w kolejności z tabel podręcznika
   (pancerz: WO, pojemność, dostępność, cena; cyberware: esencja, pojemność, dostępność, cena itd.).
3. **Parametry:** popraw lub uzupełnij pola. Wartości zależne od Stopnia wpisuj jak w podręczniku,
   np. esencja `R*0.1`, cena `R*1000`, dostępność `R+2`; kreator przeliczy je dla wybranego Stopnia.

**Cel:** na górze kreatora wybierasz, gdzie powstanie przedmiot: ekwipunek postaci, zakładka *Przedmioty*
albo **Katalog własny** (tylko MG).

**Cała tabela naraz:** wklej kilka wierszy (każdy przedmiot w osobnej linii) i kliknij *Rozpoznaj*.
Kreator pokaże podgląd wszystkich pozycji, a *Utwórz wszystkie* doda je jednym kliknięciem.

### Katalog własny

Katalog własny to kompendium świata **Katalog własny (świat)**, tworzone przy pierwszym dodaniu przedmiotu.
Kreator sam układa przedmioty w folderach według kategorii i podtypu z podręcznika
(np. *Broń palna / Ciężkie pistolety*). Gotowy przedmiot wystarczy przeciągnąć z katalogu na kartę
postaci — trafia do ekwipunku z kompletem statystyk.

### Dodatki (mody)

- **Nowy dodatek:** kategoria *Dodatki i modyfikacje* tworzy przedmiot typu `mod` systemu
  (akcesorium broni, modyfikacja broni, modyfikacja pancerza, akcesorium elektroniki…). Dodajesz mu
  efekty: WA (wszystkie zasięgi lub wybrany), DV, WO pancerza, Społeczne, magazynek. Premia do WA
  nie dodaje się do zasięgów, na których broń nie strzela („—”) — pilnuje tego system.
  W kategoriach *Cyberware* i *Bioware* efekty działają na postać (atrybuty, inicjatywa, WO, odporności). Wartość może
  zależeć od Stopnia (`R`). Efekt **włączany** startuje wyłączony i włącza się go na karcie przedmiotu,
  gdy ma zastosowanie — np. rozłożony dwójnóg albo odporność na ogień tylko przeciw atakom ogniem.
- **Montowanie:** dodatek przeciągnięty na kartę broni/pancerza **należącego do postaci** montuje
  system `shadowrun6-eden`; efekty od razu zmieniają przedmiot (np. WA +2).
- **Wbudowane dodatki:** w kreatorze przeciągnij dodatki (tłumik, celownik, modyfikacje pancerza) do pola
  *Wbudowane dodatki*. Gdy taki przedmiot trafi na postać (z katalogu albo prosto z kreatora), moduł sam
  utworzy i zamontuje te dodatki. System ma też własne kompendium *Gear Mods* z częścią dodatków
  z podręcznika podstawowego.

**Wzorce:** MG może zapisać wypełniony formularz przyciskiem *Zapisz jako wzorzec*. Wzorce są zapisywane
w świecie i dostępne dla wszystkich graczy w kreatorze, więc wystarczy raz przepisać sprzęt z podręcznika.

Kreator tworzy zwykłe przedmioty systemu `shadowrun6-eden` (typ `gear`), więc po utworzeniu można je
edytować na standardowej karcie przedmiotu. Z konsoli: `game.modules.get("shadowrun-edge").api.openItemWizard()`.

## Instalacja

**Z adresu manifestu** (po opublikowaniu pierwszego wydania na GitHubie): w Foundry otwórz
*Add-on Modules → Install Module* i wklej:

```
https://github.com/V-Cancrosa/ShadowRun_Edge/releases/latest/download/module.json
```

**Do rozwijania modułu** podlinkuj ten folder do katalogu modułów Foundry (w `cmd`):

```bat
mklink /J "%LOCALAPPDATA%\FoundryVTT\Data\modules\shadowrun-edge" "%USERPROFILE%\Documents\ShadowRun_Edge"
```

Potem w świecie z systemem Shadowrun 6th Edition włącz moduł (*Manage Modules*) i ustaw język
Foundry na **Polski** (*Configure Settings → Core → Language*).

## Słowniczek

Najważniejsze pojęcia użyte w tłumaczeniu. Jeśli wolisz inne, wystarczy podmienić je w
`lang/pl/shadowrun6-eden.json`.

| Angielski | Polski |
| --- | --- |
| Edge, Edge Boost, Edge Action | Edge, wzmocnienie Edge, akcja Edge |
| Attack Rating (AR) / Defense Rating (DR) | Wartość Ataku (WA) / Wartość Obrony (WO) |
| Damage Value (DV) | DV (obrażenia) |
| Hits / net hits, Glitch | sukcesy / sukcesy netto, komplikacja |
| Major / Minor Action | akcja główna / poboczna |
| Physical / Stun / Overflow | fizyczne / ogłuszenie / nadmiar |
| Soak, Drain, Fading | odporność, drenaż, zanikanie |
| Grunt, Critter, Spirit | płotka, stworzenie, duch |
| Matrix, Overwatch Score (OS) | Matryca, Wynik Nadzoru (OS) |
| Attack / Sleaze / Data Processing / Firewall | Atak / Podstęp / Przetwarzanie danych / Zapora |
| Outsider / User / Admin | OBCY / UŻYTKOWNIK / ADMIN |
| Body, Agility, Reaction, Strength | Budowa, Zręczność, Reakcja, Siła |
| Willpower, Logic, Intuition, Charisma | Siła Woli, Logika, Intuicja, Charyzma |
| Con, Cracking, Influence, Outdoors, Tasking | Oszustwo, Łamanie zabezpieczeń, Wpływ, Przetrwanie, Zadaniowanie |

## Aktualizacja tłumaczenia po nowej wersji systemu

```bash
python tools/check_translation.py <ścieżka do shadowrun6-eden>/lang/en.json
```

Skrypt pokazuje nowe klucze do przetłumaczenia, klucze usunięte z systemu i tłumaczenia,
w których nie zgadzają się `{placeholdery}` lub znaczniki HTML.

Test rozpoznawania wierszy z podręcznika: `node tools/test_parser.mjs`.

## Budowanie katalogu

Dane katalogu są w `catalog/core.mjs`, zapisane jak wiersze tabel z podręcznika. Skrypt
`tools/build_catalog.mjs` przepuszcza je przez parser i kreator, więc przerywa budowanie, jeśli któregoś
wiersza nie rozpozna w całości. Wymaga Node.js 20+:

```bash
npm ci
npm test        # testy parsera + sprawdzenie wszystkich wierszy katalogu
npm run build   # buduje kompendium w packs/katalog
```

Przy wydaniu (tag `v*`) GitHub Actions buduje kompendium samo. Przy pracy na podlinkowanym folderze
uruchom `npm run build` raz, żeby kompendium pojawiło się w Foundry.

## Wydanie nowej wersji

Podnieś `version` w `module.json`, zrób commit i wypchnij tag z tym numerem:

```bash
git tag v0.1.1
git push origin v0.1.1
```

Workflow `.github/workflows/release.yml` sam utworzy wydanie na GitHubie i dołączy do niego
`shadowrun-edge.zip` oraz `module.json`. Foundry zobaczy aktualizację przez adres manifestu.
