using Microsoft.Data.Sqlite;
using Npgsql;

namespace MigrateSqlite;

class Program
{
    static async Task<int> Main(string[] args)
    {
        if (args.Length < 2)
        {
            Console.WriteLine("SQLite to PostgreSQL Migration Tool");
            Console.WriteLine("====================================");
            Console.WriteLine();
            Console.WriteLine("Usage: dotnet run -- <sqlite-path> <postgres-connection-string>");
            Console.WriteLine();
            Console.WriteLine("Example:");
            Console.WriteLine("  dotnet run -- ./pdf_organizer.db \"Host=localhost;Port=5432;Database=musicas_igreja;Username=postgres;Password=xxx\"");
            Console.WriteLine();
            Console.WriteLine("To extract the SQLite file from the old Docker container:");
            Console.WriteLine("  docker cp musicas-igreja-app:/app/data/pdf_organizer.db ./pdf_organizer.db");
            return 1;
        }

        var sqlitePath = args[0];
        var pgConnectionString = args[1];

        if (!File.Exists(sqlitePath))
        {
            Console.WriteLine($"[ERROR] SQLite file not found: {sqlitePath}");
            return 1;
        }

        Console.WriteLine("SQLite to PostgreSQL Migration Tool");
        Console.WriteLine("====================================");
        Console.WriteLine($"  Source:  {sqlitePath}");
        Console.WriteLine($"  Target:  PostgreSQL ({ExtractHost(pgConnectionString)})");
        Console.WriteLine();

        try
        {
            await using var sqliteConn = new SqliteConnection($"Data Source={sqlitePath};Mode=ReadOnly");
            await sqliteConn.OpenAsync();

            await using var pgConn = new NpgsqlConnection(pgConnectionString);
            await pgConn.OpenAsync();

            var summary = new Dictionary<string, (int read, int written)>();

            summary["artists"] = await MigrateArtistsAsync(sqliteConn, pgConn);

            summary["categories"] = await MigrateCategoriesAsync(sqliteConn, pgConn);

            summary["pdf_files"] = await MigratePdfFilesAsync(sqliteConn, pgConn);

            summary["merge_lists"] = await MigrateMergeListsAsync(sqliteConn, pgConn);

            summary["merge_list_items"] = await MigrateTableAsync(sqliteConn, pgConn, "merge_list_items",
                ["id", "merge_list_id", "pdf_file_id", "order_position"]);

            summary["file_categories"] = await MigrateTableAsync(sqliteConn, pgConn, "file_categories",
                ["id", "file_id", "category_id"]);

            summary["file_artists"] = await MigrateTableAsync(sqliteConn, pgConn, "file_artists",
                ["id", "file_id", "artist_id"]);

            summary["users → core_users"] = await MigrateUsersAsync(sqliteConn, pgConn);

            await ResetSequencesAsync(pgConn);

            Console.WriteLine();
            Console.WriteLine("====================================");
            Console.WriteLine("  Migration Summary");
            Console.WriteLine("====================================");
            foreach (var (table, (read, written)) in summary)
            {
                var skipped = read - written;
                var status = skipped > 0 ? $" ({skipped} already existed)" : "";
                Console.WriteLine($"  {table,-25} {read,5} read -> {written,5} inserted{status}");
            }
            Console.WriteLine("====================================");
            Console.WriteLine("  Migration completed successfully!");
            Console.WriteLine();
            Console.WriteLine("  Next steps:");
            Console.WriteLine("    1. Copy organized PDFs into the API container:");
            Console.WriteLine("       docker cp ./organized/. musicas-igreja-api:/app/organized/");
            Console.WriteLine("    2. Verify data: curl http://localhost:5000/api/health");

            return 0;
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[ERROR] Migration failed: {ex.Message}");
            Console.WriteLine(ex.StackTrace);
            return 1;
        }
    }

