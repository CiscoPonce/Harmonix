export const PLAYLISTS_CHANGED_EVENT = 'harmonix:playlists-changed';

export type PlaylistsChangedDetail = {
  playlistId?: string;
  songId?: string;
};

export function notifyPlaylistsChanged(detail: PlaylistsChangedDetail = {}) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent<PlaylistsChangedDetail>(PLAYLISTS_CHANGED_EVENT, { detail })
  );
}
