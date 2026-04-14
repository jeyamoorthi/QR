/// Data models for employee-facing screens.

class EmployeeStats {
  final int todayCompleted;
  final int todayPending;
  final int weeklyCompleted;
  final int totalCompleted;
  final double completionRate;
  final int totalLocations;
  final int currentStreak;
  final int assignedLocations;

  EmployeeStats({
    required this.todayCompleted,
    required this.todayPending,
    required this.weeklyCompleted,
    required this.totalCompleted,
    required this.completionRate,
    required this.totalLocations,
    required this.currentStreak,
    required this.assignedLocations,
  });

  factory EmployeeStats.fromJson(Map<String, dynamic> json) {
    return EmployeeStats(
      todayCompleted: json['todayCompleted'] as int? ?? 0,
      todayPending: json['todayPending'] as int? ?? 0,
      weeklyCompleted: json['weeklyCompleted'] as int? ?? 0,
      totalCompleted: json['totalCompleted'] as int? ?? 0,
      completionRate: (json['completionRate'] as num?)?.toDouble() ?? 0.0,
      totalLocations: json['totalLocations'] as int? ?? 0,
      currentStreak: json['currentStreak'] as int? ?? 0,
      assignedLocations: json['assignedLocations'] as int? ?? 0,
    );
  }
}

class TaskHistoryItem {
  final String id;
  final String taskId;
  final String taskTitle;
  final String locationId;
  final String locationName;
  final String status;
  final String? notes;
  final DateTime? completedAt;
  final String sessionId;

  TaskHistoryItem({
    required this.id,
    required this.taskId,
    required this.taskTitle,
    required this.locationId,
    required this.locationName,
    required this.status,
    this.notes,
    this.completedAt,
    required this.sessionId,
  });

  factory TaskHistoryItem.fromJson(Map<String, dynamic> json) {
    return TaskHistoryItem(
      id: json['id'] as String? ?? '',
      taskId: json['taskId'] as String? ?? '',
      taskTitle: json['taskTitle'] as String? ?? 'Unknown Task',
      locationId: json['locationId'] as String? ?? '',
      locationName: json['locationName'] as String? ?? 'Unknown',
      status: json['status'] as String? ?? '',
      notes: json['notes'] as String?,
      completedAt: json['completedAt'] != null
          ? DateTime.tryParse(json['completedAt'].toString())
          : null,
      sessionId: json['sessionId'] as String? ?? '',
    );
  }
}

class LocationHistoryItem {
  final String locationId;
  final String locationName;
  final String? address;
  final int visitCount;
  final int tasksCompleted;
  final DateTime? lastVisited;

  LocationHistoryItem({
    required this.locationId,
    required this.locationName,
    this.address,
    required this.visitCount,
    required this.tasksCompleted,
    this.lastVisited,
  });

  factory LocationHistoryItem.fromJson(Map<String, dynamic> json) {
    return LocationHistoryItem(
      locationId: json['locationId'] as String? ?? '',
      locationName: json['locationName'] as String? ?? 'Unknown',
      address: json['address'] as String?,
      visitCount: json['visitCount'] as int? ?? 0,
      tasksCompleted: json['tasksCompleted'] as int? ?? 0,
      lastVisited: json['lastVisited'] != null
          ? DateTime.tryParse(json['lastVisited'].toString())
          : null,
    );
  }
}
