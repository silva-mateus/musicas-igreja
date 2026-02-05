using Microsoft.EntityFrameworkCore;
using MusicasIgreja.Api.Data;
using MusicasIgreja.Api.Models;
using System.Text.Json;

namespace MusicasIgreja.Api.Services;

public class MonitoringService : IMonitoringService
{
    private readonly AppDbContext _context;
    private readonly ILogger<MonitoringService> _logger;

    public MonitoringService(AppDbContext context, ILogger<MonitoringService> logger)
    {
        _context = context;
        _logger = logger;
    }

    public async Task LogSecurityEventAsync(
        string eventType, 
        string severity, 
        string message, 
        int? userId = null, 
        string? ipAddress = null, 
        string? userAgent = null,
        string? metadata = null)
    {
        try
        {
            var systemEvent = new SystemEvent
            {
                EventType = eventType,
                Severity = severity,
                Source = "Security",
                Message = message,
                UserId = userId,
                IpAddress = ipAddress,
                UserAgent = userAgent,
                Metadata = metadata,
                IsRead = false,
                CreatedDate = DateTime.UtcNow
            };

            _context.SystemEvents.Add(systemEvent);
            await _context.SaveChangesAsync();

            // Also log to ILogger for critical/high severity events
            if (severity == "critical" || severity == "high")
            {
                _logger.LogWarning(
                    "[Security] Event [{Severity}] - {EventType}: {Message} | User: {UserId}, IP: {IpAddress}",
                    severity, eventType, message, userId, ipAddress);
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error logging security event: {EventType}", eventType);
        }
    }

    public async Task LogAuditActionAsync(
        string action, 
        string entityType, 
        int? entityId, 
        int userId, 
        string username, 
        string? ipAddress = null,
        string? oldValue = null, 
        string? newValue = null)
    {
        try
        {
            var auditLog = new AuditLog
            {
                Action = action,
                EntityType = entityType,
                EntityId = entityId,
                UserId = userId,
                Username = username,
                IpAddress = ipAddress,
                OldValue = oldValue,
                NewValue = newValue,
                CreatedDate = DateTime.UtcNow
            };

            _context.AuditLogs.Add(auditLog);
            await _context.SaveChangesAsync();

            _logger.LogInformation(
                "[Audit] {Action} on {EntityType}#{EntityId} by {Username}",
                action, entityType, entityId, username);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error logging audit action: {Action} on {EntityType}", action, entityType);
        }
    }

    public async Task RecordMetricAsync(
        string metricType, 
        double value, 
        string unit, 
        string? metadata = null)
    {
        try
        {
            var metric = new SystemMetric
            {
                MetricType = metricType,
                Value = value,
                Unit = unit,
                Metadata = metadata,
                Timestamp = DateTime.UtcNow
            };

            _context.SystemMetrics.Add(metric);
            await _context.SaveChangesAsync();

            _logger.LogDebug("[Metrics] Recorded: {MetricType} = {Value} {Unit}", metricType, value, unit);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error recording metric: {MetricType}", metricType);
        }
    }

    public async Task<List<SystemEvent>> GetUnreadAlertsAsync(int? userId = null)
    {
        try
        {
            var query = _context.SystemEvents
                .Where(e => !e.IsRead)
                .OrderByDescending(e => e.CreatedDate);

            if (userId.HasValue)
            {
                query = (IOrderedQueryable<SystemEvent>)query.Where(e => e.UserId == userId.Value || e.UserId == null);
            }

            return await query
                .Take(50)
                .Include(e => e.User)
                .ToListAsync();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting unread alerts");
            return new List<SystemEvent>();
        }
    }

    public async Task<(List<SystemEvent> events, int total)> GetRecentEventsAsync(
        string? eventType = null, 
        string? severity = null, 
        int? userId = null,
        DateTime? startDate = null,
        DateTime? endDate = null,
        int page = 1, 
        int limit = 50)
    {
        try
        {
            var query = _context.SystemEvents.AsQueryable();

            if (!string.IsNullOrEmpty(eventType))
                query = query.Where(e => e.EventType == eventType);

            if (!string.IsNullOrEmpty(severity))
                query = query.Where(e => e.Severity == severity);

            if (userId.HasValue)
                query = query.Where(e => e.UserId == userId.Value);

            if (startDate.HasValue)
                query = query.Where(e => e.CreatedDate >= startDate.Value);

            if (endDate.HasValue)
                query = query.Where(e => e.CreatedDate <= endDate.Value);

            var total = await query.CountAsync();

            var events = await query
                .OrderByDescending(e => e.CreatedDate)
                .Skip((page - 1) * limit)
                .Take(limit)
                .Include(e => e.User)
                .ToListAsync();

            return (events, total);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting recent events");
            return (new List<SystemEvent>(), 0);
        }
    }

    public async Task<(List<AuditLog> logs, int total)> GetAuditLogsAsync(
        string? action = null,
        string? entityType = null,
        int? userId = null,
        DateTime? startDate = null,
        DateTime? endDate = null,
        int page = 1,
        int limit = 50)
    {
        try
        {
            var query = _context.AuditLogs.AsQueryable();

            if (!string.IsNullOrEmpty(action))
                query = query.Where(a => a.Action == action);

            if (!string.IsNullOrEmpty(entityType))
                query = query.Where(a => a.EntityType == entityType);

            if (userId.HasValue)
                query = query.Where(a => a.UserId == userId.Value);

            if (startDate.HasValue)
                query = query.Where(a => a.CreatedDate >= startDate.Value);

            if (endDate.HasValue)
                query = query.Where(a => a.CreatedDate <= endDate.Value);

            var total = await query.CountAsync();

            var logs = await query
                .OrderByDescending(a => a.CreatedDate)
                .Skip((page - 1) * limit)
                .Take(limit)
                .Include(a => a.User)
                .ToListAsync();

            return (logs, total);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting audit logs");
            return (new List<AuditLog>(), 0);
        }
    }

    public async Task<List<SystemMetric>> GetMetricsAsync(
        string? metricType = null,
        DateTime? startDate = null,
        DateTime? endDate = null,
        int limit = 100)
    {
        try
        {
            var query = _context.SystemMetrics.AsQueryable();

            if (!string.IsNullOrEmpty(metricType))
                query = query.Where(m => m.MetricType == metricType);

            if (startDate.HasValue)
                query = query.Where(m => m.Timestamp >= startDate.Value);

            if (endDate.HasValue)
                query = query.Where(m => m.Timestamp <= endDate.Value);

            return await query
                .OrderByDescending(m => m.Timestamp)
                .Take(limit)
                .ToListAsync();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting metrics");
            return new List<SystemMetric>();
        }
    }

    public async Task<Dictionary<string, object>> GetSystemHealthAsync()
    {
        try
        {
            var health = new Dictionary<string, object>();

            // Database stats
            var totalFiles = await _context.PdfFiles.CountAsync();
            var totalUsers = await _context.Users.CountAsync();
            var activeUsers = await _context.Users.CountAsync(u => u.IsActive);

            // Recent activity (last 24h)
            var yesterday = DateTime.UtcNow.AddDays(-1);
            var recentUploads = await _context.PdfFiles.CountAsync(f => f.UploadDate >= yesterday);
            var recentLogins = await _context.AuditLogs
                .CountAsync(a => a.Action == "login" && a.CreatedDate >= yesterday);
            var recentFailedLogins = await _context.SystemEvents
                .CountAsync(e => e.EventType == "login_failed" && e.CreatedDate >= yesterday);

            // Storage metrics
            var totalFileSize = await _context.PdfFiles.SumAsync(f => (long?)f.FileSize) ?? 0;
            var totalFileSizeMb = totalFileSize / (1024.0 * 1024.0);

            // Critical events (last 7 days)
            var lastWeek = DateTime.UtcNow.AddDays(-7);
            var criticalEvents = await _context.SystemEvents
                .CountAsync(e => e.Severity == "critical" && e.CreatedDate >= lastWeek);

            health["database"] = new
            {
                total_files = totalFiles,
                total_users = totalUsers,
                active_users = activeUsers,
                status = "connected"
            };

            health["activity"] = new
            {
                recent_uploads = recentUploads,
                recent_logins = recentLogins,
                recent_failed_logins = recentFailedLogins
            };

            health["storage"] = new
            {
                total_size_mb = Math.Round(totalFileSizeMb, 2),
                total_files = totalFiles
            };

            health["security"] = new
            {
                critical_events_last_week = criticalEvents,
                failed_logins_24h = recentFailedLogins
            };

            health["timestamp"] = DateTime.UtcNow;

            return health;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting system health");
            return new Dictionary<string, object>
            {
                ["status"] = "error",
                ["error"] = ex.Message
            };
        }
    }

    public async Task MarkAlertAsReadAsync(int eventId)
    {
        try
        {
            var systemEvent = await _context.SystemEvents.FindAsync(eventId);
            if (systemEvent != null)
            {
                systemEvent.IsRead = true;
                await _context.SaveChangesAsync();
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error marking alert as read: {EventId}", eventId);
        }
    }

    public async Task<int> GetUnreadAlertCountAsync()
    {
        try
        {
            return await _context.SystemEvents.CountAsync(e => !e.IsRead);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting unread alert count");
            return 0;
        }
    }

    public async Task CleanupOldEventsAsync(int daysToKeep = 90)
    {
        try
        {
            var cutoffDate = DateTime.UtcNow.AddDays(-daysToKeep);

            // Delete old system events
            var oldEvents = await _context.SystemEvents
                .Where(e => e.CreatedDate < cutoffDate)
                .ToListAsync();

            if (oldEvents.Any())
            {
                _context.SystemEvents.RemoveRange(oldEvents);
                _logger.LogInformation("Cleaning up {Count} old system events", oldEvents.Count);
            }

            // Delete old audit logs
            var oldAudits = await _context.AuditLogs
                .Where(a => a.CreatedDate < cutoffDate)
                .ToListAsync();

            if (oldAudits.Any())
            {
                _context.AuditLogs.RemoveRange(oldAudits);
                _logger.LogInformation("Cleaning up {Count} old audit logs", oldAudits.Count);
            }

            // Delete old metrics (keep only 30 days for metrics)
            var metricsCutoff = DateTime.UtcNow.AddDays(-30);
            var oldMetrics = await _context.SystemMetrics
                .Where(m => m.Timestamp < metricsCutoff)
                .ToListAsync();

            if (oldMetrics.Any())
            {
                _context.SystemMetrics.RemoveRange(oldMetrics);
                _logger.LogInformation("Cleaning up {Count} old metrics", oldMetrics.Count);
            }

            await _context.SaveChangesAsync();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error cleaning up old events");
        }
    }
}