    static async Task<(int read, int written)> MigrateTableAsync(
        SqliteConnection sqlite, NpgsqlConnection pg,
        string table, string[] columns)
    {
        Console.Write($"  Migrating {table}...");

        if (!await SqliteTableExistsAsync(sqlite, table))
        {
            Console.WriteLine(" SKIPPED (table not found in SQLite)");
            return (0, 0);
        }

        var columnsCsv = string.Join(", ", columns);
        await using var readCmd = sqlite.CreateCommand();
        readCmd.CommandText = $"SELECT {columnsCsv} FROM {table}";
        await using var reader = await readCmd.ExecuteReaderAsync();

        var rows = new List<object?[]>();
        while (await reader.ReadAsync())
        {
            var values = new object?[columns.Length];
            for (int i = 0; i < columns.Length; i++)
                values[i] = reader.IsDBNull(i) ? null : reader.GetValue(i);
            rows.Add(values);
        }

        if (rows.Count == 0)
        {
            Console.WriteLine(" 0 rows (empty table)");
            return (0, 0);
        }

        var paramNames = columns.Select((_, i) => $"@p{i}").ToArray();
        var insertSql = $"INSERT INTO {table} ({columnsCsv}) VALUES ({string.Join(", ", paramNames)}) ON CONFLICT DO NOTHING";

        int written = 0;
        foreach (var row in rows)
        {
            await using var cmd = new NpgsqlCommand(insertSql, pg);
            for (int i = 0; i < columns.Length; i++)
                cmd.Parameters.AddWithValue(paramNames[i], row[i] ?? DBNull.Value);
            written += await cmd.ExecuteNonQueryAsync();
        }

        Console.WriteLine($" {rows.Count} read, {written} inserted");
        return (rows.Count, written);
    }

    /// <summary>
    /// Artists need slug generation (not present in old SQLite schema).
    /// </summary>
    static async Task<(int read, int written)> MigrateArtistsAsync(
        SqliteConnection sqlite, NpgsqlConnection pg)
    {
        Console.Write("  Migrating artists...");

        if (!await SqliteTableExistsAsync(sqlite, "artists"))
        {
            Console.WriteLine(" SKIPPED (table not found in SQLite)");
            return (0, 0);
        }

        await using var readCmd = sqlite.CreateCommand();
        readCmd.CommandText = "SELECT id, name, description, created_date FROM artists";
        await using var reader = await readCmd.ExecuteReaderAsync();

        int readCount = 0, written = 0;
        while (await reader.ReadAsync())
        {
            readCount++;
            var id = reader.GetInt32(0);
            var name = reader.IsDBNull(1) ? "" : reader.GetString(1);
            var description = reader.IsDBNull(2) ? null : reader.GetString(2);
            var createdDate = reader.IsDBNull(3) ? DateTime.UtcNow : DateTime.Parse(reader.GetString(3));
            var slug = GenerateSlug(name);

            await using var cmd = new NpgsqlCommand(
                "INSERT INTO artists (id, name, slug, description, created_date) VALUES (@id, @name, @slug, @desc, @created) ON CONFLICT DO NOTHING", pg);
            cmd.Parameters.AddWithValue("@id", id);
            cmd.Parameters.AddWithValue("@name", name);
            cmd.Parameters.AddWithValue("@slug", slug);
            cmd.Parameters.AddWithValue("@desc", (object?)description ?? DBNull.Value);
            cmd.Parameters.AddWithValue("@created", createdDate);
            written += await cmd.ExecuteNonQueryAsync();
        }

        Console.WriteLine($" {readCount} read, {written} inserted");
        return (readCount, written);
    }

    /// <summary>
    /// Categories need slug + workspace_id (default 1). Old schema has no workspace.
    /// </summary>
    static async Task<(int read, int written)> MigrateCategoriesAsync(
        SqliteConnection sqlite, NpgsqlConnection pg)
    {
        Console.Write("  Migrating categories...");

        if (!await SqliteTableExistsAsync(sqlite, "categories"))
        {
            Console.WriteLine(" SKIPPED (table not found in SQLite)");
            return (0, 0);
        }

        await using var readCmd = sqlite.CreateCommand();
        readCmd.CommandText = "SELECT id, name, description, created_date FROM categories";
        await using var reader = await readCmd.ExecuteReaderAsync();

        int readCount = 0, written = 0;
        while (await reader.ReadAsync())
        {
            readCount++;
            var id = reader.GetInt32(0);
            var name = reader.IsDBNull(1) ? "" : reader.GetString(1);
            var description = reader.IsDBNull(2) ? null : reader.GetString(2);
            var createdDate = reader.IsDBNull(3) ? DateTime.UtcNow : DateTime.Parse(reader.GetString(3));
            var slug = GenerateSlug(name);

            await using var cmd = new NpgsqlCommand(
                "INSERT INTO categories (id, name, slug, description, created_date, workspace_id) VALUES (@id, @name, @slug, @desc, @created, @ws) ON CONFLICT DO NOTHING", pg);
            cmd.Parameters.AddWithValue("@id", id);
            cmd.Parameters.AddWithValue("@name", name);
            cmd.Parameters.AddWithValue("@slug", slug);
            cmd.Parameters.AddWithValue("@desc", (object?)description ?? DBNull.Value);
            cmd.Parameters.AddWithValue("@created", createdDate);
            cmd.Parameters.AddWithValue("@ws", 1);
            written += await cmd.ExecuteNonQueryAsync();
        }

        Console.WriteLine($" {readCount} read, {written} inserted");
        return (readCount, written);
    }

