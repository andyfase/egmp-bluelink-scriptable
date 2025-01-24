import { Config } from 'config'
import { Bluelink, Status, ClimateRequest } from './lib/bluelink-regions/base'
import { getTable, Div, P, Img, quickOptions, DivChild, Spacer } from 'scriptable-utils'
import { loadConfigScreen } from 'config'
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
import { initRegionalBluelink } from './lib/bluelink'

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
  lastUpdated: string
  updatingActions: updatingActions | undefined
}>({
  name: 'Testing',
})

export async function createApp(creds: Config) {
  const bl = await initRegionalBluelink(creds)
  await loadTintedIcons()

  // not blocking call - render UI with last cache and then update from a non forced remote call (i.e. to server but not to car)
  const cachedStatus = bl.getCachedStatus()
  bl.getStatus(false, true).then(async (status) => {
    updateStatus(status)
  })

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
    },
    render: () => [pageTitle(), batteryStatus(), pageImage(bl), pageIcons(bl), Spacer({ rowHeight: 260 }), settings()],
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

const settings = () => {
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
    },
  )
}

const batteryStatus = connect(({ state: { soc, range, isCharging, isPluggedIn } }) => {
  const chargingIcon = getChargingIcon(isCharging, isPluggedIn)
  const icons: DivChild[] = []
  icons.push(
    Img(getTintedIcon(calculateBatteryIcon(soc)), {
      align: 'left',
      width: '10%',
    }),
  )
  if (chargingIcon) {
    icons.push(
      Img(getTintedIcon(chargingIcon), {
        align: 'left',
        width: '10%',
      }),
    )
  }
  return Div(icons.concat([P(`${soc.toString()}% (~ ${range} km)`, { align: 'left' })]))
})

const pageIcons = connect(
  (
    {
      state: { isCharging, lastUpdated, remainingChargeTimeMins, chargingPower, isClimateOn, locked, updatingActions },
    },
    bl: Bluelink,
  ) => {
    const updatedTime = lastUpdated + 'Z'

    // date conversion
    const df = new DateFormatter()
    df.dateFormat = 'yyyyMMddHHmmssZ'
    const lastSeen = df.date(updatedTime)
    const batteryIcon = isCharging ? 'charging' : 'not-charging'
    const batteryText = 'Not Charging'

    const chargingRow: DivChild[] = []
    if (updatingActions && updatingActions.charge) {
      chargingRow.push(P(updatingActions.charge.text, { align: 'left', width: '70%', color: Color.yellow() }))
    } else if (isCharging) {
      chargingRow.push(P(`${chargingPower.toString()} kW`, { align: 'left', width: '20%' }))
      chargingRow.push(Img(getTintedIcon('charging-complete'), { align: 'left', width: '10%' }))
      chargingRow.push(P(`Wed ${getChargeCompletionString(lastSeen, remainingChargeTimeMins)}`, { align: 'left' }))
    } else {
      chargingRow.push(P(batteryText, { align: 'left', width: '70%' }))
    }

    const conditioningText = isClimateOn ? 'Climate On' : 'Climate Off'
    const conditioningIcon = isClimateOn ? 'climate-on' : 'climate-off'

    const lockedText = locked ? 'Car Locked' : 'Car Unlocked'
    const lockedIcon = locked ? 'locked' : 'unlocked'

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
                  successCallback: () => {
                    setState({
                      isCharging: opt === 'Charge' ? true : false,
                    })
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
            ...(updatingActions && updatingActions.climate && { color: Color.yellow() }),
          }),
        ],
        {
          onTap() {
            if (isUpdating) {
              return
            }
            quickOptions(['Warm', 'Cool', 'Off', 'Cancel'], {
              title: 'Confirm climate action',
              onOptionSelect: (opt) => {
                if (opt === 'Cancel') return
                doAsyncUpdate({
                  command: 'climate',
                  bl: bl,
                  payload: {
                    enable: opt !== 'Off' ? true : false,
                    defrost: opt === 'Warm' ? true : false,
                    steering: opt === 'Warm' ? true : false,
                    temp: opt === 'Warm' ? 21.5 : 19,
                    durationMinutes: 15,
                  } as ClimateRequest,
                  actions: updatingActions,
                  actionKey: 'climate',
                  updatingText:
                    opt === 'Warm'
                      ? 'Starting pre-heat ...'
                      : opt === 'Cool'
                        ? 'Starting cool ...'
                        : 'Stopping climate ...',
                  successText:
                    opt === 'Warm' ? 'Climate heating!' : opt === 'Cool' ? 'Climate cooling!' : 'Climate stopped!',
                  failureText: `Failed to ${opt === 'Off' ? 'Stop' : 'Start'} climate!!!`,
                  successCallback: () => {
                    setState({
                      isClimateOn: opt !== 'Off' ? true : false,
                    })
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
            ...(updatingActions && updatingActions.lock && { color: Color.yellow() }),
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
                  successCallback: () => {
                    setState({
                      locked: opt === 'Lock' ? true : false,
                    })
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
              ...(updatingActions && updatingActions.status && { color: Color.yellow() }),
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
                  updateStatus(data as Status)
                },
              })
            }
          },
        },
      ),
    ])
  },
)

function pageImage(bl: Bluelink) {
  const appIcon = Image.fromData(Data.fromBase64String(bl.getCarImage()))
  appIcon.size.width = 500
  appIcon.size.height = 90
  return Div([Img(appIcon)], { height: 150 })
}

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
        // assumption is bluelink class cache already updated with latest status - hence update our own view from cache
        updateStatus(props.bl.getCachedStatus())
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
        logError(data)
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
            image: await getAngledTintedIconAsync('arrow.trianglehead.clockwise', Color.yellow(), updatingIconAngle),
            text: props.updatingText,
          },
        },
      })
    }
  })
}
