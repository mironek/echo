<picture>
  <source media="(prefers-color-scheme: dark)" srcset="assets/logo-dark.png">
  <img src="assets/logo-light.png" alt="Echo" width="128">
</picture>

# Echo

**English** | [Polski](README.pl.md)

A Claude Code plugin (terminal and the Claude desktop app, Code tab) that **reads Claude's replies aloud** with local neural [Piper](https://github.com/OHF-Voice/piper1-gpl) voices. Speech is generated entirely on your computer: your text is never sent anywhere.

Works on Windows, macOS and Linux (tested on Windows; macOS and Linux are supported but not tested yet).

**Private and local by design:**

- **Nothing leaves your computer** - no cloud, no account, no cost. Speech is generated locally.
- **Local only** - the speech server listens on `127.0.0.1`, so it cannot be reached from the network.
- **No tracking** - no telemetry, no analytics, your conversations are never sent anywhere.
- **Self-contained** - Python environment and voices live in the plugin's own data folder; nothing is installed system-wide.
- **Does not touch Claude's answers** - it only reads them aloud (details: "What Echo changes in Claude Code" below).

## Installation

**Requirements:** Python 3.9 or newer ([python.org](https://www.python.org/downloads/)). On Linux you also need an audio player: `paplay` (PulseAudio/PipeWire), `pw-play`, `aplay` or `ffplay`.

In Claude Code (terminal or VS Code), type these two commands in the message box - they work in every version:

```
/plugin marketplace add mironek/echo
```

```
/plugin install echo@echo
```

`echo@echo` means: the `echo` plugin from the marketplace named `echo`. Newer versions of Claude Code also accept a single command: `/plugin install echo --marketplace mironek/echo`.

From the command line:

```
claude plugin marketplace add mironek/echo
claude plugin install echo@echo
```

In the desktop app: **+** next to the message box → **Plugins** → **Add marketplace**, enter `mironek/echo`, then **Add plugin** next to Echo. A plugin installed in the desktop app works in VS Code too (the same Claude Code settings).

**Right after installing:** if the Echo bar does not appear on its own, type `/reload-plugins` in the message box (or start a new chat) - Claude Code loads new plugins only then.

### What Echo changes in Claude Code

When you install a plugin, Claude Code warns that plugins can change how it works - so here is exactly what Echo does. Echo only reads Claude's visible replies to speak them on your computer and passes every reply on unchanged; the one thing it adds is a single sentence in Claude's instructions asking it to write messages meant for you as visible text, so they can be read aloud.

- **It reads:** your submitted prompts (only to know when a new answer starts), Claude's replies and their live stream (passed on untouched, nothing is added, removed or rewritten).
- **It changes:** one added sentence in Claude's system instructions - nothing else in your prompts, Claude's replies, tools or files.
- **It runs:** a local speech server (Python) that listens only on `127.0.0.1`; on first run it installs Piper from PyPI and downloads voices from Hugging Face.
- **It never:** collects telemetry, tracks you or sends your conversations anywhere.

### First run

Echo sets everything up by itself in the plugin's data folder; the bar shows the progress:

1. it finds Python and creates its own environment (venv),
2. it installs Piper (`pip install piper-tts`): this takes a few minutes, only the first time,
3. it starts the local speech server,
4. it downloads the basic voice pack: English (Ryan) and Polish (MC Speech), about 60 MB each. More voices are one click away in the languages pane,
5. it shows **Echo is ready** with a **Start Echo** button - Echo starts reading only after you press it (once; later sessions start on their own).

Pop-up notifications tell you about each step. Until you press **Start Echo**, Echo reads nothing and changes nothing in Claude Code.

Right after installation: English interface, **Live** mode, Voice **Auto**, **Soft** sounds, **30 days** of memory - all of it is set by the `startup.json` file (below).

If something is missing (for example Python), the bar shows a message and a **Start** button to try again.

### Startup settings (`startup.json`)

The `startup.json` file in the plugin folder sets how Echo works right after installation, with no configuration at all. Changes to the file apply to settings the user has not changed yet (a new installation); users change their own choices in ⚙. Keys starting with `_` are comments.

| Key | Default | Meaning |
|---|---|---|
| `uiLanguage` | `"en"` | Echo interface language: `en`, `pl`, `de`, `fr`, `it`, `es`, `pt`, `ru`, `uk`, `ja`, `zh` |
| `readingMode` | `"live"` | Reading mode: `manual`, `final` (the older `auto` also works), `live` |
| `voice` | `"auto"` | Voice: `auto` (detects the language of the reply) or a language code, for example `pl` |
| `fallbackLanguage` | `"system"` | Language used when Auto cannot detect the text: `system` (the system language, if it has an installed voice) or a language code |
| `speed` | `1.0` | Reading speed, 0.8-2.0 |
| `sounds` | `"soft"` | Sounds: `off`, `soft`, `bell`, `drop` |
| `memoryDays` | `30` | How long to keep each chat's answer, in days: `0` (off), `7`, `30`, `90` |
| `visualizer` | `"wave"` | Reading visualizer: `off`, `wave`, `bars`, `dot` |
| `visualizerColor` | `"orange"` | Visualizer color: `orange`, `white`, `blue`, `teal`, `green`, `lime`, `purple`, `pink`, `red`, `yellow` or your own `#hex` |
| `defaultVoices` | Ryan, MC Speech | Voices downloaded on first run (keys from the Piper catalog) |

**How Echo picks a voice with no settings:** in Auto mode it detects the language of the reply among the languages that have an installed voice (Polish text - Polish voice, English text - English voice). When the language cannot be detected, it uses `fallbackLanguage`, and when that has no voice - the first installed language. Within a language it reads with the voice chosen in ⚙, or without a choice - the first installed one (MC Speech for Polish, Ryan for English). Messages that arrive before the voices are downloaded wait and are read as soon as the first voice is ready.

### Installing from npm

The `claude-echo-tts` package contains the same plugin. A marketplace can point to it instead of the repository:

```json
{
  "name": "echo-npm",
  "owner": { "name": "<author>" },
  "plugins": [{ "name": "echo", "source": { "source": "npm", "package": "claude-echo-tts" } }]
}
```

## The Echo bar

The bar above the message box:

| Element | What it does |
|---|---|
| ▶ 3/12 / ⏸ 3/12 | Reads the current section from its start / pauses it; the numbers are the section number and the total number of sections |
| ❮ and ❯ | Previous and next section; while reading, they read it right away. Dimmed on the first and last section |
| ⏹ | Stops reading and goes back to the first section (dimmed when nothing is being read) |
| Speed (e.g. 1.0×) | Reading speed, 0.8× - 2.0×; the change applies immediately, even mid-sentence |
| Mode (Manual / Final / Live) | When Echo reads on its own - see "When Echo reads" below |
| Status (right, before ⚙) | While reading, an animated speech visualizer (Wave, Bars or Dot - choose in ⚙ → Visualizer); otherwise grey text: paused, ready, installing a voice |
| ⚙ | Opens/closes the **Echo settings** pane next to the chat (it scrolls on its own, the bar stays in place): Voice, Speaker, + (add a language), Interface, Sounds, Visualizer, Color, Memory |
| Voice | **Auto** (detects the language of the reply) or a specific language and voice, for example "Polish: Bass"; the change applies immediately |
| Speaker | Appears next to Voice when the chosen model has several speakers (for example Semaine: Obadiah, Poppy…) |
| + (next to Voice) | Switches to the languages pane (the settings pane closes; reopen it with ⚙) |
| Interface | Language of the bar, settings and Echo messages |
| ? | Opens this help |

### How Echo collects text

Every question you send starts fresh: Echo stops reading, clears the previous answer (the counter shows 0/0, the buttons are inactive) and waits for Claude's messages. Messages delivered to Claude while it works (notifications, system reminders, queued questions) do not clear the current answer. Each of Claude's messages is split into **sections** and added to the end of the reading queue; the counter grows as they arrive.

A section is a paragraph. Short paragraphs (such as headings) are joined with the next one, very long ones are split into sentences. Code blocks, link addresses and formatting are skipped. Subagent messages are not read.

### When Echo reads

| Mode | What happens |
|---|---|
| **Live** | Every message from Claude is read as soon as it appears. If another one arrives while reading, Echo reads it after the current one - in order, without skipping. A quiet sound separates the messages |
| **Final** | While Claude works, nothing is read on its own, but the sections are collected and you can play them with ▶. When Claude finishes, Echo starts reading from the **first section of the final answer** - the text written after the last tool use, that is the summary with the results (with no tools: from section 1). Earlier sections stay: go back to them with ❮. An interrupted answer (for example when you stop Claude) is not read on its own |
| **Manual** | Echo never reads on its own. ▶ reads from the current section to the end of the queue - at any time when there are sections, also while Claude is working |

After a pause (⏸) new messages are only added to the queue; resume with ▶. The last answer is remembered separately for each chat (see "Answer memory" below).

### Sounds

Sounds mark the **start and end of reading**, not every section:

- **start** (rising tones) - Echo starts reading after silence,
- **end** (falling tones) - the queue is finished or reading was paused or stopped,
- **between messages** (a single, quieter tone) - only in Live mode, when Echo moves on to Claude's next message.

In ⚙, the **Sounds** list lets you choose a set: **Soft** (default), **Bell** or **Drop** - you hear a sample when you pick one - or **Off** to read without sounds. The files `sounds/<set>/start.wav`, `end.wav` and `between.wav` are in the plugin's data folder; the server creates missing ones itself, and you can replace them with your own.

### Visualizer

While reading, a small animation in the logo color appears in place of the status text and reacts to the **actual loudness of the speech** - pauses, stresses, sentence endings. In ⚙ → **Visualizer**: **Wave** (default; fades out smoothly at the edges), **Bars**, **Dot** (the most discreet) or **Off**, and next to it **Color**: the logo orange (default), white, blue, teal, green, lime, purple, pink, red or yellow.

Fine-tuning is in `hooks/config.ts`:

- `VISUAL_GAIN` - how strongly each effect reacts to loudness (above 1 amplifies, below 1 softens),
- `VISUAL_SIZE` - wave and bars: width in pixels, dot: maximum diameter,
- `VISUAL_FPS` - animation frames per second (at most 30 - the server measures loudness 30 times a second),
- `VISUAL_BAR_JITTER` - small, quick movements of the bars, so they keep moving even when the speech is loud,
- `VISUAL_COLORS` - the list of colors.

It costs almost nothing: the server computes the loudness envelope of a section once (about 20 ms), and the plugin sends one SVG image per section. The app plays the animation by itself, smoothly, without redrawing the bar frame by frame. In the terminal (no graphics) the status text "reading · language" is shown instead.

### Answer memory

Echo remembers **the last answer separately for each chat** (each conversation in the Claude Code history - in the app, the terminal and VS Code). When you come back to a chat, ▶ plays its last answer, not an answer from another chat. Each chat keeps one answer: a new question replaces the previous one.

Only the **text** of the answer is saved (a small JSON file per chat, in the `history/` folder of the plugin data), not the audio: sections are turned into speech on the fly, into temporary files deleted right after they are read.

In ⚙ → **Memory**:

- **7 / 30 / 90 days** - how long to keep a chat's answer after its last change (30 days by default). Older ones are deleted automatically: when the server starts and once a day. Come back to a project after 10-15 days and you can listen to what it was about; after that the answer is gone.
- **Off** - nothing is written to disk, and answers already saved are deleted right away. Echo remembers answers only until the speech server stops; after a restart every chat starts from scratch.
- **Clear all** - immediately deletes the remembered answers of all chats (from disk and memory) and stops reading.

Echo is for listening as you go, not for archiving conversations - that is why it keeps only the last answer and cleans up after itself.

When one chat is reading and Claude is answering in another, the other chat's answer is only saved (it does not interrupt the reading); listen to it with ▶ in that chat. Pressing ▶, ❮ ❯ or ⏹ in a chat switches Echo to that chat.

### Language and voice

In ⚙, the **Voice** list sets the language and voice Echo reads with:

- **Auto** - Echo detects the language of each reply and reads it with a voice for that language,
- **a specific language and voice** (for example "Polish: Bass") - everything is read with that voice, including text in another language.

The change applies immediately, even while reading.

**Default voice for Auto:** the voice you choose for a language is remembered. Choose, for example, "English: Ryan" and then go back to "Auto" - from now on Auto reads English replies with Ryan (and so on, separately for each language). Without such a choice Auto uses the first installed voice of the language. In the Voice and Speaker lists the default voice (and speaker) of a language is marked with ◉.

**A language with no voice:** when a reply is written in a script that no installed voice can read (Japanese, Chinese, Korean, Cyrillic, Greek, Arabic, Hebrew, Hindi, Thai, Georgian), Echo does not read it with a foreign voice - the bar shows "no voice: <language>". Once you install a voice in the **+** pane, the reply is read right away. A single foreign word in a sentence does not change the language of the whole text.

The **Interface** list changes the language of Echo itself (bar, settings, panes, messages, `/echo` command words): English (default), Polish, German, French, Italian, Spanish, Portuguese, Russian, Ukrainian, Japanese and Chinese. The choice is remembered for later sessions.

You set the language of Claude's replies in Claude Code itself (`"language"` in `settings.json`); Echo only reads what Claude writes.

### What Echo adds to Claude's instructions

Echo reads only the visible text of a reply (white), never Claude's thinking (grey, collapsible). So that nothing meant for you ends up in the thinking, Echo adds one short sentence to Claude's system instructions: everything meant for the user - including short updates between steps - must be plain text. It changes nothing else in how Claude behaves.

If a message still ends up in the thinking, the app shows it in the chat anyway. Echo recognises such a fragment: real thinking reaches plugins empty (encrypted), while a fragment visible in the chat has content. So Echo reads thinking blocks that have content (without code blocks, up to 1500 characters) like regular messages; in `reading.log` they are marked `thinking (live, read)`.

## Languages pane

A list of all languages in the Piper catalog: installed ones first, then alphabetically. On the right of each language row you can see how many voices it has (and how many of them are installed, for example "2/5 voices").

- **▸** - expands the language's voices: name, region, quality, size, number of speakers,
- **◉ / ○** (at the start of an installed voice's row, in line with the language arrow; voices that are not installed have a gap there) - ◉ marks the default voice of the language that Auto uses; clicking ○ makes that voice the default. For a model with several speakers every speaker has its own dot; the dot next to the model itself picks the remembered speaker or the first one,
- **Download ⤓** (next to a voice, on the right) - downloads that voice,
- **Remove ✕** - removes an installed voice,
- **Downloading …** - the voice is being downloaded (several download one after another),
- **▸ next to a voice** - a model with several speakers (for example Semaine: Obadiah, Poppy, Prudence, Spike) lists their names. The whole model is downloaded and removed at once, because all speakers are in one file.

Voices are downloaded one by one, not a whole language at once.

Auto detection recognises: Polish, English, German, French, Italian, Spanish, Portuguese, Czech, Dutch, Swedish, Russian, Ukrainian, Chinese and Japanese. Choose other languages manually.

## Echo commands

Type them in the message box. The words work in English and in the interface language:

| Command | What it does |
|---|---|
| `/echo` | Opens the languages pane |
| `/echo pause` | Pause |
| `/echo resume` | Reads the current section from its start |
| `/echo next` | Next section |
| `/echo prev` | Previous section |
| `/echo stop` | Stop |
| `/echo replay` | Reads the last answer again |
| `/echo languages` | Opens the languages pane |
| `/echo restart` | Restarts the speech server (if something gets stuck) |
| `/echo help` | This help |

## Files

| Location | Contents |
|---|---|
| plugin folder: `hooks/` | The plugin: bar, panes, commands (TypeScript) |
| plugin folder: `server/` | Local speech server (Python, 127.0.0.1:59125) |
| plugin data folder: `venv/` | Python with Piper |
| plugin data folder: `voices/` | Downloaded voices |
| plugin data folder: `config.json` | Settings: language, speed, chosen voices |
| plugin data folder: `server.log` | Server log (errors) |
| plugin data folder: `history/` | The last answer of each chat (text, one file per chat), deleted after the time set in ⚙ → Memory |
| plugin data folder: `reading.log` | Reading log: new question (reset), each of Claude's messages and what happened to it, sections read, pauses, settings changes |

The plugin data folder is created by Claude Code (`CLAUDE_PLUGIN_DATA`); it is kept when the plugin is updated.

## Privacy

- The speech server listens only locally (`127.0.0.1`) and cannot be reached from the network.
- The internet is used only for installation: Piper from PyPI (first run) and the voice catalog and voices from Hugging Face (`rhasspy/piper-voices`).
- Japanese voices install a pronunciation module when they are installed (`pyopenjtalk-plus` from PyPI).

## Development

Code structure:

- `hooks/` - the plugin (TypeScript): `register.tsx` connects the events, `ui/` holds the bar and pane components, `locales/` the translations (every new text in all languages), `config.ts` the settings, `styles.ts` the shared look, `visualizer.ts` the SVG visualizer.
- `server/` - the speech server (Python, Piper): `main.py` and the `echo_tts/` package.
- `startup.json` - settings for a new installation.

During development the plugin loads from its folder through `CLAUDE_CODE_PLUGIN_DIRS` (with `CLAUDE_CODE_PLUGIN_DIR_WATCH=1` changes load by themselves).

```
npm install
npm run check
```

## License

Echo code: MIT. Echo does not include Piper: [piper-tts](https://github.com/OHF-Voice/piper1-gpl) (GPL-3.0) is installed separately from PyPI on first run. Voices have their own licenses - check the voice card on Hugging Face before commercial use.
