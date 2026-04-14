import 'dart:ui';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:dio/dio.dart';
import '../../../core/theme/app_theme.dart';
import '../../../data/models/task_model.dart';
import '../../../data/services/api_service.dart';
import '../../../providers/task_provider.dart';

class TaskListScreen extends ConsumerStatefulWidget {
  const TaskListScreen({super.key});

  @override
  ConsumerState<TaskListScreen> createState() => _TaskListScreenState();
}

class _TaskListScreenState extends ConsumerState<TaskListScreen> {
  ScanResult? _scanResult;
  bool _isLoading = true;
  bool _isSubmitting = false;
  String? _error;
  String _qrValue = '';

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    final args = ModalRoute.of(context)?.settings.arguments;
    if (args is String && args != _qrValue) {
      _qrValue = args;
      _fetchTasks();
    }
  }

  Future<void> _fetchTasks() async {
    setState(() {
      _isLoading = true;
      _error = null;
    });

    try {
      final api = ApiService();
      final json = await api.getTasksByQR(_qrValue);
      setState(() {
        _scanResult = ScanResult.fromJson(json);
        _isLoading = false;
      });
      // Reset checklist for new session
      ref.read(taskChecklistProvider.notifier).reset();
    } catch (e) {
      String message = 'Failed to load tasks. Please try again.';
      if (e is DioException) {
        final data = e.response?.data;
        if (data is Map<String, dynamic> && data['detail'] != null) {
          message = data['detail'].toString();
        } else if (e.message != null && e.message!.isNotEmpty) {
          message = e.message!;
        }
      }
      setState(() {
        _error = message;
        _isLoading = false;
      });
    }
  }

  Future<void> _submitTasks() async {
    final notifier = ref.read(taskChecklistProvider.notifier);
    if (!notifier.hasAnyAction) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Please complete at least one task.')),
      );
      return;
    }

    setState(() => _isSubmitting = true);

    try {
      final api = ApiService();
      await api.submitTasks(
        sessionId: _scanResult!.sessionId,
        locationId: _scanResult!.location.id,
        completedTasks: notifier.buildSubmission(),
      );

      HapticFeedback.heavyImpact();

      if (mounted) {
        _showSuccessDialog();
      }
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Failed to submit. Please try again.')),
      );
    } finally {
      if (mounted) setState(() => _isSubmitting = false);
    }
  }

  void _showSuccessDialog() {
    final completed = ref.read(taskChecklistProvider.notifier).completedCount;
    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (context) => AlertDialog(
        backgroundColor: AppColors.surface,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const SizedBox(height: 16),
            Container(
              width: 80,
              height: 80,
              decoration: BoxDecoration(
                color: AppColors.success.withOpacity(0.15),
                shape: BoxShape.circle,
              ),
              child: const Icon(
                Icons.check_circle_rounded,
                color: AppColors.success,
                size: 48,
              ),
            ),
            const SizedBox(height: 24),
            const Text(
              'Tasks Submitted!',
              style: TextStyle(
                fontSize: 22,
                fontWeight: FontWeight.w700,
                color: AppColors.textPrimary,
              ),
            ),
            const SizedBox(height: 8),
            Text(
              '$completed task${completed != 1 ? 's' : ''} completed at\n${_scanResult?.location.name ?? ''}',
              textAlign: TextAlign.center,
              style: const TextStyle(
                color: AppColors.textSecondary,
                fontSize: 14,
                height: 1.5,
              ),
            ),
            const SizedBox(height: 32),
            SizedBox(
              width: double.infinity,
              height: 52,
              child: ElevatedButton(
                onPressed: () {
                  Navigator.of(context).pop();
                  Navigator.pushReplacementNamed(context, '/home');
                },
                child: const Text('Done'),
              ),
            ),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final checklist = ref.watch(taskChecklistProvider);

    return Scaffold(
      appBar: AppBar(
        title: Text(_scanResult?.location.name ?? 'Tasks'),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new_rounded),
          onPressed: () => Navigator.pop(context),
        ),
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : _error != null
              ? _buildErrorState()
              : _buildTaskList(checklist),
      bottomNavigationBar: _scanResult != null && !_isLoading && _error == null
          ? _buildSubmitBar(checklist)
          : null,
    );
  }

  Widget _buildErrorState() {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(
              Icons.error_outline_rounded,
              size: 64,
              color: AppColors.danger,
            ),
            const SizedBox(height: 20),
            Text(
              _error!,
              textAlign: TextAlign.center,
              style: const TextStyle(
                color: AppColors.textSecondary,
                fontSize: 16,
              ),
            ),
            const SizedBox(height: 24),
            ElevatedButton.icon(
              onPressed: _fetchTasks,
              icon: const Icon(Icons.refresh),
              label: const Text('Retry'),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildTaskList(Map<String, TaskCheckState> checklist) {
    final tasks = _scanResult!.tasks;

    return ListView.builder(
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 100),
      itemCount: tasks.length + 1, // +1 for header
      itemBuilder: (context, index) {
        if (index == 0) {
          // Location header
          return Container(
            margin: const EdgeInsets.only(bottom: 16),
            padding: const EdgeInsets.all(20),
            decoration: BoxDecoration(
              gradient: LinearGradient(
                colors: [
                  AppColors.primary.withOpacity(0.15),
                  AppColors.secondary.withOpacity(0.08),
                ],
              ),
              borderRadius: BorderRadius.circular(20),
              border: Border.all(
                color: AppColors.primary.withOpacity(0.2),
              ),
            ),
            child: Row(
              children: [
                Container(
                  width: 48,
                  height: 48,
                  decoration: BoxDecoration(
                    color: AppColors.primary.withOpacity(0.2),
                    borderRadius: BorderRadius.circular(14),
                  ),
                  child: const Icon(
                    Icons.location_on_rounded,
                    color: AppColors.primary,
                  ),
                ),
                const SizedBox(width: 16),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        _scanResult!.location.name,
                        style: const TextStyle(
                          fontWeight: FontWeight.w600,
                          fontSize: 16,
                          color: AppColors.textPrimary,
                        ),
                      ),
                      if (_scanResult!.location.description != null) ...[
                        const SizedBox(height: 4),
                        Text(
                          _scanResult!.location.description!,
                          style: const TextStyle(
                            color: AppColors.textMuted,
                            fontSize: 13,
                          ),
                        ),
                      ],
                    ],
                  ),
                ),
                // Task count badge
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                  decoration: BoxDecoration(
                    color: AppColors.surface,
                    borderRadius: BorderRadius.circular(20),
                  ),
                  child: Text(
                    '${tasks.length} tasks',
                    style: const TextStyle(
                      color: AppColors.textSecondary,
                      fontSize: 13,
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                ),
              ],
            ),
          ).animate().fadeIn(duration: 400.ms);
        }

        final task = tasks[index - 1];
        final state = task.isCompletedToday
            ? TaskCheckState.completed
            : (checklist[task.id] ?? TaskCheckState.pending);

        return _buildTaskCard(task, state, index)
            .animate()
            .fadeIn(delay: Duration(milliseconds: 80 * index))
            .slideX(begin: 0.05);
      },
    );
  }

  Widget _buildTaskCard(TaskModel task, TaskCheckState state, int index) {
    final isCompleted = state == TaskCheckState.completed;
    final isDisabled = task.isCompletedToday;

    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(16),
        child: BackdropFilter(
          filter: ImageFilter.blur(sigmaX: 12, sigmaY: 12),
          child: Container(
            decoration: BoxDecoration(
              color: isCompleted ? AppColors.success.withOpacity(0.05) : AppColors.surface.withOpacity(0.6),
              border: Border.all(
                color: isCompleted
                    ? AppColors.success.withOpacity(0.3)
                    : AppColors.surfaceLight.withOpacity(0.5),
                width: 1,
              ),
              borderRadius: BorderRadius.circular(16),
            ),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          borderRadius: BorderRadius.circular(16),
          onTap: isDisabled
              ? null
              : () {
                  HapticFeedback.lightImpact();
                  ref.read(taskChecklistProvider.notifier).toggleTask(task.id);
                },
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Row(
              children: [
                // Checkbox
                AnimatedContainer(
                  duration: const Duration(milliseconds: 300),
                  curve: Curves.easeOutBack,
                  width: 28,
                  height: 28,
                  decoration: BoxDecoration(
                    gradient: isCompleted
                        ? const LinearGradient(
                            colors: [AppColors.success, Color(0xFF34D399)],
                            begin: Alignment.topLeft,
                            end: Alignment.bottomRight,
                          )
                        : null,
                    color: isCompleted
                        ? null
                        : AppColors.surfaceLight.withOpacity(0.3),
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(
                      color: isCompleted
                          ? Colors.transparent
                          : AppColors.textMuted.withOpacity(0.3),
                      width: 2,
                    ),
                    boxShadow: isCompleted
                        ? [
                            BoxShadow(
                              color: AppColors.success.withOpacity(0.4),
                              blurRadius: 8,
                              offset: const Offset(0, 2),
                            )
                          ]
                        : null,
                  ),
                  child: isCompleted
                      ? const Icon(Icons.check_rounded,
                              size: 18, color: Colors.white)
                          .animate()
                          .scale(duration: 300.ms, curve: Curves.easeOutBack)
                      : null,
                ),
                const SizedBox(width: 16),

                // Task info
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        task.title,
                        style: TextStyle(
                          fontWeight: FontWeight.w600,
                          fontSize: 15,
                          color: isCompleted
                              ? AppColors.textMuted
                              : AppColors.textPrimary,
                          decoration: isCompleted
                              ? TextDecoration.lineThrough
                              : null,
                        ),
                      ),
                      if (task.description != null &&
                          task.description!.isNotEmpty) ...[
                        const SizedBox(height: 4),
                        Text(
                          task.description!,
                          style: const TextStyle(
                            color: AppColors.textMuted,
                            fontSize: 13,
                          ),
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ],
                      const SizedBox(height: 8),
                      Row(
                        children: [
                          // Priority badge
                          Container(
                            padding: const EdgeInsets.symmetric(
                                horizontal: 10, vertical: 4),
                            decoration: BoxDecoration(
                              color: AppColors.priorityColor(task.priority)
                                  .withOpacity(0.12),
                              borderRadius: BorderRadius.circular(8),
                            ),
                            child: Text(
                              task.priority.toUpperCase(),
                              style: TextStyle(
                                color: AppColors.priorityColor(task.priority),
                                fontSize: 11,
                                fontWeight: FontWeight.w600,
                                letterSpacing: 0.5,
                              ),
                            ),
                          ),
                          if (task.estimatedMinutes != null) ...[
                            const SizedBox(width: 10),
                            Icon(
                              Icons.schedule_rounded,
                              size: 14,
                              color: AppColors.textMuted.withOpacity(0.6),
                            ),
                            const SizedBox(width: 4),
                            Text(
                              '${task.estimatedMinutes} min',
                              style: TextStyle(
                                color: AppColors.textMuted.withOpacity(0.6),
                                fontSize: 12,
                              ),
                            ),
                          ],
                          if (isDisabled) ...[
                            const Spacer(),
                            const Icon(
                              Icons.verified_rounded,
                              size: 16,
                              color: AppColors.success,
                            ),
                            const SizedBox(width: 4),
                            const Text(
                              'Done today',
                              style: TextStyle(
                                color: AppColors.success,
                                fontSize: 12,
                                fontWeight: FontWeight.w500,
                              ),
                            ),
                          ],
                        ],
                      ),
                    ],
                  ),
                ),

                // Issue report button
                if (!isDisabled)
                  PopupMenuButton<String>(
                    icon: const Icon(
                      Icons.more_vert_rounded,
                      color: AppColors.textMuted,
                      size: 20,
                    ),
                    onSelected: (value) {
                      if (value == 'skip') {
                        ref.read(taskChecklistProvider.notifier).skipTask(task.id);
                      } else if (value == 'issue') {
                        _showIssueDialog(task.id);
                      }
                    },
                    itemBuilder: (context) => [
                      const PopupMenuItem(
                        value: 'skip',
                        child: Row(
                          children: [
                            Icon(Icons.skip_next_rounded, size: 20),
                            SizedBox(width: 12),
                            Text('Skip'),
                          ],
                        ),
                      ),
                      const PopupMenuItem(
                        value: 'issue',
                        child: Row(
                          children: [
                            Icon(Icons.report_problem_rounded,
                                size: 20, color: AppColors.warning),
                            SizedBox(width: 12),
                            Text('Report Issue'),
                          ],
                        ),
                      ),
                    ],
                  ),
              ],
            ),
          ),
        ),
      ), // end Material
      ), // end Inner Container
      ), // end BackdropFilter
      ), // end ClipRRect
    ); // end Outer Container
  }

  void _showIssueDialog(String taskId) {
    final controller = TextEditingController();
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        backgroundColor: AppColors.surface,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: const Text('Report Issue'),
        content: TextField(
          controller: controller,
          maxLines: 3,
          decoration: const InputDecoration(
            hintText: 'Describe the issue...',
          ),
          style: const TextStyle(color: AppColors.textPrimary),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Cancel'),
          ),
          ElevatedButton(
            onPressed: () {
              ref
                  .read(taskChecklistProvider.notifier)
                  .markIssue(taskId, controller.text);
              Navigator.pop(context);
            },
            style: ElevatedButton.styleFrom(
              backgroundColor: AppColors.warning,
            ),
            child: const Text('Report'),
          ),
        ],
      ),
    );
  }

  Widget _buildSubmitBar(Map<String, TaskCheckState> checklist) {
    final completed = checklist.values
        .where((v) => v != TaskCheckState.pending)
        .length;
    final total = _scanResult!.tasks
        .where((t) => !t.isCompletedToday)
        .length;

    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: AppColors.surface,
        border: Border(
          top: BorderSide(color: AppColors.surfaceLight, width: 1),
        ),
      ),
      child: SafeArea(
        child: Row(
          children: [
            // Progress
            Expanded(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    '$completed of $total tasks',
                    style: const TextStyle(
                      fontWeight: FontWeight.w600,
                      color: AppColors.textPrimary,
                    ),
                  ),
                  const SizedBox(height: 6),
                  ClipRRect(
                    borderRadius: BorderRadius.circular(4),
                    child: LinearProgressIndicator(
                      value: total > 0 ? completed / total : 0,
                      backgroundColor: AppColors.surfaceLight,
                      color: AppColors.success,
                      minHeight: 6,
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(width: 20),
            // Submit button
            SizedBox(
              height: 52,
              child: ElevatedButton.icon(
                onPressed: _isSubmitting || completed == 0 ? null : _submitTasks,
                icon: _isSubmitting
                    ? const SizedBox(
                        width: 20,
                        height: 20,
                        child: CircularProgressIndicator(
                          strokeWidth: 2,
                          color: Colors.white,
                        ),
                      )
                    : const Icon(Icons.send_rounded, size: 20),
                label: Text(_isSubmitting ? 'Sending...' : 'Submit'),
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppColors.success,
                  padding: const EdgeInsets.symmetric(horizontal: 24),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(14),
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
