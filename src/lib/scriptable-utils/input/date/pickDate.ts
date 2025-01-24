import { confirm } from '../confirm'

const DEFAULT_USE_MINIMUM_DATE = false

type DatePickerOpts = {
  description?: string
  initialDate?: Date
  useMinimumDate?: boolean
  onSubmit?: (d: Date) => any
  onCancel?: () => any
}

export const pickDate = async ({
  description,
  initialDate,
  useMinimumDate = DEFAULT_USE_MINIMUM_DATE,
  onCancel = () => {},
  onSubmit = () => {},
}: DatePickerOpts = {}) => {
  // Canceling a DatePicker throws an error for some reason
  try {
    if (description) {
      const isConfirmed = await confirm(description, {
        confirmButtonTitle: 'Choose date',
      })
      if (!isConfirmed) throw new Error('Cancelled')
    }

    const dp = new DatePicker()
    if (useMinimumDate) dp.minimumDate = initialDate || new Date()
    if (initialDate) dp.initialDate = initialDate
    const date = await dp.pickDate()
    await onSubmit(date)
    return date
  } catch {
    await onCancel()
    return null
  }
}
