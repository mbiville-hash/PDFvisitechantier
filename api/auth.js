import crypto from 'crypto'

export default function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const { pin } = req.body || {}
  if (!pin || pin !== process.env.APP_PIN) {
    return res.status(401).json({ error: 'PIN incorrect' })
  }

  const expires = Date.now() + 8 * 60 * 60 * 1000
  const signature = crypto
    .createHmac('sha256', process.env.SESSION_SECRET || 'dev-secret')
    .update(String(expires))
    .digest('hex')

  res.status(200).json({ token: `${expires}.${signature}` })
}

