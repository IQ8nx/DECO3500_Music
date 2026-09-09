import { useState } from 'react'

async function request(path, options = {}) {
  const response = await fetch(path, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })
  const data = await response.json()
  return JSON.stringify(data, null, 2)
}

function App() {
  const [location, setLocation] = useState('')
  const [code, setCode] = useState('')
  const [userId, setUserId] = useState('')
  const [output, setOutput] = useState('')

  const callApi = async (path, options) => {
    try {
      setOutput(await request(path, options))
    } catch (error) {
      setOutput(String(error))
    }
  }

  return (
    <main>
      <button type="button" onClick={() => callApi('/api/poll')}>Poll</button>
      <button type="button" onClick={() => callApi('/api/authorise', { method: 'POST' })}>Authorise</button>
      <p>
        <input placeholder="location" value={location} onChange={(event) => setLocation(event.target.value)} />
        <input placeholder="code" value={code} onChange={(event) => setCode(event.target.value)} />
        <button type="button" onClick={() => callApi('/api/signup', { method: 'POST', body: JSON.stringify({ location, code }) })}>Signup</button>
      </p>
      <p>
        <input placeholder="user id" value={userId} onChange={(event) => setUserId(event.target.value)} />
        <input placeholder="location" value={location} onChange={(event) => setLocation(event.target.value)} />
        <button type="button" onClick={() => callApi('/api/update', { method: 'PUT', body: JSON.stringify({ user_id: userId, location }) })}>Update</button>
      </p>
      <pre>{output}</pre>
    </main>
  )
}

export default App
