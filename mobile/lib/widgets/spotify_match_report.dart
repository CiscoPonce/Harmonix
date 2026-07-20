import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

import '../spotify/spotify_contracts.dart';
import '../theme/harmonix_theme.dart';

/// Persistent factual export report — matched / unmatched / failed (D-12-13).
class SpotifyMatchReport extends StatelessWidget {
  const SpotifyMatchReport({
    super.key,
    required this.job,
    this.onFinish,
    this.onOpenInSpotify,
  });

  final SpotifyExportJob job;
  final VoidCallback? onFinish;
  final VoidCallback? onOpenInSpotify;

  String get _summary {
    if (job.safeReason == 'zero_matches') {
      return 'No tracks were confidently matched. Review the unmatched tracks and try again later.';
    }
    if (job.stage == 'partial' || job.partialState == 'partially_added') {
      return 'Exported ${job.exportedCount} of ${job.matchedCount} matched tracks';
    }
    if (job.partialState == 'no_create' && job.stage == 'failed') {
      return 'The export couldn’t be completed. No new playlist was created. Try again.';
    }
    if (job.partialState == 'created_empty') {
      return 'A Spotify playlist was created but no tracks were added yet.';
    }
    return 'Matched ${job.matchedCount} of ${job.totalCount}';
  }

  String _outcomeLabel(String outcome) {
    switch (outcome) {
      case 'matched':
        return 'Matched';
      case 'cached':
        return 'Matched (cached)';
      case 'unmatched':
        return 'Unmatched';
      case 'export_failed':
        return 'Export failed';
      default:
        return outcome;
    }
  }

  Future<void> _openDestination(BuildContext context) async {
    final destination = safeSpotifyUrl(job.destinationUrl);
    if (destination == null) return;
    if (onOpenInSpotify != null) {
      onOpenInSpotify!();
      return;
    }
    final uri = Uri.parse(destination);
    if (await canLaunchUrl(uri)) {
      await launchUrl(uri, mode: LaunchMode.externalApplication);
    }
  }

  @override
  Widget build(BuildContext context) {
    final colors = HarmonixColors.of(context);
    final rows = job.report?.rows ?? const <SpotifyExportReportRow>[];
    final destination = safeSpotifyUrl(job.destinationUrl);

    return Semantics(
      label: 'Spotify export match report',
      child: Container(
        width: double.infinity,
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: colors.surface,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: colors.border),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Export report',
              style: Theme.of(context).textTheme.titleMedium?.copyWith(
                    fontWeight: FontWeight.w700,
                  ),
            ),
            const SizedBox(height: 6),
            Text(
              _summary,
              style: TextStyle(color: colors.textMuted, fontSize: 14),
            ),
            const SizedBox(height: 4),
            Text(
              'Unmatched ${job.unmatchedCount}'
              '${job.failedCount > 0 ? ' · Failed ${job.failedCount}' : ''}',
              style: TextStyle(color: colors.textMuted, fontSize: 14),
            ),
            if (rows.isNotEmpty) ...[
              const SizedBox(height: 12),
              ConstrainedBox(
                constraints: const BoxConstraints(maxHeight: 280),
                child: ListView.separated(
                  shrinkWrap: true,
                  itemCount: rows.length,
                  separatorBuilder: (_, _) => const SizedBox(height: 8),
                  itemBuilder: (context, index) {
                    final row = rows[index];
                    final label = row.sourceIdentity.replaceFirst(
                      RegExp(r'^harmonix:'),
                      '',
                    );
                    return Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 12,
                        vertical: 10,
                      ),
                      decoration: BoxDecoration(
                        borderRadius: BorderRadius.circular(8),
                        border: Border.all(color: colors.border),
                      ),
                      child: Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  label.isEmpty ? row.sourceIdentity : label,
                                  maxLines: 2,
                                  overflow: TextOverflow.ellipsis,
                                  style: TextStyle(
                                    fontWeight: FontWeight.w600,
                                    color: colors.textPrimary,
                                  ),
                                ),
                                if (row.reason != null &&
                                    row.reason!.isNotEmpty)
                                  Text(
                                    row.reason!,
                                    style: TextStyle(
                                      fontSize: 12,
                                      color: colors.textMuted,
                                    ),
                                  ),
                              ],
                            ),
                          ),
                          const SizedBox(width: 8),
                          Text(
                            _outcomeLabel(row.outcome).toUpperCase(),
                            style: const TextStyle(
                              fontSize: 11,
                              fontWeight: FontWeight.w800,
                              letterSpacing: 0.4,
                              color: HarmonixColors.brand,
                            ),
                          ),
                        ],
                      ),
                    );
                  },
                ),
              ),
            ],
            const SizedBox(height: 12),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                if (destination != null)
                  FilledButton(
                    onPressed: () => _openDestination(context),
                    style: FilledButton.styleFrom(
                      backgroundColor: HarmonixColors.brand,
                      minimumSize: const Size(44, 44),
                    ),
                    child: const Text('Open in Spotify'),
                  ),
                if (onFinish != null)
                  OutlinedButton(
                    onPressed: onFinish,
                    style: OutlinedButton.styleFrom(
                      minimumSize: const Size(44, 44),
                    ),
                    child: const Text('Finish export'),
                  ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
