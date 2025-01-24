import { AttrDictionary } from './types'
import { getElement } from './utils'

export const H = (scale: 1 | 2 | 3 | 4 | 5 | 6) => (text: string, style?: AttrDictionary) =>
  getElement(`h${scale}`, { style, children: [text] })

export const P = (text: string, style?: AttrDictionary) => getElement('p', { style, children: [text] })
