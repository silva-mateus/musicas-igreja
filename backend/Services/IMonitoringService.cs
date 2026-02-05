using MusicasIgreja.Api.Models;

namespace MusicasIgreja.Api.Services;

public interface IMonitoringService
{
    // Security Events
    Task LogSecurityEventAsync(
        string eventType, 
        string severity, 
        string message, 
        int? userId = null, 
        string? ipAddress = null, 
        string? userAgent = null,
        string? metadata = null);

    // Audit Actions
    Task LogAuditActionAsync(
        string action, 
        string entityType, 
        int? entityId, 
        int userId, 
        string username, 
        string? ipAddress = null,
        string? oldValue = null, 
        string? newValue = null);

    // System Metrics
    Task RecordMetricAsync(
        string metricType, 
        double value, 
        string unit, 
        string? metadata = null);

    // Retrieve data
    Task<List<SystemEvent>> GetUnreadAlertsAsync(int? userId = null);
    Task<(List<SystemEvent> events, int total)> GetRecentEventsAsync(
        string? eventType = null, 
        string? severity = null, 
        int? userId = null,
        DateTime? startDate = null,
        DateTime? endDate = null,
        int page = 1, 
        int limit = 50);
    
    Task<(List<AuditLog> logs, int total)> GetAuditLogsAsync(
        string? action = null,
        string? entityType = null,
        int? userId = null,
        DateTime? startDate = null,
        DateTime? endDate = null,
        int page = 1,
        int limit = 50);

    Task<List<SystemMetric>> GetMetricsAsync(
        string? metricType = null,
        DateTime? startDate = null,
        DateTime? endDate = null,
        int limit = 100);

    Task<Dictionary<string, object>> GetSystemHealthAsync();
    Task MarkAlertAsReadAsync(int eventId);
    Task<int> GetUnreadAlertCountAsync();
    Task CleanupOldEventsAsync(int daysToKeep = 90);
}
