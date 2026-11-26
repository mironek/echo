"""Pamięć ostatniej odpowiedzi osobno dla każdego wątku czatu (sesji Claude Code).

Dla każdej sesji Echo trzyma tylko tekst ostatniej odpowiedzi (wiadomości Claude'a), nie dźwięk:
sekcje są syntezowane na bieżąco do plików tymczasowych i usuwane zaraz po przeczytaniu.
Ustawienie historyDays: 0 = nic nie trafia na dysk (pamięć tylko do zamknięcia serwera),
N = plik sesji jest usuwany N dni po ostatniej zmianie. Sprzątanie przy starcie i raz na dobę.
"""
import json
import os
import re
import threading
import time

from . import paths
from .config import loadConfig, logReading

SECONDS_PER_DAY = 24 * 3600
# Identyfikator sesji, gdy mod go nie podał (np. starsza wersja moda).
DEFAULT_SESSION = "default"

memory = {}
memoryLock = threading.Lock()


def historyDays():
    """Ile dni trzymać odpowiedzi na dysku; 0 = wcale."""
    try:
        return max(0, int(loadConfig().get("historyDays", 30)))
    except (TypeError, ValueError):
        return 30


def sessionPath(sessionId):
    """Ścieżka pliku sesji; identyfikator jest oczyszczany do bezpiecznej nazwy pliku."""
    safe = re.sub(r"[^A-Za-z0-9_-]", "_", sessionId)[:100] or DEFAULT_SESSION
    return os.path.join(paths.HISTORY_DIR, safe + ".json")


def emptyTurn():
    """Pusta odpowiedź: bez wiadomości, nie w trakcie."""
    return {"messages": [], "isTurnActive": False, "finalStart": 0, "updatedAt": time.time()}


def load(sessionId):
    """Zwraca kopię odpowiedzi sesji: z pamięci, z dysku (jeśli nie wygasła) albo pustą."""
    with memoryLock:
        if sessionId in memory:
            return json.loads(json.dumps(memory[sessionId]))
    data = emptyTurn()
    path = sessionPath(sessionId)
    days = historyDays()
    if days > 0 and os.path.exists(path):
        try:
            with open(path, encoding="utf-8") as f:
                saved = json.load(f)
            if time.time() - saved.get("updatedAt", 0) <= days * SECONDS_PER_DAY:
                data = {**data, **saved}
            else:
                os.remove(path)
        except (OSError, ValueError):
            pass
    with memoryLock:
        memory[sessionId] = data
    return json.loads(json.dumps(data))


def save(sessionId, messages, isTurnActive, finalStart=0):
    """Zapisuje odpowiedź sesji w pamięci i (gdy pamięć dni jest włączona) na dysku.

    finalStart: od której wiadomości zaczyna się ostatnia odpowiedź (tekst po ostatnim użyciu narzędzia)."""
    data = {
        "messages": list(messages),
        "isTurnActive": bool(isTurnActive),
        "finalStart": int(finalStart),
        "updatedAt": time.time(),
    }
    with memoryLock:
        memory[sessionId] = data
    if historyDays() > 0:
        try:
            with open(sessionPath(sessionId), "w", encoding="utf-8") as f:
                json.dump(data, f, ensure_ascii=False)
        except OSError:
            pass


def resetTurn(sessionId):
    """Nowe pytanie w sesji, która nie jest teraz załadowana: czyści jej odpowiedź."""
    save(sessionId, [], True)


def appendMessage(sessionId, text):
    """Dopisuje wiadomość do odpowiedzi sesji, która nie jest teraz załadowana."""
    data = load(sessionId)
    save(sessionId, data["messages"] + [text], True, data.get("finalStart", 0))


def markToolUse(sessionId):
    """Claude użył narzędzia w sesji, która nie jest teraz załadowana: kolejny tekst zaczyna ostatnią odpowiedź."""
    data = load(sessionId)
    save(sessionId, data["messages"], data["isTurnActive"], len(data["messages"]))


def endTurn(sessionId):
    """Kończy odpowiedź sesji, która nie jest teraz załadowana (wszystkie sekcje zostają)."""
    data = load(sessionId)
    save(sessionId, data["messages"], False, data.get("finalStart", 0))


def purge():
    """Usuwa pliki sesji starsze niż historyDays (przy 0 - wszystkie)."""
    days = historyDays()
    removed = 0
    for name in os.listdir(paths.HISTORY_DIR):
        path = os.path.join(paths.HISTORY_DIR, name)
        try:
            if days == 0 or time.time() - os.path.getmtime(path) > days * SECONDS_PER_DAY:
                os.remove(path)
                removed += 1
        except OSError:
            pass
    if removed:
        logReading(f"HISTORY  purged {removed} saved answer(s) (keep: {days} day(s))")


def clearAll():
    """Usuwa zapamiętane odpowiedzi wszystkich sesji, z pamięci i z dysku."""
    with memoryLock:
        memory.clear()
    for name in os.listdir(paths.HISTORY_DIR):
        try:
            os.remove(os.path.join(paths.HISTORY_DIR, name))
        except OSError:
            pass
    logReading("HISTORY  cleared all saved answers")


def savedCount():
    """Ile odpowiedzi jest zapisanych na dysku."""
    return len([name for name in os.listdir(paths.HISTORY_DIR) if name.endswith(".json")])
