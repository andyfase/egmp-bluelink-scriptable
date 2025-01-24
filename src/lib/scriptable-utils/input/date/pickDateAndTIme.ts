export default async (initDate = new Date()) => {
  try {
    const dp = new DatePicker()
    dp.initialDate = initDate
    const result = await dp.pickDateAndTime()
    return result
  } catch {
    return null
  }
}
