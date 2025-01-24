import { compose, filter, map, toArray } from './arrayTransducers'
import { getDomainColor } from './colors'
import { ExcludeFalsy } from './common'
import { getConfig } from './configRegister'
import { range } from './object'
import { pluralize } from './string'
import { Domain, Identity, MapFn } from './types/utilTypes'

const ONE_MILLISECOND = 1
export const ONE_SECOND = ONE_MILLISECOND * 1000
export const ONE_MINUTE = ONE_SECOND * 60
export const ONE_HOUR = ONE_MINUTE * 60

//
// HELPERS
//

/** Round date down to 00:00, useful for grouping by date. Optionally set h/m/s/ms */
export const stripTime = (dateObj = new Date(), { hours = 0, minutes = 0, seconds = 0, ms = 0 } = {}) => {
  const newDate = new Date(dateObj)
  newDate.setHours(hours, minutes, seconds, ms)
  return newDate
}

export const msBetween = (laterDate: Date, earlierDate: Date) => laterDate.getTime() - earlierDate.getTime()

export const latestDate = (d1: Date, d2: Date) => new Date(Math.max(d1.getTime(), d2.getTime()))

const getTimeUnitBetween = (unitInMs: number) => (laterDate: Date, earlierDate: Date) =>
  Math.floor(msBetween(laterDate, earlierDate) / unitInMs)

export const hoursBetween = getTimeUnitBetween(ONE_HOUR)

export const daysBetween = getTimeUnitBetween(24 * ONE_HOUR)

/** Check if day, month, and year are the same for 2 dates. Can not use === on date objects */
export const isSameDay = (d1: Date, d2: Date) =>
  d1.getFullYear() === d2.getFullYear() && d1.getMonth() === d2.getMonth() && d1.getDate() === d2.getDate()

const formatter: Identity<MapFn<Date, string>> = (x) => x
const HHMM = formatter((date) =>
  [String(date.getHours()).padStart(2, '0'), String(date.getMinutes()).padStart(2, '0')].join(':'),
)
const DATE_FORMATTER_MAP = {
  YYYYMMDD: formatter((date) =>
    [
      date.toLocaleDateString(undefined, { year: 'numeric' }),
      date.toLocaleDateString(undefined, { month: '2-digit' }),
      date.toLocaleDateString(undefined, { day: '2-digit' }),
    ].join('-'),
  ),
  HHMM,
  HHMMSS: formatter((date) => [HHMM(date), String(date.getSeconds()).padStart(2, '0')].join(':')),
  HHMMSSMMM: formatter((date) =>
    [HHMM, String(date.getSeconds()).padStart(2, '0'), String(date.getMilliseconds()).padStart(3, '0')].join(':'),
  ),
  DDDMMMDD: formatter((date) =>
    date.toLocaleDateString(undefined, {
      weekday: 'short',
      month: 'short',
      day: '2-digit',
    }),
  ),
  MMMDD: formatter((date) => date.toLocaleDateString(undefined, { month: 'short', day: '2-digit' })),
  MMDDNum: formatter((date) => date.toLocaleDateString(undefined, { month: '2-digit', day: '2-digit' })),
  MMDDYY: formatter((date) => `${date.getMonth() + 1}/${date.getDate()}/${String(date.getFullYear()).slice(2)}`),
  MMDDYYWithPadding: formatter((date) =>
    date.toLocaleDateString(undefined, {
      month: '2-digit',
      day: '2-digit',
      year: '2-digit',
    }),
  ),
  shortMMDDYY: formatter((date) =>
    date.toLocaleDateString(undefined, {
      year: '2-digit',
      month: 'numeric',
      day: 'numeric',
    }),
  ),
  dayOfWeekNameFull: formatter((date) => date.toLocaleString('en-us', { weekday: 'long' })),
  dayOfWeekNameShort: formatter((date) => date.toLocaleString('en-us', { weekday: 'short' })),
  // December 9, 2022, 13:40
  longDateAndTime: formatter((date) =>
    date.toLocaleDateString(undefined, {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }),
  ),
}

export const formatDate = (date: Date, format: keyof typeof DATE_FORMATTER_MAP) => DATE_FORMATTER_MAP[format](date)

export const addToDate = (date: Date, { months = 0, days = 0, hours = 0, minutes = 0, seconds = 0, ms = 0 } = {}) => {
  const dateClone = new Date(date)
  dateClone.setMonth(date.getMonth() + months)
  dateClone.setDate(date.getDate() + days)
  dateClone.setHours(
    date.getHours() + hours,
    date.getMinutes() + minutes,
    date.getSeconds() + seconds,
    date.getMilliseconds() + ms,
  )
  return dateClone
}

export const isWeekend = (date = new Date()) => ['Sat', 'Sun'].includes(formatDate(date, 'dayOfWeekNameShort'))

export const getSubsequentDayOfWeek = (shortDayName: string, startDate = new Date()): Date => {
  if (formatDate(startDate, 'dayOfWeekNameShort') === shortDayName) return stripTime(startDate)
  return getSubsequentDayOfWeek(shortDayName, addToDate(startDate, { days: 1 }))
}

