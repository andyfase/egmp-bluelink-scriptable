import { Cell, CellShapeStyle } from './shapes'

type ImgStyle = Pick<CellShapeStyle, 'align' | 'width'>

class Img extends Cell {
  constructor(image: Image, style: ImgStyle) {
    super({
      style,
      getCellOptsWithCalibratedWidth: ({ align = 'center' }, widthWeight) => ({
        type: 'image',
        value: image,
        align,
        widthWeight,
      }),
    })
  }
}

export default (image: Image, style: ImgStyle = {}) => {
  const el = new Img(image, style)
  el.setDescription('IMAGE')
  return el
}

// TODO: add a variation `RemoteImage` that fetches the image `src` and displays
// a fallback icon while waiting.
