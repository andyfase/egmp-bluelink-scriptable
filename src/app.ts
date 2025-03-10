import { Config, getConfig, STANDARD_CLIMATE_OPTIONS } from 'config'
import { Bluelink, Status, ClimateRequest } from './lib/bluelink-regions/base'
import { getTable, Div, P, Img, quickOptions, DivChild, Spacer, destructiveConfirm } from 'lib/scriptable-utils'
import { loadConfigScreen, deleteConfig } from 'config'
import { deleteWidgetCache } from 'widget'
import {
  sleep,
  loadTintedIcons,
  getTintedIcon,
  getAngledTintedIconAsync,
  calculateBatteryIcon,
  getChargingIcon,
  dateStringOptions,
  getChargeCompletionString,
} from 'lib/util'

interface updatingActions {
  status?: {
    image: Image
    text: string
  }
  lock?: {
    image: Image
    text: string
  }
  climate?: {
    image: Image
    text: string
  }
  charge?: {
    image: Image
    text: string
  }
}

let isUpdating = false
let updatingIconAngle = 0

const { present, connect, setState } = getTable<{
  name: string
  odometer: number
  soc: number
  isCharging: boolean
  isPluggedIn: boolean
  remainingChargeTimeMins: number
  range: number
  locked: boolean
  isClimateOn: boolean
  chargingPower: number
  lastUpdated: number
  twelveSoc: number
  updatingActions: updatingActions | undefined
  appIcon: Image
}>({
  name: 'Testing',
})

const MIN_API_REFRESH_TIME = 900000 // 15 minutes

export async function createApp(config: Config, bl: Bluelink) {
  await loadTintedIcons()

  // not blocking call - render UI with last cache and then update from a non forced remote call (i.e. to server but not to car)
  // if its been at least MIN_API_REFRESH_TIME milliseconds
  const cachedStatus = bl.getCachedStatus()
  if (!cachedStatus || cachedStatus.status.lastStatusCheck < Date.now() + MIN_API_REFRESH_TIME) {
    bl.getStatus(false, true).then(async (status) => {
      updateStatus(status)
    })
  }

  // fetch app icon
  const appIcon = await bl.getCarImage()

  return present({
    defaultState: {
      name: cachedStatus.car.nickName || `${cachedStatus.car.modelName}`,
      odometer: cachedStatus.status.odometer,
      soc: cachedStatus.status.soc,
      isCharging: cachedStatus.status.isCharging,
      isPluggedIn: cachedStatus.status.isPluggedIn,
      remainingChargeTimeMins: cachedStatus.status.remainingChargeTimeMins,
      range: cachedStatus.status.range,
      locked: cachedStatus.status.locked,
      isClimateOn: cachedStatus.status.climate,
      chargingPower: cachedStatus.status.chargingPower,
      lastUpdated: cachedStatus.status.lastRemoteStatusCheck,
      updatingActions: undefined,
      twelveSoc: cachedStatus.status.twelveSoc,
      appIcon: appIcon,
    },
    render: () => [
      pageTitle(),
      batteryStatus(bl),
      pageImage(),
      pageIcons(bl),
      Spacer({ rowHeight: 200 }),
      settings(bl),
    ],
  })
}

const pageTitle = connect(({ state: { name } }) => {
  return Div([
    P(name, {
      font: (n) => Font.boldSystemFont(n),
      fontSize: 35,
      align: 'left',
    }),
  ])
})

const settings = (bl: Bluelink) => {
  return Div(
    [
      P('Settings', {
        font: (n) => Font.boldSystemFont(n),
        fontSize: 20,
        align: 'right',
        width: '90%',
      }),
      Img(getTintedIcon('settings'), { align: 'right' }),
    ],
    {
      onTap: () => {
        loadConfigScreen()
      },
      onTripleTap() {
        destructiveConfirm('Confirm Setting Reset - ALL settings/data will be removed', {
          confirmButtonTitle: 'Delete all Settings/Data',
          onConfirm: () => {
            bl.deleteCache()
            deleteConfig()
            deleteWidgetCache()
            // @ts-ignore - undocumented api
            App.close()
          },
        })
      },
    },
  )
}

