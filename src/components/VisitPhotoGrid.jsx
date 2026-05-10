import { useRef } from 'react'
import { G } from '../utils/colors.js'
import { PHOTO_STATUSES } from '../visit/visitData.js'

export default function VisitPhotoGrid({ photos, onUpload, onStatus, onRemove }) {
  return (
    <div style={s.wrap}>
      {Object.values(photos).map(photo => (
        <PhotoSlot
          key={photo.key}
          photo={photo}
          onUpload={file => onUpload(photo.key, file)}
          onStatus={status => onStatus(photo.key, status)}
          onRemove={() => onRemove(photo.key)}
        />
      ))}
    </div>
  )
}

function PhotoSlot({ photo, onUpload, onStatus, onRemove }) {
  const inputRef = useRef()
  const hasImage = photo.status === 'Ajoutée' && photo.url

  return (
    <div style={s.slot}>
      <div style={s.slotHeader}>
        <div style={s.title}>{photo.label}</div>
        {hasImage && <button style={s.remove} onClick={onRemove}>Retirer</button>}
      </div>
      <div style={s.photoBox} onClick={() => inputRef.current?.click()}>
        {hasImage ? (
          <img src={photo.preview || photo.url} alt={photo.label} style={s.img} />
        ) : photo.uploading ? (
          <div style={s.muted}>Upload…</div>
        ) : (
          <div style={s.addText}>Ajouter une photo</div>
        )}
      </div>
      <select style={s.select} value={photo.status} onChange={e => onStatus(e.target.value)}>
        {PHOTO_STATUSES.map(status => <option key={status}>{status}</option>)}
      </select>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        style={{ display: 'none' }}
        onChange={e => {
          const file = e.target.files?.[0]
          e.target.value = ''
          if (file) onUpload(file)
        }}
      />
    </div>
  )
}

const s = {
  wrap: {
    display: 'grid',
    gridTemplateColumns: '1fr',
    gap: 12,
  },
  slot: {
    background: G.white,
    border: `0.5px solid ${G.border}`,
    borderRadius: 6,
    padding: 10,
  },
  slotHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
  },
  title: {
    fontSize: 12,
    fontWeight: 700,
    color: G.ink,
  },
  remove: {
    border: 'none',
    background: 'transparent',
    color: G.danger,
    fontSize: 12,
    cursor: 'pointer',
  },
  photoBox: {
    aspectRatio: '4/3',
    borderRadius: 4,
    background: '#ece8df',
    border: `1px dashed ${G.border}`,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    cursor: 'pointer',
    marginBottom: 8,
  },
  img: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    display: 'block',
  },
  addText: {
    color: G.gold,
    fontSize: 12,
    letterSpacing: '0.06em',
  },
  muted: {
    color: G.soft,
    fontSize: 12,
  },
  select: {
    width: '100%',
    minHeight: 42,
    border: `0.5px solid ${G.border}`,
    borderRadius: 4,
    background: G.white,
    color: G.ink,
    padding: '0 10px',
  },
}

