// Rozmowa z lokalnym serwerem mowy: zapytania HTTP, zapis stanu, uruchamianie i restart.

import type { EngineInterface } from 'claude-code'

import type { EchoCatalogGroup, EchoStatus } from '../types'
import { API_VERSION, SERVER_RESTART_PAUSE_MS, SERVER_START_WAIT_MS, SERVER_URL } from './config'
import { t } from './i18n'
import { voiceLabel } from './labels'
import { ensurePython, launchServer, pluginEnv, setSetup } from './setup'
import type { PluginEnv } from './setup'
import { applyUiLanguage, readIsActivated, writeActivated, writeCatalog, writeStatus } from './state'

let lastStatusJson = ''
let isReadingNow = false
let isStartingServer = false

/** Wysyła jedno zapytanie do serwera mowy; zwraca odpowiedź JSON albo null, gdy serwer nie działa. */
export async function callServer($: EngineInterface, route: string, body?: unknown): Promise<unknown> {
  try {
    const init =
      body === undefined
        ? { method: 'GET' }
        : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
    // Każde zapytanie niesie identyfikator czatu: serwer trzyma osobną odpowiedź dla każdego wątku.
    const sessionId = await $.session.id()
    const separator = route.includes('?') ? '&' : '?'
    const response = await $.http.fetch(`${SERVER_URL}${route}${separator}session=${encodeURIComponent(sessionId)}`, init)
    return response.ok ? JSON.parse(response.text) : null
  } catch {
    return null
  }
}

/** Zapisuje świeży stan serwera; pasek przerysowuje się tylko, gdy coś się zmieniło. */
export async function storeStatus($: EngineInterface, raw: unknown): Promise<EchoStatus | null> {
  const next: EchoStatus | null = raw === null ? null : { ...(raw as EchoStatus), isOnline: true }
  const json = JSON.stringify(next)
  isReadingNow = next?.state === 'speaking'
  if (json !== lastStatusJson) {
    const previous = lastStatusJson ? (JSON.parse(lastStatusJson) as EchoStatus | null) : null
    lastStatusJson = json
    await writeStatus($, next)
    await notifySetupProgress($, previous, next)
    // Koniec pobierania głosu: odśwież katalog i daj znać.
    if (previous?.downloading && next && previous.downloading !== next.downloading) {
      await refreshCatalog($)
      if (!next.downloadError) {
        await applyUiLanguage($)
        $.ui.toast(t('toast.voiceInstalled', { voice: voiceLabel(previous.downloading) }))
      }
    }
  }
  return next
}

/** Czy głosy są gotowe: serwer działa, jest co najmniej jeden głos i nic się już nie pobiera. */
export function isVoiceSetupDone(s: EchoStatus | null): boolean {
  return s !== null && s.voices.length > 0 && !s.downloading && s.queued.length === 0
}

/**
 * Pierwsza instalacja (Echo jeszcze nie uruchomione): powiadomienia o pobieraniu głosów i o gotowości.
 * Po „Uruchom Echo” już się nie pokazują.
 */
async function notifySetupProgress($: EngineInterface, previous: EchoStatus | null, next: EchoStatus | null): Promise<void> {
  if (next === null || (await readIsActivated($))) return
  await applyUiLanguage($)
  if (next.downloading && !previous?.downloading) $.ui.toast(t('onboarding.toastVoices'))
  if (isVoiceSetupDone(next) && !isVoiceSetupDone(previous)) $.ui.toast(t('onboarding.toastReady'))
}

/** „Uruchom Echo”: włącza czytanie (od następnej odpowiedzi Claude'a) i daje znać. */
export async function startEcho($: EngineInterface): Promise<void> {
  await writeActivated($)
  await applyUiLanguage($)
  $.ui.toast(t('onboarding.toastStarted'))
}

/** Czy według ostatniego stanu coś jest czytane (wtedy stan odświeża się częściej). */
export function isReading(): boolean {
  return isReadingNow
}

// Zdarzenia odpowiedzi (wiadomość, użycie narzędzia, koniec) idą do serwera po kolei, w kolejności powstania.
let turnQueue: Promise<unknown> = Promise.resolve()

/**
 * Wysyła zdarzenie odpowiedzi w kolejce: następne czeka, aż poprzednie dotrze do serwera (żeby np. znacznik
 * narzędzia nie wyprzedził wiadomości przed nim). Zwraca obietnicę tego jednego zapytania.
 */
export function sendInOrder($: EngineInterface, route: string, body: unknown): Promise<void> {
  const task = turnQueue.then(async () => {
    const raw = await callServer($, route, body)
    if (raw === null) await logEvent($, route + ' FAILED', JSON.stringify(body).slice(0, 80))
    await storeStatus($, raw)
  })
  turnQueue = task.catch(() => undefined)
  return task
}

