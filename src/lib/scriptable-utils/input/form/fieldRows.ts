import { toggleArrayItem } from '../../array'
import { EnhancedColor } from '../../colors'
import { ExcludeFalsy, isNumber } from '../../common'
import { formatDate, getReadableDaysFromNowLabel, YYYYMMDDToDate } from '../../date'
import { cycle, force } from '../../flow'
import { ICONS } from '../../icons'
import { SFSymbolKey } from '../../sfSymbols'
import { LabeledValue, MapFn, NoParamFn, Omit_ } from '../../types/utilTypes'
import { RowSize } from '../../UITable/Row/types'
import { ValidTableEl } from '../../UITable/types'
import chooseColor from '../chooseColor'
import chooseSFSymbol from '../chooseSFSymbol'
import { destructiveConfirm } from '../confirm'
import { pickDate } from '../date/pickDate'
import pickDateAndTIme from '../date/pickDateAndTIme'
import quickOptions from '../quickOptions'
import textInput from '../textInput'
import { MultiOptionRow, StandardFieldRow } from './atoms'
import { CommonFieldOpts, MultiOptionRowValueOpt, ValidFieldValue } from './types'
import { TextFieldKeyboardFlavor } from '../types'
import { getErrorMessage, getRowOpts, mapLabel } from './utils'

const confirmClearValue = (onChange: MapFn<undefined, any>) =>
  destructiveConfirm('Clear value?', {
    confirmButtonTitle: 'Clear',
    dontShowAgainKey: 'form-clear-value',

    onConfirm: () => onChange(undefined),
  })

//
//
//

/** `null` plays a very important role in Cycle -- if the user chooses, it can
 * be a cycle option, thus clearing the field value. */
type CycleFieldOpts<T extends string | null> = {
  options: T[]
  currValue: T
  onChange: MapFn<T>
  size?: RowSize
} & CommonFieldOpts

export const CycleField = <T extends string | null>(opts: CycleFieldOpts<T>) => {
  const { onChange, options, currValue, label, customIcon } = opts
  const errorMessage = getErrorMessage(opts, currValue)
  const rowOpts = getRowOpts({
    onTap: () => onChange(cycle(currValue, options)),
    isFaded: !currValue,
  })
  return StandardFieldRow({
    labelOpts: { fieldLabel: label, rowOpts },
    errorOpts: { errorMessage, rowOpts },
    valueOpts: {
      icon: customIcon ?? 'cycle',
      rowOpts,
      valueRowLabel: mapLabel(opts, currValue) ?? 'Select option',
      showErrorIndicator: Boolean(errorMessage),
    },
  })
}

//

type RadioFieldOpts<T extends string | number> = {
  options: T[]
  currValue?: T
  onChange: MapFn<T>
  label: string
  size?: RowSize
} & Omit_<CommonFieldOpts, 'label' | 'customIcon'>

export const RadioField = <T extends string | number>(opts: RadioFieldOpts<T>) => {
  const { onChange, options, currValue, label, size = 'md' } = opts
  const errorMessage = getErrorMessage(opts, currValue)
  return MultiOptionRow({
    labelOpts: { fieldLabel: label, rowOpts: { isFaded: !currValue } },
    errorOpts: { errorMessage, rowOpts: {} },
    valueOpts: options.map<MultiOptionRowValueOpt>((valueLabel) => {
      const isSelected = valueLabel === currValue
      return {
        icon: isSelected ? 'circle_filled' : 'circle',
        rowOpts: { onTap: () => onChange(valueLabel), isFaded: !isSelected },
        size,
        valueRowLabel: mapLabel(opts, String(valueLabel)),
      }
    }),
  })
}

//

type CheckboxFieldOpts = {
  label: string
  currValue?: boolean
  onChange: MapFn<boolean>
  size?: RowSize
} & Omit_<CommonFieldOpts, 'label' | 'customIcon'>

