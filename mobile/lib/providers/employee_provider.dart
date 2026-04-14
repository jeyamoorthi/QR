import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../data/models/employee_models.dart';
import 'task_provider.dart';

/// Provider for task history filter state
class TaskHistoryFilters {
  final int days;
  final String? locationId;
  final String? status;

  const TaskHistoryFilters({
    this.days = 7,
    this.locationId,
    this.status,
  });

  TaskHistoryFilters copyWith({
    int? days,
    String? locationId,
    String? status,
  }) {
    return TaskHistoryFilters(
      days: days ?? this.days,
      locationId: locationId ?? this.locationId,
      status: status ?? this.status,
    );
  }
}

/// Notifier for managing task history filters
class TaskHistoryFilterNotifier extends StateNotifier<TaskHistoryFilters> {
  TaskHistoryFilterNotifier() : super(const TaskHistoryFilters());

  void setDays(int days) {
    state = state.copyWith(days: days);
  }

  void setLocationId(String? locationId) {
    state = state.copyWith(locationId: locationId);
  }

  void setStatus(String? status) {
    state = state.copyWith(status: status);
  }

  void reset() {
    state = const TaskHistoryFilters();
  }
}

/// Provider for task history filters
final taskHistoryFilterProvider =
    StateNotifierProvider<TaskHistoryFilterNotifier, TaskHistoryFilters>(
  (ref) => TaskHistoryFilterNotifier(),
);

/// Fetches employee personal stats
final employeeStatsProvider = FutureProvider<EmployeeStats>((ref) async {
  final api = ref.read(apiServiceProvider);
  final data = await api.getMyStats();
  return EmployeeStats.fromJson(data);
});

/// Fetches task history with applied filters
final taskHistoryProvider =
    FutureProvider.autoDispose
        .family<List<TaskHistoryItem>, TaskHistoryFilters>(
  (ref, filters) async {
    final api = ref.read(apiServiceProvider);
    final data = await api.getTaskHistory(
      days: filters.days,
      locationId: filters.locationId,
      status: filters.status,
    );

    final historyList = (data['history'] as List<dynamic>?) ?? const [];
    return historyList
        .map((item) => TaskHistoryItem.fromJson(item as Map<String, dynamic>))
        .toList();
  },
);

/// Fetches location history
final locationHistoryProvider =
    FutureProvider<List<LocationHistoryItem>>((ref) async {
  final api = ref.read(apiServiceProvider);
  final data = await api.getLocationHistory();

  final locationsList = (data['locations'] as List<dynamic>?) ?? const [];
  return locationsList
      .map(
          (item) => LocationHistoryItem.fromJson(item as Map<String, dynamic>))
      .toList();
});
