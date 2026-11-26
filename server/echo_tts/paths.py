"""Ścieżki do danych serwera: głosy, ustawienia, dźwięki, log.

Dane leżą w folderze danych wtyczki (CLAUDE_PLUGIN_DATA), a nie w folderze
wtyczki, więc przetrwają aktualizację. `init()` ustawia je przy starcie.
"""
import os

DATA_DIR = ""
VOICES_DIR = ""
SOUNDS_DIR = ""
CONFIG_PATH = ""
CATALOG_PATH = ""
LOG_PATH = ""
READING_LOG_PATH = ""
HISTORY_DIR = ""
# Pliki starszych wersji (jedna odpowiedź dla wszystkich sesji), usuwane przy starcie.
LEGACY_FILES = ("last_text.txt", "turn.json")


def init(dataDir):
    """Ustawia wszystkie ścieżki względem folderu danych i tworzy brakujące foldery."""
    global DATA_DIR, VOICES_DIR, SOUNDS_DIR, CONFIG_PATH, CATALOG_PATH, LOG_PATH, READING_LOG_PATH
    global HISTORY_DIR
    DATA_DIR = os.path.abspath(dataDir)
    VOICES_DIR = os.path.join(DATA_DIR, "voices")
    SOUNDS_DIR = os.path.join(DATA_DIR, "sounds")
    CONFIG_PATH = os.path.join(DATA_DIR, "config.json")
    CATALOG_PATH = os.path.join(DATA_DIR, "voices.json")
    LOG_PATH = os.path.join(DATA_DIR, "server.log")
    READING_LOG_PATH = os.path.join(DATA_DIR, "reading.log")
    HISTORY_DIR = os.path.join(DATA_DIR, "history")
    os.makedirs(VOICES_DIR, exist_ok=True)
    os.makedirs(SOUNDS_DIR, exist_ok=True)
    os.makedirs(HISTORY_DIR, exist_ok=True)
    for name in LEGACY_FILES:
        if os.path.exists(os.path.join(DATA_DIR, name)):
            os.remove(os.path.join(DATA_DIR, name))
