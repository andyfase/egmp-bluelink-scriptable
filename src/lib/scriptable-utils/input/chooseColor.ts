import { conditionalArr } from '../array'
import { colorKeys, EnhancedColor, getColor, getEnhancedColor } from '../colors'
import { getReducerCreator, getTableActionCreator } from '../reducerAction'
import { NoParamFn } from '../types/utilTypes'
import { Button, H1, Row } from '../UITable'
import getTable from '../UITable/getTable'
import textInput from './textInput'

type S = { selectedColor: EnhancedColor | 'ADD_CUSTOM' | null }

const { getState, setState, present, connect } = getTable<S>({
  name: 'chooseColor',
})

const reducer = getReducerCreator<S>()
const action = getTableActionCreator(getState, setState)

const handleSelectColor = reducer((state, selectedColor: EnhancedColor) => ({
  ...state,
  selectedColor,
}))
const selectColor = action(handleSelectColor)

const colorData = colorKeys.map(getEnhancedColor)

//

const Title = () => H1('Choose color')

const AddCustomCTA = () =>
  Button({
    text: 'Add custom',
    icon: 'add',
    dismissOnTap: true,
    onTap: () => setState({ selectedColor: 'ADD_CUSTOM' }),
  })

const IndividualColorRow = (colorData: EnhancedColor, textColor: Color, onTap: NoParamFn, dismissOnTap: boolean) => {
  const { color, label, isDynamic } = colorData
  return Row({
    content: [
      {
        text: conditionalArr([label, isDynamic && '(dynamic)'], ' '),
        color: textColor,
      },
    ],
    bgColor: color,
    rowHeight: 30,
    dismissOnTap,
    onTap,
  })
}

type ColorRowOpts = {
  colorData: EnhancedColor
  onTap: NoParamFn
  dismissOnTap?: boolean
}
export const ColorRow = ({ colorData, onTap, dismissOnTap = false }: ColorRowOpts) =>
  [
    IndividualColorRow(colorData, getColor('white'), onTap, dismissOnTap),
    IndividualColorRow(colorData, getColor('black'), onTap, dismissOnTap),
  ].flat()

const ColorRows = connect(() =>
  colorData.flatMap((color) =>
    ColorRow({
      colorData: color,
      onTap: () => selectColor(color),
      dismissOnTap: true,
    }),
  ),
)

//

export default async (): Promise<EnhancedColor | null> => {
  const { selectedColor } = await present({
    defaultState: { selectedColor: null },
    render: () => [Title(), AddCustomCTA(), ColorRows()],
  })
  if (selectedColor === 'ADD_CUSTOM') {
    const hexStr = await textInput('Enter hex w/o #')
    return hexStr ? new EnhancedColor({ label: hexStr, staticColor: new Color(hexStr) }) : null
  }
  return selectedColor
}
