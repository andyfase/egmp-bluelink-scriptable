import { objectKeys } from '../object'
import { AlertOpts, AlertButton, TextFieldConfigOpts, TextFieldKeyboardFlavor } from './types'

// ALERT CREATION

const applyTextFieldFlavor = (flavor: TextFieldKeyboardFlavor, field: TextField) => {
  switch (flavor) {
    case 'default':
      return field.setDefaultKeyboard()
    case 'email':
      return field.setEmailAddressKeyboard()
    case 'number':
      return field.setDecimalPadKeyboard()
    case 'phone':
      return field.setPhonePadKeyboard()
    case 'url':
      return field.setURLKeyboard()
    default:
      throw new Error(`Unmapped flavor ${String(flavor)}`)
  }
}

const addTextFields = (textFields: TextFieldConfigOpts[], alert: Alert) => {
  for (const { placeholder = '', initValue, flavor = 'default', font, textColor } of textFields) {
    const field = alert.addTextField(placeholder, initValue)
    applyTextFieldFlavor(flavor, field)
    if (font) field.font = font
    if (textColor) field.textColor = textColor
  }
}

const addButtons = (buttons: (AlertButton & { text: string })[], alert: Alert) => {
  for (const { text, isCancel, isRed } of buttons) {
    if (isCancel) alert.addCancelAction(text)
    else if (isRed) alert.addDestructiveAction(text)
    else alert.addAction(text)
  }
}

// RESULT PARSING

/** Returns the button tapped for the given return index. */
const getButtonAtIndex = <ButtonKey extends string>(
  i: number,
  buttons: Record<ButtonKey, AlertButton>,
  orderedButtonKeys: ButtonKey[],
) => {
  const orderedButtonKeysWithText = orderedButtonKeys.map((text) => ({
    text,
    ...buttons[text],
  }))
  if (i === -1) {
    const button = orderedButtonKeysWithText.find((b) => b.isCancel)
    if (!button) throw new Error('No cancel button included')
    return button
  }
  // Cancel buttons are always moved to the end in both the UI and the return
  // index (though they return -1)
  const button = orderedButtonKeysWithText.filter((b) => !b.isCancel)[i]
  if (!button) throw new Error('Button is not there')
  return button
}

/** Get the values of the text fields correlating with their user-passed key. If
 * the field is empty, its return value is set to null. */
const getTextFieldResponse = <TextFieldKey extends string>(textFieldKeys: TextFieldKey[], alert: Alert) =>
  Object.fromEntries(textFieldKeys.map((key, i) => [key, alert.textFieldValue(i) || null])) as Record<
    TextFieldKey,
    string | null
  >

//

export default async <TextFieldKey extends string = string, ButtonKey extends string = string>({
  title,
  message,
  textFields,
  buttons,
  presentAsSheet = false,
}: AlertOpts<TextFieldKey, ButtonKey>) => {
  const alert = new Alert()
  alert.title = title
  if (message) alert.message = message

  const fieldKeys = textFields && objectKeys(textFields)
  if (textFields && fieldKeys) {
    addTextFields(
      // Ensure preserved order
      fieldKeys.map((key) => textFields[key]),
      alert,
    )
  }

  const buttonKeys = objectKeys(buttons)
  addButtons(
    buttonKeys.map((key) => ({ text: key, ...buttons[key] })),
    alert,
  )

  const tappedButtonIndex = presentAsSheet ? await alert.presentSheet() : await alert.present()
  const textFieldResults = (fieldKeys ? getTextFieldResponse(fieldKeys, alert) : {}) as Record<
    TextFieldKey,
    string | null
  >
  const tappedButton = getButtonAtIndex(tappedButtonIndex, buttons, buttonKeys)
  return { textFieldResults, tappedButtonText: tappedButton.text }
}
