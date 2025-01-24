import { isString } from '../common'
import { LabeledValue, ObjComparison } from '../types/utilTypes'
import { Container, Div, getTable, H1, Icon, P } from '../UITable'

type Option<Label extends string, Value> = Label | LabeledValue<Value, Label>

type Config<Label extends string, Value> = {
  title?: string
  subtitle?: string
  initValues?: Option<Label, Value>[]
  /** If `Value` is not a primitive type, optionally specify an equality
   * function */
  areValuesEqual?: ObjComparison<Value>
}

const getValue = <Label extends string, Value>(option: Option<Label, Value>): Value =>
  isString(option) ? (option as unknown as Value) : option.value

const doesOptionMatchValue = <Label extends string, Value>(
  option: Option<Label, Value>,
  value: Value,
  areValuesEqual: ObjComparison<Value>,
) => areValuesEqual(value, getValue(option))

const toggleValueItem = <Value>(arr: Value[], value: Value, areValuesEqual: ObjComparison<Value>) => {
  const hasValue = arr.some((v) => areValuesEqual(v, value))
  return hasValue ? arr.filter((v) => !areValuesEqual(v, value)) : [...arr, value]
}

export const listChooseMany = async <Label extends string, Value = Label>(
  options: Option<Label, Value>[],
  {
    initValues = [],
    title = 'Select options',
    subtitle,
    areValuesEqual = (a, b) => a === b,
  }: Config<Label, Value> = {},
): Promise<Value[]> => {
  type State = { selectedValues: Value[] }

  const { present, connect } = getTable<State>({
    name: `listChooseMany_${UUID.string()}`,
  })

  //

  const Title = () => H1(title, { subtitle })

  const OptionRow = connect(({ state: { selectedValues }, setState }, option: Option<Label, Value>) => {
    const isSelected = selectedValues.some((value) => doesOptionMatchValue(option, value, areValuesEqual))
    const label = isString(option) ? option : option.label
    return Div(
      [
        P(label),
        Icon(isSelected ? 'task_complete' : 'task_incomplete', {
          width: '7%',
        }),
      ],
      {
        isFaded: !isSelected,
        paddingTop: 10,
        paddingBottom: 10,
        borderTop: 1,
        borderBottom: 1,
        onTap: () =>
          setState({
            selectedValues: toggleValueItem(selectedValues, getValue(option), areValuesEqual),
          }),
      },
    )
  })

  //

  const { selectedValues } = await present({
    defaultState: { selectedValues: initValues.map(getValue) },
    render: () => [Title(), Div(options.map(OptionRow) as Container[])],
  })
  return selectedValues
}
