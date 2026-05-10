import { verifyToken } from './_verify.js'

const DB_ID = '35592dcce007809882b4d8fe98be13bb'
const NOTION_VERSION = '2022-06-28'

async function notionFetch(path, options = {}) {
  const res = await fetch(`https://api.notion.com/v1${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${process.env.NOTION_TOKEN}`,
      'Notion-Version': NOTION_VERSION,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  })
  return res.json()
}

function plainText(items = []) {
  return items.map(item => item.plain_text || '').join('')
}

export default async function handler(req, res) {
  const token = (req.headers.authorization || '').replace('Bearer ', '')
  if (!verifyToken(token)) return res.status(401).json({ error: 'Non autorisé' })

  if (!process.env.NOTION_TOKEN) {
    return res.status(500).json({ error: 'NOTION_TOKEN manquant' })
  }

  const data = await notionFetch(`/databases/${DB_ID}/query`, {
    method: 'POST',
    body: JSON.stringify({
      filter: { property: 'Étape', status: { equals: 'Gagné' } },
      sorts: [{ property: 'ID', direction: 'descending' }],
      page_size: 100,
    }),
  })

  if (!data.results) return res.status(500).json({ error: 'Erreur Notion' })

  const contactIds = []
  for (const page of data.results) {
    const contacts = page.properties['👥 Contacts']?.relation || []
    if (contacts.length > 0) contactIds.push(contacts[0].id)
  }

  const contactMap = {}
  await Promise.all(
    [...new Set(contactIds)].map(async (id) => {
      const contact = await notionFetch(`/pages/${id}`)
      contactMap[id] = {
        name: plainText(contact.properties?.['Prénom NOM']?.title) || '',
        email: contact.properties?.['Email principal']?.email || '',
      }
    })
  )

  const affaires = data.results.map((page) => {
    const props = page.properties
    const num = props['ID']?.unique_id?.number
    const affId = num ? `AFF-${String(num).padStart(3, '0')}` : 'AFF-???'
    const desc = props['Description']?.title?.[0]?.plain_text || ''
    const adresse = props['Adresse chantier']?.place?.name || ''
    const drive = props['Dossier Drive']?.url || ''
    const contactId = props['👥 Contacts']?.relation?.[0]?.id || ''
    const contactInfo = contactMap[contactId] || { name: '', email: '' }
    const descShort = desc.length > 42 ? desc.substring(0, 42) + '…' : desc

    return {
      notion_id: page.id,
      aff_number: affId,
      description: desc,
      description_short: descShort,
      contact: contactInfo.name,
      email_client: contactInfo.email,
      adresse,
      dossier_drive: drive,
      label: `${affId} — ${descShort} — ${contactInfo.name}`,
    }
  })

  res.status(200).json(affaires)
}