const batteryStatus = connect(({ state: { soc, range, isCharging, isPluggedIn } }, bl: Bluelink) => {
  const chargingIcon = getChargingIcon(isCharging, isPluggedIn)
  const icons: DivChild[] = []
  icons.push(
    Img(getTintedIcon(calculateBatteryIcon(soc)), {
      align: 'left',
      width: '18%',
    }),
  )
  if (chargingIcon) {
    icons.push(
      Img(getTintedIcon(chargingIcon), {
        align: 'left',
      }),
    )
  }
  return Div(
    icons.concat([
      P(`${soc.toString()}% (~ ${range} ${bl.getDistanceUnit()})`, {
        align: 'left',
        fontSize: 22,
        width: '90%',
      }),
    ]),
  )
})

const pageIcons = connect(
  (
    {
      state: {
        isCharging,
        lastUpdated,
        remainingChargeTimeMins,
        chargingPower,
        isClimateOn,
        locked,
        updatingActions,
        twelveSoc,
      },
    },
    bl: Bluelink,
  ) => {
    const lastSeen = new Date(lastUpdated)
    const batteryIcon = isCharging ? 'charging' : 'not-charging'
    const batteryText = 'Not Charging'
    const chargingPowerText = chargingPower > 0 ? `${chargingPower.toFixed(1).toString()} kW` : '- kW'
    let chargingPowerTextRowPercentage = '25%'

    // annoying but impacts UI fairly significantly.
    if (chargingPowerText.length <= 4)
      chargingPowerTextRowPercentage = '15%' // '? kw'
    else if (chargingPowerText.length <= 6)
      chargingPowerTextRowPercentage = '18%' // '1.2 kw'
    else if (chargingPowerText.length <= 7)
      chargingPowerTextRowPercentage = '21%' // '10.5 kw'
    else if (chargingPowerText.length <= 8) chargingPowerTextRowPercentage = '25%' // '222.1 kw'

    const chargingRow: DivChild[] = []
    if (updatingActions && updatingActions.charge) {
      chargingRow.push(P(updatingActions.charge.text, { align: 'left', width: '70%', color: Color.orange() }))
    } else if (isCharging) {
      // @ts-ignore
      chargingRow.push(P(chargingPowerText, { align: 'left', width: chargingPowerTextRowPercentage }))
      chargingRow.push(Img(getTintedIcon('charging-complete'), { align: 'left', width: '10%' }))
      chargingRow.push(P(`${getChargeCompletionString(lastSeen, remainingChargeTimeMins)}`, { align: 'left' }))
    } else {
      chargingRow.push(P(batteryText, { align: 'left', width: '70%' }))
    }

    const conditioningText = isClimateOn ? 'Climate On' : 'Climate Off'
    const conditioningIcon = isClimateOn ? 'climate-on' : 'climate-off'

    const lockedText = locked ? 'Car Locked' : 'Car Unlocked'
    const lockedIcon = locked ? 'locked' : 'unlocked'

    const twelveSocText = twelveSoc > 0 ? `12v battery at ${twelveSoc}%` : '12v battery status unknown'

    return Div([
      Div(
        [
          ...[
            Img(updatingActions && updatingActions.charge ? updatingActions.charge.image : getTintedIcon(batteryIcon), {
              align: 'center',
              width: '30%',
            }),
          ],
          ...chargingRow,
        ],
        {
          onTap() {
            if (isUpdating) {
              return
            }
            quickOptions(['Charge', 'Stop Charging', 'Cancel'], {
              title: 'Confirm charge action',
              onOptionSelect: (opt) => {
                if (opt === 'Cancel') return
                doAsyncUpdate({
                  command: opt === 'Charge' ? 'startCharge' : 'stopCharge',
                  bl: bl,
                  actions: updatingActions,
                  actionKey: 'charge',
                  updatingText: opt === 'Charge' ? 'Starting charging ...' : 'Stoping charging ...',
                  successText: opt === 'Charge' ? 'Car charging started!' : 'Car charging stopped!',
                  failureText: `Failed to ${opt === 'Charge' ? 'start charging' : 'stop charging'} car!!!`,
                  successCallback: (data) => {
                    updateStatus({
                      ...bl.getCachedStatus(),
                      status: {
                        ...data,
                        isCharging: opt === 'Charge' ? true : false,
                      },
                    } as Status)
                  },
                })
              },
            })
          },
        },
      ),
      Div(
        [
          Img(
            updatingActions && updatingActions.climate
              ? updatingActions.climate.image
              : getTintedIcon(conditioningIcon),
            { align: 'center' },
          ),
          P(updatingActions && updatingActions.climate ? updatingActions.climate.text : conditioningText, {
            align: 'left',
            width: '70%',
            ...(updatingActions && updatingActions.climate && { color: Color.orange() }),
          }),
        ],
        {
          onTap() {
            if (isUpdating) {
              return
            }
            const config = getConfig() // always re-read in case config has been mutated by config screens, and app page is not refreshed
            const customClimates = Object.values(config.customClimates).map((x) => x.name)
            quickOptions(customClimates.concat(STANDARD_CLIMATE_OPTIONS), {
              title: 'Confirm climate action',
              onOptionSelect: (opt) => {
                if (opt === 'Cancel') return
                let payload = undefined
                if (!STANDARD_CLIMATE_OPTIONS.includes(opt)) {
                  payload = Object.values(config.customClimates).filter((x) => x.name === opt)[0]
                }
                doAsyncUpdate({
                  command: 'climate',
                  bl: bl,
                  payload: payload
                    ? ({ ...payload, enable: true } as ClimateRequest)
                    : ({
                        enable: opt !== 'Off' ? true : false,
                        frontDefrost: opt === 'Warm' ? true : false,
                        rearDefrost: opt === 'Warm' ? true : false,
                        steering: opt === 'Warm' ? true : false,
                        temp: opt === 'Warm' ? config.climateTempWarm : config.climateTempCold,
                        durationMinutes: 15,
                      } as ClimateRequest),
                  actions: updatingActions,
                  actionKey: 'climate',
                  updatingText: payload
                    ? `Starting custom climate ...`
                    : opt === 'Warm'
                      ? 'Starting pre-heat ...'
                      : opt === 'Cool'
                        ? 'Starting cool ...'
                        : 'Stopping climate ...',
                  successText: payload
                    ? `Custom climate Started!`
                    : opt === 'Warm'
                      ? 'Climate heating!'
                      : opt === 'Cool'
                        ? 'Climate cooling!'
                        : 'Climate stopped!',
                  failureText: `Failed to ${opt === 'Off' ? 'Stop' : 'Start'} climate!!!`,
                  successCallback: (data) => {
                    updateStatus({
                      ...bl.getCachedStatus(),
                      status: {
                        ...data,
                        isClimateOn: opt !== 'Off' ? true : false,
                      },
                    } as Status)
                  },
                })
              },
            })
          },
        },
      ),
      Div(
        [
          Img(updatingActions && updatingActions.lock ? updatingActions.lock.image : getTintedIcon(lockedIcon), {
            align: 'center',
          }),
          P(updatingActions && updatingActions.lock ? updatingActions.lock.text : lockedText, {
            align: 'left',
            width: '70%',
            ...(updatingActions && updatingActions.lock && { color: Color.orange() }),
          }),
        ],
        {
          onTap() {
            if (isUpdating) {
              return
            }
            quickOptions(['Lock', 'Unlock', 'Cancel'], {
              title: 'Confirm lock action',
              onOptionSelect: (opt) => {
                if (opt === 'Cancel') return
                doAsyncUpdate({
                  command: opt === 'Lock' ? 'lock' : 'unlock',
                  bl: bl,
                  actions: updatingActions,
                  actionKey: 'lock',
                  updatingText: opt === 'Lock' ? 'Locking car ...' : 'Unlocking car ...',
                  successText: opt === 'Lock' ? 'Car locked!' : 'Car unlocked!',
                  failureText: `Failed to ${opt === 'Lock' ? 'lock' : 'unlock'} car!!!`,
                  successCallback: (data) => {
                    updateStatus({
                      ...bl.getCachedStatus(),
                      status: {
                        ...data,
                        locked: opt === 'Lock' ? true : false,
                      },
                    } as Status)
                  },
                })
              },
            })
          },
        },
      ),
      Div(
        [
          Img(updatingActions && updatingActions.status ? updatingActions.status.image : getTintedIcon('status'), {
            align: 'center',
          }),
          P(
            updatingActions && updatingActions.status
              ? updatingActions.status.text
              : `${lastSeen.toLocaleString(undefined, dateStringOptions)}`,
            {
              align: 'left',
              width: '70%',
              ...(updatingActions && updatingActions.status && { color: Color.orange() }),
            },
          ),
        ],
        {
          onTap() {
            if (!isUpdating) {
              doAsyncUpdate({
                command: 'status',
                bl: bl,
                actions: updatingActions,
                actionKey: 'status',
                updatingText: 'Updating Status...',
                successText: 'Status Updated!',
                failureText: 'Status Failed to Update!!!',
                successCallback: (data) => {
                  updateStatus({
                    ...data,
                  } as Status)
                },
              })
            }
          },
        },
      ),
      Div([Img(getTintedIcon('twelve-volt'), { align: 'center' }), P(twelveSocText, { align: 'left', width: '70%' })]),
    ])
  },
)

