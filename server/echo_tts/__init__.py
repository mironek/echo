"""Lokalny serwer mowy Piper dla wtyczki Echo (Claude Code).

Słucha tylko na 127.0.0.1. Nic nie wychodzi z komputera poza pobieraniem
głosów i ich katalogu z Hugging Face (rhasspy/piper-voices).
"""

# Wersja API, którą rozumie mod; mod restartuje serwer, gdy się nie zgadza.
API_VERSION = 3
