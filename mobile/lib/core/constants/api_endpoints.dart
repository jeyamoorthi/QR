class ApiEndpoints {
  // Unified backend base URL for local stabilization.
  static const String baseUrl = 'http://localhost:8000';

  static const String apiV1 = '/api/v1';

  // ── Tasks ────────────────────────────────────────────
  static String tasksByQR(String qrValue) => '$apiV1/tasks/by-qr/$qrValue';
  static const String submitTasks = '$apiV1/tasks/submit';
  static const String createTask = '$apiV1/tasks';
  static String updateTask(String id) => '$apiV1/tasks/$id';
  static String deleteTask(String id) => '$apiV1/tasks/$id';

  // ── Locations ─────────────────────────────────────────
  static const String locations = '$apiV1/locations';
  static String location(String id) => '$apiV1/locations/$id';
  static String locationTasks(String id) => '$apiV1/locations/$id/tasks';

  // ── Users / Auth ──────────────────────────────────────
  static const String currentUser = '$apiV1/users/me';
  static const String listUsers = '$apiV1/users';
  static const String registerUser = '$apiV1/users/register';
  static const String checkUser = '$apiV1/users/check-user';
  static const String setPassword = '$apiV1/users/set-password';
  static String updateUserRole(String id) => '$apiV1/users/$id/role';

  // ── Admin ─────────────────────────────────────────────
  static const String dashboard = '$apiV1/admin/dashboard';
  static const String activity = '$apiV1/admin/activity';
  static const String employeeStats = '$apiV1/admin/employees';

  // ── Companies (public) ───────────────────────────────
  static const String companies = '$apiV1/companies';

  // ── Employee (authenticated) ─────────────────────────
  static const String myStats = '$apiV1/employee/my-stats';
  static const String locationHistory = '$apiV1/employee/location-history';

  /// Build the task-history URL with optional query filters.
  static String taskHistory({
    int days = 7,
    String? locationId,
    String? status,
  }) {
    final params = <String, String>{'days': days.toString()};
    if (locationId != null && locationId.isNotEmpty) {
      params['location_id'] = locationId;
    }
    if (status != null && status.isNotEmpty) {
      params['status_filter'] = status;
    }
    final query = params.entries.map((e) => '${e.key}=${e.value}').join('&');
    return '$apiV1/employee/task-history?$query';
  }
}
