"""Ustawienia startowe z pliku startup.json w folderze wtyczki: domyślne wartości nowej instalacji.

Plik czyta też mod (język interfejsu). Klucze zaczynające się od „_” to komentarze.
Brakujący plik albo klucz = wartość wbudowana poniżej.
"""
import json
import os

# Plik leży w folderze wtyczki, dwa poziomy nad tym modułem (server/echo_tts/ → wtyczka).
STARTUP_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), "startup.json")

BUILT_IN = {
    "uiLanguage": "en",
    "readingMode": "live",
    "voice": "auto",
    "fallbackLanguage": "system",
    "speed": 1.0,
    "sounds": "soft",
    "memoryDays": 30,
    "visualizer": "wave",
    "visualizerColor": "orange",
    "defaultVoices": ["en_US-lessac-medium", "pl_PL-gosia-medium", "pl_PL-mc_speech-medium"],
}


def loadStartup():
    """Ustawienia startowe: startup.json nałożony na wartości wbudowane (błędny plik = same wbudowane)."""
    settings = dict(BUILT_IN)
    try:
        with open(STARTUP_PATH, encoding="utf-8") as f:
            saved = json.load(f)
        settings.update({key: value for key, value in saved.items() if not key.startswith("_")})
    except (OSError, ValueError):
        pass
    return settings


def defaultConfig(systemLanguage):
    """Ustawienia serwera (config.json) nowej instalacji, wyliczone z ustawień startowych."""
    startup = loadStartup()
    mode = startup.get("readingMode", "live")
    sounds = startup.get("sounds", "soft")
    fallback = startup.get("fallbackLanguage", "system")
    return {
        "language": startup.get("voice", "auto"),
        "fallbackLanguage": systemLanguage if fallback == "system" else fallback,
        "speed": float(startup.get("speed", 1.0)),
        "muted": False,
        # „final” (Wynik) — dawniej „auto”; obie nazwy działają.
        "autoRead": mode in ("final", "auto", "live"),
        "liveRead": mode == "live",
        "soundCues": sounds != "off",
        "soundPack": sounds if sounds != "off" else "soft",
        "voiceForLanguage": {},
        "historyDays": int(startup.get("memoryDays", 30)),
        "visualizer": startup.get("visualizer", "wave"),
        "visualizerColor": startup.get("visualizerColor", "orange"),
    }
