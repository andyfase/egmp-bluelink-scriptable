import { NoParamFn } from '../types/utilTypes'

export type Preview = { description?: string; showPreview: NoParamFn }

export type SubHierarchy = Record<string, Preview | Parent<any>>

export type Parent<T extends SubHierarchy> = {
  description?: string
  children: T
}

export type PreviewHierarchy = {
  input: Parent<{
    chooseColor: Preview
    chooseFont: Preview
    chooseSFSymbol: Preview
    confirm: Preview
    destructiveConfirm: Preview
    OK: Preview
    'Date input': Parent<{
      pickDate: Preview
      pickDateAndTime: Preview
      pickRelativeDate: Preview
    }>
    'Form input': Parent<{
      form: Preview
      Checkbox: Preview
      ChooseColor: Preview
      ChooseIcon: Preview
      Cycle: Preview
      DateAndTimePicker: Preview
      Dropdown: Preview
      Number: Preview
      Radio: Preview
      SelectMulti: Preview
      TextArea: Preview
      TextInput: Preview
      YYYYMMDDDatePicker: Preview
    }>
    listChoose: Preview
    quickOptions: Preview
    textArea: Preview
    textInput: Preview
  }>
  UITable: Parent<{
    Button: Preview
    DetailCard: Preview
    H1: Preview
    H2: Preview
    P: Preview
    ProgressBar: Preview
    ThreeCol: Preview
    Table: Preview
    Toast: Preview
  }>
}
