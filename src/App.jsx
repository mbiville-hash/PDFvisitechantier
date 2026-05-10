import { useEffect, useState } from 'react'
import PinScreen from './components/PinScreen.jsx'
import BathroomVisitForm from './components/BathroomVisitForm.jsx'
import { G } from './utils/colors.js'

export default function App() {
  const [token, setToken] = useState(() => sessionStorage.getItem('visit_token'))

  const handleAuth = (newToken) => {
    sessionStorage.setItem('visit_token', newToken)
    setToken(newToken)
  }

  const logout = () => {
    sessionStorage.removeItem('visit_token')
    setToken('')
  }

  useEffect(() => {
    document.body.style.margin = '0'
    document.body.style.background = G.dark
  }, [])

  if (!token) return <PinScreen onAuth={handleAuth} />
  return <BathroomVisitForm token={token} onLogout={logout} />
}

