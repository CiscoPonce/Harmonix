#!/usr/bin/env dart
/// Controlled RED gate for Flutter Spotify contracts.
/// Runs only explicitly supplied test files, requires non-zero exit, and
/// requires the named intended-behavior sentinel in the output.
library;

import 'dart:io';

void main(List<String> args) async {
  final sentinelIdx = args.indexOf('--sentinel');
  if (sentinelIdx == -1 || sentinelIdx + 1 >= args.length) {
    stderr.writeln(
      'Usage: dart run tool/assert_red_spotify_tests.dart --sentinel <NAME> <test-files...>',
    );
    exit(2);
  }

  final sentinel = args[sentinelIdx + 1];
  final files = <String>[
    ...args.sublist(0, sentinelIdx),
    ...args.sublist(sentinelIdx + 2),
  ].where((f) => f.isNotEmpty).toList();

  if (files.isEmpty) {
    stderr.writeln('assert_red_spotify_tests: at least one test file is required');
    exit(2);
  }

  for (final file in files) {
    if (file.contains('*')) {
      stderr.writeln('assert_red_spotify_tests: refusing glob argument: $file');
      exit(2);
    }
  }

  final mobileRoot = File(Platform.script.toFilePath()).parent.parent;
  final result = await Process.run(
    'flutter',
    ['test', ...files],
    workingDirectory: mobileRoot.path,
    runInShell: false,
  );

  final output = '${result.stdout}\n${result.stderr}';

  void fail(String reason) {
    stderr.writeln('assert_red_spotify_tests: INVALID RED — $reason');
    if (output.trim().isNotEmpty) {
      stderr.writeln(output);
    }
    exit(1);
  }

  final hardInvalid = <RegExp>[
    RegExp(r'Target of URI doesn.t exist'),
    RegExp(r'Error: Couldn.t resolve the package'),
    RegExp(r'compilation failed', caseSensitive: false),
    RegExp(r'TimeoutException'),
    RegExp(r'Test timed out'),
    RegExp(r'fixture.*(missing|failed|load)', caseSensitive: false),
    RegExp(r'dart format'),
  ];

  for (final pattern in hardInvalid) {
    if (pattern.hasMatch(output)) {
      fail('disallowed failure pattern ${pattern.pattern}: tests must fail for missing behavior only');
    }
  }

  if (result.exitCode == 0) {
    fail('expected non-zero flutter test exit (got 0); sentinel $sentinel must come from a failing assertion');
  }

  if (!output.contains(sentinel)) {
    fail('missing required sentinel $sentinel in flutter test output');
  }

  stdout.writeln(
    'assert_red_spotify_tests: OK controlled RED for $sentinel (${files.join(', ')})',
  );
  exit(0);
}
