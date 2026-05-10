import crypto from 'crypto'

export function verifyToken(token) {
  if (!token || !token.includes('.')) return false
  const [expires, signature] = token.split('.')
  if (Number(expires) < Date.now()) return false

  const expected = crypto
    .createHmac('sha256', process.env.SESSION_SECRET || 'dev-secret')
    .update(String(expires))
    .digest('hex')

  try {
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))
  } catch {
    return false
  }
}

