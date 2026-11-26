"""Języki: nazwy angielskie, język systemu i wykrywanie języka tekstu."""
import os
import re

# Angielskie nazwy języków; mod pokazuje nazwy w języku interfejsu (Intl.DisplayNames), te są zapasowe.
LANGUAGE_NAMES = {
    "pl": "Polish", "en": "English", "de": "German", "fr": "French",
    "it": "Italian", "ru": "Russian", "zh": "Chinese", "ja": "Japanese",
    "es": "Spanish", "uk": "Ukrainian", "pt": "Portuguese", "cs": "Czech",
    "nl": "Dutch", "sv": "Swedish", "tr": "Turkish", "ko": "Korean",
    "ar": "Arabic", "hi": "Hindi", "hu": "Hungarian", "fi": "Finnish",
    "da": "Danish", "no": "Norwegian", "el": "Greek", "sk": "Slovak",
    "ro": "Romanian", "vi": "Vietnamese", "ka": "Georgian", "bg": "Bulgarian",
}
# Najczęstsze krótkie słowa każdego języka, do zgadywania języka tekstu.
STOPWORDS = {
    "pl": "i w nie się jest to na że z do jak co tak ale czy oraz być może już jeśli tylko też dla",
    "en": "the and is of to you that it in for this with are be not can will your have if",
    "de": "und der die das ist nicht ich sie es ein eine mit auf für den zu sich auch",
    "fr": "le la les et est une des pas que vous pour dans qui sur avec ce il je",
    "it": "il che di non è una per sono con lo gli della del si anche come questo",
    "es": "el los que y es una por para con las del se no como pero más este",
    "pt": "não você uma com que os é do da em para mas como isso por está",
    "cs": "a je že se na to v jsem ale jak tak by ne co",
    "nl": "de het een en is van dat niet je ik op met voor zijn",
    "sv": "och att det är en som på för med inte jag har av",
}
# Litery charakterystyczne dla języka; każde wystąpienie liczy się podwójnie.
DIACRITICS = {
    "pl": "ąćęłńśźż", "de": "äöüß", "fr": "éèêàçùâîôûœ", "it": "àèéìòù",
    "es": "ñ¿¡áéíóú", "pt": "ãõçâêôáé", "cs": "ěščřžýůť", "sv": "åäö",
}


def languageName(code):
    """Zwraca angielską nazwę języka dla jego kodu."""
    return LANGUAGE_NAMES.get(code, code)


def languageOfVoice(voiceKey):
    """Zwraca dwuliterowy kod języka z klucza głosu, np. pl z pl_PL-gosia-medium."""
    return voiceKey.split("_")[0].lower()


def systemLanguage():
    """Zwraca dwuliterowy kod języka systemu (domyślnie en)."""
    if os.name == "nt":
        try:
            import ctypes

            buffer = ctypes.create_unicode_buffer(85)
            if ctypes.windll.kernel32.GetUserDefaultLocaleName(buffer, len(buffer)):
                return buffer.value.split("-")[0].lower() or "en"
        except Exception:
            pass
    for name in ("LC_ALL", "LC_MESSAGES", "LANG", "LANGUAGE"):
        value = os.environ.get(name, "")
        match = re.match(r"([a-z]{2})", value.lower())
        if match and value not in ("C", "POSIX"):
            return match.group(1)
    return "en"


# Jaka część liter tekstu musi być w danym piśmie, żeby uznać go za tekst w tym języku
# (pojedyncze obce słowo w polskim zdaniu nie zmienia języka).
SCRIPT_SHARE = 0.3
# Pisma, które jednoznacznie wskazują język: (kod języka, zakresy znaków).
SCRIPTS = (
    ("ko", (("\uac00", "\ud7af"), ("\u1100", "\u11ff"))),
    ("el", (("\u0370", "\u03ff"),)),
    ("ar", (("\u0600", "\u06ff"),)),
    ("he", (("\u0590", "\u05ff"),)),
    ("hi", (("\u0900", "\u097f"),)),
    ("th", (("\u0e00", "\u0e7f"),)),
    ("ka", (("\u10a0", "\u10ff"),)),
)
# Języki pisane cyrylicą: tekst cyrylicą przeczyta głos któregokolwiek z nich.
CYRILLIC_LANGUAGES = {"ru", "uk", "bg", "sr", "mk", "be", "kk"}


def scriptLanguage(text):
    """Język tekstu rozpoznany po samym piśmie (japoński, chiński, cyrylica, koreański…); None dla alfabetu łacińskiego."""
    letters = [c for c in text if c.isalpha()]
    if not letters:
        return None
    total = len(letters)

    def share(ranges):
        """Jaka część liter należy do podanych zakresów znaków."""
        return sum(1 for c in letters if any(low <= c <= high for low, high in ranges)) / total

    kana = share((("\u3040", "\u30ff"),))
    han = share((("\u4e00", "\u9fff"),))
    if kana > 0.05 and kana + han > SCRIPT_SHARE:
        return "ja"
    if han > SCRIPT_SHARE:
        return "zh"
    if share((("\u0400", "\u04ff"),)) > SCRIPT_SHARE:
        return "uk" if any(c in "іїєґІЇЄҐ" for c in letters) else "ru"
    for code, ranges in SCRIPTS:
        if share(ranges) > SCRIPT_SHARE:
            return code
    return None


def hasVoiceForScript(code, available):
    """Czy któryś zainstalowany język umie przeczytać pismo języka code (cyrylica: dowolny język cyrylicy)."""
    if code in CYRILLIC_LANGUAGES:
        return bool(CYRILLIC_LANGUAGES & set(available))
    return code in available


def detectLanguage(text, available, fallback):
    """Zgaduje język tekstu spośród dostępnych kodów; gdy nie jest pewny, zwraca fallback."""
    letters = [c for c in text if c.isalpha()]
    if not letters:
        return fallback
    total = len(letters)
    kana = sum(1 for c in letters if "぀" <= c <= "ヿ")
    han = sum(1 for c in letters if "一" <= c <= "鿿")
    cyrillic = sum(1 for c in letters if "Ѐ" <= c <= "ӿ")
    if kana > 0.05 * total and "ja" in available:
        return "ja"
    if han > 0.3 * total:
        if "zh" in available:
            return "zh"
        if "ja" in available:
            return "ja"
    if cyrillic > 0.3 * total:
        isUkrainian = any(c in "іїєґІЇЄҐ" for c in letters)
        if isUkrainian and "uk" in available:
            return "uk"
        if "ru" in available:
            return "ru"
        if "uk" in available:
            return "uk"
    words = re.findall(r"[^\W\d_]+", text.lower())
    lowered = text.lower()
    scores = {}
    for code in available:
        stop = set(STOPWORDS.get(code, "").split())
        score = sum(1 for w in words if w in stop)
        score += 2 * sum(lowered.count(c) for c in DIACRITICS.get(code, ""))
        scores[code] = score
    if not scores:
        return fallback
    best = max(scores, key=scores.get)
    if scores[best] == 0:
        return fallback
    # Język zapasowy wygrywa przy prawie równym wyniku, np. przy wtrąceniach po angielsku.
    if fallback in scores and scores[fallback] >= 0.8 * scores[best]:
        return fallback
    return best
