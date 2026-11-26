"""Serwer HTTP na 127.0.0.1: trasy, które wywołuje mod, i stan, który rysuje pasek."""
import json
import os
import threading
import time
from urllib.parse import parse_qs, urlparse
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

from . import API_VERSION, history, paths
from .audio import player
from .config import EDITABLE_KEYS, loadConfig, logReading, saveConfig
from .cues import DEFAULT_CUE_PACK, packList, playCue
from .languages import languageName, languageOfVoice
from .speaker import Speaker
from .text import cleanMarkdown, splitIntoChunks
from .voices import (
    catalogForUi, defaultVoiceOf, downloadState, installedVoices, loadCatalog, modelOfVoice, onVoiceInstalled, queueDownload,
    removeModel,
)

HOST = "127.0.0.1"
PORT = 59125
# Serwer kończy pracę po tylu sekundach bez zapytań (gdy nic nie czyta).
IDLE_EXIT_SECONDS = 4 * 3600
# Co ile sekund sprzątać wygasłe odpowiedzi zapisanych sesji.
PURGE_INTERVAL_SECONDS = 24 * 3600
# Trasy sterowania przez użytkownika: przełączają serwer na sesję, z której przyszły (przerywając inną).
USER_ROUTES = ("/play", "/toggle", "/next", "/prev", "/stop", "/replay", "/resume", "/speak")


class EchoServer(ThreadingHTTPServer):
    """Serwer HTTP z lektorem i informacjami o sobie (wersja wtyczki, folder)."""

    daemon_threads = True
    # Na Windows SO_REUSEADDR pozwala kilku procesom zająć ten sam port (zapytania trafiają wtedy do najstarszego),
    # więc tam port musi być wyłączny: druga kopia serwera dostaje błąd i kończy pracę.
    allow_reuse_address = os.name != "nt"

    def __init__(self, pluginVersion, serverRoot, port=None):
        """Otwiera port; rzuca OSError, gdy działa już inna kopia."""
        super().__init__((HOST, port or PORT), Handler)
        self.pluginVersion = pluginVersion
        self.serverRoot = serverRoot
        self.speaker = Speaker()
        self.lastRequest = time.time()
        # Po pobraniu głosu lektor wybiera go od razu (ważne przy pierwszej instalacji, gdy głosów jeszcze nie ma).
        onVoiceInstalled.append(self.speaker.changeVoice)

    def watchIdle(self):
        """Wyłącza serwer po długim czasie bez zapytań i raz na dobę sprząta wygasłe odpowiedzi sesji."""
        lastPurge = time.time()
        while True:
            time.sleep(60)
            if time.time() - lastPurge > PURGE_INTERVAL_SECONDS:
                history.purge()
                lastPurge = time.time()
            if time.time() - self.lastRequest > IDLE_EXIT_SECONDS and self.speaker.state == "idle":
                self.shutdown()
                return


# Liczba sekcji odpowiedzi sesji, które nie są załadowane: (sesja, liczba wiadomości, znaki) -> sekcje.
sectionCountCache = {}


def sectionCount(messages):
    """Ile sekcji ma odpowiedź złożona z tych wiadomości (z pamięcią podręczną, bo pasek pyta co sekundę)."""
    key = (len(messages), sum(len(m) for m in messages))
    if key not in sectionCountCache:
        if len(sectionCountCache) > 200:
            sectionCountCache.clear()
        sectionCountCache[key] = sum(len(splitIntoChunks(cleanMarkdown(m))) for m in messages)
    return sectionCountCache[key]


