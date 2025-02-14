import { conditionalArr, hasLength } from '../../array'
import { isFunc, isString } from '../../common'
import { isIn } from '../../flow'
import { objectEntries } from '../../object'
import { Entry } from '../../types/utilTypes'
import { Button, HR } from '../../UITable/elements'
import presetStyles from '../../UITable/elements/presetStyles'
import getTable from '../../UITable/getTable'
import { H1, H2, Spacer } from '../../UITable/Row/templates'
import fieldRenderers from './fieldRenderers'
import {
  Editing,
  FieldOpts,
  FieldType,
  FormFieldsConfig,
  FormOpts,
  FormStateShape,
  NoFieldSectionSymbol,
  NO_FIELD_SECTION,
} from './types'
import { groupFieldsIntoSection } from './utils'

export * from './fieldRows'

export default <CompleteFormState extends FormStateShape>(
  optsOrOptsGetter:
    | FormOpts<CompleteFormState>
    | ((currState: Editing<CompleteFormState>) => FormOpts<CompleteFormState>),
) => {
  type State = { formState: Editing<CompleteFormState>; didSubmit: boolean }
  type Props = { initState: Editing<CompleteFormState> }

  const { connect, present, getState, setState } = getTable<State, Props>({
    name: 'form',
  })

  const getOpts = (state: Editing<CompleteFormState>) =>
    isFunc(optsOrOptsGetter) ? optsOrOptsGetter(state) : optsOrOptsGetter

  //

  const Title = connect(({ state: { formState } }) => {
    const { title, subtitle } = getOpts(formState)
    return H1({ title, subtitle })
  })

  const FieldRow = <T extends FieldType, K extends keyof CompleteFormState>(
    key: K,
    { type, getErrorMessage, isClearable = false, shouldHide, ...rest }: FieldOpts<T, CompleteFormState, K>,
  ) => {
    const { formState } = getState()
    if (shouldHide?.(formState)) return null
    const renderer = fieldRenderers[type]
    const errorMessage = getErrorMessage?.(formState)
    return renderer({
      currValue: formState[key],
      onChange: (newVal) => {
        if (!isClearable && isIn(newVal, [null, undefined])) return
        const { formState: previousState } = getState()
        const userUpdatedState: Editing<CompleteFormState> = {
          ...previousState,
          [key]: newVal,
        }
        const withStateChangeHook =
          getOpts(userUpdatedState).onStateChange?.(userUpdatedState, previousState) ?? userUpdatedState
        setState({ formState: withStateChangeHook })
      },
      isClearable,
      ...(errorMessage && { errorMessage }),
      ...rest,
    })
  }

  const FieldSection = connect(
    (_, section: string | NoFieldSectionSymbol, fieldEntries: Entry<FormFieldsConfig<CompleteFormState>>[]) =>
      [
        isString(section) && H2({ label: section, marginTop: 20 }),
        HR(),
        ...fieldEntries.flatMap(([key, opts]) => FieldRow(key, opts)),
      ].flat(),
  )

  const FieldRows = connect(({ state: { formState } }) => {
    const { fields } = getOpts(formState)
    const { noSectionFields, sectionFields } = groupFieldsIntoSection(objectEntries(fields))
    return conditionalArr([
      hasLength(noSectionFields) && FieldSection(NO_FIELD_SECTION, noSectionFields[0].val),
      ...sectionFields.flatMap(({ key: section, val }) => FieldSection(section, val)),
    ]).flat()
  })

  const Submit = connect(({ state: { formState } }) => {
    const { isFormValid, onSubmit, submitButtonText = 'Save' } = getOpts(formState)
    const isValid = !isFormValid || isFormValid(formState)
    return Button({
      ...presetStyles().flavors.primary,
      text: submitButtonText,
      icon: 'checkmark',
      isDisabled: !isValid,
      dismissOnTap: true,
      isLarge: false,
      onTap: () => {
        setState({ didSubmit: true })
        onSubmit?.(formState)
      },
    })
  })

  //

  return async (initState: Editing<CompleteFormState> = {}) => {
    const { formState, didSubmit } = await present({
      shouldPreloadIcons: true,
      defaultState: { formState: initState, didSubmit: false },
      loadProps: () => ({ initState }),
      render: () => [Title(), Spacer(), FieldRows(), Spacer(), Spacer(), Submit()],
    })
    return {
      formState,
      isValid: getOpts(formState).isFormValid?.(formState) ?? null,
      submitted: didSubmit,
      cancelled: !didSubmit,
    }
  }
}
