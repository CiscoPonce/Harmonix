import 'package:flutter/foundation.dart';

/// Discover, Library, and the account icon (Settings). Spotify App Links may
/// select Library or the account tab once (D-12-04).
///
/// Ordinary default is Discover (unified home). Provider secrets in query
/// strings are never retained.
class HomeNavigationController extends ChangeNotifier {
  HomeNavigationController({int initialIndex = discoverIndex})
      : _index = initialIndex;

  static const int discoverIndex = 0;
  static const int libraryIndex = 1;

  /// Account icon in the bottom bar, beside Library. Opens Settings.
  static const int settingsIndex = 2;

  /// Backward-compatible alias — Learn folded into Discover.
  static const int learnIndex = discoverIndex;

  /// Development host from 12-01, plus the live site testers return to.
  static const String approvedHost = 'moral-sparrow-nationally.ngrok-free.app';
  static const String productionHost = 'harmonix.peeporunclub.co.uk';
  static const Set<String> approvedHosts = {approvedHost, productionHost};

  static const String successPath = '/app/library';
  static const String settingsPath = '/app/settings';

  int _index;
  String? _pendingRecoveryReason;
  bool _librarySelectedOnce = false;
  bool _settingsSelectedOnce = false;
  bool _arrivedFromSpotify = false;

  int get index => _index;

  /// A Spotify return arrived, so the opening drawing should not play first.
  bool get arrivedFromSpotify => _arrivedFromSpotify;

  /// Allowlisted recovery reason (`error`, `denied`, or `not_allowlisted`). Cleared on consume.
  String? get pendingRecoveryReason => _pendingRecoveryReason;

  void selectTab(int value) {
    if (value < discoverIndex || value > settingsIndex) return;
    if (_index == value) return;
    _index = value;
    notifyListeners();
  }

  /// One-shot Library selection after successful Spotify linking.
  void selectLibraryOnce() {
    if (_librarySelectedOnce) return;
    _librarySelectedOnce = true;
    _index = libraryIndex;
    notifyListeners();
  }

  /// One-shot Settings selection after cancellation/error linking.
  void selectSettingsOnce({String? reason}) {
    if (_settingsSelectedOnce) return;
    _settingsSelectedOnce = true;
    _index = settingsIndex;
    if (reason != null) {
      _pendingRecoveryReason = _isAllowlistedReason(reason) ? reason : 'error';
    }
    notifyListeners();
  }

  /// Returns and clears the pending allowlisted recovery reason.
  String? consumeRecoveryReason() {
    final value = _pendingRecoveryReason;
    _pendingRecoveryReason = null;
    return value;
  }

  /// Handle a cold/warm App Link. Returns true only when navigation changed.
  ///
  /// Accepts only the approved HTTPS host + success/settings paths with
  /// allowlisted `spotify=` outcomes. Rejects unknown hosts/paths and never
  /// stores `code`, `state`, or token query values.
  bool handleIncomingUri(Uri uri) {
    if (uri.scheme == 'harmonix' && uri.host == 'spotify-callback') {
      final outcome = uri.queryParameters['spotify'];
      if (outcome == 'connected') {
        _arrivedFromSpotify = true;
        if (_librarySelectedOnce) return false;
        selectLibraryOnce();
        return true;
      }
      if (outcome == 'error' || outcome == 'cancelled') {
        _arrivedFromSpotify = true;
        if (_settingsSelectedOnce) return false;
        selectSettingsOnce(reason: uri.queryParameters['reason'] ?? 'error');
        return true;
      }
      return false;
    }
    if (uri.scheme != 'https') return false;
    if (!approvedHosts.contains(uri.host)) return false;

    final path = uri.path.endsWith('/') && uri.path.length > 1
        ? uri.path.substring(0, uri.path.length - 1)
        : uri.path;

    final outcome = uri.queryParameters['spotify'];
    if (outcome == null) return false;

    if (path == successPath) {
      if (outcome != 'connected') return false;
      _arrivedFromSpotify = true;
      if (_librarySelectedOnce) return false;
      selectLibraryOnce();
      return true;
    }

    if (path == settingsPath) {
      if (outcome != 'error' && outcome != 'cancelled') return false;
      _arrivedFromSpotify = true;
      if (_settingsSelectedOnce) return false;
      selectSettingsOnce(reason: uri.queryParameters['reason'] ?? 'error');
      return true;
    }

    return false;
  }

  static bool _isAllowlistedReason(String reason) {
    return reason == 'error' || reason == 'denied' || reason == 'not_allowlisted';
  }
}
