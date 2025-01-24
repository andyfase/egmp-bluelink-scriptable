import { ExcludeFalsy, isString } from '../common'
import { noop } from '../flow'
import { Falsy, MapFn, NoParamFn } from '../types/utilTypes'
import { IconOrSFKey } from '../UITable/elements/Icon'
import { FlavorOption } from '../UITable/Row/flavors'
import fullscreenOpts, { FullscreenOptNode } from './fullscreenOpts'
import textInput from './textInput'

type Opts<V> = {
  onOptionSelect?: MapFn<V>
  onCancel?: NoParamFn
  /** If provided, use this icon as the default */
  fallbackIcon?: IconOrSFKey
}

export type ListChooseOptionObj<L extends string, V> = {
  label: L
  value: V
  icon?: IconOrSFKey
  flavor?: FlavorOption
}

type AllOptionTypes<L extends string = string, V = string> = ListChooseOptionObj<L, V> | string | Falsy

type ListChoose = {
  /** Non-string value */
  <L extends string, V>(options: (ListChooseOptionObj<L, V> | Falsy)[], config?: Opts<V>): Promise<V | null>

  /** String value */
  <L extends string>(options: (L | Falsy)[], config?: Opts<L>): Promise<L | null>
}

//

const findResultValue = <V>(resultLabel: string, options: AllOptionTypes<string, V>[]) => {
  const match = options
    .filter(ExcludeFalsy)
    .find((option) => (isString(option) ? option === resultLabel : option.label === resultLabel))
  if (!match) {
    throw new Error(`Expected to find selected label ${resultLabel} in listChoose options.`)
  }
  return isString(match) ? match : match.value
}

const listChoose: ListChoose = async <V>(
  options: AllOptionTypes<string, V>[],
  { fallbackIcon = 'dot_in_circle', onCancel, onOptionSelect }: Opts<V> = {},
) => {
  const tappedLabel = await fullscreenOpts(
    options.filter(ExcludeFalsy).map<FullscreenOptNode>((option) => {
      if (isString(option)) {
        return {
          label: option,
          icon: fallbackIcon,
          action: noop,
        }
      }
      const { label, flavor, icon = fallbackIcon } = option
      return { label, flavor, icon, action: noop }
    }),
  )

  if (tappedLabel === null) {
    await onCancel?.()
    return null
  }

  const selectedValue = findResultValue(tappedLabel, options)
  await onOptionSelect?.(selectedValue as V)
  return selectedValue
}

export default listChoose

//
//
//

const CUSTOM_OPTION_LABEL = 'Custom'

/** Just like `listChoose`, but with ability to add custom response. */
export const listChooseWithCustom = async (
  options: AllOptionTypes[],
  { onOptionSelect, onCancel, ...restConfig }: Opts<string> = {},
): Promise<string | null> => {
  const optionsWithCustom: AllOptionTypes[] = [
    {
      label: CUSTOM_OPTION_LABEL,
      value: CUSTOM_OPTION_LABEL,
      icon: 'add',
      flavor: 'serene',
    },
    ...options,
  ]
  const result = await listChoose<string>(optionsWithCustom as string[], restConfig)

  if (!result) {
    onCancel?.()
    return null
  }
  if (result !== CUSTOM_OPTION_LABEL) {
    await onOptionSelect?.(result)
    return result
  }

  const customResponse = await textInput('Custom response')
  await (customResponse ? onOptionSelect?.(customResponse) : onCancel?.())
  return customResponse ?? null
}
