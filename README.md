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
- **Karta Edge**: nowa karta postaci gracza według karty z podręcznika (siedem zakładek, od walki po kontakty).
- **Karta Edge przedmiotu** i **przekazywanie przedmiotów** innym postaciom (z dodatkami), usuwanie przedmiotów.
- **Wygląd „Edge”** kart postaci, czatu i okna rzutu (ciemny lub jasny, do wyłączenia).

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

Od wersji 0.9.0 kreator ma wygląd Karty Edge (ten sam nagłówek, kafelki budżetów i zakładki).

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

## Karta Edge

Dodatkowa karta postaci gracza, ułożona jak karta z podręcznika SR6. Włączasz ją w nagłówku karty:
*Konfiguruj kartę → Karta Edge (Shadowrun Edge)*. Karta systemu zostaje domyślna, a obie korzystają z tych samych
danych, więc można się przełączać w każdej chwili.

Zakładka **Główna** (wersja 0.6.0):
- nagłówek z Karmą, nuyenami, Reputacją, Heat i Esencją; Edge jako romby do klikania (limit 7);
- monitory fizyczny, ogłuszenia i nadmiaru w kratkach (kliknięcie kratki ustawia obrażenia) i łączna kara za rany;
- inicjatywa fizyczna, astralna i matrycowa z rzutem oraz liczbą akcji w rundzie (1 większa + 1 mniejsza
  i 1 mniejsza za każdą kość inicjatywy);
- obrona: Defense Rating, test obrony (REA + INT) i wytrzymanie (BUD), ruch i Dźwiganie;
- szybkie rzuty (obrona, wytrzymanie, percepcja, opanowanie, ocena intencji, pamięć);
- „W ręku”: broń z DV, trybami ognia, WA, amunicją (przycisk *Przeładuj*) i czary z pulą i drenażem.

Zakładka **Atrybuty i umiejętności** (0.7.0):
- kafelki atrybutów z edycją bazy, modyfikatorem (wszczepy, cechy, efekty) i maksimum metatypu (z tekstu metatypu:
  Człowiek/Elf/Krasnolud/Ork/Troll; atrybut na maksimum świeci na złoto), Magia/Rezonans, Edge (limit 7), Esencja;
  kliknięcie kafelka to test atrybutu;
- umiejętności czynne: punkty, pula, specjalizacja (+2) i ekspertyza (+3) z osobnym rzutem, filtr
  *wszystkie / wyszkolone*; przy umiejętnościach bez testu bez szkolenia jest ostrzeżenie;
- umiejętności wiedzy i języki (SR6: bez poziomów; język może być ojczysty) z dodawaniem i usuwaniem.

Zakładka **Walka** (0.7.0):
- broń dystansowa: DV, tryby, WA dla 5 zasięgów, dodatki, amunicja z wyborem rodzaju i przeładowaniem, pula, atak;
- walka wręcz z wierszem *Bez broni* (DV = SIŁ/2 ogłuszenia, WA = REA + SIŁ);
- pancerz z przełącznikiem *Założony* i Defense Rating;
- obrona i odporności: obrona fizyczna/astralna, czary bezpośrednie/pośrednie/inne, toksyny, wytrzymanie.

Zakładka **Magia** (0.8.0, tylko postacie przebudzone): Magia, tradycja, odporność na drenaż (rzut), WA i DR astralne;
czary z kategorią, typem, zasięgiem, czasem, drenażem i przełącznikiem *Podtrzymany* (−2 kości za każdy
podtrzymywany czar lub formę); rytuały, foki, metamagia i moce adepta z sumą PP.

Zakładka **Matryca** (0.8.0): inicjatywa, WA/DR i percepcja matrycowa, Overwatch Score z paskiem do 40;
urządzenia (komlink, cyberdeck, konsola) z A/S/D/F i przełącznikiem *Aktywne*; persona; programy aktywnego
decku; akcje matrycowe z pulami (najczęstsze albo wszystkie); u technomanty formy złożone z zanikiem i echa.

Zakładka **Wszczepy i ekwipunek** (0.8.0): pasek Esencji, wszczepy z klasą (alfa, beta…), oceną, Esencją
i pojemnością; ekwipunek w kategoriach z licznikiem ilości; niezamontowane dodatki.

Zakładka **Kontakty i notatki** (0.8.0): kontakty z Wpływami i Lojalnością oraz rzutem Legwork (Wpływy × 2),
SIN-y, style życia, Karma/Reputacja/Heat/nuyeny do edycji, opis (system 4.x) i notatki w edytorze Foundry.

Pule pokazują już karę za rany (i za podtrzymywane czary); rzut i tak przechodzi przez okno rzutu systemu,
które odejmuje je samo.

## Karta Edge przedmiotu

