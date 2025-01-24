import form from '../input/form'
import { FieldType } from '../input/form/types'
import { getTable, ValidTableEl } from '../UITable'

export const popup = (content: ValidTableEl) => getTable({ name: UUID.string() }).present({ render: () => [content] })

type SingleFormFieldOpts = { label: string; type: FieldType }
export const singleFieldForm = ({ label, type }: SingleFormFieldOpts) =>
  form<{ val: any }>({
    title: 'My form',
    fields: { val: { type, label } },
  })()
