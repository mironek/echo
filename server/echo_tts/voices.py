"""Głosy Piper: zainstalowane modele, katalog z Hugging Face, pobieranie i usuwanie."""
import importlib.util
import json
import os
import subprocess
import sys
import threading
import urllib.request

from . import paths
from .config import loadConfig, logMessage, saveConfig
from .languages import languageOfVoice
from .startup import loadStartup

VOICE_BASE_URL = "https://huggingface.co/rhasspy/piper-voices/resolve/main/"
CATALOG_URL = VOICE_BASE_URL + "voices.json"
QUALITY_RANK = {"medium": 0, "high": 1, "low": 2, "x_low": 3}
# Głos instalowany dla całego języka, gdy jest w katalogu; inaczej pierwszy głos średniej jakości.
PREFERRED_VOICES = {
    "pl": "pl_PL-mc_speech-medium",
    "en": "en_US-ryan-medium",
    "de": "de_DE-thorsten-medium",
    "fr": "fr_FR-siwis-medium",
    "it": "it_IT-paola-medium",
    "es": "es_ES-davefx-medium",
    "ru": "ru_RU-irina-medium",
}
# Dodatkowe pakiety Pythona potrzebne niektórym językom (instalowane razem z głosem).
LANGUAGE_PACKAGES = {"ja": ("pyopenjtalk", "pyopenjtalk-plus")}

downloadState = {"voice": None, "error": None, "queue": []}
downloadLock = threading.Lock()


def modelOfVoice(voiceKey):
    """Zwraca klucz pliku modelu, bez części #lektor."""
    return voiceKey.split("#")[0]


def installedVoices():
    """Lista zainstalowanych głosów; model z wieloma lektorami daje osobny klucz dla każdego (model#lektor)."""
    names = []
    for fileName in os.listdir(paths.VOICES_DIR):
        configPath = os.path.join(paths.VOICES_DIR, fileName + ".json")
        if not (fileName.endswith(".onnx") and os.path.exists(configPath)):
            continue
        modelKey = fileName[:-5]
        with open(configPath, encoding="utf-8") as f:
            speakers = json.load(f).get("speaker_id_map") or {}
        if len(speakers) > 1:
            names.extend(f"{modelKey}#{speaker}" for speaker in speakers)
        else:
            names.append(modelKey)
    return sorted(names)


def loadCatalog():
    """Zwraca katalog głosów Piper; przy pierwszym użyciu pobiera go z Hugging Face."""
    if not os.path.exists(paths.CATALOG_PATH):
        urllib.request.urlretrieve(CATALOG_URL, paths.CATALOG_PATH + ".part")
        os.replace(paths.CATALOG_PATH + ".part", paths.CATALOG_PATH)
    with open(paths.CATALOG_PATH, encoding="utf-8") as f:
        return json.load(f)


def catalogForUi():
    """Grupuje wszystkie głosy katalogu po językach i zaznacza zainstalowane."""
    catalog = loadCatalog()
    installedModels = {modelOfVoice(v) for v in installedVoices()}
    groups = {}
    for key, info in catalog.items():
        code = info["language"]["family"]
        group = groups.setdefault(code, {
            "code": code,
            "name": info["language"]["name_english"],
            "nativeName": info["language"]["name_native"],
            "voices": [],
        })
        sizeBytes = sum(f["size_bytes"] for p, f in info["files"].items() if p.endswith(".onnx"))
        group["voices"].append({
            "voice": key,
            "name": info["name"],
            "region": info["language"]["region"],
            "quality": info["quality"],
            "sizeMB": round(sizeBytes / 1e6),
            "speakers": info["num_speakers"],
            # Imiona lektorów modelu z wieloma głosami, w kolejności ich numerów.
            "speakerNames": sorted(info.get("speaker_id_map") or {}, key=(info.get("speaker_id_map") or {}).get)
            if info["num_speakers"] > 1 else [],
            "isInstalled": key in installedModels,
        })
    for group in groups.values():
        group["voices"].sort(key=lambda v: (QUALITY_RANK.get(v["quality"], 9), v["region"], v["name"]))
        group["installedCount"] = sum(1 for v in group["voices"] if v["isInstalled"])
    return sorted(groups.values(), key=lambda g: (g["installedCount"] == 0, g["name"]))


