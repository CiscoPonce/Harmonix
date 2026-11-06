import 'package:flutter_test/flutter_test.dart';
import 'package:harmonix_mobile/services/reminder_service.dart';
import 'package:harmonix_mobile/state/reminder_controller.dart';
import 'package:shared_preferences/shared_preferences.dart';

class _FakeScheduler implements ReminderScheduler {
  bool grant = true;
  final List<(int, int, String, String)> scheduled = [];
  int cancels = 0;

  @override
  Future<bool> requestPermission() async => grant;

  @override
  Future<void> scheduleDaily({
    required int hour,
    required int minute,
    required String title,
    required String body,
  }) async {
    scheduled.add((hour, minute, title, body));
  }

  @override
  Future<void> cancel() async {
    cancels += 1;
  }
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  late _FakeScheduler scheduler;
  late ReminderController controller;

  setUp(() {
    SharedPreferences.setMockInitialValues({});
    scheduler = _FakeScheduler();
    controller = ReminderController(scheduler);
  });

  test('enabling with permission schedules 19:00 and saves enabled', () async {
    final ok = await controller.enable(title: 'Title', body: 'Body');
    expect(ok, isTrue);
    expect(controller.enabled, isTrue);
    expect(scheduler.scheduled, [(19, 0, 'Title', 'Body')]);

    final prefs = await SharedPreferences.getInstance();
    expect(prefs.getBool('reminder_enabled'), isTrue);
    expect(prefs.getString('reminder_title'), 'Title');
    expect(prefs.getString('reminder_body'), 'Body');
  });

  test('permission denied leaves the reminder off and schedules nothing', () async {
    scheduler.grant = false;
    final ok = await controller.enable(title: 'Title', body: 'Body');
    expect(ok, isFalse);
    expect(controller.enabled, isFalse);
    expect(scheduler.scheduled, isEmpty);

    final prefs = await SharedPreferences.getInstance();
    expect(prefs.getBool('reminder_enabled'), isFalse);
  });

  test('setTime while enabled reschedules at the new time', () async {
    await controller.enable(title: 'Title', body: 'Body');
    await controller.setTime(8, 30, title: 'Morning', body: 'Review');
    expect(controller.hour, 8);
    expect(controller.minute, 30);
    expect(controller.timeLabel, '08:30');
    expect(scheduler.scheduled.last, (8, 30, 'Morning', 'Review'));
  });

  test('disable cancels the scheduled reminder', () async {
    await controller.enable(title: 'Title', body: 'Body');
    await controller.disable();
    expect(controller.enabled, isFalse);
    expect(scheduler.cancels, 1);
    final prefs = await SharedPreferences.getInstance();
    expect(prefs.getBool('reminder_enabled'), isFalse);
  });

  test('load restores saved values and reschedules when enabled', () async {
    SharedPreferences.setMockInitialValues({
      'reminder_enabled': true,
      'reminder_hour': 7,
      'reminder_minute': 15,
      'reminder_prompt_shown': true,
      'reminder_title': 'Saved title',
      'reminder_body': 'Saved body',
    });
    await controller.load();
    expect(controller.enabled, isTrue);
    expect(controller.hour, 7);
    expect(controller.minute, 15);
    expect(controller.promptShown, isTrue);
    expect(scheduler.scheduled, [(7, 15, 'Saved title', 'Saved body')]);
  });
}
