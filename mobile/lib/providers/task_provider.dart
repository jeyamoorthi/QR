import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../data/services/api_service.dart';
import '../data/models/task_model.dart';

/// Provider for the API service singleton.
final apiServiceProvider = Provider<ApiService>((ref) => ApiService());

/// Fetches tasks for a given QR code value.
final scanResultProvider =
    FutureProvider.family<ScanResult, String>((ref, qrValue) async {
  final api = ref.read(apiServiceProvider);
  final json = await api.getTasksByQR(qrValue);
  return ScanResult.fromJson(json);
});

/// Tracks which tasks the user has checked off in the current session.
class TaskChecklistNotifier extends StateNotifier<Map<String, TaskCheckState>> {
  TaskChecklistNotifier() : super({});

  void toggleTask(String taskId) {
    final current = state[taskId] ?? TaskCheckState.pending;
    state = {
      ...state,
      taskId: current == TaskCheckState.completed
          ? TaskCheckState.pending
          : TaskCheckState.completed,
    };
  }

  void markIssue(String taskId, String notes) {
    state = {
      ...state,
      taskId: TaskCheckState.issue,
    };
    _issueNotes[taskId] = notes;
  }

  void skipTask(String taskId) {
    state = {
      ...state,
      taskId: TaskCheckState.skipped,
    };
  }

  String? getIssueNotes(String taskId) => _issueNotes[taskId];
  final Map<String, String> _issueNotes = {};

  int get completedCount =>
      state.values.where((v) => v == TaskCheckState.completed).length;

  bool get hasAnyAction => state.values.any((v) => v != TaskCheckState.pending);

  /// Build the submission payload.
  List<Map<String, dynamic>> buildSubmission() {
    return state.entries
        .where((e) => e.value != TaskCheckState.pending)
        .map((e) => {
              'taskId': e.key,
              'status': e.value.apiValue,
              'notes': _issueNotes[e.key],
              'completedAt': DateTime.now().toUtc().toIso8601String(),
            })
        .toList();
  }

  void reset() {
    state = {};
    _issueNotes.clear();
  }
}

enum TaskCheckState {
  pending,
  completed,
  skipped,
  issue;

  String get apiValue {
    switch (this) {
      case pending:
        return 'completed'; // shouldn't be submitted
      case completed:
        return 'completed';
      case skipped:
        return 'skipped';
      case issue:
        return 'issue_reported';
    }
  }
}

final taskChecklistProvider =
    StateNotifierProvider<TaskChecklistNotifier, Map<String, TaskCheckState>>(
  (ref) => TaskChecklistNotifier(),
);
