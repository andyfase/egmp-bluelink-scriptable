import { Config } from 'config'
import { initRegionalBluelink } from 'lib/bluelink'
import { Bluelink } from 'lib/bluelink-regions/base'
import { getChargeCompletionString, sleep } from 'lib/util'

export async function processSiriRequest(config: Config, shortcutParameter: any) {
  const shortcutParameterAsString = shortcutParameter as string
  const bl = await initRegionalBluelink(config)

  for (const commandDetection of commandMap) {
    let found = true
    for (const word of commandDetection.words) {
      if (!shortcutParameterAsString.toLocaleLowerCase().includes(word)) {
        found = false
        break
      }
    }

    if (found) {
      const result = await commandDetection.function(bl)
      Speech.speak(result)
      return
    }
  }
  Speech.speak(`You asked me ${shortcutParameter} and i dont support that command`)
}

async function getStatus(bl: Bluelink): Promise<string> {
  const status = await bl.getStatus(false, true)

  const updatedTime = status.status.lastRemoteStatusCheck + 'Z'
  // date conversion
  const df = new DateFormatter()
  df.dateFormat = 'yyyyMMddHHmmssZ'
  const lastSeen = df.date(updatedTime)

  const carName = status.car.nickName || `${status.car.modelYear}`

  let response = `${carName}'s battery is at ${status.status.soc}% and ${status.status.locked ? 'locked' : 'un-locked'}`
  if (status.status.climate) response += ', and your climate is currently on'
  else response += ''

  if (status.status.isCharging) {
    const chargeCompleteTime = getChargeCompletionString(lastSeen, status.status.remainingChargeTimeMins)
    response += `Also your car is charging at ${status.status.chargingPower}kw and will be finished charging at ${chargeCompleteTime}`
  } else if (status.status.isPluggedIn) {
    response += 'Also your car is currently plugged into a charger.'
  }
  const lastSeenShort = lastSeen.toLocaleString(undefined, {
    weekday: 'short',
    hour: 'numeric',
    minute: 'numeric',
  })
  response += `This was the status from ${carName} on ${lastSeenShort}.`
  return response
}

async function getRemoteStatus(bl: Bluelink): Promise<string> {
  // send remote status request but dont wait for response as it takes to long
  // wait 500ms just to ensure we sent the command
  bl.getStatus(true, true)
  await sleep(500)
  return "I've issues a remote status request. Ask me for the normal status again in 30 seconds and I will have your answer."
}

interface commandDetection {
  words: string[]
  function: (bl: Bluelink) => Promise<string>
}

const commandMap: commandDetection[] = [
  {
    words: ['status', 'remote'],
    function: getRemoteStatus,
  },
  {
    words: ['status'],
    function: getStatus,
  },
]
