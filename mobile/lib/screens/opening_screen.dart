import 'dart:async';

import 'package:flutter/material.dart';
import 'package:webview_flutter/webview_flutter.dart';

/// Parchment field behind the Bauhaus opening mark.
const openingParchment = Color(0xFFF1E4C3);

/// Plays the five-second drawing once, then calls [onFinished].
///
/// The drawing is the vector splash in `assets/opening/splash.html`.
/// A tap on Skip, or a late fallback, continues into the welcome screens
/// if the page never reports that it finished.
class OpeningScreen extends StatefulWidget {
  const OpeningScreen({super.key, required this.onFinished});

  final VoidCallback onFinished;

  @override
  State<OpeningScreen> createState() => _OpeningScreenState();
}

class _OpeningScreenState extends State<OpeningScreen> {
  static const _fallback = Duration(milliseconds: 6500);

  late final WebViewController _controller;
  Timer? _timer;
  bool _finished = false;

  @override
  void initState() {
    super.initState();
    _timer = Timer(_fallback, _finish);
    _controller = WebViewController()
      ..setJavaScriptMode(JavaScriptMode.unrestricted)
      ..setBackgroundColor(openingParchment)
      ..addJavaScriptChannel(
        'HarmonixOpening',
        onMessageReceived: (_) => _finish(),
      )
      ..loadFlutterAsset('assets/opening/splash.html');
  }

  void _finish() {
    if (_finished) return;
    _finished = true;
    _timer?.cancel();
    widget.onFinished();
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: openingParchment,
      body: Stack(
        children: [
          Positioned.fill(child: WebViewWidget(controller: _controller)),
          SafeArea(
            child: Align(
              alignment: Alignment.topRight,
              child: TextButton(
                onPressed: _finish,
                child: const Text(
                  'Skip',
                  style: TextStyle(
                    color: Color(0xFF0F0E15),
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
