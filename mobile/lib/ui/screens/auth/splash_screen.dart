import 'package:flutter/material.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_animate/flutter_animate.dart';
import '../../../providers/auth_provider.dart';
import '../../../core/theme/app_theme.dart';

class SplashScreen extends ConsumerStatefulWidget {
  const SplashScreen({super.key});

  @override
  ConsumerState<SplashScreen> createState() => _SplashScreenState();
}

class _SplashScreenState extends ConsumerState<SplashScreen> {
  @override
  void initState() {
    super.initState();
    // Start artificial delay
    Future.delayed(const Duration(seconds: 2), () {
      if (mounted) {
        _handleAuthState(ref.read(authStateProvider));
      }
    });
  }

  void _handleAuthState(AsyncValue<User?> authState) {
    authState.when(
      data: (user) async {
        if (user != null) {
          try {
            // Fetch the full user profile from the backend
            final profile = await ref.read(userProfileProvider.future);
            if (!mounted) return;

            if (profile == null) {
              Navigator.pushReplacementNamed(context, '/login');
              return;
            }

            final String role = (profile['role'] ?? 'employee').toString().toLowerCase();
            final bool passwordSet = profile['password_set'] ?? true;
            final String status = profile['status'] ?? 'pending';
            final bool isActive = profile['isActive'] ?? true;

            // 1. Check if Admin
            if (role == 'admin' || role == 'super_admin') {
              Navigator.pushReplacementNamed(context, '/admin');
              return;
            }

            // 2. Check Employee Passwords/Status
            if (role == 'employee' || role == 'supervisor') {
              if (!passwordSet) {
                Navigator.pushReplacementNamed(context, '/set-password');
                return;
              }

              if (status == 'rejected' || !isActive) {
                Navigator.pushReplacementNamed(context, '/rejected');
                return;
              }

              if (status == 'approved' || status == 'active') {
                Navigator.pushReplacementNamed(context, '/employee');
                return;
              }

              Navigator.pushReplacementNamed(context, '/pending');
              return;
            }

            // Fallback for unknown roles
            Navigator.pushReplacementNamed(context, '/login');
          } catch (e) {
            debugPrint('Error during auth navigation: $e');
            if (mounted) Navigator.pushReplacementNamed(context, '/login');
          }
        } else {
          Navigator.pushReplacementNamed(context, '/login');
        }
      },
      loading: () {
        // Stay on splash while loading
      },
      error: (e, __) {
        debugPrint('Auth error on splash: $e');
        if (mounted) Navigator.pushReplacementNamed(context, '/login');
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    // Listen for auth state changes while splash is shown
    ref.listen<AsyncValue<User?>>(authStateProvider, (previous, next) {
      _handleAuthState(next);
    });

    return Scaffold(
      body: Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            // App icon
            Container(
              width: 120,
              height: 120,
              decoration: BoxDecoration(
                gradient: const LinearGradient(
                  colors: [AppColors.primary, AppColors.secondary],
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                ),
                borderRadius: BorderRadius.circular(32),
                boxShadow: [
                  BoxShadow(
                    color: AppColors.primary.withOpacity(0.4),
                    blurRadius: 30,
                    offset: const Offset(0, 10),
                  ),
                ],
              ),
              child: const Icon(
                Icons.qr_code_scanner_rounded,
                size: 56,
                color: Colors.white,
              ),
            )
                .animate()
                .fadeIn(duration: 600.ms)
                .scale(begin: const Offset(0.5, 0.5)),

            const SizedBox(height: 32),

            Text(
              'QR Task Manager',
              style: Theme.of(context).textTheme.headlineMedium?.copyWith(
                    fontWeight: FontWeight.w700,
                  ),
            ).animate().fadeIn(delay: 300.ms, duration: 600.ms),

            const SizedBox(height: 8),

            Text(
              'Scan • Complete • Report',
              style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                    color: AppColors.textMuted,
                    letterSpacing: 2,
                  ),
            ).animate().fadeIn(delay: 600.ms, duration: 600.ms),

            const SizedBox(height: 48),

            const SizedBox(
              width: 32,
              height: 32,
              child: CircularProgressIndicator(
                strokeWidth: 3,
                color: AppColors.primary,
              ),
            ).animate().fadeIn(delay: 900.ms),
          ],
        ),
      ),
    );
  }
}
