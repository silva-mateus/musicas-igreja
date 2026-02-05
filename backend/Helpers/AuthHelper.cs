using Microsoft.AspNetCore.Mvc;
using MusicasIgreja.Api.Services;

namespace MusicasIgreja.Api.Helpers;

public static class AuthHelper
{
    /// <summary>
    /// Checks if user is authenticated (has an active session)
    /// </summary>
    public static bool IsAuthenticated(HttpContext context)
    {
        var userId = context.Session.GetInt32("UserId");
        return userId.HasValue && userId.Value > 0;
    }

    /// <summary>
    /// Gets the current user ID from session, or null if not authenticated
    /// </summary>
    public static int? GetCurrentUserId(HttpContext context)
    {
        return context.Session.GetInt32("UserId");
    }

    /// <summary>
    /// Gets the current user's role ID from session
    /// </summary>
    public static int? GetCurrentRoleId(HttpContext context)
    {
        return context.Session.GetInt32("RoleId");
    }

    /// <summary>
    /// Gets client IP address for rate limiting and logging
    /// </summary>
    public static string GetClientIp(HttpContext context)
    {
        var forwardedFor = context.Request.Headers["X-Forwarded-For"].FirstOrDefault();
        if (!string.IsNullOrEmpty(forwardedFor))
        {
            var ips = forwardedFor.Split(',', StringSplitOptions.RemoveEmptyEntries);
            if (ips.Length > 0)
                return ips[0].Trim();
        }
        
        return context.Connection.RemoteIpAddress?.ToString() ?? "unknown";
    }

    /// <summary>
    /// Checks if the current user has a specific permission
    /// </summary>
    public static async Task<bool> HasPermissionAsync(HttpContext context, IAuthService authService, Func<Models.Role, bool> permissionCheck)
    {
        var roleId = GetCurrentRoleId(context);
        if (!roleId.HasValue) return false;

        var role = await authService.GetRoleByIdAsync(roleId.Value);
        return role != null && permissionCheck(role);
    }

    /// <summary>
    /// Returns Unauthorized result if user is not authenticated
    /// Logs the unauthorized attempt
    /// </summary>
    public static ActionResult? CheckAuthentication(HttpContext context, ILogger? logger = null)
    {
        if (!IsAuthenticated(context))
        {
            var ip = GetClientIp(context);
            var path = context.Request.Path;
            var method = context.Request.Method;
            
            logger?.LogWarning(
                "[Auth] Unauthorized access attempt from {IP} to {Method} {Path}",
                ip, method, path);
            
            return new UnauthorizedObjectResult(new { success = false, error = "Autenticação necessária" });
        }
        
        // Renovar sessão a cada request autenticado (sliding expiration)
        context.Session.SetString("LastActivity", DateTime.UtcNow.ToString("O"));
        
        return null;
    }

    /// <summary>
    /// Returns Forbidden result if user doesn't have required permission
    /// Logs the forbidden attempt
    /// </summary>
    public static ActionResult? CheckPermission(HttpContext context, bool hasPermission, ILogger? logger = null)
    {
        if (!hasPermission)
        {
            var userId = GetCurrentUserId(context);
            var ip = GetClientIp(context);
            var path = context.Request.Path;
            var method = context.Request.Method;
            
            logger?.LogWarning(
                "[Auth] Forbidden access attempt from User {UserId} (IP: {IP}) to {Method} {Path}",
                userId, ip, method, path);
            
            return new ObjectResult(new { success = false, error = "Você não tem permissão para realizar esta ação" })
            {
                StatusCode = 403
            };
        }
        return null;
    }

    /// <summary>
    /// Checks if the current user is an admin (role name is "admin")
    /// </summary>
    public static bool IsAdmin(HttpContext context)
    {
        if (!IsAuthenticated(context)) return false;
        
        var roleName = context.Session.GetString("RoleName");
        return string.Equals(roleName, "admin", StringComparison.OrdinalIgnoreCase);
    }
}
