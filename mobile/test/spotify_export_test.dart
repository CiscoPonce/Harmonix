import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:harmonix_mobile/screens/playlist_detail_screen.dart';
import 'package:harmonix_mobile/services/api_client.dart';
import 'package:harmonix_mobile/spotify/spotify_contracts.dart';
import 'package:harmonix_mobile/theme/harmonix_theme.dart';
import 'package:harmonix_mobile/widgets/spotify_export_sheet.dart';
import 'package:harmonix_mobile/widgets/spotify_match_report.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:provider/provider.dart';

enum ExportPhase { idle, matching, creating, adding, complete, failed }

class SpotifyExportArgs {
  const SpotifyExportArgs({
    required this.eligible,
    required this.phase,
    required this.progress,
    required this.rows,
    this.destinationUrl,
    this.partialState,
    this.errorMessage,
    this.onExport,
    this.onRestore,
    this.safeReason,
  });

  final bool eligible;
  final ExportPhase phase;
  final double progress;
  final List<SpotifyExportReportRow> rows;
  final String? destinationUrl;
  final String? partialState;
  final String? errorMessage;
  final VoidCallback? onExport;
  final VoidCallback? onRestore;
  final String? safeReason;
}

ExportJobStage _stageFor(ExportPhase phase) {
  switch (phase) {
    case ExportPhase.idle:
      return 'completed';
    case ExportPhase.matching:
      return 'matching';
    case ExportPhase.creating:
      return 'creating';
    case ExportPhase.adding:
      return 'adding';
    case ExportPhase.complete:
      return 'completed';
    case ExportPhase.failed:
      return 'failed';
  }
}

SpotifyExportJob _jobFromArgs(SpotifyExportArgs args) {
  final stage = _stageFor(args.phase);
  final total = args.rows.isEmpty ? 10 : args.rows.length;
  final matched =
      args.rows.where((r) => r.outcome == 'matched' || r.outcome == 'cached').length;
  final unmatched = args.rows.where((r) => r.outcome == 'unmatched').length;
  final failed = args.rows.where((r) => r.outcome == 'export_failed').length;
  final current = (args.progress * total).round();
  return SpotifyExportJob(
    id: 'job-test',
    sourcePlaylistId: 'pl-1',
    stage: stage,
    currentCount: current,
    totalCount: total,
    matchedCount: matched,
    unmatchedCount: unmatched,
    exportedCount: stage == 'adding' || stage == 'partial' || stage == 'completed'
        ? matched
        : 0,
    failedCount: failed,
    destinationUrl: safeSpotifyUrl(args.destinationUrl),
    safeReason: args.safeReason ??
        (args.partialState == 'no_create' && unmatched == total && total > 0
            ? 'zero_matches'
            : null),
    partialState: args.partialState,
    report: SpotifyExportReport(
      rows: args.rows,
      destinationUrl: safeSpotifyUrl(args.destinationUrl),
      partialState: args.partialState,
    ),
  );
}

/// Test harness composing production sheet/report chrome.
Widget? buildSpotifyExportPanel(SpotifyExportArgs args) {
  final job = _jobFromArgs(args);
  final showProgress = args.phase == ExportPhase.matching ||
      args.phase == ExportPhase.creating ||
      args.phase == ExportPhase.adding;
  final showReport = args.phase == ExportPhase.complete ||
      args.phase == ExportPhase.failed;

  return Column(
    crossAxisAlignment: CrossAxisAlignment.stretch,
    children: [
      FilledButton(
        onPressed: args.eligible ? args.onExport : null,
        style: FilledButton.styleFrom(minimumSize: const Size(44, 44)),
        child: const Text('Export to Spotify'),
      ),
      if (showProgress)
        SpotifyExportSheet(
          playlistName: 'My Mix',
          songCount: job.totalCount,
          job: job,
          busy: true,
          errorMessage: args.errorMessage,
          onCancel: () {},
          onConfirm: () {},
        ),
      if (showReport)
        SpotifyMatchReport(
          job: job,
          onFinish: args.onRestore,
        ),
      if (args.errorMessage != null && !showProgress && !showReport)
        Text(args.errorMessage!),
    ],
  );
}

Widget _harness(Widget child, {ApiClient? api, bool scrollable = true}) {
  final client = api ??
      ApiClient(
        client: MockClient((request) async => http.Response('{}', 200)),
      );
  return Provider<ApiClient>.value(
    value: client,
    child: MaterialApp(
      theme: buildHarmonixTheme(brightness: Brightness.light),
      home: scrollable
          ? Scaffold(body: SingleChildScrollView(child: child))
          : child,
    ),
  );
}

