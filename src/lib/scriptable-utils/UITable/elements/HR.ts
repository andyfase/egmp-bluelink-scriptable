import { getColor } from '../../colors'
import { Omit_ } from '../../types/utilTypes'
import { Container, ContainerStyle } from './shapes'

type HRStyle = Pick<ContainerStyle, 'bgColor' | 'height' | 'marginBottom' | 'marginTop'>

class HR extends Container {
  constructor(style: HRStyle) {
    super([], style, {})
    this.setDescription('HR')
  }

  /** Fallback values need to be applied at render, otherwise they break
   * cascading properties. */
  render() {
    const { bgColor = getColor('hr'), height = 1, marginTop = 8, marginBottom = 8 } = this.style
    this.style = { ...this.style, bgColor, height, marginTop, marginBottom }
    return super.render()
  }
}

/** User thinks of it as `color`, not `bgColor` (which is just an implementation
 * detail.) */
type ExposedStyle = Omit_<HRStyle, 'bgColor'> & { color?: Color }

export default ({ color: bgColor, ...rest }: ExposedStyle = {}) => new HR({ bgColor, ...rest })
