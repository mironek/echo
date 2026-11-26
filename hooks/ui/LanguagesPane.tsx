// Panel języków: rozwijana lista języków z katalogu Piper; głosy pobiera się („Pobierz ⤓”) i usuwa („Usuń ✕”).
// Model z wieloma lektorami rozwija się dalej i pokazuje ich imiona (pobiera się i usuwa cały model naraz).
// Pobrane głosy (i lektorzy) zaczynają się od przycisku-kropki: ◉ domyślny głos języka (używa go Auto),
// ○ kliknij, żeby ustawić jako domyślny.
// Każdy wiersz zajmuje całą szerokość listy: tekst przy lewej krawędzi, liczniki i przyciski przy prawej.

import type { ElementTable, EngineInterface } from 'claude-code'

import type { EchoCatalogGroup, EchoCatalogVoice, EchoStatus } from '../../types'
import {
  ACTION_EXTRA_WIDTH,
  DEFAULT_MARK,
  DOWNLOAD_ICON,
  MAX_SPEAKERS_SHOWN,
  NOT_DEFAULT_MARK,
  PENDING_ICON,
  REMOVE_ICON,
} from '../config'
import { languageName, t, tPlural } from '../i18n'
import { catalogVoiceText, currentVoiceOf, modelOf } from '../labels'
import { changeVoices, control } from '../server'
import {
  applyUiLanguage,
  readCatalog,
  readExpandedLanguage,
  readExpandedModel,
  readStatus,
  toggleExpandedLanguage,
  toggleExpandedModel,
} from '../state'
import { styles } from '../styles'

/** Teksty przycisków akcji w bieżącym języku: tekst, spacja, ikona. */
function actionLabels() {
  return {
    download: `${t('languages.download')} ${DOWNLOAD_ICON}`,
    remove: `${t('languages.remove')} ${REMOVE_ICON}`,
    downloading: `${t('languages.downloading')} ${PENDING_ICON}`,
  }
}

/** Szerokość kolumny przycisków: najdłuższy tekst akcji z marginesem, żeby przyciski stały równo. */
function actionWidth(): number {
  return Math.max(...Object.values(actionLabels()).map(label => label.length)) + ACTION_EXTRA_WIDTH
}

/** Ustawia głos (albo lektora) jako domyślny dla jego języka; język odczytu (np. Auto) się nie zmienia. */
function makeDefault($: EngineInterface, voiceKey: string): void {
  const code = voiceKey.split('_')[0] ?? voiceKey
  void control($, '/config', { voiceForLanguage: { [code]: voiceKey } })
}

/**
 * Przycisk-kropka domyślnego głosu, bez tła: ◉ przy domyślnym, ○ przy pozostałych - kliknięcie ustawia głos
 * jako domyślny. Bez głosu: puste miejsce tej samej szerokości, żeby kolumna przycisków stała równo.
 */
function DefaultButton(ui: ElementTable, $: EngineInterface, id: string, voiceKey: string | null, isDefault: boolean) {
  const { Box, Button, Text } = ui
  // Większa kropka: rozmiar tekstu działa w przycisku (kolor nie - przycisk narzuca swój).
  return (
    <Box key={'default-slot-' + id} {...styles.defaultSlot}>
      {voiceKey !== null &&
        (isDefault ? (
          <Button key={'default-' + id} plain onPress={() => undefined}>
            <Text size="heading">{DEFAULT_MARK}</Text>
          </Button>
        ) : (
          <Button key={'default-' + id} plain onPress={() => makeDefault($, voiceKey)}>
            <Text size="heading">{NOT_DEFAULT_MARK}</Text>
          </Button>
        ))}
    </Box>
  )
}

