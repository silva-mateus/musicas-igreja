using Microsoft.EntityFrameworkCore;
using MusicasIgreja.Api.Data;

namespace MusicasIgreja.Api.Services;

public class MetricsCollectorService : BackgroundService
{
    private readonly ILogger<MetricsCollectorService> _logger;
    private readonly IServiceProvider _serviceProvider;
    private static readonly TimeSpan CollectionInterval = TimeSpan.FromMinutes(5);

    public MetricsCollectorService(ILogger<MetricsCollectorService> logger, IServiceProvider serviceProvider)
    {
        _logger = logger;
        _serviceProvider = serviceProvider;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation("[MetricsCollector] Service started");

        // Wait a bit after startup before first collection
        await Task.Delay(TimeSpan.FromMinutes(1), stoppingToken);

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await CollectMetricsAsync();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error collecting metrics");
            }

            // Wait for next collection interval
            await Task.Delay(CollectionInterval, stoppingToken);
        }

        _logger.LogInformation("[MetricsCollector] Service stopped");
    }

    private async Task CollectMetricsAsync()
    {
        using var scope = _serviceProvider.CreateScope();
        var context = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var monitoringService = scope.ServiceProvider.GetRequiredService<IMonitoringService>();
        var fileService = scope.ServiceProvider.GetRequiredService<IFileService>();
        var alertConfigService = scope.ServiceProvider.GetRequiredService<IAlertConfigurationService>();

        _logger.LogDebug("[MetricsCollector] Collecting system metrics...");

        try
        {
            // 1. Database metrics
            var totalFiles = await context.PdfFiles.CountAsync();
            var totalUsers = await context.Users.CountAsync();
            var activeUsers = await context.Users.CountAsync(u => u.IsActive);

            await monitoringService.RecordMetricAsync("database_files_count", totalFiles, "count");
            await monitoringService.RecordMetricAsync("database_users_count", totalUsers, "count");
            await monitoringService.RecordMetricAsync("database_active_users", activeUsers, "count");

            // 2. Storage metrics
            var organizedFolder = fileService.GetAbsolutePath("organized");
            var dataFolder = fileService.GetAbsolutePath("data");

            if (Directory.Exists(organizedFolder))
            {
                var organizedDir = new DirectoryInfo(organizedFolder);
                var files = organizedDir.EnumerateFiles("*.pdf", SearchOption.AllDirectories).ToList();
                var totalSize = files.Sum(f => f.Length);
                var totalSizeMb = totalSize / (1024.0 * 1024.0);

                await monitoringService.RecordMetricAsync("storage_organized_mb", totalSizeMb, "MB");
                await monitoringService.RecordMetricAsync("storage_file_count", files.Count, "count");

                // Check configured storage size alerts
                var storageSizeAlerts = await alertConfigService.GetTriggeredAlertsAsync("storage_size", totalSizeMb, "MB");
                foreach (var alert in storageSizeAlerts)
                {
                    await monitoringService.LogSecurityEventAsync(
                        "storage_size_warning",
                        alert.Severity,
                        $"{alert.Name}: {totalSizeMb:F0} MB",
                        null,
                        null,
                        null,
                        $"{{\"size_mb\": {totalSizeMb:F2}, \"file_count\": {files.Count}, \"threshold\": {alert.ThresholdValue}}}"
                    );
                }

                // Check for disk space warning
                var diskInfo = new DriveInfo(organizedDir.Root.FullName);
                var usedPercentage = (1 - (double)diskInfo.AvailableFreeSpace / diskInfo.TotalSize) * 100;
                
                await monitoringService.RecordMetricAsync("disk_usage_percent", usedPercentage, "%");

                // Check configured disk usage alerts
                var diskUsageAlerts = await alertConfigService.GetTriggeredAlertsAsync("disk_usage", usedPercentage, "%");
                foreach (var alert in diskUsageAlerts)
                {
                    await monitoringService.LogSecurityEventAsync(
                        "disk_space_warning",
                        alert.Severity,
                        $"{alert.Name}: {usedPercentage:F1}%",
                        null,
                        null,
                        null,
                        $"{{\"used_percent\": {usedPercentage:F2}, \"available_gb\": {diskInfo.AvailableFreeSpace / (1024.0 * 1024.0 * 1024.0):F2}, \"threshold\": {alert.ThresholdValue}}}"
                    );
                }
            }

            if (Directory.Exists(dataFolder))
            {
                var dataDir = new DirectoryInfo(dataFolder);
                var dataSize = dataDir.EnumerateFiles("*.*", SearchOption.AllDirectories).Sum(f => f.Length);
                var dataSizeMb = dataSize / (1024.0 * 1024.0);

                await monitoringService.RecordMetricAsync("storage_data_mb", dataSizeMb, "MB");
            }

            // 3. Recent activity metrics (last 24h)
            var yesterday = DateTime.UtcNow.AddDays(-1);
            var recentUploads = await context.PdfFiles.CountAsync(f => f.UploadDate >= yesterday);
            var recentFailedLogins = await context.SystemEvents
                .CountAsync(e => e.EventType == "login_failed" && e.CreatedDate >= yesterday);

            await monitoringService.RecordMetricAsync("activity_uploads_24h", recentUploads, "count");
            await monitoringService.RecordMetricAsync("security_failed_logins_24h", recentFailedLogins, "count");

            // Check configured failed login alerts
            var failedLoginAlerts = await alertConfigService.GetTriggeredAlertsAsync("failed_logins_24h", recentFailedLogins, "count");
            foreach (var alert in failedLoginAlerts)
            {
                await monitoringService.LogSecurityEventAsync(
                    "suspicious_activity",
                    alert.Severity,
                    $"{alert.Name}: {recentFailedLogins} tentativas em 24h",
                    null,
                    null,
                    null,
                    $"{{\"failed_logins_24h\": {recentFailedLogins}, \"threshold\": {alert.ThresholdValue}}}"
                );
            }

            // Check configured upload spike alerts
            var uploadAlerts = await alertConfigService.GetTriggeredAlertsAsync("uploads_24h", recentUploads, "count");
            foreach (var alert in uploadAlerts)
            {
                await monitoringService.LogSecurityEventAsync(
                    "upload_spike",
                    alert.Severity,
                    $"{alert.Name}: {recentUploads} uploads em 24h",
                    null,
                    null,
                    null,
                    $"{{\"uploads_24h\": {recentUploads}, \"threshold\": {alert.ThresholdValue}}}"
                );
            }

            // 4. System health
            var process = System.Diagnostics.Process.GetCurrentProcess();
            var memoryMb = process.WorkingSet64 / (1024.0 * 1024.0);
            var cpuTime = process.TotalProcessorTime.TotalSeconds;

            await monitoringService.RecordMetricAsync("system_memory_mb", memoryMb, "MB");
            await monitoringService.RecordMetricAsync("system_cpu_time_seconds", cpuTime, "seconds");

            // Check configured memory usage alerts
            var memoryAlerts = await alertConfigService.GetTriggeredAlertsAsync("memory_usage", memoryMb, "MB");
            foreach (var alert in memoryAlerts)
            {
                await monitoringService.LogSecurityEventAsync(
                    "memory_usage_high",
                    alert.Severity,
                    $"{alert.Name}: {memoryMb:F0} MB",
                    null,
                    null,
                    null,
                    $"{{\"memory_mb\": {memoryMb:F2}, \"threshold\": {alert.ThresholdValue}}}"
                );
            }

            _logger.LogDebug("[MetricsCollector] Metrics collection completed");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error during metrics collection");
            
            // Log system error event
            try
            {
                await monitoringService.LogSecurityEventAsync(
                    "metrics_collection_error",
                    "medium",
                    $"Error collecting metrics: {ex.Message}",
                    null,
                    null,
                    null
                );
            }
            catch
            {
                // Ignore errors when logging errors to avoid infinite loops
            }
        }
    }
}