def defaultVoiceOf(code):
    """Wybiera głos do pobrania dla całego języka: polecany, inaczej pierwszy średniej jakości."""
    if PREFERRED_VOICES.get(code) in loadCatalog():
        return PREFERRED_VOICES[code]
    voices = [v for g in catalogForUi() if g["code"] == code for v in g["voices"]]
    return voices[0]["voice"] if voices else None


def installDefaultVoices():
    """Przy pierwszym starcie (brak głosów) pobiera podstawowy pakiet: angielski Ryan i polski MC Speech."""
    if installedVoices():
        return
    try:
        catalog = loadCatalog()
        # Podstawowy pakiet głosów: „defaultVoices” w startup.json (pozostałe użytkownik dodaje w panelu języków).
        for voiceKey in loadStartup()["defaultVoices"]:
            # Głos, którego zabraknie w katalogu, zastępuje polecany głos jego języka.
            fallback = voiceKey if voiceKey in catalog else defaultVoiceOf(languageOfVoice(voiceKey))
            if fallback:
                queueDownload(fallback)
    except Exception as error:
        logMessage("default voices error: " + repr(error))
        downloadState["error"] = f"voices.json: {error}"


def queueDownload(voiceKey):
    """Dodaje głos do kolejki pobierania i uruchamia wątek, gdy nic się nie pobiera."""
    with downloadLock:
        if voiceKey == downloadState["voice"] or voiceKey in downloadState["queue"]:
            return
        downloadState["queue"].append(voiceKey)
        downloadState["error"] = None
        if downloadState["voice"] is None:
            downloadState["voice"] = downloadState["queue"].pop(0)
            threading.Thread(target=downloadWorker, daemon=True).start()


# Wywoływane po każdym pobranym głosie (serwer ustawia je na odświeżenie lektora).
onVoiceInstalled = []


def downloadWorker():
    """Pobiera głosy z kolejki jeden po drugim; po każdym daje znać słuchaczom onVoiceInstalled."""
    while True:
        downloadVoice(downloadState["voice"])
        for callback in onVoiceInstalled:
            try:
                callback()
            except Exception as error:
                logMessage("voice installed callback error: " + repr(error))
        with downloadLock:
            if not downloadState["queue"]:
                downloadState["voice"] = None
                return
            downloadState["voice"] = downloadState["queue"].pop(0)


def ensureLanguagePackage(code):
    """Doinstalowuje pakiet Pythona, którego wymaga język (np. japoński), jeśli go brakuje."""
    if code not in LANGUAGE_PACKAGES:
        return
    moduleName, packageName = LANGUAGE_PACKAGES[code]
    if importlib.util.find_spec(moduleName) is None:
        subprocess.run([sys.executable, "-m", "pip", "install", packageName], check=True, capture_output=True)


def downloadVoice(voiceKey):
    """Pobiera model głosu i jego konfigurację do folderu voices."""
    try:
        ensureLanguagePackage(languageOfVoice(voiceKey))
        info = loadCatalog()[voiceKey]
        # Najpierw .json, na końcu .onnx: głos jest widoczny dopiero, gdy oba pliki są gotowe.
        for relPath in sorted(info["files"], key=lambda p: p.endswith(".onnx")):
            if not relPath.endswith((".onnx", ".onnx.json")):
                continue
            target = os.path.join(paths.VOICES_DIR, os.path.basename(relPath))
            url = VOICE_BASE_URL + urllib.request.quote(relPath)
            urllib.request.urlretrieve(url, target + ".part")
            os.replace(target + ".part", target)
    except Exception as error:
        logMessage("download error: " + repr(error))
        downloadState["error"] = f"{voiceKey}: {error}"


def removeModel(modelKey):
    """Usuwa pliki modelu z dysku i zapomina go w ustawieniach."""
    for suffix in (".onnx", ".onnx.json"):
        path = os.path.join(paths.VOICES_DIR, modelKey + suffix)
        if os.path.exists(path):
            os.remove(path)
    config = loadConfig()
    config["voiceForLanguage"] = {
        code: voice for code, voice in config["voiceForLanguage"].items() if modelOfVoice(voice) != modelKey
    }
    saveConfig(config)
