import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../state/auth_state.dart';
import '../theme/harmonix_theme.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _email = TextEditingController();
  final _password = TextEditingController();
  bool _register = false;
  bool _busy = false;

  @override
  void dispose() {
    _email.dispose();
    _password.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    setState(() => _busy = true);
    final auth = context.read<AuthState>();
    try {
      if (_register) {
        await auth.register(_email.text.trim(), _password.text);
      } else {
        await auth.login(_email.text.trim(), _password.text);
      }
      // The root auth gate has already swapped Welcome → Home underneath us;
      // pop this pushed route so the user actually sees it.
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
                _register ? 'Create your account' : 'Learn words through music',
                textAlign: TextAlign.center,
                style: Theme.of(context).textTheme.bodyLarge,
              ),
              const SizedBox(height: 40),
              TextField(
                controller: _email,
                keyboardType: TextInputType.emailAddress,
                decoration: const InputDecoration(labelText: 'Email'),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: _password,
                obscureText: true,
                decoration: const InputDecoration(labelText: 'Password'),
              ),
              const SizedBox(height: 24),
              FilledButton(
                onPressed: _busy ? null : _submit,
                style: FilledButton.styleFrom(
                  backgroundColor: HarmonixColors.brand,
                  padding: const EdgeInsets.symmetric(vertical: 14),
                ),
                child: Text(_busy ? 'Please wait…' : (_register ? 'Register' : 'Login')),
              ),
              TextButton(
                onPressed: _busy ? null : () => setState(() => _register = !_register),
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
