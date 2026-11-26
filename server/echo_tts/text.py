"""Przygotowanie tekstu do czytania: czyszczenie Markdownu i podział na sekcje."""
import re

# Krótsze akapity (np. nagłówki) są doklejane do następnego.
MIN_CHUNK_CHARS = 80
# Dłuższe akapity są dzielone po zdaniach.
MAX_CHUNK_CHARS = 1200


def cleanMarkdown(text):
    """Zamienia odpowiedź w Markdownie na zwykły tekst do czytania (bez bloków kodu i adresów linków)."""
    text = re.sub(r"```.*?```", " ", text, flags=re.S)
    text = re.sub(r"```.*$", " ", text, flags=re.S)
    text = re.sub(r"`([^`]*)`", r"\1", text)
    text = re.sub(r"!\[[^\]]*\]\([^)]*\)", " ", text)
    text = re.sub(r"\[([^\]]+)\]\([^)]*\)", r"\1", text)
    text = re.sub(r"https?://\S+", " ", text)
    text = re.sub(r"<[^>]+>", " ", text)
    text = re.sub(r"^\s{0,3}#{1,6}\s*(.*)$", r"\1.", text, flags=re.M)
    text = re.sub(r"^\s*[-*+]\s+", "", text, flags=re.M)
    text = re.sub(r"^\s*>\s?", "", text, flags=re.M)
    # Tabele: wiersz separatora znika, kreski między komórkami stają się przecinkami.
    text = re.sub(r"^[ \t]*\|?[ \t:|-]+\|[ \t:|-]*\n?", "", text, flags=re.M)
    text = re.sub(r"^[ \t]*-{3,}[ \t]*$", "", text, flags=re.M)
    text = re.sub(r"^[ \t]*\|(.*?)\|?[ \t]*$", r"\1", text, flags=re.M)
    text = re.sub(r"[ \t]*\|[ \t]*", ", ", text)
    text = re.sub(r"\*\*|__|~~|\*", "", text)
    text = re.sub(r"[→←↔⇒]", ", ", text)
    text = re.sub(r"[ \t]+", " ", text)
    return text.strip()


def splitIntoChunks(text):
    """Dzieli tekst na sekcje po akapitach: krótkie łączy z następnym, bardzo długie tnie po zdaniach."""
    paragraphs = []
    for block in re.split(r"\n\s*\n", text):
        lines = []
        for line in block.split("\n"):
            line = line.strip().rstrip(",;").strip()
            if not line:
                continue
            if not re.search(r"[.!?:。！？…]$", line):
                line += "."
            lines.append(line)
        if lines:
            paragraphs.append(" ".join(lines))
    pieces = []
    for paragraph in paragraphs:
        if len(paragraph) <= MAX_CHUNK_CHARS:
            pieces.append(paragraph)
            continue
        current = ""
        for sentence in re.split(r"(?<=[.!?。！？…])\s+|(?<=[。！？])", paragraph):
            if current and len(current) + len(sentence) > MAX_CHUNK_CHARS:
                pieces.append(current)
                current = sentence
            else:
                current = (current + " " + sentence).strip()
        if current:
            pieces.append(current)
    chunks = []
    for piece in pieces:
        if chunks and len(chunks[-1]) < MIN_CHUNK_CHARS and len(chunks[-1]) + len(piece) <= MAX_CHUNK_CHARS:
            chunks[-1] += " " + piece
        else:
            chunks.append(piece)
    return chunks