export const CheckboxField = (opts: CheckboxFieldOpts) => {
  const { currValue, onChange, label } = opts
  const errorMessage = getErrorMessage(opts, currValue)
  const rowOpts = getRowOpts({
    onTap: () => onChange(!currValue),
    isFaded: !currValue,
  })
  return StandardFieldRow({
    errorOpts: { errorMessage, rowOpts },
    valueOpts: {
      icon: currValue ? 'task_complete' : 'task_incomplete',
      rowOpts,
      valueRowLabel: mapLabel(opts, label),
      showErrorIndicator: Boolean(errorMessage),
    },
  })
}

//

type ChooseIconOpts = {
  currValue?: SFSymbolKey
  onChange: MapFn<SFSymbolKey>
} & Omit_<CommonFieldOpts, 'customIcon'>

export const ChooseIconField = (opts: ChooseIconOpts) => {
  const { label, currValue, onChange } = opts
  const errorMessage = getErrorMessage(opts, currValue)
  const rowOpts = getRowOpts({
    isFaded: !currValue,
    onTap: async () => {
      const newKey = await chooseSFSymbol(currValue)
      if (newKey && newKey !== currValue) onChange(newKey)
    },
  })
  return StandardFieldRow({
    labelOpts: { fieldLabel: label, rowOpts },
    errorOpts: { errorMessage, rowOpts },
    valueOpts: {
      icon: currValue,
      rowOpts,
      showErrorIndicator: Boolean(errorMessage),
      valueRowLabel: mapLabel(opts, currValue) ?? 'Select icon',
    },
  })
}

//

type ChooseColorOpts = {
  currValue?: EnhancedColor
  onChange: MapFn<ValidFieldValue<'color'>>
} & CommonFieldOpts

export const ChooseColorField = (opts: ChooseColorOpts) => {
  const { onChange, currValue, customIcon, label, isClearable } = opts
  const canUserClear = Boolean(currValue && isClearable)
  const rowOpts = getRowOpts({
    onTap: async () => {
      const newVal = await chooseColor()
      if (newVal && newVal.label !== currValue?.label) onChange(newVal)
    },
    isFaded: !currValue,
    ...(canUserClear && { onDoubleTap: () => confirmClearValue(onChange) }),
  })
  const errorMessage = getErrorMessage(opts, currValue)
  return StandardFieldRow({
    labelOpts: { fieldLabel: label, rowOpts },
    errorOpts: { errorMessage, rowOpts },
    valueOpts: {
      icon: customIcon,
      rowOpts,
      valueRowLabel: mapLabel(opts, currValue?.label) ?? 'Choose color',
      showErrorIndicator: Boolean(errorMessage),
      showClearIndicator: canUserClear,
      bgColor: currValue?.color,
    },
  })
}

//

type TextInputOpts = {
  currValue?: string
  secure?: boolean
  flavor?: TextFieldKeyboardFlavor
  onChange: MapFn<ValidFieldValue<'textInput'>>
} & CommonFieldOpts

export const TextInputField = (opts: TextInputOpts) => {
  const { onChange, currValue, customIcon, label, isClearable } = opts
  const canUserClear = Boolean(currValue && isClearable)
  const rowOpts = getRowOpts({
    onTap: async () => {
      const newVal = await textInput(label ?? 'Enter text', {
        initValue: currValue,
        placeholder: currValue,
        secure: opts.secure,
        flavor: opts.flavor,
      })
      if (newVal && newVal !== currValue) onChange(newVal)
    },
    isFaded: !currValue,
    ...(canUserClear && { onDoubleTap: () => confirmClearValue(onChange) }),
  })
  const errorMessage = getErrorMessage(opts, currValue)
  return StandardFieldRow({
    labelOpts: { fieldLabel: label, rowOpts },
    errorOpts: { errorMessage, rowOpts },
    valueOpts: {
      icon: customIcon,
      rowOpts,
      valueRowLabel: mapLabel(opts, opts.secure ? '********' : currValue) ?? 'Add text',
      showErrorIndicator: Boolean(errorMessage),
      showClearIndicator: canUserClear,
    },
  })
}

//

type YYYYMMDDDatePickerOpts = {
  currValue?: string
  onChange: MapFn<string>
} & CommonFieldOpts

