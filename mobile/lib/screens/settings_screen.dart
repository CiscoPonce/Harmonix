import 'dart:typed_data';

import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import 'package:provider/provider.dart';
import 'package:url_launcher/url_launcher.dart';

import '../constants/learning_prefs.dart';
import '../services/api_client.dart';
import '../spotify/spotify_contracts.dart';
import '../state/auth_state.dart';
import '../state/home_navigation_controller.dart';
import '../state/reminder_controller.dart';
import '../state/theme_controller.dart';
import '../theme/harmonix_theme.dart';
import '../utils/i18n.dart';
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
  bool _personalizationNeeded = false;
  bool _confirmDisconnect = false;
  String? _styleLang;
  List<(String, String)> _styles = kMusicStyles;
  Uint8List? _avatarBytes;
  Map<String, dynamic>? _nextPreview;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    final nav = context.watch<HomeNavigationController>();
    final reason = nav.consumeRecoveryReason();
    if (reason != null) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (!mounted) return;
        setState(() {
          _spotifyState = 'provider_error';
          _spotifyMessage = switch (reason) {
            'denied' => context.tr('spotify_denied'),
            'not_allowlisted' => context.tr('spotify_not_allowlisted'),
            _ => context.tr('spotify_auth_failed'),
          };
        });
      });
    }
  }

  Future<void> _load() async {
    final api = context.read<ApiClient>();
    final auth = context.read<AuthState>();
    setState(() => _loading = true);
    try {
      final stats = await api.progressStats();
      final badges = await api.badges();
      Uint8List? avatarBytes;
      if (auth.user?['has_avatar'] == true) {
        try {
          avatarBytes = await api.getAvatarBytes();
        } catch (_) {
          avatarBytes = null;
        }
      }
      SpotifyConnectionStatus? spotify;
      try {
        spotify = await api.spotifyStatus();
      } catch (_) {
        spotify = null;
      }
      Map<String, dynamic>? nextPreview;
      try {
        final q = await api.queueStatus();
        if (q['next_preview'] is Map) {
          nextPreview = Map<String, dynamic>.from(q['next_preview'] as Map);
        }
      } catch (_) {
        nextPreview = null;
      }
      if (!mounted) return;
      setState(() {
        _stats = stats;
        _badges = badges;
        _avatarBytes = avatarBytes;
        _nextPreview = nextPreview;
        if (spotify != null) {
          _spotifyState = spotify.state;
          _spotifyDisplayName = spotify.displayName;
          _personalizationNeeded =
              spotify.state == 'connected' && !spotify.personalizationScopesOk;
          if (spotify.state == 'reconnect') {
            _spotifyMessage = spotify.reason == 'not_allowlisted'
                ? context.tr('spotify_not_allowlisted')
                : context.tr('spotify_reconnect_body');
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

  Future<void> _pickAvatar() async {
    if (_prefsSaving) return;
    final api = context.read<ApiClient>();
    final auth = context.read<AuthState>();
    try {
      final picked = await ImagePicker().pickImage(
        source: ImageSource.gallery,
        maxWidth: 1024,
        maxHeight: 1024,
        imageQuality: 85,
      );
      if (picked == null || !mounted) return;
      final bytes = await picked.readAsBytes();
      await api.putAvatar(bytes);
      await auth.refreshUser();
      if (!mounted) return;
      setState(() {
        _avatarBytes = bytes;
        _prefsMessage = context.tr('profile_saved');
      });
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('$e')),
      );
    }
  }

  Future<void> _removeAvatar() async {
    if (_prefsSaving) return;
    final api = context.read<ApiClient>();
    final auth = context.read<AuthState>();
    try {
      await api.deleteAvatar();
      await auth.refreshUser();
      if (!mounted) return;
      setState(() {
        _avatarBytes = null;
        _prefsMessage = context.tr('profile_saved');
      });
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('$e')),
      );
    }
  }

  Future<void> _editProfileDialog(Map<String, dynamic> user) async {
    final api = context.read<ApiClient>();
    final auth = context.read<AuthState>();
    final usernameCtrl = TextEditingController(text: user['username']?.toString() ?? '');
    final bioCtrl = TextEditingController(text: user['bio']?.toString() ?? '');
    String? dialogError;
    bool saving = false;

    await showDialog<void>(
      context: context,
      builder: (dialogCtx) {
        return StatefulBuilder(
          builder: (ctx, setDialogState) {
            return AlertDialog(
              title: Text(ctx.tr('profile_save')),
              content: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  TextField(
                    controller: usernameCtrl,
                    maxLength: 20,
                    decoration: InputDecoration(
                      labelText: ctx.tr('profile_username'),
                      hintText: ctx.tr('profile_username_hint'),
                    ),
                  ),
                  const SizedBox(height: 8),
                  TextField(
                    controller: bioCtrl,
                    maxLength: 160,
                    decoration: InputDecoration(
                      labelText: ctx.tr('profile_bio'),
                      hintText: ctx.tr('profile_bio_hint'),
                    ),
                  ),
                  if (dialogError != null) ...[
                    const SizedBox(height: 8),
                    Text(
                      dialogError!,
                      style: TextStyle(color: Colors.red.shade400, fontSize: 12),
                    ),
                  ],
                ],
              ),
              actions: [
                TextButton(
                  onPressed: saving ? null : () => Navigator.of(dialogCtx).pop(),
                  child: Text(ctx.tr('cancel')),
                ),
                ElevatedButton(
                  onPressed: saving
                      ? null
                      : () async {
                          setDialogState(() {
                            saving = true;
                            dialogError = null;
                          });
                          try {
                            await api.patchProfile(
                              username: usernameCtrl.text,
                              bio: bioCtrl.text,
                            );
                            await auth.refreshUser();
                            if (dialogCtx.mounted) {
                              Navigator.of(dialogCtx).pop();
                            }
                            if (mounted) {
                              setState(() {
                                _prefsMessage = context.tr('profile_saved');
                              });
                            }
                          } on ApiException catch (e) {
                            setDialogState(() {
                              saving = false;
                              if (e.code == 'username_taken') {
                                dialogError = ctx.tr('profile_username_taken');
                              } else if (e.code == 'username_invalid') {
                                dialogError = ctx.tr('profile_username_invalid');
                              } else {
                                dialogError = e.message;
                              }
                            });
                          } catch (e) {
                            setDialogState(() {
                              saving = false;
                              dialogError = '$e';
                            });
                          }
                        },
                  child: Text(ctx.tr('profile_save')),
                ),
              ],
            );
          },
        );
      },
    );
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

  void _ensureStyles(String lang) {
    if (_styleLang == lang) return;
    _styleLang = lang;
    context.read<ApiClient>().request(
      'GET',
      '/user/available-genres?target_language=$lang',
    ).then((body) {
      final genres = (body['genres'] as List?)?.map((e) => e.toString()).toSet();
      if (!mounted || genres == null || genres.isEmpty) return;
      setState(() {
        _styles = kMusicStyles.where((s) => genres.contains(s.$1)).toList();
      });
    }, onError: (_) {});
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
        _prefsMessage = successHint ?? context.tr('saved');
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

  ({String title, String body}) _reminderCopy(
    BuildContext context,
    ReminderController reminder,
  ) {
    final preview = _nextPreview;
    if (preview != null) {
      final nextWord = (preview['word']?.toString() ?? '').trim();
      final nextSong = (preview['song_title']?.toString() ?? '').trim();
      final nextArtist = (preview['song_artist']?.toString() ?? '').trim();
      if (nextWord.isNotEmpty) {
        final title = context.tr('reminder_next_word_title', {'word': nextWord});
        final body = (nextSong.isNotEmpty && nextArtist.isNotEmpty)
            ? context.tr('reminder_next_song_body', {'song': nextSong, 'artist': nextArtist})
            : (nextSong.isNotEmpty
                ? context.tr('reminder_next_song_only_body', {'song': nextSong})
                : context.tr('reminder_body'));
        return (title: title, body: body);
      }
    }
    final existingTitle = reminder.notificationTitle.trim();
    final existingBody = reminder.notificationBody.trim();
    return (
      title: existingTitle.isNotEmpty ? existingTitle : context.tr('reminder_title'),
      body: existingBody.isNotEmpty ? existingBody : context.tr('reminder_body'),
    );
  }

  List<Widget> _reminderSection(BuildContext context, HarmonixColors colors) {
    final ReminderController reminder;
    try {
      reminder = context.watch<ReminderController>();
    } on ProviderNotFoundException {
      return const [];
    }
    final time = reminder.timeLabel;
    return [
      const SizedBox(height: 16),
      Text(context.tr('reminders').toUpperCase(), style: Theme.of(context).textTheme.titleSmall),
      const SizedBox(height: 4),
      SwitchListTile(
        contentPadding: EdgeInsets.zero,
        title: Text(
          context.tr('reminder_daily'),
          style: TextStyle(color: colors.textPrimary, fontWeight: FontWeight.w700),
        ),
        subtitle: Text(time, style: TextStyle(color: colors.textMuted)),
        secondary: Icon(Icons.notifications_none, color: colors.accent),
        value: reminder.enabled,
        activeThumbColor: colors.onAccent,
        activeTrackColor: colors.accent,
        onChanged: (enabled) async {
          if (enabled) {
            final copy = _reminderCopy(context, reminder);
            final ok = await reminder.enable(
              title: copy.title,
              body: copy.body,
            );
            if (!ok && context.mounted) {
              ScaffoldMessenger.of(context).showSnackBar(
                SnackBar(content: Text(context.tr('reminder_permission_denied'))),
              );
            }
          } else {
            await reminder.disable();
          }
        },
      ),
      if (reminder.enabled)
        ListTile(
          contentPadding: EdgeInsets.zero,
          title: Text(
            context.tr('reminder_change_time'),
            style: TextStyle(color: colors.textPrimary, fontWeight: FontWeight.w700),
          ),
          subtitle: Text(time, style: TextStyle(color: colors.textMuted)),
          trailing: Icon(Icons.schedule, color: colors.accent),
          onTap: () async {
            final picked = await showTimePicker(
              context: context,
              initialTime: TimeOfDay(hour: reminder.hour, minute: reminder.minute),
            );
            if (picked == null || !context.mounted) return;
            final copy = _reminderCopy(context, reminder);
            await reminder.setTime(
              picked.hour,
              picked.minute,
              title: copy.title,
              body: copy.body,
            );
          },
        ),
    ];
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
    final dyslexia = user['dyslexia_font'] == 1 || user['dyslexia_font'] == true;
    _ensureStyles(targetLang);

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
            context.tr('settings_title'),
            style: Theme.of(context).textTheme.headlineMedium?.copyWith(color: colors.textPrimary),
          ),
          const SizedBox(height: 16),
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
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    GestureDetector(
                      onTap: _pickAvatar,
                      child: CircleAvatar(
                        radius: 26,
                        backgroundColor: colors.accent,
                        backgroundImage: (user['has_avatar'] == true && _avatarBytes != null)
                            ? MemoryImage(_avatarBytes!)
                            : null,
                        child: (user['has_avatar'] == true && _avatarBytes != null)
                            ? null
                            : ((user['username']?.toString().trim().isNotEmpty ?? false) ||
                                    (user['email']?.toString().trim().isNotEmpty ?? false))
                                ? Text(
                                    ((user['username']?.toString().trim().isNotEmpty ?? false)
                                            ? user['username'].toString().trim()
                                            : user['email'].toString().trim())
                                        .substring(0, 1)
                                        .toUpperCase(),
                                    style: TextStyle(
                                      color: colors.onAccent,
                                      fontWeight: FontWeight.w800,
                                      fontSize: 18,
                                    ),
                                  )
                                : Icon(Icons.person, color: colors.onAccent),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: InkWell(
                        borderRadius: BorderRadius.circular(8),
                        onTap: () => _editProfileDialog(user),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              (user['username']?.toString().trim().isNotEmpty ?? false)
                                  ? user['username'].toString()
                                  : context.tr('profile_username_hint'),
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: TextStyle(
                                fontWeight: FontWeight.w800,
                                fontSize: 16,
                                color: colors.textPrimary,
                              ),
                            ),
                            const SizedBox(height: 2),
                            Text(
                              (user['bio']?.toString().trim().isNotEmpty ?? false)
                                  ? user['bio'].toString()
                                  : context.tr('profile_bio_hint'),
                              maxLines: 2,
                              overflow: TextOverflow.ellipsis,
                              style: TextStyle(color: colors.textMuted, fontSize: 13),
                            ),
                            if (user['email']?.toString().trim().isNotEmpty ?? false) ...[
                              const SizedBox(height: 4),
                              Text(
                                user['email'].toString(),
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: TextStyle(color: colors.textMuted, fontSize: 12),
                              ),
                            ],
                            const SizedBox(height: 2),
                            Text(
                              '$nativeLang → $targetLang · $genre · $voice',
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: TextStyle(color: colors.textMuted, fontSize: 12),
                            ),
                          ],
                        ),
                      ),
                    ),
                    const SizedBox(width: 10),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                      decoration: BoxDecoration(
                        color: colors.accent.withValues(alpha: 0.08),
                        borderRadius: BorderRadius.circular(10),
                      ),
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        crossAxisAlignment: CrossAxisAlignment.center,
                        children: [
                          Text(
                            '${_stats?['streak_days'] ?? 0}',
                            style: TextStyle(
                              fontWeight: FontWeight.w900,
                              fontSize: 22,
                              height: 1.1,
                              color: colors.accent,
                            ),
                          ),
                          const SizedBox(height: 2),
                          Text(
                            context.tr('streak'),
                            textAlign: TextAlign.center,
                            style: TextStyle(color: colors.textMuted, fontSize: 11),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
                if (user['has_avatar'] == true) ...[
                  const SizedBox(height: 8),
                  TextButton(
                    onPressed: _removeAvatar,
                    style: TextButton.styleFrom(
                      padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 4),
                      minimumSize: Size.zero,
                      tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                    ),
                    child: Text(context.tr('profile_remove_photo')),
                  ),
                ],
              ],
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
                IntrinsicHeight(
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      _StatTile(
                        label: context.tr('stat_words'),
                        value: '${_stats?['total_words'] ?? 0}',
                      ),
                      const SizedBox(width: 8),
                      _StatTile(
                        label: context.tr('stat_days'),
                        value: '${_stats?['days_learned'] ?? 0}',
                      ),
                      const SizedBox(width: 8),
                      _StatTile(
                        label: context.tr('stat_reviewed'),
                        value: '${_stats?['words_reviewed'] ?? 0}',
                      ),
                      const SizedBox(width: 8),
                      _StatTile(
                        label: context.tr('stat_today'),
                        value: '${_stats?['today_words'] ?? 0}',
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 16),
                Text(
                  context.tr('achievements').toUpperCase(),
                  style: Theme.of(context).textTheme.titleSmall?.copyWith(color: colors.accent),
                ),
                const SizedBox(height: 8),
                if (_badges.isEmpty)
                  Text(context.tr('no_badges'), style: TextStyle(color: colors.textMuted)),
                ..._badges.map((raw) {
                  final b = raw as Map<String, dynamic>;
                  final id = b['id']?.toString() ?? '';
                  final unlocked = b['unlocked'] == 1 || b['unlocked'] == true;
                  final progress = b['progress'];
                  final target = b['target'];
                  final progressLabel =
                      (progress != null && target != null) ? '$progress/$target' : null;
                  final nameKey = 'badge_${id}_name';
                  final descKey = 'badge_${id}_desc';
                  final trName = context.tr(nameKey);
                  final trDesc = context.tr(descKey);
                  final displayName = trName != nameKey
                      ? trName
                      : (b['name']?.toString() ?? (id.isNotEmpty ? id : 'Badge'));
                  final displayDesc = trDesc != descKey
                      ? trDesc
                      : (b['description']?.toString() ?? b['category']?.toString() ?? '');
                  return ListTile(
                    contentPadding: EdgeInsets.zero,
                    leading: Icon(
                      unlocked ? Icons.emoji_events : Icons.lock_outline,
                      color: unlocked ? colors.accent : colors.textMuted,
                    ),
                    title: Text(displayName),
                    subtitle: Text(displayDesc),
                    trailing: progressLabel != null
                        ? Text(
                            progressLabel,
                            style: TextStyle(
                              fontWeight: FontWeight.w700,
                              color: unlocked ? colors.accent : colors.textMuted,
                            ),
                          )
                        : null,
                  );
                }),
              ],
            ),
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
                  context.tr('languages').toUpperCase(),
                  style: Theme.of(context).textTheme.titleSmall?.copyWith(color: colors.accent),
                ),
                const SizedBox(height: 12),
                Row(
                  children: [
                    Expanded(
                      child: DropdownButtonFormField<String>(
                        isExpanded: true,
                        initialValue: nativeLang,
                        decoration: InputDecoration(
                          labelText: context.tr('home_language'),
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
                                  _savePrefs({'native_language': val}, successHint: context.tr('home_language_saved'));
                                }
                              },
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: DropdownButtonFormField<String>(
                        isExpanded: true,
                        initialValue: targetLang,
                        decoration: InputDecoration(
                          labelText: context.tr('learning'),
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
                                    successHint: context.tr('learning_language_saved'),
                                  );
                                }
                              },
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 16),
                Row(
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            context.tr('dyslexia_font'),
                            style: TextStyle(fontWeight: FontWeight.w700, color: colors.textPrimary),
                          ),
                          const SizedBox(height: 2),
                          Text(
                            context.tr('dyslexia_font_hint'),
                            style: TextStyle(color: colors.textMuted, fontSize: 12),
                          ),
                        ],
                      ),
                    ),
                    Switch(
                      value: dyslexia,
                      onChanged: _prefsSaving
                          ? null
                          : (on) => _savePrefs({'dyslexia_font': on ? '1' : '0'}),
                    ),
                  ],
                ),
                const SizedBox(height: 20),
                Text(
                  context.tr('music_style').toUpperCase(),
                  style: Theme.of(context).textTheme.titleSmall?.copyWith(color: colors.accent),
                ),
                const SizedBox(height: 4),
                Text(
                  context.tr('music_style_hint'),
                  style: TextStyle(color: colors.textMuted, fontSize: 12),
                ),
                const SizedBox(height: 10),
                Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  children: [
                    for (final s in _styles)
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
                                  successHint: context.tr('music_style_saved'),
                                ),
                      ),
                  ],
                ),
                const SizedBox(height: 20),
                Text(
                  context.tr('voice').toUpperCase(),
                  style: Theme.of(context).textTheme.titleSmall?.copyWith(color: colors.accent),
                ),
                const SizedBox(height: 4),
                Text(
                  context.tr('voice_hint'),
                  style: TextStyle(color: colors.textMuted, fontSize: 12),
                ),
                const SizedBox(height: 10),
                SegmentedButton<String>(
                  segments: [
                    for (final v in kVoiceGenders)
                      ButtonSegment(value: v.$1, label: Text(context.tr(v.$1)), icon: Icon(
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
                            successHint: context.tr('voice_saved'),
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
            personalizationNeeded: _personalizationNeeded,
          ),
          const SizedBox(height: 16),
          Text(context.tr('appearance').toUpperCase(), style: Theme.of(context).textTheme.titleSmall),
          const SizedBox(height: 4),
          SwitchListTile(
            contentPadding: EdgeInsets.zero,
            title: Text(context.tr('dark_mode'), style: TextStyle(color: colors.textPrimary, fontWeight: FontWeight.w700)),
            subtitle: Text(
              themeCtrl.isDark ? context.tr('dark_theme_on') : context.tr('light_theme_on'),
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
          ..._reminderSection(context, colors),
          const SizedBox(height: 24),
          OutlinedButton(
            onPressed: () => auth.logout(),
            style: OutlinedButton.styleFrom(
              foregroundColor: Colors.red.shade400,
              side: BorderSide(color: Colors.red.shade300),
              padding: const EdgeInsets.symmetric(vertical: 14),
            ),
            child: Text(context.tr('log_out')),
          ),
          const SizedBox(height: 8),
          TextButton(
            onPressed: () => _confirmDeleteAccount(auth),
            style: TextButton.styleFrom(
              foregroundColor: Colors.red.shade400,
            ),
            child: Text(context.tr('delete_account')),
          ),
        ],
      ),
    );
  }

  Future<void> _confirmDeleteAccount(AuthState auth) async {
    final api = context.read<ApiClient>();
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (dialogCtx) => AlertDialog(
        title: Text(dialogCtx.tr('delete_account')),
        content: Text(dialogCtx.tr('delete_account_hint')),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(dialogCtx).pop(false),
            child: Text(dialogCtx.tr('delete_account_cancel')),
          ),
          ElevatedButton(
            onPressed: () => Navigator.of(dialogCtx).pop(true),
            style: ElevatedButton.styleFrom(
              backgroundColor: Colors.red.shade600,
              foregroundColor: Colors.white,
            ),
            child: Text(dialogCtx.tr('delete_account_confirm')),
          ),
        ],
      ),
    );
    if (confirmed != true || !mounted) return;
    try {
      await api.deleteAccount();
      await auth.logout();
    } on ApiException catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(e.message)),
        );
      }
    }
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
        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 12),
        decoration: BoxDecoration(
          color: colors.surface,
          border: Border.all(color: colors.border),
          borderRadius: BorderRadius.circular(12),
        ),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          crossAxisAlignment: CrossAxisAlignment.center,
          children: [
            SizedBox(
              height: 26,
              width: double.infinity,
              child: Center(
                child: FittedBox(
                  fit: BoxFit.scaleDown,
                  child: Text(
                    value,
                    maxLines: 1,
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      fontWeight: FontWeight.w900,
                      fontSize: 18,
                      color: colors.textPrimary,
                    ),
                  ),
                ),
              ),
            ),
            const SizedBox(height: 4),
            SizedBox(
              height: 16,
              width: double.infinity,
              child: Center(
                child: FittedBox(
                  fit: BoxFit.scaleDown,
                  child: Text(
                    label,
                    maxLines: 1,
                    textAlign: TextAlign.center,
                    style: Theme.of(context).textTheme.titleSmall?.copyWith(
                          fontSize: 11,
                        ),
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
