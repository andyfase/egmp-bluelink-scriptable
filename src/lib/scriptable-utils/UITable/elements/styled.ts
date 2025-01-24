import Button, { ButtonOpts } from './Button'
import Div, { DivSignature, DivStyle, NonCascadingDiv, NonCascadingDivSignature } from './Div'

export default {
  Div:
    (styledOpts: DivStyle): DivSignature =>
    (children, opts = {}) =>
      Div(children, { ...styledOpts, ...opts }),

  NonCascadingDiv:
    (styledOpts: DivStyle): NonCascadingDivSignature =>
    (children, opts = {}) =>
      NonCascadingDiv(children, { ...styledOpts, ...opts }),

  Button: (styledOpts: Partial<ButtonOpts>) => (opts: ButtonOpts) => Button({ ...styledOpts, ...opts }),
}
