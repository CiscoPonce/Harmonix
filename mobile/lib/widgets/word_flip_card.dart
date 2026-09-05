import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../theme/harmonix_theme.dart';
import '../utils/i18n.dart';

/// 3D flip card matching web `.daily-word-flip-*` (perspective + rotateY).
/// Actions (Hear it, Spotify, Add playlist) must stay **outside** this widget.
class WordFlipCard extends StatefulWidget {
  const WordFlipCard({
    super.key,
    required this.front,
    required this.back,
    this.height = 280,
    this.canFlip = true,
    this.compact = false,
    this.showHint = true,
  });

  final Widget front;
  final Widget back;
  final double height;
  final bool canFlip;
  final bool compact;
  final bool showHint;

  @override
  State<WordFlipCard> createState() => _WordFlipCardState();
}

class _WordFlipCardState extends State<WordFlipCard>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller;
  bool _flipped = false;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 400),
    );
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  void _toggle() {
    if (!widget.canFlip) return;
    final reduce = MediaQuery.disableAnimationsOf(context);
    setState(() => _flipped = !_flipped);
    if (reduce) {
      _controller.value = _flipped ? 1 : 0;
      return;
    }
    if (_flipped) {
      _controller.forward();
    } else {
      _controller.reverse();
    }
  }

  @override
  Widget build(BuildContext context) {
    final colors = HarmonixColors.of(context);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        SizedBox(
          height: widget.height,
          child: GestureDetector(
            onTap: _toggle,
            child: AnimatedBuilder(
              animation: _controller,
              builder: (context, _) {
                final t = _controller.value;
                final angle = t * math.pi;
                final showFront = t < 0.5;
                return Transform(
                  alignment: Alignment.center,
                  transform: Matrix4.identity()
                    ..setEntry(3, 2, 0.0012)
                    ..rotateY(angle),
                  child: Stack(
                    fit: StackFit.expand,
                    children: [
                      if (showFront)
                        _FaceShell(
                          colors: colors,
                          compact: widget.compact,
                          child: widget.front,
                        )
                      else
                        Transform(
                          alignment: Alignment.center,
                          transform: Matrix4.identity()..rotateY(math.pi),
                          child: _FaceShell(
                            colors: colors,
                            compact: widget.compact,
                            child: widget.back,
                          ),
                        ),
                    ],
                  ),
                );
              },
            ),
          ),
        ),
        if (widget.canFlip && widget.showHint) ...[
          const SizedBox(height: 8),
          Text(
            _flipped ? context.tr('tap_card_flip_back') : context.tr('tap_card_for_context'),
            textAlign: TextAlign.center,
            style: TextStyle(
              fontSize: 11,
              fontWeight: FontWeight.w600,
              color: colors.textMuted,
            ),
          ),
        ],
      ],
    );
  }
}

class _FaceShell extends StatelessWidget {
  const _FaceShell({
    required this.colors,
    required this.child,
    required this.compact,
  });

  final HarmonixColors colors;
  final Widget child;
  final bool compact;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: EdgeInsets.all(compact ? 14 : 20),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(compact ? 16 : 20),
        border: Border.all(color: colors.border),
        gradient: LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
          colors: Theme.of(context).brightness == Brightness.dark
              ? [
                  HarmonixColors.brand.withValues(alpha: 0.35),
                  colors.surface,
                ]
              : const [
                  Color(0xFFE8F5EE),
                  Color(0xFFF7F8F6),
                ],
        ),
      ),
      child: child,
    );
  }
}

/// Highlight lyric snippet the same way web does with char_start/char_end.
InlineSpan highlightLyricSpan({
  required String snippet,
  required HarmonixColors colors,
  String? highlightWord,
  int? charStart,
  int? charEnd,
}) {
  if (snippet.isEmpty) return const TextSpan(text: '');
  if (charStart != null &&
      charEnd != null &&
      charStart >= 0 &&
      charEnd <= snippet.length &&
      charStart < charEnd) {
    return TextSpan(children: [
      TextSpan(text: snippet.substring(0, charStart)),
      TextSpan(
        text: snippet.substring(charStart, charEnd),
        style: TextStyle(
          color: colors.onAccent,
          backgroundColor: colors.accent,
          fontWeight: FontWeight.w800,
        ),
      ),
      TextSpan(text: snippet.substring(charEnd)),
    ]);
  }
  final needle = (highlightWord ?? '').toLowerCase();
  if (needle.isEmpty) return TextSpan(text: '"$snippet"');
  final idx = snippet.toLowerCase().indexOf(needle);
  if (idx < 0) return TextSpan(text: '"$snippet"');
  return TextSpan(children: [
    TextSpan(text: '"${snippet.substring(0, idx)}'),
    TextSpan(
      text: snippet.substring(idx, idx + needle.length),
      style: TextStyle(
        color: colors.onAccent,
        backgroundColor: colors.accent,
        fontWeight: FontWeight.w800,
      ),
    ),
    TextSpan(text: '${snippet.substring(idx + needle.length)}"'),
  ]);
}
