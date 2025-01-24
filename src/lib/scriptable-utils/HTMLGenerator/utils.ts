import { isString } from '../common'
import { Omit_ } from '../types/utilTypes'
import { AttrDictionary, Child, Element, PageStyle } from './types'

const getStyleString = (styleDefinition: AttrDictionary) => {
  if (Object.keys(styleDefinition).length === 0) return ''
  return Object.entries(styleDefinition)
    .map(([key, val]) => `${key}:${val};`)
    .join('')
}

export const getPageStyleString = (style: PageStyle) => {
  if (Object.keys(style).length === 0) return ''
  let styleString = ''
  for (const [selector, styleDict] of Object.entries(style)) {
    styleString += `${selector} {${getStyleString(styleDict)}}`
  }
  return styleString
}

export const getElement = (tagName: string, opts: Omit_<Element, 'tagName'> = {}) => ({ tagName, ...opts })

const childToHTML = (el: Child) => (isString(el) ? el : getElementHTML(el))

const parseChild = (child: Child) => {
  const stringifiedChild = childToHTML(child)
  return stringifiedChild
    ? stringifiedChild
        .split('\n')
        .map((childLine) => `\t${childLine}`)
        .join('\n')
    : null
}

export const getElementHTML = (el: Element): string => {
  const { tagName, attributes = {}, children = [], classList = [], id, prettify, style = {} } = el
  const allAttrs: AttrDictionary = {
    ...attributes,
    ...(Object.keys(style).length > 0 && { style: getStyleString(style) }),
    ...(id && { id }),
    ...(classList.length > 0 && { class: classList.join(' ') }),
  }
  const attrsStr = Object.entries(allAttrs)
    .map(([key, val]) => `${key}="${val}"`)
    .join(' ')

  const openTag = `<${tagName} ${attrsStr}>`
  const closeTag = `</${tagName}>`

  if (prettify) {
    const indentedChildrenString = children.map(parseChild).filter(Boolean).join('\n')
    return [openTag, indentedChildrenString, closeTag].join('\n')
  }

  if (children.length > 0) return [openTag, ...children.map(childToHTML), closeTag].join('')
  return `${openTag}${closeTag}`
}
