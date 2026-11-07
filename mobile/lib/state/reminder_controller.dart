import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../services/reminder_service.dart';

/// Opt-in daily reminder. Disabled until the learner turns it on.
class ReminderController extends ChangeNotifier {
  ReminderController(this._scheduler);

  static const _enabledKey = 'reminder_enabled';
  static const _hourKey = 'reminder_hour';
  static const _minuteKey = 'reminder_minute';
  static const _promptKey = 'reminder_prompt_shown';
  static const _titleKey = 'reminder_title';
  static const _bodyKey = 'reminder_body';

  final ReminderScheduler _scheduler;

  bool _enabled = false;
  int _hour = 19;
  int _minute = 0;
  bool _promptShown = false;
  String _title = '';
  String _body = '';
  bool _ready = false;

  bool get enabled => _enabled;
  int get hour => _hour;
  int get minute => _minute;
  bool get promptShown => _promptShown;
  bool get ready => _ready;

  String get timeLabel =>
      '${_hour.toString().padLeft(2, '0')}:${_minute.toString().padLeft(2, '0')}';

  String get notificationTitle => _title;
  String get notificationBody => _body;

  Future<void> load() async {
    final prefs = await SharedPreferences.getInstance();
    _enabled = prefs.getBool(_enabledKey) ?? false;
    _hour = prefs.getInt(_hourKey) ?? 19;
    _minute = prefs.getInt(_minuteKey) ?? 0;
    _promptShown = prefs.getBool(_promptKey) ?? false;
    _title = prefs.getString(_titleKey) ?? '';
    _body = prefs.getString(_bodyKey) ?? '';
    _ready = true;
    notifyListeners();
    if (_enabled && _title.isNotEmpty && _body.isNotEmpty) {
      await _scheduler.scheduleDaily(
        hour: _hour,
        minute: _minute,
        title: _title,
        body: _body,
      );
    }
  }

  /// Requests permission, then schedules the stored time. A refusal leaves
  /// the reminder off.
  Future<bool> enable({required String title, required String body}) async {
    final granted = await _scheduler.requestPermission();
    final prefs = await SharedPreferences.getInstance();
    if (!granted) {
      _enabled = false;
      notifyListeners();
      await prefs.setBool(_enabledKey, false);
      return false;
    }
    await _scheduler.scheduleDaily(
      hour: _hour,
      minute: _minute,
      title: title,
      body: body,
    );
    _enabled = true;
    _title = title;
    _body = body;
    notifyListeners();
    await prefs.setBool(_enabledKey, true);
    await prefs.setString(_titleKey, title);
    await prefs.setString(_bodyKey, body);
    return true;
  }

  Future<void> disable() async {
    await _scheduler.cancel();
    _enabled = false;
    notifyListeners();
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool(_enabledKey, false);
  }

  Future<void> setTime(
    int hour,
    int minute, {
    required String title,
    required String body,
  }) async {
    _hour = hour;
    _minute = minute;
    _title = title;
    _body = body;
    notifyListeners();
    final prefs = await SharedPreferences.getInstance();
    await prefs.setInt(_hourKey, hour);
    await prefs.setInt(_minuteKey, minute);
    await prefs.setString(_titleKey, title);
    await prefs.setString(_bodyKey, body);
    if (_enabled) {
      await _scheduler.scheduleDaily(
        hour: hour,
        minute: minute,
        title: title,
        body: body,
      );
    }
  }

  /// Names the word already on the phone. The daily alarm repeats this text
  /// until the next word replaces it.
  Future<void> useWord({required String word, required String body}) async {
    final nextTitle = word.trim();
    final nextBody = body.trim();
    if (!_enabled || nextTitle.isEmpty) return;
    if (nextTitle == _title && nextBody == _body) return;
    await setTime(_hour, _minute, title: nextTitle, body: nextBody);
  }

  Future<void> markPromptShown() async {
    _promptShown = true;
    notifyListeners();
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool(_promptKey, true);
  }
}
