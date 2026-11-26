# Echo — wtyczka Claude Code (czytanie odpowiedzi na głos)

Odpowiadaj i komentuj kod **po polsku**. Nazwy zmiennych, funkcji, plików i klas — **po angielsku** (camelCase w TS i w Pythonie).

## Budowa

- `hooks/` — mod (TypeScript/TSX, ładowany przez Claude Code):
  - `register.tsx` — tylko podpięcie zdarzeń (`on(...)`) do funkcji z innych plików,
  - `config.ts` — ustawienia (adresy, czasy, ikony, szerokości, nazwy głosów),
  - `styles.ts` — wspólne propsy wyglądu (`<Box {...styles.row}>`); w modach nie ma CSS,
  - `state.ts` — atomy `$.state` **i jedyne miejsce z `read`/`update`** (wymóg walidatora),
  - `server.ts` — HTTP do serwera mowy, `ensureServer`, restart,
  - `setup.ts` — pierwsza instalacja (venv + `pip install`) i uruchamianie serwera; ścieżki z `$.process.hookEnv()`,
  - `i18n.ts` + `locales/` — tłumaczenia interfejsu,
  - `labels.ts` — teksty do wyświetlenia, `commands.ts` — `/echo`, `panes.ts` — otwieranie paneli,
  - `ui/` — komponenty: funkcje `Komponent(ui, $, ...)` zwracające drzewo; `ui` to `$.ui.resolve(e)` (elementy nie są importowane).
- `server/` — serwer mowy (Python, Piper): `main.py` + pakiet `echo_tts/` (`api`, `speaker`, `voices`, `text`, `languages`, `cues`, `audio`, `config`, `paths`).
- Dane (venv, głosy, `config.json`, log) — w folderze danych wtyczki (`CLAUDE_PLUGIN_DATA`), nie w repozytorium.

## Tłumaczenia interfejsu

- Języki interfejsu: en (domyślny), pl, de, fr, it, es, pt, ru, uk, ja, zh. Pliki: `hooks/locales/<kod>.ts`, obsługa: `hooks/i18n.ts` (`t()`, `tPlural()`, `languageName()`).
- **Każdy nowy tekst w interfejsie od razu we wszystkich językach.** Żadnych tekstów wpisanych na sztywno w komponentach: klucz w `locales/en.ts` + ten sam klucz w każdym innym pliku (brak klucza = błąd `tsc`, bo każdy plik ma typ `Messages`).
- Brak tłumaczenia (np. nowy kolor dodany tylko w `config.ts`) nie psuje rysowania: `t()` pokazuje wtedy ostatnią część klucza (`color.teal` → `teal`). Mimo to nowy tekst dodajemy od razu we wszystkich językach.
- Liczba mnoga: obiekt `{ one, few, many, other }` (kategorie `Intl.PluralRules`), użycie `tPlural(klucz, liczba)`.
- Nazwy języków: `languageName(kod)` przez `Intl.DisplayNames`; serwer podaje tylko angielskie nazwy zapasowe.
- Rysowanie i obsługa komend zaczynają się od `applyUiLanguage($)` (język jest w `$.state` i `$.store`).

## Ustawienia startowe

- `startup.json` (folder wtyczki) — domyślne wartości nowej instalacji; serwer: `server/echo_tts/startup.py` → `DEFAULT_CONFIG` i `defaultVoices`; mod: `readStartup()` (`setup.ts`) → domyślny język interfejsu. Nowe ustawienie startowe = klucz w `startup.json`, w `BUILT_IN` (startup.py) i w tabeli w README.
- Test bez dźwięku: `python server/main.py --data <folder> --port 59203 --silent`.

## Wizualizacja

- Serwer: `server/echo_tts/envelope.py` liczy obwiednię głośności sekcji (0–1 co 50 ms) → `Speaker.visual` → `/status.visual` (tylko w trakcie czytania).
- Mod: `hooks/visualizer.ts` buduje SVG z animacją SMIL (fala / słupki / kropka); `begin` ujemny = czas, który minął od `visual.startedAt`, więc obrazek jest zsynchronizowany z dźwiękiem nawet po przerysowaniu. Element `Svg` jest na desktopie, w VS Code i na telefonie, nie w terminalu.
- W trakcie czytania stan odświeża się co 250 ms (`FAST_POLL_INTERVAL_MS`), poza czytaniem co sekundę.

## Pamięć odpowiedzi (per czat)

- Każde zapytanie moda niesie `?session=<$.session.id()>` (`callServer`). Serwer trzyma jedną załadowaną sesję (`Speaker.sessionId`); inne są w `server/echo_tts/history.py` (pamięć + `history/<sesja>.json`).
- Sterowanie użytkownika (▶ ❮ ❯ ⏹, powtórz) przełącza na swoją sesję; zdarzenia `/turn/*` innej sesji w trakcie czytania trafiają tylko do jej pamięci.
- `historyDays` (0/7/30/90, domyślnie 30): 0 = nic na dysku; sprzątanie przy starcie i raz na dobę; `/history/clear` czyści wszystko.

## Instrukcja dla modelu

- `prompt.compose` dopisuje sekcję `echo:read-aloud` (`READ_ALOUD_PROMPT_SECTION` w `hooks/config.ts`): wiadomości do użytkownika tylko jako widoczny tekst, bo Echo nie czyta myślenia. Tekst po angielsku (czyta go model), krótki.

- `turn.step` czyta **widoczne myślenie**: bloki myślenia, które w strumieniu mają treść (prawdziwe myślenie przychodzi puste), po filtrze `isVisibleThinking()` (`labels.ts`) trafiają do `/turn/append`. Każdy fragment strumienia musi przejść dalej bez zmian (`yield chunk`).

## Zasady walidatora (`claude plugin validate .`)

- `read`/`update` stanu tylko w pliku, który definiuje atom (`state.ts`).
- Funkcje, którym przekazuje się `$` między plikami, muszą być deklaracjami `function`, nie `const f = () => ...`.
- Zmiana kształtu wartości w `$.state` → nowy tag `shape` w `atom(...)`.
- `API_VERSION` w `hooks/config.ts` i `server/echo_tts/__init__.py` muszą być równe; zmiana wersji w `plugin.json` sprawia, że mod wymienia działający serwer.

## Sprawdzanie

- Typy: `npx -p typescript@5 tsc -p .` (wymaga `.claude-plugin/types/`, które tworzy Claude Code po załadowaniu moda).
- Walidacja: `claude plugin validate .`
- Serwer osobno: `python server/main.py --data <folder testowy> --port 59200`.
- Wersję podbijać razem w `plugin.json` i `package.json`.
