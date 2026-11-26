// Otwieranie paneli bocznych (pomoc, języki) i pliku README.

import type { EngineInterface } from 'claude-code'

import { HELP_FILE_NAME, HELP_FILES_BY_LANGUAGE, HELP_PANE_ID, LANGUAGES_PANE_ID, SETTINGS_PANE_ID } from './config'
import { t, uiLanguage } from './i18n'
import { refreshCatalog } from './server'
import { openInSystem, pluginEnv } from './setup'
import { applyUiLanguage, readIsSettingsOpen, writeSettingsOpen } from './state'

/** Plik pomocy w języku interfejsu: np. README.pl.md dla polskiego, README.md (angielski) dla pozostałych. */
export function helpFileName(): string {
  return HELP_FILES_BY_LANGUAGE[uiLanguage()] ?? HELP_FILE_NAME
}

/** Otwiera panel pomocy z README wtyczki. */
export async function openHelpPane($: EngineInterface): Promise<void> {
  await applyUiLanguage($)
  await $.ui.open({ id: HELP_PANE_ID, title: t('help.title') })
}

/** Otwiera README w domyślnej aplikacji do plików .md. */
export async function openHelpFile($: EngineInterface): Promise<void> {
  const { root } = await pluginEnv($)
  await applyUiLanguage($)
  await openInSystem($, `${root}/${helpFileName()}`)
}

/** Otwiera panel instalowania i usuwania języków. */
export async function openLanguagesPane($: EngineInterface): Promise<void> {
  await refreshCatalog($)
  await applyUiLanguage($)
  await $.ui.open({ id: LANGUAGES_PANE_ID, title: t('languages.title'), focus: true })
}

/**
 * „+” w panelu ustawień: przechodzi do panelu języków. Aplikacja nie przełącza zakładki, gdy klik padł w innym
 * panelu (prośba o fokus jest wtedy odrzucana), więc panel ustawień jest zamykany - widać od razu panel języków.
 * Do ustawień wraca się przez ⚙.
 */
export async function switchToLanguagesPane($: EngineInterface): Promise<void> {
  await $.ui.close({ id: SETTINGS_PANE_ID })
  await writeSettingsOpen($, false)
  await openLanguagesPane($)
}

/** ⚙ na pasku: otwiera panel ustawień obok czatu albo zamyka go, gdy jest otwarty. */
export async function toggleSettingsPane($: EngineInterface): Promise<void> {
  if (await readIsSettingsOpen($)) {
    await $.ui.close({ id: SETTINGS_PANE_ID })
    await writeSettingsOpen($, false)
    return
  }
  await applyUiLanguage($)
  await $.ui.open({ id: SETTINGS_PANE_ID, title: t('settings.title') })
  await writeSettingsOpen($, true)
}
