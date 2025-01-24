import { OK } from './input/confirm'
import PersistedLog from './io/PersistedLog'

export const alertAndLogError = (error: any, context: string) => {
  OK(`Error in ${context} (see log)`, { message: String(error) })
  PersistedLog.log({ type: 'Error', error: JSON.stringify(error) })
}
