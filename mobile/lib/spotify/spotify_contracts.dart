// Pure Spotify / provider-aware contracts for Flutter (Phase 12).

typedef ConnectionState = String;

const kConnectionStates = {
  'connect',
  'connected',
  'reconnect',
  'connecting',
  'disconnecting',
  'disconnected',
  'provider_error',
};

/// Allow only backend-returned HTTPS accounts.spotify.com authorize URLs.
String? safeSpotifyAuthorizationUrl(String? url) {
  if (url == null || url.trim().isEmpty) return null;
  final Uri parsed;
  try {
    parsed = Uri.parse(url);
  } catch (_) {
    return null;
  }
  if (parsed.scheme != 'https') return null;
  if (parsed.host != 'accounts.spotify.com') return null;
  if (!parsed.path.startsWith('/authorize')) return null;
  return parsed.toString();
}

/// Allow only API-provided HTTPS open.spotify.com URLs.
String? safeSpotifyUrl(String? url) {
  if (url == null || url.trim().isEmpty) return null;
  final Uri parsed;
  try {
    parsed = Uri.parse(url);
  } catch (_) {
    return null;
  }
  if (parsed.scheme != 'https') return null;
  if (parsed.host != 'open.spotify.com') return null;
  return parsed.toString();
}

String mapBackendStatusToUiState(String status) {
  switch (status) {
    case 'disconnected':
      return 'connect';
    case 'connected':
      return 'connected';
    case 'reconnect_required':
      return 'reconnect';
    case 'provider_error':
      return 'provider_error';
    default:
      throw ArgumentError('invalid backend status: $status');
  }
}

class SpotifyConnectionStatus {
  const SpotifyConnectionStatus({
    required this.state,
    this.displayName,
    this.reason,
  });

  final String state;
  final String? displayName;
  final String? reason;
}

SpotifyConnectionStatus parseSpotifyStatusResponse(Map<String, dynamic> raw) {
  final status = raw['status'] as String?;
  if (status == null) {
    throw ArgumentError('invalid status response');
  }
  return SpotifyConnectionStatus(
    state: mapBackendStatusToUiState(status),
    displayName: raw['display_name'] as String?,
    reason: raw['reason'] as String?,
  );
}

String parseSpotifyAuthStartResponse(Map<String, dynamic> raw) {
  final url = safeSpotifyAuthorizationUrl(raw['authorization_url'] as String?);
  if (url == null) {
    throw ArgumentError('authorization URL failed host validation');
  }
  return url;
}

class SpotifyPlaylistItem {
  const SpotifyPlaylistItem({
    required this.provider,
    required this.providerId,
    required this.stableId,
    required this.name,
    this.externalUrl,
    this.artworkUrl,
    this.trackCount,
  });

  final String provider;
  final String providerId;
  final String stableId;
  final String name;
  final String? externalUrl;
  final String? artworkUrl;
  final int? trackCount;
}

class SpotifyPlaylistListResult {
  const SpotifyPlaylistListResult({
    required this.playlists,
    this.onwardUrl,
  });

  final List<SpotifyPlaylistItem> playlists;
  final String? onwardUrl;
}

SpotifyPlaylistListResult parseSpotifyPlaylistListResponse(
  Map<String, dynamic> raw,
) {
  final list = raw['playlists'];
  final items = <SpotifyPlaylistItem>[];
  if (list is List) {
    for (final item in list) {
      if (item is! Map) continue;
      final map = Map<String, dynamic>.from(item);
      final provider = map['provider'] as String? ?? 'spotify';
      final providerId = map['provider_id']?.toString();
      if (providerId == null || providerId.isEmpty) continue;
      final stableId =
          map['stable_id']?.toString() ?? '$provider:$providerId';
      final trackRaw = map['track_count'];
      items.add(
        SpotifyPlaylistItem(
          provider: provider,
          providerId: providerId,
          stableId: stableId,
          name: map['name']?.toString() ?? '',
          externalUrl: safeSpotifyUrl(map['external_url'] as String?),
          artworkUrl: map['artwork_url'] as String?,
          trackCount: trackRaw is num ? trackRaw.toInt() : null,
        ),
      );
    }
  }
  return SpotifyPlaylistListResult(
    playlists: items,
    onwardUrl: safeSpotifyUrl(raw['onward_url'] as String?),
  );
}

class SpotifyListErrorView {
  const SpotifyListErrorView({
    required this.kind,
    required this.message,
    this.retryAfterSeconds,
  });

  final String kind;
  final String message;
  final int? retryAfterSeconds;
}

SpotifyListErrorView mapSpotifyListError({
  int? status,
  Map<String, dynamic>? body,
  bool offline = false,
}) {
  if (offline || status == 0) {
    return const SpotifyListErrorView(
      kind: 'offline',
      message:
          'You’re offline. Reconnect to sync Spotify playlists or export music.',
    );
  }
  final error = body?['error'] as String?;
  final retryRaw = body?['retry_after'];
  final retryAfterSeconds = retryRaw is num ? retryRaw.toInt() : null;

  if (status == 409 && error == 'spotify_disconnected') {
    return const SpotifyListErrorView(
      kind: 'disconnected',
      message: 'Connect Spotify from Settings to see your playlists.',
    );
  }
  if (status == 409 && error == 'reconnect_required') {
    return const SpotifyListErrorView(
      kind: 'reconnect',
      message: 'Your Spotify connection expired. Reconnect to continue.',
    );
  }
  if (status == 429 || error == 'spotify_rate_limited') {
    final duration =
        retryAfterSeconds != null ? '$retryAfterSeconds' : 'a moment';
    return SpotifyListErrorView(
      kind: 'rate_limited',
      message: 'Spotify needs a moment. Try again in $duration.',
      retryAfterSeconds: retryAfterSeconds,
    );
  }
  return const SpotifyListErrorView(
    kind: 'provider_error',
    message:
        'Spotify is unavailable right now. Your Harmonix library is still available. Try again.',
  );
}

List<T> capSpotifyPlaylistShelf<T>(List<T> items, {int max = 20}) {
  if (items.length <= max) return items;
  return items.sublist(0, max);
}
