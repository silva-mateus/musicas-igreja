using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using MusicasIgreja.Api.Data;

namespace MusicasIgreja.Api.Services;

public interface IMigrationService
{
    Task RunMigrationsAsync();
}

public class MigrationService : IMigrationService
{
    private readonly AppDbContext _context;
    private readonly ILogger<MigrationService> _logger;
    private readonly IConfiguration _configuration;

    public MigrationService(AppDbContext context, ILogger<MigrationService> logger, IConfiguration configuration)
    {
        _context = context;
        _logger = logger;
        _configuration = configuration;
    }

    public async Task RunMigrationsAsync()
    {
        _logger.LogInformation("Starting migration scripts...");

        var scriptsPath = Path.Combine(AppContext.BaseDirectory, "Migrations", "Scripts");
        
        // Fallback for development
        if (!Directory.Exists(scriptsPath))
        {
            scriptsPath = Path.Combine(Directory.GetCurrentDirectory(), "Migrations", "Scripts");
        }

        if (!Directory.Exists(scriptsPath))
        {
            _logger.LogWarning("Migration scripts folder not found: {Path}", scriptsPath);
            return;
        }

        var scripts = Directory.GetFiles(scriptsPath, "*.sql")
            .OrderBy(f => f)
            .ToList();

        if (!scripts.Any())
        {
            _logger.LogInformation("No migration scripts found");
            return;
        }

        _logger.LogInformation("Found {Count} migration scripts", scripts.Count);

        foreach (var scriptPath in scripts)
        {
            var scriptName = Path.GetFileName(scriptPath);
            
            try
            {
                _logger.LogInformation("Running migration: {Script}", scriptName);
                
                var sql = await File.ReadAllTextAsync(scriptPath);
                
                // Split by semicolons for SQLite (execute statements one by one)
                var statements = sql
                    .Split(';', StringSplitOptions.RemoveEmptyEntries)
                    .Where(s => !string.IsNullOrWhiteSpace(s) && !s.Trim().StartsWith("--"))
                    .ToList();

                foreach (var statement in statements)
                {
                    var trimmedStatement = statement.Trim();
                    if (string.IsNullOrWhiteSpace(trimmedStatement) || trimmedStatement.StartsWith("--"))
                        continue;

                    try
                    {
                        await _context.Database.ExecuteSqlRawAsync(trimmedStatement);
                    }
                    catch (SqliteException ex) when (ex.SqliteErrorCode == 19) // UNIQUE constraint
                    {
                        // Ignore duplicate key errors (idempotent migrations)
                        _logger.LogDebug("Ignoring duplicate key in {Script}: {Message}", scriptName, ex.Message);
                    }
                    catch (SqliteException ex) when (ex.Message.Contains("already exists"))
                    {
                        // Ignore "table/index already exists" errors
                        _logger.LogDebug("Ignoring 'already exists' in {Script}: {Message}", scriptName, ex.Message);
                    }
                }

                _logger.LogInformation("Completed migration: {Script}", scriptName);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error running migration {Script}", scriptName);
                // Don't throw - continue with other migrations
            }
        }

        _logger.LogInformation("Migration scripts completed");
    }
}
