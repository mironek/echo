// Panel pomocy: README wtyczki i przycisk otwierający plik w edytorze.

import type { ElementTable, EngineInterface } from 'claude-code'

import { t } from '../i18n'
import { helpFileName, openHelpFile } from '../panes'
import { pluginEnv } from '../setup'
import { applyUiLanguage } from '../state'

/** Rysuje panel pomocy z treścią README. */
export async function renderHelpPane($: EngineInterface, ui: ElementTable) {
  const { Box, Button, Markdown, Text } = ui
  await applyUiLanguage($)
  const { root } = await pluginEnv($)
  let text: string
  try {
    text = await $.fs.read(`${root}/${helpFileName()}`)
  } catch {
    return <Text dimColor>{t('help.fileMissing', { file: helpFileName() })}</Text>
  }
  return (
    <Box flexDirection="column" gap={1}>
      <Button key="open-file" label={t('help.openFile', { file: helpFileName() })} onPress={() => void openHelpFile($)} />
      <Markdown key="help-text" text={text} />
    </Box>
  )
}