    /// <summary>
    /// PdfFiles need workspace_id (default 1). Old schema stored artist/category as text columns.
    /// </summary>
    static async Task<(int read, int written)> MigratePdfFilesAsync(
        SqliteConnection sqlite, NpgsqlConnection pg)
    {
        Console.Write("  Migrating pdf_files...");

        if (!await SqliteTableExistsAsync(sqlite, "pdf_files"))
        {
            Console.WriteLine(" SKIPPED (table not found in SQLite)");
            return (0, 0);
        }

        await using var readCmd = sqlite.CreateCommand();
        readCmd.CommandText = "SELECT id, filename, original_name, song_name, musical_key, youtube_link, file_path, file_size, upload_date, file_hash, page_count, description FROM pdf_files";
        await using var reader = await readCmd.ExecuteReaderAsync();

        int readCount = 0, written = 0;
        while (await reader.ReadAsync())
        {
            readCount++;
            var values = new object?[12];
            for (int i = 0; i < 12; i++)
                values[i] = reader.IsDBNull(i) ? null : reader.GetValue(i);

            var uploadDate = values[8] is { } v8 ? DateTime.Parse(v8.ToString()!) : DateTime.UtcNow;

            await using var cmd = new NpgsqlCommand(@"
                INSERT INTO pdf_files (id, filename, original_name, song_name, musical_key, youtube_link, file_path, file_size, upload_date, file_hash, page_count, description, workspace_id)
                VALUES (@id, @filename, @original, @song, @key, @youtube, @path, @size, @upload, @hash, @pages, @desc, @ws)
                ON CONFLICT DO NOTHING", pg);

            cmd.Parameters.AddWithValue("@id", Convert.ToInt32(values[0]!));
            cmd.Parameters.AddWithValue("@filename", (object?)values[1]?.ToString() ?? DBNull.Value);
            cmd.Parameters.AddWithValue("@original", (object?)values[2]?.ToString() ?? "unknown.pdf");
            cmd.Parameters.AddWithValue("@song", (object?)values[3]?.ToString() ?? DBNull.Value);
            cmd.Parameters.AddWithValue("@key", (object?)values[4]?.ToString() ?? DBNull.Value);
            cmd.Parameters.AddWithValue("@youtube", (object?)values[5]?.ToString() ?? DBNull.Value);
            cmd.Parameters.AddWithValue("@path", (object?)values[6]?.ToString() ?? "");
            cmd.Parameters.AddWithValue("@size", values[7] != null ? Convert.ToInt64(values[7]) : DBNull.Value);
            cmd.Parameters.AddWithValue("@upload", uploadDate);
            cmd.Parameters.AddWithValue("@hash", (object?)values[9]?.ToString() ?? DBNull.Value);
            cmd.Parameters.AddWithValue("@pages", values[10] != null ? Convert.ToInt32(values[10]) : DBNull.Value);
            cmd.Parameters.AddWithValue("@desc", (object?)values[11]?.ToString() ?? DBNull.Value);
            cmd.Parameters.AddWithValue("@ws", 1);

            written += await cmd.ExecuteNonQueryAsync();
        }

        Console.WriteLine($" {readCount} read, {written} inserted");
        return (readCount, written);
    }

    /// <summary>
    /// MergeLists need workspace_id (default 1).
    /// </summary>
    static async Task<(int read, int written)> MigrateMergeListsAsync(
        SqliteConnection sqlite, NpgsqlConnection pg)
    {
        Console.Write("  Migrating merge_lists...");

        if (!await SqliteTableExistsAsync(sqlite, "merge_lists"))
        {
            Console.WriteLine(" SKIPPED (table not found in SQLite)");
            return (0, 0);
        }

        await using var readCmd = sqlite.CreateCommand();
        readCmd.CommandText = "SELECT id, name, observations, created_date, updated_date FROM merge_lists";
        await using var reader = await readCmd.ExecuteReaderAsync();

        int readCount = 0, written = 0;
        while (await reader.ReadAsync())
        {
            readCount++;
            var id = reader.GetInt32(0);
            var name = reader.IsDBNull(1) ? "" : reader.GetString(1);
            var observations = reader.IsDBNull(2) ? null : reader.GetString(2);
            var createdDate = reader.IsDBNull(3) ? DateTime.UtcNow : DateTime.Parse(reader.GetString(3));
            var updatedDate = reader.IsDBNull(4) ? (DateTime?)null : DateTime.Parse(reader.GetString(4));

            await using var cmd = new NpgsqlCommand(
                "INSERT INTO merge_lists (id, name, observations, created_date, updated_date, workspace_id) VALUES (@id, @name, @obs, @created, @updated, @ws) ON CONFLICT DO NOTHING", pg);
            cmd.Parameters.AddWithValue("@id", id);
            cmd.Parameters.AddWithValue("@name", name);
            cmd.Parameters.AddWithValue("@obs", (object?)observations ?? DBNull.Value);
            cmd.Parameters.AddWithValue("@created", createdDate);
            cmd.Parameters.AddWithValue("@updated", (object?)updatedDate ?? DBNull.Value);
            cmd.Parameters.AddWithValue("@ws", 1);
            written += await cmd.ExecuteNonQueryAsync();
        }

        Console.WriteLine($" {readCount} read, {written} inserted");
        return (readCount, written);
    }

    static async Task<(int read, int written)> MigrateUsersAsync(
        SqliteConnection sqlite, NpgsqlConnection pg)
    {
        Console.Write("  Migrating users → core_users...");

        if (!await SqliteTableExistsAsync(sqlite, "users"))
        {
            Console.WriteLine(" SKIPPED (users table not found in SQLite)");
            return (0, 0);
        }

        var oldRoleNames = new Dictionary<int, string>();
        if (await SqliteTableExistsAsync(sqlite, "roles"))
        {
            await using var roleCmd = sqlite.CreateCommand();
            roleCmd.CommandText = "SELECT id, name FROM roles";
            await using var roleReader = await roleCmd.ExecuteReaderAsync();
            while (await roleReader.ReadAsync())
                oldRoleNames[roleReader.GetInt32(0)] = roleReader.GetString(1).ToLowerInvariant();
        }

        var newRoleIds = new Dictionary<string, int>();
        {
            await using var cmd = new NpgsqlCommand("SELECT \"Id\", \"Name\" FROM core_roles", pg);
            await using var reader = await cmd.ExecuteReaderAsync();
            while (await reader.ReadAsync())
                newRoleIds[reader.GetString(1).ToLowerInvariant()] = reader.GetInt32(0);
        }

        var defaultRoleId = newRoleIds.GetValueOrDefault("viewer", 1);

        var users = new List<Dictionary<string, object?>>();
        {
            await using var cmd = sqlite.CreateCommand();
            cmd.CommandText = "SELECT id, username, full_name, password_hash, role_id, is_active, must_change_password, created_date, last_login_date FROM users";
            await using var reader = await cmd.ExecuteReaderAsync();
            while (await reader.ReadAsync())
            {
                var row = new Dictionary<string, object?>();
                for (int i = 0; i < reader.FieldCount; i++)
                    row[reader.GetName(i)] = reader.IsDBNull(i) ? null : reader.GetValue(i);
                users.Add(row);
            }
        }

        if (users.Count == 0)
        {
            Console.WriteLine(" 0 rows (empty table)");
            return (0, 0);
        }

        int written = 0;
        foreach (var u in users)
        {
            var oldRoleId = u["role_id"] != null ? Convert.ToInt32(u["role_id"]) : 0;
            var oldRoleName = oldRoleNames.GetValueOrDefault(oldRoleId, "viewer");
            var newRoleId = newRoleIds.GetValueOrDefault(oldRoleName, defaultRoleId);
            var createdAt = u["created_date"] != null ? DateTime.Parse(u["created_date"]!.ToString()!) : DateTime.UtcNow;
            var lastLogin = u["last_login_date"] != null ? (DateTime?)DateTime.Parse(u["last_login_date"]!.ToString()!) : null;

            await using var cmd = new NpgsqlCommand(@"
                INSERT INTO core_users (""Id"", ""Username"", ""FullName"", ""PasswordHash"", ""RoleId"", ""IsActive"", ""MustChangePassword"", ""CreatedAt"", ""LastLoginDate"")
                VALUES (@id, @username, @fullName, @passwordHash, @roleId, @isActive, @mustChange, @createdAt, @lastLogin)
                ON CONFLICT DO NOTHING", pg);

            cmd.Parameters.AddWithValue("@id", Convert.ToInt32(u["id"]!));
            cmd.Parameters.AddWithValue("@username", u["username"]!.ToString()!);
            cmd.Parameters.AddWithValue("@fullName", u["full_name"]?.ToString() ?? "");
            cmd.Parameters.AddWithValue("@passwordHash", u["password_hash"]!.ToString()!);
            cmd.Parameters.AddWithValue("@roleId", newRoleId);
            cmd.Parameters.AddWithValue("@isActive", u["is_active"] != null && Convert.ToInt32(u["is_active"]) == 1);
            cmd.Parameters.AddWithValue("@mustChange", u["must_change_password"] != null && Convert.ToInt32(u["must_change_password"]) == 1);
            cmd.Parameters.AddWithValue("@createdAt", createdAt);
            cmd.Parameters.AddWithValue("@lastLogin", (object?)lastLogin ?? DBNull.Value);

            written += await cmd.ExecuteNonQueryAsync();
        }

        Console.WriteLine($" {users.Count} read, {written} inserted");
        if (written > 0)
        {
            Console.WriteLine("    Role mapping:");
            foreach (var (oldId, oldName) in oldRoleNames)
            {
                var newId = newRoleIds.GetValueOrDefault(oldName, defaultRoleId);
                Console.WriteLine($"      '{oldName}' (old id:{oldId}) → core_roles Id:{newId}");
            }
        }

        return (users.Count, written);
    }

    /// <summary>
    /// Reset PostgreSQL sequences to max(id)+1 so new inserts get correct IDs.
    /// </summary>
    static async Task ResetSequencesAsync(NpgsqlConnection pg)
    {
        Console.Write("  Resetting PostgreSQL sequences...");

        var tables = new[] { "artists", "categories", "pdf_files", "merge_lists", "merge_list_items", "file_categories", "file_artists" };

        foreach (var table in tables)
        {
            await using var cmd = new NpgsqlCommand(
                $"SELECT setval(pg_get_serial_sequence('{table}', 'id'), COALESCE(MAX(id), 0) + 1, false) FROM {table}", pg);
            try { await cmd.ExecuteScalarAsync(); }
            catch { /* sequence might not exist for some tables */ }
        }

        // core_users uses PascalCase column
        await using var usersCmd = new NpgsqlCommand(
            "SELECT setval(pg_get_serial_sequence('core_users', 'Id'), COALESCE(MAX(\"Id\"), 0) + 1, false) FROM core_users", pg);
        try { await usersCmd.ExecuteScalarAsync(); }
        catch { /* ignore */ }

        Console.WriteLine(" done");
    }

    static async Task<bool> SqliteTableExistsAsync(SqliteConnection sqlite, string table)
    {
        await using var cmd = sqlite.CreateCommand();
        cmd.CommandText = $"SELECT name FROM sqlite_master WHERE type='table' AND name='{table}'";
        return await cmd.ExecuteScalarAsync() != null;
    }

    static string GenerateSlug(string text)
    {
        if (string.IsNullOrWhiteSpace(text)) return "unnamed";
        var slug = text.ToLowerInvariant()
            .Replace("á", "a").Replace("à", "a").Replace("ã", "a").Replace("â", "a")
            .Replace("é", "e").Replace("ê", "e")
            .Replace("í", "i")
            .Replace("ó", "o").Replace("õ", "o").Replace("ô", "o")
            .Replace("ú", "u").Replace("ü", "u")
            .Replace("ç", "c");
        slug = System.Text.RegularExpressions.Regex.Replace(slug, @"[^a-z0-9\s-]", "");
        slug = System.Text.RegularExpressions.Regex.Replace(slug, @"[\s]+", "-");
        slug = System.Text.RegularExpressions.Regex.Replace(slug, @"-+", "-");
        return slug.Trim('-');
    }

    static string ExtractHost(string connectionString)
    {
        try
        {
            var parts = connectionString.Split(';')
                .Select(p => p.Split('='))
                .Where(p => p.Length == 2)
                .ToDictionary(p => p[0].Trim(), p => p[1].Trim(), StringComparer.OrdinalIgnoreCase);

            var host = parts.GetValueOrDefault("Host", "?");
            var port = parts.GetValueOrDefault("Port", "5432");
            var db = parts.GetValueOrDefault("Database", "?");
            return $"{host}:{port}/{db}";
        }
        catch
        {
            return "(unable to parse)";
        }
    }
}