const pageImage = connect(({ state: { appIcon } }) => {
  appIcon.size.width = 500
  appIcon.size.height = 90
  return Div([Img(appIcon)], { height: 150 })
})

function updateStatus(status: Status) {
  setState({
    name: status.car.nickName || `${status.car.modelName}`,
    odometer: status.status.odometer,
    soc: status.status.soc,
    isCharging: status.status.isCharging,
    isPluggedIn: status.status.isPluggedIn,
    remainingChargeTimeMins: status.status.remainingChargeTimeMins,
    range: status.status.range,
    locked: status.status.locked,
    isClimateOn: status.status.climate,
    chargingPower: status.status.chargingPower,
    lastUpdated: status.status.lastRemoteStatusCheck,
  })
}

interface doAsyncUpdateProps {
  command: string
  payload?: any
  bl: Bluelink
  actions: updatingActions | undefined
  actionKey: string
  updatingText: string
  successText: string
  failureText: string
  successCallback?: (data: any) => void
}
async function doAsyncUpdate(props: doAsyncUpdateProps) {
  isUpdating = true

  props.bl.processRequest(props.command, props.payload || undefined, async (isComplete, didSucceed, data) => {
    // deal with completion - set icon to checkmark to show success / fail
    if (isComplete) {
      // show success / fail
      setState({
        updatingActions: {
          [props.actionKey]: {
            image: didSucceed
              ? await getAngledTintedIconAsync('checkmark.arrow.trianglehead.counterclockwise', Color.green(), 0)
              : await getAngledTintedIconAsync(
                  'exclamationmark.arrow.trianglehead.2.clockwise.rotate.90',
                  Color.red(),
                  0,
                ),
            text: didSucceed ? props.successText : props.failureText,
          },
        },
      })
      isUpdating = false
      if (didSucceed && props.successCallback) {
        props.successCallback(data)
      }

      sleep(2000).then(() => {
        // reset result state after 2 seconds
        setState({
          updatingActions: {
            [props.actionKey]: undefined,
          },
        })
      })

      // log error on failure
      if (!didSucceed) {
        logError(JSON.stringify(data))
      }
    } else {
      // continue to rotate icon indicating ongoing update
      if (updatingIconAngle >= 360) {
        updatingIconAngle = 0
      } else {
        updatingIconAngle += 30
      }
      setState({
        updatingActions: {
          [props.actionKey]: {
            image: await getAngledTintedIconAsync('arrow.trianglehead.clockwise', Color.orange(), updatingIconAngle),
            text: props.updatingText,
          },
        },
      })
    }
  })
}
