import { SizeConfig, _INTERNAL_ButtonOpts } from './types'

const defaultSizeConfig: SizeConfig = {
  rowHeight: 'lg',
  textSize: 'md',
  padding: 'md',
}
const smallSizeConfig: SizeConfig = {
  rowHeight: 'sm',
  textSize: 'sm',
  padding: 'sm',
}
const largeSizeConfig: SizeConfig = {
  rowHeight: 'lg',
  textSize: 'lg',
  padding: 'lg',
}

export const getSizeConfig = ({
  isSmall = false,
  isLarge = false,
}: Pick<_INTERNAL_ButtonOpts, 'isSmall' | 'isLarge'>) => {
  if (isSmall) return smallSizeConfig
  return isLarge ? largeSizeConfig : defaultSizeConfig
}
