import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';
import 'package:url_launcher/url_launcher.dart';

import '../spotify/spotify_contracts.dart';
import '../theme/harmonix_theme.dart';

/// Provider-aware playlist identity used by Library list contracts.
class ProviderPlaylist {
  const ProviderPlaylist({
    required this.provider,
    required this.providerId,
    required this.name,
    this.externalUrl,
    this.artworkUrl,
    this.trackCount,
    this.songCount,
  });

  final String provider;
  final String providerId;
  final String name;
  final String? externalUrl;
  final String? artworkUrl;
  final int? trackCount;
  final int? songCount;

  String get stableId => '$provider:$providerId';
}

/// Provider-separated Library list: Harmonix → Spotify → Recent Discoveries.
class SpotifyLibraryList extends StatelessWidget {
  const SpotifyLibraryList({
    super.key,
    required this.harmonixPlaylists,
    required this.spotifyPlaylists,
    required this.recentDiscoveries,
    this.spotifyError,
    this.spotifyLoading = false,
    this.harmonixLoading = false,
    this.onwardUrl,
    this.onRefresh,
    this.onOpenPlaylist,
    this.onOpenSettings,
    this.onCreatePlaylist,
    this.header,
  });

  final List<ProviderPlaylist> harmonixPlaylists;
  final List<ProviderPlaylist> spotifyPlaylists;
  final List<Map<String, dynamic>> recentDiscoveries;
  final String? spotifyError;
  final bool spotifyLoading;
  final bool harmonixLoading;
  final String? onwardUrl;
  final Future<void> Function()? onRefresh;
  final void Function(ProviderPlaylist playlist)? onOpenPlaylist;
  final VoidCallback? onOpenSettings;
  final VoidCallback? onCreatePlaylist;
  final Widget? header;

  @override
  Widget build(BuildContext context) {
    final colors = HarmonixColors.of(context);
    final capped = capSpotifyPlaylistShelf(spotifyPlaylists, max: 20);
    final safeOnward = safeSpotifyUrl(onwardUrl);
    final showOnward = spotifyPlaylists.length > 20 && safeOnward != null;

    final list = ListView(
      physics: const AlwaysScrollableScrollPhysics(),
      padding: const EdgeInsets.all(20),
      children: [
        header ??
            Row(
              children: [
                Text(
                  'Library',
                  style: Theme.of(context).textTheme.headlineMedium?.copyWith(
                        color: colors.textPrimary,
                      ),
                ),
                const Spacer(),
                if (onCreatePlaylist != null)
                  IconButton(
                    onPressed: onCreatePlaylist,
                    icon: Icon(Icons.add_circle, color: colors.accent),
                  ),
              ],
            ),
        const SizedBox(height: 16),
        _SectionLabel('HARMONIX PLAYLISTS'),
        const SizedBox(height: 8),
        if (harmonixLoading)
          ...List.generate(2, (_) => const _PlaylistSkeleton())
        else if (harmonixPlaylists.isEmpty)
          Text(
            'No playlists yet',
            style: TextStyle(color: colors.textMuted),
          )
        else
          ...harmonixPlaylists.map(
            (p) => _PlaylistCard(
              playlist: p,
              onTap: onOpenPlaylist == null ? null : () => onOpenPlaylist!(p),
            ),
          ),
        const SizedBox(height: 24),
        _SectionLabel('SPOTIFY PLAYLISTS'),
        const SizedBox(height: 8),
        if (spotifyLoading)
          ...List.generate(2, (_) => const _PlaylistSkeleton())
        else if (spotifyError != null) ...[
          _SpotifyErrorBanner(
            message: spotifyError!,
            onOpenSettings: onOpenSettings,
          ),
        ] else if (capped.isEmpty)
          Text(
            'No Spotify playlists found',
            style: TextStyle(color: colors.textMuted),
          )
        else ...[
          ...capped.map(
            (p) => _PlaylistCard(
              playlist: p,
              onTap: onOpenPlaylist == null ? null : () => onOpenPlaylist!(p),
            ),
          ),
          if (showOnward)
            Padding(
              padding: const EdgeInsets.only(top: 8),
              child: TextButton(
                onPressed: () => _launchSafe(safeOnward),
                style: TextButton.styleFrom(
                  foregroundColor: colors.accent,
                  minimumSize: const Size(44, 44),
                ),
                child: const Text('Open more playlists in Spotify'),
              ),
            ),
        ],
        const SizedBox(height: 24),
        _SectionLabel('RECENT DISCOVERIES'),
        const SizedBox(height: 8),
        if (recentDiscoveries.isEmpty)
          Text(
            'No recent words',
            style: TextStyle(color: colors.textMuted),
          )
        else
          ...recentDiscoveries.map((item) {
            final word = item['word'] as Map<String, dynamic>? ?? {};
            final song = item['song'] as Map<String, dynamic>?;
            final title = item['title']?.toString();
            final artist = item['artist']?.toString();
            return ListTile(
              contentPadding: EdgeInsets.zero,
              title: Text(
                word['text']?.toString() ?? title ?? '',
                style: const TextStyle(fontWeight: FontWeight.w800),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
              subtitle: Text(
                [
                  word['translation'],
                  if (song != null) '${song['artist']} — ${song['title']}',
                  if (song == null && artist != null && title != null)
                    '$artist — $title',
                ].whereType<String>().where((s) => s.isNotEmpty).join(' · '),
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
              ),
            );
          }),
      ],
    );

    if (onRefresh == null) return list;
    return RefreshIndicator(
      color: colors.accent,
      onRefresh: onRefresh!,
      child: list,
    );
  }

  Future<void> _launchSafe(String url) async {
    final uri = Uri.parse(url);
    await launchUrl(uri, mode: LaunchMode.externalApplication);
  }
}

class _SectionLabel extends StatelessWidget {
  const _SectionLabel(this.text);
  final String text;

