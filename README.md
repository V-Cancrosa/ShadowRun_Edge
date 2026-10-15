# Shadowrun Edge

Moduł do [Foundry VTT](https://foundryvtt.com/) (v13–v14) współpracujący z systemem
**Shadowrun 6th Edition** ([`shadowrun6-eden`](https://github.com/yjeroen/foundry-shadowrun6-eden)).
Nie zmienia kodu systemu, tylko dokłada swoje rzeczy na wierzch, więc aktualizacje systemu go nie psują.

## Co zawiera

- **Pełne polskie tłumaczenie systemu:** wszystkie 2125 tekstów z `shadowrun6-eden` 4.0.11.
  Zastępuje automatyczne tłumaczenie z systemu, które pokrywa tylko ok. 34% tekstów.

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

## Wydanie nowej wersji

Opublikuj wydanie na GitHubie z tagiem np. `v0.1.0`. Workflow `.github/workflows/release.yml`
sam zbuduje `shadowrun-edge.zip` i dołączy go razem z `module.json`.
