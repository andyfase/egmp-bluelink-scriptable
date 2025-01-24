import { addToDate, daysBetween, formatDate, isSameDay, latestDate, stripTime } from '../../date'
import { range } from '../../object'
import { MakeSomeReqd } from '../../types/utilTypes'
import { Button, ButtonOpts, H1 } from '../../UITable/elements'
import getTable from '../../UITable/getTable'
import { HR, IconRow } from '../../UITable/Row/templates'
import { pickDate } from './pickDate'
import presetDateTime from './presetDateTime'

type Opts = {
  title?: string
  message?: string
  initialDate?: Date
  daysToInclude?: number
  minimumDate?: Date
  onSubmit?: (date: Date) => any
  onCancel?: () => any
  /** If false (default), chosen date set to midnight */
  allowTimeSelection?: boolean
}

type State = {
  startDate: Date
  chosenDate: Date | null
  useDatePicker: boolean
  useSpecificDateTimePicker: boolean
}
type Props = MakeSomeReqd<Omit<Opts, 'initialDate' | 'onSubmit' | 'onCancel'>, 'title' | 'daysToInclude'>

const DEFAULT_NUM_DAYS_TO_INCLUDE = 9

//
//
//

const { present, connect, getProps, getState } = getTable<State, Props>({
  name: 'pickRelativeDate',
})

const getDateStr = (date: Date, isToday: boolean, isTomorrow: boolean) => {
  if (isToday) return 'Today'
  if (isTomorrow) return 'Tomorrow'
  return formatDate(date, 'DDDMMMDD')
}

const formatRelativeDate = (d: Date) => {
  const NOW = new Date()
  const isToday = isSameDay(NOW, d)
  const isTomorrow = isSameDay(addToDate(NOW, { days: 1 }), d)
  const dateStr = getDateStr(d, isToday, isTomorrow)
  const incrementStr = isToday || isTomorrow ? null : `${d > NOW ? '+' : ''}${daysBetween(d, NOW)}`
  return { dateStr, incrementStr }
}

const getDateRange = (requestedStartDate: Date) => {
  const { minimumDate, daysToInclude } = getProps()
  const adjustedStartDate = minimumDate ? latestDate(minimumDate, requestedStartDate) : requestedStartDate
  return range(0, daysToInclude - 1).map((days) => addToDate(adjustedStartDate, { days }))
}

const canGoBack = () => {
  const { minimumDate } = getProps()
  return !minimumDate || getState().startDate.getTime() > minimumDate.getTime()
}

const getAdjacentStartDate = ({ goBack }: { goBack: boolean }) => {
  const { startDate } = getState()
  const { daysToInclude } = getProps()
  return addToDate(startDate, { days: (goBack ? -1 : 1) * daysToInclude })
}

//
//
//

const PickerTitle = connect(() => {
  const { title, message } = getProps()
  return H1(title, { ...(message && { subtitle: message }) })
})

const UseDatePickerCTA = connect(({ setState }) => {
  const { allowTimeSelection } = getProps()
  return Button({
    text: allowTimeSelection ? 'Choose date & time' : 'Use date picker',
    icon: 'calendar',
    dismissOnTap: true,
    onTap: () => setState(allowTimeSelection ? { useSpecificDateTimePicker: true } : { useDatePicker: true }),
  })
})

const Divider = () => HR({ dim: 0.4 })

type NavCTAOpts = Required<Pick<ButtonOpts, 'text' | 'icon' | 'onTap'>> & {
  isFaded?: boolean
}
const NavCTA = ({ text, icon, onTap, isFaded = false }: NavCTAOpts) =>
  [Button({ icon, text, isFaded, onTap }), Divider()].flat()

const PrevCTA = connect(({ setState }) => {
  const isDisabled = !canGoBack()
  return NavCTA({
    text: 'Earlier',
    icon: 'arrow_left',
    onTap: () => !isDisabled && setState({ startDate: getAdjacentStartDate({ goBack: true }) }),
    isFaded: isDisabled,
  })
})

const NextCTA = connect(({ setState }) =>
  NavCTA({
    text: 'Later',
    icon: 'arrow_right',
    onTap: () => setState({ startDate: getAdjacentStartDate({ goBack: false }) }),
  }),
)

const DateRow = connect(({ setState }, date: Date) => {
  const { dateStr, incrementStr } = formatRelativeDate(date)
  return [
    IconRow({
      text: dateStr,
      metadata: incrementStr || ' ',
      icon: 'calendar',
      onTap: () => setState({ chosenDate: date }),
      dismissOnTap: true,
    }),
    Divider(),
  ].flat()
})

const DateRows = connect(({ state: { startDate } }) => getDateRange(startDate).flatMap(DateRow))

//
//
//

const loadPropsFromOpts = ({
  title = 'Select date',
  daysToInclude = DEFAULT_NUM_DAYS_TO_INCLUDE,
  ...restOpts
}: Opts): Props => ({ title, daysToInclude, ...restOpts })

const getResult = (state: State, opts: Opts) => {
  if (state.useDatePicker) {
    return pickDate({
      initialDate: opts.minimumDate || state.startDate,
      useMinimumDate: Boolean(opts.minimumDate),
    })
  }
  if (state.useSpecificDateTimePicker) return presetDateTime()
  return state.chosenDate
}

export default async (opts: Opts = {}) => {
  const { initialDate, onSubmit = () => {}, onCancel = () => {} } = opts

  const finalState = await present({
    defaultState: {
      startDate: stripTime(initialDate || new Date()),
      chosenDate: null,
      useDatePicker: false,
      useSpecificDateTimePicker: false,
    },
    loadProps: () => loadPropsFromOpts(opts),
    render: () => [PickerTitle(), UseDatePickerCTA(), PrevCTA(), DateRows(), NextCTA()],
  })

  const result = await getResult(finalState, opts)
  await (result ? onSubmit(result) : onCancel())
  return result
}
