// Ustawienia moda Echo: adresy, czasy, identyfikatory paneli, ikony, szerokości i nazwy głosów.

/** Wersja API serwera, którą rozumie ten mod (ta sama co API_VERSION w server/echo_tts/__init__.py). */
export const API_VERSION = 3

// ---------------------------------------------------------------- serwer ---
export const SERVER_URL = 'http://127.0.0.1:59125'
export const POLL_INTERVAL_MS = 1000
// W trakcie czytania stan jest odświeżany częściej, żeby wizualizacja nowej sekcji pojawiała się bez opóźnienia.
export const FAST_POLL_INTERVAL_MS = 250
export const SERVER_START_WAIT_MS = 20000
export const SERVER_RESTART_PAUSE_MS = 1500
// Instalacja Pipera przez pip może trwać kilka minut (maksimum $.process.run to 10 minut).
export const PIP_INSTALL_TIMEOUT_MS = 600000
export const VENV_CREATE_TIMEOUT_MS = 120000
export const MIN_PYTHON_VERSION = '3.9'

// ---------------------------------------------------------------- panele ---
export const LANGUAGES_PANE_ID = 'echo-languages'
export const HELP_PANE_ID = 'echo-help'
export const SETTINGS_PANE_ID = 'echo-settings'
export const HELP_FILE_NAME = 'README.md'
// README w języku interfejsu, gdy istnieje (kod języka → plik); pozostałe języki dostają README.md (po angielsku).
export const HELP_FILES_BY_LANGUAGE: Record<string, string> = { pl: 'README.pl.md' }

// ------------------------------------------------------------------ pasek ---
export const PREV_ICON = '❮'
export const NEXT_ICON = '❯'
export const STOP_ICON = '⏹'
// Stała szerokość miejsca na przycisk z jedną ikoną (❮ ❯ ⏹): ikona + margines przycisku.
export const ICON_BUTTON_WIDTH = 4
export const COUNTER_DIGITS = 3
// Spacja niełamliwa: dopełnia licznik do stałej szerokości.
export const PAD_SPACE = ' '
// Miejsce na tekst stanu po prawej („czyta · Polski”); dłuższe teksty kończą się wielokropkiem.
export const STATUS_WIDTH = 18
// Gdy wizualizacja jest włączona, miejsce na stan ma szerokość obrazka (VISUAL_SIZE w px przeliczone na znaki),
// ale nie mniej niż tyle znaków, żeby zmieściły się krótkie teksty („pauza”, „gotowy”).
export const STATUS_MIN_WIDTH_WITH_VISUAL = 8
// Ile pikseli CSS ma w przybliżeniu jeden znak (komórka) na pasku - do przeliczania szerokości obrazka.
export const PX_PER_CELL = 8
// Stała szerokość (w komórkach) miejsca na przycisk ▶/⏸, który stoi przy jego prawej krawędzi:
// ikona + spacja (2) + „000/000” (7) + margines przycisku (3).
export const PLAY_BUTTON_WIDTH = 12
// Miejsce na listę trybu ponad najdłuższą nazwę trybu: strzałka listy i marginesy.
export const MODE_SELECT_EXTRA_WIDTH = 6
// Ikony panelu języków: pobierz (strzałka w dół z kreską), usuń, w trakcie pobierania.
export const DOWNLOAD_ICON = '⤓'
// Znacznik domyślnego głosu języka i jego kolor (pomarańczowy z logo Echo).
export const DEFAULT_MARK = '◉'
// Przycisk przy pobranym głosie, który nie jest domyślny: pusta „dziurka” - kliknięcie ustawia go jako domyślny.
export const NOT_DEFAULT_MARK = '○'
// Szerokość (w znakach) kolumny z kropką na początku wiersza głosu; niepobrane głosy mają tu pusty odstęp.
export const DEFAULT_SLOT_WIDTH = 3.1
// Wcięcie wierszy lektorów pod modelem (kropki lektorów stoją o tyle znaków w prawo).
export const SPEAKER_INDENT = 5
// Odstęp (w znakach) między kolumną kropki a tekstem wiersza; 0 = tekst tuż za kolumną kropki.
export const DOT_TEXT_GAP = 0
// Odstęp (w znakach) zwykłego wiersza głosu, równy wewnętrznemu marginesowi przycisku rozwijanego obok.
export const TEXT_ROW_INDENT = 1
export const BRAND_COLOR = '#EC793C'
export const REMOVE_ICON = '✕'
export const PENDING_ICON = '…'
// Margines przycisku akcji ponad najdłuższy tekst („Pobierz ⤓”).
export const ACTION_EXTRA_WIDTH = 4
// Ilu lektorów modelu pokazać po rozwinięciu (reszta jako „…i jeszcze N”).
export const MAX_SPEAKERS_SHOWN = 30
// Opcje pamięci odpowiedzi każdego czatu, w dniach (0 = nie zapisywać na dysku).
export const MEMORY_DAYS_OPTIONS = [0, 7, 30, 90]
export const SPEED_OPTIONS = ['0.8', '0.9', '1.0', '1.1', '1.25', '1.5', '1.75', '2.0']

