import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';

import '../theme/harmonix_theme.dart';

/// Settings-owned Spotify connection card (D-12-02 / D-12-03).
class SpotifyConnectionCard extends StatelessWidget {
  const SpotifyConnectionCard({
    super.key,
    required this.state,
    this.displayName,
    this.message,
    this.onConnect,
    this.onDisconnect,
    this.onReconnect,
    this.confirmDisconnect = false,
    this.onConfirmDisconnect,
    this.onCancelDisconnect,
  });

  /// One of: connect, connected, reconnect, disconnecting, connecting,
  /// disconnected, provider_error.
  final String state;
  final String? displayName;
  final String? message;
  final VoidCallback? onConnect;
  final VoidCallback? onDisconnect;
  final VoidCallback? onReconnect;
  final bool confirmDisconnect;
  final VoidCallback? onConfirmDisconnect;
  final VoidCallback? onCancelDisconnect;

  @override
  Widget build(BuildContext context) {
    final colors = HarmonixColors.of(context);
    final busy = state == 'connecting' || state == 'disconnecting';
    final showDisconnect =
        (state == 'connected' ||
            state == 'reconnect' ||
            state == 'provider_error') &&
        !busy;

    late final String title;
    late final String body;
    String? primaryLabel;
    VoidCallback? primaryAction;
    IconData? statusIcon;
    Color? statusColor;

    switch (state) {
      case 'connecting':
        title = 'Connecting to Spotify…';
        body =
            'Link your Spotify account to browse playlists in your Harmonix library.';
        primaryLabel = null;
        statusIcon = Icons.hourglass_top;
        statusColor = colors.accent;
      case 'disconnecting':
        title = 'Disconnecting…';
        body =
            'Disconnect Spotify? You’ll stop seeing Spotify playlists in Harmonix. You can reconnect at any time.';
        primaryLabel = null;
        statusIcon = Icons.hourglass_top;
        statusColor = colors.accent;
      case 'connected':
        title = 'Spotify connected';
        body = displayName != null && displayName!.isNotEmpty
            ? 'Connected as $displayName. Browse playlists in your Library.'
            : 'Your Spotify playlists are available in Library.';
        primaryLabel = null;
        statusIcon = Icons.check_circle_outline;
        statusColor = colors.accent;
      case 'reconnect':
        title = 'Reconnect Spotify';
        body = message ??
            'Your Spotify connection expired. Reconnect to continue.';
        primaryLabel = 'Reconnect Spotify';
        primaryAction = onReconnect ?? onConnect;
        statusIcon = Icons.warning_amber_rounded;
        statusColor = const Color(0xFFB45309);
      case 'provider_error':
        title = 'Spotify connection issue';
        body = message ??
            'Spotify is unavailable right now. Your Harmonix library is still available. Try again.';
        primaryLabel = 'Reconnect Spotify';
        primaryAction = onReconnect ?? onConnect;
        statusIcon = Icons.error_outline;
        statusColor = const Color(0xFFD32F2F);
      case 'disconnected':
        title = 'Spotify disconnected';
        body = 'You can connect again whenever you want.';
        primaryLabel = 'Connect Spotify';
        primaryAction = onConnect;
        statusIcon = null;
      default:
        title = 'Connect Spotify';
        body =
            'Link your Spotify account to browse playlists in your Harmonix library.';
        primaryLabel = 'Connect Spotify';
        primaryAction = onConnect;
        statusIcon = null;
    }

    return Semantics(
      label: 'Spotify connection',
      child: Container(
        width: double.infinity,
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: colors.surface,
          border: Border.all(color: colors.border),
          borderRadius: BorderRadius.circular(12),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                SvgPicture.asset(
                  'assets/spotify-logo.svg',
                  width: 32,
                  height: 32,
                  semanticsLabel: 'Spotify',
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          if (statusIcon != null) ...[
                            Icon(statusIcon, size: 20, color: statusColor),
                            const SizedBox(width: 6),
                          ],
                          Expanded(
                            child: Text(
                              title,
                              style: TextStyle(
                                fontSize: 16,
                                fontWeight: FontWeight.w700,
                                color: colors.textPrimary,
                              ),
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 4),
                      Text(
                        body,
                        style: TextStyle(
                          fontSize: 14,
                          height: 1.4,
                          color: colors.textMuted,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
            if (confirmDisconnect) ...[
              const SizedBox(height: 12),
              Text(
                'Disconnect Spotify? You’ll stop seeing Spotify playlists in Harmonix. You can reconnect at any time.',
                style: TextStyle(fontSize: 14, color: colors.textMuted),
              ),
              const SizedBox(height: 12),
              Row(
                children: [
                  Expanded(
                    child: OutlinedButton(
                      onPressed: onCancelDisconnect,
                      style: OutlinedButton.styleFrom(
                        minimumSize: const Size(44, 44),
                      ),
                      child: const Text('Keep connected'),
                    ),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: FilledButton(
                      onPressed: onConfirmDisconnect,
                      style: FilledButton.styleFrom(
                        backgroundColor: const Color(0xFFD32F2F),
                        foregroundColor: Colors.white,
                        minimumSize: const Size(44, 44),
                      ),
                      child: const Text('Disconnect Spotify'),
                    ),
                  ),
                ],
              ),
            ] else ...[
              if (primaryLabel != null) ...[
                const SizedBox(height: 12),
                SizedBox(
                  width: double.infinity,
                  child: FilledButton(
                    onPressed: busy ? null : primaryAction,
                    style: FilledButton.styleFrom(
                      backgroundColor: colors.accent,
                      foregroundColor: colors.onAccent,
                      minimumSize: const Size(44, 44),
                    ),
                    child: Text(primaryLabel),
                  ),
                ),
              ],
              if (showDisconnect) ...[
                const SizedBox(height: 4),
                SizedBox(
                  width: double.infinity,
                  child: TextButton(
                    onPressed: onDisconnect,
                    style: TextButton.styleFrom(
                      foregroundColor: const Color(0xFFD32F2F),
                      minimumSize: const Size(44, 44),
                    ),
                    child: const Text('Disconnect Spotify'),
                  ),
                ),
              ],
            ],
          ],
        ),
      ),
    );
  }
}