/** Input startDate & num days in range, get back an array of dates in YYYYMMDD format */

export const getIsoDateRange = (startDate: Date, numDays: number) =>
  range(0, numDays - 1).map((daysToAdd) => formatDate(addToDate(startDate, { days: daysToAdd }), 'YYYYMMDD'))

/** Return legible string, e.g. "10 seconds", "5 minutes", "1 hour 4 minutes", etc. */
export const readableMs = (ms: number, { includeSeconds = true, useAbbrev = false } = {}) => {
  const numSeconds = ms / 1000
  const numMinutes = numSeconds / 60
  const numHours = numMinutes / 60
  const h = Math.floor(numHours)
  const m = Math.floor(numMinutes % 60)
  const s = Math.floor(numSeconds % 60)

  if (numSeconds >= 1) {
    const hLabel = useAbbrev ? 'h' : pluralize('hour', h)
    const mLabel = useAbbrev ? 'm' : pluralize('minute', m)
    const sLabel = useAbbrev ? 's' : pluralize('second', s)
    const numLabelSeparator = useAbbrev ? '' : ' '
    return [
      numHours >= 1 && `${h}${numLabelSeparator}${hLabel}`,
      numMinutes >= 1 && `${m}${numLabelSeparator}${mLabel}`,
      includeSeconds && `${s}${numLabelSeparator}${sLabel}`,
    ]
      .filter(Boolean)
      .join(', ')
  }
  return includeSeconds ? '0 seconds' : ''
}

const getReadableDaysLabel = (dayGap: number, abbreviate: boolean) => {
  switch (dayGap) {
    case 0:
      return abbreviate ? 'Tod.' : 'Today'
    case 1:
      return abbreviate ? 'Tom.' : 'Tomorrow'
    case -1:
      return abbreviate ? 'Yest.' : 'Yesterday'
    default:
      return null
  }
}

export const UTCToPacific = (date: Date) => addToDate(date, { hours: 8 })

export const getReadableDaysFromNowLabel = (date: Date, abbreviate = false) => {
  const daysFromNow = daysBetween(stripTime(date), stripTime())
  return getReadableDaysLabel(daysFromNow, abbreviate)
}

export const readableDaysBetween = (laterDate: Date, earlierDate: Date, abbreviate = false) => {
  const days = daysBetween(earlierDate, laterDate)
  return getReadableDaysLabel(days, abbreviate) || `${days}d`
}

export const areDatesEqual = (d1: Date, d2: Date) => d1.getTime() === d2.getTime()

//
// CALENDAR FUNCTIONS
//

export const getCalDomain = (cal: Calendar): Domain | null => {
  const { PERSONAL, WORK } = getConfig('CALENDAR_TITLES')
  switch (cal.title) {
    case PERSONAL:
      return 'personal'
    case WORK:
      return 'work'
    default:
      return null
  }
}

export const getPrimaryCalColor = (cal: Calendar): Color => {
  const domain = getCalDomain(cal)
  if (!domain) throw new Error('No cal color')
  return getDomainColor(domain)
}

export const getEventDomain = (event: CalendarEvent): Domain => {
  const { title: calTitle } = event.calendar
  const calendars = getConfig('CALENDAR_TITLES')
  if (!Object.values(calendars).includes(calTitle)) throw new Error('Events in non-domain calendars have no domain!')
  return calTitle === calendars.PERSONAL ? 'personal' : 'work'
}

export const getAllEventCals = () =>
  Promise.all(
    toArray(
      Object.values(getConfig('CALENDAR_TITLES')),
      compose(
        filter(ExcludeFalsy),
        map((title) => Calendar.forEventsByTitle(title)),
      ),
    ),
  )

/** Get all events within x days in the past or future from now */
export const getEventsInXDayRadius = async (x: number) => {
  const NOW = new Date()
  const allCals = await getAllEventCals()
  const startDate = addToDate(NOW, { days: -1 * x })
  const endDate = addToDate(NOW, { days: x })
  return CalendarEvent.between(startDate, endDate, allCals)
}

export const getTodayEvents = async () => {
  const allCals = await getAllEventCals()
  return CalendarEvent.today(allCals)
}

type EventWithStatus = {
  event: CalendarEvent
  isCompleted: boolean
  isOngoing: boolean
  isFuture: boolean
}
export const enhanceCalEventsWithStatus = () => {
  const NOW = new Date()
  return map(
    (event: CalendarEvent): EventWithStatus => ({
      event,
      isCompleted: event.endDate < NOW,
      isOngoing: event.startDate <= NOW && event.endDate >= NOW,
      isFuture: event.startDate > NOW,
    }),
  )
}

/** Using this function avoids timezone issues that happen with `new Date(YYYY-MM-DD)` */
export const YYYYMMDDToDate = (dateString: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
    throw new Error(`Passed date string ${dateString}, which is not correctly formatted`)
  }
  const atoms = dateString.split('-')
  const year = Number.parseInt(atoms[0]!)
  const month = Number.parseInt(atoms[1]!)
  const day = Number.parseInt(atoms[2]!)
  const date = new Date()
  date.setFullYear(year, month - 1, day)
  return stripTime(date)
}
