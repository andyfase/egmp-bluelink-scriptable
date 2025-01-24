export type MaybePromise<T> = T | Promise<T>

export type MaybeArray<T> = T | T[]

/** Given a promise type, returns the type contained within the promise */
export type UnwrapPromise<T> = T extends PromiseLike<infer U> ? U : T

export type UnwrapArr<T> = T extends (infer U)[] ? U : unknown

export type RecordOfMap<T extends Map<any, any>> =
  T extends Map<infer U, infer V>
    ? // @ts-expect-error
      Record<U, V>
    : unknown

export type Nullish = null | undefined

export type NonNullish<T> = Exclude<T, Nullish>

// https://stackoverflow.com/questions/48230773/how-to-create-a-partial-like-that-requires-a-single-property-to-be-set
export type AtLeastOne<T, U = { [K in keyof T]: Pick<T, K> }> = Partial<T> & U[keyof U]

export type LabeledValue<Value, Label extends string = string> = {
  label: Label
  value: Value
}

//

type IfEquals<X, Y, A = X, B = never> = (<T>() => T extends X ? 1 : 2) extends <T>() => T extends Y ? 1 : 2 ? A : B

export type WritableKeys<T> = {
  [P in keyof T]-?: IfEquals<{ [Q in P]: T[P] }, { -readonly [Q in P]: T[P] }, P>
}[keyof T]

export type ReadonlyKeys<T> = {
  [P in keyof T]-?: IfEquals<{ [Q in P]: T[P] }, { -readonly [Q in P]: T[P] }, never, P>
}[keyof T]

//

/** Useful for cases when need to type object w/ nothing inside */
export type EmptyObject = {
  [K in any]: never
}

export type Falsy = false | null | undefined | '' | void | 0

export type NotFalsy<T> = Exclude<T, Falsy>

//

export type AnyFn = (...args: any) => any

export type NonFunctionKeys<T> = Exclude<
  {
    [K in keyof T]: T[K] extends AnyFn ? never : K
  }[keyof T],
  undefined
>

export type NonFunctionProperties<T> = Pick<T, NonFunctionKeys<T>>

export type FunctionKeys<T> = Exclude<
  {
    [K in keyof T]: T[K] extends AnyFn ? K : never
  }[keyof T],
  undefined
>

export type FunctionProperties<T> = Pick<T, FunctionKeys<T>>

/** Writable non-function keys in a type */
export type SettableKeys<T> = Exclude<NonFunctionKeys<T>, ReadonlyKeys<T>>

//

// stackoverflow.com/questions/44425344/typescript-interface-with-xor-barstring-xor-cannumber
type Without<T, U> = { [P in Exclude<keyof T, keyof U>]?: never }
export type XOR<T, U> = T | U extends AnyObj ? (Without<T, U> & U) | (Without<U, T> & T) : T | U

//

export type SortOrder = 'ASC' | 'DESC'

export type MapFn<Input, Output = unknown> = (input: Input) => Output

export type NoParamFn<Output = unknown> = () => Output

export type OptionalMapFn<Input, Output> = (input?: Input) => Output

export type Identity<T> = MapFn<T, T>

export type Predicate<T> = MapFn<T, boolean>

export type Typeguard<AssertedType extends ActualType, ActualType = any> = (val: ActualType) => val is AssertedType

export type NotUndefined<T> = Exclude<T, undefined>

export type ObjKey = string | number | symbol

export type AnyObj = Record<ObjKey, unknown>

export type ObjComparison<T, R = boolean> = (a: T, b: T) => R

/** Used to define possible actions based on entity type being actioned. */
export type ConditionalAction<E> = {
  label: string
  action: (entity: E) => MaybePromise<boolean>
  shouldRerenderOnSuccess?: boolean
  shouldShow?: (entity: E) => boolean
}

/** Used across many systems to differentiate between life domains */
export type Domain = 'personal' | 'work'

export type Align = 'left' | 'center' | 'right'

/**
 * Returns object keys that are optional
 * From https://stackoverflow.com/questions/53899692/typescript-how-to-extract-only-the-optional-keys-from-a-type
 */
export type OptionalPropertyOf<T extends Record<string, unknown>> = Exclude<
  {
    [K in keyof T]: T extends Record<K, T[K]> ? never : K
  }[keyof T],
  undefined
>
export type RequiredPropertyOf<T extends Record<string, unknown>> = Exclude<
  {
    [K in keyof T]: T extends Record<K, T[K]> ? K : never
  }[keyof T],
  undefined
>

export type NonNullishRecord<T extends Record<string, unknown>> = {
  [k in keyof T]: NonNullish<T[k]>
}

export type PartialWithNull<T extends AnyObj> = {
  [key in keyof T]: T[key] | null
}

export type PickRequired<T, K extends keyof T> = Pick<Required<T>, K>
export type PickPartial<T, K extends keyof T> = Pick<Partial<T>, K>

