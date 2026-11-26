// Pierwsza instalacja i uruchamianie serwera mowy: Python, venv z Piperem w folderze danych wtyczki, proces w tle.

import type { EngineInterface } from 'claude-code'

import type { EchoSetup } from '../types'
import type { MessageKey } from './locales/en'
import { MIN_PYTHON_VERSION, PIP_INSTALL_TIMEOUT_MS, VENV_CREATE_TIMEOUT_MS } from './config'
import { writeSetup } from './state'

/** Gdzie leży wtyczka i jej dane oraz na jakim systemie działa. */
export type PluginEnv = {
  root: string
  dataDir: string
  version: string
  isWindows: boolean
  isMac: boolean
  venvPython: string
  serverPython: string
  serverScript: string
}

let cachedEnv: PluginEnv | null = null

/** Ustawia postęp instalacji widoczny na pasku: klucz tekstu (tłumaczony przy rysowaniu) i jego parametry. */
export async function setSetup(
  $: EngineInterface,
  phase: EchoSetup['phase'],
  message: MessageKey | '' = '',
  params: Record<string, string> = {},
): Promise<void> {
  await writeSetup($, { phase, message, params })
}

/** Zamienia ukośniki na '/', żeby ścieżki dało się sklejać jednakowo na każdym systemie. */
function slash(path: string): string {
  return path.replace(/\\/g, '/').replace(/\/+$/, '')
}

/** Zbiera ścieżki wtyczki (CLAUDE_PLUGIN_ROOT, CLAUDE_PLUGIN_DATA), wersję i system; wynik jest zapamiętywany. */
export async function pluginEnv($: EngineInterface): Promise<PluginEnv> {
  if (cachedEnv) return cachedEnv
  // Gdy Claude Code nie może założyć folderu danych, dane trafiają do .data w folderze wtyczki.
  const variables: Record<string, string> = await $.process.hookEnv().catch(() => ({}))
  const root = slash(variables.CLAUDE_PLUGIN_ROOT ?? $.plugin.root)
  const dataDir = slash(variables.CLAUDE_PLUGIN_DATA ?? `${root}/.data`)
  const { sysname } = await $.session.machine()
  const isWindows = sysname === 'Windows_NT'
  const manifest = JSON.parse(await $.fs.read(`${root}/.claude-plugin/plugin.json`)) as { version?: string }
  const venvBin = isWindows ? `${dataDir}/venv/Scripts` : `${dataDir}/venv/bin`
  cachedEnv = {
    root,
    dataDir,
    version: manifest.version ?? 'dev',
    isWindows,
    isMac: sysname === 'Darwin',
    venvPython: isWindows ? `${venvBin}/python.exe` : `${venvBin}/python3`,
    // pythonw na Windows nie otwiera okna konsoli.
    serverPython: isWindows ? `${venvBin}/pythonw.exe` : `${venvBin}/python3`,
    serverScript: `${root}/server/main.py`,
  }
  return cachedEnv
}

/** Ustawienia startowe nowej instalacji z startup.json w folderze wtyczki (klucze z „_” to komentarze). */
export async function readStartup($: EngineInterface): Promise<Record<string, unknown>> {
  try {
    const { root } = await pluginEnv($)
    return JSON.parse(await $.fs.read(`${root}/startup.json`)) as Record<string, unknown>
  } catch {
    return {}
  }
}

/** Uruchamia polecenie i zwraca jego wynik; null, gdy programu nie ma. */
async function tryRun(
  $: EngineInterface,
  argv: string[],
  timeoutMs?: number,
): Promise<{ exitCode: number; stdout: string; stderr: string } | null> {
  try {
    const result = await $.process.run(argv, timeoutMs ? { timeoutMs } : undefined)
    return { exitCode: result.exitCode ?? 1, stdout: result.stdout, stderr: result.stderr }
  } catch {
    return null
  }
}

/** Szuka w systemie Pythona w wersji co najmniej MIN_PYTHON_VERSION; zwraca polecenie albo null. */
async function findSystemPython($: EngineInterface, env: PluginEnv): Promise<string[] | null> {
  const candidates = env.isWindows ? [['py', '-3'], ['python'], ['python3']] : [['python3'], ['python']]
  const [major, minor] = MIN_PYTHON_VERSION.split('.').map(Number)
  const check = `import sys; print(sys.version_info >= (${major}, ${minor}))`
  for (const command of candidates) {
    const result = await tryRun($, [...command, '-c', check])
    if (result?.exitCode === 0 && result.stdout.trim() === 'True') return command
  }
  return null
}