export const YYYYMMDDDatePickerField = (opts: YYYYMMDDDatePickerOpts) => {
  const { customIcon, label, currValue, onChange } = opts
  const rowOpts = getRowOpts({
    onTap: async () => {
      const newVal = await pickDate(currValue ? { initialDate: YYYYMMDDToDate(currValue) } : {})
      if (!newVal) return
      const newFormatted = formatDate(newVal, 'YYYYMMDD')
      if (newFormatted !== currValue) onChange(newFormatted)
    },
    isFaded: !currValue,
  })
  const errorMessage = getErrorMessage(opts, currValue)
  return StandardFieldRow({
    labelOpts: { fieldLabel: label, rowOpts },
    errorOpts: { errorMessage, rowOpts },
    valueOpts: {
      icon: customIcon,
      rowOpts,
      valueRowLabel: mapLabel(opts, currValue) ?? 'Select date',
      showErrorIndicator: Boolean(errorMessage),
    },
  })
}

//

type DateAndTimePickerOpts = {
  currValue?: Date
  onChange: MapFn<Date>
} & CommonFieldOpts

const getDateWithTimeLabel = (date?: Date) => {
  if (!date) return 'Select date'
  const dayLabel = getReadableDaysFromNowLabel(date) || formatDate(date, 'YYYYMMDD')
  const timeLabel = formatDate(date, 'HHMM')
  return `${dayLabel}, ${timeLabel}`
}

export const DateAndTimePickerField = (opts: DateAndTimePickerOpts) => {
  const { onChange, currValue, customIcon, label } = opts
  const rowOpts = getRowOpts({
    onTap: async () => {
      const newDate = await pickDateAndTIme(currValue ?? undefined)
      if (newDate && newDate.getTime() !== currValue?.getTime()) {
        onChange(newDate)
      }
    },
    isFaded: !currValue,
  })
  const errorMessage = getErrorMessage(opts, currValue)
  return StandardFieldRow({
    labelOpts: { fieldLabel: label, rowOpts },
    errorOpts: { errorMessage, rowOpts },
    valueOpts: {
      icon: customIcon,
      rowOpts,
      valueRowLabel: getDateWithTimeLabel(currValue),
      showErrorIndicator: Boolean(errorMessage),
    },
  })
}

//

type SelectMultiOpts<T extends string | number> = {
  selectedOptions: T[]
  options: T[]
  label: string
  onChange: MapFn<T[]>
} & Omit_<CommonFieldOpts, 'label' | 'customIcon'>

export const SelectMultiField = <T extends string | number>(opts: SelectMultiOpts<T>) => {
  const { onChange, selectedOptions, label, options } = opts
  const getOnTap = (value: T) => () => onChange(toggleArrayItem(selectedOptions, value))
  const hasValue = selectedOptions.length > 0
  const errorMessage = getErrorMessage(opts, hasValue)
  return MultiOptionRow({
    labelOpts: { fieldLabel: label, rowOpts: { isFaded: !hasValue } },
    errorOpts: { errorMessage, rowOpts: {} },
    valueOpts: options.map<MultiOptionRowValueOpt>((valueLabel) => {
      const isSelected = selectedOptions.includes(valueLabel)
      return {
        icon: isSelected ? 'task_complete' : 'task_incomplete',
        rowOpts: { onTap: getOnTap(valueLabel), isFaded: !isSelected },
        valueRowLabel: mapLabel(opts, String(valueLabel)),
      }
    }),
  })
}

//

type DropdownOpts<T extends string | number> = {
  currValue?: T
  options: T[]
  onChange: MapFn<ValidFieldValue<'dropdown'>>
  /** If allow custom is true, `DropdownField`'s type must be plainly `string` */
  allowCustom?: boolean
} & Omit_<CommonFieldOpts, 'customIcon'>

type DropdownFieldType = {
  (opts: DropdownOpts<string | number> & { allowCustom: true }): ValidTableEl
  <T extends string | number>(opts: DropdownOpts<T>): ValidTableEl
}

const DROPDOWN_CUSTOM_OPTION_LABEL = `${ICONS.ADD} Custom`

