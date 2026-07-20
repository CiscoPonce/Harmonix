import 'package:flutter/material.dart';

import '../spotify/spotify_contracts.dart';
import '../theme/harmonix_theme.dart';

/// Material confirmation + real determinate export progress (D-12-13 / D-12-15).
class SpotifyExportSheet extends StatelessWidget {
  const SpotifyExportSheet({
    super.key,
    required this.playlistName,
    required this.songCount,
    required this.onCancel,
    required this.onConfirm,
    this.job,
    this.busy = false,
    this.errorMessage,
  });

  final String playlistName;
  final int songCount;
  final SpotifyExportJob? job;
  final bool busy;
  final String? errorMessage;
  final VoidCallback onCancel;
  final VoidCallback onConfirm;

  static Future<void> show(
    BuildContext context, {
    required String playlistName,
    required int songCount,
    required Future<void> Function() onConfirm,
    SpotifyExportJob? job,
    String? errorMessage,
  }) {
    return showDialog<void>(
      context: context,
      barrierDismissible: false,
      builder: (ctx) {
        return _SpotifyExportSheetHost(
          playlistName: playlistName,
          songCount: songCount,
          initialJob: job,
          initialError: errorMessage,
          onConfirm: onConfirm,
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    final colors = HarmonixColors.of(context);
    final active = (job != null && job!.isActive) || busy;
    final progressMax = job != null
        ? (job!.totalCount > 0
            ? job!.totalCount
            : (job!.matchedCount > 0 ? job!.matchedCount : 1))
        : (songCount > 0 ? songCount : 1);
    final progressValue = job == null
        ? 0
        : job!.stage == 'adding'
            ? job!.exportedCount
            : job!.currentCount;

    return AlertDialog(
      backgroundColor: colors.surface,
      title: const Text('Export to Spotify'),
      content: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Harmonix will match tracks before creating anything in Spotify.',
              style: TextStyle(color: colors.textMuted, fontSize: 14),
            ),
            const SizedBox(height: 16),
            _metaRow('Playlist', playlistName, colors),
            _metaRow('Songs', '$songCount', colors),
            _metaRow('Destination', 'Private Spotify playlist', colors),
            if (job != null || busy) ...[
              const SizedBox(height: 16),
              Semantics(
                liveRegion: true,
                label: job != null
                    ? exportProgressLabel(job!)
                    : 'Starting export…',
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      job != null
                          ? exportProgressLabel(job!)
                          : 'Starting export…',
                      style: const TextStyle(
                        color: HarmonixColors.brand,
                        fontWeight: FontWeight.w600,
                        fontSize: 14,
                      ),
                    ),
                    const SizedBox(height: 8),
                    Semantics(
                      label:
                          'Export progress $progressValue of $progressMax',
                      child: LinearProgressIndicator(
                        value: progressMax <= 0
                            ? null
                            : (progressValue / progressMax).clamp(0.0, 1.0),
                        color: HarmonixColors.brand,
                        backgroundColor: colors.border,
                        minHeight: 8,
                      ),
                    ),
                  ],
                ),
              ),
            ],
            if (errorMessage != null && errorMessage!.isNotEmpty) ...[
              const SizedBox(height: 12),
              Text(
                errorMessage!,
                style: TextStyle(
                  color: Theme.of(context).colorScheme.error,
                  fontSize: 14,
                ),
              ),
            ],
          ],
        ),
      ),
      actions: [
        TextButton(
          onPressed: active ? null : onCancel,
          style: TextButton.styleFrom(minimumSize: const Size(44, 44)),
          child: const Text('Cancel export'),
        ),
        FilledButton(
          onPressed: active ? null : onConfirm,
          style: FilledButton.styleFrom(
            backgroundColor: HarmonixColors.brand,
            minimumSize: const Size(44, 44),
          ),
          child: const Text('Start export'),
        ),
      ],
    );
  }

  Widget _metaRow(String label, String value, HarmonixColors colors) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 6),
      child: Row(
        children: [
          SizedBox(
            width: 96,
            child: Text(
              label,
              style: TextStyle(color: colors.textMuted, fontSize: 13),
            ),
          ),
          Expanded(
            child: Text(
              value,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(
                color: colors.textPrimary,
                fontWeight: FontWeight.w600,
                fontSize: 13,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _SpotifyExportSheetHost extends StatefulWidget {
  const _SpotifyExportSheetHost({
    required this.playlistName,
    required this.songCount,
    required this.onConfirm,
    this.initialJob,
    this.initialError,
  });

  final String playlistName;
  final int songCount;
  final SpotifyExportJob? initialJob;
  final String? initialError;
  final Future<void> Function() onConfirm;

  @override
  State<_SpotifyExportSheetHost> createState() => _SpotifyExportSheetHostState();
}

class _SpotifyExportSheetHostState extends State<_SpotifyExportSheetHost> {
  bool _busy = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _error = widget.initialError;
  }

  Future<void> _confirm() async {
    if (_busy) return;
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await widget.onConfirm();
      if (mounted) Navigator.of(context).pop();
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _busy = false;
        _error = e.toString();
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return SpotifyExportSheet(
      playlistName: widget.playlistName,
      songCount: widget.songCount,
      job: widget.initialJob,
      busy: _busy,
      errorMessage: _error,
      onCancel: () {
        if (_busy) return;
        Navigator.of(context).pop();
      },
      onConfirm: _confirm,
    );
  }
}