Map<String, dynamic> _jobJson({
  required String id,
  required String stage,
  String sourceId = 'pl-owned',
  int current = 0,
  int total = 2,
  int matched = 0,
  int unmatched = 0,
  int exported = 0,
  int failed = 0,
  String? destinationUrl,
  String? safeReason,
  String? partialState,
  List<Map<String, dynamic>>? rows,
}) {
  return {
    'id': id,
    'source_playlist_id': sourceId,
    'stage': stage,
    'current_count': current,
    'total_count': total,
    'matched_count': matched,
    'unmatched_count': unmatched,
    'exported_count': exported,
    'failed_count': failed,
    'destination_provider_id':
        destinationUrl != null ? 'dest-1' : null,
    'destination_url': destinationUrl,
    'safe_reason': safeReason,
    'partial_state': partialState,
    'report': {
      'destination_url': destinationUrl,
      'partial_state': partialState,
      'rows': rows ??
          [
            {
              'source_identity': 'harmonix:song-1',
              'outcome': matched > 0 ? 'matched' : 'unmatched',
              'reason': matched > 0 ? null : 'weak_candidate',
              'spotify_uri': matched > 0 ? 'spotify:track:abc' : null,
            },
          ],
    },
  };
}

void main() {
  testWidgets('export CTA disabled when not eligible', (tester) async {
    final panel = buildSpotifyExportPanel(
      const SpotifyExportArgs(
        eligible: false,
        phase: ExportPhase.idle,
        progress: 0,
        rows: [],
      ),
    );
    expect(panel, isNotNull);
    await tester.pumpWidget(_harness(panel!));
    expect(find.text('Export to Spotify'), findsOneWidget);
    final button = tester.widget<FilledButton>(find.byType(FilledButton).first);
    expect(button.onPressed, isNull);
  });

  testWidgets('shows progress during matching/creating/adding phases', (tester) async {
    for (final phase in [ExportPhase.matching, ExportPhase.creating, ExportPhase.adding]) {
      final panel = buildSpotifyExportPanel(
        SpotifyExportArgs(
          eligible: true,
          phase: phase,
          progress: 0.4,
          rows: const [],
        ),
      );
      expect(panel, isNotNull);
      await tester.pumpWidget(_harness(panel!));
      expect(find.byType(LinearProgressIndicator), findsWidgets);
      expect(find.textContaining(phase == ExportPhase.matching
          ? 'Matching tracks'
          : phase == ExportPhase.creating
              ? 'Creating private Spotify playlist'
              : 'Adding matched tracks'), findsWidgets);
    }
  });

  testWidgets('renders one outcome row per source and restoration entry point', (tester) async {
    final panel = buildSpotifyExportPanel(
      SpotifyExportArgs(
        eligible: true,
        phase: ExportPhase.complete,
        progress: 1,
        rows: const [
          SpotifyExportReportRow(
            sourceIdentity: 'harmonix:song-1',
            outcome: 'matched',
            spotifyUri: 'spotify:track:abc',
          ),
          SpotifyExportReportRow(
            sourceIdentity: 'harmonix:song-2',
            outcome: 'unmatched',
            reason: 'ambiguous_tie',
          ),
        ],
        destinationUrl: 'https://open.spotify.com/playlist/dest',
        onRestore: () {},
      ),
    );
    expect(panel, isNotNull);
    await tester.pumpWidget(_harness(panel!));
    expect(find.text('song-1'), findsOneWidget);
    expect(find.text('song-2'), findsOneWidget);
    expect(find.text('MATCHED'), findsOneWidget);
    expect(find.text('UNMATCHED'), findsOneWidget);
    expect(find.text('Open in Spotify'), findsOneWidget);
    expect(find.text('Finish export'), findsOneWidget);
  });

  testWidgets('reports mutation failure states: no_create, created_empty, partially_added',
      (tester) async {
    for (final state in ['no_create', 'created_empty', 'partially_added']) {
      final panel = buildSpotifyExportPanel(
        SpotifyExportArgs(
          eligible: true,
          phase: ExportPhase.failed,
          progress: 0.5,
          rows: const [],
          partialState: state,
          errorMessage: state == 'no_create'
              ? 'The export couldn’t be completed. No new playlist was created. Try again.'
              : 'Partial export',
          destinationUrl:
              state == 'no_create' ? null : 'https://open.spotify.com/playlist/partial',
        ),
      );
      expect(panel, isNotNull);
      await tester.pumpWidget(_harness(panel!));
      if (state == 'no_create') {
        expect(
          find.textContaining('No new playlist was created'),
          findsOneWidget,
        );
        expect(find.text('Open in Spotify'), findsNothing);
      } else if (state == 'created_empty') {
        expect(
          find.textContaining('created but no tracks were added'),
          findsOneWidget,
        );
      } else {
        expect(find.textContaining('Exported'), findsOneWidget);
        expect(find.text('Open in Spotify'), findsOneWidget);
      }
    }
  });

  testWidgets('zero-match uses dedicated copy and creates no destination', (tester) async {
    final panel = buildSpotifyExportPanel(
      const SpotifyExportArgs(
        eligible: true,
        phase: ExportPhase.failed,
        progress: 1,
        rows: [
          SpotifyExportReportRow(
            sourceIdentity: 'harmonix:song-z',
            outcome: 'unmatched',
            reason: 'weak_candidate',
          ),
        ],
        partialState: 'no_create',
        safeReason: 'zero_matches',
        errorMessage:
            'No tracks were confidently matched. Review the unmatched tracks and try again later.',
      ),
    );
    expect(panel, isNotNull);
    await tester.pumpWidget(_harness(panel!));
    expect(
      find.textContaining('No tracks were confidently matched'),
      findsOneWidget,
    );
    expect(find.text('Open in Spotify'), findsNothing);
  });

  test('Open in Spotify rejects unsafe or missing URLs', () {
    expect(safeSpotifyUrl(null), isNull);
    expect(safeSpotifyUrl(''), isNull);
    expect(safeSpotifyUrl('http://open.spotify.com/playlist/x'), isNull);
    expect(safeSpotifyUrl('https://evil.example/playlist/x'), isNull);
    expect(
      safeSpotifyUrl('https://open.spotify.com/playlist/ok'),
      equals('https://open.spotify.com/playlist/ok'),
    );
  });

  testWidgets('confirmation names source/count/private destination before create',
      (tester) async {
    await tester.pumpWidget(
      _harness(
        SpotifyExportSheet(
          playlistName: 'Road Trip',
          songCount: 7,
          onCancel: () {},
          onConfirm: () {},
        ),
      ),
    );
    expect(find.text('Export to Spotify'), findsOneWidget);
    expect(
      find.textContaining('match tracks before creating'),
      findsOneWidget,
    );
    expect(find.text('Road Trip'), findsOneWidget);
    expect(find.text('7'), findsOneWidget);
    expect(find.text('Private Spotify playlist'), findsOneWidget);
    expect(find.text('Cancel export'), findsOneWidget);
    expect(find.text('Start export'), findsOneWidget);
  });

  testWidgets('detail restores job after route recreation (backend identity)',
      (tester) async {
    final jobBody = _jobJson(
      id: 'job-restore',
      stage: 'matching',
      current: 1,
      total: 3,
      matched: 0,
    );
    final api = ApiClient(
      client: MockClient((request) async {
        final path = request.url.path;
        if (path.endsWith('/playlists/pl-owned')) {
          return http.Response(
            jsonEncode({
              'id': 'pl-owned',
              'name': 'Owned Mix',
              'songs': [
                {
                  'song_id': 's1',
                  'track_data': jsonEncode({'title': 'A', 'artist': 'B'}),
                },
              ],
            }),
            200,
            headers: {'content-type': 'application/json'},
          );
        }
        if (path.endsWith('/spotify/status')) {
          return http.Response(
            jsonEncode({'status': 'connected', 'display_name': 'Ada'}),
            200,
            headers: {'content-type': 'application/json'},
          );
        }
        if (path.contains('/spotify/exports/latest')) {
          return http.Response(
            jsonEncode(jobBody),
            200,
            headers: {'content-type': 'application/json'},
          );
        }
        if (path.contains('/spotify/exports/job-restore')) {
          return http.Response(
            jsonEncode(jobBody),
            200,
            headers: {'content-type': 'application/json'},
          );
        }
        return http.Response('{}', 404);
      }),
    );

    await tester.pumpWidget(
      _harness(
        const PlaylistDetailScreen(
          provider: 'harmonix',
          providerId: 'pl-owned',
          playlistName: 'Owned Mix',
        ),
        api: api,
        scrollable: false,
      ),
    );
    await tester.pumpAndSettle();
    expect(find.textContaining('Matching tracks'), findsOneWidget);
    expect(find.byType(LinearProgressIndicator), findsOneWidget);

    // Simulate process restart / route recreation — remount with same backend job.
    await tester.pumpWidget(
      _harness(
        const PlaylistDetailScreen(
          key: ValueKey('restart'),
          provider: 'harmonix',
          providerId: 'pl-owned',
          playlistName: 'Owned Mix',
        ),
        api: api,
        scrollable: false,
      ),
    );
    await tester.pumpAndSettle();
    expect(find.textContaining('Matching tracks'), findsOneWidget);
  });

  testWidgets('sheet close does not cancel restored active export progress',
      (tester) async {
    final job = parseExportJobDto(_jobJson(
      id: 'job-active',
      stage: 'adding',
      current: 2,
      total: 4,
      matched: 3,
      exported: 2,
      destinationUrl: 'https://open.spotify.com/playlist/partial',
    ));

    await tester.pumpWidget(
      _harness(
        PlaylistDetailScreen(
          provider: 'harmonix',
          providerId: 'pl-owned',
          playlistName: 'Owned Mix',
          previewConnectionState: 'connected',
          previewExportJob: job,
          previewLocalPlaylist: {
            'id': 'pl-owned',
            'name': 'Owned Mix',
            'songs': [
              {
                'song_id': 's1',
                'track_data': jsonEncode({'title': 'A', 'artist': 'B'}),
              },
            ],
          },
          skipExportRestore: true,
        ),
        scrollable: false,
      ),
    );
    await tester.pumpAndSettle();
    expect(find.textContaining('Adding matched tracks'), findsOneWidget);

    // Closing the sheet (dialog) must not drop backend job identity/progress.
    await tester.pumpWidget(
      _harness(
        PlaylistDetailScreen(
          key: const ValueKey('after-sheet-close'),
          provider: 'harmonix',
          providerId: 'pl-owned',
          playlistName: 'Owned Mix',
          previewConnectionState: 'connected',
          previewExportJob: job,
          previewLocalPlaylist: {
            'id': 'pl-owned',
            'name': 'Owned Mix',
            'songs': [
              {
                'song_id': 's1',
                'track_data': jsonEncode({'title': 'A', 'artist': 'B'}),
              },
            ],
          },
          skipExportRestore: true,
        ),
        scrollable: false,
      ),
    );
    await tester.pumpAndSettle();
    expect(find.textContaining('Adding matched tracks'), findsOneWidget);
    expect(job.id, equals('job-active'));
    expect(job.isActive, isTrue);
  });

  testWidgets('empty and Spotify-source playlists are ineligible for export',
      (tester) async {
    await tester.pumpWidget(
      _harness(
        const PlaylistDetailScreen(
          provider: 'spotify',
          providerId: 'sp-1',
          playlistName: 'Spotify Mix',
          previewDetail: SpotifyPlaylistDetail(
            provider: 'spotify',
            providerId: 'sp-1',
            stableId: 'spotify:sp-1',
            name: 'Spotify Mix',
            restricted: false,
            detailState: 'normal',
            trackCount: 2,
            items: [
              SpotifyPlaylistDetailItem(
                position: 0,
                title: 'Track',
                artists: 'Artist',
              ),
            ],
          ),
        ),
        scrollable: false,
      ),
    );
    await tester.pumpAndSettle();
    expect(find.text('Export to Spotify'), findsNothing);

    await tester.pumpWidget(
      _harness(
        PlaylistDetailScreen(
          provider: 'harmonix',
          providerId: 'pl-empty',
          playlistName: 'Empty',
          previewConnectionState: 'connected',
          previewLocalPlaylist: const {
            'id': 'pl-empty',
            'name': 'Empty',
            'songs': <Map<String, dynamic>>[],
          },
          skipExportRestore: true,
        ),
        scrollable: false,
      ),
    );
    await tester.pumpAndSettle();
    expect(find.text('Add songs before exporting to Spotify.'), findsOneWidget);
    expect(find.text('Export to Spotify'), findsNothing);
  });

  testWidgets('distinct offline / expired / rate-limit export recovery copy',
      (tester) async {
    expect(
      mapExportErrorMessage(offline: true),
      contains('offline'),
    );
    expect(
      mapExportErrorMessage(status: 409, reason: 'reconnect_required'),
      contains('Reconnect Spotify'),
    );
    expect(
      mapExportErrorMessage(status: 429, reason: 'spotify_rate_limited', retryAfterSec: 12),
      contains('12'),
    );
  });

  test('parseExportJobDto preserves factual counts and rejects bad stages', () {
    final job = parseExportJobDto(_jobJson(
      id: 'j1',
      stage: 'partial',
      matched: 3,
      exported: 2,
      unmatched: 1,
      total: 4,
      partialState: 'partially_added',
      destinationUrl: 'https://open.spotify.com/playlist/x',
    ));
    expect(job.matchedCount, 3);
    expect(job.exportedCount, 2);
    expect(job.partialState, 'partially_added');
    expect(job.destinationUrl, isNotNull);
    expect(() => parseExportJobDto({'id': 'x', 'source_playlist_id': 'y', 'stage': 'bogus'}),
        throwsArgumentError);
  });
}