const onDropdownTap = async (opts: DropdownOpts<string | number>) => {
  const { onChange, options, currValue, label, allowCustom } = opts
  const staticOptions =
    // This ensures that any custom values are included.
    [...options, currValue].filter(ExcludeFalsy).map<LabeledValue<string | number>>((value) => {
      const mappedLabel = mapLabel(opts, String(value))
      const isSelectedPrefix = value === currValue ? `${ICONS.CHECKMARK_GREEN} ` : ''
      return { label: `${isSelectedPrefix}${mappedLabel}`, value }
    })
  const customOption: LabeledValue<string> | null = allowCustom
    ? {
        label: DROPDOWN_CUSTOM_OPTION_LABEL,
        value: DROPDOWN_CUSTOM_OPTION_LABEL,
      }
    : null

  const selectedValue = await quickOptions([...staticOptions, customOption], {
    title: label ?? 'Select option',
  })
  if (!(selectedValue && selectedValue !== currValue)) return
  if (selectedValue === DROPDOWN_CUSTOM_OPTION_LABEL) {
    const customValue = await textInput('Custom response')
    if (customValue) onChange(customValue)
    return
  }
  onChange(selectedValue)
}

/** If `isClearable` is true, double tap to clear current value */
export const DropdownField: DropdownFieldType = <T extends string>(opts: DropdownOpts<T>) => {
  const { currValue, label, isClearable, onChange } = opts
  const canUserClear = Boolean(currValue && isClearable)
  const rowOpts = getRowOpts({
    isFaded: !currValue,
    onTap: () => onDropdownTap(force<DropdownOpts<string>>(opts)),
    ...(canUserClear && { onDoubleTap: () => confirmClearValue(onChange) }),
  })
  const errorMessage = getErrorMessage(opts, currValue)
  return StandardFieldRow({
    labelOpts: { fieldLabel: label, rowOpts },
    errorOpts: { errorMessage, rowOpts },
    valueOpts: {
      icon: 'expand_vertical_2',
      rowOpts,
      valueRowLabel: mapLabel(opts, currValue) ?? 'Select option',
      showErrorIndicator: Boolean(errorMessage),
      showClearIndicator: canUserClear,
    },
  })
}

//

type ReadonlyOpts = {
  value: string
  size?: RowSize
  onTap?: NoParamFn
  metadata?: string | number
} & Omit_<CommonFieldOpts, 'errorMessage'>

export const ReadonlyField = (opts: ReadonlyOpts) => {
  const { label, customIcon, value, onTap } = opts
  const rowOpts = { onTap }
  return StandardFieldRow({
    labelOpts: { fieldLabel: label, rowOpts },
    valueOpts: {
      icon: customIcon,
      rowOpts,
      valueRowLabel: mapLabel(opts, value),
    },
    errorOpts: { errorMessage: null, rowOpts },
  })
}

//

type NumberOpts = {
  currValue?: number
  onChange: MapFn<ValidFieldValue<'numberValue'>>
} & CommonFieldOpts

export const NumberField = (opts: NumberOpts) => {
  const { onChange, currValue, customIcon, label } = opts
  const rowOpts = getRowOpts({
    onTap: async () => {
      const newVal = await textInput('Enter number', {
        secure: opts.secure,
        flavor: 'number',
        ...(isNumber(currValue) && { initValue: String(currValue) }),
        placeholder: isNumber(currValue) ? String(currValue) : '42',
      })
      const parsed = newVal && Number.parseFloat(newVal)
      if (isNumber(parsed) && parsed !== currValue) onChange(parsed)
    },
    isFaded: !isNumber(currValue),
  })
  const errorMessage = getErrorMessage(opts, currValue)
  return StandardFieldRow({
    labelOpts: { fieldLabel: label, rowOpts },
    errorOpts: { errorMessage, rowOpts },
    valueOpts: {
      icon: customIcon,
      rowOpts,
      valueRowLabel:
        mapLabel(opts, isNumber(currValue) ? (opts.secure ? '****' : String(currValue)) : null) ?? 'Enter number',
      showErrorIndicator: Boolean(errorMessage),
    },
  })
}
