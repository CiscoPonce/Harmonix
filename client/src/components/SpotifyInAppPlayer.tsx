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
  /** Unlock audio for browser autoplay policies — call from a user click. */
  activateElement?: () => Promise<void>;
  getCurrentState: () => Promise<{
    paused: boolean;
    position?: number;
    duration?: number;
  } | null>;
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

async function playUriOnDevice(
  accessToken: string,
  deviceId: string,
  uri: string,
  positionMs?: number
) {
  // Activate Harmonix as the playback device first (avoids "no active device").
  const transfer = await fetch('https://api.spotify.com/v1/me/player', {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ device_ids: [deviceId], play: false }),
  });
  if (transfer.status === 403) {
    const body = await transfer.json().catch(() => null);
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

  // Brief settle so Spotify registers the SDK device before play.
  await new Promise((r) => setTimeout(r, 600));

  const payload: { uris: string[]; position_ms?: number } = { uris: [uri] };
  if (typeof positionMs === 'number' && Number.isFinite(positionMs) && positionMs >= 0) {
    payload.position_ms = Math.floor(positionMs);
  }

  let res = await fetch(
    `https://api.spotify.com/v1/me/player/play?device_id=${encodeURIComponent(deviceId)}`,
    {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    }
  );
  // Device sometimes not ready yet — one short retry.
  if (res.status === 404 || res.status === 502) {
    await new Promise((r) => setTimeout(r, 700));
    res = await fetch(
      `https://api.spotify.com/v1/me/player/play?device_id=${encodeURIComponent(deviceId)}`,
      {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      }
    );
  }
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
  if (res.status === 401) {
    const err = new Error('reconnect') as Error & { code?: string };
    err.code = 'reconnect';
    throw err;
  }
  throw new Error(`playback_failed_${res.status}`);
}

