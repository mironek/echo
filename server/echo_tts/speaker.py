"""Lektor: kolejka sekcji, synteza Piper i odtwarzanie z pauzą, przewijaniem i trybem Live."""
import os
import tempfile
import threading
import time
import wave

from piper import PiperVoice, SynthesisConfig

from . import history, paths
from .audio import player
from .config import loadConfig, logMessage, logReading, preview
from .cues import playCue
from .envelope import envelopeOf
from .languages import detectLanguage, hasVoiceForScript, languageOfVoice, scriptLanguage
from .text import cleanMarkdown, splitIntoChunks
from .voices import downloadState, installedVoices, modelOfVoice

# Po zmianie tempa zdanie wznawia się trochę wcześniej, żeby nie zgubić kontekstu.
RESUME_BACKOFF_SECONDS = 0.4


class Speaker:
    """Syntezuje i czyta tekst sekcja po sekcji, z pauzą, wznowieniem i zatrzymaniem."""

    def __init__(self):
        """Przygotowuje pustą kolejkę i pamięć głosów; przywraca odpowiedź sprzed restartu."""
        self.lock = threading.RLock()
        self.voices = {}
        self.chunks = []
        self.index = 0
        self.state = "idle"
        self.generation = 0
        self.interrupt = threading.Event()
        # Sesja (wątek czatu), której odpowiedź jest teraz załadowana; inne czekają w history.
        self.sessionId = None
        self.detected = None
        self.voiceKey = None
        self.error = None
        self.tempDir = tempfile.mkdtemp(prefix="echo_")
        self.chunkStarted = 0.0
        self.chunkDuration = 0.0
        self.chunkOffset = 0.0
        self.isTurnActive = False
        self.turnText = ""
        self.turnMessages = []
        self.messageStarts = set()
        self.isLiveReading = False
        # Od której wiadomości zaczyna się ostatnia odpowiedź (tekst po ostatnim użyciu narzędzia) - tryb Wynik.
        self.finalStart = 0
        # Wizualizacja czytanej sekcji: identyfikator, krok i poziomy obwiedni (None, gdy nic nie gra).
        self.visual = None

    # ------------------------------------------------------------ odpowiedź ---
    def saveTurn(self):
        """Zapisuje odpowiedź załadowanej sesji (pamięć i - zależnie od ustawień - dysk)."""
        if self.sessionId is not None:
            history.save(self.sessionId, self.turnMessages, self.isTurnActive, self.finalStart)

    def rebuildChunks(self):
        """Dzieli wiadomości załadowanej odpowiedzi na sekcje i wybiera głos."""
        self.turnText = "\n\n".join(self.turnMessages)
        self.detected, self.voiceKey = self.pickVoice(cleanMarkdown(self.turnText), loadConfig())
        self.chunks = []
        self.messageStarts = set()
        if self.voiceKey:
            for message in self.turnMessages:
                self.messageStarts.add(len(self.chunks))
                self.chunks.extend(splitIntoChunks(cleanMarkdown(message)))

    def loadSession(self, sessionId):
        """Ładuje odpowiedź innej sesji (czatu); to, co grało, zostaje zatrzymane."""
        with self.lock:
            wasSpeaking = self.state == "speaking"
            self.stopPlayback()
            if wasSpeaking:
                playCue("end")
            data = history.load(sessionId)
            self.sessionId = sessionId
            self.turnMessages = list(data["messages"])
            self.isTurnActive = data["isTurnActive"]
            self.finalStart = data.get("finalStart", 0)
            self.rebuildChunks()
            self.index = max(0, len(self.chunks) - 1) if self.isTurnActive else 0
            self.state = "idle"
            self.error = None
            logReading(
                f"SESSION  loaded {sessionId[:8]}: {len(self.turnMessages)} message(s), {len(self.chunks)} section(s)"
            )

    def forgetAll(self):
        """Po „Wyczyść wszystko”: zatrzymuje czytanie i opróżnia załadowaną odpowiedź."""
        with self.lock:
            self.stopPlayback()
            self.state = "idle"
            self.turnMessages = []
            self.isTurnActive = False
            self.turnText = ""
            self.chunks = []
            self.messageStarts = set()
            self.index = 0

    def startTurn(self):
        """Nowe pytanie czyści poprzednią odpowiedź: brak sekcji, dopóki Claude nie napisze."""
        with self.lock:
            wasSpeaking = self.state == "speaking"
            logReading(
                f"RESET    turn start: dropped {len(self.turnMessages)} message(s), {len(self.chunks)} section(s)"
                + (", was speaking" if wasSpeaking else "")
            )
            self.stopPlayback()
            if wasSpeaking:
                playCue("end")
            self.isTurnActive = True
            self.turnText = ""
            self.turnMessages = []
            self.finalStart = 0
            self.messageStarts = set()
            self.chunks = []
            self.index = 0
            self.state = "idle"
            self.error = None
            self.saveTurn()

    def appendToTurn(self, text, isLive):
        """Dodaje wiadomość Claude'a jako nowe sekcje; w trybie Live czyta je od razu."""
        plain = cleanMarkdown(text)
        newChunks = splitIntoChunks(plain)
        if not newChunks:
            logReading(f"APPEND   skipped (nothing to read): {preview(text)!r}")
            return
        with self.lock:
            if not self.isTurnActive:
                logReading("APPEND   no active turn, starting one")
                self.startTurn()
            self.turnText = (self.turnText + "\n\n" + text).strip()
            self.turnMessages.append(text)
            self.saveTurn()
            if self.state != "speaking":
                hadNoVoice = self.voiceKey is None
                self.detected, self.voiceKey = self.pickVoice(cleanMarkdown(self.turnText), loadConfig())
                if hadNoVoice and self.voiceKey is not None and self.languageStillDownloading():
                    self.voiceKey = None
                if hadNoVoice and self.voiceKey is not None and len(self.turnMessages) > 1:
                    # Głos pojawił się w trakcie odpowiedzi: wcześniejsze wiadomości też stają się sekcjami.
                    self.recoverWithFirstVoice(isLive)
                    return
            if self.voiceKey is None:
                logReading(
                    f"APPEND   message {len(self.turnMessages)} kept, waiting for a {self.detected or ''} voice "
                    "(none installed for this language yet)"
                )
                return
            firstNew = len(self.chunks)
            self.messageStarts.add(firstNew)
            self.chunks.extend(newChunks)
            if isLive and self.state == "idle":
                action = "reading now (live)"
            elif isLive:
                action = f"queued (state: {self.state})"
            else:
                action = "waiting (not live)"
            logReading(
                f"APPEND   message {len(self.turnMessages)}: +{len(newChunks)} section(s) "
                f"{firstNew + 1}-{len(self.chunks)}, {action}: {preview(text)!r}"
            )
            if isLive and self.state == "idle":
                self.index = firstNew
                self.startWorker(isLive=True)

    def markToolUse(self):
        """Claude użył narzędzia: tekst napisany potem zaczyna ostatnią odpowiedź (tryb Wynik)."""
        with self.lock:
            self.finalStart = len(self.turnMessages)
            self.saveTurn()

    def finalSectionIndex(self):
        """Pierwsza sekcja ostatniej odpowiedzi (tekst po ostatnim użyciu narzędzia); bez narzędzi - sekcja 1."""
        starts = sorted(self.messageStarts)
        if 0 < self.finalStart < len(starts):
            return starts[self.finalStart]
        return 0

    def endTurn(self, shouldReadAll, startAtFinal=False):
        """Zamyka odpowiedź; w trybie Wynik czyta od pierwszej sekcji ostatniej odpowiedzi (wcześniejsze zostają, ❮ do nich wraca)."""
        with self.lock:
            startIndex = self.finalSectionIndex() if startAtFinal else 0
            logReading(
                f"END      turn end: {len(self.turnMessages)} message(s), {len(self.chunks)} section(s), "
                f"read all: {bool(shouldReadAll and self.chunks)}"
                + (f", from final answer: section {startIndex + 1}" if startAtFinal else "")
            )
            self.isTurnActive = False
            self.saveTurn()
            if shouldReadAll and self.chunks:
                self.stopPlayback()
                self.index = startIndex
                self.startWorker()

    # ----------------------------------------------------------------- głos ---
    def pickVoice(self, text, config):
        """Wybiera język i głos dla tekstu według ustawień."""
        voices = installedVoices()
        available = sorted({languageOfVoice(v) for v in voices})
        fallback = config["fallbackLanguage"] if config["fallbackLanguage"] in available else (available[0] if available else None)
        language = config["language"]
        if language == "auto" or language not in available:
            script = scriptLanguage(text)
            if script and not hasVoiceForScript(script, available):
                # Tekst w piśmie, którego żaden zainstalowany głos nie przeczyta (np. japoński przy samym polskim
                # i angielskim): brak głosu - tekst czeka na zainstalowanie głosu, zamiast brzmieć obcym głosem.
                return script, None
            language = detectLanguage(text, available, fallback)
        preferred = config["voiceForLanguage"].get(language)
        if preferred not in voices:
            preferred = next((v for v in voices if languageOfVoice(v) == language), None)
        return language, preferred

    def changeVoice(self):
        """Wybiera głos na nowo z ustawień; w trakcie czytania zaczyna bieżące zdanie nowym głosem."""
        with self.lock:
            text = self.turnText
            language, voiceKey = self.pickVoice(cleanMarkdown(text), loadConfig())
            if voiceKey == self.voiceKey:
                self.detected = language
                return
            hadNoVoice = self.voiceKey is None
            self.detected, self.voiceKey = language, voiceKey
            if hadNoVoice and voiceKey is not None and self.languageStillDownloading():
                self.voiceKey = None
                return
            if hadNoVoice and voiceKey is not None:
                config = loadConfig()
                self.recoverWithFirstVoice(config["autoRead"] and config["liveRead"])
                return
            if voiceKey is None:
                self.stop()
            elif self.state == "speaking":
                self.stopPlayback()
                self.startWorker()

    def languageStillDownloading(self):
        """Czy język odpowiedzi ma głos dopiero w kolejce pobierania (wtedy lepiej poczekać, niż czytać obcym głosem)."""
        pendingVoices = [voice for voice in [downloadState["voice"], *downloadState["queue"]] if voice]
        pending = {languageOfVoice(voice) for voice in pendingVoices}
        installed = {languageOfVoice(voice) for voice in installedVoices()}
        if not pending - installed or not self.turnText:
            return False
        language = detectLanguage(cleanMarkdown(self.turnText), sorted(installed | pending), loadConfig()["fallbackLanguage"])
        isWaiting = language in pending and language not in installed
        if isWaiting:
            logReading(f"VOICE    waiting for a {language} voice (still downloading) before reading")
        return isWaiting

    def recoverWithFirstVoice(self, isLive):
        """Pierwszy głos jest gotowy: wiadomości zebrane bez głosu stają się sekcjami i (Live/Auto) są czytane."""
        self.rebuildChunks()
        logReading(f"VOICE    voice ready ({self.voiceKey}): {len(self.chunks)} section(s) from waiting messages")
        shouldRead = isLive or (not self.isTurnActive and loadConfig()["autoRead"])
        if self.chunks and self.state == "idle" and shouldRead:
            self.index = 0
            self.startWorker(isLive=isLive)

    def getVoice(self, voiceKey):
        """Wczytuje model głosu Piper raz i trzyma go w pamięci."""
        modelKey = modelOfVoice(voiceKey)
        if modelKey not in self.voices:
            self.voices[modelKey] = PiperVoice.load(os.path.join(paths.VOICES_DIR, modelKey + ".onnx"))
        return self.voices[modelKey]

    def forgetModel(self, modelKey):
        """Zatrzymuje czytanie modelem, który jest usuwany, i zwalnia go z pamięci."""
        with self.lock:
            if self.voiceKey and modelOfVoice(self.voiceKey) == modelKey:
                self.stop()
            self.voices.pop(modelKey, None)

    def prepare(self, text):
        """Zastępuje odpowiedź załadowanej sesji jednym tekstem, gotowym do czytania od pierwszej sekcji."""
        with self.lock:
            self.stopPlayback()
            self.turnMessages = [text]
            self.isTurnActive = False
            self.saveTurn()
            self.rebuildChunks()
            self.index = 0
            self.error = None
            self.state = "idle"

    # ------------------------------------------------------------- sterowanie ---
    def speak(self, text):
        """Zastępuje to, co gra, nowym tekstem czytanym od pierwszej sekcji."""
        with self.lock:
            self.prepare(text)
            if self.chunks:
                self.startWorker()

    def playToggle(self):
        """Pauzuje czytaną sekcję albo czyta bieżącą sekcję od początku."""
        with self.lock:
            if self.state == "speaking":
                self.stopPlayback()
                self.state = "paused"
            elif self.chunks:
                if self.index >= len(self.chunks):
                    self.index = 0
                self.startWorker()

    def jump(self, delta):
        """Przechodzi do innej sekcji; w trakcie czytania od razu ją czyta."""
        with self.lock:
            if not self.chunks:
                return
            newIndex = max(0, min(len(self.chunks) - 1, self.index + delta))
            if newIndex == self.index:
                return
            isSpeaking = self.state == "speaking"
            if isSpeaking:
                self.stopPlayback()
            self.index = newIndex
            if isSpeaking:
                self.startWorker()

    def changeSpeed(self):
        """Czyta bieżące zdanie dalej od miejsca, w którym było, w nowym tempie."""
        with self.lock:
            if self.state == "speaking":
                fraction = self.currentFraction()
                self.stopPlayback()
                self.startWorker(fraction)

    def pause(self):
        """Ucisza dźwięk; bieżąca sekcja zostaje."""
        with self.lock:
            if self.state == "speaking":
                self.stopPlayback()
                self.state = "paused"
                playCue("end")

    def resume(self):
        """Czyta bieżącą sekcję od początku."""
        with self.lock:
            if self.state != "speaking":
                self.playToggle()

    def stop(self):
        """Kończy czytanie i wraca do pierwszej sekcji."""
        with self.lock:
            wasSpeaking = self.state == "speaking"
            self.stopPlayback()
            self.state = "idle"
            self.index = 0
            if wasSpeaking:
                playCue("end")

    def replay(self):
        """Czyta załadowaną odpowiedź jeszcze raz od początku."""
        with self.lock:
            if self.chunks:
                self.stopPlayback()
                self.index = 0
                self.startWorker()

    # ----------------------------------------------------------- odtwarzanie ---
    def currentFraction(self):
        """Zwraca, jaka część bieżącego zdania już zabrzmiała (0-1), cofniętą odrobinę dla kontekstu."""
        if self.chunkDuration <= 0:
            return 0.0
        elapsed = min(1.0, (time.time() - self.chunkStarted) / self.chunkDuration)
        fraction = self.chunkOffset + elapsed * (1.0 - self.chunkOffset)
        fullDuration = self.chunkDuration / max(0.01, 1.0 - self.chunkOffset)
        return max(0.0, min(0.95, fraction - RESUME_BACKOFF_SECONDS / fullDuration))

    def startWorker(self, startFraction=0.0, isLive=None):
        """Uruchamia wątek czytania dla nowej generacji; pierwsze zdanie od startFraction jego długości.

        Czytanie zaczynane od ciszy (nie przeskok ani zmiana tempa w trakcie) zaczyna się sygnałem.
        Tryb Live (start przez nową wiadomość) gra sygnał między wiadomościami; przeskok i zmiana
        tempa zachowują tryb przerwanego czytania, wszystko inne nie jest Live."""
        isSpeaking = self.state == "speaking"
        withCue = not isSpeaking
        self.isLiveReading = (self.isLiveReading if isSpeaking else False) if isLive is None else isLive
        logReading(
            f"PLAY     from section {self.index + 1}/{len(self.chunks)}"
            + (" (live)" if self.isLiveReading else "")
            + (f", resume at {startFraction:.0%}" if startFraction else "")
            + ("" if withCue else ", continuing")
        )
        self.generation += 1
        self.state = "speaking"
        self.interrupt = threading.Event()
        threading.Thread(
            target=self.run, args=(self.generation, self.interrupt, startFraction, withCue), daemon=True
        ).start()

    def stopPlayback(self):
        """Ucina grający dźwięk i kończy wątek czytania."""
        self.visual = None
        self.generation += 1
        self.interrupt.set()
        player.stop()

    def trimWav(self, path, fraction):
        """Wycina początkową część pliku wav; zwraca nową długość w sekundach."""
        with wave.open(path, "rb") as r:
            params = r.getparams()
            frames = r.readframes(r.getnframes())
        frameSize = params.sampwidth * params.nchannels
        skip = int(params.nframes * fraction) * frameSize
        with wave.open(path, "wb") as w:
            w.setparams(params)
            w.writeframes(frames[skip:])
        return (len(frames) - skip) / frameSize / float(params.framerate)

    def synthesize(self, voice, text, path, speed, speaker=None):
        """Zapisuje jedną sekcję do pliku wav i zwraca jej długość w sekundach."""
        speakerId = voice.config.speaker_id_map.get(speaker) if speaker and voice.config.speaker_id_map else None
        synConfig = SynthesisConfig(length_scale=1.0 / max(0.5, min(2.0, speed)), speaker_id=speakerId)
        # Głosy czytające litery (nie fonemy) znają tylko małe litery.
        if voice.config.phoneme_type.value == "text":
            text = text.lower()
        with wave.open(path, "wb") as w:
            voice.synthesize_wav(text, w, syn_config=synConfig)
        with wave.open(path, "rb") as r:
            return r.getnframes() / float(r.getframerate())

    def run(self, generation, interrupt, startFraction=0.0, withCue=False):
        """Czyta sekcje od bieżącej do końca, pauzy albo zatrzymania; następną syntezuje w trakcie czytania."""
        try:
            voice = self.getVoice(self.voiceKey)
            speaker = self.voiceKey.split("#")[1] if "#" in self.voiceKey else None
            speed = float(loadConfig().get("speed", 1.0))
            if withCue and generation == self.generation:
                playCue("start", isBlocking=True)
            prepared = None
            isFirstChunk = True
            while True:
                with self.lock:
                    if generation != self.generation or self.index >= len(self.chunks):
                        break
                    i = self.index
                    text = self.chunks[i]
                path = os.path.join(self.tempDir, f"chunk_{generation}_{i}.wav")
                if prepared and prepared[0] == i:
                    duration = prepared[1]
                else:
                    duration = self.synthesize(voice, text, path, speed, speaker)
                offset = startFraction
                startFraction = 0.0
                if offset > 0:
                    duration = self.trimWav(path, offset)
                if generation != self.generation:
                    break
                isNewMessage = i in self.messageStarts and not isFirstChunk
                if isNewMessage and self.isLiveReading:
                    playCue("between", isBlocking=True)
                isFirstChunk = False
                logReading(f"SECTION  {i + 1}/{len(self.chunks)}: {preview(text)!r}")
                step, levels = envelopeOf(path)
                player.play(path)
                started = time.time()
                with self.lock:
                    if generation == self.generation:
                        self.chunkStarted, self.chunkDuration, self.chunkOffset = started, duration, offset
                        self.visual = {
                            "id": f"{generation}-{i}",
                            "startedAt": round(started * 1000),
                            "duration": round(duration, 3),
                            "step": step,
                            "levels": levels,
                        }
                prepared = None
                with self.lock:
                    hasNext = i + 1 < len(self.chunks)
                    nextText = self.chunks[i + 1] if hasNext else None
                if hasNext:
                    nextPath = os.path.join(self.tempDir, f"chunk_{generation}_{i + 1}.wav")
                    prepared = (i + 1, self.synthesize(voice, nextText, nextPath, speed, speaker))
                wasInterrupted = interrupt.wait(max(0.0, duration - (time.time() - started)) + 0.05)
                self.removeFile(path)
                if wasInterrupted:
                    logReading(f"STOPPED  during section {i + 1}")
                    break
                with self.lock:
                    if generation == self.generation:
                        self.index = i + 1
            with self.lock:
                if generation == self.generation and self.state == "speaking":
                    logReading(f"DONE     reached the end of the queue ({len(self.chunks)} section(s))")
                    self.visual = None
                    self.state = "idle"
                    if self.index >= len(self.chunks):
                        # W trakcie odpowiedzi zostaje na ostatniej sekcji, żeby Live czytał dalej od niej.
                        self.index = max(0, len(self.chunks) - 1) if self.isTurnActive else 0
                    playCue("end")
        except Exception as error:
            logMessage("playback error: " + repr(error))
            logReading("ERROR    playback: " + repr(error))
            with self.lock:
                self.error = str(error)
                self.state = "idle"

    def removeFile(self, path):
        """Usuwa tymczasowy plik wav, ignorując błędy."""
        try:
            os.remove(path)
        except OSError:
            pass
