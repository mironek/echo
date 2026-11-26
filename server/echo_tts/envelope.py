"""Obwiednia głośności sekcji (do wizualizacji na pasku): poziom 0–1 co ENVELOPE_STEP sekund."""
import wave

import numpy as np

# Co ile sekund jedna wartość obwiedni (30 na sekundę: tyle klatek na sekundę najwyżej może mieć animacja).
ENVELOPE_STEP = 1 / 30
# Ile wartości najwyżej (dłuższa sekcja dostaje rzadszy krok), żeby stan paska był mały.
MAX_LEVELS = 2400


def envelopeOf(path):
    """Zwraca (krok w sekundach, poziomy 0–1) dla pliku wav; poziomy znormalizowane do najgłośniejszego fragmentu."""
    with wave.open(path, "rb") as r:
        rate = r.getframerate()
        channels = r.getnchannels()
        frames = r.readframes(r.getnframes())
    samples = np.frombuffer(frames, dtype=np.int16).astype(np.float32)
    if channels > 1:
        samples = samples.reshape(-1, channels).mean(axis=1)
    if samples.size == 0:
        return ENVELOPE_STEP, []
    duration = samples.size / rate
    step = max(ENVELOPE_STEP, duration / MAX_LEVELS)
    window = max(1, int(rate * step))
    count = samples.size // window
    if count == 0:
        return step, []
    rms = np.sqrt(np.mean(samples[: count * window].reshape(count, window) ** 2, axis=1))
    peak = float(np.percentile(rms, 95)) or 1.0
    # Pierwiastek wyrównuje różnice: ciche fragmenty mowy też są widoczne.
    levels = np.sqrt(np.clip(rms / peak, 0.0, 1.0))
    return step, [round(float(level), 2) for level in levels]