async function seekOnDevice(accessToken: string, deviceId: string, positionMs: number) {
  const res = await fetch(
    `https://api.spotify.com/v1/me/player/seek?position_ms=${Math.floor(positionMs)}&device_id=${encodeURIComponent(deviceId)}`,
    {
      method: 'PUT',
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );
  if (res.status === 204 || res.ok) return;
  if (res.status === 401) {
    const err = new Error('reconnect') as Error & { code?: string };
    err.code = 'reconnect';
    throw err;
  }
  throw new Error(`seek_failed_${res.status}`);
}

export type PlayTrackOptions = {
  /** Absolute song position to start at (ms). */
  positionMs?: number;
  /** Auto-pause after this many ms of playback (Hear-it clips). */
  stopAfterMs?: number;
};

export function useSpotifyInAppPlayer(options?: { onReconnectNeeded?: () => void }) {
  const onReconnectNeeded = options?.onReconnectNeeded;
  const playerRef = useRef<SpotifyPlayerInstance | null>(null);
  const deviceIdRef = useRef<string | null>(null);
  const tokenRef = useRef<string | null>(null);
  const stopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const ensurePromiseRef = useRef<Promise<void> | null>(null);
  const [ui, setUi] = useState<SpotifyPlayerUiState>('idle');
  const [message, setMessage] = useState<string | null>(null);
  const [activeUri, setActiveUri] = useState<string | null>(null);

  const clearStopTimer = useCallback(() => {
    if (stopTimerRef.current) {
      clearTimeout(stopTimerRef.current);
      stopTimerRef.current = null;
    }
  }, []);

  /** Must run synchronously inside a click handler when possible. */
  const unlockAudio = useCallback(() => {
    const player = playerRef.current;
    if (!player?.activateElement) return;
    try {
      void player.activateElement();
    } catch {
      /* ignore */
    }
  }, []);

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
    if (ensurePromiseRef.current) {
      await ensurePromiseRef.current;
      return;
    }

    ensurePromiseRef.current = (async () => {
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
          setMessage(null);
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
            'In-app Spotify playback needs Spotify Premium. Using Deezer preview when available.'
          );
          reject(new Error('premium'));
        });

        player.addListener('autoplay_failed', () => {
          setMessage('Browser blocked autoplay — tap Hear it again.');
          try {
            void player.resume();
          } catch {
            /* ignore */
          }
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
    })().finally(() => {
      // Keep resolved promise so concurrent callers see ready device; clear only on failure.
      if (!deviceIdRef.current) {
        ensurePromiseRef.current = null;
      }
    });

    await ensurePromiseRef.current;
  }, [onReconnectNeeded, refreshToken]);

  /** Pre-connect SDK so the first Hear-it click can unlock audio immediately. */
  const warmup = useCallback(async () => {
    try {
      await ensurePlayer();
    } catch {
      /* status / UI already set */
    }
  }, [ensurePlayer]);

  useEffect(() => {
    return () => {
      clearStopTimer();
      ensurePromiseRef.current = null;
      try {
        playerRef.current?.disconnect();
      } catch {
        /* ignore */
      }
      playerRef.current = null;
      deviceIdRef.current = null;
    };
  }, [clearStopTimer]);

  const pausePlayback = useCallback(async () => {
    clearStopTimer();
    try {
      await playerRef.current?.pause();
      setUi('paused');
    } catch {
      /* ignore */
    }
  }, [clearStopTimer]);

  const getPlaybackSnapshot = useCallback(async (): Promise<{
    position: number;
    duration: number;
    paused: boolean;
  } | null> => {
    try {
      const state = await playerRef.current?.getCurrentState();
      if (!state || typeof state !== 'object') return null;
      return {
        position: typeof state.position === 'number' ? state.position : 0,
        duration: typeof state.duration === 'number' ? state.duration : 0,
        paused: Boolean(state.paused),
      };
    } catch {
      return null;
    }
  }, []);

  const getPositionMs = useCallback(async (): Promise<number | null> => {
    const snap = await getPlaybackSnapshot();
    return snap ? snap.position : null;
  }, [getPlaybackSnapshot]);

  const seekMs = useCallback(
    async (positionMs: number) => {
      unlockAudio();
      await ensurePlayer();
      unlockAudio();
      const deviceId = deviceIdRef.current;
      const token = tokenRef.current || (await refreshToken());
      if (!deviceId || !token) throw new Error('player_not_ready');
      await seekOnDevice(token, deviceId, positionMs);
    },
    [ensurePlayer, refreshToken, unlockAudio]
  );

  const playTrack = useCallback(
    async (uri: string, opts?: PlayTrackOptions): Promise<boolean> => {
      if (!uri) return false;
      // Unlock audio while we still have the user-gesture call stack when possible.
      unlockAudio();
      clearStopTimer();
      try {
        const positionMs = opts?.positionMs;
        const wantsClip = typeof opts?.stopAfterMs === 'number' && opts.stopAfterMs > 0;

        if (
          activeUri === uri &&
          playerRef.current &&
          positionMs == null &&
          !wantsClip
        ) {
          unlockAudio();
          const state = await playerRef.current.getCurrentState();
          if (state && !state.paused) {
            await playerRef.current.pause();
            setUi('paused');
            return true;
          }
          if (state && state.paused) {
            await playerRef.current.resume();
            setUi('playing');
            return true;
          }
        }

        await ensurePlayer();
        unlockAudio();
        const deviceId = deviceIdRef.current;
        const token = tokenRef.current || (await refreshToken());
        if (!deviceId || !token) {
          setUi('error');
          setMessage('Spotify player is not ready yet — tap Hear it again.');
          return false;
        }

        setActiveUri(uri);
        await playUriOnDevice(token, deviceId, uri, positionMs);
        // Safari / autoplay: resume after transfer+play.
        try {
          await playerRef.current?.resume();
        } catch {
          /* ignore */
        }
        setUi('playing');
        setMessage(null);

        if (wantsClip && opts?.stopAfterMs) {
          stopTimerRef.current = setTimeout(() => {
            void pausePlayback();
            stopTimerRef.current = null;
          }, opts.stopAfterMs);
        }
        return true;
      } catch (err) {
        const code =
          err && typeof err === 'object' && 'code' in err
            ? String((err as { code?: string }).code)
            : '';
        if (code === 'premium_required' || (err instanceof Error && err.message === 'premium')) {
          setUi('premium_required');
          setMessage(
            'In-app Spotify playback needs Spotify Premium. Using Deezer preview when available.'
          );
          return false;
        }
        if (code === 'reconnect') {
          setUi('reconnect');
          setMessage(
            'Reconnect Spotify in Settings to enable in-app playback (streaming permission).'
          );
          return false;
        }
        setUi((prev) => (prev === 'reconnect' ? prev : 'error'));
        setMessage((prev) =>
          prev?.includes('Reconnect') || prev?.includes('Premium')
            ? prev
            : 'Could not play on Spotify. Falling back to Deezer preview when available.'
        );
        return false;
      }
    },
    [activeUri, clearStopTimer, ensurePlayer, pausePlayback, refreshToken, unlockAudio]
  );

  return {
    playTrack,
    pausePlayback,
    seekMs,
    getPositionMs,
    getPlaybackSnapshot,
    warmup,
    unlockAudio,
    activeUri,
    ui,
    message,
    isBusy: ui === 'loading_sdk',
    isPlaying: ui === 'playing',
  };
}
