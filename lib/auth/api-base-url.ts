// yt-2 has no API server: every request is answered by the mock layer (mock/). URLs built from this base
// (stream/download links) are intercepted in the browser by mock/network-shim.ts.
const MOCK_API_BASE_URL = 'https://mock-api.yt-2.local'

export function getYoutorchApiBaseUrl() {
  return MOCK_API_BASE_URL
}

export function getYoutorchServerApiBaseUrl() {
  return MOCK_API_BASE_URL
}
