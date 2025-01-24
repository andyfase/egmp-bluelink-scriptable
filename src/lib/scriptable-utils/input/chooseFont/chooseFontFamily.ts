import { Div, Gradient, H1, Icon, P } from '../../UITable/elements'
import { DivChild, NonCascadingDiv } from '../../UITable/elements/Div'
import presetStyles from '../../UITable/elements/presetStyles'
import getTable from '../../UITable/getTable'
import { getFontFamily, getItalicFont, getStaticFont, STATIC_FONT_LABELS } from './fonts'
import { fontFamilyNames, FontFamilySelection, FontGetter } from './types'

type State = { selection: FontFamilySelection | null }

const { getState, setState, present } = getTable<State>({
  name: 'chooseFontFamily',
})

//

const Option = (selection: FontFamilySelection, fontGetter: FontGetter) => {
  const isSelected = getState().selection === selection
  return Div([P(selection, { font: fontGetter, fontSize: 30 }), isSelected && Icon('checkmark', { width: '5%' })], {
    onTap: () => setState({ selection }),
    dismissOnTap: true,
    borderTop: 1,
    borderBottom: 1,
    height: 50,
    paddingTop: 10,
    paddingBottom: 10,
  })
}

const OptionCategoryContainer = (title: string, options: DivChild[], isFirst?: boolean) => {
  const bgColor = presetStyles().flavors.secondary.bgColor!
  return NonCascadingDiv(
    [
      Div([H1(`${title}:`)], { bgColor }),
      ...options,
      Gradient({
        from: bgColor,
        mode: 'DOWN',
        stepOptions: { stepRowHeight: 3 },
      }),
    ],
    { paddingTop: 10, bgColor, ...(!isFirst && { marginTop: 30 }) },
  )
}

const FontFamilyOptions = () =>
  OptionCategoryContainer(
    'Font families',
    [...fontFamilyNames.map((family) => Option(family, getFontFamily({ family }))), Option('Italic', getItalicFont())],
    true,
  )

const StaticFontOptions = () =>
  OptionCategoryContainer(
    'Static fonts',
    STATIC_FONT_LABELS.map((staticLabel) => Option(staticLabel, getStaticFont(staticLabel))),
  )

//

export default async (initValue?: FontFamilySelection) => {
  const { selection } = await present({
    defaultState: { selection: initValue ?? null },
    render: () => [FontFamilyOptions(), StaticFontOptions()],
  })
  return selection
}
