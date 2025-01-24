import { isString } from '../common'
import { getConfig } from '../configRegister'
import { formatDate } from '../date'
import persisted from './persisted'

const trimLogLength = (log: string) => {
  const lines = log.split('\n')
  const MAX_LOG_LINES = getConfig('PERSISTED_LOG_MAX_LINES')
  if (lines.length <= MAX_LOG_LINES) return log
  return lines.slice(lines.length - MAX_LOG_LINES).join('\n')
}

const getIO = () =>
  persisted({
    filename: getConfig('PERSISTED_LOG_FILENAME'),
    defaultData: '',
  })

const log = async (val: any, { ignoreLineLimit = false } = {}) => {
  const stringEntry = isString(val) ? val : JSON.stringify(val, null, 2)
  const io = getIO()
  const currData = await io.getData()
  const NOW = new Date()
  const timestamp = `${formatDate(NOW, 'YYYYMMDD')}, ${formatDate(NOW, 'HHMM')}`
  const device = Device.isPhone() ? 'phone' : 'iPad'
  const newEntry = `${timestamp} (${device}): ${stringEntry}`
  const updatedLog = [currData, newEntry].filter(Boolean).join('\n')
  await io.write({
    data: ignoreLineLimit ? updatedLog : trimLogLength(updatedLog),
  })
}

export default {
  clear: () => getIO().reset(),
  log,
}
