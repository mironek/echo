"""Ustawienia użytkownika (config.json) i log serwera."""
import json
import os
import time

from . import paths
from .languages import systemLanguage
from .startup import defaultConfig

# Ustawienia nowej instalacji: z pliku startup.json w folderze wtyczki (opis w README).
DEFAULT_CONFIG = defaultConfig(systemLanguage())
# Log czytania jest przycinany: po przekroczeniu tego rozmiaru stary trafia do reading.log.1.
READING_LOG_MAX_BYTES = 512 * 1024
# Ile znaków wiadomości trafia do logu czytania.
LOG_PREVIEW_CHARS = 70
# Klucze, które mod może zmienić przez /config (poza voiceForLanguage, które jest scalane).
EDITABLE_KEYS = (
    "language", "speed", "muted", "autoRead", "liveRead", "soundCues", "soundPack", "fallbackLanguage", "historyDays",
    "visualizer", "visualizerColor",
)


def logMessage(message):
    """Dopisuje jedną linię z datą do pliku logu serwera."""
    with open(paths.LOG_PATH, "a", encoding="utf-8") as f:
        f.write(time.strftime("%Y-%m-%d %H:%M:%S ") + message + "\n")


def loadConfig():
    """Czyta config.json nałożony na ustawienia domyślne."""
    config = json.loads(json.dumps(DEFAULT_CONFIG))
    if os.path.exists(paths.CONFIG_PATH):
        with open(paths.CONFIG_PATH, encoding="utf-8") as f:
            config.update(json.load(f))
    return config


def saveConfig(config):
    """Zapisuje ustawienia do config.json."""
    with open(paths.CONFIG_PATH, "w", encoding="utf-8") as f:
        json.dump(config, f, ensure_ascii=False, indent=2)


def preview(text):
    """Krótki, jednoliniowy początek tekstu do logu."""
    flat = " ".join(text.split())
    return flat if len(flat) <= LOG_PREVIEW_CHARS else flat[:LOG_PREVIEW_CHARS] + "…"


def logReading(message):
    """Dopisuje zdarzenie do logu czytania (reading.log) z czasem co do milisekundy."""
    try:
        if os.path.exists(paths.READING_LOG_PATH) and os.path.getsize(paths.READING_LOG_PATH) > READING_LOG_MAX_BYTES:
            os.replace(paths.READING_LOG_PATH, paths.READING_LOG_PATH + ".1")
        stamp = time.strftime("%H:%M:%S") + f".{int(time.time() * 1000) % 1000:03d}"
        with open(paths.READING_LOG_PATH, "a", encoding="utf-8") as f:
            f.write(f"{time.strftime('%Y-%m-%d')} {stamp} {message}\n")
    except OSError:
        pass
