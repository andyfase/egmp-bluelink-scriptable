import { getTypesafeArrOfType } from '../../array'
import { isString } from '../../common'
import { pick } from '../../object'
import { HR } from '../../UITable/elements'
import {
  CheckboxField,
  ChooseColorField,
  ChooseIconField,
  CycleField,
  DateAndTimePickerField,
  DropdownField,
  NumberField,
  RadioField,
  ReadonlyField,
  SelectMultiField,
  TextInputField,
  YYYYMMDDDatePickerField,
} from './fieldRows'
import { CommonFieldOpts, FieldRenderer, FieldRenderOpts, FieldType } from './types'

const commonOptsKeys = getTypesafeArrOfType<keyof CommonFieldOpts>({
  allowCustom: null,
  customIcon: null,
  errorMessage: null,
  isClearable: null,
  isRequired: null,
  label: null,
  mapDisplayValue: null,
  secure: null,
  flavor: null,
})

const commonOpts = (opts: FieldRenderOpts<any>) => pick(opts, commonOptsKeys)

type FieldRenderers = {
  [key in FieldType]: FieldRenderer<key>
}

const isArrOfStrOrNull = (arr: unknown[]): arr is (string | null)[] => arr.every((val) => isString(val) || val === null)
const isArrOfStrOrNum = (arr: unknown[]): arr is (string | number)[] =>
  arr.every((val) => isString(val) || Number.isFinite(val))

/**
 * Note that field renderers provide their own HRs. In the current
 * implementation, each form field provides one bottom HR, while the default `form`
 * export adds top HRs per section.
 */
const fieldRenderers: FieldRenderers = {
  checkbox: (opts) => {
    const { label, currValue, onChange } = opts
    if (!label) throw new Error('Checkbox requires label')
    return [CheckboxField({ ...commonOpts(opts), label, currValue, onChange }), HR()].flat()
  },

  cycle: (opts) => {
    const { options, currValue, onChange } = opts
    if (!options) throw new Error('Cycle requires options')
    if (currValue === undefined) {
      throw new Error('Cycle value must be a string or null')
    }
    if (!isArrOfStrOrNull(options)) {
      throw new Error('Cycle options must be only string or null')
    }
    return [
      CycleField<string | null>({
        ...commonOpts(opts),
        onChange,
        options,
        currValue,
      }),
      HR(),
    ].flat()
  },

  chooseIcon: (opts) => {
    const { currValue, onChange } = opts
    return [ChooseIconField({ ...commonOpts(opts), currValue, onChange }), HR()].flat()
  },

  textInput: (opts) => {
    const { currValue, onChange } = opts
    return [TextInputField({ ...commonOpts(opts), currValue, onChange }), HR()].flat()
  },

  YYYMMDDDatePicker: (opts) => {
    const { currValue, onChange } = opts
    return [YYYYMMDDDatePickerField({ ...commonOpts(opts), currValue, onChange }), HR()].flat()
  },

  dateAndTimePicker: (opts) => {
    const { currValue, onChange } = opts
    return [DateAndTimePickerField({ ...commonOpts(opts), currValue, onChange }), HR()].flat()
  },

  selectMulti: (opts) => {
    const { onChange, currValue: selectedOptions, options, label } = opts
    if (!(selectedOptions && options && label)) {
      throw new Error('SelectMulti requires options, default selection, and label.')
    }
    if (!isArrOfStrOrNum(options)) {
      throw new Error('SelectMulti options must be only string or number')
    }
    return [
      SelectMultiField({
        ...commonOpts(opts),
        selectedOptions,
        options,
        label,
        onChange,
      }),
      HR(),
    ].flat()
  },

  radio: (opts) => {
    const { onChange, currValue, options, label } = opts
    if (!(options && label)) {
      throw new Error('Radio requires options and label.')
    }
    if (!isArrOfStrOrNum(options)) {
      throw new Error('Radio options must be only string or number')
    }
    return [RadioField({ ...commonOpts(opts), onChange, options, currValue, label }), HR()].flat()
  },

  dropdown: (opts) => {
    const { currValue, onChange, options } = opts
    if (!options) throw new Error('Dropdown requires options.')
    if (!isArrOfStrOrNum(options)) {
      throw new Error('Dropdown options must be only string or number')
    }
    return [
      DropdownField<string | number>({
        ...commonOpts(opts),
        onChange,
        currValue,
        options,
      }),
      HR(),
    ].flat()
  },

  readonly: (opts) => {
    const { currValue } = opts
    if (!currValue) throw new Error('Readonly field requires a current value.')
    return [ReadonlyField({ ...commonOpts(opts), value: currValue }), HR()].flat()
  },

  color: (opts) => {
    const { currValue, onChange } = opts
    return [ChooseColorField({ ...commonOpts(opts), currValue, onChange }), HR()].flat()
  },

  numberValue: (opts) => {
    const { currValue, onChange } = opts
    return [NumberField({ ...commonOpts(opts), currValue, onChange }), HR()].flat()
  },
}

export default fieldRenderers
