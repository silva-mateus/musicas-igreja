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
        _logger.LogInformation("Checking for pending migrations...");

        // Ensure migration history table exists
        await EnsureMigrationHistoryTableAsync();

        var scriptsPath = Path.Combine(AppContext.BaseDirectory, "Migrations", "Scripts");
        
        // Fallback for development
        if (!Directory.Exists(scriptsPath))
        {
            scriptsPath = Path.Combine(Directory.GetCurrentDirectory(), "Migrations", "Scripts");
        }

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

        // Get already executed migrations
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
                
                // Split by semicolons for SQLite (execute statements one by one)
                var statements = sql
                    .Split(';', StringSplitOptions.RemoveEmptyEntries)
                    .Where(s => !string.IsNullOrWhiteSpace(s))
                    .ToList();

                foreach (var statement in statements)
                {
                    // Remove comment lines from the statement
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
                    catch (SqliteException ex) when (ex.Message.Contains("duplicate column name"))
                    {
                        // Ignore "duplicate column name" errors (column already added)
                        _logger.LogDebug("Ignoring 'duplicate column' in {Script}: {Message}", scriptName, ex.Message);
                    }
                    catch (SqliteException ex)
                    {
                        // Log other SQLite errors but continue
                        _logger.LogWarning("SQLite error in {Script}: {Message}. Statement: {Statement}", 
                            scriptName, ex.Message, trimmedStatement.Substring(0, Math.Min(100, trimmedStatement.Length)));
                    }
                }

                // Record successful migration
                await RecordMigrationAsync(scriptName);
                _logger.LogInformation("Completed migration: {Script}", scriptName);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error running migration {Script}", scriptName);
                // Don't throw - continue with other migrations
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
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    script_name TEXT NOT NULL UNIQUE,
                    executed_at TEXT NOT NULL DEFAULT (datetime('now'))
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
