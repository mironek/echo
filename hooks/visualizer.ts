// Wizualizacja czytania: obrazek SVG z animacją (SMIL), który aplikacja odtwarza sama, płynnie i bez kosztu
// po stronie moda. Serwer podaje obwiednię głośności sekcji (poziomy 0-1 co `step` sekund); mod wpisuje ją
// w klatki animacji, a początek animacji przesuwa (`begin` ujemny) o czas, który już minął od startu sekcji.

import type { EchoVisual } from '../types'
import { VISUAL_BAR_JITTER, VISUAL_COLORS, VISUAL_FPS, VISUAL_GAIN, VISUAL_SIZE } from './config'

export type VisualizerKind = 'off' | 'wave' | 'bars' | 'dot'
export const VISUALIZER_KINDS: VisualizerKind[] = ['off', 'wave', 'bars', 'dot']

// Wysokość obrazka w pikselach CSS (szerokość każdego efektu: VISUAL_SIZE w config.ts).
export const VISUAL_HEIGHT = 18
// Ile znaków może zająć animacja jednego obrazka (limit aplikacji: 131 072 na cały SVG); z tego wynika najwięcej klatek.
const FRAME_BUDGET_CHARS = 100000
// Najmniejsza wysokość fali i słupków, żeby w ciszy było widać, że wskaźnik działa.
const MIN_LEVEL = 0.08
// Fala: grubość linii, okresy dwóch fal (px), ile faz ruchu na jeden obieg i czas obiegu (s).
const WAVE_STROKE = 1.2
const WAVE_PERIODS = [20, 31]
const WAVE_PHASES = 12
const WAVE_CYCLE_SECONDS = [0.9, 1.6]
// Zwężanie linii fali ku brzegom: nałożone warstwy tej samej fali, coraz cieńsze (część WAVE_STROKE) i sięgające
// coraz bliżej brzegu (edge = jaka część szerokości przy każdym brzegu płynnie wygasa). Razem linia zanika do zera.
const WAVE_TAPER = [
  { width: 1, edge: 0.5 },
  { width: 0.6, edge: 0.3 },
  { width: 0.3, edge: 0.08 },
]
// Słupki: liczba i szerokość (część miejsca na słupek).
const BAR_COUNT = 10
const BAR_WIDTH_SHARE = 0.48
// Jak bardzo różnią się słupki między sobą (stały „profil” korektora graficznego).
const BAR_PROFILE = Array.from({ length: BAR_COUNT }, (_, i) => 0.45 + 0.55 * Math.abs(Math.sin(i * 1.7 + 0.6)))

/** Liczba z dwoma miejscami po przecinku (krótszy zapis SVG). */
function num(value: number): string {
  return String(Math.round(value * 100) / 100)
}

