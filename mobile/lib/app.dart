import 'package:flutter/material.dart';
import 'ui/screens/auth/splash_screen.dart';
import 'ui/screens/auth/login_screen.dart';
import 'ui/screens/auth/pending_approval_screen.dart';
import 'ui/screens/auth/rejected_screen.dart';
import 'ui/screens/scanner/qr_scanner_screen.dart';
import 'ui/screens/tasks/task_list_screen.dart';
import 'ui/screens/navigation/main_navigation.dart';
import 'ui/screens/auth/set_password_screen.dart';
import 'core/theme/app_theme.dart';

class QRTaskApp extends StatelessWidget {
  const QRTaskApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'QR Task Manager',
      debugShowCheckedModeBanner: false,
      theme: AppTheme.darkTheme,
      initialRoute: '/',
      routes: {
        '/': (context) => const SplashScreen(),
        '/login': (context) => const LoginScreen(),
        '/pending': (context) => const PendingApprovalScreen(),
        '/rejected': (context) => const RejectedScreen(),
        '/home': (context) => const MainNavigation(),
        '/employee': (context) => const MainNavigation(),
        '/scanner': (context) => const QRScannerScreen(),
        '/tasks': (context) => const TaskListScreen(),
        '/admin': (context) => const Scaffold(body: Center(child: Text('Admin Dashboard Only Accessible Via Web'))),
        '/set-password': (context) => const SetPasswordScreen(),
      },
    );
  }
}

