// Typy danych Echo: stan serwera mowy, katalog głosów, postęp instalacji i wartości w $.state.

export type EchoLanguage = { code: string; name: string }

/** Stan serwera mowy (odpowiedź /status) i ustawienia użytkownika. */
export type EchoStatus = {
  isOnline: boolean
  apiVersion: number
  pluginVersion: string
  serverRoot: string
  dataDir: string
  canPlayAudio: boolean
  sessionId: string
  isSessionLoaded: boolean
  historyDays: number
  savedAnswers: number
  state: 'idle' | 'speaking' | 'paused'
  visual: EchoVisual | null
  visualizer: string
  visualizerColor: string
  index: number
  total: number
  detected: string | null
  voice: string | null
  error: string | null
  language: string
  speed: number
  muted: boolean
  autoRead: boolean
  liveRead: boolean
  soundCues: boolean
  soundPack: string
  soundPacks: { id: string; name: string }[]
  isTurnActive: boolean
  voiceForLanguage: Record<string, string>
  languages: EchoLanguage[]
  voices: string[]
  downloading: string | null
  queued: string[]
  downloadError: string | null
}

/** Wizualizacja czytanej sekcji: obwiednia głośności (poziomy 0–1 co `step` sekund) i czas startu sekcji. */
export type EchoVisual = {
  id: string
  startedAt: number
  duration: number
  step: number
  levels: number[]
}

/** Jeden głos z katalogu Piper. */
export type EchoCatalogVoice = {
  voice: string
  name: string
  region: string
  quality: string
  sizeMB: number
  speakers: number
  speakerNames: string[]
  isInstalled: boolean
}

/** Język z katalogu Piper i jego głosy. */
export type EchoCatalogGroup = {
  code: string
  name: string
  nativeName: string
  voices: EchoCatalogVoice[]
  installedCount: number
}

/** Postęp pierwszej instalacji (Python, Piper) i uruchamiania serwera: klucz tekstu i jego parametry. */
export type EchoSetup = {
  phase: 'idle' | 'checking' | 'installing' | 'starting' | 'failed'
  message: string
  params: Record<string, string>
}

declare module 'claude-code' {
  interface PluginState {
    echo: {
      status: Shaped<EchoStatus | null>
      catalog: Shaped<EchoCatalogGroup[]>
      expandedLanguage: string
      expandedModel: string
      isSettingsOpen: boolean
      setup: Shaped<EchoSetup>
      uiLanguage: string
    }
  }
}
