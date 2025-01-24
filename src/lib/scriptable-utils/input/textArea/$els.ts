import { ExcludeFalsy } from '../../common'
import { H, P } from '../../HTMLGenerator/atoms'
import { Child } from '../../HTMLGenerator/types'
import { getElement } from '../../HTMLGenerator/utils'
import { IDS } from './consts'
import { ButtonElProps, RequiredTextAreaOptsSubset, TextAreaOpts } from './types'

const getButton = ({ label, disabled, id }: ButtonElProps) =>
  getElement('button', {
    attributes: {
      // Type button prevents default behavior of submitting form
      type: 'button',
      ...(disabled ? { disabled: 'true' } : {}),
    },
    id,
    children: [label],
  })

const $resetButton = () => getButton({ label: '⎌', disabled: true, id: IDS.RESET_BUTTON_ID })

const $clearButton = ({ initValue }: RequiredTextAreaOptsSubset<'initValue'>) =>
  getButton({ label: '∅', disabled: !initValue, id: IDS.CLEAR_BUTTON_ID })

const $buttonContainer = ({
  initValue,
  includeClearButton,
  includeResetButton,
}: RequiredTextAreaOptsSubset<'initValue' | 'includeClearButton'> & {
  includeResetButton: boolean
}) =>
  getElement('div', {
    id: IDS.BUTTON_CONTAINER_ID,
    children: [includeResetButton && $resetButton(), includeClearButton && $clearButton({ initValue })].filter(
      ExcludeFalsy,
    ),
  })

const $divider = getElement('hr')

const $textArea = ({ placeholder, initValue }: RequiredTextAreaOptsSubset<'placeholder' | 'initValue'>) =>
  getElement('textarea', {
    attributes: { placeholder },
    children: [initValue],
  })

export const $form = ({
  placeholder,
  dontIncludeResetButton,
  hideAllButtons,
  includeClearButton,
  initValue,
}: RequiredTextAreaOptsSubset<
  'placeholder' | 'initValue' | 'hideAllButtons' | 'includeClearButton' | 'dontIncludeResetButton'
>) =>
  getElement('form', {
    children: [
      $textArea({ placeholder, initValue }),
      $buttonContainer({
        initValue,
        includeClearButton: hideAllButtons ? false : includeClearButton,
        includeResetButton: hideAllButtons ? false : !dontIncludeResetButton,
      }),
    ],
  })

export const $pageContainer = (...children: Child[]) => getElement('div', { id: IDS.PAGE_CONTAINER_ID, children })

export const $header = ({ title, message }: Pick<TextAreaOpts, 'title' | 'message'>) =>
  getElement('div', {
    children: [title && H(2)(title), message && P(message), $divider].filter(ExcludeFalsy),
  })
