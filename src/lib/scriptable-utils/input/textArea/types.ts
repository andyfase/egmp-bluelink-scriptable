import { AttrDictionary } from '../../HTMLGenerator/types'
import { TextFieldConfigOpts, TextFieldFormatting } from '../types'

type TextFieldOptsWithoutFormatting = {
  [K in Exclude<keyof TextFieldConfigOpts, keyof TextFieldFormatting>]?: TextFieldConfigOpts[K]
}

export type TextAreaOpts = {
  title?: string
  onSubmit?: (result: string) => any
  message?: string
  includeClearButton?: boolean
  dontIncludeResetButton?: boolean
  hideAllButtons?: boolean
} & TextFieldOptsWithoutFormatting

export type RequiredTextAreaOptsSubset<K extends keyof TextAreaOpts> = {
  [key in K]: Required<Pick<TextAreaOpts, key>>[key]
}

export type ButtonElProps = {
  label: string
  disabled?: boolean
  id: string
  style?: AttrDictionary
}