/** Przycisk akcji głosu przy prawej krawędzi: „Pobieram …”, „Usuń ✕” albo „Pobierz ⤓”; null = puste miejsce. */
function VoiceAction(ui: ElementTable, $: EngineInterface, voice: EchoCatalogVoice | null, isPending: boolean) {
  const { Box, Button, Text } = ui
  const labels = actionLabels()
  const width = actionWidth()
  return (
    <Box key="action" {...styles.actionSlot} width={width} minWidth={width}>
      {voice === null ? null : isPending ? (
        <Text dimColor>{labels.downloading}</Text>
      ) : voice.isInstalled ? (
        <Button
          key={'remove-' + voice.voice}
          label={labels.remove}
          variant="secondary"
          onPress={() => void changeVoices($, '/uninstall', { voice: voice.voice })}
        />
      ) : (
        <Button
          key={'add-' + voice.voice}
          label={labels.download}
          variant="secondary"
          onPress={() => void changeVoices($, '/install', { voice: voice.voice })}
        />
      )}
    </Box>
  )
}

/** Imiona lektorów rozwiniętego modelu (najwyżej MAX_SPEAKERS_SHOWN, reszta jako „…i jeszcze N”), z kropką domyślnego. */
function SpeakerRows(ui: ElementTable, $: EngineInterface, voice: EchoCatalogVoice, defaultVoice: string | undefined) {
  const { Box, Text } = ui
  const shown = voice.speakerNames.slice(0, MAX_SPEAKERS_SHOWN)
  const hidden = voice.speakerNames.length - shown.length
  return [
    ...shown.map(name => {
      const speakerKey = `${voice.voice}#${name}`
      return (
        <Box key={'speaker-' + speakerKey} {...styles.listRow} {...styles.speakerIndent}>
          <Box key="lead" {...styles.dotWithText}>
            {DefaultButton(ui, $, speakerKey, voice.isInstalled ? speakerKey : null, defaultVoice === speakerKey)}
            {/* Imię lektora bez dodatkowego odstępu: bliżej swojej kropki. */}
            <Box key="text" {...styles.listText}>
              <Text dimColor={!voice.isInstalled} wrap="truncate-end">
                {name.replace(/_/g, ' ')}
              </Text>
            </Box>
          </Box>
        </Box>
      )
    }),
    ...(hidden > 0
      ? [
          <Box key={'speaker-more-' + voice.voice} {...styles.listRow} {...styles.speakerIndent}>
            <Box key="lead" {...styles.dotWithText}>
              <Box key="slot" {...styles.defaultSlot} />
              <Box key="text" {...styles.textRowIndent}>
                <Text dimColor>{t('languages.moreSpeakers', { count: hidden })}</Text>
              </Box>
            </Box>
          </Box>,
        ]
      : []),
  ]
}

/** Głos, który ustawia kropka przy modelu: zapamiętany lektor tego modelu, inaczej pierwszy od góry. */
function modelDefaultTarget(voice: EchoCatalogVoice, defaultVoice: string | undefined): string {
  if (voice.speakerNames.length <= 1) return voice.voice
  if (defaultVoice !== undefined && modelOf(defaultVoice) === voice.voice) return defaultVoice
  return `${voice.voice}#${voice.speakerNames[0]}`
}

/** Jeden głos rozwiniętego języka: kropka domyślnego głosu, opis (przy wielu lektorach - rozwijany), akcja po prawej. */
function VoiceRow(
  ui: ElementTable,
  $: EngineInterface,
  voice: EchoCatalogVoice,
  pending: Set<string>,
  expandedModel: string,
  defaultVoice: string | undefined,
) {
  const { Box, Button, Text } = ui
  const isDefault = defaultVoice !== undefined && modelOf(defaultVoice) === voice.voice
  const hasSpeakers = voice.speakerNames.length > 1
  const isExpanded = hasSpeakers && expandedModel === voice.voice
  const description = catalogVoiceText(voice)
  return (
    <Box key={'voice-' + voice.voice} flexDirection="column" width="100%">
      <Box key="row" {...styles.listRow} {...styles.voiceIndent}>
        <Box key="lead" {...styles.dotWithText}>
          {DefaultButton(
            ui,
            $,
            voice.voice,
            voice.isInstalled ? modelDefaultTarget(voice, defaultVoice) : null,
            isDefault,
          )}
          <Box key="text" {...styles.listText}>
            {hasSpeakers ? (
              <Button key={'toggle-' + voice.voice} plain onPress={() => void toggleExpandedModel($, voice.voice)}>
                {isExpanded ? '▾' : '▸'} <Text dimColor={!voice.isInstalled}>{description}</Text>
              </Button>
            ) : (
              // Zwykły wiersz: odstęp jak wewnętrzny margines przycisku, żeby nazwy stały równo z modelami.
              <Box key="indent" {...styles.textRowIndent}>
                <Text dimColor={!voice.isInstalled} wrap="truncate-end">
                  {description}
                </Text>
              </Box>
            )}
          </Box>
        </Box>
        {VoiceAction(ui, $, voice, pending.has(voice.voice))}
      </Box>
      {isExpanded && SpeakerRows(ui, $, voice, defaultVoice)}
    </Box>
  )
}

