/// Task model matching the backend schema.
class TaskModel {
  final String id;
  final String title;
  final String? description;
  final String priority;
  final int? estimatedMinutes;
  final int order;
  final bool isCompletedToday;

  TaskModel({
    required this.id,
    required this.title,
    this.description,
    required this.priority,
    this.estimatedMinutes,
    required this.order,
    required this.isCompletedToday,
  });

  factory TaskModel.fromJson(Map<String, dynamic> json) {
    return TaskModel(
      id: json['id'] as String,
      title: json['title'] as String,
      description: json['description'] as String?,
      priority: json['priority'] as String? ?? 'medium',
      estimatedMinutes: json['estimatedMinutes'] as int?,
      order: json['order'] as int? ?? 0,
      isCompletedToday: json['isCompletedToday'] as bool? ?? false,
    );
  }
}

/// Location brief info returned with scan results.
class LocationModel {
  final String id;
  final String name;
  final String? description;

  LocationModel({
    required this.id,
    required this.name,
    this.description,
  });

  factory LocationModel.fromJson(Map<String, dynamic> json) {
    return LocationModel(
      id: json['id'] as String,
      name: json['name'] as String,
      description: json['description'] as String?,
    );
  }
}

/// Full scan response from the API.
class ScanResult {
  final LocationModel location;
  final List<TaskModel> tasks;
  final String sessionId;

  ScanResult({
    required this.location,
    required this.tasks,
    required this.sessionId,
  });

  factory ScanResult.fromJson(Map<String, dynamic> json) {
    return ScanResult(
      location: LocationModel.fromJson(json['location']),
      tasks: (json['tasks'] as List)
          .map((t) => TaskModel.fromJson(t as Map<String, dynamic>))
          .toList(),
      sessionId: json['sessionId'] as String,
    );
  }
}
