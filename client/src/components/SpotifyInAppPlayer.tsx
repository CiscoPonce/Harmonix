'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchSpotifyPlayerToken } from '@/lib/api';

declare global {
  interface Window {
    onSpotifyWebPlaybackSDKReady?: () => void;
    Spotify?: {
      Player: new (options: {
        name: string;
        getOAuthToken: (cb: (token: string) => void) => void;
        volume?: number;
      }) => SpotifyPlayerInstance;
    };
  }
}

interface SpotifyPlayerInstance {
  connect: () => Promise<boolean>;
  disconnect: () => void;
  addListener: (event: string, cb: (payload: unknown) => void) => void;
  pause: () => Promise<void>;
  resume: () => Promise<void>;
  getCurrentState: () => Promise<{ paused: boolean } | null>;
}

export type SpotifyPlayerUiState =
  | 'idle'
  | 'loading_sdk'
  | 'ready'
  | 'playing'
  | 'paused'
  | 'premium_required'
  | 'reconnect'
  | 'error';

function loadSpotifySdk(): Promise<void> {
  if (typeof window === 'undefined') return Promise.reject(new Error('no window'));
  if (window.Spotify) return Promise.resolve();

  return new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      'script[data-spotify-web-playback]'
    );
    if (existing) {
      const prev = window.onSpotifyWebPlaybackSDKReady;
      window.onSpotifyWebPlaybackSDKReady = () => {
        prev?.();
        resolve();
      };
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://sdk.scdn.co/spotify-player.js';
    script.async = true;
    script.dataset.spotifyWebPlayback = 'true';
    const prev = window.onSpotifyWebPlaybackSDKReady;
    window.onSpotifyWebPlaybackSDKReady = () => {
      prev?.();
      resolve();
    };
    script.onerror = () => reject(new Error('Failed to load Spotify Web Playback SDK'));
    document.body.appendChild(script);
  });
}

async function playUriOnDevice(accessToken: string, deviceId: string, uri: string) {
  const res = await fetch(
    `https://api.spotify.com/v1/me/player/play?device_id=${encodeURIComponent(deviceId)}`,
    {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ uris: [uri] }),
    }
  );
  if (res.status === 204 || res.ok) return;
  if (res.status === 403) {
    const body = await res.json().catch(() => null);
    const reason =
      body && typeof body === 'object' && 'error' in body
        ? String((body as { error?: { reason?: string } }).error?.reason || '')
        : '';
    if (reason === 'PREMIUM_REQUIRED' || /premium/i.test(JSON.stringify(body))) {
      const err = new Error('premium_required') as Error & { code?: string };
      err.code = 'premium_required';
      throw err;
    }
  }
  throw new Error(`playback_failed_${res.status}`);
}

