// Komenda /echo: sterowanie czytaniem i otwieranie paneli. Słowa działają po angielsku i w języku interfejsu.

import type { EngineInterface } from 'claude-code'

import { t } from './i18n'
import { en } from './locales/en'
import type { MessageKey } from './locales/en'
import { openHelpPane, openLanguagesPane } from './panes'
import { control, ensureServer, restartServer } from './server'
import { applyUiLanguage, writeUiLanguage } from './state'

export const COMMAND_NAME = 'echo'

// Działania komendy i ich trasy na serwerze (null = obsługa w module).
const ACTIONS: { id: string; route: string | null }[] = [
  { id: 'pause', route: '/pause' },
  { id: 'resume', route: '/resume' },
  { id: 'next', route: '/next' },
  { id: 'prev', route: '/prev' },
  { id: 'stop', route: '/stop' },
  { id: 'replay', route: '/replay' },
  { id: 'languages', route: null },
  { id: 'restart', route: null },
  { id: 'help', route: null },
]

/** Słowo komendy dla działania w bieżącym języku. */
function wordOf(id: string): string {
  return t(`command.word.${id}` as MessageKey)
}

/** Lista słów do opisu komendy, np. „pauza | wznow | …”. */
function wordList(separator: string): string {
  return ACTIONS.map(action => wordOf(action.id)).join(separator)
}

/** Rozpoznaje działanie po słowie: w języku interfejsu albo po angielsku. */
function actionOf(word: string): (typeof ACTIONS)[number] | undefined {
  return ACTIONS.find(action => {
    const key = `command.word.${action.id}` as MessageKey
    return word === wordOf(action.id) || word === en[key]
  })
}

/** Rejestruje /echo z opisem w bieżącym języku interfejsu. */
export async function registerEchoCommand($: EngineInterface): Promise<void> {
  await applyUiLanguage($)
  await $.command.register({ name: COMMAND_NAME, description: t('command.description', { words: wordList(' | ') }) })
}

/** Zmienia język interfejsu i odświeża opis komendy. */
export async function changeUiLanguage($: EngineInterface, code: string): Promise<void> {
  await writeUiLanguage($, code)
  try {
    await registerEchoCommand($)
  } catch {
    // Ponowna rejestracja nie jest konieczna: nowy opis pojawi się w następnej sesji.
  }
}

/** Wykonuje /echo <słowo> i zwraca tekst odpowiedzi. */
export async function runEchoCommand($: EngineInterface, args: string): Promise<string> {
  await applyUiLanguage($)
  const word = args.trim().toLowerCase()
  const action = word === '' ? ACTIONS.find(one => one.id === 'languages') : actionOf(word)
  if (!action) return t('command.unknown', { words: wordList(', ') })
  if (action.id === 'languages') {
    await ensureServer($)
    await openLanguagesPane($)
    return t('command.languagesOpened')
  }
  if (action.id === 'help') {
    await openHelpPane($)
    return t('command.helpOpened')
  }
  if (action.id === 'restart') {
    return (await restartServer($)) ? t('command.restarted') : t('command.restartFailed')
  }
  await ensureServer($)
  await control($, action.route ?? '/status')
  return t('command.done', { word: wordOf(action.id) })
}
