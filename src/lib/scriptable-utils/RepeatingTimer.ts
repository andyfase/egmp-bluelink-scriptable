import { ONE_MINUTE, ONE_SECOND } from './date'
import { alertAndLogError } from './errorHandling'

/** Invalidate the timer after some time */
const DEFAULT_TIMEOUT_MS = ONE_MINUTE * 30
/** Interval for timer refresh */
const DEFAULT_INTERVAL_MS = ONE_SECOND

export type RepeatingTimerOpts = {
  onFire?: () => any // Called every time the timer fires
  onStop?: () => any
  interval?: number
  timeout?: number | null
  fireImmediately?: boolean // Whether to immediately call onFire when timer is started
}

const getTimer = (interval: number) => {
  const t = new Timer()
  t.timeInterval = interval
  t.repeats = true
  return t
}

const timerRegister: Record<string, RepeatingTimer> = {}
/** Stops all timers and neuters the `onStop` function if it exists. This is
 * meant to be used when cleaning up after a script is done to prevent errant
 * timers continuing to run after the user has showed the intention of stopping
 * the current script. */
export const killAllRepeatingTimers = () => {
  for (const timer of Object.values(timerRegister)) {
    timer.onStop = undefined
    timer.stop()
  }
}

export default class RepeatingTimer {
  onFire?: () => any
  onStop?: () => any
  interval: number
  timer: Timer
  repeatCount: number
  maxRepeatCount: number | null
  isRunning: boolean
  fireImmediately: boolean
  private id = UUID.string()

  constructor({
    onFire,
    onStop,
    interval = DEFAULT_INTERVAL_MS,
    timeout = DEFAULT_TIMEOUT_MS,
    fireImmediately = false,
  }: RepeatingTimerOpts = {}) {
    this.onFire = onFire
    this.onStop = onStop
    this.interval = interval
    this.timer = getTimer(interval)
    this.repeatCount = 0
    this.maxRepeatCount = timeout ? timeout / interval : null
    this.isRunning = false
    this.fireImmediately = fireImmediately
    timerRegister[this.id] = this
  }

  setOnFire(onFire: () => any) {
    this.onFire = onFire
  }

  async start() {
    if (!this.onFire) throw new Error('Can not start repeatinng timer w/o onFire callback set')
    this.timer.schedule(async () => {
      try {
        await this.onFire!()
      } catch (e) {
        alertAndLogError(e, 'RepeatingTimer/Scheduled onFire')
      }
      if (this.maxRepeatCount) {
        this.repeatCount++
        if (this.repeatCount >= this.maxRepeatCount) await this.stop()
      }
    })
    this.isRunning = true
    try {
      if (this.fireImmediately) await this.onFire()
    } catch (e) {
      alertAndLogError(e, 'RepeatingTimer/Start')
    }
  }

  /**
   * Does not trigger any onStop events or reset timeout/maxRepeatCount state,
   * just stops the timer and restarts it, thereby erasing any elapsed time.
   * Useful if the onFire action is called early through other means, e.g. a
   * cache is manually refreshed.
   */
  resetCurrent() {
    if (!this.isRunning) {
      throw new Error('Can not reset a timer that is not running')
    }
    this.timer.invalidate()
    this.timer = getTimer(this.interval)
    this.start()
  }

  async stop() {
    this.timer.invalidate()
    try {
      if (this.onStop) await this.onStop()
    } catch (e) {
      alertAndLogError(e, 'RepeatingTimer/stop')
    }
    this.isRunning = false
  }
}
