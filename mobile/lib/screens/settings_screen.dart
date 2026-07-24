import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:url_launcher/url_launcher.dart';

import '../constants/learning_prefs.dart';
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
  bool _prefsSaving = false;
  String? _prefsMessage;

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

  Future<void> _savePrefs(Map<String, String> patch, {String? successHint}) async {
    if (_prefsSaving) return;
    final auth = context.read<AuthState>();
    final api = context.read<ApiClient>();
    setState(() {
      _prefsSaving = true;
      _prefsMessage = null;
    });
    try {
      await api.patchPreferences(patch);
      await auth.refreshUser();
      if (!mounted) return;
      setState(() {
        _prefsMessage = successHint ?? 'Saved';
      });
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Could not save preferences: $e')),
      );
    } finally {
      if (mounted) setState(() => _prefsSaving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthState>();
    final themeCtrl = context.watch<ThemeController>();
    final colors = HarmonixColors.of(context);
    final user = auth.user ?? {};
    final nativeLang = normalizeLanguage(user['native_language']?.toString(), fallback: 'en');
    final targetLang = normalizeLanguage(user['target_language']?.toString(), fallback: 'fr');
    final genre = normalizeGenre(user['genre']?.toString());
    final voice = normalizeVoiceGender(user['voice_gender']?.toString());

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
              '$nativeLang → $targetLang · $genre · $voice',
              style: TextStyle(color: colors.textMuted),
            ),
          ),
          if (_prefsMessage != null) ...[
            const SizedBox(height: 4),
            Text(
              _prefsMessage!,
              style: TextStyle(color: colors.accent, fontSize: 12, fontWeight: FontWeight.w600),
            ),
          ],
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
                        value: nativeLang,
                        decoration: const InputDecoration(
                          labelText: 'Home Language',
                          border: OutlineInputBorder(),
                          contentPadding: EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                        ),
                        items: [
                          for (final l in kLanguages)
                            DropdownMenuItem(value: l.$1, child: Text(l.$2)),
                        ],
                        onChanged: _prefsSaving
                            ? null
                            : (val) {
                                if (val != null) {
                                  _savePrefs({'native_language': val}, successHint: 'Home language saved');
                                }
                              },
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: DropdownButtonFormField<String>(
                        isExpanded: true,
                        value: targetLang,
                        decoration: const InputDecoration(
                          labelText: 'Learning',
                          border: OutlineInputBorder(),
                          contentPadding: EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                        ),
                        items: [
                          for (final l in kLanguages)
                            DropdownMenuItem(value: l.$1, child: Text(l.$2)),
                        ],
                        onChanged: _prefsSaving
                            ? null
                            : (val) {
                                if (val != null) {
                                  _savePrefs(
                                    {'target_language': val},
                                    successHint: 'Learning language saved — word queue refreshed',
                                  );
                                }
                              },
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 20),
                Text(
                  'MUSIC STYLE',
                  style: Theme.of(context).textTheme.titleSmall?.copyWith(color: colors.accent),
                ),
                const SizedBox(height: 4),
                Text(
                  'Prefer songs in this style when picking words. Changing style refreshes your word queue.',
                  style: TextStyle(color: colors.textMuted, fontSize: 12),
                ),
                const SizedBox(height: 10),
                Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  children: [
                    for (final s in kMusicStyles)
                      ChoiceChip(
                        label: Text(s.$2),
                        selected: genre == s.$1,
                        selectedColor: colors.accent.withValues(alpha: 0.22),
                        labelStyle: TextStyle(
                          fontWeight: FontWeight.w700,
                          color: genre == s.$1 ? colors.accent : colors.textPrimary,
                        ),
                        side: BorderSide(color: genre == s.$1 ? colors.accent : colors.border),
                        onSelected: _prefsSaving
                            ? null
                            : (_) => _savePrefs(
                                  {'genre': s.$1},
                                  successHint: 'Music style saved — word queue refreshed',
                                ),
                      ),
                  ],
                ),
                const SizedBox(height: 20),
                Text(
                  'VOICE',
                  style: Theme.of(context).textTheme.titleSmall?.copyWith(color: colors.accent),
                ),
                const SizedBox(height: 4),
                Text(
                  'Pocket-TTS pronunciation voice for daily words.',
                  style: TextStyle(color: colors.textMuted, fontSize: 12),
                ),
                const SizedBox(height: 10),
                SegmentedButton<String>(
                  segments: [
                    for (final v in kVoiceGenders)
                      ButtonSegment(value: v.$1, label: Text(v.$2), icon: Icon(
                        v.$1 == 'female' ? Icons.record_voice_over : Icons.record_voice_over_outlined,
                      )),
                  ],
                  selected: {voice},
                  onSelectionChanged: _prefsSaving
                      ? null
                      : (next) {
                          if (next.isEmpty) return;
                          _savePrefs(
                            {'voice_gender': next.first},
                            successHint: 'Voice saved',
                          );
                        },
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
