"""Sygnały dźwiękowe: początek i koniec czytania oraz cichy sygnał między wiadomościami w trybie Live.

Pliki wav są generowane przy starcie (proste sinusy z obwiednią). Własne pliki
podmienione w folderze sounds/ nie są nadpisywane.
"""
import math
import os
import struct
import wave

from . import paths
from .audio import player
from .config import loadConfig

CUE_SAMPLE_RATE = 22050
DEFAULT_CUE_PACK = "soft"
BELL_PARTIALS = [(1.0, 1.0), (2.0, 0.25), (3.0, 0.08)]
# Każdy zestaw: nazwa, głośność i nuty sygnału początku jako
# (częstotliwość Hz, start s, długość s, tempo wygasania, harmoniczne, glissando do Hz albo None).
# Sygnał końca gra te same nuty w odwróconej kolejności wysokości (glissando w drugą stronę).
# Sygnał między wiadomościami to jedna cichsza, krótsza nuta zestawu.
CUE_PACKS = {
    "soft": {
        "name": "Delikatny",
        "volume": 0.12,
        "notes": [(659.25, 0.0, 0.16, 18, [(1.0, 1.0)], None), (880.0, 0.07, 0.16, 18, [(1.0, 1.0)], None)],
        "betweenVolume": 0.07,
        "between": [(783.99, 0.0, 0.12, 24, [(1.0, 1.0)], None)],
    },
    "bell": {
        "name": "Dzwonek",
        "volume": 0.08,
        "notes": [
            (1046.5, 0.0, 0.35, 10, BELL_PARTIALS, None),
            (1318.5, 0.06, 0.35, 10, BELL_PARTIALS, None),
            (1568.0, 0.12, 0.35, 10, BELL_PARTIALS, None),
        ],
        "betweenVolume": 0.05,
        "between": [(1318.5, 0.0, 0.25, 14, BELL_PARTIALS, None)],
    },
    "drop": {
        "name": "Kropla",
        "volume": 0.14,
        "notes": [(520.0, 0.0, 0.14, 22, [(1.0, 1.0)], 880.0)],
        "betweenVolume": 0.08,
        "between": [(700.0, 0.0, 0.08, 30, [(1.0, 1.0)], 800.0)],
    },
}
CUE_KINDS = ("start", "end", "between")


def cueNotes(pack, kind):
    """Zwraca nuty sygnału początku, końca (odwrócone wysokości) albo sygnału między wiadomościami."""
    if kind == "between":
        return CUE_PACKS[pack]["between"]
    notes = CUE_PACKS[pack]["notes"]
    if kind == "start":
        return notes
    if len(notes) == 1:
        frequency, at, length, decay, partials, glideTo = notes[0]
        return [(glideTo or frequency, at, length, decay, partials, frequency if glideTo else None)]
    pitches = [note[0] for note in notes][::-1]
    return [(pitch,) + note[1:] for pitch, note in zip(pitches, notes)]


def writeCue(path, notes, volume):
    """Renderuje nuty (sinusy z krótkim narastaniem i długim wygasaniem) do pliku wav mono."""
    total = max(at + length for _, at, length, _, _, _ in notes)
    samples = [0.0] * int(total * CUE_SAMPLE_RATE + 1)
    for frequency, at, length, decay, partials, glideTo in notes:
        start = int(at * CUE_SAMPLE_RATE)
        phase = 0.0
        for i in range(int(length * CUE_SAMPLE_RATE)):
            t = i / CUE_SAMPLE_RATE
            current = frequency + (glideTo - frequency) * min(1.0, t / length) if glideTo else frequency
            phase += 2 * math.pi * current / CUE_SAMPLE_RATE
            envelope = min(1.0, t / 0.008) * math.exp(-t * decay)
            samples[start + i] += envelope * sum(amp * math.sin(phase * mult) for mult, amp in partials)
    with wave.open(path, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(CUE_SAMPLE_RATE)
        w.writeframes(b"".join(struct.pack("<h", int(max(-1.0, min(1.0, s * volume)) * 32767)) for s in samples))


def cuePath(pack, kind):
    """Zwraca ścieżkę pliku wav danego sygnału zestawu."""
    return os.path.join(paths.SOUNDS_DIR, pack, kind + ".wav")


def ensureCueSounds():
    """Tworzy brakujące pliki sygnałów wszystkich zestawów (własne pliki zostają)."""
    for pack, info in CUE_PACKS.items():
        os.makedirs(os.path.join(paths.SOUNDS_DIR, pack), exist_ok=True)
        for kind in CUE_KINDS:
            if not os.path.exists(cuePath(pack, kind)):
                volume = info["betweenVolume"] if kind == "between" else info["volume"]
                writeCue(cuePath(pack, kind), cueNotes(pack, kind), volume)


def playCue(kind, isBlocking=False, pack=None, isPreview=False):
    """Gra sygnał wybranego zestawu, gdy sygnały są włączone (podgląd gra zawsze)."""
    config = loadConfig()
    if not isPreview and not config.get("soundCues", True):
        return
    pack = pack or config.get("soundPack", DEFAULT_CUE_PACK)
    path = cuePath(pack if pack in CUE_PACKS else DEFAULT_CUE_PACK, kind)
    if os.path.exists(path):
        player.play(path, isBlocking)


def packList():
    """Lista zestawów dla moda: identyfikator i nazwa."""
    return [{"id": key, "name": info["name"]} for key, info in CUE_PACKS.items()]