  @override
  Widget build(BuildContext context) {
    final colors = HarmonixColors.of(context);
    return Text(
      text,
      style: TextStyle(
        fontSize: 14,
        fontWeight: FontWeight.w700,
        letterSpacing: 1.4,
        color: colors.textMuted,
      ),
    );
  }
}

class _SpotifyErrorBanner extends StatelessWidget {
  const _SpotifyErrorBanner({
    required this.message,
    this.onOpenSettings,
  });

  final String message;
  final VoidCallback? onOpenSettings;

  @override
  Widget build(BuildContext context) {
    final colors = HarmonixColors.of(context);
    final needsSettings = message.toLowerCase().contains('settings') ||
        message.toLowerCase().contains('reconnect') ||
        message.toLowerCase().contains('connect spotify');
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        border: Border.all(color: colors.border),
        borderRadius: BorderRadius.circular(12),
        color: colors.surface,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(message, style: TextStyle(color: colors.textMuted, fontSize: 14)),
          if (needsSettings && onOpenSettings != null) ...[
            const SizedBox(height: 8),
            TextButton(
              onPressed: onOpenSettings,
              style: TextButton.styleFrom(
                foregroundColor: colors.accent,
                minimumSize: const Size(44, 44),
                padding: EdgeInsets.zero,
              ),
              child: const Text('Open Settings'),
            ),
          ],
        ],
      ),
    );
  }
}

class _PlaylistSkeleton extends StatelessWidget {
  const _PlaylistSkeleton();

  @override
  Widget build(BuildContext context) {
    final colors = HarmonixColors.of(context);
    return Container(
      height: 88,
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        border: Border.all(color: colors.border),
        borderRadius: BorderRadius.circular(12),
        color: colors.surface,
      ),
      child: Row(
        children: [
          Container(
            width: 64,
            height: 64,
            decoration: BoxDecoration(
              color: colors.border,
              borderRadius: BorderRadius.circular(8),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Container(height: 14, width: 140, color: colors.border),
                const SizedBox(height: 8),
                Container(height: 12, width: 80, color: colors.border),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _PlaylistCard extends StatelessWidget {
  const _PlaylistCard({required this.playlist, this.onTap});

  final ProviderPlaylist playlist;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final colors = HarmonixColors.of(context);
    final isSpotify = playlist.provider == 'spotify';
    final count = isSpotify
        ? playlist.trackCount
        : (playlist.songCount ?? playlist.trackCount);
    final countLabel = isSpotify
        ? (count == null
            ? 'Tracks'
            : '$count track${count == 1 ? '' : 's'}')
        : '${count ?? 0} song${(count ?? 0) == 1 ? '' : 's'}';

    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Material(
        color: colors.surface,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(12),
          side: BorderSide(color: colors.border),
        ),
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(12),
          child: Padding(
            padding: const EdgeInsets.all(12),
            child: Row(
              children: [
                _Artwork(url: playlist.artworkUrl, isSpotify: isSpotify),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        playlist.name,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.w700,
                          color: colors.textPrimary,
                        ),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        countLabel,
                        style: TextStyle(fontSize: 14, color: colors.textMuted),
                      ),
                      const SizedBox(height: 4),
                      _ProviderBadge(provider: playlist.provider),
                    ],
                  ),
                ),
                Icon(Icons.chevron_right, color: colors.textMuted),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _Artwork extends StatelessWidget {
  const _Artwork({this.url, required this.isSpotify});
  final String? url;
  final bool isSpotify;

  @override
  Widget build(BuildContext context) {
    final colors = HarmonixColors.of(context);
    final placeholder = Container(
      width: 64,
      height: 64,
      decoration: BoxDecoration(
        border: Border.all(color: colors.border),
        borderRadius: BorderRadius.circular(8),
        color: colors.background,
      ),
      child: Icon(Icons.music_note, color: colors.textMuted),
    );
    if (url == null || url!.isEmpty) return placeholder;
    return ClipRRect(
      borderRadius: BorderRadius.circular(8),
      child: Image.network(
        url!,
        width: 64,
        height: 64,
        fit: BoxFit.cover,
        errorBuilder: (_, error, stackTrace) => placeholder,
      ),
    );
  }
}

class _ProviderBadge extends StatelessWidget {
  const _ProviderBadge({required this.provider});
  final String provider;

  @override
  Widget build(BuildContext context) {
    final colors = HarmonixColors.of(context);
    if (provider == 'spotify') {
      return Container(
        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
        decoration: BoxDecoration(
          border: Border.all(color: colors.border),
          borderRadius: BorderRadius.circular(4),
          color: colors.background,
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            SvgPicture.asset(
              'assets/spotify-logo.svg',
              width: 14,
              height: 14,
            ),
            const SizedBox(width: 4),
            Text(
              'Spotify',
              style: TextStyle(
                fontSize: 14,
                fontWeight: FontWeight.w700,
                color: colors.textPrimary,
              ),
            ),
          ],
        ),
      );
    }
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
      decoration: BoxDecoration(
        border: Border.all(color: colors.accent),
        borderRadius: BorderRadius.circular(4),
      ),
      child: Text(
        'Harmonix',
        style: TextStyle(
          fontSize: 14,
          fontWeight: FontWeight.w700,
          color: colors.accent,
        ),
      ),
    );
  }
}
