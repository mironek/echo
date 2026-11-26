<picture>
  <source media="(prefers-color-scheme: dark)" srcset="assets/logo-dark.png">
  <img src="assets/logo-light.png" alt="Echo" width="128">
</picture>

# Echo

Wtyczka do Claude Code (terminal i aplikacja desktopowa Claude, zakładka Code), która **czyta odpowiedzi Claude'a na głos** lokalnymi głosami neuronowymi [Piper](https://github.com/OHF-Voice/piper1-gpl). Mowa powstaje w całości na Twoim komputerze: tekst nie jest nigdzie wysyłany.

Działa na Windows, macOS i Linuksie.

## Instalacja

**Wymagania:** Python 3.9 lub nowszy ([python.org](https://www.python.org/downloads/)). Na Linuksie dodatkowo odtwarzacz dźwięku: `paplay` (PulseAudio/PipeWire), `pw-play`, `aplay` albo `ffplay`.

W Claude Code (terminal):

```
/plugin install echo --marketplace mironek/echo
```

Z wiersza poleceń:

```
claude plugin install echo --marketplace mironek/echo
```

W aplikacji desktopowej: **+** obok pola wiadomości → **Plugins** → **Add marketplace**, wpisz `mironek/echo`, potem **Add plugin** przy Echo.

### Pierwsze uruchomienie

Echo samo przygotowuje wszystko w folderze danych wtyczki; na pasku widać postęp:

1. szuka Pythona i tworzy dla siebie osobne środowisko (venv),
2. instaluje Piper (`pip install piper-tts`): to trwa kilka minut, tylko za pierwszym razem,
3. uruchamia lokalny serwer mowy,
4. pobiera podstawowy pakiet głosów: angielski (Lessac) i polskie (Gosia, MC Speech), po ok. 60 MB każdy.

Od razu po instalacji: interfejs po angielsku, tryb **Live**, Głos **Auto**, dźwięki **Delikatny**, pamięć **30 dni** — wszystko to ustala plik `startup.json` (niżej).

Jeśli czegoś brakuje (np. Pythona), pasek pokaże komunikat i przycisk **Uruchom**, żeby spróbować ponownie.

### Ustawienia startowe (`startup.json`)

Plik `startup.json` w folderze wtyczki ustala, jak Echo działa zaraz po instalacji — bez żadnej konfiguracji. Zmiana pliku działa dla ustawień, których użytkownik jeszcze nie zmienił (czyli przy nowej instalacji); swoje wybory użytkownik zmienia w ⚙. Klucze zaczynające się od `_` to komentarze.

| Klucz | Domyślnie | Znaczenie |
|---|---|---|
| `uiLanguage` | `"en"` | Język interfejsu Echo: `en`, `pl`, `de`, `fr`, `it`, `es`, `pt`, `ru`, `uk`, `ja`, `zh` |
| `readingMode` | `"live"` | Tryb czytania: `manual` (Ręcznie), `final` (Wynik; dawne `auto` też działa), `live` |
| `voice` | `"auto"` | Głos: `auto` (rozpoznaje język odpowiedzi) albo kod języka, np. `pl` |
| `fallbackLanguage` | `"system"` | Język, gdy Auto nie rozpozna tekstu: `system` (język systemu, jeśli ma zainstalowany głos) albo kod języka |
| `speed` | `1.0` | Tempo czytania, 0.8–2.0 |
| `sounds` | `"soft"` | Dźwięki: `off`, `soft` (Delikatny), `bell` (Dzwonek), `drop` (Kropla) |
| `memoryDays` | `30` | Pamięć odpowiedzi czatu w dniach: `0` (wyłączona), `7`, `30`, `90` |
| `visualizer` | `"wave"` | Wizualizacja czytania: `off`, `wave` (Fala), `bars` (Słupki), `dot` (Kropka) |
| `visualizerColor` | `"orange"` | Kolor wizualizacji: `orange`, `white`, `blue`, `green`, `purple`, `pink`, `red`, `yellow` albo własny `#hex` |
| `defaultVoices` | Lessac, Gosia, MC Speech | Głosy pobierane przy pierwszym uruchomieniu (klucze z katalogu Piper) |

**Jak Echo wybiera głos bez ustawień:** w trybie Auto rozpoznaje język odpowiedzi spośród języków, które mają zainstalowany głos (polski tekst — polski głos, angielski — angielski). Gdy nie da się go rozpoznać, bierze `fallbackLanguage`, a gdy ten nie ma głosu — pierwszy zainstalowany język. W obrębie języka czyta głosem wybranym w ⚙, a bez wyboru — pierwszym zainstalowanym (dla polskiego Gosia, dla angielskiego Lessac). Wiadomości, które przyjdą, zanim pobiorą się głosy, czekają i zostaną przeczytane, gdy tylko pierwszy głos będzie gotowy.

### Instalacja z npm

Pakiet `claude-echo-tts` zawiera tę samą wtyczkę. Marketplace może wskazywać na niego zamiast na repozytorium:

```json
{
  "name": "echo-npm",
  "owner": { "name": "<autor>" },
  "plugins": [{ "name": "echo", "source": { "source": "npm", "package": "claude-echo-tts" } }]
}
```

## Pasek Echo

Pasek nad polem wiadomości:

| Element | Działanie |
|---|---|
| ▶ 3/12 / ⏸ 3/12 | Czyta bieżącą sekcję od jej początku / pauzuje ją; liczby to numer sekcji i liczba wszystkich sekcji |
| ❮ i ❯ | Poprzednia i następna sekcja; w trakcie czytania od razu ją czytają. Na pierwszej i ostatniej sekcji są wyszarzone |
| ⏹ | Zatrzymuje czytanie i wraca do pierwszej sekcji (wyszarzony, gdy nic nie jest czytane) |
| Tempo (np. 1.0×) | Szybkość czytania, 0.8× – 2.0×; zmiana działa od razu, w trakcie czytania |
| Tryb (Ręcznie / Wynik / Na żywo) | Kiedy Echo czyta samo — opis w „Kiedy Echo czyta” poniżej |
| Status (po prawej, przed ⚙) | W trakcie czytania animowana wizualizacja mowy (Fala, Słupki albo Kropka — wybór w ⚙ → Wizualizacja); poza czytaniem szary tekst: pauza, gotowy, instalacja głosu |
| ⚙ | Otwiera/zamyka panel **Ustawienia Echo** obok czatu (z własnym przewijaniem, pasek zostaje na miejscu): Głos, Lektor, + (dodaj język), Interfejs, Dźwięki, Wizualizacja, Kolor, Pamięć |
| Głos | **Auto** (rozpoznaje język odpowiedzi) albo konkretny język i głos, np. „Polski: Bass”; zmiana działa od razu |
| Lektor | Pojawia się obok listy Głos, gdy wybrany model ma kilku lektorów (np. Semaine: Obadiah, Poppy…) |
| + (obok Głos) | Przechodzi do panelu języków (panel ustawień się zamyka; wrócisz do niego przez ⚙) |
| Interfejs | Język paska, ustawień i komunikatów Echo |
| ? | Otwiera tę pomoc |

### Jak Echo zbiera tekst

Każde Twoje pytanie zaczyna od nowa: Echo przerywa czytanie, czyści poprzednią odpowiedź (licznik pokazuje 0/0, przyciski są nieaktywne) i czeka na wiadomości od Claude'a. Wiadomości, które trafiają do Claude'a w trakcie jego pracy (powiadomienia, przypomnienia systemowe, pytania dopisane do kolejki), nie czyszczą bieżącej odpowiedzi. Każda kolejna wiadomość Claude'a jest dzielona na **sekcje** i dopisywana na koniec kolejki do przeczytania; licznik rośnie na bieżąco.

Sekcja to akapit. Krótkie akapity (np. nagłówki) łączą się z następnym, a bardzo długie dzielą się na zdania. Bloki kodu, adresy linków i formatowanie są pomijane. Wiadomości subagentów nie są czytane.

### Kiedy Echo czyta

| Tryb | Co się dzieje |
|---|---|
| **Na żywo** (Live) | Każda wiadomość Claude'a jest czytana od razu, gdy się pojawi. Jeśli w trakcie czytania przyjdzie następna, Echo przeczyta ją po skończeniu bieżącej — po kolei, bez pomijania. Kolejne wiadomości oddziela cichy sygnał |
| **Wynik** | W trakcie pracy Claude'a nic nie jest czytane samo, ale sekcje się zbierają i możesz je puścić przyciskiem ▶. Gdy Claude skończy, Echo zaczyna czytać od **pierwszej sekcji ostatniej odpowiedzi** — tekstu napisanego po ostatnim użyciu narzędzia, czyli podsumowania z wynikami (bez narzędzi: od sekcji 1). Wcześniejsze sekcje zostają: wrócisz do nich przyciskiem ❮. Przerwana odpowiedź (np. gdy zatrzymasz Claude'a) nie jest czytana sama |
| **Ręcznie** | Echo nic nie czyta samo. ▶ czyta od bieżącej sekcji do końca kolejki — w każdej chwili, gdy są sekcje, także w trakcie pracy Claude'a |

Po pauzie (⏸) nowe wiadomości tylko dopisują się do kolejki; czytanie wznowisz przyciskiem ▶. Ostatnia odpowiedź zostaje zapamiętana osobno dla każdego czatu (zob. „Pamięć odpowiedzi” niżej).

### Dźwięki

Dźwięki oznaczają **początek i koniec czytania**, a nie każdą sekcję:

- **początek** (rosnące tony) — Echo zaczyna czytać po ciszy,
- **koniec** (opadające tony) — kolejka się skończyła albo czytanie przerwała pauza lub stop,
- **między wiadomościami** (jeden, cichszy ton) — tylko w trybie Live, gdy Echo przechodzi do następnej wiadomości Claude'a.

W ⚙ na liście **Dźwięki** wybierzesz zestaw: **Delikatny** (domyślny), **Dzwonek** lub **Kropla** — po wyborze usłyszysz próbkę — albo **Wyłącz**, żeby czytać bez dźwięków. Pliki `sounds/<zestaw>/start.wav`, `end.wav` i `between.wav` leżą w folderze danych wtyczki; serwer tworzy brakujące sam, a możesz je podmienić na własne.

### Wizualizacja

W trakcie czytania, w miejscu tekstu stanu, pokazuje się mała animacja w kolorze logo, która reaguje na **prawdziwą głośność czytanej mowy** — pauzy, akcenty, końce zdań. W ⚙ → **Wizualizacja**: **Fala** (domyślnie; płynnie wygasa przy brzegach), **Słupki**, **Kropka** (najbardziej dyskretna) albo **Wyłączona**, a obok **Kolor**: pomarańczowy z logo (domyślnie), biały, niebieski, zielony, fioletowy, różowy, czerwony lub żółty.

Siłę amplitudy każdego efektu (jak bardzo reaguje na głośność) ustawisz w `hooks/config.ts`: `VISUAL_GAIN = { wave: 1.0, bars: 1.0, dot: 1.0 }` — powyżej 1 wzmacnia, poniżej 1 łagodzi. Rozmiar: `VISUAL_SIZE = { wave: 80, bars: 80, dot: 10 }` (fala i słupki — szerokość w pikselach, kropka — największa średnica). Szybkość animacji: `VISUAL_FPS = { wave: 20, bars: 30, dot: 20 }` (klatki na sekundę, najwyżej 30 — tyle razy na sekundę serwer mierzy głośność), a `VISUAL_BAR_JITTER` to drobne drgania słupków, dzięki którym ruszają się także przy głośnej mowie. Tam też jest lista kolorów (`VISUAL_COLORS`).

Prawie nic nie kosztuje: serwer liczy obwiednię głośności sekcji raz (ok. 20 ms), a mod wysyła jeden obrazek SVG na sekcję. Animację odtwarza sama aplikacja, płynnie, bez przerysowywania paska klatka po klatce. W terminalu (bez grafiki) zamiast animacji jest tekst „czyta · język”.

### Pamięć odpowiedzi

Echo pamięta **ostatnią odpowiedź osobno dla każdego czatu** (wątku w historii Claude Code — w aplikacji, terminalu i VS Code). Gdy wrócisz do czatu, ▶ odtworzy jego ostatnią odpowiedź, a nie odpowiedź z innego czatu. Na czat przypada tylko jedna odpowiedź: nowe pytanie zastępuje poprzednią.

Zapisywany jest wyłącznie **tekst** odpowiedzi (mały plik JSON na czat, w folderze `history/` danych wtyczki), nie dźwięk: sekcje są zamieniane na mowę na bieżąco, do plików tymczasowych usuwanych zaraz po przeczytaniu.

W ⚙ → **Pamięć**:

- **7 / 30 / 90 dni** — jak długo trzymać odpowiedź czatu od jego ostatniej zmiany (domyślnie 30 dni). Starsze są usuwane automatycznie: przy starcie serwera i raz na dobę. Wrócisz do projektu po 10–15 dniach — odsłuchasz, o czym była mowa; po terminie odpowiedź znika.
- **Wyłączona** — nic nie trafia na dysk, a zapisane już odpowiedzi są od razu usuwane. Echo pamięta odpowiedzi tylko do zamknięcia serwera mowy; po ponownym uruchomieniu każdy czat zaczyna od zera.
- **Wyczyść wszystko** — natychmiast usuwa zapamiętane odpowiedzi wszystkich czatów (z dysku i z pamięci) i zatrzymuje czytanie.

Echo służy do słuchania na bieżąco, nie do archiwizowania rozmów — dlatego trzyma tylko ostatnią odpowiedź i sprząta po sobie.

Gdy jeden czat czyta, a w innym Claude właśnie odpowiada, odpowiedź drugiego czatu jest tylko zapisywana (nie przerywa czytania); posłuchasz jej przyciskiem ▶ w tamtym czacie. Naciśnięcie ▶, ❮ ❯ lub ⏹ w czacie przełącza Echo na ten czat.

### Język i głos

W ⚙ lista **Głos** ustala, w jakim języku i jakim głosem Echo czyta:

- **Auto** — Echo rozpoznaje język każdej odpowiedzi i czyta ją głosem dla tego języka,
- **konkretny język i głos** (np. „Polski: Bass”) — wszystko jest czytane tym głosem, także tekst w innym języku.

Zmiana działa od razu, także w trakcie czytania.

**Domyślny głos dla Auto:** głos wybrany dla języka zostaje zapamiętany. Wybierz np. „Angielski: Ryan”, a potem wróć na „Auto” — od tej chwili Auto czyta angielskie odpowiedzi Ryanem (i tak osobno dla każdego języka). Bez takiego wyboru Auto używa pierwszego zainstalowanego głosu języka. Na listach Głos i Lektor domyślny głos języka (i lektor) jest oznaczony kropką ◉.

**Język bez głosu:** gdy odpowiedź jest w piśmie, którego żaden zainstalowany głos nie przeczyta (japoński, chiński, koreański, cyrylica, grecki, arabski, hebrajski, hindi, tajski, gruziński), Echo nie czyta jej obcym głosem — pasek pokazuje „brak głosu: <język>”. Po zainstalowaniu głosu w panelu **+** odpowiedź przeczyta się od razu. Pojedyncze obce słowo w zdaniu nie zmienia języka całego tekstu. Przycisk **+** obok listy otwiera panel języków, w którym dodasz nowy język lub głos.

Lista **Interfejs** zmienia język samego Echo (pasek, ustawienia, panele, komunikaty, słowa komendy `/echo`): angielski (domyślny), polski, niemiecki, francuski, włoski, hiszpański, portugalski, rosyjski, ukraiński, japoński i chiński. Wybór zostaje zapamiętany na kolejne sesje.

Język odpowiedzi Claude'a ustawiasz w samym Claude Code (`"language"` w `settings.json`); Echo tylko czyta to, co Claude napisze.

### Co Echo dopisuje do instrukcji Claude'a

Echo czyta tylko widoczny tekst odpowiedzi (biały), nigdy myślenia Claude'a (szare, zwijane). Żeby nic, co jest do Ciebie, nie trafiło do myślenia, Echo dopisuje do instrukcji systemowych Claude'a jedno krótkie zdanie: wszystko, co jest dla użytkownika — także krótkie komunikaty między krokami — ma być zwykłym tekstem. Nic więcej nie zmienia w zachowaniu Claude'a.

Gdy mimo to wiadomość trafi do myślenia, aplikacja i tak pokazuje ją w czacie. Echo rozpoznaje taki fragment: prawdziwe myślenie dociera do wtyczek puste (zaszyfrowane), a fragment widoczny w czacie ma treść. Echo czyta więc bloki myślenia z treścią (bez bloków kodu, do 1500 znaków) jak zwykłe wiadomości; w `reading.log` są oznaczone jako `thinking (live, read)`.

## Panel języków

Lista wszystkich języków z katalogu Piper: zainstalowane na górze, potem alfabetycznie. Po prawej stronie wiersza języka widać, ile ma głosów (i ile z nich jest zainstalowanych, np. „2/5 głosów”).

- **▸** — rozwija listę głosów języka: nazwa, region, jakość, rozmiar, liczba lektorów,
- **◉ / ○** (na początku wiersza pobranego głosu, w linii ze strzałką języka; niepobrane głosy mają w tym miejscu odstęp) — ◉ oznacza domyślny głos języka, którego używa Auto; kliknięcie ○ ustawia ten głos jako domyślny. Przy modelu z wieloma lektorami kropkę ma każdy lektor; kropka przy samym modelu wybiera zapamiętanego lektora albo pierwszego od góry,
- **Pobierz ⤓** (przy głosie, po prawej) — pobiera ten głos,
- **Usuń ✕** — usuwa zainstalowany głos,
- **Pobieram …** — głos się pobiera (kilka pobiera się po kolei),
- **▸ przy głosie** — model z wieloma lektorami (np. Semaine: Obadiah, Poppy, Prudence, Spike) rozwija listę ich imion. Pobiera się i usuwa cały model naraz, bo wszyscy lektorzy są w jednym pliku.

Głosy pobiera się pojedynczo, nie cały język naraz.

Tryb Auto rozpoznaje: polski, angielski, niemiecki, francuski, włoski, hiszpański, portugalski, czeski, niderlandzki, szwedzki, rosyjski, ukraiński, chiński i japoński. Inne języki wybierz ręcznie.

## Komendy Echo

Wpisz w polu wiadomości. Słowa działają po angielsku i w języku interfejsu (poniżej po polsku; po angielsku: `pause`, `resume`, `next`, `prev`, `stop`, `replay`, `languages`, `restart`, `help`):

| Komenda | Działanie |
|---|---|
| `/echo` | Otwiera panel języków |
| `/echo pauza` | Pauza |
| `/echo wznow` | Czytanie bieżącej sekcji od początku |
| `/echo dalej` | Następna sekcja |
| `/echo wstecz` | Poprzednia sekcja |
| `/echo stop` | Stop |
| `/echo powtorz` | Powtórzenie ostatniej odpowiedzi |
| `/echo restart` | Restart serwera mowy (gdy coś się zawiesi) |
| `/echo pomoc` | Ta pomoc |

## Pliki

| Miejsce | Zawartość |
|---|---|
| folder wtyczki: `hooks/` | Mod: pasek, panele, komendy (TypeScript) |
| folder wtyczki: `server/` | Lokalny serwer mowy (Python, 127.0.0.1:59125) |
| folder danych wtyczki: `venv/` | Python z Piperem |
| folder danych wtyczki: `voices/` | Pobrane głosy |
| folder danych wtyczki: `config.json` | Ustawienia: język, tempo, wybrane głosy |
| folder danych wtyczki: `server.log` | Log serwera (błędy) |
| folder danych wtyczki: `history/` | Zapamiętana ostatnia odpowiedź każdego czatu (tekst, jeden plik na czat), usuwana po terminie z ⚙ → Pamięć |
| folder danych wtyczki: `reading.log` | Log czytania: nowe pytanie (reset), każda wiadomość Claude'a i co z nią zrobiono, czytane sekcje, pauzy, zmiany ustawień |

Folder danych wtyczki zakłada Claude Code (`CLAUDE_PLUGIN_DATA`); zostaje przy aktualizacji wtyczki.

## Prywatność

- Serwer mowy nasłuchuje tylko lokalnie (`127.0.0.1`), niedostępny z sieci.
- Internet jest używany wyłącznie przy instalacji: Piper z PyPI (pierwsze uruchomienie) oraz katalog i głosy z Hugging Face (`rhasspy/piper-voices`).
- Japońskie głosy przy instalacji doinstalowują moduł wymowy (`pyopenjtalk-plus` z PyPI).

## Rozwój

Struktura kodu:

- `hooks/` — mod (TypeScript): `register.tsx` podpina zdarzenia, `ui/` to komponenty paska i paneli, `locales/` tłumaczenia (każdy nowy tekst we wszystkich językach), `config.ts` ustawienia, `styles.ts` wspólny wygląd, `visualizer.ts` wizualizacja SVG.
- `server/` — serwer mowy (Python, Piper): `main.py` i pakiet `echo_tts/`.
- `startup.json` — ustawienia nowej instalacji.

Mod w trakcie pracy ładuje się z folderu przez `CLAUDE_CODE_PLUGIN_DIRS` (i `CLAUDE_CODE_PLUGIN_DIR_WATCH=1` — zmiany wczytują się same).

```
npm install
npm run check
```

## Licencja

Kod Echo: MIT. Echo nie zawiera Pipera: [piper-tts](https://github.com/OHF-Voice/piper1-gpl) (GPL-3.0) instaluje się osobno z PyPI przy pierwszym uruchomieniu. Głosy mają własne licencje — sprawdź kartę głosu na Hugging Face przed użyciem komercyjnym.
