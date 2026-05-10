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

function cleanRemoteError(value) {
  const raw = String(value || '').trim()
  if (!raw) return 'Erreur distante sans détail.'

  const lower = raw.toLowerCase()
  if (lower.includes('<!doctype html') || lower.includes('<html') || lower.includes('page not found')) {
    if (lower.includes('drive') || lower.includes('file you have requested does not exist')) {
      return 'Le service PDF a renvoyé une page Google Drive introuvable au lieu du PDF. Relance la génération ; si ça revient, le lien PDF.co est expiré ou inaccessible.'
    }
    return 'Le service distant a renvoyé une page HTML au lieu d’une réponse exploitable. Vérifie le déploiement Apps Script et relance.'
  }

  return raw
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .slice(0, 700)
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
      return res.status(502).json({ error: 'Erreur webhook', details: cleanRemoteError(body) })
    }

    let parsed = {}
    try {
      parsed = body ? JSON.parse(body) : {}
    } catch {
      return res.status(502).json({ error: 'Réponse Apps Script illisible', details: cleanRemoteError(body) })
    }

    if (parsed.ok === false) {
      return res.status(502).json({ error: 'Erreur Apps Script', details: cleanRemoteError(parsed.error) })
    }

    res.status(200).json(parsed)
  } catch (error) {
    res.status(500).json({ error: 'Erreur serveur', details: cleanRemoteError(error.message) })
  }
}