def statusPayload(server, sessionId):
    """Buduje stan paska Echo dla sesji: załadowanej - na żywo, innej - z jej zapamiętanej odpowiedzi."""
    speaker = server.speaker
    config = loadConfig()
    voices = installedVoices()
    languages = sorted({languageOfVoice(v) for v in voices})
    isLoaded = sessionId == speaker.sessionId
    saved = None if isLoaded else history.load(sessionId)
    return {
        "apiVersion": API_VERSION,
        "pluginVersion": server.pluginVersion,
        "serverRoot": server.serverRoot,
        "dataDir": paths.DATA_DIR,
        "canPlayAudio": player.isAvailable,
        "sessionId": sessionId,
        "isSessionLoaded": isLoaded,
        "state": speaker.state if isLoaded else "idle",
        "visual": speaker.visual if isLoaded and speaker.state == "speaking" else None,
        "visualizer": config.get("visualizer", "wave"),
        "visualizerColor": config.get("visualizerColor", "orange"),
        "index": speaker.index if isLoaded else 0,
        "total": len(speaker.chunks) if isLoaded else sectionCount(saved["messages"]),
        "detected": speaker.detected,
        "voice": speaker.voiceKey,
        "error": speaker.error,
        "language": config["language"],
        "speed": config["speed"],
        "muted": config["muted"],
        "autoRead": config["autoRead"],
        "liveRead": config["liveRead"],
        "soundCues": config["soundCues"],
        "soundPack": config.get("soundPack", DEFAULT_CUE_PACK),
        "soundPacks": packList(),
        "isTurnActive": speaker.isTurnActive if isLoaded else saved["isTurnActive"],
        "historyDays": history.historyDays(),
        "savedAnswers": history.savedCount(),
        "voiceForLanguage": config["voiceForLanguage"],
        "languages": [{"code": c, "name": languageName(c)} for c in languages],
        "voices": voices,
        "downloading": downloadState["voice"],
        "queued": list(downloadState["queue"]),
        "downloadError": downloadState["error"],
    }


def uninstall(speaker, body):
    """Usuwa jeden głos albo cały język; usunięty język przestaje być wybrany."""
    if body.get("voice"):
        modelKey = modelOfVoice(body["voice"])
        speaker.forgetModel(modelKey)
        removeModel(modelKey)
    elif body.get("language"):
        for modelKey in {modelOfVoice(v) for v in installedVoices() if languageOfVoice(v) == body["language"]}:
            speaker.forgetModel(modelKey)
            removeModel(modelKey)
        config = loadConfig()
        if config["language"] == body["language"]:
            config["language"] = "auto"
            saveConfig(config)
    speaker.changeVoice()


def applyConfig(speaker, body):
    """Zapisuje zmienione ustawienia i od razu stosuje tempo oraz głos."""
    config = loadConfig()
    for key in EDITABLE_KEYS:
        if key in body:
            config[key] = body[key]
    if "voiceForLanguage" in body:
        config["voiceForLanguage"].update(body["voiceForLanguage"])
    saveConfig(config)
    if "historyDays" in body:
        history.purge()
    if body.get("muted"):
        speaker.stop()
    if "speed" in body:
        speaker.changeSpeed()
    if "language" in body or "voiceForLanguage" in body or "fallbackLanguage" in body:
        speaker.changeVoice()