/** Wysyła polecenie sterujące i zapisuje stan, który zwrócił serwer. */
export async function control($: EngineInterface, route: string, body: unknown = {}): Promise<void> {
  await storeStatus($, await callServer($, route, body))
}

/** Zapisuje zdarzenie moda w logu czytania serwera (reading.log); błąd zapisu nie przeszkadza. */
export async function logEvent($: EngineInterface, event: string, detail = ''): Promise<void> {
  await callServer($, '/log', { event, detail })
}

/** Wczytuje na nowo katalog języków i głosów do panelu. */
export async function refreshCatalog($: EngineInterface): Promise<void> {
  const groups = await callServer($, '/catalog')
  if (Array.isArray(groups)) await writeCatalog($, groups as EchoCatalogGroup[])
}

/** Instaluje albo usuwa głosy, potem odświeża katalog. */
export async function changeVoices($: EngineInterface, route: '/install' | '/uninstall', body: unknown): Promise<void> {
  await control($, route, body)
  await refreshCatalog($)
}

/** Porównuje ścieżki niezależnie od ukośników i (na Windows) wielkości liter. */
function samePath(a: string, b: string, isWindows: boolean): boolean {
  const normalize = (path: string) => {
    const slashed = path.replace(/\\/g, '/').replace(/\/+$/, '')
    return isWindows ? slashed.toLowerCase() : slashed
  }
  return normalize(a) === normalize(b)
}

/** Czy działający serwer pochodzi z tej wtyczki i tej wersji (inaczej trzeba go wymienić). */
function isOwnServer(raw: unknown, env: PluginEnv): boolean {
  const s = raw as Partial<EchoStatus>
  return (
    s.apiVersion === API_VERSION &&
    s.pluginVersion === env.version &&
    typeof s.serverRoot === 'string' &&
    samePath(s.serverRoot, `${env.root}/server`, env.isWindows)
  )
}

/**
 * Zatrzymuje każdy serwer na porcie Echo, także starszej wersji, która nie rozumie parametru ?session
 * (odpowiada na nie 404, więc callServer widzi go jako „brak serwera”). Zapytanie bez parametrów.
 */
async function shutdownAnyServer($: EngineInterface): Promise<void> {
  try {
    await $.http.fetch(SERVER_URL + '/shutdown', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    })
  } catch {
    // Nic nie działa na porcie: nie ma czego zatrzymywać.
  }
}

/** Czeka, aż serwer zacznie odpowiadać; true, gdy zdążył. */
async function waitForServer($: EngineInterface): Promise<boolean> {
  const deadline = (await $.clock.now()) + SERVER_START_WAIT_MS
  while ((await $.clock.now()) < deadline) {
    const raw = await callServer($, '/status')
    if (raw !== null) {
      await storeStatus($, raw)
      return true
    }
    await $.clock.sleep(400)
  }
  return false
}

/**
 * Dba o to, żeby działał serwer mowy tej wtyczki: przy pierwszym razie instaluje Pythona z Piperem,
 * wymienia serwer innej wersji i uruchamia go w tle. Zwraca true, gdy serwer odpowiada.
 */
export async function ensureServer($: EngineInterface): Promise<boolean> {
  const raw = await callServer($, '/status')
  if (isStartingServer) return raw !== null
  const env = await pluginEnv($)
  if (raw !== null && isOwnServer(raw, env)) return true
  isStartingServer = true
  try {
    // Najpierw Python z Piperem (to może trwać), dopiero potem wymiana starego serwera, żeby czytanie nie znikało na czas instalacji.
    if (!(await ensurePython($, env))) return false
    // Serwer innej wersji wymieniamy dopiero, gdy nie czyta i nie zbiera odpowiedzi; do tego czasu działa stary.
    const running = raw as Partial<EchoStatus> | null
    if (running !== null && (running.state === 'speaking' || running.isTurnActive)) return true
    // Także gdy callServer nic nie dostał: na porcie może działać starsza wersja serwera.
    await shutdownAnyServer($)
    await $.clock.sleep(SERVER_RESTART_PAUSE_MS)
    await launchServer($, env)
    const isRunning = await waitForServer($)
    await setSetup($, isRunning ? 'idle' : 'failed', isRunning ? '' : 'setup.serverFailed')
    return isRunning
  } finally {
    isStartingServer = false
  }
}

/** Usuwa zapamiętane odpowiedzi wszystkich czatów i daje znać. */
export async function clearMemory($: EngineInterface): Promise<void> {
  await control($, '/history/clear')
  await applyUiLanguage($)
  $.ui.toast(t('toast.memoryCleared'))
}

/** Zatrzymuje serwer mowy i uruchamia go od nowa. */
export async function restartServer($: EngineInterface): Promise<boolean> {
  await callServer($, '/shutdown', {})
  await $.clock.sleep(SERVER_RESTART_PAUSE_MS)
  return ensureServer($)
}
