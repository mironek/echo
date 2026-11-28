// Angielski - język wzorcowy: jego klucze wyznaczają typ Messages, który muszą spełnić wszystkie inne języki.
// Nowy tekst: dodaj klucz tutaj i w KAŻDYM pliku w tym folderze (brak klucza = błąd sprawdzania typów).
// {nazwa} w tekście zastępuje parametr; obiekt { one, few, many, other } to formy liczby mnogiej (Intl.PluralRules).

export const en = {
  // Pasek (tryb czytania: ręcznie / po zakończeniu pracy / na bieżąco)
  'mode.manual': 'Manual',
  'mode.final': 'Final',
  'mode.live': 'Live',
  'bar.start': 'Start',
  'bar.serverDown': 'speech server is not running',
  'onboarding.ready': 'Echo is ready',
  'onboarding.start': 'Start Echo',
  'onboarding.downloadingVoices': 'downloading voices…',
  'onboarding.toastSetup': 'Echo: first-time setup - installing Piper (a few minutes)…',
  'onboarding.toastVoices': 'Echo: downloading the basic voices…',
  'onboarding.toastReady': 'Echo is ready - press „Start Echo” on the Echo bar. No bar? Send any message in the chat and it will appear',
  'onboarding.toastStarted': 'Echo is on - Claude\'s replies will be read aloud',
  // Stan (szary tekst po prawej)
  'state.installingVoice': 'installing {voice}…',
  'state.queued': ' (+{count})',
  'state.error': 'error: {error}',
  'state.noPlayer': 'no audio player',
  'state.noVoices': 'no voices',
  'state.noVoiceFor': 'no voice: {language}',
  'state.speaking': 'reading · {language}',
  'state.paused': 'paused',
  'state.ready': 'ready',
  'state.noText': 'no text',
  // Pierwsza instalacja
  'setup.checking': 'looking for Python…',
  'setup.noPython': 'Python {version}+ not found (python.org), then “Start”',
  'setup.creatingVenv': 'creating Python environment…',
  'setup.venvFailed': 'venv failed: {detail}',
  'setup.installingPiper': 'installing Piper (a few minutes)…',
  'setup.pipFailed': 'pip failed: {detail}',
  'setup.startingServer': 'starting speech server…',
  'setup.serverFailed': 'server did not start (see server.log in the data folder)',
  // Ustawienia (⚙)
  'settings.title': 'Echo settings',
  'settings.voice': 'Voice',
  'settings.voiceAuto': 'Auto',
  'settings.speaker': 'Speaker',
  'settings.interfaceLanguage': 'Interface',
  'settings.sounds': 'Sounds',
  'settings.soundsOff': 'Off',
  'settings.memory': 'Memory',
  'settings.memoryOff': 'Off',
  'settings.memoryDays': { one: '{count} day', other: '{count} days' },
  'settings.clearMemory': 'Clear all',
  'settings.visualizer': 'Visualizer',
  'visualizer.off': 'Off',
  'visualizer.wave': 'Wave',
  'visualizer.bars': 'Bars',
  'visualizer.dot': 'Dot',
  'settings.visualizerColor': 'Color',
  'color.orange': 'Orange',
  'color.white': 'White',
  'color.blue': 'Blue',
  'color.teal': 'Teal',
  'color.green': 'Green',
  'color.lime': 'Lime',
  'color.purple': 'Purple',
  'color.pink': 'Pink',
  'color.red': 'Red',
  'color.yellow': 'Yellow',
  'soundPack.soft': 'Soft',
  'soundPack.bell': 'Bell',
  'soundPack.drop': 'Drop',
  // Głosy
  'voice.female': 'female',
  'voice.male': 'male',
  'quality.high': 'high quality',
  'quality.medium': 'medium quality',
  'quality.low': 'low quality',
  'quality.x_low': 'very low quality',
  'catalog.speakers': { one: '{count} speaker', other: '{count} speakers' },
  'catalog.voices': { one: '{count} voice', other: '{count} voices' },
  // Panel języków
  'languages.title': 'Echo: languages',
  'languages.hint': '▸ shows a language\'s voices: {download} downloads a voice, {remove} removes it.',
  'languages.defaultLegend': 'default voice of the language (Auto uses it); click {notDefault} to make a voice the default',
  'languages.serverDown': 'The speech server is not running. Click “Start” on the Echo bar.',
  'languages.loading': 'Loading languages…',
  'languages.downloadError': 'Download error: {error}',
  'languages.download': 'Download',
  'languages.remove': 'Remove',
  'languages.downloading': 'Downloading',
  'languages.moreSpeakers': '…and {count} more',
  // Pomoc
  'help.title': 'Echo: help',
  'help.openFile': 'Open {file} in editor',
  'help.fileMissing': '{file} was not found in the plugin folder.',
  // Powiadomienia
  'toast.voiceInstalled': 'Echo: installed {voice}',
  'toast.memoryCleared': 'Echo: saved answers cleared',
  // Komenda /echo (słowa bez polskich znaków itp., żeby łatwo je wpisać; angielskie działają zawsze)
  'command.description': 'Echo: {words}',
  'command.languagesOpened': 'Echo languages pane opened.',
  'command.helpOpened': 'Echo help opened.',
  'command.restarted': 'Speech server restarted.',
  'command.restartFailed': 'Could not start the speech server.',
  'command.unknown': 'Unknown option. Use: {words}.',
  'command.done': 'Echo: {word}',
  'command.word.pause': 'pause',
  'command.word.resume': 'resume',
  'command.word.next': 'next',
  'command.word.prev': 'prev',
  'command.word.stop': 'stop',
  'command.word.replay': 'replay',
  'command.word.languages': 'languages',
  'command.word.restart': 'restart',
  'command.word.help': 'help',
} as const

/** Formy liczby mnogiej według kategorii Intl.PluralRules; `other` jest zawsze. */
export type PluralForms = { zero?: string; one?: string; two?: string; few?: string; many?: string; other: string }

/** Komplet tekstów jednego języka: te same klucze co angielski. */
export type Messages = { [K in keyof typeof en]: (typeof en)[K] extends string ? string : PluralForms }

/** Klucz tekstu. */
export type MessageKey = keyof typeof en
