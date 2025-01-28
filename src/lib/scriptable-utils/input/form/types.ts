import { EnhancedColor } from '../../colors'
import { SFSymbolKey } from '../../sfSymbols'
import { AnyObj, Falsy, MapFn, NotUndefined, Omit_, Predicate } from '../../types/utilTypes'
import { RowOpts } from '../../UITable/Row/types'
import { ValidTableEl } from '../../UITable/types'

type FieldTypeToSupportedValue = {
  cycle: string | null
  checkbox: boolean
  chooseIcon: SFSymbolKey
  textInput: string
  YYYMMDDDatePicker: string
  dateAndTimePicker: Date
  selectMulti: (string | number)[]
  radio: string | number
  dropdown: string | number
  readonly: string
  color: EnhancedColor
  numberValue: number
}

export type FieldType = keyof FieldTypeToSupportedValue

/** Type can always be undefined, as the form may be empty. */
export type ValidFieldValue<T extends FieldType> = FieldTypeToSupportedValue[T] | undefined

export type FormStateShape = Record<string, any>

export type Editing<FormState extends FormStateShape> = Partial<FormState>

type Options<T> = NotUndefined<T> extends any[] ? NotUndefined<T> : NotUndefined<T>[]

export type FieldOpts<T extends FieldType, FormState extends FormStateShape, K extends keyof FormState> = {
  type: T
  /** Default false. Not applicable to all field types. */
  isClearable?: boolean
  label?: string
  shouldHide?: Predicate<Editing<FormState>>

  getErrorMessage?: MapFn<Editing<FormState>, string | Falsy>
  /** Required for some types (e.g. cycle), not used for others. */
  options?: Options<FormState[K]>
  /** Not used for some, e.g. checkbox */
  customIcon?: SFSymbolKey
  /** If the display value of the field value should appear different than its
   * actual value, e.g. capitalization. */
  mapDisplayValue?: (displayValue: string) => string
  isRequired?: boolean
  // If no form section provided, put it in the ungrouped section at the top
  section?: string
  // Specifically for dropdown. TODO: eventually, would be nice to have opts
  // specific to each kind of input element. This is a bit lazy
  allowCustom?: boolean
  secure?: boolean
}

export type FieldRenderOpts<T extends FieldType> = Pick<
  FieldOpts<T, AnyObj, string>,
  'isClearable' | 'label' | 'options' | 'customIcon' | 'mapDisplayValue' | 'isRequired' | 'allowCustom' | 'secure'
> & {
  currValue: ValidFieldValue<T>
  /** This allows passing `undefined`, but this should not be allowed if
   * `isClearable` is false. The `FieldOperator` doesn't have to care about this
   * though. */
  onChange: MapFn<ValidFieldValue<T>>
  errorMessage?: string
}

export type FieldRenderer<T extends FieldType> = MapFn<FieldRenderOpts<T>, ValidTableEl>

export type FormFieldsConfig<FormState extends FormStateShape> = {
  [key in keyof FormState]: FieldOpts<FieldType, FormState, key>
}

export type FormOpts<FormState extends FormStateShape> = {
  title: string
  fields: FormFieldsConfig<FormState>
  subtitle?: string
  isFormValid?: MapFn<Editing<FormState>, boolean>
  submitButtonText?: string
  onSubmit?: MapFn<Editing<FormState>>
  /** Run after every user interaction. Useful if e.g. some form fields should
   * change based on the state of other fields. If the function returns state,
   * the form's state will be refreshed. If null is returned nothing happens. */
  onStateChange?: (state: Editing<FormState>, previousState: Editing<FormState>) => Editing<FormState> | null
}

export type CommonRowOptOpts = Pick<RowOpts, 'isFaded' | 'onTap' | 'onDoubleTap'>

export type LabelRowOpts = { fieldLabel?: string; rowOpts: CommonRowOptOpts }

export type ValueRowOpts = {
  fieldLabel?: string
  valueRowLabel: string
  icon?: SFSymbolKey
  /** This should be true for single-option fields only */
  showErrorIndicator?: boolean
  showClearIndicator?: boolean
  rowOpts: CommonRowOptOpts
  bgColor?: Color
}

export type ErrorRowOpts = {
  /** For some configurations, the error is shown above the options. In that
   * case the padding is adjusted. */
  isAboveValueRows: boolean
  errorMessage: string | null
  rowOpts: CommonRowOptOpts
}

export type StandardRowOpts = {
  labelOpts?: LabelRowOpts
  valueOpts: ValueRowOpts
  errorOpts: Omit_<ErrorRowOpts, 'isAboveValueRows'>
}

export type MultiOptionRowValueOpt = Omit_<ValueRowOpts, 'showErrorIndicator'>

export type MultiOptionRowOpts = {
  labelOpts: LabelRowOpts
  valueOpts: MultiOptionRowValueOpt[]
  errorOpts: Omit_<ErrorRowOpts, 'isAboveValueRows'>
}

export type CommonFieldOpts = Pick<
  FieldRenderOpts<any>,
  'errorMessage' | 'label' | 'customIcon' | 'mapDisplayValue' | 'isRequired' | 'allowCustom' | 'isClearable' | 'secure'
>

export const NO_FIELD_SECTION = Symbol('NO_FIELD_SECTION')
export type NoFieldSectionSymbol = typeof NO_FIELD_SECTION
