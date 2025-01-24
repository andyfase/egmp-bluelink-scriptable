import { isLastArrIndex } from '../../array'
import { ExcludeFalsy } from '../../common'
import { Falsy, NotFalsy } from '../../types/utilTypes'
import Div, { DivChild, DivStyle, NonCascadingDiv } from './Div'
import HSpace from './HSpace'
import Icon, { IconOrSFKey } from './Icon'
import P from './P'
import Span from './Span'

export type Detail = { text?: string; icon?: IconOrSFKey; color?: Color }

/** Allow for n-col alignment of details using arrays. `null` values in the
 * row array will be interpreted as a blank column entry. */
type ValidDetailValue = Detail | (Detail | null)[] | Falsy

type DetailCardProps = {
  title: string
  titleIcon?: IconOrSFKey
  details: ValidDetailValue[]
  titleColor?: Color
  // These will NOT cascade down, except for onTap props, as designed.
  containerStyle?: DivStyle
  contentsStyle?: DivStyle
}

const parseDetailEl = (el: NotFalsy<ValidDetailValue>) => (Array.isArray(el) ? el.map((detail) => detail ?? {}) : [el])

//

type CardContainerProps = Pick<DetailCardProps, 'containerStyle' | 'contentsStyle'>
const CardContainer = (children: DivChild[], { contentsStyle, containerStyle }: CardContainerProps) =>
  NonCascadingDiv([Div(children, contentsStyle)], containerStyle)

//

type CardTitleProps = Pick<DetailCardProps, 'title' | 'titleColor' | 'titleIcon'> & { hasDetails: boolean }
const CardTitle = ({ title, titleColor, titleIcon, hasDetails }: CardTitleProps) =>
  Div([P(title, { color: titleColor }), titleIcon && Icon(titleIcon, { width: '10%' })], {
    paddingTop: 10,
    paddingBottom: hasDetails ? 0 : 10,
  })

//

/** This accepts partial details only for the purpose of having a blank "cell"
-- fallback to invisible values. */
const DetailCells = ({ text, icon, color }: Partial<Detail>) =>
  Span([icon ? Icon(icon, { width: '8%', align: 'left' }) : HSpace('8%'), P(text ?? '', { color, isFaded: true })], {
    fontSize: 16,
  })

type DetailRowProps = {
  paddingBottom: number
  detailEl: NotFalsy<ValidDetailValue>
}
const DetailRow = ({ detailEl, paddingBottom }: DetailRowProps) =>
  Div(parseDetailEl(detailEl).map(DetailCells), { paddingBottom, height: 32 })

//

export default ({ details, title, titleColor, containerStyle, titleIcon, contentsStyle }: DetailCardProps) => {
  const validDetails = details.filter(ExcludeFalsy)
  return CardContainer(
    [
      CardTitle({
        title,
        titleColor,
        titleIcon,
        hasDetails: validDetails.length > 0,
      }),

      ...validDetails.map((el, i, arr) => {
        const paddingBottom = isLastArrIndex(i, arr) ? 10 : 0
        return DetailRow({ detailEl: el, paddingBottom })
      }),
    ],
    { containerStyle, contentsStyle },
  )
}
