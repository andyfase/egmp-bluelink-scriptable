import { Bluelink, BluelinkCreds, Status, ClimateRequest } from './lib/bluelink-regions/base'
import { getTable, Div, P, Img, quickOptions } from 'scriptable-utils'
import { sleep, loadTintedIcons, getTintedIcon, getAngledTintedIconAsync, calculateBatteryIcon } from 'lib/util'
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

export async function createApp(creds: BluelinkCreds) {
  const bl = await initRegionalBluelink(creds)
  await loadTintedIcons()

  // not blocking call - render UI with last cache and then update
  const cachedStatus = bl.getCachedStatus()
  bl.getStatus(false).then(async (status) => {
    updateStatus(status)
  })

  return present({
    defaultState: {
      name: cachedStatus.car.nickName || `${cachedStatus.car.modelName}`,
      odometer: cachedStatus.status.odometer,
      soc: cachedStatus.status.soc,
      isCharging: cachedStatus.status.isCharging,
      remainingChargeTimeMins: cachedStatus.status.remainingChargeTimeMins,
      range: cachedStatus.status.range,
      locked: cachedStatus.status.locked,
      isClimateOn: cachedStatus.status.climate,
      chargingPower: cachedStatus.status.chargingPower,
      lastUpdated: cachedStatus.status.lastRemoteStatusCheck,
      updatingActions: undefined,
    },
    render: () => [pageTitle(), batteryStatus(), pageImage(bl), pageIcons(bl)],
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

const batteryStatus = connect(({ state: { soc, range } }) => {
  return Div([
    Img(getTintedIcon(calculateBatteryIcon(soc, false)), {
      align: 'left',
      width: '10%',
    }),
    P(`${soc.toString()}% (~ ${range} km)`, { align: 'left' }),
  ])
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
    let batteryText = 'Not Charging'
    if (isCharging) {
      const remainingChargeTimeHours = Number(remainingChargeTimeMins / 60).toString()
      const remainingChargeTimeMinsRemainder = Number(remainingChargeTimeMins % 60)
      batteryText = `${chargingPower.toString()} kW  - ${remainingChargeTimeHours}h ${remainingChargeTimeMinsRemainder}m`
    }
    const conditioningText = isClimateOn ? 'Climate On' : 'Climate Off'
    const conditioningIcon = isClimateOn ? 'climate-on' : 'climate-off'

    const lockedText = locked ? 'Car Locked' : 'Car Unlocked'
    const lockedIcon = locked ? 'locked' : 'unlocked'

    return Div([
      Div(
        [
          Img(updatingActions && updatingActions.charge ? updatingActions.charge.image : getTintedIcon(batteryIcon), {
            align: 'center',
          }),
          P(updatingActions && updatingActions.charge ? updatingActions.charge.text : batteryText, {
            align: 'left',
            width: '70%',
            ...(updatingActions && updatingActions.charge && { color: Color.yellow() }),
          }),
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
                  updatingText: opt === 'Warm' ? 'Starting pre-heat ...' : 'Starting cool ...',
                  successText: opt === 'Warm' ? 'Climate heating!' : 'Climate cooling!',
                  failureText: `Failed to start climate!!!`,
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
          P(updatingActions && updatingActions.status ? updatingActions.status.text : `${lastSeen.toLocaleString()}`, {
            align: 'left',
            width: '70%',
            ...(updatingActions && updatingActions.status && { color: Color.yellow() }),
          }),
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
