// Used to select preset date/time (e.g. Wake up, Lunch, etc), or select a
// specific date/time manually

import { getConfig } from '../../configRegister'
import { addToDate, stripTime } from '../../date'
import { SFSymbolKey } from '../../sfSymbols'
import { Button, H1 } from '../../UITable/elements'
import getTable from '../../UITable/getTable'
import { TwoCol } from '../../UITable/Row/templates'
import pickDateAndTIme from './pickDateAndTIme'

type State = {
  result: Date | 'CHOOSE_SPECIFIC' | null
}

export type TimePreset = {
  label: string
  targetHourOfDay: number
  icon: SFSymbolKey
}

//

const { present, connect } = getTable<State>({ name: 'presetDateTime' })

const getPresetDate = (hours: number) => {
  const NOW = new Date()
  const currHours = NOW.getHours()
  const strippedTime = stripTime(NOW)
  return addToDate(strippedTime, { days: currHours < hours ? 0 : 1, hours })
}

//

const ChooseSpecificCTA = connect(({ setState }) =>
  Button({
    text: 'Choose date & time',
    icon: 'calendar',
    dismissOnTap: true,
    onTap: () => setState({ result: 'CHOOSE_SPECIFIC' }),
  }),
)

const PresetOption = connect(({ setState }, { label, icon, targetHourOfDay }: TimePreset) =>
  TwoCol({
    gutterLeft: { iconKey: icon },
    main: { text: label, textSize: 'md' },
    padding: { paddingBottom: 'md', paddingTop: 'md' },
    rowHeight: 'md',
    dismissOnTap: true,
    onTap: () => setState({ result: getPresetDate(targetHourOfDay) }),
  }),
)

//

export default async () => {
  const { result } = await present({
    defaultState: { result: null },
    render: () => [
      H1('Choose specific date & time'),
      ChooseSpecificCTA(),
      ...getConfig('TIME_PRESETS').flatMap(PresetOption),
    ],
  })

  if (result === 'CHOOSE_SPECIFIC') return pickDateAndTIme()
  return result
}
