import { Config } from 'config'
import { Logger } from 'lib/logger'
import { Bluelink, ClimateRequest } from 'lib/bluelink-regions/base'
import { getChargeCompletionString, sleep } from 'lib/util'

const SIRI_LOG_FILE = 'egmp-bluelink-siri.log'

export async function processSiriRequest(config: Config, bl: Bluelink, shortcutParameter: any): Promise<string> {
  const shortcutParameterAsString = shortcutParameter as string
  const logger = new Logger(SIRI_LOG_FILE, 100)
  if (config.debugLogging) logger.log(`Siri request: ${shortcutParameterAsString}`)

  for (const commandDetection of commandMap) {
    let found = true
    for (const word of commandDetection.words) {
      if (!shortcutParameterAsString.toLocaleLowerCase().includes(word)) {
        found = false
        break
      }
    }

    if (found) {
      const response = await commandDetection.function(bl)
      if (config.debugLogging) logger.log(`Siri response: ${response}`)
      return response
    }
  }
  return `You asked me ${shortcutParameter} and i dont support that command`
}

async function getStatus(bl: Bluelink): Promise<string> {
  const status = await bl.getStatus(false, true)
  const lastSeen = new Date(status.status.lastRemoteStatusCheck)

  const carName = status.car.nickName || `${status.car.modelYear}`

  let response = `${carName}'s battery is at ${status.status.soc}% and ${status.status.locked ? 'locked' : 'un-locked'}`
  if (status.status.climate) response += ', and your climate is currently on'

  if (status.status.isCharging) {
    const chargeCompleteTime = getChargeCompletionString(lastSeen, status.status.remainingChargeTimeMins)
    response += `. Also your car is charging at ${status.status.chargingPower}kw and will be finished charging at ${chargeCompleteTime}`
  } else if (status.status.isPluggedIn) {
    response += '. Also your car is currently plugged into a charger.'
  }
  const lastSeenShort = lastSeen.toLocaleString(undefined, {
    weekday: 'long',
    hour: 'numeric',
    minute: 'numeric',
  })
  response += `. This was the status from ${carName} on ${lastSeenShort}.`
  return response
}

async function getRemoteStatus(bl: Bluelink): Promise<string> {
  // send remote status request but dont wait for response as it takes to long
  // wait 500ms just to ensure we sent the command
  bl.getStatus(true, true)
  await sleep(500)
  return "I've issued a remote status request. Ask me for the normal status again in 30 seconds and I will have your answer."
}

async function warm(bl: Bluelink): Promise<string> {
  const status = bl.getCachedStatus()
  return await blRequest(
    bl,
    'climate',
    `I've issued a request to pre-warm ${status.car.nickName || `your ${status.car.modelName}`}.`,
    {
      enable: true,
      defrost: true,
      steering: true,
      temp: bl.getConfig().climateTempWarm,
      durationMinutes: 15,
    } as ClimateRequest,
  )
}

async function cool(bl: Bluelink): Promise<string> {
  const status = bl.getCachedStatus()
  return await blRequest(
    bl,
    'climate',
    `I've issued a request to pre-cool ${status.car.nickName || `your ${status.car.modelName}`}.`,
    {
      enable: true,
      defrost: false,
      steering: false,
      temp: bl.getConfig().climateTempCold,
      durationMinutes: 15,
    } as ClimateRequest,
  )
}

async function climateOff(bl: Bluelink): Promise<string> {
  const status = bl.getCachedStatus()
  return await blRequest(
    bl,
    'climate',
    `I've issued a request to turn off the climate on ${status.car.nickName || `your ${status.car.modelName}`}.`,
    {
      enable: false,
      defrost: false,
      steering: false,
      temp: bl.getConfig().climateTempCold,
      durationMinutes: 15,
    } as ClimateRequest,
  )
}

async function lock(bl: Bluelink): Promise<string> {
  const status = bl.getCachedStatus()
  return await blRequest(
    bl,
    'lock',
    `I've issued a request to lock ${status.car.nickName || `your ${status.car.modelName}`}.`,
  )
}

async function unlock(bl: Bluelink): Promise<string> {
  const status = bl.getCachedStatus()
  return await blRequest(
    bl,
    'unlock',
    `I've issued a request to lock ${status.car.nickName || `your ${status.car.modelName}`}.`,
  )
}

async function startCharge(bl: Bluelink): Promise<string> {
  const status = bl.getCachedStatus()
  return await blRequest(
    bl,
    'startCharge',
    `I've issued a request to start charging ${status.car.nickName || `your ${status.car.modelName}`}.`,
  )
}

async function stopCharge(bl: Bluelink): Promise<string> {
  const status = bl.getCachedStatus()
  return await blRequest(
    bl,
    'stopCharge',
    `I've issued a request to stop charging ${status.car.nickName || `your ${status.car.modelName}`}.`,
  )
}

async function blRequest(bl: Bluelink, type: string, message: string, payload?: any): Promise<string> {
  let gotFirstCallback = false
  let counter = 1
  bl.processRequest(type, payload, async (_isComplete, _didSucceed, _data) => {
    gotFirstCallback = true
  })
  while (!gotFirstCallback && counter < 10) {
    await sleep(500)
    counter += 1
  }
  return message
}

interface commandDetection {
  words: string[]
  function: (bl: Bluelink) => Promise<string>
}

// Note order matters in this list, as we check a sentence for presence of words
// and certain words contain sub-words. Hence "unlock" needs to be before "lock" etc
const commandMap: commandDetection[] = [
  {
    words: ['status', 'remote'],
    function: getRemoteStatus,
  },
  {
    words: ['status'],
    function: getStatus,
  },
  {
    words: ['warm'],
    function: warm,
  },
  {
    words: ['cool'],
    function: cool,
  },
  {
    words: ['climate', 'off'],
    function: climateOff,
  },
  {
    words: ['unlock'],
    function: unlock,
  },
  {
    words: ['lock'],
    function: lock,
  },
  {
    words: ['start', 'charging'],
    function: startCharge,
  },
  {
    words: ['stop', 'charging'],
    function: stopCharge,
  },
]
