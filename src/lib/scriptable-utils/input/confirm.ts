import { NoParamFn } from '../types/utilTypes'
import alert from './alert'

const DEFAULT_CONFIRM_DIALOG_TITLE = 'Confirm action?'
const DEFAULT_CONFIRM_BUTTON_TEXT = 'OK'
const DEFAULT_CANCEL_BUTTON_TEXT = 'Cancel'

const dontShowAgainMap: Record<string, boolean> = {}
const setDontShowAgain = (key: string, val: boolean) => (dontShowAgainMap[key] = val)

type ConfirmOpts = {
  message?: string
  presentAsSheet?: boolean
  confirmButtonTitle?: string
  cancelButtonTitle?: string
  includeCancel?: boolean
  isSubmitRed?: boolean
  onConfirm?: NoParamFn
  onCancel?: NoParamFn
  /** Unique key to remember this setting for the session. */
  dontShowAgainKey?: string
}

export const confirm = async (
  title = DEFAULT_CONFIRM_DIALOG_TITLE,
  {
    message,
    confirmButtonTitle = DEFAULT_CONFIRM_BUTTON_TEXT,
    cancelButtonTitle = DEFAULT_CANCEL_BUTTON_TEXT,
    includeCancel = true,
    presentAsSheet = true,
    isSubmitRed = false,
    onConfirm,
    onCancel,
    dontShowAgainKey,
  }: ConfirmOpts = {},
) => {
  const shouldBypassDialog = Boolean(dontShowAgainKey && dontShowAgainMap[dontShowAgainKey])
  if (shouldBypassDialog) {
    await onConfirm?.()
    return true
  }

  const DONT_SHOW_AGAIN_LABEL = `${confirmButtonTitle} (stop asking)`
  const { tappedButtonText } = await alert({
    title,
    message,
    buttons: {
      ...(includeCancel && { [cancelButtonTitle]: { isCancel: true } }),
      [confirmButtonTitle]: { isRed: isSubmitRed },
      ...(dontShowAgainKey && {
        [DONT_SHOW_AGAIN_LABEL]: { isRed: isSubmitRed },
      }),
    },
    presentAsSheet,
  })

  if (tappedButtonText === cancelButtonTitle) {
    await onCancel?.()
    return false
  }

  if (tappedButtonText === DONT_SHOW_AGAIN_LABEL) {
    setDontShowAgain(dontShowAgainKey!, true)
  }
  await onConfirm?.()
  return true
}

//
// DESTRUCTIVE CONFIRM
//

type DestructiveConfirmOpts = Pick<
  ConfirmOpts,
  | 'message'
  | 'confirmButtonTitle'
  | 'cancelButtonTitle'
  | 'onConfirm'
  | 'onCancel'
  | 'dontShowAgainKey'
  | 'presentAsSheet'
>

export const destructiveConfirm = (
  title: string,
  { confirmButtonTitle = 'Delete', ...restOpts }: DestructiveConfirmOpts = {},
) => confirm(title, { isSubmitRed: true, confirmButtonTitle, ...restOpts })

//
// OK
//

type OKOpts = Pick<ConfirmOpts, 'message' | 'confirmButtonTitle' | 'presentAsSheet' | 'onConfirm'>

export const OK = (title: string, opts: OKOpts = {}) => confirm(title, { includeCancel: false, ...opts })
