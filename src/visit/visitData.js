export const VISIT_STEPS = [
  'Identification',
  'Accès',
  'Existant',
  'Cotes & photos',
  'Supports',
  'Plomberie',
  'Électricité',
  'Projet',
  'Matériaux',
  'Synthèse',
]

/**
 * @typedef {'draft'|'needs_completion'|'usable_with_reservations'|'ready_for_pdf'|'pdf_generated'|'sent_to_subcontractor'} DraftVisitStatus
 * @typedef {'Incomplet'|'Exploitable avec réserves'|'Complet'} CompletenessStatus
 * @typedef {{key:string,label:string,status:string,url:string,preview:string,uploadedAt:string,uploading?:boolean}} VisitPhoto
 * @typedef {{id:string,category:string,provider:string,brand:string,reference:string,finish:string,dimension:string,status:string,comment:string}} MaterialSelection
 * @typedef {{id:string,notionAffaireId:string,status:DraftVisitStatus,createdAt:string,updatedAt:string,lastPdfGeneratedAt:string,pdfUrl:string,editableUrl:string,formData:object,photos:Record<string,VisitPhoto>,completenessStatus:CompletenessStatus,missingFields:string[],reservations:string[],blockingPoints:string[],materialSelectionStatus:string}} DraftVisitReport
 */

export const INTERNAL_STATUS_LABELS = {
  draft: 'Brouillon',
  needs_completion: 'À compléter',
  usable_with_reservations: 'Exploitable avec réserves',
  ready_for_pdf: 'Prêt pour PDF',
  pdf_generated: 'PDF généré',
  sent_to_subcontractor: 'Envoyé sous-traitant',
}

export const PHOTO_STATUSES = [
  'Ajoutée',
  'Non visible',
  'Non nécessaire',
  'À faire plus tard',
]

export const PHOTO_SLOTS = [
  ['general_1', 'Vue générale 1'],
  ['general_2', 'Vue générale 2'],
  ['wall_a', 'Mur A'],
  ['wall_b', 'Mur B'],
  ['wall_c', 'Mur C'],
  ['wall_d', 'Mur D'],
  ['floor', 'Sol'],
  ['ceiling', 'Plafond'],
  ['water_inlets', 'Arrivées eau'],
  ['drains', 'Évacuations'],
  ['electrical_panel', 'Tableau électrique si accessible'],
  ['ventilation', 'VMC / ventilation'],
  ['site_access', 'Accès chantier'],
]

export const MATERIAL_CATEGORIES = [
  'Carrelage sol',
  'Faïence',
  'Receveur',
  'Paroi',
  'Robinetterie',
  'Meuble vasque',
  'Miroir',
  'WC',
  'Sèche-serviettes',
  'Éclairage',
  'Accessoires',
  'Peinture',
  'Autre',
]

export const PROVIDERS = ['Point.P', 'Dispano', 'Cedeo', 'Téréva', 'Autre']
export const MATERIAL_STATUSES = ['À choisir', 'Vu en showroom', 'Proposé', 'À valider', 'Validé oralement', 'Validé écrit', 'Non concerné']

const todayInput = () => new Date().toISOString().slice(0, 10)
const isoNow = () => new Date().toISOString()

