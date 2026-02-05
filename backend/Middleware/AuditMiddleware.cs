using MusicasIgreja.Api.Helpers;
using MusicasIgreja.Api.Services;

namespace MusicasIgreja.Api.Middleware;

public class AuditMiddleware
{
    private readonly RequestDelegate _next;
    private readonly ILogger<AuditMiddleware> _logger;

    public AuditMiddleware(RequestDelegate next, ILogger<AuditMiddleware> logger)
    {
        _next = next;
        _logger = logger;
    }

    public async Task InvokeAsync(HttpContext context, IMonitoringService monitoringService)
    {
        // Only audit modification requests
        var method = context.Request.Method;
        var shouldAudit = method == "POST" || method == "PUT" || method == "DELETE" || method == "PATCH";

        // Skip health checks, static assets, and monitoring endpoints
        var path = context.Request.Path.Value?.ToLower() ?? "";
        var skipPaths = new[] { "/api/health", "/api/monitoring", "/swagger", "/_next", "/favicon" };
        if (skipPaths.Any(skip => path.Contains(skip)))
        {
            await _next(context);
            return;
        }

        if (shouldAudit)
        {
            // Capture request info before processing
            var userId = context.Session.GetInt32("UserId");
            var username = context.Session.GetString("RoleName") ?? "anonymous";
            
            // Get actual username if available
            if (userId.HasValue)
            {
                // Username might be stored in session or we use role name as fallback
                var storedUsername = context.Session.GetString("Username");
                if (!string.IsNullOrEmpty(storedUsername))
                {
                    username = storedUsername;
                }
            }

            var ipAddress = AuthHelper.GetClientIp(context);

            // Process the request
            await _next(context);

            // Log audit after successful request (status 200-299)
            if (context.Response.StatusCode >= 200 && context.Response.StatusCode < 300)
            {
                if (userId.HasValue)
                {
                    var entityType = ExtractEntityType(path);
                    var action = MapMethodToAction(method);

                    if (!string.IsNullOrEmpty(entityType) && !string.IsNullOrEmpty(action))
                    {
                        // Don't await to avoid slowing down the response
                        _ = Task.Run(async () =>
                        {
                            try
                            {
                                await monitoringService.LogAuditActionAsync(
                                    action: action,
                                    entityType: entityType,
                                    entityId: null, // Could extract from path if needed
                                    userId: userId.Value,
                                    username: username,
                                    ipAddress: ipAddress
                                );
                            }
                            catch (Exception ex)
                            {
                                _logger.LogError(ex, "Error in audit middleware background logging");
                            }
                        });
                    }
                }
            }
        }
        else
        {
            await _next(context);
        }
    }

    private string MapMethodToAction(string method)
    {
        return method switch
        {
            "POST" => "create",
            "PUT" => "update",
            "PATCH" => "update",
            "DELETE" => "delete",
            _ => "unknown"
        };
    }

    private string ExtractEntityType(string path)
    {
        // Extract entity type from path like /api/files, /api/users, etc.
        var segments = path.Split('/', StringSplitOptions.RemoveEmptyEntries);
        
        if (segments.Length >= 2 && segments[0].ToLower() == "api")
        {
            var entity = segments[1].ToLower();
            
            // Map plural to singular or common names
            return entity switch
            {
                "files" => "file",
                "users" => "user",
                "merge_lists" or "merge-lists" => "list",
                "categories" => "category",
                "artists" => "artist",
                "liturgical_times" or "liturgical-times" => "liturgical_time",
                "roles" => "role",
                "auth" => "auth",
                "admin" => "admin",
                _ => entity
            };
        }

        return "unknown";
    }
}
