import { isNotUndefined } from './common'
import { objectKeys } from './object'
import { SettableKeys } from './types/utilTypes'

type NotificationAction = {
  title: string
  url: string
  destructive?: boolean
}

type GetNotificationOpts = Exclude<
  {
    [key in SettableKeys<Notification>]?: Notification[key]
  },
  'title'
> &
  Pick<Notification, 'title'>

const assignNotificationAttribute = <K extends SettableKeys<Notification>>(
  key: K,
  opts: GetNotificationOpts,
  notification: Notification,
) => {
  const val = opts[key] as Notification[K]
  if (isNotUndefined(val)) notification[key] = val
}

const createNotification = (opts: GetNotificationOpts, actions: NotificationAction[] = []) => {
  const n = new Notification()
  for (const key of objectKeys(opts)) assignNotificationAttribute(key, opts, n)
  for (const { title, url, destructive = false } of actions) n.addAction(title, url, destructive)
  return n
}

export const notifyNow = (title: string, body?: string) => {
  createNotification({ title, body }).schedule()
}
