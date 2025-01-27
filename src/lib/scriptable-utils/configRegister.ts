/* eslint-disable @typescript-eslint/no-namespace */
import type { TimePreset } from './input/date/presetDateTime'
import type { Percent } from './UITable/elements/types'

/**
 * There are instances (for example, when private data is required) when the
 * user should provide their own configurations that are required for this
 * repository.
 */

export namespace ScreenHeightMeasurements {
  export type Mode = 'fullscreen' | 'notFullscreen'
  export type Orientation = 'portrait' | 'landscape'
  export type Record = {
    [deviceKey: string]: {
      [mode in Mode]: { [orientation in Orientation]: number }
    }
  }
}

type OptionalConfig = {
  /** `getPaginatedResults`: how many pages to iterate over before warning the user */
  GET_PAGINATED_RESULTS_MAX_LOOPS_BEFORE_WARNING: number
  /** Optionally provide exact screen height measurements, used in UI tables
   * when specifying row height as a percentage of screen height. */
  SCREEN_HEIGHT_MEASUREMENTS: ScreenHeightMeasurements.Record
  /** `fullscreenOpts`: if there are more than this number of options, the view
   * will scroll. */
  FULLSCREEN_OPTS_MAX_ON_SCREEN: number
  /** Filepath on device where non-script files are stored (e.g. the persisted
   * log, cached icons, etc) */
  SCRIPTABLE_STORE_PATH: string
  /** `PersistedLog`: the filename (without extension) where the logged values
   * are stored. */
  PERSISTED_LOG_FILENAME: string
  /** `PersistedLog`: max number of lines to store */
  PERSISTED_LOG_MAX_LINES: number
  /** The subdirectory of `SCRIPTABLE_STORE_PATH` where cached icons are stored. */
  ICON_TINTING_CACHED_ICON_PATH: string
  /** See `preloadList` */
  ICON_PRELOAD_LIST_FILENAME: string
  UI_TABLE_DEFAULT_ROW_HEIGHT: number | Percent
  /** Value to use for a cell's width when no value is supplied, and there is no
   * remaining width available via percentage calculation */
  UI_TABLE_DEFAULT_CELL_WIDTH_PERCENT: number
  /** Max milliseconds between taps to distinguish between single, double, or
   * triple taps. */
  ON_TAP_CLICK_INTERVAL: number
  /** `presetDateTime`: preset times to be shown in the dialog */
  TIME_PRESETS: TimePreset[]
}

type RequiredConfig = {
  /** Calendar titles as they exist in the Calendar app. */
  CALENDAR_TITLES: Record<'PERSONAL' | 'WORK', string>
}

export type Config = OptionalConfig & RequiredConfig

let config: OptionalConfig & Partial<RequiredConfig> = {
  GET_PAGINATED_RESULTS_MAX_LOOPS_BEFORE_WARNING: 5,
  SCREEN_HEIGHT_MEASUREMENTS: {
    [Device.model()]: {
      fullscreen: {
        landscape: Device.screenSize().height,
        portrait: Device.screenSize().height,
      },
      notFullscreen: {
        landscape: Device.screenSize().height,
        portrait: Device.screenSize().height,
      },
    },
  },
  FULLSCREEN_OPTS_MAX_ON_SCREEN: 7,
  SCRIPTABLE_STORE_PATH: '/var/mobile/Library/Mobile Documents/iCloud~dk~simonbs~Scriptable/Documents',
  PERSISTED_LOG_FILENAME: 'persistedLog',
  PERSISTED_LOG_MAX_LINES: 1000,
  ICON_TINTING_CACHED_ICON_PATH: 'img/sfsymbols',
  ICON_PRELOAD_LIST_FILENAME: 'sfSymbolPreloadList',
  UI_TABLE_DEFAULT_ROW_HEIGHT: '5%',
  UI_TABLE_DEFAULT_CELL_WIDTH_PERCENT: 10,
  ON_TAP_CLICK_INTERVAL: 200,
  TIME_PRESETS: [{ label: '9:00', targetHourOfDay: 9, icon: 'clock' }],
}

export const getConfig = <K extends keyof Config>(key: K) => {
  const value = config[key]
  if (value === undefined) {
    throw new Error(`You must register "${key}" in your implementation before using functions that depend on it.`)
  }
  return value as Config[K]
}

export const setConfig = (userConfig: Partial<Config>) => {
  config = { ...config, ...userConfig }
}
