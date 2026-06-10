const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000'

export async function signIn(email, password) {
  const res = await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Login failed')
  return data // { session_id, access_token, user_id, pen_name }
}

export async function checkEmailExists(email) {
  const res = await fetch(`${API_URL}/auth/check-email?email=${encodeURIComponent(email)}`, {
    credentials: 'include',
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Could not verify email')
  return { exists: data.exists, confirmed: data.confirmed ?? true }
}

export async function resendVerification(email) {
  const res = await fetch(`${API_URL}/auth/resend-verification`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Failed to resend email')
  return data
}

export async function signUp(email, password, penName, birthYear) {
  const res = await fetch(`${API_URL}/auth/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, pen_name: penName, birth_year: birthYear }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Signup failed')
  return data // { user_id, pen_name }
}
