import { getReducerCreator, getTableActionCreator } from '../../reducerAction'
import { NoParamFn } from '../../types/utilTypes'
import { Div, H1, H2, Icon, NonCascadingDiv, P, Table } from '../../UITable/elements'
import presetStyles from '../../UITable/elements/presetStyles'
import getTable from '../../UITable/getTable'
import chooseFontFamily from './chooseFontFamily'
import { getFontFamily, getItalicFont, getStaticFont, StaticFontLabel, STATIC_FONT_LABELS } from './fonts'
import { FontFamilySelection, FontWeight } from './types'

type State = {
  fontSelection?: FontFamilySelection
  size: number
  weight: FontWeight
}

//

const { getState, setState, present } = getTable<State>({
  name: 'font viewer',
})

const isStaticFontLabel = (label: FontFamilySelection): label is StaticFontLabel =>
  (STATIC_FONT_LABELS as string[]).includes(label)

//

const reducer = getReducerCreator<State>()
const action = getTableActionCreator(getState, setState)

const increaseSize = action(reducer((state) => ({ ...state, size: state.size + 1 })))

const decreaseSize = action(reducer((state) => ({ ...state, size: state.size - 1 })))

const increaseWeight = action(
  reducer((state) => ({
    ...state,
    weight: (state.weight === 900 ? 900 : state.weight + 100) as FontWeight,
  })),
)

const decreaseWeight = action(
  reducer((state) => ({
    ...state,
    weight: (state.weight === 100 ? 100 : state.weight - 100) as FontWeight,
  })),
)

const promptFontSelection = action(async (currSelection: State['fontSelection']) => {
  const newSelection = await chooseFontFamily(currSelection)
  return (state) => ({
    ...state,
    ...(newSelection && { fontSelection: newSelection }),
  })
})

//

const InfoTable = () => {
  const { size, weight, fontSelection } = getState()
  return Table({
    containerStyle: { marginTop: 0 },
    columns: { Font: { width: '50%' }, Size: {}, Weight: {} },
    rows: [
      {
        cellValues: {
          Font: fontSelection ?? 'None',
          Size: fontSelection ? (isStaticFontLabel(fontSelection) ? 'Static' : String(size)) : '',
          Weight: fontSelection
            ? isStaticFontLabel(fontSelection) || fontSelection === 'Italic'
              ? 'N/A'
              : String(weight)
            : '',
        },
      },
    ],
  })
}

const sampleText =
  'The quick brown fox jumps over the lazy dog. THE QUICK BROWN FOX JUMPS OVER THE LAZY DOG. 0123456789!@#$%^&*()'
const FontPreview = () => {
  const { size, weight, fontSelection } = getState()
  const fontGetter = fontSelection
    ? fontSelection === 'Italic'
      ? getItalicFont()
      : isStaticFontLabel(fontSelection)
        ? getStaticFont(fontSelection)
        : getFontFamily({ family: fontSelection, weight })
    : getFontFamily({ family: 'System', weight })
  return Div([P(sampleText, { font: fontGetter, fontSize: size })], {
    borderTop: 1,
    borderBottom: 1,
    height: 150,
    bgColor: presetStyles().flavors.secondary.bgColor,
    onTap: () => promptFontSelection(fontSelection),
  })
}

type IncButtonProps = {
  increment: NoParamFn
  direction: 'UP' | 'DOWN'
  isDisabled?: boolean
}
const IncButton = ({ direction, increment, isDisabled }: IncButtonProps) =>
  Div([Icon(direction === 'DOWN' ? 'chevron_down' : 'chevron_up')], {
    height: 30,
    borderTop: 1,
    borderBottom: 1,
    isFaded: isDisabled,
    onTap: () => !isDisabled && increment(),
    paddingTop: 15,
    paddingBottom: 15,
  })

const WeightControl = () => {
  const { weight, fontSelection } = getState()
  if (!fontSelection) return null
  if (isStaticFontLabel(fontSelection) || fontSelection === 'Italic') {
    return null
  }
  return NonCascadingDiv([
    H2('Weight'),
    IncButton({
      direction: 'UP',
      increment: increaseWeight,
      isDisabled: weight === 900,
    }),
    IncButton({
      direction: 'DOWN',
      increment: decreaseWeight,
      isDisabled: weight === 100,
    }),
  ])
}

const SizeControl = () => {
  const { size, fontSelection } = getState()
  if (!fontSelection) return null
  if (isStaticFontLabel(fontSelection)) return null
  return NonCascadingDiv([
    H2('Size'),
    IncButton({ direction: 'UP', increment: increaseSize }),
    IncButton({
      direction: 'DOWN',
      increment: decreaseSize,
      isDisabled: size === 1,
    }),
  ])
}

//

export default async () => {
  const { fontSelection, size, weight } = await present({
    defaultState: { size: 16, weight: 400 },
    render: () => [H1('Font viewer'), InfoTable(), FontPreview(), WeightControl(), SizeControl()],
  })
  if (!fontSelection) {
    return null
  } else if (fontSelection === 'Italic') {
    return getItalicFont(size)
  } else if (isStaticFontLabel(fontSelection)) {
    return getStaticFont(fontSelection)
  } else {
    return getFontFamily({ family: fontSelection, size, weight })
  }
}

export { getFontFamily, getItalicFont, getStaticFont } from './fonts'