Dodatkowa karta dla wszystkich przedmiotów (*Konfiguruj kartę → Karta Edge (Shadowrun Edge)* w nagłówku przedmiotu;
karta systemu zostaje domyślna, a przycisk *Karta systemu* otwiera ją w razie potrzeby).
- nagłówek z typem i podtypem, oceną, ceną, dostępnością i źródłem (podręcznik i strona);
- **Statystyki** zależne od rodzaju: broń (DV, rodzaj obrażeń, umiejętność i specjalizacja, tryby ognia, dzika kość,
  WA dla 5 zasięgów, amunicja z przeładowaniem, pula na postaci i atak), pancerz, wszczepy (klasa z podglądem Esencji,
  ceny i dostępności; Esencja, pojemność), urządzenia (ocena, A/S/D/F, programy), czary (z pulą rzucania i drenażu
  na postaci), moce adepta, cechy, foki, rytuały, formy złożone, kontakty, style życia, SIN-y;
- **Dodatki**: zamontowane mody z miejscem montażu, odmontowanie i montaż przez przeciągnięcie (zasady montażu
  modułu sprawdzają miejsce i pojemność);
- **Opis** w edytorze Foundry i **Efekty** (włączanie, edycja, usuwanie, dodawanie).

## Przekazywanie i usuwanie przedmiotów

- Na Karcie Edge postaci: **prawy przycisk** na dowolnym przedmiocie → *Otwórz*, *Przekaż*, *Usuń*.
- W nagłówku karty przedmiotu (Karty Edge i karty systemu) są przyciski *Przekaż* i *Usuń*.
- *Przekaż* pyta, której postaci gracza oddać przedmiot (przy rzeczach liczonych w sztukach — ile sztuk).
  Zamontowane dodatki idą razem z bronią czy pancerzem. Jeśli gracz nie ma praw do postaci odbiorcy, przekazanie
  wykonuje zalogowany MG (moduł sprawdza, że gracz jest właścicielem przedmiotu). Na czacie pojawia się informacja.
- *Usuń* pyta o potwierdzenie i usuwa przedmiot razem z zamontowanymi w nim dodatkami.

## Akcje w rundzie

W trackerze walki przy każdym uczestniku są kwadraty (akcja większa) i kółka (akcje mniejsze: 1 + 1 za każdą kość
inicjatywy, którą uczestnik używa — fizycznej, astralnej albo matrycowej). Kliknięcie wydaje akcję albo ją oddaje;
klikać może właściciel postaci i MG. Na początku każdej rundy akcje wracają. Wyłączasz to w ustawieniach świata
(*Licznik akcji w trackerze walki*).

## Obrona przed czarami niebojowymi i formami złożonymi

Karta rzutu czaru niebojowego z testem przeciwstawnym i formy złożonej ma przycisk *Obrona: …*. Obrońca zaznacza
swój token i klika — rzuca dwoma atrybutami przeciw sukcesom rzucającego. Remis wygrywa atakujący (errata
z lutego 2020, s. 105); po wyłączeniu tej erraty remis wygrywa obrońca.
- Formy złożone używają atrybutów obrony z danych systemu (np. Siła Woli + Firewall persony).
- Dla czarów atrybuty obrony ustawiasz na Karcie Edge czaru (z opisu czaru w podręczniku); domyślnie Budowa +
  Siła Woli, jak w FAQ Sixth World dla czarów bez podanego testu.

## Erraty SR6

Moduł trzyma się wyłącznie 6. edycji. Oficjalne erraty Catalyst do podręcznika podstawowego są przełącznikami
w ustawieniach świata (domyślnie włączone; wyłączenie = tekst z pierwszego druku):
- **Errata SR6: sierpień 2019** — Wyjątkowy atrybut kupowany tylko raz (s. 71).
- **Errata SR6: luty 2020** (nadpisuje wcześniejszą) — remis w teście przeciwstawnym wygrywa atakujący (s. 105);
  Wyjątkowy atrybut raz na każdy atrybut (s. 71); maksimum Magii/Rezonansu 6 + stopień inicjacji/zanurzenia,
  −1 za każdy pełny utracony punkt Esencji (s. 167, 195) — Karta Edge ostrzega, gdy Magia je przekracza.

Kolejne funkcje (leczenie, przywoływanie, granaty) dostaną swoje erraty do tych samych przełączników.

## Wygląd „Edge”

Moduł może zmienić wygląd systemu na styl kreatora postaci: ciemne panele, różowe i cyjanowe akcenty,
kafelki atrybutów, monitory obrażeń w kratkach (kliknięcie kratki ustawia obrażenia jak w systemie),
karty rzutów z ponumerowanymi kośćmi (trafienia na zielono, jedynki na czerwono, dzika kość na złoto)
i czerwoną kartą przy komplikacji.

- *Ustawienia → Shadowrun Edge → Wygląd systemu „Edge”*: każdy gracz wybiera **ciemny**, **jasny** albo
  **wyłączony** (oryginalny wygląd systemu).
- *Wygląd „Edge” dla wszystkich* (ustawienie świata): MG może wymusić jeden wygląd dla wszystkich albo
  zostawić **wybór gracza**.

To tylko arkusz stylów nałożony na szablony systemu, więc działa z 3.3.9 i 4.x bez zmiany kodu systemu.

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
