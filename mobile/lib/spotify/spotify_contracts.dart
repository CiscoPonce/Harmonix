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

class SpotifyPlaylistDetailItem {
  const SpotifyPlaylistDetailItem({
    required this.position,
    required this.title,
    required this.artists,
    this.durationMs,
    this.availability = 'available',
    this.reason,
  });

  final int position;
  final String title;
  final String artists;
  final int? durationMs;
  final String availability;
  final String? reason;

  bool get isAvailable => availability == 'available';
}

class SpotifyPlaylistDetail {
  const SpotifyPlaylistDetail({
    required this.provider,
    required this.providerId,
    required this.stableId,
    required this.name,
    required this.restricted,
    required this.detailState,
    this.externalUrl,
    this.artworkUrl,
    this.trackCount,
    this.items = const [],
  });

  final String provider;
  final String providerId;
  final String stableId;
  final String name;
  final bool restricted;
  final String detailState;
  final String? externalUrl;
  final String? artworkUrl;
  final int? trackCount;
  final List<SpotifyPlaylistDetailItem> items;
}

SpotifyPlaylistDetail parsePlaylistDetailDto(Map<String, dynamic> raw) {
  final provider = raw['provider']?.toString() ?? '';
  if (provider != 'spotify') {
    throw ArgumentError('playlist detail provider must be spotify');
  }
  final providerId = raw['provider_id']?.toString();
  if (providerId == null || providerId.isEmpty) {
    throw ArgumentError('missing/null provider_id on detail');
  }
  final restricted =
      raw['restricted'] == true || raw['detail_state']?.toString() == 'restricted';
  final itemsRaw = raw['items'];
  final tracksRaw = raw['tracks'];
  final items = <SpotifyPlaylistDetailItem>[];

  if (itemsRaw is List) {
    for (var i = 0; i < itemsRaw.length; i++) {
      final item = itemsRaw[i];
      if (item is! Map) continue;
      final map = Map<String, dynamic>.from(item);
      final title =
          map['title']?.toString() ?? map['name']?.toString() ?? '';
      final durationRaw = map['duration_ms'];
      items.add(
        SpotifyPlaylistDetailItem(
          position: (map['position'] as num?)?.toInt() ?? i,
          title: title,
          artists: map['artists']?.toString() ?? '',
          durationMs: durationRaw is num ? durationRaw.toInt() : null,
          availability: map['availability']?.toString() ?? 'available',
          reason: map['reason']?.toString(),
        ),
      );
    }
  } else if (tracksRaw is List) {
    for (var i = 0; i < tracksRaw.length; i++) {
      final item = tracksRaw[i];
      if (item is! Map) continue;
      final map = Map<String, dynamic>.from(item);
      items.add(
        SpotifyPlaylistDetailItem(
          position: i,
          title: map['name']?.toString() ?? '',
          artists: map['artists']?.toString() ?? '',
        ),
      );
    }
  }

  final capped = capSpotifyPlaylistShelf(items);
  final detailState = raw['detail_state']?.toString() ??
      (restricted
          ? 'restricted'
          : capped.isEmpty
              ? 'empty'
              : 'normal');
  final trackRaw = raw['track_count'];

  return SpotifyPlaylistDetail(
    provider: provider,
    providerId: providerId,
    stableId: raw['stable_id']?.toString() ?? 'spotify:$providerId',
    name: raw['name']?.toString() ?? '',
    restricted: restricted,
    detailState: detailState,
    externalUrl: safeSpotifyUrl(raw['external_url'] as String?),
    artworkUrl: raw['artwork_url'] as String?,
    trackCount: trackRaw is num ? trackRaw.toInt() : null,
    items: capped,
  );
}

