import { getColors } from '../../colors'
import { Div, Icon, P } from '../../UITable/elements'
import { ErrorRowOpts, LabelRowOpts, MultiOptionRowOpts, StandardRowOpts, ValueRowOpts } from './types'

const { danger } = getColors()

const LabelRow = ({ fieldLabel, rowOpts }: LabelRowOpts) => {
  if (!fieldLabel) return null
  return Div([P(fieldLabel, { font: () => Font.footnote() })], {
    height: 14,
    paddingTop: 10,
    ...rowOpts,
  })
}

const ValueRow = ({
  valueRowLabel,
  icon,
  fieldLabel,
  showErrorIndicator,
  showClearIndicator,
  rowOpts,
  bgColor,
}: ValueRowOpts) => {
  return Div(
    [
      P(valueRowLabel),
      showClearIndicator && Icon('x_in_circle', { width: '10%' }),
      showErrorIndicator && Icon('circled_exclamation_filled', { width: '10%', doNotTint: true }),
      icon && Icon(icon, { width: '10%' }),
    ],
    {
      height: 37,
      ...rowOpts,
      paddingBottom: showErrorIndicator ? 0 : 5,
      paddingTop: fieldLabel ? 0 : 5,
      bgColor,
    },
  )
}

const ErrorRow = ({ rowOpts: { onTap }, errorMessage }: ErrorRowOpts) =>
  errorMessage &&
  Div([P(errorMessage, { color: danger })], {
    marginBottom: 0,
    height: 14,
    font: () => Font.footnote(),
    onTap,
    paddingBottom: 10,
  })

//
//
//

export const StandardFieldRow = ({ labelOpts, valueOpts, errorOpts, divOpts }: StandardRowOpts) => {
  const labelRow = labelOpts && LabelRow(labelOpts)
  const errorRow = ErrorRow({ ...errorOpts, isAboveValueRows: false })
  return Div([labelRow, ValueRow({ ...valueOpts, fieldLabel: labelOpts?.fieldLabel }), errorRow], divOpts)
}

export const MultiOptionRow = ({ labelOpts, valueOpts, errorOpts, divOpts }: MultiOptionRowOpts) =>
  Div(
    [
      LabelRow(labelOpts),
      ErrorRow({ ...errorOpts, isAboveValueRows: true }),
      ...valueOpts.flatMap((opts) => ValueRow({ ...opts, showErrorIndicator: false })),
    ],
    divOpts,
  )
