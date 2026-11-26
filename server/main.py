"""Start serwera mowy Echo.

Użycie: python main.py --data <folder danych> [--plugin-version 0.2.0]
Mod uruchamia go sam (Pythonem z venv w folderze danych wtyczki).
"""
import argparse
import os
import sys
import threading

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from echo_tts import paths  # noqa: E402


def parseArgs():
    """Czyta argumenty: folder danych i wersję wtyczki."""
    parser = argparse.ArgumentParser(description="Echo: lokalny serwer mowy Piper")
    parser.add_argument("--data", required=True, help="folder na głosy, ustawienia i log")
    parser.add_argument("--plugin-version", default="dev", help="wersja wtyczki, która uruchomiła serwer")
    parser.add_argument("--port", type=int, default=0, help="inny port (tylko do testów)")
    parser.add_argument("--silent", action="store_true", help="bez dźwięku (tylko do testów)")
    return parser.parse_args()


def main():
    """Uruchamia serwer HTTP; kończy cicho, gdy działa już inna kopia."""
    args = parseArgs()
    paths.init(args.data)
    # Moduły czytające ścieżki importujemy dopiero po ich ustawieniu.
    from echo_tts.api import EchoServer
    from echo_tts.config import DEFAULT_CONFIG, logMessage, saveConfig
    from echo_tts.cues import ensureCueSounds
    from echo_tts.history import purge
    from echo_tts.voices import installDefaultVoices

    if args.silent:
        from echo_tts.audio import player

        # Test bez głośników: odtwarzanie od razu się kończy, reszta działa normalnie.
        player.play = lambda path, isBlocking=False: None
        player.stop = lambda: None

    try:
        server = EchoServer(args.plugin_version, os.path.dirname(os.path.abspath(__file__)), args.port or None)
    except OSError:
        return
    if not os.path.exists(paths.CONFIG_PATH):
        saveConfig(DEFAULT_CONFIG)
    ensureCueSounds()
    purge()
    threading.Thread(target=installDefaultVoices, daemon=True).start()
    logMessage(f"server started (plugin {args.plugin_version})")
    threading.Thread(target=server.watchIdle, daemon=True).start()
    server.serve_forever()


if __name__ == "__main__":
    main()
