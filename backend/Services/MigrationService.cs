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

    public MigrationService(AppDbContext context, ILogger<MigrationService> logger)
    {
        _context = context;
        _logger = logger;
    }

    public async Task RunMigrationsAsync()
    {
        _logger.LogInformation("Checking for pending migrations...");

        await EnsureMigrationHistoryTableAsync();

        var scriptsPath = Path.Combine(AppContext.BaseDirectory, "Migrations", "Scripts");

        if (!Directory.Exists(scriptsPath))
            scriptsPath = Path.Combine(Directory.GetCurrentDirectory(), "Migrations", "Scripts");

        if (!Directory.Exists(scriptsPath))
        {
            _logger.LogDebug("Migration scripts folder not found: {Path}", scriptsPath);
            return;
        }

        var scripts = Directory.GetFiles(scriptsPath, "*.sql")
            .OrderBy(f => f)
            .ToList();

        if (!scripts.Any())
        {
            _logger.LogDebug("No migration scripts found");
            return;
        }

        var executedMigrations = await GetExecutedMigrationsAsync();

        var pendingScripts = scripts
            .Where(s => !executedMigrations.Contains(Path.GetFileName(s)))
            .ToList();

        if (!pendingScripts.Any())
        {
            _logger.LogDebug("All migrations are up to date");
            return;
        }

        _logger.LogInformation("Found {Count} pending migration(s)", pendingScripts.Count);

        foreach (var scriptPath in pendingScripts)
        {
            var scriptName = Path.GetFileName(scriptPath);

            try
            {
                _logger.LogInformation("Running migration: {Script}", scriptName);

                var sql = await File.ReadAllTextAsync(scriptPath);

                var statements = sql
                    .Split(';', StringSplitOptions.RemoveEmptyEntries)
                    .Where(s => !string.IsNullOrWhiteSpace(s))
                    .ToList();

                foreach (var statement in statements)
                {
                    var lines = statement.Split('\n')
                        .Where(line => !line.Trim().StartsWith("--"))
                        .ToList();
                    var trimmedStatement = string.Join('\n', lines).Trim();

                    if (string.IsNullOrWhiteSpace(trimmedStatement))
                        continue;

                    try
                    {
                        await _context.Database.ExecuteSqlRawAsync(trimmedStatement);
                    }
                    catch (Exception ex) when (
                        ex.Message.Contains("already exists", StringComparison.OrdinalIgnoreCase) ||
                        ex.Message.Contains("Duplicate", StringComparison.OrdinalIgnoreCase) ||
                        ex.Message.Contains("duplicate", StringComparison.OrdinalIgnoreCase))
                    {
                        _logger.LogDebug("Ignoring idempotent error in {Script}: {Message}", scriptName, ex.Message);
                    }
                }

                await RecordMigrationAsync(scriptName);
                _logger.LogInformation("Completed migration: {Script}", scriptName);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error running migration {Script}", scriptName);
            }
        }

        _logger.LogInformation("Migration check completed");
    }

    private async Task EnsureMigrationHistoryTableAsync()
    {
        try
        {
            await _context.Database.ExecuteSqlRawAsync(@"
                CREATE TABLE IF NOT EXISTS __migration_history (
                    id SERIAL PRIMARY KEY,
                    script_name VARCHAR(255) NOT NULL UNIQUE,
                    executed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
                )
            ");
        }
        catch (Exception ex)
        {
            _logger.LogDebug("Migration history table may already exist: {Message}", ex.Message);
        }
    }

    private async Task<HashSet<string>> GetExecutedMigrationsAsync()
    {
        var result = new HashSet<string>();

        try
        {
            var connection = _context.Database.GetDbConnection();
            await connection.OpenAsync();

            using var command = connection.CreateCommand();
            command.CommandText = "SELECT script_name FROM __migration_history";

            using var reader = await command.ExecuteReaderAsync();
            while (await reader.ReadAsync())
            {
                result.Add(reader.GetString(0));
            }
        }
        catch (Exception ex)
        {
            _logger.LogDebug("Could not read migration history: {Message}", ex.Message);
        }

        return result;
    }

    private async Task RecordMigrationAsync(string scriptName)
    {
        try
        {
            await _context.Database.ExecuteSqlRawAsync(
                "INSERT INTO __migration_history (script_name) VALUES ({0})",
                scriptName
            );
        }
        catch (Exception ex)
        {
            _logger.LogWarning("Could not record migration {Script}: {Message}", scriptName, ex.Message);
        }
    }
}
