import 'dart:ui';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:dio/dio.dart';
import '../../../providers/auth_provider.dart';
import '../../../core/theme/app_theme.dart';
import '../../../data/services/api_service.dart';

class LoginScreen extends ConsumerStatefulWidget {
  const LoginScreen({super.key});

  @override
  ConsumerState<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends ConsumerState<LoginScreen> {
  final _formKey = GlobalKey<FormState>();
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();
  final _nameController = TextEditingController();
  final _companyNameController = TextEditingController();
  List<dynamic> _companies = [];
  String? _selectedCompanyId;

  bool _isLogin = true;
  bool _isLoading = false;
  bool _isLoadingCompanies = false;
  bool _obscurePassword = true;
  String? _error;

  @override
  void dispose() {
    _emailController.dispose();
    _passwordController.dispose();
    _nameController.dispose();
    _companyNameController.dispose();
    super.dispose();
  }

  Future<void> _fetchCompanies() async {
    setState(() {
      _isLoadingCompanies = true;
      _error = null;
    });
    try {
      final res = await ApiService().getCompanies();
      setState(() {
        _companies = res['companies'] ?? [];
        if (_companies.isNotEmpty) {
          _selectedCompanyId = _companies[0]['id'];
        }
      });
    } catch (e) {
      setState(() {
        _error = 'Failed to load companies.';
      });
    } finally {
      setState(() {
        _isLoadingCompanies = false;
      });
    }
  }

  void _toggleMode() {
    setState(() {
      _isLogin = !_isLogin;
      _error = null;
    });
    if (!_isLogin && _companies.isEmpty) {
      _fetchCompanies();
    }
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    
    setState(() {
      _isLoading = true;
      _error = null;
    });

    try {
      final auth = ref.read(authNotifierProvider.notifier);
      final api = ApiService();

      if (_isLogin) {
        // Pre-check for first time users before Firebase Auth fails on no-password
        try {
          final emailTrimmed = _emailController.text.trim();
          final check = await api.checkUser(emailTrimmed);
          if (check['exists'] == true && check['password_set'] == false) {
             if (mounted) Navigator.pushReplacementNamed(context, '/set-password', arguments: emailTrimmed);
             return;
          }
        } catch (_) {} // ignore errors and try normal login

        await auth.signInWithEmail(
          _emailController.text.trim(),
          _passwordController.text,
        );
      } else {
        await auth.signUp(
          email: _emailController.text.trim(),
          password: _passwordController.text,
          name: _nameController.text.trim(),
          companyName: _companyNameController.text.trim(),
        );
      }

      if (mounted) {
         // Refresh user profile/status
         final user = await api.getCurrentUser();
         if (!mounted) return;
         
         if (user['role'] == 'admin') {
           Navigator.pushReplacementNamed(context, '/admin');
         } else {
           if (user['password_set'] == false) {
             Navigator.pushReplacementNamed(context, '/set-password', arguments: _emailController.text.trim());
           } else {
             final status = user['status'];
             if (status == 'approved' || status == 'active') {
               Navigator.pushReplacementNamed(context, '/employee');
             } else if (status == 'rejected') {
               Navigator.pushReplacementNamed(context, '/rejected');
             } else {
               Navigator.pushReplacementNamed(context, '/pending');
             }
           }
         }
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _error = _parseAuthError(e);
        });
      }
    } finally {
      if (mounted) {
        setState(() => _isLoading = false);
      }
    }
  }

  String _parseFirebaseError(String error) {
    if (error.contains('user-not-found')) return 'No account found with this email.';
    if (error.contains('wrong-password')) return 'Incorrect password.';
    if (error.contains('email-already-in-use')) return 'Email is already registered.';
    if (error.contains('weak-password')) return 'Password is too weak.';
    if (error.contains('invalid-email')) return 'Invalid email address.';
    if (error.contains('XMLHttpRequest error') || error.contains('Network error')) {
      return 'Cannot reach backend API. Check backend server and CORS settings.';
    }
    return 'Authentication failed. Please try again.';
  }

  String _parseAuthError(Object error) {
    if (error is FirebaseAuthException) {
      return _parseFirebaseError(error.code);
    }

    if (error is DioException) {
      final detail = error.response?.data;
      if (detail is Map<String, dynamic> && detail['detail'] != null) {
        return detail['detail'].toString();
      }
      return _parseFirebaseError(error.message ?? error.toString());
    }

    return _parseFirebaseError(error.toString());
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Stack(
        children: [
          // Background ambient glows
          Positioned(
            top: -100,
            right: -100,
            child: Container(
              width: 300,
              height: 300,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: AppColors.primary.withOpacity(0.15),
              ),
            ).animate().fadeIn(duration: 1.seconds).blur(begin: Offset.zero, end: const Offset(60, 60)),
          ),
          Positioned(
            bottom: -50,
            left: -100,
            child: Container(
              width: 350,
              height: 350,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: AppColors.secondary.withOpacity(0.1),
              ),
            ).animate().fadeIn(duration: 1.seconds).blur(begin: Offset.zero, end: const Offset(80, 80)),
          ),
          
          SafeArea(
            child: Center(
              child: SingleChildScrollView(
                padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 32),
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    // Logo Header
                    const SizedBox(height: 20),
                    Center(
                      child: Container(
                        width: 80,
                        height: 80,
                        decoration: BoxDecoration(
                          gradient: const LinearGradient(
                            colors: [AppColors.primary, AppColors.secondary],
                            begin: Alignment.topLeft,
                            end: Alignment.bottomRight,
                          ),
                          borderRadius: BorderRadius.circular(24),
                          boxShadow: [
                            BoxShadow(
                              color: AppColors.primary.withOpacity(0.3),
                              blurRadius: 20,
                              offset: const Offset(0, 10),
                            )
                          ],
                        ),
                        child: const Icon(
                          Icons.qr_code_scanner_rounded,
                          size: 38,
                          color: Colors.white,
                        ),
                      ),
                    ).animate().scale(duration: 500.ms, curve: Curves.easeOutBack),
                    
                    const SizedBox(height: 32),
                    
                    Text(
                      _isLogin ? 'Welcome Back' : 'Create Account',
                      style: Theme.of(context).textTheme.headlineLarge,
                      textAlign: TextAlign.center,
                    ).animate().fadeIn(delay: 100.ms).slideY(begin: 0.1),
                    
                    const SizedBox(height: 8),
                    
                    Text(
                      _isLogin
                          ? 'Sign in to your workplace'
                          : 'Sign up to get started',
                      style: Theme.of(context).textTheme.bodyMedium,
                      textAlign: TextAlign.center,
                    ).animate().fadeIn(delay: 200.ms).slideY(begin: 0.1),
                    
                    const SizedBox(height: 48),

                    // Glassmorphic Form Card
                    Container(
                      decoration: BoxDecoration(
                        color: AppColors.surface.withOpacity(0.4),
                        borderRadius: BorderRadius.circular(32),
                        border: Border.all(color: AppColors.glassBorder),
                        boxShadow: [
                          BoxShadow(
                            color: Colors.black.withOpacity(0.2),
                            blurRadius: 30,
                            offset: const Offset(0, 15),
                          ),
                        ],
                      ),
                      child: ClipRRect(
                        borderRadius: BorderRadius.circular(32),
                        child: BackdropFilter(
                          filter: ImageFilter.blur(sigmaX: 16, sigmaY: 16),
                          child: Padding(
                            padding: const EdgeInsets.all(32),
                            child: Form(
                              key: _formKey,
                              child: Column(
                                children: [
                                  if (_error != null) ...[
                                    Container(
                                      padding: const EdgeInsets.all(16),
                                      decoration: BoxDecoration(
                                        color: AppColors.danger.withOpacity(0.1),
                                        borderRadius: BorderRadius.circular(16),
                                        border: Border.all(color: AppColors.danger.withOpacity(0.3)),
                                      ),
                                      child: Row(
                                        children: [
                                          const Icon(Icons.error_outline_rounded, color: AppColors.danger, size: 20),
                                          const SizedBox(width: 12),
                                          Expanded(
                                            child: Text(
                                              _error!,
                                              style: const TextStyle(color: AppColors.danger, fontSize: 13, fontWeight: FontWeight.w500),
                                            ),
                                          ),
                                        ],
                                      ),
                                    ).animate().fadeIn().slideX(begin: 0.1),
                                    const SizedBox(height: 24),
                                  ],

                                    if (!_isLogin) ...[
                                      TextFormField(
                                        controller: _nameController,
                                        decoration: const InputDecoration(
                                          hintText: 'Full Name',
                                          prefixIcon: Icon(Icons.person_outline_rounded, color: AppColors.textMuted),
                                        ),
                                        style: const TextStyle(color: AppColors.textPrimary),
                                        validator: (v) =>
                                            v == null || v.trim().isEmpty ? 'Name is required' : null,
                                      ),
                                      const SizedBox(height: 16),
                                      TextFormField(
                                        controller: _companyNameController,
                                        decoration: const InputDecoration(
                                          hintText: 'Company Name',
                                          prefixIcon: Icon(Icons.business, color: AppColors.textMuted),
                                        ),
                                        style: const TextStyle(color: AppColors.textPrimary),
                                        validator: (v) =>
                                            v == null || v.trim().isEmpty ? 'Company Name is required' : null,
                                      ),
                                      const SizedBox(height: 16),
                                    ],
                                  
                                  TextFormField(
                                    controller: _emailController,
                                    keyboardType: TextInputType.emailAddress,
                                    decoration: const InputDecoration(
                                      hintText: 'Email Address',
                                      prefixIcon: Icon(Icons.email_outlined, color: AppColors.textMuted),
                                    ),
                                    style: const TextStyle(color: AppColors.textPrimary),
                                    validator: (v) {
                                      if (v == null || v.trim().isEmpty) return 'Email is required';
                                      if (!v.contains('@')) return 'Enter a valid email';
                                      return null;
                                    },
                                  ),
                                  
                                  const SizedBox(height: 16),
                                  
                                  TextFormField(
                                    controller: _passwordController,
                                    obscureText: _obscurePassword,
                                    decoration: InputDecoration(
                                      hintText: 'Password',
                                      prefixIcon: const Icon(Icons.lock_outline_rounded, color: AppColors.textMuted),
                                      suffixIcon: IconButton(
                                        icon: Icon(
                                          _obscurePassword
                                              ? Icons.visibility_off_outlined
                                              : Icons.visibility_outlined,
                                          color: AppColors.textMuted,
                                        ),
                                        onPressed: () =>
                                            setState(() => _obscurePassword = !_obscurePassword),
                                      ),
                                    ),
                                    style: const TextStyle(color: AppColors.textPrimary),
                                    validator: (v) {
                                      if (v == null || v.isEmpty) return 'Password is required';
                                      if (v.length < 6) return 'Minimum 6 characters';
                                      return null;
                                    },
                                  ),
                                  
                                  const SizedBox(height: 32),
                                  
                                  SizedBox(
                                    width: double.infinity,
                                    height: 56,
                                    child: ElevatedButton(
                                      onPressed: _isLoading ? null : _submit,
                                      child: _isLoading
                                          ? const SizedBox(
                                              width: 24,
                                              height: 24,
                                              child: CircularProgressIndicator(
                                                strokeWidth: 2.5,
                                                color: Colors.white,
                                              ),
                                            )
                                          : Text(
                                              _isLogin ? 'Sign In' : 'Create Account',
                                            ),
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ),
                        ),
                      ),
                    ).animate().fadeIn(delay: 300.ms).slideY(begin: 0.1),
                    
                    const SizedBox(height: 32),
                    
                    Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Text(
                          _isLogin
                              ? "Don't have an account?"
                              : 'Already have an account?',
                          style: Theme.of(context).textTheme.bodyMedium,
                        ),
                        const SizedBox(width: 8),
                        GestureDetector(
                          onTap: _toggleMode,
                          child: Text(
                            _isLogin ? 'Sign Up' : 'Sign In',
                            style: const TextStyle(
                              color: AppColors.primaryLight,
                              fontWeight: FontWeight.w600,
                              fontSize: 14,
                            ),
                          ),
                        ),
                      ],
                    ).animate().fadeIn(delay: 400.ms),
                  ],
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
