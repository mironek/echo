// Odtwarzacz na pasku: ▶/⏸ z licznikiem sekcji, ❮ ❯, ⏹ i tempo.
// Nieaktywny przycisk jest rysowany bez tła i ramki (plain), z przygaszonym tekstem — w modach nie ma opacity
// ani stanu disabled. Każdy przycisk stoi w miejscu o stałej szerokości, więc zmiana stanu niczego nie przesuwa.

import type { ElementTable, EngineInterface } from 'claude-code'

import type { EchoStatus } from '../../types'
import { NEXT_ICON, PREV_ICON, SPEED_OPTIONS, STOP_ICON } from '../config'
import { sectionCounter } from '../labels'
import { control } from '../server'
import { styles } from '../styles'

type IconButtonProps = { id: string; icon: string; isEnabled: boolean; onPress: () => void }

/** Przycisk z jedną ikoną (❮ ❯ ⏹): aktywny z tłem, nieaktywny bez tła i przygaszony. */
function IconButton(ui: ElementTable, { id, icon, isEnabled, onPress }: IconButtonProps) {
  const { Box, Button, Text } = ui
  return (
    <Box key={id + '-slot'} {...styles.iconSlot}>
      {isEnabled ? (
        <Button key={id} variant="secondary" onPress={onPress}>
          <Text>{icon}</Text>
        </Button>
      ) : (
        <Button key={id} plain dimColor onPress={() => undefined}>
          <Text {...styles.disabledText}>{icon}</Text>
        </Button>
      )}
    </Box>
  )
}

/** Przycisk ▶/⏸ z licznikiem sekcji; bez sekcji jest bez tła i przygaszony. */
function PlayButton(ui: ElementTable, $: EngineInterface, s: EchoStatus) {
  const { Box, Button, Text } = ui
  const hasText = s.total > 0
  const content = [
    s.state === 'speaking' ? '⏸' : '▶',
    ' ',
    <Text key="counter" size="footnote" mono {...(hasText ? {} : styles.disabledText)}>
      {sectionCounter(s)}
    </Text>,
  ]
  return (
    <Box key="play-slot" {...styles.playSlot}>
      {hasText ? (
        <Button key="play" variant="primary" onPress={() => void control($, '/play')}>
          {content}
        </Button>
      ) : (
        <Button key="play" plain dimColor onPress={() => undefined}>
          {content}
        </Button>
      )}
    </Box>
  )
}

/** Rysuje przyciski odtwarzacza dla bieżącego stanu serwera. */
export function PlayerControls(ui: ElementTable, $: EngineInterface, s: EchoStatus) {
  const { Box, Select } = ui
  const hasText = s.total > 0
  const speedValue = SPEED_OPTIONS.find(one => Number(one) === s.speed) ?? '1.0'

  return [
    PlayButton(ui, $, s),
    <Box key="nav-group" {...styles.navGroup}>
      {IconButton(ui, {
        id: 'prev',
        icon: PREV_ICON,
        isEnabled: hasText && s.index > 0,
        onPress: () => void control($, '/prev'),
      })}
      {IconButton(ui, {
        id: 'next',
        icon: NEXT_ICON,
        isEnabled: hasText && s.index < s.total - 1,
        onPress: () => void control($, '/next'),
      })}
    </Box>,
    IconButton(ui, {
      id: 'stop',
      icon: STOP_ICON,
      isEnabled: s.state !== 'idle',
      onPress: () => void control($, '/stop'),
    }),
    <Select
      key="speed"
      options={SPEED_OPTIONS.map(one => ({ value: one, label: one + '×' }))}
      value={speedValue}
      onSelect={value => void control($, '/config', { speed: Number(value) })}
    />,
  ]
}
