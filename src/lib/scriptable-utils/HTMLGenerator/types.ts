export type Element = {
  tagName: string
  classList?: string[]
  id?: string
  attributes?: AttrDictionary
  style?: AttrDictionary
  children?: Child[]
  /** Default false */
  prettify?: boolean
}

export type AttrDictionary = Record<string, string | number>

export type Child = Element | string

export type PageStyle = Record<string, AttrDictionary>
