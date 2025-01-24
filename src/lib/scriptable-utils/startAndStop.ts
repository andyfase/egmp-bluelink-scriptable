import { Config, setConfig } from './configRegister'
import { killAllRepeatingTimers } from './RepeatingTimer'
import { stopAllHeaderMenuTimers } from './UITable/Row/templates/_HeaderMenu/stateInterface'

/** Tasks to be done before starting a script. */
export const setScriptConfig = (config: Partial<Config>) => {
  setConfig(config)
}

/** Tasks to be done when exiting a script. */
export const cleanup = () => {
  stopAllHeaderMenuTimers()
  killAllRepeatingTimers()
}
