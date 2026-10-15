# Shadowrun Edge

Moduł do [Foundry VTT](https://foundryvtt.com/) (v13–v14) współpracujący z systemem
**Shadowrun 6th Edition** ([`shadowrun6-eden`](https://github.com/yjeroen/foundry-shadowrun6-eden)).
Nie zmienia kodu systemu, tylko dokłada swoje rzeczy na wierzch, więc aktualizacje systemu go nie psują.

## Co zawiera

- **Pełne polskie tłumaczenie systemu:** wszystkie 2125 tekstów z `shadowrun6-eden` 4.0.11.
  Zastępuje automatyczne tłumaczenie z systemu, które pokrywa tylko ok. 34% tekstów.
- **Kreator przedmiotów** do tworzenia sprzętu tak, jak jest opisany w tabelach podręcznika.

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

## Wydanie nowej wersji

Podnieś `version` w `module.json`, zrób commit i wypchnij tag z tym numerem:

```bash
git tag v0.1.1
git push origin v0.1.1
```

Workflow `.github/workflows/release.yml` sam utworzy wydanie na GitHubie i dołączy do niego
`shadowrun-edge.zip` oraz `module.json`. Foundry zobaczy aktualizację przez adres manifestu.
