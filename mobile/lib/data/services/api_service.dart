import 'package:dio/dio.dart';
import 'package:firebase_auth/firebase_auth.dart';
import '../../core/constants/api_endpoints.dart';

/// Singleton HTTP client with automatic Firebase token injection.
class ApiService {
  static ApiService? _instance;
  late final Dio _dio;

  ApiService._internal() {
    _dio = Dio(BaseOptions(
      baseUrl: ApiEndpoints.baseUrl,
      connectTimeout: const Duration(seconds: 30),
      receiveTimeout: const Duration(seconds: 30),
      headers: {'Content-Type': 'application/json'},
    ));

    // Auto-attach Firebase ID token to every request
    _dio.interceptors.add(InterceptorsWrapper(
      onRequest: (options, handler) async {
        final user = FirebaseAuth.instance.currentUser;
        if (user != null) {
          final token = await user.getIdToken();
          options.headers['Authorization'] = 'Bearer $token';
        }
        return handler.next(options);
      },
      onError: (error, handler) async {
        if (error.response?.statusCode == 401) {
          // Token may have expired — force refresh and retry once
          try {
            final user = FirebaseAuth.instance.currentUser;
            if (user != null) {
              final newToken = await user.getIdToken(true);
              error.requestOptions.headers['Authorization'] = 'Bearer $newToken';
              final retryResponse = await _dio.fetch(error.requestOptions);
              return handler.resolve(retryResponse);
            }
          } catch (_) {}
        }
        return handler.next(error);
      },
    ));
  }

  factory ApiService() {
    _instance ??= ApiService._internal();
    return _instance!;
  }

  // === Task Endpoints ===

  /// Fetch tasks for a scanned QR code
  Future<Map<String, dynamic>> getTasksByQR(String qrValue) async {
    final safeQrValue = Uri.encodeComponent(qrValue.trim());
    final response = await _dio.get(ApiEndpoints.tasksByQR(safeQrValue));
    return response.data;
  }

  /// Submit completed tasks from a scan session
  Future<Map<String, dynamic>> submitTasks({
    required String sessionId,
    required String locationId,
    required List<Map<String, dynamic>> completedTasks,
  }) async {
    final response = await _dio.post(ApiEndpoints.submitTasks, data: {
      'sessionId': sessionId,
      'locationId': locationId,
      'completedTasks': completedTasks,
    });
    return response.data;
  }

  // === User & Auth Endpoints ===

  /// Get companies for registration dropdown
  Future<Map<String, dynamic>> getCompanies() async {
    final response = await _dio.get(ApiEndpoints.companies);
    return response.data;
  }

  /// Register a new user
  Future<Map<String, dynamic>> registerUser(Map<String, dynamic> data) async {
    final response = await _dio.post(ApiEndpoints.registerUser, data: data);
    return response.data;
  }

  /// Get current user profile (auto-creates on first call)
  Future<Map<String, dynamic>> getCurrentUser() async {
    final response = await _dio.get(ApiEndpoints.currentUser);
    return response.data;
  }

  /// Check if user exists and has set their password
  Future<Map<String, dynamic>> checkUser(String email) async {
    final response = await _dio.get('${ApiEndpoints.checkUser}?email=$email');
    return response.data;
  }

  /// Set the password for the first time
  Future<Map<String, dynamic>> setPassword(String email, String newPassword) async {
    final response = await _dio.post(ApiEndpoints.setPassword, data: {
      'email': email,
      'newPassword': newPassword,
    });
    return response.data;
  }

  // === Employee Endpoints ===

  /// Get employee personal stats
  Future<Map<String, dynamic>> getMyStats() async {
    final response = await _dio.get(ApiEndpoints.myStats);
    return response.data;
  }

  /// Get task history with filters
  Future<Map<String, dynamic>> getTaskHistory({
    int days = 7,
    String? locationId,
    String? status,
  }) async {
    final response = await _dio.get(
      ApiEndpoints.taskHistory(
        days: days,
        locationId: locationId,
        status: status,
      ),
    );
    return response.data;
  }

  /// Get location history
  Future<Map<String, dynamic>> getLocationHistory() async {
    final response = await _dio.get(ApiEndpoints.locationHistory);
    return response.data;
  }
}
