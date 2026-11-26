"""Odtwarzanie plików wav na Windows, macOS i Linuksie.

Gra jeden dźwięk naraz: nowy dźwięk przerywa poprzedni (tak jak winsound).
Windows: winsound. macOS: afplay. Linux: paplay, pw-play, aplay albo ffplay.
"""
import os
import platform
import shutil
import subprocess
import threading

if os.name == "nt":
    import winsound

# Odtwarzacze na Linuksie w kolejności wyboru; plik wav dopisywany na końcu.
LINUX_PLAYERS = (
    ["paplay"],
    ["pw-play"],
    ["aplay", "-q"],
    ["ffplay", "-nodisp", "-autoexit", "-loglevel", "quiet"],
)


class AudioPlayer:
    """Gra pliki wav w tle albo do końca, z możliwością natychmiastowego zatrzymania."""

    def __init__(self):
        """Wybiera sposób odtwarzania dla bieżącego systemu."""
        self.lock = threading.Lock()
        self.process = None
        self.command = self.findCommand()

    def findCommand(self):
        """Zwraca polecenie odtwarzacza (bez pliku) albo None na Windows."""
        if os.name == "nt":
            return None
        if platform.system() == "Darwin":
            return ["afplay"]
        for command in LINUX_PLAYERS:
            if shutil.which(command[0]):
                return command
        return None

    @property
    def isAvailable(self):
        """Czy na tym komputerze jest czym odtwarzać dźwięk."""
        return os.name == "nt" or self.command is not None

    def play(self, path, isBlocking=False):
        """Gra plik; przy isBlocking czeka do końca (albo do zatrzymania)."""
        self.stop()
        if os.name == "nt":
            flags = winsound.SND_FILENAME | winsound.SND_NODEFAULT
            winsound.PlaySound(path, flags if isBlocking else flags | winsound.SND_ASYNC)
            return
        if self.command is None:
            return
        process = subprocess.Popen(
            self.command + [path], stdin=subprocess.DEVNULL, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL
        )
        with self.lock:
            self.process = process
        if isBlocking:
            process.wait()

    def stop(self):
        """Natychmiast ucisza to, co gra."""
        if os.name == "nt":
            winsound.PlaySound(None, 0)
            return
        with self.lock:
            process, self.process = self.process, None
        if process and process.poll() is None:
            process.terminate()


# Jeden odtwarzacz na cały serwer: sygnały i mowa przerywają się nawzajem.
player = AudioPlayer()
