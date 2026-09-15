import { useEffect, useState } from 'react'
import { MapContainer, Marker, Popup, TileLayer, Tooltip, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import './App.css'
import logoUrl from './assets/logo.png'

const DEFAULT_CENTER = [-27.4698, 153.0251]

function parseLocation(location) {
  if (typeof location !== 'string') return null
  const [latitude, longitude] = location.split(',').map(Number)
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) return null
  return [Number(latitude.toFixed(3)), Number(longitude.toFixed(3))]
}

function createMarkerIcon(user, isCurrentUser) {
  const initials = user.username
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()

  return L.divIcon({
    className: `user-marker${isCurrentUser ? ' user-marker--current' : ''}`,
    html: `<span>${initials || '?'}</span>`,
    iconSize: [42, 42],
    iconAnchor: [21, 21],
    popupAnchor: [0, -24],
  })
}

function FitUsers({ positions }) {
  const map = useMap()
  const [hasFitted, setHasFitted] = useState(false)

  useEffect(() => {
    if (hasFitted || positions.length === 0) return
    map.fitBounds(positions, { padding: [36, 36], maxZoom: 14 })
    setHasFitted(true)
  }, [hasFitted, map, positions])

  return null
}

async function request(path, options = {}) {
  const accessToken = localStorage.getItem('access_token')
  const response = await fetch(path, {
    headers: {
      'Content-Type': 'application/json',
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
    ...options,
  })
  const data = await response.json()
  if (!response.ok) throw new Error(data.error || 'Request failed')
  return data
}

function App() {
  const [location, setLocation] = useState(() => localStorage.getItem('location') || '')
  const [accessToken, setAccessToken] = useState(() => localStorage.getItem('access_token'))
  const [users, setUsers] = useState([])
  const [status, setStatus] = useState('Location permission is required to share your location.')
  const [locationEnabled, setLocationEnabled] = useState(() => Boolean(localStorage.getItem('location')))
  const [sessionChecked, setSessionChecked] = useState(false)

  useEffect(() => {
    let favicon = document.querySelector('link[rel="icon"]')
    if (!favicon) {
      favicon = document.createElement('link')
      favicon.rel = 'icon'
      document.head.appendChild(favicon)
    }
    favicon.type = 'image/png'
    favicon.href = logoUrl
  }, [])

  const poll = async () => {
    try {
      setUsers(await request('/api/poll'))
    } catch (error) {
      setStatus(error.message)
    }
  }

  useEffect(() => {
    if (!accessToken) {
      setSessionChecked(true)
      return undefined
    }

    setSessionChecked(false)
    request('/api/session')
      .then(() => setSessionChecked(true))
      .catch(() => {
        localStorage.removeItem('access_token')
        setAccessToken(null)
        setLocationEnabled(false)
        setSessionChecked(true)
        setStatus('Your previous session is no longer available. Please sign up again.')
      })
  }, [accessToken])

  useEffect(() => {
    const updateAndPoll = async () => {
      if (!sessionChecked) return
      if (accessToken && locationEnabled && navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(async ({ coords }) => {
          const currentLocation = `${coords.latitude},${coords.longitude}`
          setLocation(currentLocation)
          localStorage.setItem('location', currentLocation)
          try {
            await request('/api/update', {
              method: 'PUT',
              body: JSON.stringify({ location: currentLocation }),
            })
          } catch (error) {
            setStatus(error.message)
          }
          await poll()
        }, () => setStatus('Unable to update your location.'))
        return
      }
      await poll()
    }

    updateAndPoll()
    const intervalId = window.setInterval(updateAndPoll, 15000)
    return () => window.clearInterval(intervalId)
  }, [accessToken, locationEnabled, sessionChecked])

  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get('code')
    if (!code) return

    const callbackKey = `spotify_code_${code}`
    if (sessionStorage.getItem(callbackKey)) return
    sessionStorage.setItem(callbackKey, 'processing')
    window.history.replaceState({}, document.title, window.location.pathname)

    request('/api/signup', {
      method: 'POST',
      body: JSON.stringify({ code, location: localStorage.getItem('location') || null }),
    }).then(({ access_token: createdAccessToken }) => {
      localStorage.setItem('access_token', createdAccessToken)
      setAccessToken(createdAccessToken)
      setSessionChecked(true)
      const savedLocation = localStorage.getItem('location')
      if (savedLocation) {
        setLocation(savedLocation)
        setLocationEnabled(true)
      }
      setStatus('Spotify connected.')
      poll()
    }).catch((error) => {
      sessionStorage.removeItem(callbackKey)
      setStatus(error.message)
    })
  }, [])

  const requestLocation = () => new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Location is not supported by this browser.'))
      return
    }
    navigator.geolocation.getCurrentPosition(({ coords }) => {
      const currentLocation = `${coords.latitude},${coords.longitude}`
      setLocation(currentLocation)
      localStorage.setItem('location', currentLocation)
      setLocationEnabled(true)
      resolve(currentLocation)
    }, () => reject(new Error('Location permission was denied.')))
  })

  const signUp = async () => {
    setStatus('Requesting location permission...')
    try {
      await requestLocation()
      setStatus('Redirecting to Spotify...')
      const { redirect_url: redirectUrl } = await request('/api/authorise', { method: 'POST' })
      window.location.assign(redirectUrl)
    } catch (error) {
      setStatus(error.message)
    }
  }

  const mappedUsers = users
    .map((user) => ({ ...user, coordinates: parseLocation(user.location) }))
    .filter((user) => user.coordinates)
  const sharedCoordinates = parseLocation(location)
  const mapPositions = mappedUsers.map((user) => user.coordinates)

  return (
    <main className="app-shell">
      <header className="app-header">
        <div>
          <h1>Spot-ify</h1>
          <p className="eyebrow">DECCO3500 University Assignment</p>
          <p className="status" role="status">{status}</p>
        </div>
        <div className="actions">
          {!accessToken && <button type="button" onClick={signUp}>Sign up with Spotify</button>}
        </div>
      </header>

      <section className="map-section" aria-label="User locations">
        <MapContainer center={DEFAULT_CENTER} zoom={3} scrollWheelZoom className="map">
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <FitUsers positions={mapPositions} />
          {mappedUsers.map((user) => {
            const isCurrentUser = sharedCoordinates?.[0] === user.coordinates[0]
              && sharedCoordinates?.[1] === user.coordinates[1]
            return (
              <Marker
                key={`${user.username}-${user.coordinates.join(',')}`}
                position={user.coordinates}
                icon={createMarkerIcon(user, isCurrentUser)}
              >
                <Tooltip direction="top" offset={[0, -18]}>{user.username}</Tooltip>
                <Popup>
                  <strong>{user.username}{isCurrentUser ? ' (you)' : ''}</strong>
                  <br />{user.song || 'No song playing'}
                </Popup>
              </Marker>
            )
          })}
        </MapContainer>
        {mappedUsers.length === 0 && <p className="empty-state">No shared locations are available yet.</p>}
      </section>

      <footer className="app-footer">
        <span>{accessToken ? 'Spotify connected' : 'Spotify not connected'}</span>
        <span>{mappedUsers.length} {mappedUsers.length === 1 ? 'listener' : 'listeners'} on the map</span>
      </footer>
    </main>
  )
}

export default App
