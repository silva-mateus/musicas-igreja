using Microsoft.AspNetCore.Mvc;
using MusicasIgreja.Api.Helpers;
using MusicasIgreja.Api.Services;

namespace MusicasIgreja.Api.Controllers;

[ApiController]
[Route("api/monitoring")]
public class MonitoringController : ControllerBase
{
    private readonly IMonitoringService _monitoringService;
    private readonly ILogger<MonitoringController> _logger;

    public MonitoringController(IMonitoringService monitoringService, ILogger<MonitoringController> logger)
    {
        _monitoringService = monitoringService;
        _logger = logger;
    }

    [HttpGet("alerts")]
    public async Task<ActionResult> GetAlerts()
    {
        // Check if user is authenticated and is admin
        var isAdmin = AuthHelper.IsAdmin(HttpContext);
        if (!isAdmin)
        {
            return Unauthorized(new { error = "Acesso negado" });
        }

        try
        {
            var userId = HttpContext.Session.GetInt32("UserId");
            var alerts = await _monitoringService.GetUnreadAlertsAsync(userId);

            return Ok(new
            {
                success = true,
                data = alerts.Select(a => new
                {
                    id = a.Id,
                    event_type = a.EventType,
                    severity = a.Severity,
                    source = a.Source,
                    message = a.Message,
                    user_id = a.UserId,
                    ip_address = a.IpAddress,
                    user_agent = a.UserAgent,
                    metadata = a.Metadata,
                    is_read = a.IsRead,
                    created_date = a.CreatedDate,
                    username = a.User?.Username
                }),
                count = alerts.Count
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting alerts");
            return StatusCode(500, new { error = "Erro ao buscar alertas" });
        }
    }

    [HttpGet("alerts/count")]
    public async Task<ActionResult> GetAlertCount()
    {
        var isAdmin = AuthHelper.IsAdmin(HttpContext);
        if (!isAdmin)
        {
            return Unauthorized(new { error = "Acesso negado" });
        }

        try
        {
            var count = await _monitoringService.GetUnreadAlertCountAsync();
            return Ok(new { count });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting alert count");
            return StatusCode(500, new { error = "Erro ao contar alertas" });
        }
    }

    [HttpPost("alerts/{id}/read")]
    public async Task<ActionResult> MarkAlertAsRead(int id)
    {
        var isAdmin = AuthHelper.IsAdmin(HttpContext);
        if (!isAdmin)
        {
            return Unauthorized(new { error = "Acesso negado" });
        }

        try
        {
            await _monitoringService.MarkAlertAsReadAsync(id);
            return Ok(new { success = true });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error marking alert as read");
            return StatusCode(500, new { error = "Erro ao marcar alerta como lido" });
        }
    }

    [HttpGet("events")]
    public async Task<ActionResult> GetEvents(
        [FromQuery] string? event_type = null,
        [FromQuery] string? severity = null,
        [FromQuery] int? user_id = null,
        [FromQuery] string? start_date = null,
        [FromQuery] string? end_date = null,
        [FromQuery] int page = 1,
        [FromQuery] int limit = 50)
    {
        var isAdmin = AuthHelper.IsAdmin(HttpContext);
        if (!isAdmin)
        {
            return Unauthorized(new { error = "Acesso negado" });
        }

        try
        {
            DateTime? startDate = null;
            DateTime? endDate = null;

            if (!string.IsNullOrEmpty(start_date) && DateTime.TryParse(start_date, out var sd))
                startDate = sd;

            if (!string.IsNullOrEmpty(end_date) && DateTime.TryParse(end_date, out var ed))
                endDate = ed;

            var (events, total) = await _monitoringService.GetRecentEventsAsync(
                event_type, severity, user_id, startDate, endDate, page, limit);

            return Ok(new
            {
                success = true,
                data = events.Select(e => new
                {
                    id = e.Id,
                    event_type = e.EventType,
                    severity = e.Severity,
                    source = e.Source,
                    message = e.Message,
                    user_id = e.UserId,
                    ip_address = e.IpAddress,
                    user_agent = e.UserAgent,
                    metadata = e.Metadata,
                    is_read = e.IsRead,
                    created_date = e.CreatedDate,
                    username = e.User?.Username
                }),
                pagination = new
                {
                    page,
                    limit,
                    total,
                    pages = (int)Math.Ceiling(total / (double)limit)
                }
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting events");
            return StatusCode(500, new { error = "Erro ao buscar eventos" });
        }
    }

    [HttpGet("audit")]
    public async Task<ActionResult> GetAuditLogs(
        [FromQuery] string? action = null,
        [FromQuery] string? entity_type = null,
        [FromQuery] int? user_id = null,
        [FromQuery] string? start_date = null,
        [FromQuery] string? end_date = null,
        [FromQuery] int page = 1,
        [FromQuery] int limit = 50)
    {
        var isAdmin = AuthHelper.IsAdmin(HttpContext);
        if (!isAdmin)
        {
            return Unauthorized(new { error = "Acesso negado" });
        }

        try
        {
            DateTime? startDate = null;
            DateTime? endDate = null;

            if (!string.IsNullOrEmpty(start_date) && DateTime.TryParse(start_date, out var sd))
                startDate = sd;

            if (!string.IsNullOrEmpty(end_date) && DateTime.TryParse(end_date, out var ed))
                endDate = ed;

            var (logs, total) = await _monitoringService.GetAuditLogsAsync(
                action, entity_type, user_id, startDate, endDate, page, limit);

            return Ok(new
            {
                success = true,
                data = logs.Select(l => new
                {
                    id = l.Id,
                    action = l.Action,
                    entity_type = l.EntityType,
                    entity_id = l.EntityId,
                    user_id = l.UserId,
                    username = l.Username,
                    ip_address = l.IpAddress,
                    old_value = l.OldValue,
                    new_value = l.NewValue,
                    created_date = l.CreatedDate
                }),
                pagination = new
                {
                    page,
                    limit,
                    total,
                    pages = (int)Math.Ceiling(total / (double)limit)
                }
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting audit logs");
            return StatusCode(500, new { error = "Erro ao buscar logs de auditoria" });
        }
    }

    [HttpGet("metrics")]
    public async Task<ActionResult> GetMetrics(
        [FromQuery] string? metric_type = null,
        [FromQuery] string? start_date = null,
        [FromQuery] string? end_date = null,
        [FromQuery] int limit = 100)
    {
        var isAdmin = AuthHelper.IsAdmin(HttpContext);
        if (!isAdmin)
        {
            return Unauthorized(new { error = "Acesso negado" });
        }

        try
        {
            DateTime? startDate = null;
            DateTime? endDate = null;

            if (!string.IsNullOrEmpty(start_date) && DateTime.TryParse(start_date, out var sd))
                startDate = sd;

            if (!string.IsNullOrEmpty(end_date) && DateTime.TryParse(end_date, out var ed))
                endDate = ed;

            var metrics = await _monitoringService.GetMetricsAsync(metric_type, startDate, endDate, limit);

            return Ok(new
            {
                success = true,
                data = metrics.Select(m => new
                {
                    id = m.Id,
                    metric_type = m.MetricType,
                    value = m.Value,
                    unit = m.Unit,
                    metadata = m.Metadata,
                    timestamp = m.Timestamp
                })
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting metrics");
            return StatusCode(500, new { error = "Erro ao buscar métricas" });
        }
    }

    [HttpGet("health-extended")]
    public async Task<ActionResult> GetHealthExtended()
    {
        var isAdmin = AuthHelper.IsAdmin(HttpContext);
        if (!isAdmin)
        {
            return Unauthorized(new { error = "Acesso negado" });
        }

        try
        {
            var health = await _monitoringService.GetSystemHealthAsync();
            return Ok(new { success = true, data = health });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting extended health");
            return StatusCode(500, new { error = "Erro ao buscar saúde do sistema" });
        }
    }
}
