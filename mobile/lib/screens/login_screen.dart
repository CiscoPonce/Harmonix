import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../state/auth_state.dart';
import '../theme/harmonix_theme.dart';
import '../utils/i18n.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key, this.startInRegister = false, this.initialLang});

  /// Get Started opens account creation. Login stays the default.
  final bool startInRegister;

  /// Optional language picked on WelcomeScreen when running without LocaleController.
  final String? initialLang;

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _email = TextEditingController();
  final _password = TextEditingController();
  final _code = TextEditingController();
  bool _register = false;
  bool _reset = false;
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
    if (_reset && _challengeId != null) {
      return _code.text.trim().length == 6 && _password.text.length >= 8;
    }
    if (_challengeId != null) return _code.text.trim().length == 6;
    if (_reset) return _email.text.trim().isNotEmpty;
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
    final lang = AppI18n.resolveLanguage(context, override: widget.initialLang);
    if ((_register || (_reset && _challengeId != null)) && _password.text.length < 8) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(AppI18n.t('auth_password_min', lang))),
      );
      return;
    }
    setState(() => _busy = true);
    final auth = context.read<AuthState>();
    try {
      if (_reset && _challengeId != null) {
        await auth.confirmPasswordReset(
          email: _email.text.trim(),
          challengeId: _challengeId!,
          code: _code.text.trim(),
          password: _password.text,
        );
        if (!mounted) return;
        setState(() {
          _reset = false;
          _challengeId = null;
          _code.clear();
          _password.clear();
        });
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(AppI18n.t('auth_password_updated', lang))),
        );
        return;
      } else if (_reset) {
        final challengeId = await auth.requestPasswordReset(_email.text.trim());
        if (mounted) setState(() => _challengeId = challengeId);
        return;
      } else if (_register && _challengeId != null) {
        final preSignupLang = AppI18n.resolveLanguage(context, override: widget.initialLang);
        await auth.confirmSignup(
          email: _email.text.trim(),
          password: _password.text,
          challengeId: _challengeId!,
          code: _code.text.trim(),
        );
        if (preSignupLang != 'en') {
          try {
            await auth.savePreferences({
              'native_language': preSignupLang,
              'target_language': 'en',
            });
          } catch (_) {}
        }
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
          SnackBar(content: Text(auth.error ?? AppI18n.t('auth_failed', lang))),
        );
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    AppI18n.maybeWatchLocale(context);
    final lang = AppI18n.resolveLanguage(context, override: widget.initialLang);
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
                _reset && _challengeId != null
                    ? AppI18n.t('auth_reset_enter_code', lang)
                    : _challengeId != null
                        ? AppI18n.t('auth_enter_code_email', lang)
                        : _reset
                            ? AppI18n.t('auth_reset_intro', lang)
                            : (_register
                                ? AppI18n.t('auth_create_account', lang)
                                : AppI18n.t('auth_tagline', lang)),
                textAlign: TextAlign.center,
                style: Theme.of(context).textTheme.bodyLarge,
              ),
              const SizedBox(height: 40),
              if (_challengeId == null) ...[
                TextField(
                  controller: _email,
                  keyboardType: TextInputType.emailAddress,
                  autocorrect: false,
                  decoration: InputDecoration(labelText: AppI18n.t('auth_email', lang)),
                ),
                if (!_reset) ...[
                  const SizedBox(height: 12),
                  TextField(
                    controller: _password,
                    obscureText: true,
                    decoration: InputDecoration(labelText: AppI18n.t('auth_password', lang)),
                  ),
                ],
              ] else ...[
                Text(
                  AppI18n.t('auth_code_sent', lang, {'email': _email.text.trim()}),
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: 16),
                TextField(
                  controller: _code,
                  keyboardType: TextInputType.number,
                  maxLength: 6,
                  decoration: InputDecoration(
                    labelText: AppI18n.t('auth_code', lang),
                    counterText: '',
                  ),
                ),
                if (_reset) ...[
                  const SizedBox(height: 12),
                  TextField(
                    controller: _password,
                    obscureText: true,
                    decoration: InputDecoration(labelText: AppI18n.t('auth_new_password', lang)),
                  ),
                ],
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
                    ? AppI18n.t('auth_please_wait', lang)
                    : _reset && _challengeId != null
                        ? AppI18n.t('auth_update_password', lang)
                        : _challengeId != null
                            ? AppI18n.t('auth_confirm_code', lang)
                            : _reset
                                ? AppI18n.t('auth_email_code', lang)
                                : (_register
                                    ? AppI18n.t('auth_send_code', lang)
                                    : AppI18n.t('auth_login', lang))),
              ),
              if (_challengeId != null)
                TextButton(
                  onPressed: _busy
                      ? null
                      : () async {
                          final messenger = ScaffoldMessenger.of(context);
                          setState(() => _busy = true);
                          final auth = context.read<AuthState>();
                          try {
                            final challengeId = _reset
                                ? await auth.requestPasswordReset(_email.text.trim())
                                : await auth.requestSignupCode(
                                    _email.text.trim(),
                                    _password.text,
                                  );
                            if (!mounted) return;
                            setState(() {
                              _challengeId = challengeId;
                              _code.clear();
                            });
                          } catch (_) {
                            if (!mounted) return;
                            messenger.showSnackBar(
                              SnackBar(
                                content: Text(auth.error ?? AppI18n.t('auth_resend_failed', lang)),
                              ),
                            );
                          } finally {
                            if (mounted) setState(() => _busy = false);
                          }
                        },
                  child: Text(
                    AppI18n.t('auth_send_new_code', lang),
                    style: const TextStyle(color: HarmonixColors.brand),
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
                  child: Text(
                    AppI18n.t('auth_different_email', lang),
                    style: const TextStyle(color: HarmonixColors.brand),
                  ),
                )
              else if (_reset)
                TextButton(
                  onPressed: _busy
                      ? null
                      : () => setState(() {
                            _reset = false;
                            _challengeId = null;
                            _code.clear();
                          }),
                  child: Text(
                    AppI18n.t('auth_back_to_login', lang),
                    style: const TextStyle(color: HarmonixColors.brand),
                  ),
                )
              else ...[
                if (!_register)
                  TextButton(
                    onPressed: _busy
                        ? null
                        : () => setState(() {
                              _reset = true;
                              _challengeId = null;
                              _code.clear();
                            }),
                    child: Text(
                      AppI18n.t('auth_forgot_password', lang),
                      style: const TextStyle(color: HarmonixColors.brand),
                    ),
                  ),
                TextButton(
                  onPressed: _busy
                      ? null
                      : () => setState(() {
                            _register = !_register;
                            _reset = false;
                            _challengeId = null;
                          }),
                  child: Text(
                    _register
                        ? AppI18n.t('auth_already_have_account', lang)
                        : AppI18n.t('auth_need_account', lang),
                    style: const TextStyle(color: HarmonixColors.brand),
                  ),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}
