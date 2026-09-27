export const API = 'http://localhost:8000'

export async function api(path, options = {}) {
  return fetch(`${API}${path}`, { credentials: 'include', ...options })
}

export async function apiJson(path, options = {}) {
  const res = await api(path, options)
  if (!res.ok) {
    let detail = `HTTP ${res.status}`
    try {
      const body = await res.json()
      if (body?.detail) detail = body.detail
    } catch {
      // no JSON body
    }
    const err = new Error(detail)
    err.status = res.status
    throw err
  }
  return res.json()
}

export function apiPostJson(path, data) {
  return apiJson(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
}