/** Ostatnia niepusta linia tekstu (do krótkiego komunikatu o błędzie). */
function lastLine(text: string): string {
  return text.trim().split(/\r?\n/).pop() ?? ''
}

/**
 * Przygotowuje Pythona z Piperem w folderze danych wtyczki: tworzy venv i instaluje
 * server/requirements.txt, gdy to jeszcze nie zrobione (albo wymagania się zmieniły).
 * Zwraca true, gdy wszystko jest gotowe.
 */
export async function ensurePython($: EngineInterface, env: PluginEnv): Promise<boolean> {
  const requirements = await $.fs.read(`${env.root}/server/requirements.txt`)
  const markerPath = `${env.dataDir}/venv/echo-requirements.txt`
  const isReady =
    (await $.fs.exists(env.venvPython)) &&
    (await $.fs.exists(markerPath)) &&
    (await $.fs.read(markerPath)) === requirements
  if (isReady) return true

  if (!(await $.fs.exists(env.venvPython))) {
    await setSetup($, 'checking', 'setup.checking')
    const systemPython = await findSystemPython($, env)
    if (!systemPython) {
      await setSetup($, 'failed', 'setup.noPython', { version: MIN_PYTHON_VERSION })
      return false
    }
    await setSetup($, 'installing', 'setup.creatingVenv')
    const created = await tryRun($, [...systemPython, '-m', 'venv', `${env.dataDir}/venv`], VENV_CREATE_TIMEOUT_MS)
    if (created?.exitCode !== 0) {
      await setSetup($, 'failed', 'setup.venvFailed', { detail: lastLine(created?.stderr ?? '') })
      return false
    }
  }

  await setSetup($, 'installing', 'setup.installingPiper')
  const installed = await tryRun(
    $,
    [env.venvPython, '-m', 'pip', 'install', '--disable-pip-version-check', '-r', `${env.root}/server/requirements.txt`],
    PIP_INSTALL_TIMEOUT_MS,
  )
  if (installed?.exitCode !== 0) {
    await setSetup($, 'failed', 'setup.pipFailed', { detail: lastLine(installed?.stderr ?? '') })
    return false
  }
  await $.fs.write(markerPath, requirements)
  return true
}

/** Uruchamia serwer mowy w tle, odłączony od Claude Code (bez okna konsoli). */
export async function launchServer($: EngineInterface, env: PluginEnv): Promise<void> {
  await setSetup($, 'starting', 'setup.startingServer')
  const args = ['--data', env.dataDir, '--plugin-version', env.version]
  if (env.isWindows) {
    // W PowerShellu apostrof w ścieżce zapisuje się podwójnie.
    const quoted = (text: string) => text.replace(/'/g, "''")
    const argumentList = [`"${env.serverScript}"`, args[0], `"${args[1]}"`, args[2], args[3]].join(' ')
    await tryRun($, [
      'powershell.exe',
      '-NoProfile',
      '-Command',
      `Start-Process -FilePath '${quoted(env.serverPython)}' -ArgumentList '${quoted(argumentList)}' -WindowStyle Hidden`,
    ])
    return
  }
  // sh przekazuje ścieżki jako osobne argumenty ("$0" "$@"), więc spacje w nich nie przeszkadzają.
  await tryRun($, ['sh', '-c', 'nohup "$0" "$@" >/dev/null 2>&1 &', env.serverPython, env.serverScript, ...args])
}

/** Otwiera plik w domyślnej aplikacji systemu. */
export async function openInSystem($: EngineInterface, path: string): Promise<void> {
  const env = await pluginEnv($)
  if (env.isWindows) {
    const native = path.replace(/\//g, '\\').replace(/'/g, "''")
    await tryRun($, ['powershell.exe', '-NoProfile', '-Command', `Invoke-Item -LiteralPath '${native}'`])
  } else {
    await tryRun($, [env.isMac ? 'open' : 'xdg-open', path])
  }
}
