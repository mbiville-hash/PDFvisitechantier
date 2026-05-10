import { useEffect, useMemo, useRef, useState } from 'react'
import { G } from '../utils/colors.js'
import { compressAndUpload } from '../utils/cloudinary.js'
import VisitPhotoGrid from './VisitPhotoGrid.jsx'
import {
  INTERNAL_STATUS_LABELS,
  MATERIAL_CATEGORIES,
  MATERIAL_STATUSES,
  PROVIDERS,
  VISIT_STEPS,
  createDraftVisitReport,
  createMaterialLine,
  exportDraftJson,
  generateSummary,
  parseNotionPageId,
  refreshDraftAnalysis,
} from '../visit/visitData.js'

const LOCAL_CURRENT = 'fortis.visit.current'
const localKey = id => `fortis.visit.${id}`

export default function BathroomVisitForm({ token, onLogout }) {
  const contentRef = useRef(null)
  const [step, setStep] = useState(0)
  const [draft, setDraft] = useState(() => createDraftVisitReport())
  const [affaires, setAffaires] = useState([])
  const [search, setSearch] = useState('')
  const [draftSearch, setDraftSearch] = useState('')
  const [remoteDrafts, setRemoteDrafts] = useState([])
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState('')
  const [lastLocalSave, setLastLocalSave] = useState('')
  const [confirmPdf, setConfirmPdf] = useState(false)
  const [completion, setCompletion] = useState(null)

  const analyzedDraft = useMemo(() => refreshDraftAnalysis(draft), [draft])
  const summary = useMemo(() => generateSummary(analyzedDraft), [analyzedDraft])

  useEffect(() => {
    fetch('/api/affaires', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(data => setAffaires(Array.isArray(data) ? data : []))
      .catch(() => setAffaires([]))
  }, [token])

  useEffect(() => {
    loadDraftList()
  }, [token])

  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get('id')
    if (id) {
      loadRemoteDraft(id)
      return
    }
    const currentId = localStorage.getItem(LOCAL_CURRENT)
    const raw = currentId ? localStorage.getItem(localKey(currentId)) : ''
    if (raw) {
      try {
        setDraft(createDraftVisitReport(JSON.parse(raw)))
      } catch {
        setDraft(createDraftVisitReport())
      }
    }
  }, [])

  useEffect(() => {
    const toSave = refreshDraftAnalysis(draft)
    localStorage.setItem(LOCAL_CURRENT, toSave.id)
    localStorage.setItem(localKey(toSave.id), JSON.stringify(toSave))
    setLastLocalSave(new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }))
  }, [draft])

  const updateDraft = (updater) => {
    setCompletion(null)
    setDraft(current => {
      const next = typeof updater === 'function' ? updater(current) : updater
      return refreshDraftAnalysis({ ...next, updatedAt: new Date().toISOString() })
    })
  }

  const setField = (section, key, value) => {
    updateDraft(current => ({
      ...current,
      formData: {
        ...current.formData,
        [section]: { ...current.formData[section], [key]: value },
      },
    }))
  }

  const setNotionInput = (value) => {
    const id = parseNotionPageId(value)
    updateDraft(current => ({
      ...current,
      notionAffaireId: value.trim() ? (id || current.notionAffaireId) : '',
      formData: {
        ...current.formData,
        identification: { ...current.formData.identification, notionAffaireInput: value },
      },
    }))
  }

  const chooseAffaire = (affaire) => {
    setSearch('')
    updateDraft(current => ({
      ...current,
      notionAffaireId: affaire.notion_id,
      formData: {
        ...current.formData,
        identification: {
          ...current.formData.identification,
          notionAffaireInput: affaire.notion_id,
          affNumber: affaire.aff_number,
          affaireDescription: affaire.description || affaire.description_short || '',
          clientName: affaire.contact || current.formData.identification.clientName,
          siteAddress: affaire.adresse || current.formData.identification.siteAddress,
        },
      },
    }))
  }

  const addMaterial = () => {
    updateDraft(current => ({
      ...current,
      formData: {
        ...current.formData,
        materials: [...current.formData.materials, createMaterialLine()],
      },
    }))
  }

  const updateMaterial = (id, key, value) => {
    updateDraft(current => ({
      ...current,
      formData: {
        ...current.formData,
        materials: current.formData.materials.map(line => line.id === id ? { ...line, [key]: value } : line),
      },
    }))
  }

  const removeMaterial = (id) => {
    updateDraft(current => ({
      ...current,
      formData: {
        ...current.formData,
        materials: current.formData.materials.filter(line => line.id !== id),
      },
    }))
  }

  const uploadPhoto = async (key, file) => {
    setError('')
    const preview = URL.createObjectURL(file)
    updateDraft(current => ({
      ...current,
      photos: {
        ...current.photos,
        [key]: { ...current.photos[key], preview, status: 'Ajoutée', uploading: true },
      },
    }))

    try {
      const url = await compressAndUpload(file)
      updateDraft(current => ({
        ...current,
        photos: {
          ...current.photos,
          [key]: { ...current.photos[key], url, preview, status: 'Ajoutée', uploading: false, uploadedAt: new Date().toISOString() },
        },
      }))
    } catch (err) {
      updateDraft(current => ({
        ...current,
        photos: {
          ...current.photos,
          [key]: { ...current.photos[key], uploading: false, status: 'À faire plus tard' },
        },
      }))
      setError(`Upload photo impossible : ${err.message}`)
    }
  }

  const setPhotoStatus = (key, status) => {
    updateDraft(current => ({
      ...current,
      photos: {
        ...current.photos,
        [key]: { ...current.photos[key], status },
      },
    }))
  }

  const removePhoto = (key) => {
    updateDraft(current => ({
      ...current,
      photos: {
        ...current.photos,
        [key]: { ...current.photos[key], url: '', preview: '', uploadedAt: '', status: 'À faire plus tard' },
      },
    }))
  }

  const loadRemoteDraft = async (id) => {
    if (!id) return
    setBusy('Chargement…')
    setError('')
    try {
      const res = await fetch('/api/visit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action: 'loadDraft', id }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || data.ok === false) throw new Error(data.details || data.error || 'Fiche introuvable')
      setDraft(createDraftVisitReport(data.draft))
      setCompletion(null)
      setMessage('Fiche chargée.')
    } catch (err) {
      setError(cleanUiError(err.message))
    } finally {
      setBusy('')
    }
  }

  const loadDraftList = async () => {
    try {
      const res = await fetch('/api/visit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action: 'listDrafts' }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok && data.ok !== false) setRemoteDrafts(Array.isArray(data.drafts) ? data.drafts : [])
    } catch {
      setRemoteDrafts([])
    }
  }

  const goStep = (nextStep) => {
    setStep(nextStep)
    window.scrollTo({ top: 0, behavior: 'smooth' })
    contentRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const saveDraft = async ({ generatePdf = false, forcePdf = false } = {}) => {
    const current = refreshDraftAnalysis(draft)
    const id = current.formData.identification
    if (!current.notionAffaireId || !id.clientName || !id.siteAddress || !id.visitDate) {
      setError(`Impossible d’enregistrer pour le moment : ${getMinimumMissing(current).join(', ')}.`)
      goStep(0)
      return
    }

    if (generatePdf && !forcePdf && current.completenessStatus !== 'Complet') {
      setConfirmPdf(true)
      setError('')
      setMessage('')
      goStep(VISIT_STEPS.length - 1)
      return
    }

    setConfirmPdf(false)
    setBusy(generatePdf ? 'Génération du PDF…' : 'Enregistrement…')
    setError('')
    setMessage('')

    const pdfStatus = current.pdfUrl ? 'pdf_generated' : current.completenessStatus === 'Incomplet' ? 'needs_completion' : current.completenessStatus === 'Complet' ? 'ready_for_pdf' : 'usable_with_reservations'
    const payloadDraft = {
      ...current,
      status: generatePdf ? pdfStatus : current.completenessStatus === 'Incomplet' ? 'needs_completion' : 'draft',
      editableUrl: current.editableUrl || window.location.href,
    }

    try {
      const res = await fetch('/api/visit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action: generatePdf ? 'generatePdf' : 'saveDraft', draft: payloadDraft, summary }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || data.ok === false) throw new Error(data.details || data.error || 'Enregistrement impossible')
      const savedDraft = createDraftVisitReport(data.draft || payloadDraft)
      setDraft(savedDraft)
      setCompletion({ type: generatePdf ? 'pdf' : 'draft', draft: savedDraft, at: new Date().toISOString() })
      setMessage(generatePdf ? 'PDF généré et brouillon sauvegardé.' : 'Brouillon sauvegardé dans Drive.')
      loadDraftList()
      if (data.draft?.editableUrl) window.history.replaceState(null, '', `?id=${data.draft.id}`)
      if (generatePdf) goStep(VISIT_STEPS.length - 1)
    } catch (err) {
      setError(cleanUiError(err.message))
      goStep(VISIT_STEPS.length - 1)
    } finally {
      setBusy('')
    }
  }

  const startNewDraft = () => {
    const next = createDraftVisitReport()
    setDraft(next)
    setStep(0)
    setSearch('')
    setDraftSearch('')
    setMessage('')
    setError('')
    setCompletion(null)
    setConfirmPdf(false)
    window.history.replaceState(null, '', window.location.pathname)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const copySummary = async () => {
    const text = formatSummaryText(summary)
    await navigator.clipboard.writeText(text)
    setMessage('Synthèse copiée.')
  }

  const downloadJson = () => {
    const blob = new Blob([exportDraftJson(analyzedDraft)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `fiche-visite-${analyzedDraft.id}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const filteredAffaires = affaires.filter(a => a.label.toLowerCase().includes(search.toLowerCase())).slice(0, 30)
  const filteredDrafts = remoteDrafts.filter(item => {
    const haystack = [item.affNumber, item.clientName, item.description, item.visitDate].join(' ').toLowerCase()
    return haystack.includes(draftSearch.toLowerCase())
  }).slice(0, 20)
  const canBack = step > 0
  const isFinal = step === VISIT_STEPS.length - 1

  return (
    <div style={s.page}>
      <Header draft={analyzedDraft} onLogout={onLogout} localSave={lastLocalSave} />
      <div style={s.progressWrap}>
        <div style={s.progressBar}><div style={{ ...s.progressFill, width: `${(step / (VISIT_STEPS.length - 1)) * 100}%` }} /></div>
        <div style={s.stepLine}>
          <button style={s.smallGhost} onClick={() => goStep(0)}>Créer</button>
          <span>{VISIT_STEPS[step]}</span>
          <button style={s.smallGhost} onClick={() => goStep(VISIT_STEPS.length - 1)}>Synthèse</button>
        </div>
      </div>

      <main ref={contentRef} style={s.content}>
        {error && <div style={s.errorBanner}>{error}</div>}
        {message && <div style={s.successBanner}>{message}</div>}
        {busy && <div style={s.infoBanner}>{busy}</div>}

        {step === 0 && (
          <Section title="Identification affaire">
            <Field label="Affaire existante">
              <input style={{ ...s.input, marginBottom: 8 }} placeholder="Rechercher AFF ou client" value={search} onChange={e => setSearch(e.target.value)} />
              {!draft.notionAffaireId && !search && <div style={s.hint}>Minimum pour sauvegarder : sélectionner une affaire, client, adresse et date.</div>}
              {draft.notionAffaireId && (
                <div style={s.selectedAff}>
                  <strong>{draft.formData.identification.affNumber}</strong>
                  <span>{draft.formData.identification.clientName}</span>
                  <small>{draft.formData.identification.affaireDescription || 'Description non renseignée'}</small>
                </div>
              )}
              {search && (
                <div style={s.affList}>
                  {filteredAffaires.map(a => (
                    <button key={a.notion_id} style={s.affItem} onClick={() => chooseAffaire(a)}>
                      <strong>{a.aff_number}</strong><br />
                      {a.contact}<br />
                      <span>{a.description}</span>
                    </button>
                  ))}
                  {!filteredAffaires.length && <div style={s.hint}>Aucune affaire trouvée</div>}
                </div>
              )}
            </Field>
            <Field label="Reprendre une fiche existante">
              <input style={{ ...s.input, marginBottom: 8 }} placeholder="Rechercher AFF, cliente ou description" value={draftSearch} onChange={e => setDraftSearch(e.target.value)} />
              <div style={s.affList}>
                {filteredDrafts.map(item => (
                  <button key={item.id} style={s.affItem} onClick={() => loadRemoteDraft(item.id)}>
                    <strong>{item.affNumber || 'AFF ?'}</strong> — {item.clientName || 'Cliente non renseignée'}<br />
                    <span>{item.description || 'Description non renseignée'}</span><br />
                    <small>{item.visitDate || 'Date ?'} · modifié {item.updatedAt ? formatDateTime(item.updatedAt) : '—'}{item.pdfUrl ? ' · PDF généré' : ''}</small>
                  </button>
                ))}
                {!filteredDrafts.length && <div style={s.hint}>Aucun brouillon Drive trouvé pour le moment.</div>}
              </div>
            </Field>
            <TextField label="Nom client" value={draft.formData.identification.clientName} onChange={v => setField('identification', 'clientName', v)} />
            <TextField label="Adresse chantier" value={draft.formData.identification.siteAddress} onChange={v => setField('identification', 'siteAddress', v)} />
            <TextField label="Date visite" type="date" value={draft.formData.identification.visitDate} onChange={v => setField('identification', 'visitDate', v)} />
            <TextField label="Commercial" value={draft.formData.identification.commercial} onChange={v => setField('identification', 'commercial', v)} />
            <SelectField label="Type de visite" value={draft.formData.identification.visitType} onChange={v => setField('identification', 'visitType', v)} options={['Première prise de cotes', 'Contre-visite technique', 'Visite avec sous-traitant', 'Présentation 3D', 'Pré-démarrage chantier', 'Réception', 'SAV']} />
          </Section>
        )}

        {step === 1 && (
          <Section title="Accès chantier">
            <SelectField label="Type de logement" value={draft.formData.access.housingType} onChange={v => setField('access', 'housingType', v)} options={['', 'Appartement', 'Maison', 'Autre']} />
            <TextField label="Étage" placeholder="Ex : 3e étage" value={draft.formData.access.floor} onChange={v => setField('access', 'floor', v)} />
            <SelectField label="Ascenseur" value={draft.formData.access.elevator} onChange={v => setField('access', 'elevator', v)} options={['Oui', 'Non', 'Non renseigné']} />
            <SelectField label="Stationnement" value={draft.formData.access.parking} onChange={v => setField('access', 'parking', v)} options={['Facile', 'Moyen', 'Difficile', 'Non renseigné']} />
            <SelectField label="Accès utilitaire" value={draft.formData.access.utilityAccess} onChange={v => setField('access', 'utilityAccess', v)} options={['Facile', 'Moyen', 'Difficile', 'Non renseigné']} />
            <SelectField label="Protection parties communes nécessaire" value={draft.formData.access.commonAreaProtection} onChange={v => setField('access', 'commonAreaProtection', v)} options={['Oui', 'Non', 'À confirmer']} />
            <TextField label="Horaires copropriété" placeholder="Ex : travaux autorisés 10h-17h" value={draft.formData.access.coproHours} onChange={v => setField('access', 'coproHours', v)} />
            <TextField label="Gardien / syndic" value={draft.formData.access.caretaker} onChange={v => setField('access', 'caretaker', v)} />
            <TextArea label="Contraintes bruit" value={draft.formData.access.noiseConstraints} onChange={v => setField('access', 'noiseConstraints', v)} />
            <TextArea label="Commentaires accès" value={draft.formData.access.comments} onChange={v => setField('access', 'comments', v)} />
          </Section>
        )}

        {step === 2 && <ExistingStep data={draft.formData.existing} setField={setField} />}
        {step === 3 && (
          <Section title="Cotes et photos">
            <TextField label="Longueur mur A" placeholder="Ex : 2,40 m" value={draft.formData.measurements.wallA} onChange={v => setField('measurements', 'wallA', v)} />
            <TextField label="Longueur mur B" placeholder="Ex : 1,80 m" value={draft.formData.measurements.wallB} onChange={v => setField('measurements', 'wallB', v)} />
            <TextField label="Longueur mur C" placeholder="Ex : 2,40 m" value={draft.formData.measurements.wallC} onChange={v => setField('measurements', 'wallC', v)} />
            <TextField label="Longueur mur D" placeholder="Ex : 1,80 m" value={draft.formData.measurements.wallD} onChange={v => setField('measurements', 'wallD', v)} />
            <TextField label="Hauteur sous plafond" placeholder="Ex : 2,50 m" value={draft.formData.measurements.ceilingHeight} onChange={v => setField('measurements', 'ceilingHeight', v)} />
            <TextField label="Largeur porte" placeholder="Ex : 73 cm" value={draft.formData.measurements.doorWidth} onChange={v => setField('measurements', 'doorWidth', v)} />
            <TextArea label="Emplacement évacuation principale" placeholder="Ex : sol, angle mur B/C, diamètre à confirmer" value={draft.formData.measurements.mainDrainLocation} onChange={v => setField('measurements', 'mainDrainLocation', v)} />
            <TextArea label="Emplacement arrivées eau" placeholder="Ex : mur B, à 45 cm du sol" value={draft.formData.measurements.waterInletLocation} onChange={v => setField('measurements', 'waterInletLocation', v)} />
            <TextArea label="Commentaires cotes" value={draft.formData.measurements.comments} onChange={v => setField('measurements', 'comments', v)} />
            <VisitPhotoGrid photos={draft.photos} onUpload={uploadPhoto} onStatus={setPhotoStatus} onRemove={removePhoto} />
          </Section>
        )}
        {step === 4 && <StructureStep data={draft.formData.structure} setField={setField} />}
        {step === 5 && <PlumbingStep data={draft.formData.plumbing} setField={setField} />}
        {step === 6 && <ElectricalStep data={draft.formData.electrical} setField={setField} />}
        {step === 7 && <ProjectStep data={draft.formData.project} setField={setField} />}
        {step === 8 && <MaterialsStep materials={draft.formData.materials} add={addMaterial} update={updateMaterial} remove={removeMaterial} />}
        {step === 9 && (
          <SummaryStep
            draft={analyzedDraft}
            summary={summary}
            onSave={() => saveDraft()}
            onPdf={() => saveDraft({ generatePdf: true })}
            onConfirmPdf={() => saveDraft({ generatePdf: true, forcePdf: true })}
            onCancelPdf={() => setConfirmPdf(false)}
            onCopy={copySummary}
            onJson={downloadJson}
            busy={busy}
            confirmPdf={confirmPdf}
            completion={completion}
            onContinue={() => setCompletion(null)}
            onNew={startNewDraft}
          />
        )}
      </main>

      <nav style={s.nav}>
        {canBack && <button type="button" style={s.backBtn} onClick={() => goStep(step - 1)}>Retour</button>}
        <button type="button" style={s.saveBtn} onClick={() => saveDraft()} disabled={!!busy}>{busy === 'Enregistrement…' ? 'Enregistrement…' : 'Enregistrer le brouillon'}</button>
        {!isFinal && <button type="button" style={s.nextBtn} onClick={() => goStep(step + 1)}>Suivant</button>}
      </nav>

      <style>{`
        * { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
        body, input, textarea, select, button { font-family: 'DM Sans', sans-serif; }
        textarea { resize: vertical; }
      `}</style>
    </div>
  )
}

function Header({ draft, onLogout, localSave }) {
  const label = INTERNAL_STATUS_LABELS[draft.status] || draft.status
  return (
    <header style={s.header}>
      <div>
        <div style={s.logo}>FORTIS<span style={{ color: G.gold }}>.</span></div>
        <div style={s.logoSub}>Brief sous-traitant</div>
      </div>
      <div style={s.headerMeta}>
        <div style={s.badge}>{label} · {draft.completenessStatus}</div>
        <div style={s.micro}>ID {draft.id.slice(0, 8)}</div>
        <div style={s.micro}>Sauvé localement {localSave || '—'}</div>
        {draft.lastPdfGeneratedAt && <div style={s.micro}>PDF {formatDateTime(draft.lastPdfGeneratedAt)}</div>}
      </div>
      <button style={s.logoutBtn} onClick={onLogout}>Quitter</button>
    </header>
  )
}

function ExistingStep({ data, setField }) {
  const yn = ['', 'Oui', 'Non']
  return (
    <Section title="État existant">
      <SelectField label="Type de pièce" value={data.roomType} onChange={v => setField('existing', 'roomType', v)} options={['', 'Salle de bain', 'Salle d’eau', 'WC séparé', 'Suite parentale', 'Autre']} />
      <TextField label="Surface approximative" value={data.approximateSurface} onChange={v => setField('existing', 'approximateSurface', v)} />
      <SelectField label="Douche existante" value={data.existingShower} onChange={v => setField('existing', 'existingShower', v)} options={yn} />
      <SelectField label="Baignoire existante" value={data.existingBathtub} onChange={v => setField('existing', 'existingBathtub', v)} options={yn} />
      <SelectField label="WC existant" value={data.existingToilet} onChange={v => setField('existing', 'existingToilet', v)} options={yn} />
      <SelectField label="Meuble vasque existant" value={data.existingVanity} onChange={v => setField('existing', 'existingVanity', v)} options={yn} />
      <SelectField label="Radiateur / sèche-serviettes" value={data.towelRadiator} onChange={v => setField('existing', 'towelRadiator', v)} options={yn} />
      <SelectField label="Fenêtre" value={data.window} onChange={v => setField('existing', 'window', v)} options={yn} />
      <SelectField label="VMC" value={data.vmc} onChange={v => setField('existing', 'vmc', v)} options={['Oui', 'Non', 'À vérifier']} />
      <SelectField label="Faux plafond" value={data.falseCeiling} onChange={v => setField('existing', 'falseCeiling', v)} options={['Oui', 'Non', 'À vérifier']} />
      <SelectField label="Carrelage sol" value={data.floorTiles} onChange={v => setField('existing', 'floorTiles', v)} options={yn} />
      <SelectField label="Faïence murale" value={data.wallTiles} onChange={v => setField('existing', 'wallTiles', v)} options={yn} />
      <SelectField label="Signes d’humidité" value={data.humiditySigns} onChange={v => setField('existing', 'humiditySigns', v)} options={['Oui', 'Non', 'À vérifier']} />
      <TextArea label="Commentaires existant" value={data.comments} onChange={v => setField('existing', 'comments', v)} />
    </Section>
  )
}

function StructureStep({ data, setField }) {
  const supportOptions = ['Béton', 'Brique', 'Placo', 'Carreau de plâtre', 'Bois', 'Inconnu', 'Non visible / à confirmer']
  const confirm = ['Oui', 'Non', 'À confirmer']
  return (
    <Section title="Structure et supports">
      {['wallA', 'wallB', 'wallC', 'wallD'].map((key, index) => (
        <SelectField key={key} label={`Nature support mur ${String.fromCharCode(65 + index)}`} value={data[key]} onChange={v => setField('structure', key, v)} options={supportOptions} />
      ))}
      <SelectField
        label="Mur porteur ou structure à risque suspectée ?"
        help="Mur épais, béton, bruit plein, ancienne façade, gaine technique ou doute avant ouverture."
        value={data.suspectedLoadBearing}
        onChange={v => setField('structure', 'suspectedLoadBearing', v)}
        options={confirm}
      />
      <SelectField label="Cloison à déposer" value={data.partitionToRemove} onChange={v => setField('structure', 'partitionToRemove', v)} options={confirm} />
      <SelectField label="Création de niche" value={data.nicheCreation} onChange={v => setField('structure', 'nicheCreation', v)} options={confirm} />
      <SelectField label="Renfort meuble suspendu nécessaire" value={data.suspendedVanityReinforcement} onChange={v => setField('structure', 'suspendedVanityReinforcement', v)} options={confirm} />
      <SelectField
        label="Support assez plan/rigide pour grand format ?"
        help="Planéité, fissures, humidité, doublage fragile, besoin ragréage ou reprise support."
        value={data.largeFormatTileCompatible}
        onChange={v => setField('structure', 'largeFormatTileCompatible', v)}
        options={confirm}
      />
      <SelectField label="Humidité visible" value={data.visibleHumidity} onChange={v => setField('structure', 'visibleHumidity', v)} options={confirm} />
      <SelectField label="Fissures visibles" value={data.visibleCracks} onChange={v => setField('structure', 'visibleCracks', v)} options={confirm} />
      <TextArea label="Points à vérifier" value={data.pointsToCheck} onChange={v => setField('structure', 'pointsToCheck', v)} />
    </Section>
  )
}

function PlumbingStep({ data, setField }) {
  return (
    <Section title="Plomberie">
      <SelectField label="Arrivée eau chaude repérée" value={data.hotWaterFound} onChange={v => setField('plumbing', 'hotWaterFound', v)} options={['Oui', 'Non', 'Non visible']} />
      <SelectField label="Arrivée eau froide repérée" value={data.coldWaterFound} onChange={v => setField('plumbing', 'coldWaterFound', v)} options={['Oui', 'Non', 'Non visible']} />
      <SelectField label="Évacuations principales repérées" value={data.mainDrainsFound} onChange={v => setField('plumbing', 'mainDrainsFound', v)} options={['Oui', 'Non', 'Non visible']} />
      <SelectField label="Colonne technique accessible" value={data.technicalColumnAccessible} onChange={v => setField('plumbing', 'technicalColumnAccessible', v)} options={['Oui', 'Non', 'À confirmer']} />
      <TextArea label="Déplacements prévus" placeholder="Ex : douche déplacée mur C, vasque conservée, WC à confirmer" value={data.plannedMoves} onChange={v => setField('plumbing', 'plannedMoves', v)} />
      <SelectField label="Production eau chaude" value={data.hotWaterProduction} onChange={v => setField('plumbing', 'hotWaterProduction', v)} options={['Ballon', 'Chaudière', 'Collective', 'Autre', 'Inconnue']} />
      <TextArea label="Commentaires plomberie" value={data.comments} onChange={v => setField('plumbing', 'comments', v)} />
    </Section>
  )
}

function ElectricalStep({ data, setField }) {
  return (
    <Section title="Électricité / ventilation">
      <SelectField label="Tableau électrique accessible" value={data.panelAccessible} onChange={v => setField('electrical', 'panelAccessible', v)} options={['', 'Oui', 'Non']} />
      <SelectField label="Terre présente" value={data.groundPresent} onChange={v => setField('electrical', 'groundPresent', v)} options={['Oui', 'Non', 'À vérifier']} />
      <TextField label="Nombre de prises existantes" value={data.outletsCount} onChange={v => setField('electrical', 'outletsCount', v)} />
      <TextField label="Points lumineux existants" value={data.lightPoints} onChange={v => setField('electrical', 'lightPoints', v)} />
      <SelectField label="Spots souhaités" value={data.spotsWanted} onChange={v => setField('electrical', 'spotsWanted', v)} options={['Oui', 'Non', 'À confirmer']} />
      <SelectField label="Miroir lumineux souhaité" value={data.illuminatedMirrorWanted} onChange={v => setField('electrical', 'illuminatedMirrorWanted', v)} options={['Oui', 'Non', 'À confirmer']} />
      <SelectField label="Sèche-serviettes électrique souhaité" value={data.electricTowelDryerWanted} onChange={v => setField('electrical', 'electricTowelDryerWanted', v)} options={['Oui', 'Non', 'À confirmer']} />
      <SelectField label="VMC présente" value={data.vmcPresent} onChange={v => setField('electrical', 'vmcPresent', v)} options={['Oui', 'Non', 'À vérifier']} />
      <SelectField label="VMC fonctionnelle" value={data.vmcFunctional} onChange={v => setField('electrical', 'vmcFunctional', v)} options={['Oui', 'Non', 'Non testée']} />
      <SelectField label="Contraintes volume électrique" value={data.electricalVolumeConstraints} onChange={v => setField('electrical', 'electricalVolumeConstraints', v)} options={['Oui', 'Non', 'À vérifier']} />
      <TextArea label="Commentaires électricité" value={data.comments} onChange={v => setField('electrical', 'comments', v)} />
    </Section>
  )
}

function ProjectStep({ data, setField }) {
  return (
    <Section title="Projet client">
      <SelectField label="Type de douche souhaitée" value={data.showerType} onChange={v => setField('project', 'showerType', v)} options={['', 'Receveur extra-plat', 'Douche à l’italienne', 'Baignoire', 'Autre']} />
      <TextField label="Dimensions souhaitées" value={data.desiredDimensions} onChange={v => setField('project', 'desiredDimensions', v)} />
      <SelectField label="Paroi - type" value={data.screen} onChange={v => setField('project', 'screen', v)} options={['Fixe', 'Porte battante', 'Porte coulissante', 'Accès libre', 'À définir']} />
      <SelectField label="Paroi - finition" value={data.screenFinish} onChange={v => setField('project', 'screenFinish', v)} options={['Transparent', 'Fumé', 'Sérigraphié', 'Cannelé', 'À définir']} />
      <SelectField label="Paroi - profilés" value={data.screenProfiles} onChange={v => setField('project', 'screenProfiles', v)} options={['Chromé', 'Noir', 'Laiton', 'Sans profilé', 'À définir']} />
      <TextField label="Paroi - dimensions" placeholder="Ex : fixe 120 cm, hauteur 200 cm" value={data.screenDimensions} onChange={v => setField('project', 'screenDimensions', v)} />
      <SelectField label="Meuble" value={data.vanity} onChange={v => setField('project', 'vanity', v)} options={['Simple vasque', 'Double vasque', 'À définir']} />
      <SelectField label="Pose meuble" value={data.vanityInstall} onChange={v => setField('project', 'vanityInstall', v)} options={['Suspendu', 'Posé', 'À définir']} />
      <SelectField label="Robinetterie" value={data.taps} onChange={v => setField('project', 'taps', v)} options={['Encastrée', 'Apparente', 'À définir']} />
      <SelectField label="WC" value={data.toilet} onChange={v => setField('project', 'toilet', v)} options={['Suspendu', 'Conservé', 'Supprimé', 'À définir']} />
      <SelectField label="Niche douche" value={data.showerNiche} onChange={v => setField('project', 'showerNiche', v)} options={['Oui', 'Non', 'À confirmer']} />
      <SelectField label="Banc / tablette" value={data.benchOrShelf} onChange={v => setField('project', 'benchOrShelf', v)} options={['Oui', 'Non', 'À confirmer']} />
      <SelectField label="Style souhaité" value={data.style} onChange={v => setField('project', 'style', v)} options={['', 'Hôtel', 'Contemporain', 'Naturel', 'Minimaliste', 'Autre']} />
      <SelectField label="Niveau de gamme" value={data.range} onChange={v => setField('project', 'range', v)} options={['Premium', 'Haut de gamme', 'Très haut de gamme']} />
      <TextArea label="Commentaires client" value={data.clientComments} onChange={v => setField('project', 'clientComments', v)} />
    </Section>
  )
}

function MaterialsStep({ materials, add, update, remove }) {
  return (
    <Section title="Matériaux">
      {materials.map(line => (
        <div key={line.id} style={s.materialCard}>
          <SelectField label="Catégorie" value={line.category} onChange={v => update(line.id, 'category', v)} options={['', ...MATERIAL_CATEGORIES]} />
          <SelectField label="Fournisseur pressenti" value={line.provider} onChange={v => update(line.id, 'provider', v)} options={['', ...PROVIDERS]} />
          <TextField label="Marque" value={line.brand} onChange={v => update(line.id, 'brand', v)} />
          <TextField label="Référence" value={line.reference} onChange={v => update(line.id, 'reference', v)} />
          <TextField label="Coloris / finition" value={line.finish} onChange={v => update(line.id, 'finish', v)} />
          <TextField label="Dimension" value={line.dimension} onChange={v => update(line.id, 'dimension', v)} />
          <SelectField label="Statut" value={line.status} onChange={v => update(line.id, 'status', v)} options={MATERIAL_STATUSES} />
          <TextArea label="Commentaire" value={line.comment} onChange={v => update(line.id, 'comment', v)} />
          <button style={s.deleteBtn} onClick={() => remove(line.id)}>Supprimer cette ligne</button>
        </div>
      ))}
      <button style={s.addBtn} onClick={add}>Ajouter un matériau</button>
    </Section>
  )
}

function SummaryStep({ draft, summary, onSave, onPdf, onConfirmPdf, onCancelPdf, onCopy, onJson, busy, confirmPdf, completion, onContinue, onNew }) {
  const hasMissing = draft.missingFields?.length > 0
  const hasReservations = draft.reservations?.length > 0
  const isGenerating = busy === 'Génération du PDF…'
  const isSaving = busy === 'Enregistrement…'

  return (
    <Section title="Synthèse">
      {completion && (
        <div style={s.confirmationBox}>
          <div style={s.confirmationTitle}>{completion.type === 'pdf' ? 'PDF généré' : 'Brouillon enregistré'}</div>
          <div style={s.confirmationText}>
            {completion.type === 'pdf'
              ? 'La fiche a été sauvegardée puis le brief sous-traitant a été généré dans Drive.'
              : 'La fiche a été sauvegardée dans Drive. Tu peux la rouvrir plus tard depuis la liste des brouillons.'}
          </div>
          <div style={s.confirmationLinks}>
            {completion.draft?.draftFileUrl && <a style={s.inlineLink} href={completion.draft.draftFileUrl} target="_blank" rel="noreferrer">Ouvrir le brouillon Drive</a>}
            {completion.draft?.pdfUrl && <a style={s.inlineLink} href={completion.draft.pdfUrl} target="_blank" rel="noreferrer">Ouvrir le PDF</a>}
          </div>
          <div style={s.actionGrid}>
            <button type="button" style={s.actionBtn} onClick={onContinue}>Continuer à modifier</button>
            <button type="button" style={s.actionBtn} onClick={onNew}>Nouvelle fiche</button>
          </div>
        </div>
      )}
      <div style={draft.completenessStatus === 'Complet' ? s.completeBox : draft.completenessStatus === 'Incomplet' ? s.warnBox : s.reserveBox}>
        Niveau de complétude : <strong>{draft.completenessStatus}</strong>
      </div>
      {hasMissing && (
        <ChecklistBox
          title="Champs manquants pour un dossier complet"
          tone="danger"
          items={draft.missingFields}
        />
      )}
      {hasReservations && (
        <ChecklistBox
          title="Réserves à confirmer"
          tone="warning"
          items={draft.reservations}
          limit={18}
        />
      )}
      {confirmPdf && (
        <div style={s.pdfConfirmBox}>
          <div style={s.confirmationTitle}>Générer quand même ?</div>
          <div style={s.confirmationText}>
            Le PDF restera possible, mais il indiquera clairement les réserves et les champs manquants.
          </div>
          <div style={s.actionGrid}>
            <button type="button" style={s.actionPrimary} onClick={onConfirmPdf} disabled={!!busy}>{isGenerating ? 'Génération…' : 'Oui, générer le PDF'}</button>
            <button type="button" style={s.actionBtn} onClick={onCancelPdf} disabled={!!busy}>Annuler</button>
          </div>
        </div>
      )}
      <SummaryBlock title="Résumé projet" text={summary.projectSummary} />
      <SummaryBlock title="Contraintes chantier" text={summary.siteConstraints} />
      <SummaryBlock title="Contraintes techniques" text={summary.technicalConstraints} />
      <SummaryBlock title="Matériaux connus" text={summary.knownMaterials} />
      <SummaryBlock title="Matériaux à confirmer" text={summary.materialsToConfirm} />
      <SummaryBlock title="Points bloquants" text={summary.blockingPoints} />
      <SummaryBlock title="Questions sous-traitant" text={summary.subcontractorQuestions} />
      {draft.pdfUrl && <a style={s.pdfLink} href={draft.pdfUrl} target="_blank" rel="noreferrer">Ouvrir le dernier PDF</a>}
      <div style={s.actionGrid}>
        <button type="button" style={s.actionBtn} onClick={onSave} disabled={!!busy}>{isSaving ? 'Enregistrement…' : 'Enregistrer le brouillon'}</button>
        <button type="button" style={s.actionPrimary} onClick={onPdf} disabled={!!busy}>{isGenerating ? 'Génération…' : draft.pdfUrl ? 'Régénérer le PDF' : 'Générer le PDF même incomplet'}</button>
        <button type="button" style={s.actionBtn} onClick={onCopy} disabled={!!busy}>Copier le résumé</button>
        <button type="button" style={s.actionBtn} onClick={onJson} disabled={!!busy}>Exporter JSON</button>
      </div>
    </Section>
  )
}

function ChecklistBox({ title, items, tone = 'warning', limit = 999 }) {
  const visible = items.slice(0, limit)
  const remaining = items.length - visible.length
  return (
    <div style={tone === 'danger' ? s.checklistDanger : s.checklistWarn}>
      <div style={s.checklistTitle}>{title}</div>
      <ul style={s.checklist}>
        {visible.map(item => <li key={item}>{item}</li>)}
      </ul>
      {remaining > 0 && <div style={s.help}>+ {remaining} autre{remaining > 1 ? 's' : ''} réserve{remaining > 1 ? 's' : ''}</div>}
    </div>
  )
}

function Section({ title, children }) {
  return (
    <section>
      <h1 style={s.title}>{title}</h1>
      {children}
    </section>
  )
}

function Field({ label, children }) {
  return (
    <div style={s.field}>
      <label style={s.label}>{label}</label>
      {children}
    </div>
  )
}

function TextField({ label, value, onChange, type = 'text', placeholder = '' }) {
  return (
    <Field label={label}>
      <input style={s.input} type={type} placeholder={placeholder} value={value || ''} onChange={e => onChange(e.target.value)} />
    </Field>
  )
}

function TextArea({ label, value, onChange, placeholder = '' }) {
  return (
    <Field label={label}>
      <textarea style={s.textarea} rows={3} placeholder={placeholder} value={value || ''} onChange={e => onChange(e.target.value)} />
    </Field>
  )
}

function SelectField({ label, value, onChange, options, help = '' }) {
  return (
    <Field label={label}>
      <select style={s.input} value={value || ''} onChange={e => onChange(e.target.value)}>
        {options.map(option => <option key={option} value={option}>{option || 'Non renseigné'}</option>)}
      </select>
      {help && <div style={s.help}>{help}</div>}
    </Field>
  )
}

function SummaryBlock({ title, text }) {
  return (
    <div style={s.summaryBlock}>
      <div style={s.summaryTitle}>{title}</div>
      <div style={s.summaryText}>{text}</div>
    </div>
  )
}

function formatSummaryText(summary) {
  return [
    `Résumé projet\n${summary.projectSummary}`,
    `Contraintes chantier\n${summary.siteConstraints}`,
    `Contraintes techniques\n${summary.technicalConstraints}`,
    `Matériaux connus\n${summary.knownMaterials}`,
    `Matériaux à confirmer\n${summary.materialsToConfirm}`,
    `Points bloquants\n${summary.blockingPoints}`,
    `Questions sous-traitant\n${summary.subcontractorQuestions}`,
    `Complétude\n${summary.completeness}`,
  ].join('\n\n')
}

function formatDateTime(value) {
  return new Date(value).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })
}

function getMinimumMissing(draft) {
  const id = draft.formData.identification
  return [
    !draft.notionAffaireId && 'affaire sélectionnée',
    !id.clientName && 'nom client',
    !id.siteAddress && 'adresse chantier',
    !id.visitDate && 'date de visite',
  ].filter(Boolean)
}

function cleanUiError(value) {
  const raw = String(value || '').trim()
  const lower = raw.toLowerCase()
  if (lower.includes('<!doctype html') || lower.includes('<html') || lower.includes('page not found') || lower.includes('file you have requested does not exist')) {
    return 'PDF.co a renvoyé une page Google Drive introuvable au lieu du PDF. Relance la génération ; si le problème revient, vérifie la clé PDF.co et l’URL du webhook Apps Script.'
  }
  return raw.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').slice(0, 700) || 'Erreur inconnue.'
}

const s = {
  page: {
    minHeight: '100dvh',
    background: G.dark,
    color: G.ink,
    fontFamily: "'DM Sans', sans-serif",
    maxWidth: 680,
    margin: '0 auto',
    display: 'flex',
    flexDirection: 'column',
  },
  header: {
    background: G.dark,
    color: G.white,
    padding: '14px 16px',
    display: 'grid',
    gridTemplateColumns: '1fr auto',
    gap: 12,
    alignItems: 'start',
  },
  logo: { fontFamily: "'Bodoni Moda', serif", fontSize: 18, fontWeight: 700, letterSpacing: '0.04em' },
  logoSub: { fontSize: 9, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.45)' },
  headerMeta: { gridColumn: '1 / -1', display: 'flex', flexWrap: 'wrap', gap: 6 },
  badge: { background: 'rgba(184,151,90,0.16)', color: G.gold, border: `1px solid ${G.border}`, borderRadius: 4, padding: '5px 8px', fontSize: 11, fontWeight: 700 },
  micro: { color: 'rgba(255,255,255,0.48)', fontSize: 11, paddingTop: 5 },
  logoutBtn: { gridColumn: 2, gridRow: 1, border: `1px solid ${G.gold}`, background: G.gold, color: G.dark, borderRadius: 4, padding: '10px 12px', fontWeight: 700 },
  progressWrap: { background: G.dark, padding: '0 16px 14px' },
  progressBar: { height: 2, background: 'rgba(255,255,255,0.1)', overflow: 'hidden', borderRadius: 2, marginBottom: 8 },
  progressFill: { height: '100%', background: G.gold, transition: 'width 0.2s ease' },
  stepLine: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: 'rgba(255,255,255,0.55)', fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase' },
  smallGhost: { border: 'none', background: 'transparent', color: G.gold, padding: 0, fontSize: 11 },
  content: { flex: 1, background: G.paper, padding: '22px 16px 96px', overflowY: 'auto' },
  title: { fontFamily: "'Bodoni Moda', serif", fontSize: 28, lineHeight: 1.1, margin: '0 0 22px', color: G.ink },
  field: { marginBottom: 16 },
  label: { display: 'block', color: G.gold, fontSize: 10, fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', marginBottom: 7 },
  input: { width: '100%', minHeight: 48, border: `0.5px solid ${G.border}`, borderRadius: 4, background: G.white, color: G.ink, padding: '12px 13px', fontSize: 15, outline: 'none' },
  textarea: { width: '100%', border: `0.5px solid ${G.border}`, borderRadius: 4, background: G.white, color: G.ink, padding: '12px 13px', fontSize: 15, lineHeight: 1.5, outline: 'none' },
  row: { display: 'grid', gridTemplateColumns: '1fr auto', gap: 8 },
  inlineBtn: { border: 'none', borderRadius: 4, background: G.dark, color: G.gold, padding: '0 14px', fontWeight: 700 },
  affList: { border: `0.5px solid ${G.border}`, borderRadius: 4, overflow: 'hidden', background: G.white },
  affItem: { width: '100%', textAlign: 'left', padding: 12, border: 'none', borderBottom: `0.5px solid ${G.border}`, background: G.white, color: G.ink },
  selectedAff: { background: 'rgba(184,151,90,0.08)', border: `1px solid ${G.border}`, borderRadius: 4, padding: 12, marginBottom: 8, display: 'grid', gap: 3 },
  hint: { padding: 12, color: G.soft, fontSize: 13 },
  help: { color: G.soft, fontSize: 12, lineHeight: 1.45, marginTop: 6 },
  nav: { position: 'fixed', left: '50%', bottom: 0, transform: 'translateX(-50%)', width: '100%', maxWidth: 680, background: G.white, borderTop: `0.5px solid ${G.border}`, display: 'grid', gridTemplateColumns: 'auto 1fr auto', gap: 8, padding: '12px 12px calc(12px + env(safe-area-inset-bottom))', zIndex: 10 },
  backBtn: { border: `0.5px solid rgba(26,26,24,0.2)`, background: G.white, color: G.soft, borderRadius: 4, padding: '12px 10px' },
  saveBtn: { border: `1px solid ${G.gold}`, background: G.white, color: G.gold, borderRadius: 4, padding: '12px 10px', fontWeight: 700 },
  nextBtn: { border: 'none', background: G.dark, color: G.gold, borderRadius: 4, padding: '12px 14px', fontWeight: 700 },
  errorBanner: { background: 'rgba(159,50,50,0.08)', border: '1px solid rgba(159,50,50,0.2)', color: G.danger, padding: 12, borderRadius: 4, marginBottom: 14, fontSize: 13 },
  successBanner: { background: 'rgba(47,109,79,0.08)', border: '1px solid rgba(47,109,79,0.2)', color: G.success, padding: 12, borderRadius: 4, marginBottom: 14, fontSize: 13 },
  infoBanner: { background: 'rgba(184,151,90,0.1)', border: `1px solid ${G.border}`, color: G.warning, padding: 12, borderRadius: 4, marginBottom: 14, fontSize: 13 },
  materialCard: { background: G.white, border: `0.5px solid ${G.border}`, borderRadius: 6, padding: 12, marginBottom: 12 },
  addBtn: { width: '100%', minHeight: 48, border: `1px dashed ${G.gold}`, background: 'rgba(184,151,90,0.06)', color: G.gold, borderRadius: 4, fontWeight: 700 },
  deleteBtn: { width: '100%', minHeight: 42, border: 'none', background: 'rgba(159,50,50,0.08)', color: G.danger, borderRadius: 4, fontWeight: 700 },
  summaryBlock: { background: G.white, borderLeft: `2px solid ${G.gold}`, padding: 12, marginBottom: 12, whiteSpace: 'pre-wrap' },
  summaryTitle: { color: G.gold, fontSize: 10, fontWeight: 800, letterSpacing: '0.16em', textTransform: 'uppercase', marginBottom: 7 },
  summaryText: { color: G.ink, fontSize: 13, lineHeight: 1.6 },
  confirmationBox: { background: 'rgba(47,109,79,0.1)', border: '1px solid rgba(47,109,79,0.25)', color: G.ink, padding: 14, borderRadius: 4, marginBottom: 12 },
  pdfConfirmBox: { background: 'rgba(184,151,90,0.12)', border: `1px solid ${G.border}`, color: G.ink, padding: 14, borderRadius: 4, marginBottom: 12 },
  confirmationTitle: { color: G.gold, fontSize: 12, fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 7 },
  confirmationText: { color: G.ink, fontSize: 13, lineHeight: 1.55, marginBottom: 10 },
  confirmationLinks: { display: 'grid', gap: 8, marginBottom: 10 },
  inlineLink: { color: G.success, fontWeight: 800, textDecoration: 'none' },
  checklistDanger: { background: 'rgba(159,50,50,0.08)', border: '1px solid rgba(159,50,50,0.18)', color: G.ink, padding: 12, borderRadius: 4, marginBottom: 12 },
  checklistWarn: { background: 'rgba(184,151,90,0.1)', border: `1px solid ${G.border}`, color: G.ink, padding: 12, borderRadius: 4, marginBottom: 12 },
  checklistTitle: { color: G.gold, fontSize: 10, fontWeight: 800, letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: 7 },
  checklist: { margin: 0, paddingLeft: 18, color: G.ink, fontSize: 13, lineHeight: 1.55 },
  completeBox: { background: 'rgba(47,109,79,0.1)', color: G.success, padding: 12, borderRadius: 4, marginBottom: 12 },
  reserveBox: { background: 'rgba(184,151,90,0.14)', color: G.warning, padding: 12, borderRadius: 4, marginBottom: 12 },
  warnBox: { background: 'rgba(159,50,50,0.08)', color: G.danger, padding: 12, borderRadius: 4, marginBottom: 12 },
  pdfLink: { display: 'block', background: G.dark, color: G.gold, textAlign: 'center', padding: 14, borderRadius: 4, textDecoration: 'none', fontWeight: 700, marginBottom: 12 },
  actionGrid: { display: 'grid', gridTemplateColumns: '1fr', gap: 8 },
  actionBtn: { minHeight: 48, border: `1px solid ${G.gold}`, background: G.white, color: G.gold, borderRadius: 4, fontWeight: 700 },
  actionPrimary: { minHeight: 52, border: 'none', background: G.dark, color: G.gold, borderRadius: 4, fontWeight: 800 },
}
