import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:url_launcher/url_launcher.dart';

import '../services/api_client.dart';
import '../spotify/spotify_contracts.dart';
import '../state/auth_state.dart';
import '../state/home_navigation_controller.dart';
import '../state/theme_controller.dart';
import '../theme/harmonix_theme.dart';
import '../widgets/spotify_connection_card.dart';

class SettingsScreen extends StatefulWidget {
  const SettingsScreen({super.key});

  @override
  State<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends State<SettingsScreen> {
  Map<String, dynamic>? _stats;
  List<dynamic> _badges = [];
  bool _loading = true;

  String _spotifyState = 'connect';
  String? _spotifyDisplayName;
  String? _spotifyMessage;
  bool _confirmDisconnect = false;
  bool _consumedNavRecovery = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_consumedNavRecovery) return;
    _consumedNavRecovery = true;
    final nav = context.read<HomeNavigationController>();
    final reason = nav.consumeRecoveryReason();
    if (reason != null) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (!mounted) return;
        setState(() {
          _spotifyState = 'provider_error';
          _spotifyMessage =
              'Spotify authorization didn’t finish. You can try connecting again.';
        });
      });
    }
  }

  Future<void> _load() async {
    final api = context.read<ApiClient>();
    setState(() => _loading = true);
    try {
      final stats = await api.progressStats();
      final badges = await api.badges();
      SpotifyConnectionStatus? spotify;
      try {
        spotify = await api.spotifyStatus();
      } catch (_) {
        spotify = null;
      }
      if (!mounted) return;
      setState(() {
        _stats = stats;
        _badges = badges;
        if (spotify != null) {
          _spotifyState = spotify.state;
          _spotifyDisplayName = spotify.displayName;
          if (spotify.state == 'reconnect') {
            _spotifyMessage =
                spotify.reason == 'authorization_expired'
                    ? 'Your Spotify connection expired. Reconnect to continue.'
                    : (spotify.reason ??
                        'Your Spotify connection expired. Reconnect to continue.');
          } else if (spotify.state == 'provider_error') {
            _spotifyMessage =
                'Spotify is unavailable right now. Your Harmonix library is still available. Try again.';
          }
        }
      });
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('$e')));
      }
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _connectSpotify() async {
    final api = context.read<ApiClient>();
    setState(() {
      _spotifyState = 'connecting';
      _spotifyMessage = null;
    });
    try {
      final url = await api.spotifyAuthStart(client: 'android');
      final uri = Uri.parse(url);
      final launched = await launchUrl(uri, mode: LaunchMode.externalApplication);
      if (!launched && mounted) {
        setState(() {
          _spotifyState = 'provider_error';
          _spotifyMessage =
              'Could not open the Spotify authorization page. Try again.';
        });
      }
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() {
        _spotifyState = 'provider_error';
        _spotifyMessage = e.message;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _spotifyState = 'provider_error';
        _spotifyMessage =
            'Spotify is unavailable right now. Your Harmonix library is still available. Try again.';
      });
    }
  }

  Future<void> _disconnectSpotify() async {
    final api = context.read<ApiClient>();
    setState(() {
      _confirmDisconnect = false;
      _spotifyState = 'disconnecting';
    });
    try {
      await api.disconnectSpotify();
      if (!mounted) return;
      setState(() {
        _spotifyState = 'connect';
        _spotifyDisplayName = null;
        _spotifyMessage = null;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _spotifyState = 'connected';
        _spotifyMessage = 'Could not disconnect Spotify. Try again.';
      });
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Could not disconnect Spotify. Try again.')),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthState>();
    final themeCtrl = context.watch<ThemeController>();
    final colors = HarmonixColors.of(context);
    final user = auth.user ?? {};

    if (_loading) {
      return Center(child: CircularProgressIndicator(color: colors.accent));
    }

    return RefreshIndicator(
      color: colors.accent,
      onRefresh: _load,
      child: ListView(
        padding: const EdgeInsets.all(20),
        children: [
          Text(
            'Settings',
            style: Theme.of(context).textTheme.headlineMedium?.copyWith(color: colors.textPrimary),
          ),
          const SizedBox(height: 16),
          ListTile(
            contentPadding: EdgeInsets.zero,
            leading: CircleAvatar(
              backgroundColor: colors.accent,
              child: Icon(Icons.person, color: colors.onAccent),
            ),
            title: Text(
              user['email']?.toString() ?? 'Learner',
              style: TextStyle(fontWeight: FontWeight.w800, color: colors.textPrimary),
            ),
            subtitle: Text(
              '${user['native_language'] ?? 'en'} → ${user['target_language'] ?? 'fr'}',
              style: TextStyle(color: colors.textMuted),
            ),
          ),
          const SizedBox(height: 8),
          Text(
            'Languages can be changed below. Genre and difficulty are set during onboarding and are not editable here.',
            style: TextStyle(color: colors.textMuted, fontSize: 12),
          ),
          const SizedBox(height: 12),
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: colors.surface,
              border: Border.all(color: colors.border),
              borderRadius: BorderRadius.circular(12),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'LANGUAGES',
                  style: Theme.of(context).textTheme.titleSmall?.copyWith(color: colors.accent),
                ),
                const SizedBox(height: 12),
                Row(
                  children: [
                    Expanded(
                      child: DropdownButtonFormField<String>(
                        isExpanded: true,
                        value: (user['native_language']?.toString().isNotEmpty == true)
                            ? user['native_language'].toString()
                            : 'en',
                        decoration: const InputDecoration(
                          labelText: 'Home Language',
                          border: OutlineInputBorder(),
                          contentPadding: EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                        ),
                        items: const [
                          DropdownMenuItem(value: 'en', child: Text('English')),
                          DropdownMenuItem(value: 'es', child: Text('Spanish')),
                          DropdownMenuItem(value: 'fr', child: Text('French')),
                          DropdownMenuItem(value: 'de', child: Text('German')),
                          DropdownMenuItem(value: 'it', child: Text('Italian')),
                          DropdownMenuItem(value: 'ja', child: Text('Japanese')),
                        ],
                        onChanged: (val) async {
                          if (val != null) {
                            try {
                              final api = context.read<ApiClient>();
                              await api.patchPreferences({'native_language': val});
                              await auth.refreshUser();
                            } catch (_) {}
                          }
                        },
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: DropdownButtonFormField<String>(
                        isExpanded: true,
                        value: (user['target_language']?.toString().isNotEmpty == true)
                            ? user['target_language'].toString()
                            : 'fr',
                        decoration: const InputDecoration(
                          labelText: 'Learning',
                          border: OutlineInputBorder(),
                          contentPadding: EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                        ),
                        items: const [
                          DropdownMenuItem(value: 'fr', child: Text('French')),
                          DropdownMenuItem(value: 'es', child: Text('Spanish')),
                          DropdownMenuItem(value: 'de', child: Text('German')),
                          DropdownMenuItem(value: 'it', child: Text('Italian')),
                          DropdownMenuItem(value: 'ja', child: Text('Japanese')),
                          DropdownMenuItem(value: 'en', child: Text('English')),
                        ],
                        onChanged: (val) async {
                          if (val != null) {
                            try {
                              final api = context.read<ApiClient>();
                              await api.patchPreferences({'target_language': val});
                              await auth.refreshUser();
                              if (mounted) {
                                ScaffoldMessenger.of(context).showSnackBar(
                                  SnackBar(content: Text('Target language updated to $val')),
                                );
                              }
                            } catch (_) {}
                          }
                        },
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
          const SizedBox(height: 8),
          SpotifyConnectionCard(
            state: _spotifyState,
            displayName: _spotifyDisplayName,
            message: _spotifyMessage,
            confirmDisconnect: _confirmDisconnect,
            onConnect: _connectSpotify,
            onReconnect: _connectSpotify,
            onDisconnect: () => setState(() => _confirmDisconnect = true),
            onConfirmDisconnect: _disconnectSpotify,
            onCancelDisconnect: () => setState(() => _confirmDisconnect = false),
          ),
          const SizedBox(height: 16),
          Text('APPEARANCE', style: Theme.of(context).textTheme.titleSmall),
          const SizedBox(height: 4),
          SwitchListTile(
            contentPadding: EdgeInsets.zero,
            title: Text('Dark mode', style: TextStyle(color: colors.textPrimary, fontWeight: FontWeight.w700)),
            subtitle: Text(
              themeCtrl.isDark ? 'Dark theme on' : 'Light theme on',
              style: TextStyle(color: colors.textMuted),
            ),
            secondary: Icon(
              themeCtrl.isDark ? Icons.dark_mode : Icons.light_mode,
              color: colors.accent,
            ),
            value: themeCtrl.isDark,
            activeThumbColor: colors.onAccent,
            activeTrackColor: colors.accent,
            onChanged: (v) => themeCtrl.setDarkMode(v),
          ),
          const SizedBox(height: 16),
          Text('STATS', style: Theme.of(context).textTheme.titleSmall),
          const SizedBox(height: 8),
          Row(
            children: [
              _StatTile(label: 'Streak', value: '${_stats?['streak_days'] ?? 0}'),
              const SizedBox(width: 12),
              _StatTile(label: 'Words', value: '${_stats?['total_words'] ?? 0}'),
              const SizedBox(width: 12),
              _StatTile(label: 'Today', value: '${_stats?['today_words'] ?? 0}/${_stats?['daily_goal'] ?? 1}'),
            ],
          ),
          const SizedBox(height: 24),
          Text('ACHIEVEMENTS', style: Theme.of(context).textTheme.titleSmall),
          const SizedBox(height: 8),
          if (_badges.isEmpty)
            Text('No badges yet', style: TextStyle(color: colors.textMuted)),
          ..._badges.map((raw) {
            final b = raw as Map<String, dynamic>;
            final unlocked = b['unlocked'] == 1 || b['unlocked'] == true;
            return ListTile(
              contentPadding: EdgeInsets.zero,
              leading: Icon(
                unlocked ? Icons.emoji_events : Icons.lock_outline,
                color: unlocked ? colors.accent : colors.textMuted,
              ),
              title: Text(b['name']?.toString() ?? b['id']?.toString() ?? 'Badge'),
              subtitle: Text(b['description']?.toString() ?? b['category']?.toString() ?? ''),
            );
          }),
          const SizedBox(height: 24),
          OutlinedButton(
            onPressed: () => auth.logout(),
            style: OutlinedButton.styleFrom(
              foregroundColor: Colors.red.shade400,
              side: BorderSide(color: Colors.red.shade300),
              padding: const EdgeInsets.symmetric(vertical: 14),
            ),
            child: const Text('Log out'),
          ),
        ],
      ),
    );
  }
}

class _StatTile extends StatelessWidget {
  const _StatTile({required this.label, required this.value});
  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    final colors = HarmonixColors.of(context);
    return Expanded(
      child: Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: colors.surface,
          border: Border.all(color: colors.border),
          borderRadius: BorderRadius.circular(12),
        ),
        child: Column(
          children: [
            Text(value, style: TextStyle(fontWeight: FontWeight.w900, fontSize: 20, color: colors.textPrimary)),
            Text(label, style: Theme.of(context).textTheme.titleSmall),
          ],
        ),
      ),
    );
  }
}
