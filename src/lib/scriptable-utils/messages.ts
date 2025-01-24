type SendMessageOpts = { toNumbers?: string[]; body?: string }

export const sendTextMessage = async ({ toNumbers, body }: SendMessageOpts = {}) => {
  const m = new Message()
  if (toNumbers) m.recipients = toNumbers
  if (body) m.body = body
  await m.send()
}
