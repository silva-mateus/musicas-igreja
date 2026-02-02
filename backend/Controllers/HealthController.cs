using Microsoft.AspNetCore.Mvc;
using MusicasIgreja.Api.Data;

namespace MusicasIgreja.Api.Controllers;

[ApiController]
[Route("api/health")]
public class HealthController : ControllerBase
{
    private readonly AppDbContext _context;

    public HealthController(AppDbContext context)
    {
        _context = context;
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
}

