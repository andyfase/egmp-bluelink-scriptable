export type TextFieldKeyboardFlavor = 'default' | 'number' | 'email' | 'phone' | 'url'

export type TextFieldFormatting = {
  font?: Font
  textColor?: Color
  flavor?: TextFieldKeyboardFlavor
}

export type TextFieldConfigOpts = {
  placeholder?: string
  initValue?: string
} & TextFieldFormatting

export type AlertButton = {
  // If true, use `addDestructiveAction`
  isRed?: boolean
  // If true, use `addCancelAction`
  isCancel?: boolean
}

export type AlertOpts<TextFieldKey extends string = string, ButtonKey extends string = string> = {
  title: string
  message?: string
  /** `TextFieldKey` values are used to index the final text field values. */
  textFields?: Record<TextFieldKey, TextFieldConfigOpts>
  /** `ButtonKey` values are used as button labels */
  buttons: Record<ButtonKey, AlertButton>
  presentAsSheet?: boolean
}
