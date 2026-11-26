// Pasek Echo nad polem wpisywania: odtwarzacz, tryb czytania, stan, ⚙ (panel ustawień) i ?.

import type { ElementTable, EngineInterface } from 'claude-code'

import type { EchoSetup, EchoStatus } from '../../types'
import { MODE_SELECT_EXTRA_WIDTH, PX_PER_CELL, STATUS_MIN_WIDTH_WITH_VISUAL, STATUS_WIDTH } from '../config'
import { t } from '../i18n'
import { setupText, stateText } from '../labels'
import { openHelpPane, toggleSettingsPane } from '../panes'
import { control, ensureServer } from '../server'
import { applyUiLanguage, readIsSettingsOpen, readSetup, readStatus } from '../state'
import { styles } from '../styles'
import { visualSize, visualSvg } from '../visualizer'
import type { VisualizerKind } from '../visualizer'
import { PlayerControls } from './PlayerControls'

/** Pasek bez serwera: postęp pierwszej instalacji albo przycisk „Uruchom”. */
function OfflineBar(ui: ElementTable, $: EngineInterface, progress: EchoSetup) {
  const { Box, Button, Text } = ui
  const isBusy = progress.phase === 'checking' || progress.phase === 'installing' || progress.phase === 'starting'
  return (
    <Box {...styles.row}>
      <Text dimColor>Echo: {setupText(progress)}</Text>
      {!isBusy && <Button key="start" label={t('bar.start')} onPress={() => void ensureServer($)} />}
    </Box>
  )
}

type ReadingMode = 'manual' | 'final' | 'live'
const READING_MODES: ReadingMode[] = ['manual', 'final', 'live']

/** Tryb czytania z ustawień serwera: Manual (nic samo), Auto (po zakończeniu pracy), Live (na bieżąco). */
function readingModeOf(s: EchoStatus): ReadingMode {
  if (!s.autoRead) return 'manual'
  return s.liveRead ? 'live' : 'final'
}

/** Lista trybu czytania w miejscu o stałej szerokości (najdłuższa nazwa), żeby pasek się nie przesuwał. */
function ReadingModeSelect(ui: ElementTable, $: EngineInterface, s: EchoStatus) {
  const { Box, Select } = ui
  const options = READING_MODES.map(mode => ({ value: mode, label: t(`mode.${mode}`) }))
  const width = Math.max(...options.map(option => option.label.length)) + MODE_SELECT_EXTRA_WIDTH
  return (
    <Box key="mode-slot" alignItems="center" width={width} minWidth={width} flexShrink={0}>
      <Select
        key="mode"
        options={options}
        value={readingModeOf(s)}
        onSelect={mode =>
          void control($, '/config', { autoRead: mode !== 'manual', liveRead: mode === 'live' })
        }
      />
    </Box>
  )
}

/**
 * Stan po prawej stronie paska: w trakcie czytania animowana wizualizacja (SVG, gdy powierzchnia ją ma
 * i nie jest wyłączona w ⚙), inaczej tekst („gotowy”, „pauza”…). Obrazek ma klucz sekcji: nowa sekcja = nowy obrazek.
 */
function StatusIndicator(ui: ElementTable, s: EchoStatus, now: number) {
  const { Text } = ui
  const kind = s.visualizer as VisualizerKind
  if (s.state === 'speaking' && s.visual && kind !== 'off' && 'Svg' in ui) {
    const { Svg } = ui
    const elapsedSeconds = Math.max(0, (now - s.visual.startedAt) / 1000)
    return (
      <Svg
        key={'visual-' + s.visual.id}
        source={visualSvg(kind, s.visual, elapsedSeconds, s.visualizerColor)}
        alt={stateText(s)}
        width={visualSize(kind).width}
        height={visualSize(kind).height}
      />
    )
  }
  return (
    <Text dimColor wrap="truncate-end">
      {stateText(s)}
    </Text>
  )
}

/**
 * Szerokość (w znakach) miejsca na stan: przy włączonej wizualizacji - szerokość obrazka wybranego efektu
 * (z VISUAL_SIZE), co najmniej tyle, żeby zmieściły się krótkie teksty; przy wyłączonej - stała szerokość tekstu.
 */
function statusWidth(s: EchoStatus): number {
  const kind = s.visualizer as VisualizerKind
  if (kind === 'off') return STATUS_WIDTH
  return Math.max(STATUS_MIN_WIDTH_WITH_VISUAL, Math.ceil(visualSize(kind).width / PX_PER_CELL) + 1)
}

/** Główny rząd paska: po lewej odtwarzacz i tryb czytania; po prawej stan (tuż przed ⚙), ⚙ i ?. */
function MainRow(ui: ElementTable, $: EngineInterface, s: EchoStatus, isSettingsShown: boolean, now: number) {
  const { Box, Button, Text } = ui
  return (
    <Box key="main-row" {...styles.mainRow}>
      <Box key="left" {...styles.leftGroup}>
        <Text dimColor>Echo</Text>
        {PlayerControls(ui, $, s)}
        {ReadingModeSelect(ui, $, s)}
      </Box>
      <Box key="right" {...styles.rightGroup}>
        <Box key="status" {...styles.statusSlot} width={statusWidth(s)} minWidth={statusWidth(s)}>
          {StatusIndicator(ui, s, now)}
        </Box>
        <Button
          key="settings"
          label="⚙"
          variant={isSettingsShown ? 'primary' : 'secondary'}
          onPress={() => void toggleSettingsPane($)}
        />
        <Button key="help" label="?" onPress={() => void openHelpPane($)} />
      </Box>
    </Box>
  )
}

/** Rysuje cały obszar Echo nad polem wpisywania. */
export async function renderEchoBar($: EngineInterface, ui: ElementTable) {
  await applyUiLanguage($)
  const s = await readStatus($)
  if (s === null) return OfflineBar(ui, $, await readSetup($))
  const isSettingsShown = await readIsSettingsOpen($)
  const { Box } = ui
  return (
    <Box {...styles.barColumn}>
      {MainRow(ui, $, s, isSettingsShown, await $.clock.now())}
    </Box>
  )
}
