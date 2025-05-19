import {
  Config,
  CustomClimateConfig,
  ChargeLimitConfig,
  ClimateSeatSetting,
  ClimateSeatSettingCool,
  ClimateSeatSettingWarm,
} from 'config'
import { Logger } from 'lib/logger'
import { Bluelink, ClimateRequest, ChargeLimit } from 'lib/bluelink-regions/base'
import { getChargeCompletionString, sleep } from 'lib/util'

const SIRI_LOG_FILE = 'egmp-bluelink-siri.log'

export async function processSiriRequest(config: Config, bl: Bluelink, shortcutParameter: any): Promise<string> {
  const shortcutParameterAsString = shortcutParameter as string
  const logger = new Logger(SIRI_LOG_FILE, 100)
  if (config.debugLogging) logger.log(`Siri request: ${shortcutParameterAsString}`)

  const commands = commandMap
  for (const value of config.customClimates) {
    commands.push({
      words: value.name.split(' ').concat(['climate']),
      function: customClimate,
      data: value,
    })
  }

  for (const value of config.chargeLimits) {
    commands.push({
      words: value.name.split(' ').concat(['charge', 'limit']),
      function: setChargeLimit,
      data: value,
    })
  }

  for (const commandDetection of commands) {
    let found = true
    for (const word of commandDetection.words) {
      if (!shortcutParameterAsString.toLocaleLowerCase().includes(word.toLocaleLowerCase())) {
        if (config.debugLogging)
          logger.log(`could not find ${word.toLocaleLowerCase()} in ${shortcutParameterAsString.toLocaleLowerCase()}`)
        found = false
        break
      }
    }

    if (found) {
      const response = await commandDetection.function(bl, commandDetection.data)
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
    const chargeCompleteTime = getChargeCompletionString(lastSeen, status.status.remainingChargeTimeMins, 'long')
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

async function waitForCommandSent(
  bl: Bluelink,
  sleepTime = 200,
  startTime = Date.now(),
  counter = 1,
): Promise<boolean> {
  const lastCommand = bl.getLastCommandSent()
  if (lastCommand && lastCommand > startTime) return true
  if (counter > 10) return false
  await sleep(sleepTime)
  return await waitForCommandSent(bl, sleepTime, startTime, counter + 1)
}

async function getRemoteStatus(bl: Bluelink): Promise<string> {
  // send remote status request but dont wait for response as it takes to long
  // wait 5000ms just to ensure we send the command and allow for re-auth etc to complete
  bl.getStatus(true, true)
  //wait for getCar command to be completed + another 200ms to ensure the remote status command is sent
  const result = await waitForCommandSent(bl, 200)
  if (!result)
    return "I've issued a remote status request but it seems like the command was not sent. Please try again."
  await sleep(200)
  return "I've issued a remote status request. Ask me for the normal status again in 30 seconds and I will have your answer."
}

async function warm(bl: Bluelink): Promise<string> {
  const status = bl.getCachedStatus()
  const config = bl.getConfig()
  return await blRequest(
    bl,
    'climate',
    `I've issued a request to pre-warm ${status.car.nickName || `your ${status.car.modelName}`}.`,
    {
      enable: true,
      frontDefrost: true,
      rearDefrost: true,
      steering: true,
      temp: bl.getConfig().climateTempWarm,
      durationMinutes: 15,
      ...(config.climateSeatLevel !== 'Off' && {
        seatClimate: {
          driver: ClimateSeatSettingWarm[config.climateSeatLevel],
          passenger: ClimateSeatSettingWarm[config.climateSeatLevel],
          rearLeft: ClimateSeatSettingWarm[config.climateSeatLevel],
          rearRight: ClimateSeatSettingWarm[config.climateSeatLevel],
        },
      }),
    } as ClimateRequest,
  )
}

async function cool(bl: Bluelink): Promise<string> {
  const status = bl.getCachedStatus()
  const config = bl.getConfig()
  return await blRequest(
    bl,
    'climate',
    `I've issued a request to pre-cool ${status.car.nickName || `your ${status.car.modelName}`}.`,
    {
      enable: true,
      frontDefrost: false,
      rearDefrost: false,
      steering: false,
      temp: config.climateTempCold,
      durationMinutes: 15,
      ...(config.climateSeatLevel !== 'Off' && {
        seatClimate: {
          driver: ClimateSeatSettingCool[config.climateSeatLevel],
          passenger: ClimateSeatSettingCool[config.climateSeatLevel],
          rearLeft: ClimateSeatSettingCool[config.climateSeatLevel],
          rearRight: ClimateSeatSettingCool[config.climateSeatLevel],
        },
      }),
    } as ClimateRequest,
  )
}

async function climateOff(bl: Bluelink): Promise<string> {
  const status = bl.getCachedStatus()
  const config = bl.getConfig()
  return await blRequest(
    bl,
    'climate',
    `I've issued a request to turn off the climate on ${status.car.nickName || `your ${status.car.modelName}`}.`,
    {
      enable: false,
      frontDefrost: false,
      rearDefrost: false,
      steering: false,
      temp: config.climateTempCold,
      durationMinutes: 15,
    } as ClimateRequest,
  )
}

async function customClimate(bl: Bluelink, data: CustomClimateConfig): Promise<string> {
  const status = bl.getCachedStatus()
  return await blRequest(
    bl,
    'climate',
    `I've issued a request to turn on climate setting ${data.name} on ${status.car.nickName || `your ${status.car.modelName}`}.`,
    {
      ...data,
      enable: true,
      ...(data.seatClimate !== 'Off' && {
        seatClimate: {
          driver: ClimateSeatSetting[data.seatClimate],
          passenger: ['ALL', 'FRONT'].includes(data.seatClimateSettings) ? ClimateSeatSetting[data.seatClimate] : 0,
          rearLeft: ['ALL'].includes(data.seatClimateSettings) ? ClimateSeatSetting[data.seatClimate] : 0,
          rearRight: ['ALL'].includes(data.seatClimateSettings) ? ClimateSeatSetting[data.seatClimate] : 0,
        },
      }),
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
    `I've issued a request to unlock ${status.car.nickName || `your ${status.car.modelName}`}.`,
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

async function setChargeLimit(bl: Bluelink, data: ChargeLimitConfig): Promise<string> {
  const status = bl.getCachedStatus()
  return await blRequest(
    bl,
    'chargeLimit',
    `I've issued a request to set charge limit ${data.name} for ${status.car.nickName || `your ${status.car.modelName}`}.`,
    {
      acPercent: data.acPercent,
      dcPercent: data.dcPercent,
    } as ChargeLimit,
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
  const startTime = Date.now()
  let commandSent = false
  let counter = 1
  bl.processRequest(type, payload, async (_isComplete, _didSucceed, _data) => {
    const lastCommand = bl.getLastCommandSent()
    if (lastCommand && lastCommand > startTime) commandSent = true
  })
  while (!commandSent && counter < 10) {
    await sleep(500)
    counter += 1
  }
  return message
}

interface commandDetection {
  words: string[]
  function: (bl: Bluelink, data?: any) => Promise<string>
  data?: any
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
