import { creds } from './index'
import { Bluelink, Status } from './lib/bluelink'
import { getTable, Div,P, Img} from "scriptable-utils";
import { loadTintedIcons, getTintedIcon, getAngledTintedIconAsync, calculateBatteryIcon, initRegionalBluelink } from "lib/util"


interface updatingActions {
  status?: {
    image: Image,
    text: string,
  }
}

let isUpdating = false
let updatingIconAngle = 0

const { present, connect, setState } = getTable<{
  name: string,
  odometer: number,
  soc: number,
  isCharging: boolean,
  remainingChargeTimeMins: number,
  range: number
  locked: boolean,
  isConditioning: boolean,
  chargingPower: number,
  lastUpdated: string,
  updatingActions: updatingActions | undefined

}>({
  name: "Testing",
});

export async function createApp(creds: creds) {
    const bl = await initRegionalBluelink(creds)
    await loadTintedIcons()

    // not blocking call - render UI with last cache and then update
    const cachedStatus = bl.getCachedStatus()
    bl.getStatus(false).then((status) => {
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
        isConditioning: cachedStatus.status.conditioning,
        chargingPower: cachedStatus.status.chargingPower,
        lastUpdated: cachedStatus.status.lastRemoteStatusCheck,
        updatingActions: undefined
      },
      render: () => [
            pageTitle(bl),
            batteryStatus(bl),
            pageImage(bl),
            pageIcons(bl)
          ]
      }
    );

}

const pageTitle = connect(({ state: { name } }, bl: Bluelink) => {
  return (Div([
    P(name, {
      font: n => Font.boldSystemFont(n),
      fontSize: 35,
      align: "left"
    })
  ]))
});

const batteryStatus = connect(({ state: { soc, range } }, bl: Bluelink) => {
  return (
    Div([
    Img(getTintedIcon(calculateBatteryIcon(soc, false)), {align: "left", width: "10%"}),
    P(`${soc.toString()}% (~ ${range} km)`, {align: "left"})
  ]))
})

const pageIcons = connect(({ state: { soc, isCharging, lastUpdated, remainingChargeTimeMins, chargingPower, isConditioning, locked, updatingActions } }, bl: Bluelink) => {
  
  const updatedTime = lastUpdated + "Z"

  // date conversion
  const df = new DateFormatter()
  df.dateFormat = "yyyyMMddHHmmssZ"
  const lastSeen = df.date(updatedTime)
  const batteryIcon = isCharging ? "charging" : "not-charging"
  let batteryText = "Not Charging"
  if (isCharging) {
    const remainingChargeTimeHours = Number((remainingChargeTimeMins / 60)).toString();
    const remainingChargeTimeMinsRemainder = Number(remainingChargeTimeMins % 60);
    batteryText = `${chargingPower.toString()} kW  - ${remainingChargeTimeHours}h ${remainingChargeTimeMinsRemainder}m`
  }
  const conditioningText = isConditioning ? "Conditioning" : "Not Conditioning"
  const conditioningIcon = isConditioning ? "conditioning" : "not-conditioning"

  const lockedText = locked ? "Car Locked" : "Car Unlocked"
  const lockedIcon = locked ? "locked" : "unlocked"

  return (Div([
    Div([
      Img(getTintedIcon(batteryIcon), {align: "center"}),
      P(batteryText, {align: "left", width: "70%"})
    ], { onTap() {
      setState({
        soc: 15,
        range: 100
      })
    },}),
    Div([
      Img(getTintedIcon(conditioningIcon), {align: "center"}),
      P(conditioningText, {align: "left", width: "70%"})
    ]),
    Div([
      Img(getTintedIcon(lockedIcon), {align: "center"}),
      P(lockedText, {align: "left", width: "70%"})
    ]),
    Div([
      Img(updatingActions && updatingActions.status ? updatingActions.status.image : getTintedIcon("status"), {align: "center"}),
      P(updatingActions && updatingActions.status ? updatingActions.status.text : `${lastSeen.toLocaleString()}`, {align: "left", width: "70%", ...(updatingActions && updatingActions.status) && { color: Color.yellow() }})
    ], { onTap() {
      if (! isUpdating) {
        doAsyncUpdate({
          type: "status", 
          bl: bl, 
          actions: updatingActions, 
          updatingText: "Updating Status...", 
          successText: "Status Updated!", 
          failureText: "Status Failed to Update!!!",
          successCallback: ((data) => {
            updateStatus(data as Status)
          })
        })
      }
    },}),
  ]))
});

function pageImage (bl: Bluelink) {
  const appIcon = Image.fromData(Data.fromBase64String(bl.getCarImage()))
  appIcon.size.width = 500
  appIcon.size.height = 90
  return (Div([Img(appIcon)],{ height: 150 }))
};


function updateStatus(status: Status) {
  setState({
    name: status.car.nickName || `${status.car.modelName}`,
    odometer: status.status.odometer,
    soc: status.status.soc,
    isCharging: status.status.isCharging,
    remainingChargeTimeMins: status.status.remainingChargeTimeMins,
    range: status.status.range,
    locked: status.status.locked,
    isConditioning: status.status.conditioning,
    chargingPower: status.status.chargingPower,
    lastUpdated: status.status.lastRemoteStatusCheck,
  })
}

interface doAsyncUpdateProps {
  type: string,
  bl: Bluelink,
  actions: updatingActions | undefined,
  updatingText: string,
  successText: string,
  failureText: string,
  successCallback?: (data: any) => void
}
async function doAsyncUpdate(props: doAsyncUpdateProps) {
  isUpdating = true

  // replace this timer for a case statement based on the type of action being done
  props.bl.processRequest(props.type, async (isComplete, didSucceed, data) => {
    // deal with completion - set icon to checkmark to show success / fail
    if (isComplete) { 
      // show success / fail
      setState({
        updatingActions: {
          [props.type]: { 
            image: didSucceed ? await getAngledTintedIconAsync("checkmark.arrow.trianglehead.counterclockwise", Color.green(), 0) :
            await getAngledTintedIconAsync("exclamationmark.arrow.trianglehead.2.clockwise.rotate.90", Color.red(), 0),
            text: didSucceed ? props.successText : props.failureText
          }
        }
      })
      isUpdating = false
      if (didSucceed && props.successCallback) {
        props.successCallback(data)
      }

      // set timer for reseting icon state
      Timer.schedule(2000, false, () => {
        setState({
          updatingActions: {
            [props.type]: undefined
          }
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
          [props.type]: {
            image: await getAngledTintedIconAsync("arrow.trianglehead.clockwise", Color.yellow(), updatingIconAngle),
            text: props.updatingText
          }
        }
      })
    }
  })
}
