// Punkt wejścia moda Echo: podpina zdarzenia Claude Code do serwera mowy i rysowania paska.

import type { Register } from 'claude-code'

import { COMMAND_NAME, registerEchoCommand, runEchoCommand } from './commands'
import {
  FAST_POLL_INTERVAL_MS,
  HELP_PANE_ID,
  SETTINGS_PANE_ID,
  LANGUAGES_PANE_ID,
  POLL_INTERVAL_MS,
  READ_ALOUD_PROMPT_SECTION,
} from './config'
import { callServer, ensureServer, isReading, logEvent, sendInOrder, storeStatus } from './server'
import { isVisibleThinking } from './labels'
import { readStartup } from './setup'
import { loadUiLanguage, writeSettingsOpen } from './state'
import { renderSettingsPane } from './ui/SettingsBlock'
import { renderEchoBar } from './ui/EchoBar'
import { renderHelpPane } from './ui/HelpPane'
import { renderLanguagesPane } from './ui/LanguagesPane'

export const register: Register = on => {
  // Start sesji: język interfejsu, komenda /echo, serwer mowy (przy pierwszym razie instalacja) i odświeżanie stanu co sekundę.
  on('session.start', async ($, e, next) => {
    const startup = await readStartup($)
    await loadUiLanguage($, typeof startup.uiLanguage === 'string' ? startup.uiLanguage : undefined)
    await registerEchoCommand($)
    // Nowa sesja zaczyna bez otwartego panelu ustawień (⚙ nie jest podświetlone).
    await writeSettingsOpen($, false)
    void ensureServer($)
    // Stan co sekundę, a w trakcie czytania co 250 ms (nowa sekcja = nowy obrazek wizualizacji).
    let tick = 0
    const slowEvery = Math.round(POLL_INTERVAL_MS / FAST_POLL_INTERVAL_MS)
    $.clock.every(FAST_POLL_INTERVAL_MS, () => {
      tick += 1
      if (isReading() || tick % slowEvery === 0) void callServer($, '/status').then(raw => storeStatus($, raw))
    })
    return next(e)
  })

  // Instrukcja dla Claude'a: wiadomości do użytkownika tylko jako widoczny tekst (Echo nie czyta myślenia).
  on('prompt.compose', async ($, e, next) => {
    const composed = await next(e)
    return { sections: [...composed.sections, READ_ALOUD_PROMPT_SECTION] }
  })

  // Nowe pytanie czyści poprzednią odpowiedź: licznik pokazuje 0/0, dopóki Claude nie napisze.
  // Tylko pytanie wysłane, gdy nic nie trwa (bez turnId): wiadomości dostarczane w trakcie pracy Claude'a
  // (powiadomienia, przypomnienia, kolejka) należą do bieżącej odpowiedzi i nie mogą jej wyczyścić.
  on('prompt.submit', async ($, e, next) => {
    const isNewQuestion = e.command === undefined && e.isMeta === undefined && e.turnId === undefined
    const detail = `origin=${e.origin.kind}, turnId=${e.turnId ?? '-'}, meta=${e.isMeta ?? false}, command=${e.command !== undefined}`
    if (await ensureServer($)) {
      await logEvent($, isNewQuestion ? 'prompt (reset)' : 'prompt (ignored)', `${detail}, text=${JSON.stringify(e.text.slice(0, 60))}`)
      if (isNewQuestion) await sendInOrder($, '/turn/start', {})
    }
    return next(e)
  })

  on('turn.start', async ($, e, next) => {
    if (e.agentId === undefined) void logEvent($, 'turn.start', `turnId=${e.turnId}`)
    return next(e)
  })

  // Widoczne myślenie: prawdziwe myślenie modelu przychodzi w strumieniu puste (zaszyfrowane), a blok myślenia
  // z treścią to tekst, który użytkownik widzi w czacie jak wiadomość - Echo czyta go jak zwykłą wiadomość.
  // Każdy fragment strumienia przechodzi dalej bez zmian; blok jest wysyłany, gdy się skończy (zaczyna się następny).
  on('turn.step', async function* ($, e, next) {
    const stream = next(e)
    let blockIndex = -1
    let blockText = ''
    /** Wysyła zakończony blok myślenia: z treścią do czytania (po filtrze), zawsze do logu. */
    const flushThinking = () => {
      if (blockIndex >= 0) {
        const flat = blockText.replace(/\s+/g, ' ').trim()
        const isSpoken = isVisibleThinking(blockText)
        void logEvent(
          $,
          isSpoken ? 'thinking (live, read)' : 'thinking (live)',
          `block=${blockIndex}, chars=${flat.length}, text=${JSON.stringify(flat.slice(0, 160))}`,
        )
        if (isSpoken) void sendInOrder($, '/turn/append', { text: blockText.trim() })
      }
      blockIndex = -1
      blockText = ''
    }
    for await (const chunk of stream) {
      if (e.agentId === undefined) {
        if (chunk.kind === 'thinking' && chunk.index === blockIndex) {
          blockText += chunk.text
        } else if (chunk.kind === 'thinking') {
          flushThinking()
          blockIndex = chunk.index
          blockText = chunk.text
        } else if (blockIndex >= 0 && chunk.kind !== 'engine') {
          flushThinking()
        }
      }
      yield chunk
    }
    flushThinking()
    return await stream.result
  })

  // Każda wiadomość Claude'a w głównej rozmowie od razu staje się nowymi sekcjami.
  on('session.append', { door: 'response' }, async ($, e, next) => {
    const stored = await next(e)
    if (e.agentId === undefined && e.message.type === 'assistant') {
      const parts: string[] = []
      for (const block of e.message.content) {
        if (block.type === 'text' && typeof block.text === 'string' && block.text.trim() !== '') parts.push(block.text)
      }
      const text = parts.join('\n\n')
      const blocks = e.message.content.map(block => block.type).join(',')
      void logEvent($, 'message', `blocks=${blocks}, chars=${text.length}`)
      if (text !== '') void sendInOrder($, '/turn/append', { text })
      // Użycie narzędzia: tekst napisany potem zaczyna ostatnią odpowiedź (tryb Wynik czyta na koniec tylko ją).
      if (e.message.content.some(block => block.type === 'tool_use')) void sendInOrder($, '/turn/mark', {})
    }
    return stored
  })

  // Koniec pracy Claude'a: w trybie Wynik zostaje i jest czytana tylko ostatnia odpowiedź (po ostatnim narzędziu).
  on('turn.complete', async ($, e, next) => {
    if (e.agentId === undefined && (await ensureServer($))) {
      await logEvent($, 'turn.complete', `reason=${e.reason}`)
      await sendInOrder($, '/turn/end', { reason: e.reason })
    }
    return next(e)
  })

  on('command.run', { command: COMMAND_NAME }, async ($, e) => {
    return { text: await runEchoCommand($, String(e.args ?? '')) }
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e) => renderEchoBar($, $.ui.resolve(e)))

  on('ui.render', { component: 'Pane', requestId: SETTINGS_PANE_ID }, async ($, e) =>
    renderSettingsPane($, $.ui.resolve(e)),
  )

  // Panel ustawień zamknięty krzyżykiem (albo przy przeładowaniu): ⚙ przestaje być podświetlone.
  on('ui.close', async ($, e, next) => {
    if (e.id === SETTINGS_PANE_ID) await writeSettingsOpen($, false)
    return next(e)
  })

  on('ui.render', { component: 'Pane', requestId: HELP_PANE_ID }, async ($, e) => renderHelpPane($, $.ui.resolve(e)))

  on('ui.render', { component: 'Pane', requestId: LANGUAGES_PANE_ID }, async ($, e) =>
    renderLanguagesPane($, $.ui.resolve(e)),
  )
}
