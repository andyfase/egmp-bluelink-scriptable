import { filter, toArray } from './arrayTransducers'
import { addToDate, getAllEventCals } from './date'
import persisted from './io/persisted'

export const calBlacklistTitles = persisted<string[]>({
  filename: 'calBlacklistTitles',
  defaultData: [],
})

export const initEventBlacklistCache = () => calBlacklistTitles.getData()

export const excludeBlacklistedEvents = () =>
  filter((event: CalendarEvent) => !calBlacklistTitles.has({ item: event.title, useCache: true }))

export const getEventsBetweenNowAndXDays = async (x: number) => {
  const NOW = new Date()
  const allCals = await getAllEventCals()
  const inXDays = addToDate(NOW, { days: x })
  const startDate = x <= 0 ? inXDays : NOW
  const endDate = x <= 0 ? NOW : inXDays
  await initEventBlacklistCache()
  return toArray(await CalendarEvent.between(startDate, endDate, allCals), excludeBlacklistedEvents())
}
