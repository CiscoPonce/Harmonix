const DEEZER_TRACK_URL = 'https://api.deezer.com/track';

async function fetchTrack(trackId, fetchImpl = fetch) {
  const res = await fetchImpl(`${DEEZER_TRACK_URL}/${trackId}`);
  if (!res.ok) {
    const err = new Error('track_not_found');
    err.code = 'track_not_found';
    err.status = res.status;
    throw err;
  }
  const data = await res.json();
  if (data.error) {
    const err = new Error(data.error.message || 'track_not_found');
    err.code = 'track_not_found';
    throw err;
  }
  if (!data.preview) {
    const err = new Error('no_preview');
    err.code = 'no_preview';
    throw err;
  }
  return data;
}

/** Same-origin path; browser audio tag cannot send JWT headers. */
function previewProxyPath(trackId) {
  return `/api/audio/preview/${trackId}`;
}

module.exports = {
  fetchTrack,
  previewProxyPath,
};