SpotifyListErrorView mapSpotifyDetailError({
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
  if (status == 404) {
    return const SpotifyListErrorView(
      kind: 'removed',
      message: 'This playlist is no longer available.',
    );
  }
  return mapSpotifyListError(status: status, body: body, offline: offline);
}

// --- Export job contracts (D-12-13) ---

typedef ExportJobStage = String;
typedef ExportOutcome = String;
typedef ExportPartialState = String;

const kExportJobStages = {
  'matching',
  'creating',
  'adding',
  'completed',
  'partial',
  'failed',
};

const kExportOutcomes = {'matched', 'unmatched', 'cached', 'export_failed'};

const kExportPartialStates = {
  'none',
  'no_create',
  'created_empty',
  'partially_added',
};

class SpotifyExportReportRow {
  const SpotifyExportReportRow({
    required this.sourceIdentity,
    required this.outcome,
    this.reason,
    this.spotifyUri,
  });

  final String sourceIdentity;
  final ExportOutcome outcome;
  final String? reason;
  final String? spotifyUri;
}

class SpotifyExportReport {
  const SpotifyExportReport({
    required this.rows,
    this.destinationUrl,
    this.partialState,
  });

  final List<SpotifyExportReportRow> rows;
  final String? destinationUrl;
  final ExportPartialState? partialState;
}

class SpotifyExportJob {
  const SpotifyExportJob({
    required this.id,
    required this.sourcePlaylistId,
    required this.stage,
    required this.currentCount,
    required this.totalCount,
    required this.matchedCount,
    required this.unmatchedCount,
    required this.exportedCount,
    required this.failedCount,
    this.destinationProviderId,
    this.destinationUrl,
    this.safeReason,
    this.partialState,
    this.report,
  });

  final String id;
  final String sourcePlaylistId;
  final ExportJobStage stage;
  final int currentCount;
  final int totalCount;
  final int matchedCount;
  final int unmatchedCount;
  final int exportedCount;
  final int failedCount;
  final String? destinationProviderId;
  final String? destinationUrl;
  final String? safeReason;
  final ExportPartialState? partialState;
  final SpotifyExportReport? report;

  bool get isActive => isExportJobActive(stage);
}

bool isExportJobActive(ExportJobStage stage) =>
    stage == 'matching' || stage == 'creating' || stage == 'adding';

int _asInt(dynamic value, [int fallback = 0]) {
  if (value is num && value.isFinite) return value.toInt();
  return fallback;
}

SpotifyExportReport parseExportReportDto(Map<String, dynamic> raw) {
  final rowsRaw = raw['rows'];
  final rows = <SpotifyExportReportRow>[];
  if (rowsRaw is List) {
    for (final item in rowsRaw) {
      if (item is! Map) continue;
      final map = Map<String, dynamic>.from(item);
      final outcome = map['outcome']?.toString();
      if (outcome == null || !kExportOutcomes.contains(outcome)) {
        throw ArgumentError('unstable export outcome: $outcome');
      }
      rows.add(
        SpotifyExportReportRow(
          sourceIdentity: map['source_identity']?.toString() ?? '',
          outcome: outcome,
          reason: map['reason']?.toString(),
          spotifyUri: map['spotify_uri']?.toString(),
        ),
      );
    }
  }
  final partial = raw['partial_state']?.toString();
  return SpotifyExportReport(
    destinationUrl: safeSpotifyUrl(raw['destination_url'] as String?),
    partialState:
        partial != null && kExportPartialStates.contains(partial) ? partial : null,
    rows: rows,
  );
}

SpotifyExportJob parseExportJobDto(Map<String, dynamic> raw) {
  final id = raw['id']?.toString();
  final sourceId = raw['source_playlist_id']?.toString();
  final stage = raw['stage']?.toString();
  if (id == null ||
      id.isEmpty ||
      sourceId == null ||
      sourceId.isEmpty ||
      stage == null ||
      !kExportJobStages.contains(stage)) {
    throw ArgumentError('invalid export job identity/stage');
  }
  final reportRaw = raw['report'];
  final report = reportRaw is Map
      ? parseExportReportDto(Map<String, dynamic>.from(reportRaw))
      : null;
  final partial = raw['partial_state']?.toString();
  return SpotifyExportJob(
    id: id,
    sourcePlaylistId: sourceId,
    stage: stage,
    currentCount: _asInt(raw['current_count']),
    totalCount: _asInt(raw['total_count']),
    matchedCount: _asInt(raw['matched_count']),
    unmatchedCount: _asInt(raw['unmatched_count']),
    exportedCount: _asInt(raw['exported_count']),
    failedCount: _asInt(raw['failed_count']),
    destinationProviderId: raw['destination_provider_id']?.toString(),
    destinationUrl: safeSpotifyUrl(raw['destination_url'] as String?),
    safeReason: raw['safe_reason']?.toString(),
    partialState: partial != null && kExportPartialStates.contains(partial)
        ? partial
        : report?.partialState,
    report: report,
  );
}

String exportProgressLabel(SpotifyExportJob job) {
  switch (job.stage) {
    case 'matching':
      return 'Matching tracks (${job.currentCount} of ${job.totalCount})';
    case 'creating':
      return 'Creating private Spotify playlist…';
    case 'adding':
      return 'Adding matched tracks (${job.exportedCount} of ${job.matchedCount})';
    case 'completed':
      return 'Export complete';
    case 'partial':
      return 'Exported ${job.exportedCount} of ${job.matchedCount} matched tracks';
    case 'failed':
      if (job.safeReason == 'zero_matches') {
        return 'No tracks were confidently matched. Review the unmatched tracks and try again later.';
      }
      if (job.partialState == 'no_create') {
        return 'The export couldn’t be completed. No new playlist was created. Try again.';
      }
      return 'The export couldn’t be completed. Try again.';
    default:
      return 'Export in progress…';
  }
}

String mapExportErrorMessage({
  int? status,
  String? reason,
  bool offline = false,
  int? retryAfterSec,
}) {
  if (offline) {
    return 'You’re offline. Reconnect to sync Spotify playlists or export music.';
  }
  if (status == 409 ||
      reason == 'reconnect_required' ||
      reason == 'spotify_reconnect_required') {
    return 'Reconnect Spotify in Settings to export.';
  }
  if (status == 429 || reason == 'spotify_rate_limited') {
    final wait = retryAfterSec != null ? '$retryAfterSec' : 'a moment';
    return 'Spotify rate limit reached. Try again in $wait seconds.';
  }
  return 'The export couldn’t be completed. No new playlist was created. Try again.';
}
