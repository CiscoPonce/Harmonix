import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../state/auth_state.dart';
import '../theme/harmonix_theme.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key, this.startInRegister = false});

  /// Get Started opens account creation. Login stays the default.
  final bool startInRegister;

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _email = TextEditingController();
  final _password = TextEditingController();
  final _code = TextEditingController();
  bool _register = false;
  bool _busy = false;
  String? _challengeId;

  @override
  void initState() {
    super.initState();
    _register = widget.startInRegister;
    _email.addListener(_onFieldsChanged);
    _password.addListener(_onFieldsChanged);
    _code.addListener(_onFieldsChanged);
  }

  void _onFieldsChanged() {
    if (mounted) setState(() {});
  }

  bool get _canSubmit {
    if (_busy) return false;
    if (_challengeId != null) return _code.text.trim().length == 6;
    return _email.text.trim().isNotEmpty && _password.text.isNotEmpty;
  }

  @override
  void dispose() {
    _email.removeListener(_onFieldsChanged);
    _password.removeListener(_onFieldsChanged);
    _code.removeListener(_onFieldsChanged);
    _email.dispose();
    _password.dispose();
    _code.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (_register && _password.text.length < 8) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Password must be at least 8 characters')),
      );
      return;
    }
    setState(() => _busy = true);
    final auth = context.read<AuthState>();
    try {
      if (_register && _challengeId != null) {
        await auth.confirmSignup(
          email: _email.text.trim(),
          password: _password.text,
          challengeId: _challengeId!,
          code: _code.text.trim(),
        );
      } else if (_register) {
        final challengeId = await auth.requestSignupCode(
          _email.text.trim(),
          _password.text,
        );
        if (mounted) {
          setState(() => _challengeId = challengeId);
        }
        return;
      } else {
        await auth.login(_email.text.trim(), _password.text);
      }
      if (mounted) Navigator.of(context).popUntil((route) => route.isFirst);
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(auth.error ?? 'Authentication failed')),
        );
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final colors = HarmonixColors.of(context);
    return Scaffold(
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const SizedBox(height: 48),
              Text(
                'Harmonix',
                textAlign: TextAlign.center,
                style: Theme.of(context).textTheme.headlineMedium,
              ),
              const SizedBox(height: 8),
              Text(
                _challengeId != null
                    ? 'Enter the code from your email'
                    : (_register ? 'Create your account' : 'Learn words through music'),
                textAlign: TextAlign.center,
                style: Theme.of(context).textTheme.bodyLarge,
              ),
              const SizedBox(height: 40),
              if (_challengeId == null) ...[
                TextField(
                  controller: _email,
                  keyboardType: TextInputType.emailAddress,
                  autocorrect: false,
                  decoration: const InputDecoration(labelText: 'Email'),
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: _password,
                  obscureText: true,
                  decoration: const InputDecoration(labelText: 'Password'),
                ),
              ] else ...[
                Text(
                  'We sent a six-digit code to ${_email.text.trim()}. It expires in 10 minutes.',
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: 16),
                TextField(
                  controller: _code,
                  keyboardType: TextInputType.number,
                  maxLength: 6,
                  decoration: const InputDecoration(labelText: 'Code', counterText: ''),
                ),
              ],
              const SizedBox(height: 24),
              FilledButton(
                onPressed: _canSubmit ? _submit : null,
                style: FilledButton.styleFrom(
                  backgroundColor: colors.accent,
                  disabledBackgroundColor: colors.border,
                  foregroundColor: colors.onAccent,
                  disabledForegroundColor: colors.textMuted,
                  padding: const EdgeInsets.symmetric(vertical: 14),
                ),
                child: Text(_busy
                    ? 'Please wait…'
                    : _challengeId != null
                        ? 'Confirm code'
                        : (_register ? 'Send code' : 'Login')),
              ),
              if (_challengeId != null)
                TextButton(
                  onPressed: _busy
                      ? null
                      : () async {
                          setState(() => _busy = true);
                          final auth = context.read<AuthState>();
                          try {
                            final challengeId = await auth.requestSignupCode(
                              _email.text.trim(),
                              _password.text,
                            );
                            if (mounted) {
                              setState(() {
                                _challengeId = challengeId;
                                _code.clear();
                              });
                            }
                          } catch (_) {
                            if (mounted) {
                              ScaffoldMessenger.of(context).showSnackBar(
                                SnackBar(content: Text(auth.error ?? 'Could not send a new code')),
                              );
                            }
                          } finally {
                            if (mounted) setState(() => _busy = false);
                          }
                        },
                  child: const Text(
                    'Send a new code',
                    style: TextStyle(color: HarmonixColors.brand),
                  ),
                ),
              if (_challengeId != null)
                TextButton(
                  onPressed: _busy
                      ? null
                      : () => setState(() {
                            _challengeId = null;
                            _code.clear();
                          }),
                  child: const Text(
                    'Use a different email',
                    style: TextStyle(color: HarmonixColors.brand),
                  ),
                )
              else
                TextButton(
                  onPressed: _busy
                      ? null
                      : () => setState(() {
                            _register = !_register;
                            _challengeId = null;
                          }),
                  child: Text(
                    _register ? 'Already have an account? Login' : 'Need an account? Register',
                    style: const TextStyle(color: HarmonixColors.brand),
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }
}