/** Jeden język: rozwijany nagłówek (nazwa po lewej, liczba głosów po prawej) i lista jego głosów. */
function LanguageGroup(
  ui: ElementTable,
  $: EngineInterface,
  group: EchoCatalogGroup,
  isExpanded: boolean,
  pending: Set<string>,
  expandedModel: string,
  s: EchoStatus,
) {
  const defaultVoice = currentVoiceOf(s, group.code)
  const { Box, Button, Text } = ui
  const voiceCount = group.voices.length
  const installed = group.installedCount > 0 ? `${group.installedCount}/` : ''
  return (
    <Box key={'group-' + group.code} {...styles.listColumn}>
      <Box key="header" {...styles.listRow}>
        <Box key="text" {...styles.listText}>
          <Button key={'toggle-' + group.code} plain onPress={() => void toggleExpandedLanguage($, group.code)}>
            {isExpanded ? '▾' : '▸'} {languageName(group.code, group.name)} <Text dimColor>{group.nativeName}</Text>
          </Button>
        </Box>
        <Text dimColor={group.installedCount === 0}>{installed + tPlural('catalog.voices', voiceCount)}</Text>
      </Box>
      {isExpanded && group.voices.map(voice => VoiceRow(ui, $, voice, pending, expandedModel, defaultVoice))}
    </Box>
  )
}

/** Zainstalowane języki na górze, potem alfabetycznie według nazwy w języku interfejsu. */
function sortedGroups(groups: EchoCatalogGroup[]): EchoCatalogGroup[] {
  const nameOf = (group: EchoCatalogGroup) => languageName(group.code, group.name)
  return [...groups].sort(
    (a, b) => Number(b.installedCount > 0) - Number(a.installedCount > 0) || nameOf(a).localeCompare(nameOf(b)),
  )
}

/** Rysuje panel języków. */
export async function renderLanguagesPane($: EngineInterface, ui: ElementTable) {
  const { Box, Text } = ui
  await applyUiLanguage($)
  const s = await readStatus($)
  const groups = await readCatalog($)
  const expanded = await readExpandedLanguage($)
  const expandedModel = await readExpandedModel($)

  if (s === null) return <Text dimColor>{t('languages.serverDown')}</Text>
  if (groups.length === 0) return <Text dimColor>{t('languages.loading')}</Text>

  const pending = new Set([...(s.downloading ? [s.downloading] : []), ...s.queued])
  return (
    <Box flexDirection="column" width="100%" gap="sm">
      <Text dimColor>{t('languages.hint', { download: DOWNLOAD_ICON, remove: REMOVE_ICON })}</Text>
      <Text dimColor>
        {DEFAULT_MARK} {t('languages.defaultLegend', { notDefault: NOT_DEFAULT_MARK })}
      </Text>
      {s.downloadError && <Text color="red">{t('languages.downloadError', { error: s.downloadError })}</Text>}
      <Box key="list" {...styles.listColumn}>
        {sortedGroups(groups).map(group =>
          LanguageGroup(ui, $, group, expanded === group.code, pending, expandedModel, s),
        )}
      </Box>
    </Box>
  )
}
