import { conditionalArr } from '../array'
import { Child, PageStyle } from './types'
import { getElement, getElementHTML, getPageStyleString } from './utils'

type GetHtmlProps = {
  children: Child[]
  pageStyle?: PageStyle
  headJavascript?: string
  logHTML?: boolean
}

export default ({ children, pageStyle, headJavascript, logHTML = false }: GetHtmlProps) => {
  const parsedPageStyle: PageStyle = {
    ...pageStyle,
    body: { ...pageStyle?.body, 'font-family': '-apple-system' },
  }
  const style = getElement('style', {
    children: [getPageStyleString(parsedPageStyle)],
  })

  const viewport = getElement('meta', {
    attributes: {
      name: 'viewport',
      content: 'width=device-width',
      'initial-scale': 1,
      'maximum-scale': 1,
      'user-scalable': 0,
    },
  })

  const javascript = headJavascript && getElement('script', { children: [headJavascript] })

  const head = getElement('head', {
    children: conditionalArr([style, viewport, javascript]),
  })

  const body = getElement('body', { children })

  const html = [head, body].map(getElementHTML).join('\n')

  if (logHTML) console.log(html)
  return html
}
