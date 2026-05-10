import { useState } from 'react'
import { G } from '../utils/colors.js'

export default function PinScreen({ onAuth }) {
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'PIN incorrect')
      onAuth(data.token)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={s.page}>
      <form style={s.card} onSubmit={submit}>
        <div style={s.logo}>FORTIS<span style={{ color: G.gold }}>.</span></div>
        <div style={s.subtitle}>Fiche visite salle de bain</div>
        <input
          style={s.input}
          type="password"
          inputMode="numeric"
          placeholder="PIN"
          value={pin}
          onChange={e => setPin(e.target.value)}
          autoFocus
        />
        {error && <div style={s.error}>{error}</div>}
        <button style={s.button} disabled={loading}>{loading ? 'Vérification…' : 'Entrer'}</button>
      </form>
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
    padding: 24,
    fontFamily: "'DM Sans', sans-serif",
  },
  card: { width: '100%', maxWidth: 380, textAlign: 'center' },
  logo: {
    fontFamily: "'Bodoni Moda', serif",
    fontSize: 34,
    color: G.white,
    letterSpacing: '0.04em',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.45)',
    textTransform: 'uppercase',
    letterSpacing: '0.2em',
    marginBottom: 34,
  },
  input: {
    width: '100%',
    padding: '16px 14px',
    borderRadius: 4,
    border: `1px solid ${G.gold}`,
    background: G.white,
    color: G.ink,
    fontSize: 18,
    textAlign: 'center',
    outline: 'none',
    marginBottom: 12,
  },
  button: {
    width: '100%',
    minHeight: 52,
    border: 'none',
    borderRadius: 4,
    background: G.gold,
    color: G.dark,
    fontSize: 14,
    fontWeight: 700,
    letterSpacing: '0.12em',
    textTransform: 'uppercase',
    cursor: 'pointer',
  },
  error: {
    color: '#ffb4a8',
    fontSize: 13,
    marginBottom: 12,
  },
}

