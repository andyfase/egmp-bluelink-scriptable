import { Plugin } from 'rollup'

const COMMENT_ATOMS = {
  line1: 'Variables used by Scriptable.',
  line2: 'These must be at the very top of the file. Do not edit.',
}

const getScriptableSettingsCommentLines = (iconColor: string, iconGlyph: string): string => {
  const line3 = `icon-color: ${iconColor}; icon-glyph: ${iconGlyph};`
  return [COMMENT_ATOMS.line1, COMMENT_ATOMS.line2, line3]
    .filter(Boolean)
    .map((text) => `// ${text}`)
    .join('\n')
}

const addFileIconSettings = (): Plugin => ({
  name: 'rollup-plugin-scriptable-icon-settings',
  renderChunk: (code) => {
    const commentLines = getScriptableSettingsCommentLines('deep-gray', 'car')
    return [commentLines, code].join('\n')
  },
})

export default addFileIconSettings
