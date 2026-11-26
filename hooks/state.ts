// Stan moda w $.state: wartości, z których rysuje się pasek i panele (przetrwają przeładowanie moda).
// Odczyt i zapis są tylko tutaj: walidator wymaga, żeby read/update stały w pliku, który definiuje atom.

import { atom, read, update } from 'claude-code'
import type { EngineInterface } from 'claude-code'

import type { EchoCatalogGroup, EchoSetup, EchoStatus } from '../types'
import { DEFAULT_UI_LANGUAGE, useUiLanguage } from './i18n'

// Klucz w $.store (trwa między sesjami), pod którym leży wybrany język interfejsu.
const UI_LANGUAGE_STORE_KEY = 'uiLanguage'

/** Ostatni stan serwera mowy; null, gdy serwer nie odpowiada. */
const status = atom({ plugin: 'echo', key: 'status' } as const, null, { shape: 'status-6' })
/** Katalog języków i głosów do panelu języków. */
const catalog = atom({ plugin: 'echo', key: 'catalog' } as const, [], { shape: 'catalog-3' })
/** Kod języka rozwiniętego w panelu języków ('' = żaden). */
const expandedLanguage = atom({ plugin: 'echo', key: 'expandedLanguage' } as const, '')
/** Model z wieloma lektorami rozwinięty w panelu języków ('' = żaden). */
const expandedModel = atom({ plugin: 'echo', key: 'expandedModel' } as const, '')
/** Czy panel ustawień (⚙) jest otwarty. */
const isSettingsOpen = atom({ plugin: 'echo', key: 'isSettingsOpen' } as const, false)
/** Postęp pierwszej instalacji (Python, Piper) i uruchamiania serwera. */
const setup = atom(
  { plugin: 'echo', key: 'setup' } as const,
  { phase: 'idle', message: '', params: {} },
  { shape: 'setup-2' },
)
/** Język interfejsu Echo (kod ISO); domyślnie angielski. */
const uiLanguage = atom({ plugin: 'echo', key: 'uiLanguage' } as const, DEFAULT_UI_LANGUAGE)

// ------------------------------------------------- odczyt (podczas rysowania) ---
export async function readStatus($: EngineInterface): Promise<EchoStatus | null> {
  return read($, status)
}

export async function readCatalog($: EngineInterface): Promise<EchoCatalogGroup[]> {
  return read($, catalog)
}

export async function readExpandedLanguage($: EngineInterface): Promise<string> {
  return read($, expandedLanguage)
}

export async function readExpandedModel($: EngineInterface): Promise<string> {
  return read($, expandedModel)
}

export async function readIsSettingsOpen($: EngineInterface): Promise<boolean> {
  return read($, isSettingsOpen)
}

export async function readSetup($: EngineInterface): Promise<EchoSetup> {
  return read($, setup)
}

/** Czyta język interfejsu i ustawia go dla t(); wywoływane na początku rysowania i obsługi komend. */
export async function applyUiLanguage($: EngineInterface): Promise<string> {
  const code = await read($, uiLanguage)
  useUiLanguage(code)
  return code
}


// ------------------------------------------- zapis (z obsługi zdarzeń i kliknięć) ---
/** Zapisuje stan serwera. */
export async function writeStatus($: EngineInterface, value: EchoStatus | null): Promise<void> {
  await update($, status, () => value)
}

/** Zapisuje katalog języków. */
export async function writeCatalog($: EngineInterface, value: EchoCatalogGroup[]): Promise<void> {
  await update($, catalog, () => value)
}

/** Rozwija język w panelu albo zwija, gdy był rozwinięty. */
export async function toggleExpandedLanguage($: EngineInterface, code: string): Promise<void> {
  await update($, expandedLanguage, current => (current === code ? '' : code))
}

/** Rozwija listę lektorów modelu albo ją zwija. */
export async function toggleExpandedModel($: EngineInterface, model: string): Promise<void> {
  await update($, expandedModel, current => (current === model ? '' : model))
}

/** Zapisuje, czy panel ustawień jest otwarty (podświetla ⚙ na pasku). */
export async function writeSettingsOpen($: EngineInterface, isOpen: boolean): Promise<void> {
  await update($, isSettingsOpen, () => isOpen)
}

/** Ustawia postęp instalacji widoczny na pasku. */
export async function writeSetup($: EngineInterface, value: EchoSetup): Promise<void> {
  await update($, setup, () => value)
}

/** Zmienia język interfejsu i zapamiętuje go na kolejne sesje. */
export async function writeUiLanguage($: EngineInterface, code: string): Promise<void> {
  await update($, uiLanguage, () => code)
  await $.store.set(UI_LANGUAGE_STORE_KEY, code)
  useUiLanguage(code)
}

/** Na starcie sesji wczytuje zapamiętany język interfejsu; bez wyboru użytkownika - startowy (startup.json). */
export async function loadUiLanguage($: EngineInterface, startupCode?: string): Promise<void> {
  const saved = await $.store.get(UI_LANGUAGE_STORE_KEY)
  const code = typeof saved === 'string' ? saved : (startupCode ?? DEFAULT_UI_LANGUAGE)
  await update($, uiLanguage, () => code)
  useUiLanguage(code)
}