export function createId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID()
  return `visit-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

export function parseNotionPageId(value = '') {
  const compact = String(value).replace(/-/g, '')
  const match = compact.match(/[0-9a-fA-F]{32}/)
  if (!match) return ''
  const raw = match[0].toLowerCase()
  return `${raw.slice(0, 8)}-${raw.slice(8, 12)}-${raw.slice(12, 16)}-${raw.slice(16, 20)}-${raw.slice(20)}`
}

export function createEmptyFormData() {
  return {
    identification: {
      notionAffaireInput: '',
      affNumber: '',
      affaireDescription: '',
      clientName: '',
      siteAddress: '',
      visitDate: todayInput(),
      commercial: '',
      visitType: 'Première prise de cotes',
    },
    access: {
      housingType: '',
      floor: '',
      elevator: 'Non renseigné',
      parking: 'Non renseigné',
      utilityAccess: 'Non renseigné',
      commonAreaProtection: 'À confirmer',
      coproHours: '',
      caretaker: '',
      noiseConstraints: '',
      comments: '',
    },
    existing: {
      roomType: '',
      approximateSurface: '',
      existingShower: '',
      existingBathtub: '',
      existingToilet: '',
      existingVanity: '',
      towelRadiator: '',
      window: '',
      vmc: 'À vérifier',
      falseCeiling: 'À vérifier',
      floorTiles: '',
      wallTiles: '',
      humiditySigns: 'À vérifier',
      comments: '',
    },
    measurements: {
      wallA: '',
      wallB: '',
      wallC: '',
      wallD: '',
      ceilingHeight: '',
      doorWidth: '',
      mainDrainLocation: '',
      waterInletLocation: '',
      comments: '',
    },
    structure: {
      wallA: 'Non visible / à confirmer',
      wallB: 'Non visible / à confirmer',
      wallC: 'Non visible / à confirmer',
      wallD: 'Non visible / à confirmer',
      suspectedLoadBearing: 'À confirmer',
      partitionToRemove: 'À confirmer',
      nicheCreation: 'À confirmer',
      suspendedVanityReinforcement: 'À confirmer',
      largeFormatTileCompatible: 'À confirmer',
      visibleHumidity: 'À confirmer',
      visibleCracks: 'À confirmer',
      pointsToCheck: '',
    },
    plumbing: {
      hotWaterFound: 'Non visible',
      coldWaterFound: 'Non visible',
      mainDrainsFound: 'Non visible',
      technicalColumnAccessible: 'À confirmer',
      plannedMoves: '',
      hotWaterProduction: 'Inconnue',
      comments: '',
    },
    electrical: {
      panelAccessible: '',
      groundPresent: 'À vérifier',
      outletsCount: '',
      lightPoints: '',
      spotsWanted: 'À confirmer',
      illuminatedMirrorWanted: 'À confirmer',
      electricTowelDryerWanted: 'À confirmer',
      vmcPresent: 'À vérifier',
      vmcFunctional: 'Non testée',
      electricalVolumeConstraints: 'À vérifier',
      comments: '',
    },
    project: {
      showerType: '',
      desiredDimensions: '',
      screen: 'À définir',
      screenFinish: 'À définir',
      screenProfiles: 'À définir',
      screenDimensions: '',
      vanity: 'À définir',
      vanityInstall: 'À définir',
      taps: 'À définir',
      toilet: 'À définir',
      showerNiche: 'À confirmer',
      benchOrShelf: 'À confirmer',
      style: '',
      range: 'Premium',
      clientComments: '',
    },
    materials: [],
  }
}

export function createInitialPhotos() {
  return PHOTO_SLOTS.reduce((acc, [key, label]) => {
    acc[key] = { key, label, status: 'À faire plus tard', url: '', preview: '', uploadedAt: '' }
    return acc
  }, {})
}

export function createDraftVisitReport(seed = {}) {
  const id = seed.id || createId()
  const now = isoNow()
  const draft = {
    id,
    notionAffaireId: seed.notionAffaireId || '',
    status: seed.status || 'draft',
    createdAt: seed.createdAt || now,
    updatedAt: seed.updatedAt || now,
    lastPdfGeneratedAt: seed.lastPdfGeneratedAt || '',
    pdfUrl: seed.pdfUrl || '',
    editableUrl: seed.editableUrl || buildEditableUrl(id),
    formData: normalizeFormData(seed.formData),
    photos: seed.photos || createInitialPhotos(),
    completenessStatus: seed.completenessStatus || 'Incomplet',
    missingFields: seed.missingFields || [],
    reservations: seed.reservations || [],
    blockingPoints: seed.blockingPoints || [],
    materialSelectionStatus: seed.materialSelectionStatus || 'À choisir',
  }
  return refreshDraftAnalysis(draft)
}

function normalizeFormData(formData = {}) {
  const defaults = createEmptyFormData()
  return {
    ...defaults,
    ...formData,
    identification: { ...defaults.identification, ...(formData.identification || {}) },
    access: { ...defaults.access, ...(formData.access || {}) },
    existing: { ...defaults.existing, ...(formData.existing || {}) },
    measurements: { ...defaults.measurements, ...(formData.measurements || {}) },
    structure: { ...defaults.structure, ...(formData.structure || {}) },
    plumbing: migratePlumbing({ ...defaults.plumbing, ...(formData.plumbing || {}) }),
    electrical: { ...defaults.electrical, ...(formData.electrical || {}) },
    project: { ...defaults.project, ...(formData.project || {}) },
    materials: Array.isArray(formData.materials) ? formData.materials : [],
  }
}

function migratePlumbing(plumbing) {
  const legacyDrains = [
    plumbing.showerDrainFound && `Douche: ${plumbing.showerDrainFound}`,
    plumbing.vanityDrainFound && `Vasque: ${plumbing.vanityDrainFound}`,
    plumbing.toiletDrainFound && `WC: ${plumbing.toiletDrainFound}`,
  ].filter(Boolean)

  const legacyMoves = [
    plumbing.showerMovePlanned && `Douche: ${plumbing.showerMovePlanned}`,
    plumbing.vanityMovePlanned && `Vasque: ${plumbing.vanityMovePlanned}`,
    plumbing.toiletMovePlanned && `WC: ${plumbing.toiletMovePlanned}`,
  ].filter(Boolean)

  return {
    ...plumbing,
    mainDrainsFound: plumbing.mainDrainsFound || (legacyDrains.length ? legacyDrains.join(', ') : 'Non visible'),
    plannedMoves: plumbing.plannedMoves || legacyMoves.join(', '),
  }
}

export function buildEditableUrl(id) {
  if (typeof window === 'undefined') return ''
  const url = new URL(window.location.href)
  url.searchParams.set('id', id)
  return url.toString()
}

export function refreshDraftAnalysis(draft) {
  const analysis = validateCompleteness(draft)
  const materialSelectionStatus = getMaterialSelectionStatus(draft.formData.materials)
  return {
    ...draft,
    editableUrl: draft.editableUrl || buildEditableUrl(draft.id),
    completenessStatus: analysis.status,
    missingFields: analysis.missing,
    reservations: analysis.reservations,
    blockingPoints: analysis.blockingPoints,
    materialSelectionStatus,
  }
}

export function getMaterialSelectionStatus(materials = []) {
  const active = materials.filter(m => m.category && m.status !== 'Non concerné')
  if (!active.length) return 'À choisir'
  if (active.every(m => ['Validé oralement', 'Validé écrit'].includes(m.status))) return 'Validée'
  if (active.some(m => ['À choisir', 'À valider', 'Proposé'].includes(m.status))) return 'À confirmer'
  return 'En cours'
}

function hasValue(value) {
  return String(value || '').trim().length > 0
}

function isReservation(value) {
  return ['À confirmer', 'À vérifier', 'Non visible', 'Non visible / à confirmer', 'À définir', 'Non testée', 'Inconnue', 'Non renseigné', 'À faire plus tard'].includes(value)
}

export function validateCompleteness(draft) {
  const { formData, photos } = draft
  const id = formData.identification
  const missing = []
  const reservations = []

  if (!draft.notionAffaireId && !hasValue(id.notionAffaireInput)) missing.push('Affaire Notion non renseignée')
  if (!hasValue(id.clientName)) missing.push('Nom client absent')
  if (!hasValue(id.siteAddress)) missing.push('Adresse chantier absente')
  if (!hasValue(id.visitDate)) missing.push('Date de visite absente')

  const general1 = photos.general_1
  const general2 = photos.general_2
  if (general1?.status !== 'Ajoutée' || !general1?.url) missing.push('Vue générale 1 non ajoutée')
  if (general2?.status !== 'Ajoutée' || !general2?.url) missing.push('Vue générale 2 non ajoutée')

  if (!hasValue(formData.measurements.wallA)) missing.push('Longueur mur A absente')
  if (!hasValue(formData.measurements.wallB)) missing.push('Longueur mur B absente')
  if (!hasValue(formData.measurements.ceilingHeight)) missing.push('Hauteur sous plafond absente')

  collectReservations(formData.access, reservations, 'Accès chantier')
  collectReservations(formData.existing, reservations, 'État existant')
  collectReservations(formData.structure, reservations, 'Structure / supports')
  collectReservations(formData.plumbing, reservations, 'Plomberie')
  collectReservations(formData.electrical, reservations, 'Électricité')
  collectReservations(formData.project, reservations, 'Projet client')

  PHOTO_SLOTS.forEach(([key, label]) => {
    const photo = photos[key]
    if (photo && photo.status !== 'Ajoutée' && photo.status !== 'Non nécessaire') {
      reservations.push(`Photo ${label} : ${photo.status}`)
    }
  })

  const blockingPoints = [...missing, ...reservations.slice(0, 12)]

  if (missing.length) {
    return { status: 'Incomplet', missing, reservations, blockingPoints }
  }

  if (reservations.length) {
    return { status: 'Exploitable avec réserves', missing, reservations, blockingPoints }
  }

  return { status: 'Complet', missing, reservations, blockingPoints: [] }
}

function collectReservations(obj, out, prefix) {
  Object.entries(obj || {}).forEach(([key, value]) => {
    if (isReservation(value)) out.push(`${prefix} : ${labelize(key)} = ${value}`)
  })
}

export function generateSummary(draft) {
  const d = draft.formData
  const materials = d.materials || []
  const knownMaterials = materials
    .filter(m => m.category && ['Vu en showroom', 'Validé oralement', 'Validé écrit'].includes(m.status))
    .map(formatMaterial)
  const materialsToConfirm = materials
    .filter(m => m.category && !['Vu en showroom', 'Validé oralement', 'Validé écrit', 'Non concerné'].includes(m.status))
    .map(formatMaterial)

  const projectBits = [
    d.project.showerType && `douche souhaitée : ${d.project.showerType}`,
    d.project.desiredDimensions && `dimensions : ${d.project.desiredDimensions}`,
    d.project.screen && `paroi : ${d.project.screen}`,
    d.project.screenFinish && `finition paroi : ${d.project.screenFinish}`,
    d.project.screenProfiles && `profilés : ${d.project.screenProfiles}`,
    d.project.screenDimensions && `dimensions paroi : ${d.project.screenDimensions}`,
    d.project.vanity && `meuble : ${d.project.vanity}`,
    d.project.style && `style : ${d.project.style}`,
    d.project.range && `gamme : ${d.project.range}`,
  ].filter(Boolean)

  const constraints = [
    d.access.housingType && `${d.access.housingType}${d.access.floor ? `, étage ${d.access.floor}` : ''}`,
    d.access.elevator && `ascenseur : ${d.access.elevator}`,
    d.access.parking && `stationnement : ${d.access.parking}`,
    d.access.utilityAccess && `accès utilitaire : ${d.access.utilityAccess}`,
    d.access.commonAreaProtection && `protection parties communes : ${d.access.commonAreaProtection}`,
    d.access.noiseConstraints && `bruit : ${d.access.noiseConstraints}`,
  ].filter(Boolean)

  const technical = [
    `supports murs A/B/C/D : ${d.structure.wallA}, ${d.structure.wallB}, ${d.structure.wallC}, ${d.structure.wallD}`,
    `plomberie : EC ${d.plumbing.hotWaterFound}, EF ${d.plumbing.coldWaterFound}, évacuations ${d.plumbing.mainDrainsFound}`,
    `électricité : tableau ${d.electrical.panelAccessible || 'Non renseigné'}, terre ${d.electrical.groundPresent}`,
    d.existing.humiditySigns && `humidité : ${d.existing.humiditySigns}`,
    d.structure.pointsToCheck && `points support : ${d.structure.pointsToCheck}`,
  ].filter(Boolean)

  const questions = [
    ...draft.blockingPoints.slice(0, 8),
    d.plumbing.comments && `Plomberie : ${d.plumbing.comments}`,
    d.electrical.comments && `Électricité : ${d.electrical.comments}`,
  ].filter(Boolean)

  return {
    projectSummary: projectBits.length ? projectBits.join('. ') : 'Projet client à préciser.',
    siteConstraints: constraints.length ? constraints.join('\n') : 'Aucune contrainte chantier renseignée.',
    technicalConstraints: technical.join('\n'),
    knownMaterials: knownMaterials.length ? knownMaterials.join('\n') : 'Aucun matériau confirmé.',
    materialsToConfirm: materialsToConfirm.length ? materialsToConfirm.join('\n') : 'Aucun matériau à confirmer.',
    blockingPoints: draft.blockingPoints.length ? draft.blockingPoints.join('\n') : 'Aucun point bloquant identifié.',
    subcontractorQuestions: questions.length ? questions.join('\n') : 'Pas de question spécifique à ce stade.',
    completeness: draft.completenessStatus,
  }
}

function formatMaterial(material) {
  return [
    material.category,
    material.provider,
    material.brand,
    material.reference,
    material.finish,
    material.dimension,
    material.status,
  ].filter(Boolean).join(' — ')
}

function labelize(key) {
  return key.replace(/([A-Z])/g, ' $1').toLowerCase()
}

export function createMaterialLine() {
  return {
    id: createId(),
    category: '',
    provider: '',
    brand: '',
    reference: '',
    finish: '',
    dimension: '',
    status: 'À choisir',
    comment: '',
  }
}

export function exportDraftJson(draft) {
  return JSON.stringify(refreshDraftAnalysis(draft), null, 2)
}