// ----------------------------------------------------------------- głosy ---
// Znane głosy: imię lektora i płeć (tłumaczona); pozostałe nazywa się imieniem z klucza, bez płci.
export const VOICE_INFO: Record<string, { name: string; gender: 'female' | 'male' }> = {
  'pl_PL-gosia-medium': { name: 'Gosia', gender: 'female' },
  'pl_PL-darkman-medium': { name: 'Darkman', gender: 'male' },
  'pl_PL-bass-high': { name: 'Bass', gender: 'male' },
  'pl_PL-mc_speech-medium': { name: 'MC Speech', gender: 'male' },
  'en_US-lessac-medium': { name: 'Lessac', gender: 'female' },
  'en_US-ryan-medium': { name: 'Ryan', gender: 'male' },
  'de_DE-thorsten-medium': { name: 'Thorsten', gender: 'male' },
  'de_DE-kerstin-medium': { name: 'Kerstin', gender: 'female' },
  'fr_FR-siwis-medium': { name: 'Siwis', gender: 'female' },
  'fr_FR-tom-medium': { name: 'Tom', gender: 'male' },
  'it_IT-paola-medium': { name: 'Paola', gender: 'female' },
  'ru_RU-irina-medium': { name: 'Irina', gender: 'female' },
  'ru_RU-dmitri-medium': { name: 'Dmitri', gender: 'male' },
  'es_ES-davefx-medium': { name: 'DaveFX', gender: 'male' },
  'es_ES-sharvard-medium#F': { name: 'Sharvard', gender: 'female' },
  'es_ES-sharvard-medium#M': { name: 'Sharvard', gender: 'male' },
  'uk_UA-ukrainian_tts-medium#lada': { name: 'Lada', gender: 'female' },
  'uk_UA-ukrainian_tts-medium#mykyta': { name: 'Mykyta', gender: 'male' },
  'uk_UA-ukrainian_tts-medium#tetiana': { name: 'Tetiana', gender: 'female' },
  'ja_JP-hi_fi_captain-medium#female': { name: 'Captain', gender: 'female' },
  'ja_JP-hi_fi_captain-medium#male': { name: 'Captain', gender: 'male' },
  'zh_CN-huayan-medium': { name: 'Huayan', gender: 'female' },
}

// ------------------------------------------------------ instrukcje dla Claude'a ---
// Sekcja dopisywana do instrukcji systemowych (prompt.compose): Echo czyta tylko widoczny tekst odpowiedzi,
// więc wszystko, co jest do użytkownika, musi trafić do tekstu, a nie do bloku myślenia. Po angielsku, bo czyta to model.
export const READ_ALOUD_PROMPT_SECTION = {
  id: 'echo:read-aloud',
  text:
    'The user listens to your replies through Echo, a text-to-speech plugin that reads aloud only your visible ' +
    'reply text and never your thinking. Write everything meant for the user as visible text, including short ' +
    'status updates between tool calls and test messages; never put user-facing messages inside thinking.',
  scope: 'session',
} as const

// ------------------------------------------------------------- widoczne myślenie ---
// Najdłuższy blok widocznego myślenia, który Echo czyta; dłuższy to raczej robocze notatki niż wiadomość.
export const MAX_SPOKEN_THINKING_CHARS = 1500

// ------------------------------------------------------------------ wizualizacja ---
// Siła amplitudy każdego efektu: mnożnik głośności (1 = bez zmian, >1 wzmacnia - efekt częściej dochodzi
// do pełnej wysokości, <1 łagodzi). Wynik jest obcinany do pełnej wysokości.
export const VISUAL_GAIN = { wave: 1, bars: 1, dot: 1 }

// Rozmiar efektów w pikselach CSS: fala i słupki - szerokość całego obrazka, kropka - jej największa średnica.
export const VISUAL_SIZE = { wave: 70, bars: 70, dot: 12 }

// Szybkość animacji: ile klatek na sekundę ma każdy efekt (więcej = szybsze, drobniejsze zmiany; serwer mierzy
// głośność 30 razy na sekundę, więc powyżej 30 nic się już nie zmienia).
export const VISUAL_FPS = { wave: 30, bars: 30, dot: 20 }

// Drgania słupków (0 = brak, 0.5 = do połowy wysokości): szybkie, drobne zmiany, dzięki którym słupki ruszają się
// nawet przy głośnej mowie, gdy obwiednia stoi przy maksimum.
export const VISUAL_BAR_JITTER = 0.35

// Kolory wizualizacji do wyboru w ⚙ (pierwszy = domyślny, pomarańczowy z logo). Nazwy: klucze color.<id>.
export const VISUAL_COLORS = [
  { id: 'orange', hex: '#fc7b12' },
  { id: 'white', hex: '#E8E8E8' },
  { id: 'blue', hex: '#1cb5f1' },
  { id: 'teal', hex: '#07d6a2' },
  { id: 'green', hex: '#00ad17' },
  { id: 'lime', hex: '#a3f113' },
  { id: 'purple', hex: '#9B6BE0' },
  { id: 'pink', hex: '#ca377c' },
  { id: 'red', hex: '#ec1010' },
  { id: 'yellow', hex: '#e9c41f' },
]
