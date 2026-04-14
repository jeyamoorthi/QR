import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_animate/flutter_animate.dart';
import '../../../providers/auth_provider.dart';
import '../../../core/theme/app_theme.dart';

class PendingApprovalScreen extends ConsumerWidget {
  const PendingApprovalScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Scaffold(
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(32.0),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const Icon(
                Icons.hourglass_empty_rounded,
                size: 80,
                color: AppColors.primary,
              ).animate().fadeIn(duration: 600.ms).scale(begin: const Offset(0.5, 0.5)),
              const SizedBox(height: 32),
              Text(
                'Approval Pending',
                style: Theme.of(context).textTheme.headlineMedium?.copyWith(
                      fontWeight: FontWeight.w700,
                    ),
                textAlign: TextAlign.center,
              ).animate().fadeIn(delay: 300.ms).slideY(begin: 0.1),
              const SizedBox(height: 16),
              Text(
                'Your account has been created successfully but is waiting for admin approval. You will gain access to the app once approved.',
                style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                      color: AppColors.textMuted,
                      height: 1.5,
                    ),
                textAlign: TextAlign.center,
              ).animate().fadeIn(delay: 400.ms).slideY(begin: 0.1),
              const SizedBox(height: 48),
              ElevatedButton.icon(
                icon: const Icon(Icons.refresh),
                label: const Text('Check Status Again'),
                onPressed: () async {
                  final status = await ref.refresh(userStatusProvider.future);
                  if (!context.mounted) return;
                  if (status == 'approved') {
                    Navigator.pushReplacementNamed(context, '/home');
                  } else if (status == 'rejected') {
                    Navigator.pushReplacementNamed(context, '/rejected');
                  }
                },
              ).animate().fadeIn(delay: 500.ms).slideY(begin: 0.1),
              const SizedBox(height: 16),
              TextButton.icon(
                icon: const Icon(Icons.logout, color: AppColors.danger),
                label: const Text('Sign Out', style: TextStyle(color: AppColors.danger)),
                onPressed: () async {
                  await ref.read(authNotifierProvider.notifier).signOut();
                  if (!context.mounted) return;
                  Navigator.pushReplacementNamed(context, '/login');
                },
              ).animate().fadeIn(delay: 600.ms).slideY(begin: 0.1),
            ],
          ),
        ),
      ),
    );
  }
}