class Handler(BaseHTTPRequestHandler):
    """Trasy HTTP, które wywołuje mod."""

    def log_message(self, *args):
        """Wycisza domyślny log zapytań."""

    def sendJson(self, payload, status=200):
        """Wysyła odpowiedź JSON."""
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def readJson(self):
        """Czyta treść zapytania jako JSON (pusty obiekt, gdy jej brak)."""
        length = int(self.headers.get("Content-Length") or 0)
        return json.loads(self.rfile.read(length).decode("utf-8")) if length else {}

    def route(self):
        """Ścieżka zapytania bez parametrów."""
        return urlparse(self.path).path

    def sessionId(self):
        """Sesja (wątek czatu), z której przyszło zapytanie: parametr ?session=…"""
        values = parse_qs(urlparse(self.path).query).get("session")
        return values[0] if values and values[0] else history.DEFAULT_SESSION

    def do_GET(self):
        """Odpowiada na odczyt stanu i katalogu głosów."""
        self.server.lastRequest = time.time()
        if self.route() == "/status":
            return self.sendJson(statusPayload(self.server, self.sessionId()))
        if self.route() == "/catalog":
            return self.sendJson(catalogForUi())
        self.sendJson({"error": "not found"}, 404)

    def do_POST(self):
        """Odpowiada na sterowanie czytaniem i zmiany ustawień; błąd trafia do logu czytania i zwraca 500."""
        try:
            self.handlePost()
        except Exception as error:
            logReading(f"ERROR    {self.path}: {error!r}")
            self.sendJson({"error": repr(error)}, 500)

    def handlePost(self):
        """Obsługuje jedno zapytanie POST; zawsze zwraca nowy stan."""
        self.server.lastRequest = time.time()
        speaker = self.server.speaker
        body = self.readJson()
        route = self.route()
        sessionId = self.sessionId()
        isLoaded = sessionId == speaker.sessionId
        # Sterowanie użytkownika zawsze przełącza na jego czat; zdarzenia odpowiedzi - tylko gdy nic nie gra.
        if not isLoaded and (route in USER_ROUTES or (route.startswith("/turn/") and speaker.state != "speaking")):
            speaker.loadSession(sessionId)
            isLoaded = True
        if route.startswith("/turn/") and not isLoaded:
            # Inny czat właśnie czyta: odpowiedź tej sesji trafia tylko do jej pamięci.
            if route == "/turn/start":
                history.resetTurn(sessionId)
            elif route == "/turn/append":
                history.appendMessage(sessionId, body.get("text", ""))
            elif route == "/turn/mark":
                history.markToolUse(sessionId)
            elif route == "/turn/end":
                history.endTurn(sessionId)
            logReading(f"SESSION  {route} kept for {sessionId[:8]} (another chat is reading)")
        elif route == "/speak":
            config = loadConfig()
            if body.get("force") or (not config["muted"] and config["autoRead"]):
                speaker.speak(body.get("text", ""))
            elif not config["muted"]:
                speaker.prepare(body.get("text", ""))
        elif route == "/pause":
            logReading("USER     pause")
            if isLoaded:
                speaker.pause()
        elif route == "/resume":
            speaker.resume()
        elif route in ("/toggle", "/play"):
            logReading(f"USER     play/pause (state: {speaker.state})")
            speaker.playToggle()
        elif route == "/next":
            speaker.jump(1)
        elif route == "/prev":
            speaker.jump(-1)
        elif route == "/stop":
            logReading("USER     stop")
            speaker.stop()
        elif route == "/replay":
            speaker.replay()
        elif route == "/cue/preview":
            playCue("start", pack=body.get("pack"), isPreview=True)
        elif route == "/turn/start":
            speaker.startTurn()
        elif route == "/turn/append":
            config = loadConfig()
            speaker.appendToTurn(body.get("text", ""), config["autoRead"] and config["liveRead"])
        elif route == "/turn/mark":
            speaker.markToolUse()
        elif route == "/turn/end":
            # Tryb Wynik (autoRead bez liveRead): na koniec czyta od pierwszej sekcji ostatniej odpowiedzi.
            config = loadConfig()
            isFinalMode = config["autoRead"] and not config["liveRead"]
            isAnswer = body.get("reason", "answer") == "answer"
            speaker.endTurn(isAnswer and isFinalMode, startAtFinal=isAnswer and isFinalMode)
        elif route == "/log":
            # Zdarzenia moda (pytanie, wiadomość, koniec tury) trafiają do tego samego logu co czytanie.
            logReading(f"MOD      {body.get('event', '?')}: {body.get('detail', '')}")
        elif route == "/config":
            logReading(f"CONFIG   {json.dumps(body, ensure_ascii=False)}")
            applyConfig(speaker, body)
        elif route == "/install":
            voiceKey = body.get("voice") or (defaultVoiceOf(body["language"]) if body.get("language") else None)
            if voiceKey in loadCatalog():
                queueDownload(voiceKey)
        elif route == "/uninstall":
            uninstall(speaker, body)
        elif route == "/history/clear":
            history.clearAll()
            speaker.forgetAll()
        elif route == "/shutdown":
            speaker.stop()
            self.sendJson(statusPayload(self.server, sessionId))
            threading.Thread(target=self.server.shutdown, daemon=True).start()
            return
        else:
            return self.sendJson({"error": "not found"}, 404)
        self.sendJson(statusPayload(self.server, sessionId))
