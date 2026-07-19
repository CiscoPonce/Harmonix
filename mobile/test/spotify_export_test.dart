import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:harmonix_mobile/theme/harmonix_theme.dart';

const kSentinel = 'NOT_IMPLEMENTED_SPOTIFY_EXPORT';

enum ExportPhase { idle, matching, creating, adding, complete, failed }

class SpotifyExportReportRow {
  const SpotifyExportReportRow({
    required this.sourceIdentity,
    required this.outcome,
    this.reason,
    this.spotifyUri,
  });

  final String sourceIdentity;
  final String outcome; // matched | unmatched | cached | export_failed
  final String? reason;
  final String? spotifyUri;
}

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
  });

  final bool eligible;
  final ExportPhase phase;
  final double progress;
  final List<SpotifyExportReportRow> rows;
  final String? destinationUrl;
  final String? partialState; // none | no_create | created_empty | partially_added
  final String? errorMessage;
  final VoidCallback? onExport;
  final VoidCallback? onRestore;
}

Widget? buildSpotifyExportPanel(SpotifyExportArgs args) {
  // Intended after 12-09:
  // return SpotifyExportPanel(...);
  return null;
}

Widget _harness(Widget child) {
  return MaterialApp(
    theme: buildHarmonixTheme(brightness: Brightness.light),
    home: Scaffold(body: child),
  );
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
    if (panel == null) {
      fail('$kSentinel: SpotifyExportPanel eligibility contract missing');
    }
    await tester.pumpWidget(_harness(panel));
    expect(find.text('Export to Spotify'), findsOneWidget);
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
      if (panel == null) {
        fail('$kSentinel: SpotifyExportPanel progress for $phase missing');
      }
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
    if (panel == null) {
      fail('$kSentinel: SpotifyExportPanel report/restoration missing');
    }
  });

  testWidgets('reports mutation failure states: no_create, created_empty, partially_added', (tester) async {
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
          destinationUrl: state == 'no_create' ? null : 'https://open.spotify.com/playlist/partial',
        ),
      );
      if (panel == null) {
        fail('$kSentinel: SpotifyExportPanel mutation failure state $state missing');
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
        errorMessage:
            'No tracks were confidently matched. Review the unmatched tracks and try again later.',
      ),
    );
    if (panel == null) {
      fail('$kSentinel: SpotifyExportPanel zero-match report missing');
    }
  });
}