/** Convert some keys to be required, leaving others untouched. Can also include
 * keys to exclude from resulting type */
export type MakeSomeReqd<
  Source extends Record<string, any>,
  // Keys to convert to required
  MakeReqKeys extends keyof Source = never,
  ExcludeKeys extends keyof Source = never,
> = Omit<Source, ExcludeKeys | MakeReqKeys> & Pick<Required<Source>, MakeReqKeys>

export type MakeSomeOptional<
  T extends AnyObj,
  OptionalKeys extends keyof T,
  ExcludeKeys extends keyof T = never,
> = Omit<T, ExcludeKeys | OptionalKeys> & Pick<Partial<T>, OptionalKeys>

/** Map obj values to different key names. Optional properties in NewKeyMap will
 * be converted to optional props in the return type.
 *
 * Example, to map {first_name: string} to {firstName: string}:
 * `MapKeys<{first_name: string}, {firstName: 'first_name'}>`
 */
export type MapKeys<
  Source extends Record<string, any>,
  NewKeyMap extends Record<string, any> = never,
> = NewKeyMap extends never
  ? Source
  : {
      [newReqKey in RequiredPropertyOf<NewKeyMap>]: newReqKey extends keyof NewKeyMap
        ? Source[NewKeyMap[newReqKey]]
        : never
    } & {
      [newOptKey in OptionalPropertyOf<NewKeyMap>]?: newOptKey extends keyof NewKeyMap
        ? Source[Exclude<NewKeyMap[newOptKey], undefined>]
        : never
    } & Omit<Source, keyof { [key in keyof NewKeyMap as Required<NewKeyMap>[key]]: any }>

/** Map some of the values of existing keys to new values */
export type MapVals<
  Source extends AnyObj,
  PartialNewVals extends {
    [key in keyof Source]?: any
  },
> = Omit<Source, keyof PartialNewVals> & PartialNewVals

export type RequireAtLeastOne<T, Keys extends keyof T = keyof T> = Pick<T, Exclude<keyof T, Keys>> &
  {
    [K in Keys]-?: Required<Pick<T, K>> & Partial<Pick<T, Exclude<Keys, K>>>
  }[Keys]

export type RequireOnlyOne<T, Keys extends keyof T = keyof T> = Pick<T, Exclude<keyof T, Keys>> &
  {
    [K in Keys]-?: Required<Pick<T, K>> & Partial<Record<Exclude<Keys, K>, undefined>>
  }[Keys]

/**
 * Checks if object type `T` has at least one required attribute. If it does,
 * return type `IfTrue`, else `IfFalse`
 */
export type IfHasAtLeastOneReq<T extends AnyObj, IfTrue, IfFalse> = Partial<T> extends T ? IfFalse : IfTrue

export type ArrCallback<T, R = unknown> = (value: T, index: number, array: T[]) => R

export type ReduceCallback<SourceArrEl, Final, Return = Final> = (
  previousValue: Final,
  currentValue: SourceArrEl,
  currentIndex: number,
  array: SourceArrEl[],
) => Return

export type StreamCallback = { remove: () => void }

type _subrecordOrValue<SubKeyOrVal, SubSubKeyOrVal> = SubSubKeyOrVal extends undefined
  ? SubKeyOrVal
  : SubKeyOrVal extends ObjKey
    ? Record<SubKeyOrVal, SubSubKeyOrVal>
    : never

/**
 * Util type to define nested object structures in a concise way.
 *
 * For example, this:
 * `Record<string, Record<number, Record<string, Set<any>>>>`
 *
 * Could be rewritten as:
 * `Index<string, number, string, Set<any>>`
 */
export type Index<A extends ObjKey, B, C = undefined, D = undefined, E = undefined, F = undefined> = Record<
  A,
  _subrecordOrValue<B, _subrecordOrValue<C, _subrecordOrValue<D, _subrecordOrValue<E, F>>>>
>

/** With autosuggestion for keys */
export type Omit_<T, K extends keyof T> = Omit<T, K>
/** With autosuggestion for keys */
export type Extract_<T, U extends T> = Extract<T, U>

export type ValOf<T extends AnyObj, K extends keyof T> = T[K]

/**
 * Returns tuple from inferred Map type.
 *
 * For example:
 * ```
 * type MyMap = Map<string, boolean>;
 * type MyMapEntry = MapEntry<MyMap>;
 * // Returns `[string, boolean]`
 * ```
 */
export type MapEntry<M extends Map<any, any>> = M extends Map<infer T, infer U> ? [T, U] : never

export type Entry<T extends AnyObj> = [key: keyof T, val: T[keyof T]]

type WithoutNeverKeys<T extends AnyObj> = {
  [K in keyof T]: T[K] extends never ? never : K
}[keyof T]

export type WithoutNever<T extends AnyObj> = Pick<T, WithoutNeverKeys<T>>

export type SortFn<T> = (a: T, b: T) => number

export type PrimitiveType = bigint | boolean | null | number | string | symbol | undefined
