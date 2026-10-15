const API_BASE = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');

export async function getJson(path, options = {}) {
  let response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers: { Accept: 'application/json', ...options.headers },
    });
  } catch (error) {
    if (error.name === 'AbortError') throw error;
    throw new Error(
      'Cannot connect to backend. Start MongoDB and the server on port 5000.'
    );
  }

  const body = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(body?.error || `Request failed (${response.status})`);
  }
  return body;
}

export function submitVendorData(vendor, payload, apiKey = '') {
  return getJson(`/api/ingest/${vendor}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(apiKey.trim() ? { 'x-api-key': apiKey.trim() } : {}),
    },
    body: JSON.stringify(payload),
  });
}

export function formatDate(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString();
}

export function pretty(value) {
  return String(value || 'unknown').replaceAll('_', ' ');
}