export function useSpotifyInAppPlayer(options?: { onReconnectNeeded?: () => void }) {
  const onReconnectNeeded = options?.onReconnectNeeded;
  const playerRef = useRef<SpotifyPlayerInstance | null>(null);
  const deviceIdRef = useRef<string | null>(null);
  const tokenRef = useRef<string | null>(null);
  const [ui, setUi] = useState<SpotifyPlayerUiState>('idle');
  const [message, setMessage] = useState<string | null>(null);
  const [activeUri, setActiveUri] = useState<string | null>(null);

  const refreshToken = useCallback(async (): Promise<string> => {
    try {
      const dto = await fetchSpotifyPlayerToken();
      tokenRef.current = dto.access_token;
      return dto.access_token;
    } catch (err) {
      const status =
        err && typeof err === 'object' && 'status' in err
          ? Number((err as { status?: number }).status)
          : undefined;
      const body =
        err && typeof err === 'object' && 'body' in err
          ? (err as { body?: { error?: string; reason?: string } }).body
          : undefined;
      if (
        status === 409 &&
        (body?.error === 'reconnect_required' || body?.reason === 'missing_playback_scope')
      ) {
        setUi('reconnect');
        setMessage(
          'Reconnect Spotify in Settings to enable in-app playback (streaming permission).'
        );
        onReconnectNeeded?.();
        throw err;
      }
      setUi('error');
      setMessage('Could not authorize Spotify playback. Try again or open in Spotify.');
      throw err;
    }
  }, [onReconnectNeeded]);

  const ensurePlayer = useCallback(async () => {
    if (playerRef.current && deviceIdRef.current) return;

    setUi('loading_sdk');
    setMessage('Starting Spotify player…');
    await loadSpotifySdk();
    await refreshToken();

    if (!window.Spotify) {
      setUi('error');
      setMessage('Spotify player could not load in this browser.');
      throw new Error('Spotify SDK missing');
    }

    await new Promise<void>((resolve, reject) => {
      const player = new window.Spotify!.Player({
        name: 'Harmonix',
        getOAuthToken: (cb) => {
          void refreshToken()
            .then((t) => cb(t))
            .catch(() => cb(tokenRef.current || ''));
        },
        volume: 0.8,
      });

      player.addListener('ready', (payload) => {
        const id =
          payload && typeof payload === 'object' && 'device_id' in payload
            ? String((payload as { device_id: string }).device_id)
            : '';
        if (!id) {
          reject(new Error('no device_id'));
          return;
        }
        deviceIdRef.current = id;
        playerRef.current = player;
        setUi('ready');
        setMessage('Spotify Premium · press play on a track');
        resolve();
      });

      player.addListener('not_ready', () => {
        deviceIdRef.current = null;
        setMessage('Spotify player went offline. Try again.');
        setUi('error');
      });

      player.addListener('initialization_error', () => {
        setUi('error');
        setMessage('Could not initialize Spotify player.');
        reject(new Error('init'));
      });

      player.addListener('authentication_error', () => {
        setUi('reconnect');
        setMessage('Spotify authentication failed. Reconnect in Settings.');
        onReconnectNeeded?.();
        reject(new Error('auth'));
      });

      player.addListener('account_error', () => {
        setUi('premium_required');
        setMessage(
          'In-app Spotify playback needs Spotify Premium. Free accounts can still use Open in Spotify.'
        );
        reject(new Error('premium'));
      });

      player.addListener('player_state_changed', (state) => {
        if (!state || typeof state !== 'object') return;
        const paused = Boolean((state as { paused?: boolean }).paused);
        setUi(paused ? 'paused' : 'playing');
      });

      void player.connect().then((ok) => {
        if (!ok) {
          setUi('error');
          setMessage('Could not connect Spotify player.');
          reject(new Error('connect_failed'));
        }
      });
    });
  }, [onReconnectNeeded, refreshToken]);

  useEffect(() => {
    return () => {
      try {
        playerRef.current?.disconnect();
      } catch {
        /* ignore */
      }
      playerRef.current = null;
      deviceIdRef.current = null;
    };
  }, []);

  const playTrack = useCallback(
    async (uri: string) => {
      if (!uri) return;
      try {
        if (activeUri === uri && playerRef.current) {
          const state = await playerRef.current.getCurrentState();
          if (state && !state.paused) {
            await playerRef.current.pause();
            setUi('paused');
            return;
          }
          if (state && state.paused) {
            await playerRef.current.resume();
            setUi('playing');
            return;
          }
        }

        await ensurePlayer();
        const deviceId = deviceIdRef.current;
        const token = tokenRef.current || (await refreshToken());
        if (!deviceId || !token) {
          setUi('error');
          setMessage('Spotify player is not ready yet.');
          return;
        }

        setActiveUri(uri);
        await playUriOnDevice(token, deviceId, uri);
        setUi('playing');
        setMessage(null);
      } catch (err) {
        const code =
          err && typeof err === 'object' && 'code' in err
            ? String((err as { code?: string }).code)
            : '';
        if (code === 'premium_required' || (err instanceof Error && err.message === 'premium')) {
          setUi('premium_required');
          setMessage(
            'In-app Spotify playback needs Spotify Premium. Free accounts can still use Open in Spotify.'
          );
          return;
        }
        setUi((prev) => (prev === 'reconnect' ? prev : 'error'));
        setMessage((prev) =>
          prev?.includes('Reconnect')
            ? prev
            : 'Could not play this track. Try Open in Spotify.'
        );
      }
    },
    [activeUri, ensurePlayer, refreshToken]
  );

  return {
    playTrack,
    activeUri,
    ui,
    message,
    isBusy: ui === 'loading_sdk',
  };
}
