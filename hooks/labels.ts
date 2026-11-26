// Teksty do wyświetlenia: nazwy głosów i języków, licznik sekcji, opis stanu (wszystko przez tłumaczenia).

import type { EchoCatalogVoice, EchoSetup, EchoStatus } from '../types'
import { COUNTER_DIGITS, MAX_SPOKEN_THINKING_CHARS, PAD_SPACE, VOICE_INFO } from './config'
import { languageName, t, tPlural } from './i18n'
import type { MessageKey } from './locales/en'

/** Zamienia pierwszą literę na wielką, a podkreślenia na spacje. */
function capitalize(text: string): string {
  const spaced = text.replace(/_/g, ' ')
  return spaced.charAt(0).toUpperCase() + spaced.slice(1)
}

/** Region głosu angielskiego (US, GB…), bo tych odmian jest kilka; dla innych języków pusty. */
function regionSuffix(voiceKey: string): string {
  const match = /^en_([A-Z]{2})-/.exec(voiceKey)
  return match ? ` (${match[1]})` : ''
}

/** Zwraca czytelną nazwę głosu: imię i płeć dla znanych, inaczej imię lektora z klucza. */
export function voiceLabel(voiceKey: string): string {
  const known = VOICE_INFO[voiceKey]
  if (known) return `${known.name}, ${t(known.gender === 'female' ? 'voice.female' : 'voice.male')}${regionSuffix(voiceKey)}`
  const [model = voiceKey, speaker] = voiceKey.split('#')
  return capitalize(speaker ?? model.split('-')[1] ?? model)
}

/** Opisuje głos z katalogu w panelu: nazwa, region, jakość, rozmiar, liczba lektorów. */
export function catalogVoiceText(voice: EchoCatalogVoice): string {
  const known = VOICE_INFO[voice.voice]
  const name = known ? voiceLabel(voice.voice) : capitalize(voice.name)
  const speakers = voice.speakers > 1 ? ', ' + tPlural('catalog.speakers', voice.speakers) : ''
  const qualityKey = `quality.${voice.quality}` as MessageKey
  const quality = ['high', 'medium', 'low', 'x_low'].includes(voice.quality) ? t(qualityKey) : voice.quality
  return `${name} (${voice.region.split('_')[1] ?? voice.region}) · ${quality} · ${voice.sizeMB} MB${speakers}`
}

/** Nazwa języka w języku interfejsu (zapasowo nazwa z serwera albo kod). */
export function languageLabel(s: EchoStatus, code: string | null): string {
  if (!code) return ''
  return languageName(code, s.languages.find(one => one.code === code)?.name)
}

/** Nazwa zestawu sygnałów w języku interfejsu. */
export function soundPackLabel(pack: { id: string; name: string }): string {
  return ['soft', 'bell', 'drop'].includes(pack.id) ? t(`soundPack.${pack.id}` as MessageKey) : pack.name
}

/** Klucz modelu z klucza głosu (bez części #lektor). */
export function modelOf(voiceKey: string): string {
  return voiceKey.split('#')[0] ?? voiceKey
}

/** Zainstalowane modele jednego języka (model z wieloma lektorami raz). */
export function modelsOf(s: EchoStatus, code: string): string[] {
  return [...new Set(voicesOf(s, code).map(modelOf))]
}

/** Głosy (lektorzy) jednego modelu; dla modelu z jednym lektorem sam model. */
export function speakersOf(s: EchoStatus, model: string): string[] {
  return s.voices.filter(voice => modelOf(voice) === model)
}

/** Nazwa modelu na liście Głos: znana etykieta albo nazwa z klucza (np. „Semaine”). */
export function modelLabel(s: EchoStatus, model: string): string {
  return speakersOf(s, model).length > 1 ? capitalize(model.split('-')[1] ?? model) : voiceLabel(model)
}

/** Lista zainstalowanych głosów jednego języka. */
export function voicesOf(s: EchoStatus, code: string): string[] {
  return s.voices.filter(voice => voice.split('_')[0] === code)
}

/** Głos używany dla języka: wybrany, inaczej pierwszy zainstalowany. */
export function currentVoiceOf(s: EchoStatus, code: string): string | undefined {
  const chosen = s.voiceForLanguage[code]
  return chosen && s.voices.includes(chosen) ? chosen : voicesOf(s, code)[0]
}

/** Opisuje, co Echo robi w tej chwili (szary tekst po prawej stronie paska). */
export function stateText(s: EchoStatus): string {
  if (s.downloading) {
    const queued = s.queued.length ? t('state.queued', { count: s.queued.length }) : ''
    return t('state.installingVoice', { voice: voiceLabel(s.downloading) }) + queued
  }
  if (s.error) return t('state.error', { error: s.error })
  if (!s.canPlayAudio) return t('state.noPlayer')
  if (s.voices.length === 0) return t('state.noVoices')
  // Odpowiedź w języku (piśmie), dla którego nie ma głosu: czeka na jego zainstalowanie w panelu „+”.
  if (s.voice === null && s.detected) return t('state.noVoiceFor', { language: languageLabel(s, s.detected) })
  if (s.state === 'speaking') return t('state.speaking', { language: languageLabel(s, s.detected) })
  if (s.state === 'paused') return t('state.paused')
  return s.total > 0 ? t('state.ready') : t('state.noText')
}

/** Tekst postępu instalacji (bez serwera); pusty klucz = „serwer mowy nie działa”. */
export function setupText(progress: EchoSetup): string {
  return progress.message ? t(progress.message as MessageKey, progress.params) : t('bar.serverDown')
}

/**
 * Czy blok myślenia ze strumienia jest tekstem, który użytkownik widzi jak wiadomość: ma treść (prawdziwe
 * myślenie przychodzi puste), nie zawiera bloku kodu i nie jest bardzo długi.
 */
export function isVisibleThinking(text: string): boolean {
  const trimmed = text.trim()
  return trimmed !== '' && !trimmed.includes('```') && trimmed.length <= MAX_SPOKEN_THINKING_CHARS
}

/** Licznik sekcji o stałej szerokości (do 999/999), dopełniony spacjami niełamliwymi. */
export function sectionCounter(s: EchoStatus): string {
  const current = s.total > 0 ? String(Math.min(s.index + 1, s.total)) : '0'
  const total = String(s.total)
  return current.padStart(COUNTER_DIGITS, PAD_SPACE) + '/' + total.padEnd(COUNTER_DIGITS, PAD_SPACE)
}
