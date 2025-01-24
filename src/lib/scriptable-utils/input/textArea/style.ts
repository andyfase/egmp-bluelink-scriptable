import { getColor } from '../../colors'
import { AttrDictionary, PageStyle } from '../../HTMLGenerator/types'
import { IDS } from './consts'

type Style = AttrDictionary

const px = (pixels: number) => `${pixels}px`

//

const dynamicColors: Style = {
  'background-color': `#${getColor('bg').hex}`,
  color: `#${getColor('primaryTextColor').hex}`,
}

const messageStyle: Style = { margin: '5px 0 0' }

const buttonStyle: Style = {
  padding: px(10),
  color: 'white',
  'background-color': `#${getColor('deep_blue_l1').hex}`,
  'text-align': 'center',
  'font-weight': 'bold',
  'font-size': px(26),
  border: 0,
  'border-radius': px(4),
  width: px(50),
  height: px(50),
}

const buttonContainerStyle: Style = {
  display: 'flex',
  'justify-content': 'flex-start',
  'flex-direction': 'column',
  gap: '20px',
}

const textareaStyle: Style = {
  width: '100%',
  height: '100%',
  'font-size': px(20),
  border: 0,
  padding: px(0),
  'line-height': '1.5em',
  'white-space': 'pre-wrap',
  'margin-top': 0,
}

const formStyle: Style = { display: 'flex', 'flex-grow': 3 }

const hrStyle: Style = { margin: '20px 0', opacity: 0.3 }

const pageContainerStyle: Style = {
  display: 'flex',
  'flex-direction': 'column',
  height: '100%',
}

export const pageStyle: PageStyle = {
  [`div#${IDS.PAGE_CONTAINER_ID}`]: pageContainerStyle,
  hr: hrStyle,
  [`div#${IDS.BUTTON_CONTAINER_ID}`]: buttonContainerStyle,
  button: buttonStyle,
  'button:disabled': { opacity: 0.4 },
  textarea: textareaStyle,
  form: formStyle,
  h2: { 'margin-bottom': 0 },
  p: messageStyle,
  'body,textarea': dynamicColors,
}
