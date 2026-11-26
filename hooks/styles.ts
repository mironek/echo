// Wspólne style elementów (zestawy propsów Box i Text), wstawiane przez spread: <Box {...styles.row}>.
// W modach nie ma CSS: wygląd ustawia się wyłącznie propsami elementów.

import {
  DEFAULT_SLOT_WIDTH,
  ICON_BUTTON_WIDTH,
  PLAY_BUTTON_WIDTH,
  SPEAKER_INDENT,
  DOT_TEXT_GAP,
  STATUS_WIDTH,
  TEXT_ROW_INDENT,
} from './config'

export const styles = {
  /** Cały obszar nad polem wpisywania: blok ustawień nad paskiem. */
  barColumn: { flexDirection: 'column', gap: 'md' },
  /** Rząd elementów wyśrodkowanych w pionie. */
  row: { gap: 1, alignItems: 'center' },
  /** Główny pasek: lewa część się zawija, prawa zostaje przy krawędzi. */
  mainRow: { gap: 1, alignItems: 'center', justifyContent: 'space-between' },
  /** Lewa część paska: Echo, odtwarzacz, przełączniki. */
  leftGroup: { gap: 1, alignItems: 'center', flexGrow: 1, flexShrink: 1, flexWrap: 'wrap', minWidth: 0 },
  /** Prawa część paska: stan, ⚙ i ?; nigdy się nie zwęża. */
  rightGroup: { gap: 1, alignItems: 'center', flexShrink: 0 },
  /** Panel ustawień (⚙): elementy w kolumnie (panel przewija się sam). */
  settingsBlock: { flexDirection: 'column', alignItems: 'flex-start', gap: 'md', paddingY: 'sm' },
  /** Miejsce o stałej szerokości na ▶/⏸ z licznikiem; przycisk stoi przy prawej krawędzi. */
  playSlot: {
    alignItems: 'center',
    justifyContent: 'flex-end',
    width: PLAY_BUTTON_WIDTH,
    minWidth: PLAY_BUTTON_WIDTH,
    flexShrink: 0,
  },
  /** Miejsce o stałej szerokości na tekst stanu, wyrównany do prawej. */
  statusSlot: { justifyContent: 'flex-end', alignItems: 'center', flexShrink: 0, width: STATUS_WIDTH, minWidth: STATUS_WIDTH },
  /** Miejsce o stałej szerokości na przycisk z jedną ikoną; przycisk wyśrodkowany, z tłem czy bez. */
  iconSlot: { alignItems: 'center', justifyContent: 'center', width: ICON_BUTTON_WIDTH, minWidth: ICON_BUTTON_WIDTH, flexShrink: 0 },
  /** Tekst nieaktywnego przycisku: najciemniejszy kolor tekstu z motywu (przycisk jest wtedy bez tła i ramki). */
  disabledText: { color: 'subtle' },
  /** Grupa ❮ ❯: przyciski bliżej siebie niż reszta paska, żeby było widać, że należą do siebie. */
  navGroup: { alignItems: 'center', gap: 0, flexShrink: 0 },
  /** Wiersz listy na całą szerokość: tekst przy lewej krawędzi, licznik lub przycisk przy prawej. */
  listRow: { width: '100%', gap: 1, alignItems: 'center', justifyContent: 'space-between' },
  /** Lewa, tekstowa część wiersza listy: zajmuje wolne miejsce, za długi tekst kończy się wielokropkiem. */
  listText: { flexGrow: 1, flexShrink: 1, minWidth: 0 },
  /** Kolumna listy w panelu języków: odstęp między wierszami, żeby przyciski się nie zlewały. */
  listColumn: { flexDirection: 'column', width: '100%', rowGap: 'xs' },
  /** Zwykły (nie rozwijany) wiersz głosu: odstęp jak wewnętrzny margines przycisku, żeby nazwy stały równo. */
  textRowIndent: { paddingLeft: TEXT_ROW_INDENT, minWidth: 0 },
  /** Kropka domyślnego głosu i tekst wiersza: jedna grupa z własnym odstępem (DOT_TEXT_GAP), zajmuje wolne miejsce. */
  dotWithText: { gap: DOT_TEXT_GAP, alignItems: 'center', flexGrow: 1, flexShrink: 1, minWidth: 0 },
  /** Wcięcie wiersza głosu pod nagłówkiem języka. */
  voiceIndent: { paddingLeft: 0 },
  /** Wcięcie wiersza lektora pod modelem z wieloma lektorami. */
  speakerIndent: { paddingLeft: SPEAKER_INDENT },
  /** Miejsce na przycisk akcji głosu („Pobierz ⤓”); szerokość liczona z tekstów, przyciski wyrównane do prawej. */
  actionSlot: { flexShrink: 0, justifyContent: 'flex-end' },
  /** Pierwsza kolumna wiersza głosu: kropka domyślnego głosu (w linii ze strzałką ▸ języka) albo pusty odstęp. */
  defaultSlot: {
    alignItems: 'center',
    justifyContent: 'flex-start',
    width: DEFAULT_SLOT_WIDTH,
    minWidth: DEFAULT_SLOT_WIDTH,
    flexShrink: 0,
    // Większa kropka z marginesem przycisku może być szersza niż kolumna: nie przycinać jej obwódki.
    overflow: 'visible',
  },
} as const