/** Kolor wizualizacji: nazwany z listy VISUAL_COLORS albo podany wprost (#hex); nieznany = pierwszy z listy. */
export function visualColor(color: string): string {
  if (/^#[0-9a-f]{3,8}$/i.test(color)) return color
  return VISUAL_COLORS.find(one => one.id === color)?.hex ?? VISUAL_COLORS[0]?.hex ?? '#EC793C'
}

/**
 * „Okno” wygaszające brzegi: 0 przy lewej i prawej krawędzi, 1 w środku (połowa sinusa, złagodzona potęgą),
 * żeby fala i słupki nie urywały się na brzegu, tylko płynnie zaczynały i kończyły.
 */
function edgeWindow(position: number): number {
  return Math.pow(Math.sin(Math.PI * Math.min(1, Math.max(0, position))), 0.8)
}

/**
 * Klatki animacji efektu: obwiednia przeliczona na `fps` klatek na sekundę (średnia z grup), ale nie więcej,
 * niż zmieści się w obrazku (`charsPerFrame` = ile znaków SVG zajmuje jedna klatka), wzmocniona mnożnikiem.
 */
function framesOf(visual: EchoVisual, gain: number, fps: number, charsPerFrame: number): number[] {
  const levels = visual.levels.length > 0 ? visual.levels : [0]
  const duration = levels.length * visual.step
  const count = Math.max(1, Math.min(Math.ceil(duration * fps), Math.floor(FRAME_BUDGET_CHARS / charsPerFrame)))
  const grouped =
    levels.length <= count
      ? levels
      : Array.from({ length: count }, (_, i) => {
          const group = levels.length / count
          const part = levels.slice(Math.floor(i * group), Math.floor((i + 1) * group))
          return part.reduce((sum, level) => sum + level, 0) / Math.max(1, part.length)
        })
  return grouped.map(level => Math.min(1, level * gain))
}

/** Powtarzalna „losowa” liczba 0-1 dla słupka i klatki (drgania słupków bez prawdziwego losowania). */
function noise(bar: number, frame: number): number {
  const value = Math.sin(bar * 12.9898 + frame * 78.233) * 43758.5453
  return value - Math.floor(value)
}

/** Wspólne atrybuty animacji: czas trwania sekcji i start przesunięty o czas, który już minął. */
function timing(visual: EchoVisual, elapsedSeconds: number): string {
  const duration = Math.max(0.1, visual.levels.length * visual.step)
  return `dur="${num(duration)}s" begin="${num(-elapsedSeconds)}s" fill="freeze" calcMode="linear"`
}

/**
 * Fala: dwie sinusoidy w nieruchomym „oknie” (amplituda zero przy brzegach); ruch to przesuwanie fazy
 * (kolejne kształty ścieżki), a wysokość całości idzie za głośnością mowy.
 */
function waveSvg(visual: EchoVisual, elapsed: number, color: string): string {
  const width = VISUAL_SIZE.wave
  const frames = framesOf(visual, VISUAL_GAIN.wave, VISUAL_FPS.wave, 8)
  const scale = frames.map(level => `1 ${num(Math.max(MIN_LEVEL, level))}`).join(';')
  const amplitude = VISUAL_HEIGHT / 2 - 1.5
  /** Ścieżka sinusoidy o danym okresie i fazie (0-1), wygaszona przy brzegach. */
  const path = (period: number, phase: number) => {
    const points: string[] = []
    for (let x = 0; x <= width; x += 2) {
      const y = Math.sin(2 * Math.PI * (x / period - phase)) * amplitude * edgeWindow(x / width)
      points.push(`${x} ${num(y)}`)
    }
    return 'M' + points.join(' L')
  }
  /** Maska warstwy: poziomy gradient, czarny (niewidoczny) przy brzegach, biały w środku. */
  const taperMask = (index: number, edge: number) =>
    `<linearGradient id="echo-taper-g${index}" x1="0" x2="${width}" y1="0" y2="0" gradientUnits="userSpaceOnUse">` +
    `<stop offset="0" stop-color="#000"/><stop offset="${num(edge)}" stop-color="#fff"/>` +
    `<stop offset="${num(1 - edge)}" stop-color="#fff"/><stop offset="1" stop-color="#000"/></linearGradient>` +
    `<mask id="echo-taper-${index}" maskUnits="userSpaceOnUse" x="0" y="${-VISUAL_HEIGHT}" width="${width}" ` +
    `height="${VISUAL_HEIGHT * 2}"><rect x="0" y="${-VISUAL_HEIGHT}" width="${width}" height="${VISUAL_HEIGHT * 2}" ` +
    `fill="url(#echo-taper-g${index})"/></mask>`
  /** Jedna warstwa fali: kształt zmienia się w kolejnych fazach, w kółko; maska wygasza ją przy brzegach. */
  const layer = (shapes: string[], seconds: number, opacity: number, width: number, mask: number) =>
    `<path d="${shapes[0]}" fill="none" stroke="${color}" stroke-opacity="${opacity}" stroke-width="${num(width)}" ` +
    `stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke" mask="url(#echo-taper-${mask})">` +
    `<animate attributeName="d" values="${shapes.join(';')}" dur="${seconds}s" repeatCount="indefinite"/></path>`
  /** Fale: pierwsza ze wszystkimi warstwami zwężenia (linia zanika ku brzegom), druga - jedna cienka, przygaszona. */
  const waves = WAVE_PERIODS.map((period, i) => {
    const shapes = Array.from({ length: WAVE_PHASES + 1 }, (_, phase) => path(period, phase / WAVE_PHASES))
    const seconds = WAVE_CYCLE_SECONDS[i] ?? 1
    if (i > 0) return layer(shapes, seconds, 0.4, WAVE_STROKE * 0.6, 1)
    return WAVE_TAPER.map((taper, index) => layer(shapes, seconds, 1, WAVE_STROKE * taper.width, index)).join('')
  })
  return (
    `<defs>${WAVE_TAPER.map((taper, index) => taperMask(index, taper.edge)).join('')}</defs>` +
    `<g transform="translate(0 ${VISUAL_HEIGHT / 2})"><g>` +
    `<animateTransform attributeName="transform" type="scale" values="${scale}" ${timing(visual, elapsed)}/>` +
    waves.join('') +
    `</g></g>`
  )
}

/** Słupki: wąskie słupki korektora; skrajne niższe (jak brzegi fali), każdy z innym profilem i małym opóźnieniem. */
function barsSvg(visual: EchoVisual, elapsed: number, color: string): string {
  const width = VISUAL_SIZE.bars
  const frames = framesOf(visual, VISUAL_GAIN.bars, VISUAL_FPS.bars, 8 * BAR_COUNT)
  const slot = width / BAR_COUNT
  const barWidth = slot * BAR_WIDTH_SHARE
  const maxHeight = VISUAL_HEIGHT - 2
  const bars = BAR_PROFILE.map((profile, i) => {
    const delay = i % 3
    const edge = edgeWindow((i + 0.5) / BAR_COUNT)
    const values = frames
      .map((_, t) => {
        const level = (frames[Math.max(0, t - delay)] ?? 0) * (1 - VISUAL_BAR_JITTER * noise(i, t))
        return `1 ${num(Math.max(MIN_LEVEL * edge, level * profile * edge))}`
      })
      .join(';')
    const x = i * slot + (slot - barWidth) / 2
    return (
      `<g transform="translate(${num(x + barWidth / 2)} ${VISUAL_HEIGHT / 2})"><g>` +
      `<animateTransform attributeName="transform" type="scale" values="${values}" ${timing(visual, elapsed)}/>` +
      `<rect x="${num(-barWidth / 2)}" y="${num(-maxHeight / 2)}" width="${num(barWidth)}" height="${maxHeight}" ` +
      `rx="${num(barWidth / 2)}" fill="${color}"/></g></g>`
    )
  })
  return bars.join('')
}

/** Kropka: dyskretne kółko z ostrym brzegiem, które rośnie z głośnością (do średnicy VISUAL_SIZE.dot). */
function dotSvg(visual: EchoVisual, elapsed: number, color: string): string {
  const frames = framesOf(visual, VISUAL_GAIN.dot, VISUAL_FPS.dot, 6)
  const { width, height } = visualSize('dot')
  const maxRadius = VISUAL_SIZE.dot / 2
  const minRadius = Math.min(2.5, maxRadius / 2)
  const radius = frames.map(level => num(minRadius + level * (maxRadius - minRadius))).join(';')
  return (
    `<circle cx="${num(width / 2)}" cy="${num(height / 2)}" r="${num(minRadius)}" fill="${color}" ` +
    `shape-rendering="geometricPrecision"><animate attributeName="r" values="${radius}" ${timing(visual, elapsed)}/>` +
    `</circle>`
  )
}

/** Rozmiar obrazka efektu w pikselach CSS: fala i słupki - szerokość z VISUAL_SIZE, kropka - jej średnica z zapasem. */
export function visualSize(kind: VisualizerKind): { width: number; height: number } {
  if (kind === 'dot') {
    const side = Math.ceil(VISUAL_SIZE.dot + 2)
    return { width: side, height: Math.max(VISUAL_HEIGHT, side) }
  }
  return { width: kind === 'bars' ? VISUAL_SIZE.bars : VISUAL_SIZE.wave, height: VISUAL_HEIGHT }
}

/** Cały obrazek SVG wybranego efektu dla czytanej sekcji; elapsedSeconds = ile sekcji już zabrzmiało. */
export function visualSvg(kind: VisualizerKind, visual: EchoVisual, elapsedSeconds: number, colorSetting: string): string {
  const color = visualColor(colorSetting)
  const body =
    kind === 'bars'
      ? barsSvg(visual, elapsedSeconds, color)
      : kind === 'dot'
        ? dotSvg(visual, elapsedSeconds, color)
        : waveSvg(visual, elapsedSeconds, color)
  const { width, height } = visualSize(kind)
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" ` +
    `viewBox="0 0 ${width} ${height}"><defs><clipPath id="echo-clip"><rect width="${width}" ` +
    `height="${height}"/></clipPath></defs><g clip-path="url(#echo-clip)">${body}</g></svg>`
  )
}
