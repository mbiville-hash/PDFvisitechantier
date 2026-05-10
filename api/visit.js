import { verifyToken } from './_verify.js'

function getWebhookUrl() {
  if (!process.env.WEBHOOK_URL) {
    throw new Error('WEBHOOK_URL manquant')
  }

  const url = new URL(process.env.WEBHOOK_URL)
  if (process.env.WEBHOOK_SECRET) {
    url.searchParams.set('secret', process.env.WEBHOOK_SECRET)
  }
  return url.toString()
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const token = (req.headers.authorization || '').replace('Bearer ', '')
  if (!verifyToken(token)) return res.status(401).json({ error: 'Non autorisé' })

  try {
    const response = await fetch(getWebhookUrl(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body),
    })

    const body = await response.text()
    if (!response.ok) {
      return res.status(502).json({ error: 'Erreur webhook', details: body })
    }

    const parsed = body ? JSON.parse(body) : {}
    if (parsed.ok === false) {
      return res.status(502).json({ error: 'Erreur Apps Script', details: parsed.error })
    }

    res.status(200).json(parsed)
  } catch (error) {
    res.status(500).json({ error: 'Erreur serveur', details: error.message })
  }
}

