// Panel ustawień (⚙) obok czatu: głos i lektor, „+” do panelu języków, interfejs, dźwięki, wizualizacja, pamięć.
// Panel przewija się sam, więc pasek nad polem wpisywania zostaje zawsze widoczny.

import type { ElementTable, EngineInterface } from 'claude-code'

import type { EchoStatus } from '../../types'
import { changeUiLanguage } from '../commands'
import { DEFAULT_MARK, MEMORY_DAYS_OPTIONS, VISUAL_COLORS } from '../config'
import { UI_LANGUAGES, t, tPlural, uiLanguage } from '../i18n'
import { currentVoiceOf, languageLabel, modelLabel, modelOf, modelsOf, soundPackLabel, speakersOf, voiceLabel } from '../labels'
import { switchToLanguagesPane } from '../panes'
import { callServer, clearMemory, control } from '../server'
import type { MessageKey } from '../locales/en'
import { applyUiLanguage, readStatus } from '../state'
import { styles } from '../styles'
import { VISUALIZER_KINDS } from '../visualizer'

const VOICE_PREFIX = 'voice:'
// Wartość listy „Dźwięki”, która wyłącza sygnały.
const SOUNDS_OFF = 'off'

/** Etykieta opcji z kropką ● przy domyślnym głosie (opcje list są zwykłym tekstem, więc kropka ma kolor tekstu). */
function markDefault(label: string, isDefault: boolean): string {
  return isDefault ? `${DEFAULT_MARK} ${label}` : label
}

/**
 * Opcje listy „Głos”: Auto, potem każdy język (a przy kilku modelach osobno każdy model; lektorzy są na liście
 * „Lektor”). Kropka ● oznacza domyślny głos języka — ten, którego używa Auto.
 */
function voiceOptions(s: EchoStatus): { value: string; label: string }[] {
  const options = [{ value: 'auto', label: t('settings.voiceAuto') }]
  for (const one of s.languages) {
    const models = modelsOf(s, one.code)
    const name = languageLabel(s, one.code)
    const defaultVoice = currentVoiceOf(s, one.code)
    for (const model of models) {
      const label = models.length > 1 ? `${name}: ${modelLabel(s, model)}` : name
      const isDefault = models.length > 1 && defaultVoice !== undefined && modelOf(defaultVoice) === model
      options.push({ value: VOICE_PREFIX + model, label: markDefault(label, isDefault) })
    }
  }
  return options
}

/** Zapisuje głos dla jego języka i ustawia ten język na stałe. */
function useVoice($: EngineInterface, voice: string): void {
  const code = voice.split('_')[0] ?? voice
  void control($, '/config', { language: code, voiceForLanguage: { [code]: voice } })
}

/** Zapisuje wybór z listy „Głos”: Auto albo model (z zapamiętanym albo pierwszym lektorem). */
function pickVoice($: EngineInterface, s: EchoStatus, value: string): void {
  if (value === 'auto') {
    void control($, '/config', { language: 'auto' })
    return
  }
  const model = value.slice(VOICE_PREFIX.length)
  const code = model.split('_')[0] ?? model
  const remembered = s.voiceForLanguage[code]
  const speakers = speakersOf(s, model)
  useVoice($, remembered && speakers.includes(remembered) ? remembered : (speakers[0] ?? model))
}

/** Wyłącza sygnały albo włącza wybrany zestaw i od razu odgrywa jego próbkę. */
function pickSounds($: EngineInterface, value: string): void {
  if (value === SOUNDS_OFF) {
    void control($, '/config', { soundCues: false })
    return
  }
  void control($, '/config', { soundCues: true, soundPack: value }).then(() =>
    callServer($, '/cue/preview', { pack: value }),
  )
}

/** Rysuje blok ustawień w ramce, elementy w kolumnie. */
export function SettingsBlock(ui: ElementTable, $: EngineInterface, s: EchoStatus) {
  const { Box, Button, Select, Text } = ui
  const fixedVoice = s.language !== 'auto' ? currentVoiceOf(s, s.language) : undefined
  const fixedModel = fixedVoice ? modelOf(fixedVoice) : undefined
  const speakers = fixedModel ? speakersOf(s, fixedModel) : []

  return (
    <Box key="settings-block" {...styles.settingsBlock}>
      <Box key="voice-row" {...styles.row}>
        <Select
          key="voice"
          label={t('settings.voice')}
          options={voiceOptions(s)}
          value={fixedModel ? VOICE_PREFIX + fixedModel : 'auto'}
          onSelect={value => pickVoice($, s, value)}
        />
        {speakers.length > 1 && fixedVoice && (
          <Select
            key="speaker"
            label={t('settings.speaker')}
            options={speakers.map(voice => ({
              value: voice,
              label: markDefault(voiceLabel(voice), voice === s.voiceForLanguage[s.language]),
            }))}
            value={fixedVoice}
            onSelect={voice => useVoice($, voice)}
          />
        )}
        <Button key="languages" label="+" onPress={() => void switchToLanguagesPane($)} />
      </Box>
      <Select
        key="interface-language"
        label={t('settings.interfaceLanguage')}
        options={UI_LANGUAGES.map(one => ({ value: one.code, label: one.name }))}
        value={uiLanguage()}
        onSelect={code => void changeUiLanguage($, code)}
      />
      <Select
        key="sounds"
        label={t('settings.sounds')}
        options={[
          { value: SOUNDS_OFF, label: t('settings.soundsOff') },
          ...s.soundPacks.map(pack => ({ value: pack.id, label: soundPackLabel(pack) })),
        ]}
        value={s.soundCues ? s.soundPack : SOUNDS_OFF}
        onSelect={value => pickSounds($, value)}
      />
      <Box key="visualizer-row" {...styles.row}>
        <Select
          key="visualizer"
          label={t('settings.visualizer')}
          options={VISUALIZER_KINDS.map(kind => ({ value: kind, label: t(`visualizer.${kind}`) }))}
          value={VISUALIZER_KINDS.includes(s.visualizer as never) ? s.visualizer : 'wave'}
          onSelect={value => void control($, '/config', { visualizer: value })}
        />
        {s.visualizer !== 'off' && (
          <Select
            key="visualizer-color"
            label={t('settings.visualizerColor')}
            options={VISUAL_COLORS.map(color => ({ value: color.id, label: t(`color.${color.id}` as MessageKey) }))}
            value={VISUAL_COLORS.some(color => color.id === s.visualizerColor) ? s.visualizerColor : 'orange'}
            onSelect={value => void control($, '/config', { visualizerColor: value })}
          />
        )}
      </Box>
      <Box key="memory-row" {...styles.row}>
        <Select
          key="memory"
          label={t('settings.memory')}
          options={MEMORY_DAYS_OPTIONS.map(days => ({
            value: String(days),
            label: days === 0 ? t('settings.memoryOff') : tPlural('settings.memoryDays', days),
          }))}
          value={String(MEMORY_DAYS_OPTIONS.includes(s.historyDays) ? s.historyDays : 30)}
          onSelect={value => void control($, '/config', { historyDays: Number(value) })}
        />
        <Button key="clear-memory" label={t('settings.clearMemory')} onPress={() => void clearMemory($)} />
      </Box>
    </Box>
  )
}

/** Rysuje panel ustawień dla bieżącego stanu serwera. */
export async function renderSettingsPane($: EngineInterface, ui: ElementTable) {
  const { Text } = ui
  await applyUiLanguage($)
  const s = await readStatus($)
  if (s === null) return <Text dimColor>{t('languages.serverDown')}</Text>
  return SettingsBlock(ui, $, s)
}
