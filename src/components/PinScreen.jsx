import { useState } from 'react'
import { G } from '../utils/colors.js'

export default function PinScreen({ onAuth }) {
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleKey = (digit) => {
    if (pin.length >= 4 || loading) return
    const next = pin + digit
    setPin(next)
    setError('')
    if (next.length === 4) submit(next)
  }

  const handleDelete = () => {
    if (loading) return
    setPin(p => p.slice(0, -1))
    setError('')
  }

  const submit = async (code) => {
    setLoading(true)
    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: code }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Code incorrect')
      onAuth(data.token)
    } catch (err) {
      setError(err.message || 'Erreur de connexion')
      setPin('')
    } finally {
      setLoading(false)
    }
  }

  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '⌫']

  return (
    <div style={s.page}>
      <div style={s.wrap}>
        <div style={s.logoName}>FORTIS RÉNOVATION<span style={{ color: G.gold }}>.</span></div>
        <div style={s.logoSub}>Fiche visite salle de bain</div>

        <div style={s.dotsRow}>
          {[0, 1, 2, 3].map(i => (
            <div key={i} style={{ ...s.dot, background: i < pin.length ? G.gold : 'rgba(255,255,255,0.15)' }} />
          ))}
        </div>

        <div style={s.feedback}>
          {error || (loading ? 'Vérification…' : 'Saisissez votre code PIN')}
        </div>

        <div style={s.grid}>
          {keys.map((key, i) => (
            <button
              key={i}
              type="button"
              style={{ ...s.key, ...(key === '' ? s.keyEmpty : {}), ...(key === '⌫' ? s.keyDel : {}) }}
              onClick={() => key === '⌫' ? handleDelete() : key ? handleKey(key) : null}
              disabled={loading || key === ''}
            >
              {key}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

const s = {
  page: {
    minHeight: '100dvh',
    background: G.dark,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontFamily: "'DM Sans', sans-serif",
    padding: 24,
  },
  wrap: {
    width: '100%',
    maxWidth: 320,
    textAlign: 'center',
  },
  logoName: {
    fontFamily: "'Bodoni Moda', serif",
    fontSize: 22,
    fontWeight: 700,
    color: '#fff',
    letterSpacing: '0.04em',
    marginBottom: 6,
  },
  logoSub: {
    fontSize: 11,
    fontWeight: 500,
    letterSpacing: '0.2em',
    textTransform: 'uppercase',
    color: 'rgba(255,255,255,0.4)',
    marginBottom: 48,
  },
  dotsRow: {
    display: 'flex',
    justifyContent: 'center',
    gap: 16,
    marginBottom: 12,
  },
  dot: {
    width: 14,
    height: 14,
    borderRadius: '50%',
    transition: 'background 0.15s',
  },
  feedback: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.48)',
    marginBottom: 8,
    minHeight: 20,
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: 12,
    marginTop: 32,
  },
  key: {
    height: 64,
    borderRadius: 4,
    border: '1px solid rgba(255,255,255,0.1)',
    background: 'rgba(255,255,255,0.05)',
    color: '#fff',
    fontSize: 22,
    fontWeight: 300,
    cursor: 'pointer',
    WebkitTapHighlightColor: 'transparent',
  },
  keyEmpty: {
    background: 'transparent',
    border: 'none',
    cursor: 'default',
  },
  keyDel: {
    fontSize: 18,
    color: 'rgba(255,255,255,0.5)',
  },
}
