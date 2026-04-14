import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:firebase_auth/firebase_auth.dart';
import '../data/services/api_service.dart';

/// Provides the Firebase Auth instance.
final firebaseAuthProvider = Provider<FirebaseAuth>((ref) {
  return FirebaseAuth.instance;
});

/// Stream of auth state changes (logged in / logged out).
final authStateProvider = StreamProvider<User?>((ref) {
  return ref.watch(firebaseAuthProvider).authStateChanges();
});

/// Current user's profile from FastAPI backend including status
final userProfileProvider = FutureProvider<Map<String, dynamic>?>((ref) async {
  final user = FirebaseAuth.instance.currentUser;
  if (user == null) return null;

  try {
    return await ApiService().getCurrentUser();
  } catch (e) {
    print('Failed to load user profile: $e');
    return null;
  }
});

/// Current user's status 
final userStatusProvider = FutureProvider<String>((ref) async {
  final profile = await ref.watch(userProfileProvider.future);
  if (profile == null) return 'pending';
  
  if (profile['isActive'] == false) return 'rejected';
  
  return profile['status'] ?? 'pending';
});

/// Current user's role from custom claims.
final userRoleProvider = FutureProvider<String>((ref) async {
  final user = FirebaseAuth.instance.currentUser;
  if (user == null) return 'employee';

  final tokenResult = await user.getIdTokenResult(true); // force refresh
  return tokenResult.claims?['role'] as String? ?? 'employee';
});

/// Auth actions (login, register, logout).
class AuthNotifier extends StateNotifier<AsyncValue<User?>> {
  final FirebaseAuth _auth;
  final Ref _ref;

  AuthNotifier(this._auth, this._ref) : super(const AsyncValue.loading()) {
    _auth.authStateChanges().listen((user) {
      state = AsyncValue.data(user);
    });
  }

  Future<void> signInWithEmail(String email, String password) async {
    state = const AsyncValue.loading();
    try {
      await _auth.signInWithEmailAndPassword(email: email, password: password);
    } catch (e, st) {
      state = AsyncValue.error(e, st);
      rethrow;
    }
  }

  Future<void> signUp({
    required String email,
    required String password,
    required String name,
    required String companyName,
  }) async {
    state = const AsyncValue.loading();
    try {
      // 1. Call FastAPI to register user as ADMIN creating a new company
      await ApiService().registerUser({
        'email': email,
        'password': password,
        'displayName': name,
        'role': 'admin',
        'companyName': companyName,
      });

      // 2. Sign in locally
      await _auth.signInWithEmailAndPassword(email: email, password: password);
      
      // 3. Force refresh provider
      _ref.invalidate(userProfileProvider);
    } catch (e, st) {
      state = AsyncValue.error(e, st);
      rethrow;
    }
  }

  Future<void> signOut() async {
    await _auth.signOut();
  }
}

final authNotifierProvider =
    StateNotifierProvider<AuthNotifier, AsyncValue<User?>>((ref) {
  return AuthNotifier(ref.watch(firebaseAuthProvider), ref);
});
