import { groupBy, isString, segment } from '../../common'
import { Entry } from '../../types/utilTypes'
import { CommonFieldOpts, CommonRowOptOpts, FormFieldsConfig, FormStateShape, NO_FIELD_SECTION } from './types'

export const getErrorMessage = ({ errorMessage, isRequired }: CommonFieldOpts, hasValue: unknown) =>
  errorMessage ?? (isRequired && !hasValue ? 'Required' : null)

type MapLabel = {
  (opts: CommonFieldOpts, label: string): string
  (opts: CommonFieldOpts, label?: string | null): string | undefined | null
}
export const mapLabel: MapLabel = ({ mapDisplayValue }, label): any => (label && mapDisplayValue?.(label)) ?? label

type GetRowOpts = Pick<CommonRowOptOpts, 'onTap' | 'onDoubleTap'> & {
  isFaded: unknown
}
export const getRowOpts = ({ isFaded, onTap, onDoubleTap }: GetRowOpts): CommonRowOptOpts => ({
  onTap,
  onDoubleTap,
  isFaded: Boolean(isFaded),
})

export const groupFieldsIntoSection = <FormState extends FormStateShape>(
  fieldEntries: Entry<FormFieldsConfig<FormState>>[],
) => {
  const sectionGroups = groupBy(fieldEntries, ([_, { section }]) => section ?? NO_FIELD_SECTION)
  return segment(sectionGroups, {
    noSectionFields: (x) => !isString(x.key),
    sectionFields: (x) => isString(x.key),
  })
}
