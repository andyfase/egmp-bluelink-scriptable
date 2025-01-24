import getPageHtml from '../../HTMLGenerator/getPageHtml'
import { webView } from '../../WebView'
import { $form, $header, $pageContainer } from './$els'
import { getHeadJavascript } from './javascript'
import { pageStyle } from './style'
import { TextAreaOpts } from './types'

const textArea = async ({
  title,
  onSubmit = () => {},
  message,
  initValue = '',
  placeholder = 'Enter text',
  includeClearButton = false,
  dontIncludeResetButton = false,
  hideAllButtons = false,
}: TextAreaOpts = {}) => {
  const html = getPageHtml({
    pageStyle,
    headJavascript: getHeadJavascript(initValue),
    children: [
      $pageContainer(
        $header({ title, message }),
        $form({
          dontIncludeResetButton,
          hideAllButtons,
          includeClearButton,
          initValue,
          placeholder,
        }),
      ),
    ],
  })

  const newValue = await webView({ html }).renderThenEvaluateJs<string>(`document.querySelector('textarea').value`)
  await onSubmit(newValue)
  return newValue
}

export default textArea
