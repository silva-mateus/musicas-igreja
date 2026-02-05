using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using MusicasIgreja.Api.Data;
using MusicasIgreja.Api.Services;
using MusicasIgreja.Api.Helpers;

namespace MusicasIgreja.Api.Controllers;

[ApiController]
[Route("api/health")]
public class HealthController : ControllerBase
{
    private readonly AppDbContext _context;
    private readonly IMonitoringService _monitoringService;
    private readonly IFileService _fileService;
    private readonly ILogger<HealthController> _logger;

    public HealthController(AppDbContext context, IMonitoringService monitoringService, IFileService fileService, ILogger<HealthController> logger)
    {
        _context = context;
        _monitoringService = monitoringService;
        _fileService = fileService;
        _logger = logger;
    }

    [HttpGet]
    public ActionResult<object> GetHealth()
    {
        try
        {
            // Test database connection
            _context.Database.CanConnect();
            
            return Ok(new
            {
                status = "healthy",
                timestamp = DateTime.UtcNow,
                database = "connected"
            });
        }
        catch (Exception ex)
        {
            return StatusCode(503, new
            {
                status = "unhealthy",
                timestamp = DateTime.UtcNow,
                error = ex.Message
            });
        }
    }

    [HttpGet("extended")]
    public async Task<ActionResult<object>> GetExtendedHealth()
    {
        // Check if user is admin
        var isAdmin = AuthHelper.IsAdmin(HttpContext);
        if (!isAdmin)
        {
            return Unauthorized(new { error = "Acesso negado" });
        }

        try
        {
            var startTime = DateTime.UtcNow;

            // Database health
            var dbStartTime = DateTime.UtcNow;
            var canConnect = _context.Database.CanConnect();
            var dbLatency = (DateTime.UtcNow - dbStartTime).TotalMilliseconds;

            // Storage info
            var organizedFolder = _fileService.GetAbsolutePath("organized");
            var dataFolder = _fileService.GetAbsolutePath("data");
            
            long organizedSize = 0;
            long dataSize = 0;
            int fileCount = 0;

            try
            {
                if (Directory.Exists(organizedFolder))
                {
                    var organizedDir = new DirectoryInfo(organizedFolder);
                    organizedSize = organizedDir.EnumerateFiles("*.pdf", SearchOption.AllDirectories).Sum(f => f.Length);
                    fileCount = organizedDir.EnumerateFiles("*.pdf", SearchOption.AllDirectories).Count();
                }

                if (Directory.Exists(dataFolder))
                {
                    var dataDir = new DirectoryInfo(dataFolder);
                    dataSize = dataDir.EnumerateFiles("*.*", SearchOption.AllDirectories).Sum(f => f.Length);
                }
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Error calculating storage sizes");
            }

            // Database stats
            var totalFiles = await _context.PdfFiles.CountAsync();
            var totalUsers = await _context.Users.CountAsync();
            var totalLists = await _context.MergeLists.CountAsync();

            // Check for orphaned files (files in DB but not on disk)
            var orphanedCount = 0;
            try
            {
                var files = await _context.PdfFiles.Select(f => f.FilePath).Take(100).ToListAsync();
                orphanedCount = files.Count(filePath => !System.IO.File.Exists(_fileService.GetAbsolutePath(filePath)));
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Error checking orphaned files");
            }

            // System uptime (approximate)
            var uptime = DateTime.UtcNow - System.Diagnostics.Process.GetCurrentProcess().StartTime.ToUniversalTime();

            var totalProcessingTime = (DateTime.UtcNow - startTime).TotalMilliseconds;

            return Ok(new
            {
                status = "healthy",
                timestamp = DateTime.UtcNow,
                database = new
                {
                    status = canConnect ? "connected" : "disconnected",
                    latency_ms = Math.Round(dbLatency, 2),
                    total_files = totalFiles,
                    total_users = totalUsers,
                    total_lists = totalLists
                },
                storage = new
                {
                    organized_size_mb = Math.Round(organizedSize / (1024.0 * 1024.0), 2),
                    data_size_mb = Math.Round(dataSize / (1024.0 * 1024.0), 2),
                    total_size_mb = Math.Round((organizedSize + dataSize) / (1024.0 * 1024.0), 2),
                    file_count = fileCount,
                    orphaned_files = orphanedCount
                },
                system = new
                {
                    uptime_seconds = (int)uptime.TotalSeconds,
                    uptime_formatted = $"{(int)uptime.TotalDays}d {uptime.Hours}h {uptime.Minutes}m",
                    dotnet_version = Environment.Version.ToString()
                },
                processing_time_ms = Math.Round(totalProcessingTime, 2)
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting extended health");
            return StatusCode(500, new
            {
                status = "error",
                timestamp = DateTime.UtcNow,
                error = ex.Message
            });
        }
    }
}

